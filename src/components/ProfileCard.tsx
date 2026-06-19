import { useRef, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AvatarKind } from "@/lib/useAuth";
import avatarMan from "@/assets/avatar-man.png";
import avatarWoman from "@/assets/avatar-woman.png";
import { getAllLiveries, TAXI_PAINTS } from "@/game/TaxiTycoon";

const TT_SAVE_KEY = "taxi-tycoon-v4";

export const AVATAR_MAN = avatarMan;
export const AVATAR_WOMAN = avatarWoman;

export function resolveAvatarSrc(kind: AvatarKind, url: string | null): string {
  if (kind === "woman") return avatarWoman;
  if (kind === "photo" && url) return url;
  return avatarMan;
}

export default function ProfileCard({ onClose }: { onClose: () => void }) {
  const { user, pseudo, avatarKind, avatarUrl, refresh } = useAuth();
  const [pseudoInput, setPseudoInput] = useState(pseudo);
  const [kind, setKind] = useState<AvatarKind>(avatarKind);
  const [localPhoto, setLocalPhoto] = useState<string | null>(avatarUrl);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Personnalisation taxi — lue/écrite dans la save locale du jeu
  const liveries = getAllLiveries();
  const [liveryId, setLiveryId] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(TT_SAVE_KEY);
      if (raw) return JSON.parse(raw).liveryId ?? "classic";
    } catch {}
    return "classic";
  });
  const [taxiColor, setTaxiColor] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(TT_SAVE_KEY);
      if (raw) return JSON.parse(raw).playerTaxiColor ?? "blue";
    } catch {}
    return "blue";
  });
  const currentPaint = TAXI_PAINTS.find((p) => p.id === taxiColor) ?? TAXI_PAINTS[0];
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TT_SAVE_KEY);
      const save = raw ? JSON.parse(raw) : {};
      save.liveryId = liveryId;
      save.playerTaxiColor = taxiColor;
      localStorage.setItem(TT_SAVE_KEY, JSON.stringify(save));
      window.dispatchEvent(new CustomEvent("jce:livery-changed", { detail: liveryId }));
      window.dispatchEvent(new CustomEvent("jce:taxi-color-changed", { detail: taxiColor }));
    } catch {}
  }, [liveryId, taxiColor]);

  if (!user) return null;

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErr("Photo trop lourde (max 2 Mo)"); return; }
    setErr(null);
    setSaving(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60);
      setLocalPhoto(signed?.signedUrl ?? null);
      setKind("photo");
      await supabase.from("profiles").update({ avatar_kind: "photo", avatar_url: path }).eq("id", user.id);
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Erreur upload");
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    setErr(null);
    setSaving(true);
    try {
      const newPseudo = pseudoInput.trim() || "Chauffeur";
      const updates: { pseudo: string; avatar_kind: AvatarKind; avatar_url?: string | null } =
        { pseudo: newPseudo, avatar_kind: kind };
      if (kind !== "photo") updates.avatar_url = null;
      const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
      if (error) throw error;
      await refresh();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const previewSrc = kind === "photo" ? (localPhoto ?? avatarUrl ?? avatarMan) : (kind === "woman" ? avatarWoman : avatarMan);

  return (
    <div className="pc-overlay" onClick={onClose}>
      <style>{`
        .pc-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 16px; }
        .pc-card { background: linear-gradient(160deg,#1f2937 0%,#0a0c10 100%); border: 2px solid #f5c542; border-radius: 18px; padding: 22px; max-width: 380px; width: 100%; color: #e5e7eb; box-shadow: 0 14px 40px rgba(0,0,0,0.65); font-family: system-ui,sans-serif; position: relative; }
        .pc-badge { position: absolute; top: -12px; right: 14px; background: #f5c542; color: #1a1208; font-weight: 900; font-size: 11px; padding: 4px 10px; border-radius: 6px; letter-spacing: 1.2px; }
        .pc-title { color: #f5c542; font-size: 18px; font-weight: 900; margin: 0 0 4px; letter-spacing: 1px; }
        .pc-sub { color: #9ca3af; font-size: 12px; margin: 0 0 14px; }
        .pc-avatar-row { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
        .pc-avatar-big { width: 84px; height: 84px; border-radius: 50%; border: 3px solid #f5c542; background: #fff; overflow: hidden; flex-shrink: 0; box-shadow: 0 6px 18px rgba(245,197,66,0.35); }
        .pc-avatar-big img { width: 100%; height: 100%; object-fit: cover; }
        .pc-info { font-size: 13px; line-height: 1.5; }
        .pc-info .pc-pseudo { color: #f5c542; font-weight: 900; font-size: 17px; }
        .pc-row { margin-bottom: 12px; }
        .pc-label { font-size: 12px; color: #9ca3af; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; }
        .pc-input { width: 100%; background: #0a0c10; border: 2px solid #374151; border-radius: 8px; padding: 10px 12px; color: #fff; font-size: 14px; box-sizing: border-box; outline: none; }
        .pc-input:focus { border-color: #f5c542; }
        .pc-avatars { display: flex; gap: 10px; }
        .pc-avatar-opt { flex: 1; background: #0a0c10; border: 2px solid #374151; border-radius: 10px; padding: 8px; cursor: pointer; text-align: center; transition: 0.15s; }
        .pc-avatar-opt.active { border-color: #f5c542; background: rgba(245,197,66,0.1); }
        .pc-avatar-opt img { width: 56px; height: 56px; border-radius: 50%; background: #fff; }
        .pc-avatar-opt .pc-lbl { display: block; font-size: 11px; color: #9ca3af; margin-top: 4px; font-weight: 700; }
        .pc-actions { display: flex; gap: 8px; margin-top: 16px; }
        .pc-btn { flex: 1; border: none; cursor: pointer; padding: 11px; border-radius: 8px; font-weight: 800; font-size: 14px; }
        .pc-btn.primary { background: linear-gradient(180deg,#f5c542,#e0a92a); color: #1a1208; }
        .pc-btn.ghost { background: transparent; color: #9ca3af; border: 1px solid #374151; }
        .pc-err { background: #7f1d1d; color: #fca5a5; padding: 8px 12px; border-radius: 8px; font-size: 12px; margin-bottom: 10px; }
        .pc-upload { background: #0a0c10; color: #f5c542; border: 2px dashed #f5c542; border-radius: 8px; padding: 10px; cursor: pointer; text-align: center; font-size: 12px; font-weight: 700; margin-top: 8px; display: block; width: 100%; box-sizing: border-box; }
      `}</style>
      <div className="pc-card" onClick={(e) => e.stopPropagation()}>
        <span className="pc-badge">CARTE PRO</span>
        <h2 className="pc-title">🪪 Chauffeur de Taxi</h2>
        <p className="pc-sub">My Taxi World Tycoon — Licence officielle</p>

        <div className="pc-avatar-row">
          <div className="pc-avatar-big">
            <img src={previewSrc} alt="avatar" />
          </div>
          <div className="pc-info">
            <div className="pc-pseudo">{pseudoInput || pseudo}</div>
            <div style={{ color: "#9ca3af", fontSize: 11 }}>ID&nbsp;: {user.id.slice(0, 8).toUpperCase()}</div>
            <div style={{ color: "#9ca3af", fontSize: 11 }}>Depuis&nbsp;: {new Date(user.created_at).toLocaleDateString()}</div>
          </div>
        </div>

        {err && <div className="pc-err">{err}</div>}

        <div className="pc-row">
          <div className="pc-label">Pseudo</div>
          <input className="pc-input" maxLength={16} value={pseudoInput} onChange={(e) => setPseudoInput(e.target.value)} />
        </div>

        <div className="pc-row">
          <div className="pc-label">Avatar</div>
          <div className="pc-avatars">
            <button className={`pc-avatar-opt ${kind === "man" ? "active" : ""}`} onClick={() => setKind("man")} type="button">
              <img src={avatarMan} alt="homme" />
              <span className="pc-lbl">Homme</span>
            </button>
            <button className={`pc-avatar-opt ${kind === "woman" ? "active" : ""}`} onClick={() => setKind("woman")} type="button">
              <img src={avatarWoman} alt="femme" />
              <span className="pc-lbl">Femme</span>
            </button>
            <button className={`pc-avatar-opt ${kind === "photo" ? "active" : ""}`} onClick={() => fileRef.current?.click()} type="button">
              <img src={localPhoto ?? avatarUrl ?? avatarMan} alt="photo" />
              <span className="pc-lbl">Ma photo</span>
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPickFile} />
          <button className="pc-upload" type="button" onClick={() => fileRef.current?.click()}>
            📷 Importer une photo (max 2 Mo)
          </button>
        </div>

        <div className="pc-row">
          <div className="pc-label">Mon taxi ({liveries.length} modèles)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 10 }}>
            {TAXI_PAINTS.map((paint) => (
              <button
                key={paint.id}
                type="button"
                onClick={() => setTaxiColor(paint.id)}
                title={paint.name}
                style={{
                  height: 34,
                  borderRadius: 8,
                  border: taxiColor === paint.id ? "2px solid #f5c542" : "2px solid #374151",
                  background: "#0a0c10",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: paint.color, border: "2px solid rgba(255,255,255,0.7)" }} />
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, maxHeight: 220, overflowY: "auto", padding: 2 }}>
            {liveries.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLiveryId(l.id)}
                style={{
                  background: liveryId === l.id ? "rgba(245,197,66,0.15)" : "#0a0c10",
                  border: liveryId === l.id ? "2px solid #f5c542" : "2px solid #374151",
                  borderRadius: 8, padding: 6, cursor: "pointer", textAlign: "center",
                }}
              >
                <img src={l.image} alt={l.name} style={{ width: "100%", height: 42, objectFit: "contain", transform: l.faceRight ? undefined : "scaleX(-1)", filter: currentPaint.filter }} />
                <div style={{ fontSize: 10, color: "#e5e7eb", fontWeight: 700, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</div>
                <div style={{ fontSize: 8, color: "#8a8e94" }}>{l.city}</div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "#8a8e94", marginTop: 4 }}>💡 De nouveaux modèles peuvent être ajoutés par l'admin.</div>
        </div>



        <div className="pc-actions">
          <button className="pc-btn ghost" type="button" onClick={onClose}>Fermer</button>
          <button className="pc-btn primary" type="button" disabled={saving} onClick={save}>
            {saving ? "..." : "💾 Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
