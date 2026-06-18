import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "apks";

type ApkInfo = {
  name: string;
  url: string;
  size: number;
  updatedAt: string;
};

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { title: "Télécharger My Taxi World Tycoon — APK Android" },
      { name: "description", content: "Télécharge la dernière version APK de My Taxi World Tycoon pour Android." },
      { property: "og:title", content: "Télécharger My Taxi World Tycoon" },
      { property: "og:description", content: "Dernière version APK officielle pour Android." },
    ],
  }),
  component: DownloadPage,
});

function formatSize(bytes: number) {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} Mo` : `${(bytes / 1024).toFixed(0)} Ko`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "—";
  }
}

async function loadLatest(): Promise<ApkInfo | null> {
  const { data, error } = await supabase.storage.from(BUCKET).list("", {
    limit: 100,
    sortBy: { column: "updated_at", order: "desc" },
  });
  if (error || !data) return null;
  const apk = data.find((f) => f.name.toLowerCase().endsWith(".apk"));
  if (!apk) return null;
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(apk.name, 60 * 60 * 24 * 365);
  if (!signed?.signedUrl) return null;
  return {
    name: apk.name,
    url: signed.signedUrl,
    size: (apk.metadata as any)?.size ?? 0,
    updatedAt: (apk as any).updated_at ?? (apk as any).created_at ?? new Date().toISOString(),
  };
}

function DownloadPage() {
  const [apk, setApk] = useState<ApkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dlProgress, setDlProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoStarted, setAutoStarted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setLoading(true);
    const info = await loadLatest();
    setApk(info);
    setLoading(false);
    return info;
  };

  // Force download via blob (signed URL is cross-origin → `download` attr ignored otherwise)
  const triggerDownload = async (info: ApkInfo) => {
    setError(null);
    setDownloading(true);
    setDlProgress(0);
    try {
      const res = await fetch(info.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const total = Number(res.headers.get("content-length") || info.size || 0);
      const reader = res.body?.getReader();
      if (!reader) {
        // Fallback: direct link
        const a = document.createElement("a");
        a.href = info.url;
        a.download = info.name;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          if (total) setDlProgress(Math.round((received / total) * 100));
        }
      }
      const blob = new Blob(chunks as BlobPart[], { type: "application/vnd.android.package-archive" });
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = info.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 2000);
      setDlProgress(100);
    } catch (e: any) {
      setError(e?.message ?? "Échec du téléchargement");
    } finally {
      setDownloading(false);
      setTimeout(() => setDlProgress(0), 1200);
    }
  };

  useEffect(() => {
    (async () => {
      const info = await refresh();
      // Auto-start download on first visit if URL has ?auto=1
      if (info && !autoStarted && new URLSearchParams(window.location.search).get("auto") === "1") {
        setAutoStarted(true);
        triggerDownload(info);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpload = async (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".apk")) {
      setError("Le fichier doit être un .apk");
      return;
    }
    setUploading(true);
    setProgress(10);
    try {
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(file.name, file, { upsert: true, contentType: "application/vnd.android.package-archive" });
      setProgress(90);
      if (upErr) throw upErr;
      await refresh();
      setProgress(100);
    } catch (e: any) {
      setError(e?.message ?? "Échec de l'upload");
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 600);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #0a0c10 0%, #131822 100%)",
      color: "#e5e7eb",
      fontFamily: "system-ui, -apple-system, sans-serif",
      padding: "32px 20px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}>
      <Link to="/" style={{ alignSelf: "flex-start", color: "#9ca3af", textDecoration: "none", fontSize: 14 }}>
        ← Retour au jeu
      </Link>

      <div style={{ maxWidth: 480, width: "100%", marginTop: 24, textAlign: "center" }}>
        <div style={{ fontSize: 72, marginBottom: 8 }}>🚕</div>
        <h1 style={{
          fontSize: 28, fontWeight: 900, color: "#f5c542", letterSpacing: 1, margin: 0,
          textShadow: "0 2px 0 #b8860b, 0 4px 12px rgba(0,0,0,0.5)",
        }}>
          My Taxi World Tycoon
        </h1>
        <p style={{ color: "#9ca3af", margin: "8px 0 28px", fontSize: 14, letterSpacing: 2, textTransform: "uppercase" }}>
          Télécharger pour Android
        </p>

        <div style={{
          background: "#1a1f2e", border: "1px solid #2a2f3e", borderRadius: 16,
          padding: 20, marginBottom: 16, textAlign: "left",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ color: "#9ca3af", fontSize: 13 }}>Fichier</span>
            <strong style={{ color: "#fde047", fontSize: 13, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {apk?.name ?? "—"}
            </strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ color: "#9ca3af", fontSize: 13 }}>Mise à jour</span>
            <strong style={{ color: "#e5e7eb" }}>{apk ? formatDate(apk.updatedAt) : "—"}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ color: "#9ca3af", fontSize: 13 }}>Taille</span>
            <strong style={{ color: "#e5e7eb" }}>{apk ? formatSize(apk.size) : "—"}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#9ca3af", fontSize: 13 }}>Package</span>
            <strong style={{ color: "#e5e7eb", fontSize: 13 }}>com.mytaxiworldtycoon</strong>
          </div>
        </div>

        {loading ? (
          <div style={{ color: "#9ca3af", padding: 20 }}>Chargement…</div>
        ) : apk ? (
          <>
            <button
              type="button"
              disabled={downloading}
              onClick={() => triggerDownload(apk)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                background: downloading
                  ? "linear-gradient(180deg, #6b7280 0%, #4b5563 100%)"
                  : "linear-gradient(180deg, #f5c542 0%, #e0a92a 100%)",
                color: "#1a1208", border: "none", fontSize: 20, fontWeight: 900,
                letterSpacing: 1, padding: "16px 0", borderRadius: 14,
                boxShadow: downloading ? "none" : "0 6px 0 #8a6510, 0 12px 24px rgba(0,0,0,0.5)",
                textTransform: "uppercase", cursor: downloading ? "wait" : "pointer",
              }}
            >
              {downloading ? `⏬ Téléchargement… ${dlProgress}%` : "⬇ Télécharger l'APK"}
            </button>
            {downloading && dlProgress > 0 && (
              <div style={{ marginTop: 10, height: 6, background: "#1f2937", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${dlProgress}%`, height: "100%", background: "#f5c542", transition: "width 0.2s" }} />
              </div>
            )}
            <a
              href={apk.url}
              download={apk.name}
              rel="noopener"
              style={{ display: "inline-block", marginTop: 10, color: "#93c5fd", fontSize: 12, textDecoration: "underline" }}
            >
              Lien direct (si le bouton ne fonctionne pas)
            </a>
            {error && (
              <div style={{ marginTop: 10, color: "#fca5a5", fontSize: 12 }}>⚠ {error}</div>
            )}
          </>
        ) : (
          <div style={{
            background: "#1a1f2e", border: "1px dashed #f59e0b", borderRadius: 14,
            padding: 20, color: "#fde68a", fontSize: 14, lineHeight: 1.5,
          }}>
            ⏳ <strong>Aucun APK disponible.</strong><br />
            Utilise le bouton ci-dessous pour uploader la première version.
          </div>
        )}

        {/* Upload zone */}
        <div style={{
          marginTop: 20, padding: 16,
          background: "#0f1320", border: "1px dashed #3b82f6", borderRadius: 14, textAlign: "left",
        }}>
          <div style={{ fontSize: 13, color: "#93c5fd", fontWeight: 700, marginBottom: 8 }}>
            🔧 Espace admin — Mettre à jour l'APK
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
            }}
            style={{ display: "none" }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            style={{
              width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
              background: uploading ? "#374151" : "linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)",
              color: "white", fontSize: 15, fontWeight: 700, cursor: uploading ? "wait" : "pointer",
              boxShadow: uploading ? "none" : "0 4px 0 #1e3a8a",
            }}
          >
            {uploading ? `Upload… ${progress}%` : "📤 Uploader un nouveau .apk"}
          </button>
          {progress > 0 && (
            <div style={{ marginTop: 10, height: 6, background: "#1f2937", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${progress}%`, height: "100%", background: "#3b82f6", transition: "width 0.3s" }} />
            </div>
          )}
          {error && (
            <div style={{ marginTop: 10, color: "#fca5a5", fontSize: 12 }}>⚠ {error}</div>
          )}
          <div style={{ marginTop: 8, color: "#6b7280", fontSize: 11 }}>
            Le fichier remplace automatiquement l'ancien APK et apparaît en téléchargement pour tous les joueurs.
          </div>
        </div>

        <div style={{
          marginTop: 20, padding: 16,
          background: "rgba(245,197,66,0.08)", border: "1px solid rgba(245,197,66,0.2)",
          borderRadius: 12, color: "#cbd5e1", fontSize: 12, lineHeight: 1.6, textAlign: "left",
        }}>
          <strong style={{ color: "#fde047" }}>📲 Installation :</strong><br />
          1. Télécharge le fichier .apk<br />
          2. Ouvre-le depuis ton téléphone<br />
          3. Autorise l'installation depuis sources inconnues si demandé<br />
          4. Lance le jeu et profite !
        </div>

        <p style={{ marginTop: 32, color: "#6b7280", fontSize: 11 }}>
          Application Android — Non disponible sur iOS
        </p>
      </div>
    </div>
  );
}
