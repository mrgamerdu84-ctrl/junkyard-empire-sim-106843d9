import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { useAdminConfig, setAdmin, resetAdmin, type AdminConfig } from "./adminConfig";
import { useVersionCheck, formatBuildDate } from "@/lib/version-check";
import { GAME_ASSETS, setAssetOverride, listAssetKeys, type AssetKey } from "./gameAssets";

// SHA-256 du mot de passe admin. Modifie ce hash pour changer le mot de passe.
const ADMIN_PASS_HASH = "7d473072673d5b86575304cb2a23b92a51e0cde043856919249b3df582a8625d";
const UNLOCK_KEY = "tt-admin-unlocked";

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* Floating gear button + slide-in admin panel. */
export default function AdminPanel() {
  const [open, setOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwdErr, setPwdErr] = useState("");
  const [tab, setTab] = useState<"trafic" | "hq" | "missions" | "rival" | "circuit" | "skins" | "export">("trafic");
  const [placeMode, setPlaceMode] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const cfg = useAdminConfig();

  // Rappel du déverrouillage pour la session courante
  useEffect(() => {
    try { if (sessionStorage.getItem(UNLOCK_KEY) === "1") setUnlocked(true); } catch {}
  }, []);

  const tryUnlock = async () => {
    const h = await sha256(pwd);
    if (h === ADMIN_PASS_HASH) {
      setUnlocked(true);
      setPwd("");
      setPwdErr("");
      try { sessionStorage.setItem(UNLOCK_KEY, "1"); } catch {}
    } else {
      setPwdErr("Mot de passe incorrect");
      setPwd("");
    }
  };


  // Mode "placer le QG" — clic sur la map = nouvelle position.
  // On ferme le panneau pendant le placement pour que le clic atteigne la map,
  // et on convertit n'importe quel clic en coordonnées SVG (le SVG du jeu a
  // pointer-events:none, donc on ne peut pas se fier à svg.contains(target)).
  useEffect(() => {
    if (!placeMode) return;
    const onClick = (e: MouseEvent) => {
      // Ignore les clics sur les contrôles flottants
      const target = e.target as HTMLElement;
      if (target.closest(".adm-place-controls")) return;
      const svg = document.querySelector(".tt-root svg") as SVGSVGElement | null;
      if (!svg) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const p = pt.matrixTransform(ctm.inverse());
      const x = Math.max(0, Math.min(1920, p.x));
      const y = Math.max(0, Math.min(1080, p.y));
      setAdmin({ hqUseFreePos: true, hqX: x, hqY: y });
      e.stopPropagation();
      e.preventDefault();
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [placeMode]);

  const startPlacement = () => {
    setPlaceMode(true);
    setOpen(false);
  };

  const bumpScale = (d: number) => setAdmin({ hqScale: Math.max(0.3, Math.min(8, cfg.hqScale + d)) });
  const bumpRot = (d: number) => setAdmin({ hqRotation: cfg.hqRotation + d });

  // === Dessin du circuit : clic point par point ===
  useEffect(() => {
    if (!drawMode) return;
    const svg = document.querySelector(".tt-root svg") as SVGSVGElement | null;
    if (!svg) return;
    const toSvg = (cx: number, cy: number) => {
      const pt = svg.createSVGPoint();
      pt.x = cx; pt.y = cy;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const p = pt.matrixTransform(ctm.inverse());
      return { x: Math.max(0, Math.min(1920, p.x)), y: Math.max(0, Math.min(1080, p.y)) };
    };
    const onClick = (e: MouseEvent) => {
      const tgt = e.target as HTMLElement;
      if (tgt.closest(".adm-place-controls") || tgt.closest(".adm-btn") || tgt.closest(".adm-place-banner")) return;
      const p = toSvg(e.clientX, e.clientY);
      if (!p) return;
      const current = (cfgRef.current.circuitPoints ?? []) as { x: number; y: number }[];
      setAdmin({ circuitPoints: [...current, p] });
      e.stopPropagation();
      e.preventDefault();
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [drawMode]);

  // Garde la config courante accessible dans le handler de clic
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  const startDraw = () => {
    setAdmin({ circuitPoints: [] }); // repart d'un circuit vide
    setDrawMode(true);
    setOpen(false);
  };
  const undoPoint = () => {
    const pts = cfg.circuitPoints ?? [];
    if (pts.length === 0) return;
    setAdmin({ circuitPoints: pts.slice(0, -1) });
  };
  const finishDraw = () => setDrawMode(false);
  const clearCircuit = () => setAdmin({ circuitPoints: [], circuitTaxiCount: 0 });






  return (
    <>
      <style>{`
        .adm-btn {
          position: fixed;
          top: max(14px, env(safe-area-inset-top, 0px));
          right: max(14px, env(safe-area-inset-right, 0px));
          z-index: 9999;
          width: 48px; height: 48px; border-radius: 50%; border: 2px solid #f5c542;
          background: rgba(20,22,28,0.92); color: #f5c542; font-size: 24px;
          cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(8px);
        }
        .adm-btn:hover { background: rgba(40,42,50,0.95); }
        .adm-overlay {
          position: fixed; inset: 0; z-index: 9998;
          background: rgba(0,0,0,0.5);
        }
        .adm-panel {
          position: fixed; top: 0; right: 0; bottom: 0; width: min(380px, 92vw);
          z-index: 9999; background: #14171c; color: #e8edf2;
          box-shadow: -8px 0 32px rgba(0,0,0,0.6);
          padding: 18px 18px 24px; overflow-y: auto;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .adm-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .adm-h h2 { margin: 0; font-size: 16px; color: #f5c542; letter-spacing: 0.5px; }
        .adm-close { background: transparent; border: none; color: #8a8e94; font-size: 24px; cursor: pointer; line-height: 1; }
        .adm-tabs { display: flex; gap: 4px; margin-bottom: 14px; border-bottom: 1px solid #2a2f38; padding-bottom: 8px; }
        .adm-tab {
          flex: 1; padding: 6px 8px; background: #1f242b; color: #c8ccd2;
          border: 1px solid #2a2f38; border-radius: 6px; cursor: pointer;
          font-size: 11px; font-weight: 700; letter-spacing: 0.3px;
        }
        .adm-tab.active { background: #f5c542; color: #14171c; border-color: #f5c542; }
        .adm-section { margin-bottom: 14px; }
        .adm-label { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; color: #c8ccd2; }
        .adm-val { color: #f5c542; font-weight: 600; font-variant-numeric: tabular-nums; }
        .adm-section input[type="range"] { width: 100%; }
        .adm-reset, .adm-place {
          width: 100%; padding: 10px; border: 1px solid #3a3f48; border-radius: 6px;
          background: #1f242b; color: #e8edf2; cursor: pointer; margin-top: 10px; font-size: 13px;
        }
        .adm-reset:hover, .adm-place:hover { background: #2a2f38; }
        .adm-place.active { background: #f5c542; color: #14171c; border-color: #f5c542; font-weight: 700; }
        .adm-hint { font-size: 11px; color: #6a6e74; margin-top: 2px; }
        .adm-toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; color: #c8ccd2; }
        .adm-toggle input { accent-color: #f5c542; }
        .adm-place-banner {
          position: absolute; top: 14px; left: 50%; transform: translateX(-50%); z-index: 60;
          background: #f5c542; color: #14171c; padding: 8px 14px; border-radius: 20px;
          font-size: 13px; font-weight: 700; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          pointer-events: none;
        }
        .adm-place-controls {
          position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); z-index: 60;
          background: rgba(20,22,28,0.95); color: #e8edf2; padding: 10px 12px; border-radius: 14px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.6); backdrop-filter: blur(8px);
          display: flex; flex-direction: column; gap: 8px; align-items: stretch;
          font-family: system-ui, sans-serif; min-width: 240px;
        }
        .adm-place-row { display: flex; align-items: center; gap: 6px; justify-content: space-between; }
        .adm-place-row .lbl { font-size: 11px; color: #c8ccd2; flex: 1; }
        .adm-place-row .val { font-size: 12px; color: #f5c542; font-weight: 700; min-width: 44px; text-align: center; font-variant-numeric: tabular-nums; }
        .adm-place-row button {
          width: 34px; height: 34px; border-radius: 8px; border: 1px solid #3a3f48;
          background: #1f242b; color: #f5c542; font-size: 18px; font-weight: 700; cursor: pointer;
        }
        .adm-place-row button:active { background: #2a2f38; }
        .adm-place-done {
          padding: 8px; border-radius: 8px; border: none; background: #f5c542; color: #14171c;
          font-weight: 700; cursor: pointer; font-size: 13px;
        }
      `}</style>

      {placeMode && (
        <>
          <div className="adm-place-banner">📍 Cliquez sur la carte pour placer le QG</div>
          <div className="adm-place-controls">
            <div className="adm-place-row">
              <button onClick={() => bumpScale(-0.1)} aria-label="Réduire">−</button>
              <span className="lbl">Taille</span>
              <span className="val">×{cfg.hqScale.toFixed(2)}</span>
              <button onClick={() => bumpScale(0.1)} aria-label="Agrandir">+</button>
            </div>
            <div className="adm-place-row">
              <button onClick={() => bumpRot(-15)} aria-label="Rotation gauche">↺</button>
              <span className="lbl">Rotation</span>
              <span className="val">{cfg.hqRotation.toFixed(0)}°</span>
              <button onClick={() => bumpRot(15)} aria-label="Rotation droite">↻</button>
            </div>
            <button className="adm-place-done" onClick={() => setPlaceMode(false)}>✓ Terminé</button>
          </div>
        </>
      )}

      {drawMode && (
        <>
          <div className="adm-place-banner" style={{ background: "#22c55e", color: "#0a1f10" }}>
            ✏️ Clique sur la carte pour ajouter des points ({cfg.circuitPoints.length})
          </div>
          <div className="adm-place-controls">
            <div className="adm-place-row">
              <button onClick={undoPoint} aria-label="Annuler dernier point" disabled={cfg.circuitPoints.length === 0}>↶</button>
              <span className="lbl">Points</span>
              <span className="val">{cfg.circuitPoints.length}</span>
              <button onClick={clearCircuit} aria-label="Effacer tout">🗑</button>
            </div>
            <button className="adm-place-done" onClick={finishDraw}>✓ Terminer le circuit</button>
          </div>
        </>
      )}

      {!open && (
        <button className="adm-btn" onClick={() => setOpen(true)} aria-label="Panneau admin" title="Panneau admin">⚙</button>
      )}


      {open && !unlocked && (
        <>
          <div className="adm-overlay" onClick={() => setOpen(false)} />
          <div className="adm-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="adm-h">
              <h2>🔒 Accès admin</h2>
              <button className="adm-close" onClick={() => { setOpen(false); setPwd(""); setPwdErr(""); }} aria-label="Fermer">×</button>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>Entre le mot de passe pour accéder au panneau.</p>
              <input
                type="password"
                autoFocus
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void tryUnlock(); }}
                placeholder="Mot de passe"
                style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 14 }}
              />
              {pwdErr && <div style={{ color: "#ff6b6b", fontSize: 13 }}>{pwdErr}</div>}
              <button
                onClick={() => void tryUnlock()}
                style={{ padding: "10px 12px", borderRadius: 8, border: "none", background: "#facc15", color: "#111", fontWeight: 700, cursor: "pointer" }}
              >Déverrouiller</button>
            </div>
          </div>
        </>
      )}

      {open && unlocked && (

        <>
          <div className="adm-overlay" onClick={() => setOpen(false)} />
          <div className="adm-panel" onClick={(e) => e.stopPropagation()}>
            <div className="adm-h">
              <h2>⚙ PANEL ADMIN</h2>
              <button className="adm-close" onClick={() => setOpen(false)} aria-label="Fermer">×</button>
            </div>

            <div className="adm-tabs">
              <button className={`adm-tab ${tab === "trafic" ? "active" : ""}`} onClick={() => setTab("trafic")}>Trafic</button>
              <button className={`adm-tab ${tab === "hq" ? "active" : ""}`} onClick={() => setTab("hq")}>QG</button>
              <button className={`adm-tab ${tab === "missions" ? "active" : ""}`} onClick={() => setTab("missions")}>Miss.</button>
              <button className={`adm-tab ${tab === "rival" ? "active" : ""}`} onClick={() => setTab("rival")}>Rival</button>
              <button className={`adm-tab ${tab === "circuit" ? "active" : ""}`} onClick={() => setTab("circuit")}>Circuit</button>
             <button className={`adm-tab ${tab === "skins" ? "active" : ""}`} onClick={() => setTab("skins")}>Skins</button>
             <button className={`adm-tab ${tab === "export" ? "active" : ""}`} onClick={() => setTab("export")}>Export</button>
            </div>

            {tab === "trafic" && (
              <>
                <Slider label="Taxis actifs max" hint="Limite combien de taxis sortent en même temps"
                  value={cfg.maxActiveTaxis} min={1} max={20} step={1}
                  format={(v) => v.toFixed(0)} onChange={(v) => setAdmin({ maxActiveTaxis: v })} />
                <Slider label="Cooldown sortie QG" hint="Délai minimum entre deux sorties de taxi"
                  value={cfg.taxiSpawnCooldown} min={0} max={15} step={0.5}
                  format={(v) => v.toFixed(1) + " s"} onChange={(v) => setAdmin({ taxiSpawnCooldown: v })} />
                <Slider label="Vitesse des taxis"
                  value={cfg.taxiSpeedMult} min={0.5} max={3} step={0.05}
                  format={(v) => "×" + v.toFixed(2)} onChange={(v) => setAdmin({ taxiSpeedMult: v })} />
                <Slider label="Nombre de véhicules civils" hint="Voitures, vans et camions sur les routes"
                  value={cfg.civilVehicleCount} min={0} max={24} step={1}
                  format={(v) => v.toFixed(0)} onChange={(v) => setAdmin({ civilVehicleCount: v })} />
                <Slider label="🚓 Voitures de police" hint="0 = aucune patrouille, 6 = ville sous surveillance"
                  value={cfg.policeCarCount} min={0} max={6} step={1}
                  format={(v) => v.toFixed(0)} onChange={(v) => setAdmin({ policeCarCount: v })} />
              </>
            )}

            {tab === "hq" && (
              <>
                <button className={`adm-place ${placeMode ? "active" : ""}`} onClick={startPlacement}>
                  📍 Placer le QG sur la carte
                </button>
                <div className="adm-hint" style={{ marginTop: 4 }}>
                  Le panneau se ferme, cliquez où vous voulez placer le QG.
                </div>

                <Slider label="QG — X" value={cfg.hqX} min={0} max={1920} step={1}
                  format={(v) => v.toFixed(0)} onChange={(v) => setAdmin({ hqUseFreePos: true, hqX: v })} />
                <Slider label="QG — Y" value={cfg.hqY} min={0} max={1080} step={1}
                  format={(v) => v.toFixed(0)} onChange={(v) => setAdmin({ hqUseFreePos: true, hqY: v })} />

                <Slider label="Taille du QG"
                  value={cfg.hqScale} min={0.3} max={8} step={0.05}
                  format={(v) => "×" + v.toFixed(2)} onChange={(v) => setAdmin({ hqScale: v })} />

                <Slider label="Rotation"
                  value={cfg.hqRotation} min={-180} max={180} step={5}
                  format={(v) => v.toFixed(0) + "°"} onChange={(v) => setAdmin({ hqRotation: v })} />
              </>
            )}

            {tab === "missions" && (
              <>
                <Slider label="Délai nouvelle course" hint="Plus court = courses qui arrivent plus vite"
                  value={cfg.spawnRateMult} min={0.25} max={3} step={0.05}
                  format={(v) => "×" + v.toFixed(2)} onChange={(v) => setAdmin({ spawnRateMult: v })} />
                <Slider label="Courses en file (bonus)"
                  value={cfg.maxClientsBonus} min={0} max={6} step={1}
                  format={(v) => "+" + v.toFixed(0)} onChange={(v) => setAdmin({ maxClientsBonus: v })} />
                <Slider label="Multiplicateur de tarif"
                  value={cfg.clientFareMult} min={0.5} max={5} step={0.1}
                  format={(v) => "×" + v.toFixed(1)} onChange={(v) => setAdmin({ clientFareMult: v })} />
                <Slider label="Conso carburant" hint="Points de jauge perdus par seconde de roulage"
                  value={cfg.fuelConsumption} min={0.1} max={3} step={0.1}
                  format={(v) => v.toFixed(1) + "/s"} onChange={(v) => setAdmin({ fuelConsumption: v })} />
                <Slider label="Station — X" value={cfg.gasStationX} min={0} max={1920} step={1}
                  format={(v) => v.toFixed(0)} onChange={(v) => setAdmin({ gasStationX: v })} />
                <Slider label="Station — Y" value={cfg.gasStationY} min={0} max={1080} step={1}
                  format={(v) => v.toFixed(0)} onChange={(v) => setAdmin({ gasStationY: v })} />
              </>
            )}

            {tab === "rival" && (
              <>
                <label className="adm-toggle" style={{ marginBottom: 10 }}>
                  <input type="checkbox" checked={cfg.rivalEnabled}
                    onChange={(e) => setAdmin({ rivalEnabled: e.target.checked })} />
                  Activer l'entreprise concurrente (IA)
                </label>
                <Slider label="Taxis IA" value={cfg.rivalTaxiCount} min={1} max={6} step={1}
                  format={(v) => v.toFixed(0)} onChange={(v) => setAdmin({ rivalTaxiCount: v })} />
                <Slider label="Temps de réaction" hint="Délai avant que l'IA ne vole une course"
                  value={cfg.rivalReactionTime} min={1} max={15} step={0.5}
                  format={(v) => v.toFixed(1) + " s"} onChange={(v) => setAdmin({ rivalReactionTime: v })} />
                <Slider label="Vitesse IA" value={cfg.rivalSpeedMult} min={0.5} max={2.5} step={0.05}
                  format={(v) => "×" + v.toFixed(2)} onChange={(v) => setAdmin({ rivalSpeedMult: v })} />
                <Slider label="QG Rival — X" value={cfg.rivalHQX} min={0} max={1920} step={1}
                  format={(v) => v.toFixed(0)} onChange={(v) => setAdmin({ rivalHQX: v })} />
                <Slider label="QG Rival — Y" value={cfg.rivalHQY} min={0} max={1080} step={1}
                  format={(v) => v.toFixed(0)} onChange={(v) => setAdmin({ rivalHQY: v })} />
              </>
            )}
            {tab === "circuit" && (
              <>
                <button className="adm-place" onClick={startDraw}>
                  📍 Dessiner un circuit (point par point)
                </button>
                <div className="adm-hint" style={{ marginTop: 4 }}>
                  Le panneau se ferme. Clique sur la carte pour placer chaque virage, puis "Terminer".
                </div>
                <button className="adm-place" onClick={clearCircuit} style={{ marginTop: 8 }}>
                  🗑 Effacer le circuit
                </button>
                <div className="adm-hint" style={{ marginTop: 4 }}>
                  Points actuels : {cfg.circuitPoints.length}
                </div>

                <Slider label="Taxis sur le circuit" hint="Taxis dédiés qui tournent en boucle"
                  value={cfg.circuitTaxiCount} min={0} max={8} step={1}
                  format={(v) => v.toFixed(0)} onChange={(v) => setAdmin({ circuitTaxiCount: v })} />
                <Slider label="Vitesse circuit"
                  value={cfg.circuitSpeedMult} min={0.3} max={3} step={0.05}
                  format={(v) => "×" + v.toFixed(2)} onChange={(v) => setAdmin({ circuitSpeedMult: v })} />
              </>
            )}

            {tab === "skins" && <SkinsTab />}
            {tab === "export" && <ExportTab />}


            <button className="adm-reset" onClick={resetAdmin}>↺ Réinitialiser les valeurs</button>
          </div>
        </>
      )}
    </>
  );
}

function Slider({
  label, hint, value, min, max, step, format, onChange,
}: {
  label: string; hint?: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div className="adm-section">
      <div className="adm-label">
        <span>{label}</span>
        <span className="adm-val">{format(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <div className="adm-hint">{hint}</div>}
    </div>
  );
}

export type { AdminConfig };

function ExportTab() {
  const { local, remote, hasUpdate, loading, refresh } = useVersionCheck();
  const rowStyle = { display: "flex", justifyContent: "space-between", fontSize: 11, color: "#c8ccd2", padding: "4px 0" } as const;
  const valStyle = { color: "#f5c542", fontVariantNumeric: "tabular-nums" as const, fontWeight: 600 };
  return (
    <>
      <div style={{ fontSize: 12, color: "#c8ccd2", lineHeight: 1.5, marginBottom: 10 }}>
        📦 <strong style={{ color: "#f5c542" }}>Export du projet pour Android Studio</strong>
      </div>
      <div style={{ fontSize: 11, color: "#8a8e94", lineHeight: 1.6, marginBottom: 12 }}>
        Pour récupérer le ZIP à jour, écris simplement à Lovable :
        <div style={{ background: "#1f242b", padding: "8px 10px", borderRadius: 6, marginTop: 8, color: "#f5c542", fontFamily: "monospace", fontSize: 12 }}>
          fais-moi le zip
        </div>
      </div>

      <div style={{ background: "#1f242b", padding: "10px 12px", borderRadius: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#f5c542", marginBottom: 6, letterSpacing: 0.3 }}>
          📡 ÉTAT DE LA VERSION
        </div>
        <div style={rowStyle}>
          <span>Version installée</span>
          <span style={valStyle}>{formatBuildDate(local)}</span>
        </div>
        <div style={rowStyle}>
          <span>Dernière version en ligne</span>
          <span style={valStyle}>{loading ? "…" : formatBuildDate(remote)}</span>
        </div>
        <div style={{ ...rowStyle, borderTop: "1px solid #2a2f38", marginTop: 4, paddingTop: 6 }}>
          <span>Statut</span>
          <span style={{ ...valStyle, color: hasUpdate ? "#22c55e" : remote ? "#8a8e94" : "#ef4444" }}>
            {loading ? "Vérification…" : hasUpdate ? "🆕 Maj dispo" : remote ? "À jour" : "Hors ligne"}
          </span>
        </div>
        <button
          onClick={refresh}
          style={{
            width: "100%", marginTop: 8, padding: "6px 10px", borderRadius: 6,
            border: "1px solid #3a3f48", background: "#14171c", color: "#e8edf2",
            fontSize: 11, cursor: "pointer",
          }}
        >
          ↻ Vérifier maintenant
        </button>
      </div>

      <div style={{ fontSize: 11, color: "#6a6e74", padding: "8px 10px", background: "#1f242b", borderRadius: 6, marginBottom: 10 }}>
        💡 Une bannière apparaîtra automatiquement dans le jeu dès qu'une nouvelle version sera publiée sur Lovable.
      </div>

      <div style={{ background: "#1f242b", padding: "10px 12px", borderRadius: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#f5c542", marginBottom: 6, letterSpacing: 0.3 }}>
          📱 ROTATION ÉCRAN (Android)
        </div>
        <div style={{ fontSize: 11, color: "#c8ccd2", lineHeight: 1.5, marginBottom: 6 }}>
          Pour autoriser la rotation portrait ↔ paysage dans l'APK, ouvre dans Android Studio :
        </div>
        <div style={{ background: "#0a0c10", padding: "6px 8px", borderRadius: 4, color: "#f5c542", fontFamily: "monospace", fontSize: 10, marginBottom: 6 }}>
          android/app/src/main/AndroidManifest.xml
        </div>
        <div style={{ fontSize: 11, color: "#c8ccd2", lineHeight: 1.5, marginBottom: 6 }}>
          et dans la balise <code style={{ color: "#f5c542" }}>&lt;activity&gt;</code> de <code style={{ color: "#f5c542" }}>MainActivity</code>, remplace l'attribut par :
        </div>
        <div style={{ background: "#0a0c10", padding: "6px 8px", borderRadius: 4, color: "#22c55e", fontFamily: "monospace", fontSize: 10 }}>
          android:screenOrientation="fullSensor"
        </div>
      </div>
    </>
  );
}

// ---------- Onglet Skins : remplacer un véhicule sans toucher au code ----------
const SKIN_LABELS: Record<AssetKey, string> = {
  "taxi.yellow": "Taxi jaune",
  "taxi.black": "Taxi noir",
  "taxi.red": "Taxi rouge",
  "police.car": "Voiture police",
  "civil.car.1": "Civile #1 (bleue)",
  "civil.car.2": "Civile #2 (violette)",
  "civil.car.3": "Civile #3 (orange)",
  "civil.car.4": "Civile #4 (verte)",
  "pedestrian.man": "Piéton homme",
  "pedestrian.woman": "Piéton femme",
  "audio.music": "Musique",
};

function SkinsTab() {
  const [, force] = useState(0);
  const reload = () => { window.location.reload(); };
  const onFile = (key: AssetKey, f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setAssetOverride(key, String(reader.result));
      force(v => v + 1);
    };
    reader.readAsDataURL(f);
  };
  const onUrl = (key: AssetKey) => {
    const url = window.prompt(`URL du skin pour ${SKIN_LABELS[key]} :`, GAME_ASSETS[key]);
    if (url == null) return;
    setAssetOverride(key, url.trim() || null);
    force(v => v + 1);
  };
  const onReset = (key: AssetKey) => {
    setAssetOverride(key, null);
    force(v => v + 1);
  };
  return (
    <>
      <div style={{ fontSize: 12, color: "#c8ccd2", lineHeight: 1.5, marginBottom: 8 }}>
        🎨 <strong style={{ color: "#f5c542" }}>Skins remplaçables</strong>
      </div>
      <div style={{ fontSize: 11, color: "#8a8e94", lineHeight: 1.5, marginBottom: 10 }}>
        Remplace un visuel à chaud (sans rebuild). Recharge pour appliquer.
        Pour un remplacement permanent : édite <code style={{ color: "#f5c542" }}>src/game/gameAssets.ts</code>.
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {listAssetKeys().filter(k => k !== "audio.music").map((key) => {
          const url = GAME_ASSETS[key];
          return (
            <div key={key} style={{ background: "#1f242b", padding: 8, borderRadius: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <img src={url} alt="" style={{ width: 36, height: 36, objectFit: "contain", background: "#0a0c10", borderRadius: 4, flex: "0 0 auto" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "#e8edf2", fontWeight: 600 }}>{SKIN_LABELS[key]}</div>
                <div style={{ fontSize: 9, color: "#6a6e74", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url.slice(0, 60)}</div>
              </div>
              <label style={{ fontSize: 10, padding: "4px 6px", background: "#14171c", border: "1px solid #3a3f48", borderRadius: 4, cursor: "pointer", color: "#e8edf2" }}>
                📁
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(key, f); }}
                />
              </label>
              <button onClick={() => onUrl(key)} style={btnMini}>🔗</button>
              <button onClick={() => onReset(key)} style={btnMini} title="Réinitialiser">↺</button>
            </div>
          );
        })}
      </div>
      <button
        onClick={reload}
        style={{
          width: "100%", marginTop: 10, padding: "8px 10px", borderRadius: 6,
          border: "1px solid #f5c542", background: "#f5c542", color: "#14171c",
          fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}
      >
        ↻ Recharger pour appliquer
      </button>
    </>
  );
}

const btnMini: CSSProperties = {
  fontSize: 10, padding: "4px 6px", background: "#14171c",
  border: "1px solid #3a3f48", borderRadius: 4, cursor: "pointer", color: "#e8edf2",
};
