import { useState } from "react";
import { useAdminConfig, setAdmin, resetAdmin, type AdminConfig } from "./adminConfig";

/* Floating gear button + slide-in admin panel. */
export default function AdminPanel() {
  const [open, setOpen] = useState(false);
  const cfg = useAdminConfig();

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
          position: absolute; top: 0; right: 0; bottom: 0; width: min(360px, 92vw);
          z-index: 50; background: #14171c; color: #e8edf2;
          box-shadow: -8px 0 32px rgba(0,0,0,0.6);
          padding: 18px 18px 24px; overflow-y: auto;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .adm-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .adm-h h2 { margin: 0; font-size: 16px; color: #f5c542; letter-spacing: 0.5px; }
        .adm-close {
          background: transparent; border: none; color: #8a8e94;
          font-size: 24px; cursor: pointer; line-height: 1;
        }
        .adm-section { margin-bottom: 14px; }
        .adm-label { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; color: #c8ccd2; }
        .adm-val { color: #f5c542; font-weight: 600; font-variant-numeric: tabular-nums; }
        .adm-section input[type="range"] { width: 100%; }
        .adm-reset {
          width: 100%; padding: 10px; border: 1px solid #3a3f48; border-radius: 6px;
          background: #1f242b; color: #e8edf2; cursor: pointer; margin-top: 10px;
          font-size: 13px;
        }
        .adm-reset:hover { background: #2a2f38; }
        .adm-hint { font-size: 11px; color: #6a6e74; margin-top: 2px; }
      `}</style>

      {!open && (
        <button className="adm-btn" onClick={() => setOpen(true)} aria-label="Panneau admin" title="Panneau admin">⚙</button>
      )}

      {open && (
        <>
          <div className="adm-overlay" onClick={() => setOpen(false)} />
          <div className="adm-panel">
            <div className="adm-h">
              <h2>⚙ PANEL ADMIN</h2>
              <button className="adm-close" onClick={() => setOpen(false)} aria-label="Fermer">×</button>
            </div>

            <Slider
              label="Position du QG sur le circuit"
              hint="0 = début du path, 1 = fin"
              value={cfg.depotPosNorm} min={0} max={1} step={0.01}
              format={(v) => (v * 100).toFixed(0) + "%"}
              onChange={(v) => setAdmin({ depotPosNorm: v })}
            />

            <Slider
              label="Nombre de véhicules civils"
              hint="Voitures, vans et camions sur les routes"
              value={cfg.civilVehicleCount} min={0} max={24} step={1}
              format={(v) => v.toFixed(0)}
              onChange={(v) => setAdmin({ civilVehicleCount: v })}
            />

            <Slider
              label="Vitesse des taxis"
              value={cfg.taxiSpeedMult} min={0.5} max={3} step={0.05}
              format={(v) => "×" + v.toFixed(2)}
              onChange={(v) => setAdmin({ taxiSpeedMult: v })}
            />

            <Slider
              label="Fréquence des clients"
              hint="< 1 = clients plus rapides ; > 1 = plus lents"
              value={cfg.spawnRateMult} min={0.25} max={3} step={0.05}
              format={(v) => "×" + v.toFixed(2)}
              onChange={(v) => setAdmin({ spawnRateMult: v })}
            />

            <Slider
              label="Bonus clients simultanés"
              value={cfg.maxClientsBonus} min={0} max={10} step={1}
              format={(v) => "+" + v.toFixed(0)}
              onChange={(v) => setAdmin({ maxClientsBonus: v })}
            />

            <Slider
              label="Multiplicateur de tarif"
              value={cfg.clientFareMult} min={0.5} max={5} step={0.1}
              format={(v) => "×" + v.toFixed(1)}
              onChange={(v) => setAdmin({ clientFareMult: v })}
            />

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
