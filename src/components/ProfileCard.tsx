import { useRef, useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AvatarKind } from "@/lib/useAuth";
import { tierFor } from "@/lib/license";
import { deleteOwnAccount } from "@/lib/account.functions";
import avatarMan from "@/assets/avatar-man.png";
import avatarWoman from "@/assets/avatar-woman.png";
import { getAllLiveries, TAXI_PAINTS } from "@/game/TaxiTycoon";
import { listCustomVehicles, VEHICLE_CATEGORY_LABELS, type CustomVehicle, type CustomVehicleCategory } from "@/game/gameAssets";


const TT_SAVE_KEY = "taxi-tycoon-v4";

export const AVATAR_MAN = avatarMan;
export const AVATAR_WOMAN = avatarWoman;

export function resolveAvatarSrc(kind: AvatarKind, url: string | null): string {
  if (kind === "woman") return avatarWoman;
  if (kind === "photo" && url) return url;
  return avatarMan;
}

export default function ProfileCard({ onClose }: { onClose: () => void }) {
  const { user, pseudo, driverName, avatarKind, avatarUrl, licenseLevel, licenseXp, refresh } = useAuth();
  const [pseudoInput, setPseudoInput] = useState(pseudo);
  const [driverNameInput, setDriverNameInput] = useState(driverName);
  const [kind, setKind] = useState<AvatarKind>(avatarKind);
  const [localPhoto, setLocalPhoto] = useState<string | null>(avatarUrl);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Suppression de compte
  const deleteAccountFn = useServerFn(deleteOwnAccount);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const handleDeleteAccount = async () => {
    setDeleteErr(null);
    setDeleting(true);
    try {
      await deleteAccountFn({});
      try { await supabase.auth.signOut(); } catch {}
      try { localStorage.removeItem("taxi-tycoon-v4"); } catch {}
      window.location.href = "/";
    } catch (e: any) {
      setDeleteErr(e?.message ?? "Erreur lors de la suppression");
      setDeleting(false);
    }
  };



  // re-sync si useAuth charge après le mount
  useEffect(() => { setPseudoInput(pseudo); }, [pseudo]);
  useEffect(() => { setDriverNameInput(driverName); }, [driverName]);
  useEffect(() => { setKind(avatarKind); }, [avatarKind]);
  useEffect(() => { setLocalPhoto(avatarUrl); }, [avatarUrl]);


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
    setSavedMsg(null);
    setSaving(true);
    try {
      if (!user) throw new Error("Pas connecté");
      const newPseudo = pseudoInput.trim().slice(0, 16) || "Chauffeur";
      const newDriver = driverNameInput.trim().slice(0, 40) || null;
      const updates: any = {
        id: user.id,
        pseudo: newPseudo,
        driver_name: newDriver,
        avatar_kind: kind,
      };
      if (kind !== "photo") updates.avatar_url = null;
      // upsert : marche même si la ligne profiles n'existe pas encore
      const { error } = await supabase
        .from("profiles")
        .upsert(updates, { onConflict: "id" });
      if (error) throw error;
      await refresh();
      setSavedMsg("✅ Profil enregistré");
      setTimeout(() => setSavedMsg(null), 1800);
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
            <div className="pc-pseudo">{driverNameInput || pseudoInput || pseudo}</div>
            <div style={{ color: "#9ca3af", fontSize: 11 }}>ID&nbsp;: {user.id.slice(0, 8).toUpperCase()}</div>
            <div style={{ color: "#9ca3af", fontSize: 11 }}>Depuis&nbsp;: {new Date(user.created_at).toLocaleDateString()}</div>
          </div>
        </div>

        {(() => {
          const t = tierFor(licenseLevel);
          const nextXp = t.nextXp;
          const pct = nextXp ? Math.min(100, Math.round(((licenseXp - t.minXp) / (nextXp - t.minXp)) * 100)) : 100;
          // Plaque évolutive : préfixe LV + niveau, hash stable sur l'id.
          const idSeed = (user?.id || "00000000").replace(/-/g, "").toUpperCase();
          const letters = (idSeed.replace(/[^A-Z]/g, "") + "AAA").slice(0, 3);
          const digits = (idSeed.replace(/[^0-9]/g, "") + "000").slice(0, 3);
          const plate = `LV${String(t.level).padStart(2, "0")}-${letters}-${digits}`;
          return (
            <div style={{
              background: "linear-gradient(160deg,#0a0c10,#1f2937)",
              border: "2px solid #f5c542", borderRadius: 12, padding: 12, marginBottom: 12,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ color: "#f5c542", fontWeight: 900, fontSize: 13, letterSpacing: 0.5 }}>
                  {t.badge} PERMIS — Niv. {t.level} {t.name}
                </div>
                <div style={{ color: "#fde047", fontSize: 11, fontWeight: 700 }}>
                  {nextXp ? `${licenseXp} / ${nextXp} XP` : `${licenseXp} XP (max)`}
                </div>
              </div>
              <div style={{ height: 8, background: "#0a0c10", borderRadius: 4, overflow: "hidden", border: "1px solid #374151" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#f59e0b,#fde047)", transition: "width .3s" }} />
              </div>
              <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
                <div style={{
                  background: "linear-gradient(180deg,#fef9c3,#fde047)",
                  color: "#1a1208",
                  border: "2px solid #1a1208",
                  borderRadius: 6,
                  padding: "4px 14px",
                  font: "900 18px/1 'Courier New', ui-monospace, monospace",
                  letterSpacing: 2,
                  boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.25)",
                }} title="Ta plaque évolue à chaque montée de permis">
                  {plate}
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: "#9ca3af" }}>
                {t.level >= 4 ? "⭐ Clients STAR débloqués (+100% pourboire)" :
                 t.level >= 3 ? "🥈 Clients VIP débloqués (+50% pourboire). STAR à Niv. 4." :
                 t.level >= 2 ? "Encore un peu : clients VIP à Niv. 3 🥈" :
                                "Termine des courses pour monter de niveau et débloquer les clients VIP / STAR."}
              </div>
            </div>
          );
        })()}

        {err && <div className="pc-err">{err}</div>}
        {savedMsg && (
          <div style={{ background: "#065f46", color: "#a7f3d0", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 10, fontWeight: 700 }}>
            {savedMsg}
          </div>
        )}

        <div className="pc-row">
          <div className="pc-label">🪪 Nom du chauffeur (carte pro)</div>
          <input
            className="pc-input"
            maxLength={40}
            placeholder="Ex. Jean Dupont"
            value={driverNameInput}
            onChange={(e) => setDriverNameInput(e.target.value)}
          />
        </div>

        <div className="pc-row">
          <div className="pc-label">Pseudo (visible en jeu)</div>
          <input
            className="pc-input"
            maxLength={16}
            placeholder="Ex. TaxiKing"
            value={pseudoInput}
            onChange={(e) => setPseudoInput(e.target.value)}
          />
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

        {/* Catalogue véhicules ajoutés par l'admin — lecture seule */}
        <AdminVehiclesCatalog />



        <div className="pc-actions">
          <button className="pc-btn ghost" type="button" onClick={onClose}>Fermer</button>
          <button className="pc-btn primary" type="button" disabled={saving} onClick={save}>
            {saving ? "..." : "💾 Enregistrer"}
          </button>
        </div>

        {/* Zone dangereuse */}
        <div style={{
          marginTop: 22, paddingTop: 16,
          borderTop: "1px dashed #7f1d1d",
        }}>
          <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            ⚠️ Zone dangereuse
          </div>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 10px", lineHeight: 1.5 }}>
            Supprimer ton compte efface immédiatement et définitivement ton profil, ton pseudo,
            ton avatar et tes scores en ligne.
          </p>
          <button
            type="button"
            onClick={() => { setDeleteConfirm(""); setDeleteErr(null); setShowDelete(true); }}
            style={{
              width: "100%", padding: 11, borderRadius: 8,
              background: "transparent", color: "#fca5a5",
              border: "1px solid #7f1d1d", fontWeight: 800, fontSize: 13,
              cursor: "pointer",
            }}
          >
            🗑️ Supprimer mon compte
          </button>
        </div>

        {showDelete && (
          <div
            onClick={() => !deleting && setShowDelete(false)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 11000,
              display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#14171c", border: "2px solid #ef4444",
                borderRadius: 14, padding: 22, maxWidth: 380, width: "100%",
                boxShadow: "0 14px 40px rgba(0,0,0,0.6)",
              }}
            >
              <h3 style={{ color: "#ef4444", margin: "0 0 8px", fontSize: 18, fontWeight: 900 }}>
                🗑️ Supprimer mon compte
              </h3>
              <p style={{ color: "#e5e7eb", fontSize: 13.5, lineHeight: 1.55, margin: "0 0 12px" }}>
                Cette action est <strong style={{ color: "#fca5a5" }}>irréversible</strong>. Ton compte,
                ton pseudo, ton avatar et tes scores en ligne seront <strong>supprimés définitivement</strong>.
              </p>
              <p style={{ color: "#9ca3af", fontSize: 12, margin: "0 0 8px" }}>
                Pour confirmer, tape ton pseudo&nbsp;: <strong style={{ color: "#f5c542" }}>{pseudo}</strong>
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={pseudo}
                disabled={deleting}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8,
                  background: "#0a0c10", color: "#fff", border: "2px solid #374151",
                  fontSize: 14, boxSizing: "border-box", outline: "none",
                }}
              />
              {deleteErr && (
                <div style={{ marginTop: 10, background: "#7f1d1d", color: "#fecaca", padding: "8px 12px", borderRadius: 8, fontSize: 12 }}>
                  {deleteErr}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setShowDelete(false)}
                  disabled={deleting}
                  style={{
                    flex: 1, padding: 11, borderRadius: 8, cursor: "pointer",
                    background: "transparent", color: "#9ca3af",
                    border: "1px solid #374151", fontWeight: 800, fontSize: 13,
                  }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteConfirm.trim() !== pseudo}
                  style={{
                    flex: 1, padding: 11, borderRadius: 8,
                    cursor: deleting || deleteConfirm.trim() !== pseudo ? "not-allowed" : "pointer",
                    background: deleting || deleteConfirm.trim() !== pseudo ? "#4b5563" : "#dc2626",
                    color: "#fff", border: "none", fontWeight: 900, fontSize: 13,
                  }}
                >
                  {deleting ? "Suppression..." : "🗑️ Supprimer"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
