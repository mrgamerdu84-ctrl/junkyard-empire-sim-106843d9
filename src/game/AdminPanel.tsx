import { useEffect, useRef, useState } from "react";
import { useAdminConfig, setAdmin, resetAdmin, type AdminConfig } from "./adminConfig";

/* Floating gear button + slide-in admin panel. */
export default function AdminPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"trafic" | "hq" | "missions" | "rival" | "circuit">("trafic");
  const [placeMode, setPlaceMode] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const cfg = useAdminConfig();

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
          position: absolute; top: 14px; right: 14px; z-index: 50;
          width: 44px; height: 44px; border-radius: 50%; border: none;
          background: rgba(20,22,28,0.85); color: #f5c542; font-size: 22px;
          cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(8px);
        }
        .adm-btn:hover { background: rgba(40,42,50,0.95); }
        .adm-overlay {
          position: absolute; inset: 0; z-index: 49;
          background: rgba(0,0,0,0.5);
        }
        .adm-panel {
          position: absolute; top: 0; right: 0; bottom: 0; width: min(380px, 92vw);
          z-index: 50; background: #14171c; color: #e8edf2;
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

      {open && (
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
                  value={cfg.civilVehicleCount} min={0} max={35} step={1}
                  format={(v) => v.toFixed(0)} onChange={(v) => setAdmin({ civilVehicleCount: v })} />
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
