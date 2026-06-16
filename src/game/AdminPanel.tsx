import { useEffect, useState } from "react";
import { useAdminConfig, setAdmin, resetAdmin, type AdminConfig } from "./adminConfig";

/* Floating gear button + slide-in admin panel. */
export default function AdminPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"trafic" | "hq" | "missions">("trafic");
  const [placeMode, setPlaceMode] = useState(false);
  const cfg = useAdminConfig();

  // Mode "placer le QG" — clic sur la map = nouvelle position.
  // On ferme le panneau pendant le placement pour que le clic atteigne la map,
  // et on convertit n'importe quel clic en coordonnées SVG (le SVG du jeu a
  // pointer-events:none, donc on ne peut pas se fier à svg.contains(target)).
  useEffect(() => {
    if (!placeMode) return;
    const onClick = (e: MouseEvent) => {
      const svg = document.querySelector(".tt-root svg") as SVGSVGElement | null;
      if (!svg) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const p = pt.matrixTransform(ctm.inverse());
      // Bornes du viewBox 1920×1080
      const x = Math.max(0, Math.min(1920, p.x));
      const y = Math.max(0, Math.min(1080, p.y));
      setAdmin({ hqUseFreePos: true, hqX: x, hqY: y });
      setPlaceMode(false);
      e.stopPropagation();
      e.preventDefault();
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [placeMode]);

  // Quand on lance le placement, on ferme le panneau pour libérer la map.
  const startPlacement = () => {
    setPlaceMode(true);
    setOpen(false);
  };


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
      `}</style>

      {placeMode && <div className="adm-place-banner">📍 Cliquez sur la carte pour placer le QG</div>}

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
              <button className={`adm-tab ${tab === "missions" ? "active" : ""}`} onClick={() => setTab("missions")}>Missions</button>
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
              </>
            )}

            {tab === "hq" && (
              <>
                <div className="adm-section">
                  <label className="adm-toggle">
                    <input type="checkbox" checked={cfg.hqUseFreePos}
                      onChange={(e) => setAdmin({ hqUseFreePos: e.target.checked })} />
                    Position libre (X/Y) — sinon suit le circuit
                  </label>
                </div>

                <button className={`adm-place ${placeMode ? "active" : ""}`} onClick={() => setPlaceMode((v) => !v)}>
                  {placeMode ? "Annuler — cliquez ailleurs" : "📍 Placer le QG sur la carte"}
                </button>

                {!cfg.hqUseFreePos && (
                  <Slider label="Position sur le circuit" hint="0 = début, 1 = fin du path"
                    value={cfg.depotPosNorm} min={0} max={1} step={0.01}
                    format={(v) => (v * 100).toFixed(0) + "%"} onChange={(v) => setAdmin({ depotPosNorm: v })} />
                )}

                {cfg.hqUseFreePos && (
                  <>
                    <Slider label="QG — X" value={cfg.hqX} min={0} max={1920} step={1}
                      format={(v) => v.toFixed(0)} onChange={(v) => setAdmin({ hqX: v })} />
                    <Slider label="QG — Y" value={cfg.hqY} min={0} max={1080} step={1}
                      format={(v) => v.toFixed(0)} onChange={(v) => setAdmin({ hqY: v })} />
                  </>
                )}

                <Slider label="Taille du QG"
                  value={cfg.hqScale} min={0.5} max={3} step={0.05}
                  format={(v) => "×" + v.toFixed(2)} onChange={(v) => setAdmin({ hqScale: v })} />

                <Slider label="Rotation"
                  value={cfg.hqRotation} min={-180} max={180} step={5}
                  format={(v) => v.toFixed(0) + "°"} onChange={(v) => setAdmin({ hqRotation: v })} />
              </>
            )}

            {tab === "missions" && (
              <>
                <Slider label="Fréquence des clients" hint="< 1 = clients plus rapides ; > 1 = plus lents"
                  value={cfg.spawnRateMult} min={0.25} max={3} step={0.05}
                  format={(v) => "×" + v.toFixed(2)} onChange={(v) => setAdmin({ spawnRateMult: v })} />
                <Slider label="Bonus clients simultanés"
                  value={cfg.maxClientsBonus} min={0} max={10} step={1}
                  format={(v) => "+" + v.toFixed(0)} onChange={(v) => setAdmin({ maxClientsBonus: v })} />
                <Slider label="Multiplicateur de tarif"
                  value={cfg.clientFareMult} min={0.5} max={5} step={0.1}
                  format={(v) => "×" + v.toFixed(1)} onChange={(v) => setAdmin({ clientFareMult: v })} />
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
