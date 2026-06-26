// =============================================================
// Atelier de réparation et personnalisation (My Taxi World Rivalité)
// =============================================================
// Vue immersive 2.5D (SVG isométrique) du garage du joueur.
// - Liste latérale des taxis (lue depuis companyV2).
// - Taxi sélectionné posé sur un pont élévateur, mécano animé autour.
// - Actions : réparer, pneus, moteur, blindage, peinture, sticker.
// - Pendant une opération : barre de progression + mécano en mode adapté.
// - Argent débité via cashDelta (companyV2 le fait déjà), upgrades émettent
//   `mtw:fleet-upgraded` pour propagation à la carte.
// =============================================================
import { useEffect, useMemo, useState } from "react";
import {
  applyPaint,
  applyRepair,
  applySticker,
  applyUpgrade,
  getCompany,
  getFleetPrestige,
  subscribe,
  type Taxi,
} from "./companyV2";
import {
  PAINT_PALETTE,
  UPGRADE_CATALOG,
  defFor,
  type UpgradeKind,
} from "./garage/garageUpgrades";
import MechanicSprite from "./garage/MechanicSprite";
import { getMaintenanceDiscount } from "./personnel";

type Props = { onClose: () => void };

type Working = {
  kind: UpgradeKind;
  endsAt: number;
  mode: "wrench" | "paint" | "tires" | "weld";
};

function modeFor(k: UpgradeKind): Working["mode"] {
  if (k === "paint") return "paint";
  if (k === "sticker") return "paint";
  if (k.startsWith("tires")) return "tires";
  if (k.startsWith("armor")) return "weld";
  return "wrench";
}

export default function GaragePanel({ onClose }: Props) {
  const [, force] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [working, setWorking] = useState<Working | null>(null);
  const [progress, setProgress] = useState(0);
  const [pendingPaint, setPendingPaint] = useState<{ color: string; accent: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => subscribe(() => force(n => n + 1)), []);

  const fleet = getCompany().fleet;
  const selected: Taxi | null = useMemo(
    () => fleet.find(t => t.id === selectedId) || fleet[0] || null,
    [fleet, selectedId],
  );

  // animation de la barre de progression
  useEffect(() => {
    if (!working) { setProgress(0); return; }
    const dur = working.endsAt - Date.now();
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / dur);
      setProgress(p);
      if (p >= 1) {
        clearInterval(id);
        finishWorking();
      }
    }, 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [working?.endsAt]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  function finishWorking() {
    if (!working || !selected) { setWorking(null); return; }
    const k = working.kind;
    const cat = working.kind;
    let r: { ok: boolean; msg?: string; cost?: number } = { ok: false };
    if (k === "repair") {
      r = applyRepair(selected.id, getMaintenanceDiscount());
    } else if (k === "tires1" || k === "tires2") {
      const def = defFor(k);
      r = applyUpgrade(selected.id, "tires", k === "tires2" ? 2 : 1, def.cost);
    } else if (k === "engine1" || k === "engine2") {
      const def = defFor(k);
      r = applyUpgrade(selected.id, "engine", k === "engine2" ? 2 : 1, def.cost);
    } else if (k === "armor1" || k === "armor2") {
      const def = defFor(k);
      r = applyUpgrade(selected.id, "armor", k === "armor2" ? 2 : 1, def.cost);
    } else if (k === "paint") {
      const p = pendingPaint;
      if (p) applyPaint(selected.id, p.color, p.accent, defFor("paint").cost);
      r = { ok: true };
    } else if (k === "sticker") {
      applySticker(selected.id, defFor("sticker").cost);
      r = { ok: true };
    }
    if (r.ok) showToast(`✅ ${defFor(k).label} terminé`);
    else if (r.msg) showToast(`⚠ ${r.msg}`);
    setWorking(null);
    setPendingPaint(null);
    // bruit d'attente pour que le state companyV2 se propage
    setTimeout(() => force(n => n + 1), 50);
    void cat;
  }

  function startWork(kind: UpgradeKind) {
    if (!selected || working) return;
    const def = defFor(kind);
    setWorking({ kind, endsAt: Date.now() + def.durationMs, mode: modeFor(kind) });
  }

  const prestige = getFleetPrestige();

  return (
    <div className="garage-overlay" role="dialog" aria-label="Atelier">
      <style>{CSS}</style>

      <header className="garage-top">
        <button className="garage-back" onClick={onClose}>← Retour à la ville</button>
        <div className="garage-title">🏭 ATELIER — My Taxi World Rivalité</div>
        <div className="garage-prestige" title="Qualité moyenne de la flotte">
          🏆 Prestige flotte&nbsp;
          <b>{Math.round(prestige * 100)}%</b>
        </div>
      </header>

      <div className="garage-body">
        {/* === Liste flotte === */}
        <aside className="garage-fleet">
          <div className="garage-section-title">🚖 Ma flotte ({fleet.length})</div>
          {fleet.length === 0 && (
            <div className="garage-empty">Aucun taxi. Achète-en un dans Compagnie 🏢.</div>
          )}
          {fleet.map(t => {
            const broken = t.condition <= 0 || t.status === "broken";
            const damaged = t.condition < 100;
            return (
              <button
                key={t.id}
                className={`garage-taxi-row ${selected?.id === t.id ? "is-active" : ""}`}
                onClick={() => setSelectedId(t.id)}
              >
                <span className="garage-taxi-swatch" style={{ background: t.paint.color, borderColor: t.paint.accent }} />
                <span className="garage-taxi-name">
                  {t.livery}
                  {broken && <em className="badge danger"> HORS-SERVICE</em>}
                  {!broken && damaged && <em className="badge warn"> {Math.round(t.condition)}%</em>}
                </span>
                <span className="garage-taxi-chips">
                  {t.upgrades.tires > 0 && <i>🛞{t.upgrades.tires}</i>}
                  {t.upgrades.engine > 0 && <i>⚙️{t.upgrades.engine}</i>}
                  {t.upgrades.armor > 0 && <i>🛡️{t.upgrades.armor}</i>}
                  {t.upgrades.sticker === "roof" && <i>✨</i>}
                </span>
              </button>
            );
          })}
        </aside>

        {/* === Scène atelier === */}
        <section className="garage-stage">
          <svg viewBox="0 0 400 320" className="garage-scene" preserveAspectRatio="xMidYMid meet">
            {/* sol béton */}
            <defs>
              <pattern id="floor" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <rect width="40" height="40" fill="#3a3f48" />
                <path d="M0 0H40M0 40H40M0 0V40M40 0V40" stroke="#2a2f37" strokeWidth="1" />
              </pattern>
              <linearGradient id="wall" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#566273" />
                <stop offset="1" stopColor="#2d3540" />
              </linearGradient>
            </defs>
            {/* mur fond */}
            <rect x="0" y="0" width="400" height="90" fill="url(#wall)" />
            {/* baies vitrées */}
            <rect x="20"  y="14" width="80" height="50" fill="#7dd3fc" opacity="0.55" stroke="#0b0d10" strokeWidth="2" />
            <rect x="120" y="14" width="80" height="50" fill="#7dd3fc" opacity="0.55" stroke="#0b0d10" strokeWidth="2" />
            <rect x="220" y="14" width="80" height="50" fill="#7dd3fc" opacity="0.55" stroke="#0b0d10" strokeWidth="2" />
            <rect x="320" y="14" width="60" height="50" fill="#7dd3fc" opacity="0.55" stroke="#0b0d10" strokeWidth="2" />
            {/* panneau d'outils */}
            <g transform="translate(310,72)">
              <rect width="80" height="14" fill="#1a1d22" rx="2" />
              <text x="4" y="11" fontSize="9" fill="#fde047" fontWeight="700">OUTILS</text>
              <g transform="translate(46,3)" fontSize="9">
                <text x="0"  y="9">🔧</text>
                <text x="11" y="9">🛞</text>
                <text x="22" y="9">🎨</text>
              </g>
            </g>
            {/* sol */}
            <rect x="0" y="90" width="400" height="230" fill="url(#floor)" />
            {/* pont élévateur */}
            <ellipse cx="200" cy="240" rx="120" ry="14" fill="#0b0d10" opacity="0.5" />
            <rect x="90"  y="210" width="220" height="14" rx="2" fill="#facc15" stroke="#0b0d10" strokeWidth="1.5" />
            <rect x="100" y="224" width="200" height="6" fill="#a16207" />
            <rect x="195" y="230" width="10" height="50" fill="#1a1d22" />

            {/* Le taxi */}
            {selected && (
              <g transform="translate(200,180)">
                <ellipse cx="0" cy="22" rx="60" ry="8" fill="rgba(0,0,0,0.4)" />
                {/* carrosserie */}
                <rect x="-58" y="-22" width="116" height="44" rx="10" fill={selected.paint.accent} />
                <rect x="-54" y="-18" width="108" height="36" rx="8" fill={selected.paint.color} />
                {/* pare-brise */}
                <path d="M -20 -16 L 30 -14 L 30 14 L -20 16 Z" fill="#0b1626" opacity="0.92" />
                <path d="M -50 -14 L -22 -12 L -22 12 L -50 14 Z" fill="#0b1626" opacity="0.7" />
                {/* portière */}
                <rect x="-22" y="-16" width="14" height="32" rx="1.5" fill={selected.paint.color} stroke="rgba(0,0,0,0.4)" />
                {/* signe TAXI */}
                <rect x="-6" y="-26" width="12" height="5" rx="1" fill="#fde047" stroke="#0b0d10" strokeWidth="0.6" />
                <text x="0" y="-22" fontSize="3.6" fontWeight="900" fill="#0b0d10" textAnchor="middle">TAXI</text>
                {/* rampe lumineuse */}
                {selected.upgrades.sticker === "roof" && (
                  <rect x="-18" y="-28" width="36" height="3.5" rx="1.5" fill="#fde047" stroke="#0b0d10" strokeWidth="0.5">
                    <animate attributeName="opacity" values="1;0.4;1" dur="1s" repeatCount="indefinite" />
                  </rect>
                )}
                {/* roues (épaisseur selon pneus) */}
                {[ -38, 38 ].map((x, i) => {
                  const r = 8 + selected.upgrades.tires * 1.5;
                  return <circle key={i} cx={x} cy={20} r={r} fill="#0b0d10" stroke="#444" strokeWidth="1.5" />;
                })}
                {/* plaque de blindage */}
                {selected.upgrades.armor >= 1 && (
                  <rect x="-56" y="-4" width="112" height="6" fill="#52525b" stroke="#0b0d10" strokeWidth="0.6" opacity="0.85" />
                )}
                {selected.upgrades.armor >= 2 && (
                  <rect x="-56" y="10" width="112" height="6" fill="#71717a" stroke="#0b0d10" strokeWidth="0.6" opacity="0.85" />
                )}
                {/* PV bar */}
                <g transform="translate(-30,-38)">
                  <rect width="60" height="5" fill="#1a1d22" rx="1" />
                  <rect width={60 * (selected.condition / 100)} height="5" rx="1"
                    fill={selected.condition < 30 ? "#ef4444" : selected.condition < 70 ? "#f97316" : "#22c55e"} />
                </g>
              </g>
            )}

            {/* Mécano animé */}
            {selected && working && <MechanicSprite mode={working.mode} />}

            {/* étincelles ambiantes au sol */}
            {working && working.mode === "weld" && (
              <g>
                <circle cx="210" cy="220" r="1.5" fill="#fde047">
                  <animate attributeName="opacity" values="0;1;0" dur="0.6s" repeatCount="indefinite" />
                </circle>
                <circle cx="195" cy="225" r="1.2" fill="#f97316">
                  <animate attributeName="opacity" values="0;1;0" dur="0.5s" repeatCount="indefinite" />
                </circle>
              </g>
            )}
          </svg>

          {/* Barre progression */}
          {working && (
            <div className="garage-progress">
              <div className="garage-progress-label">
                {defFor(working.kind).icon} {defFor(working.kind).label} en cours…
              </div>
              <div className="garage-progress-bar">
                <div className="garage-progress-fill" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
          )}

          {toast && <div className="garage-toast">{toast}</div>}
        </section>

        {/* === Catalogue d'actions === */}
        <aside className="garage-actions">
          <div className="garage-section-title">🛠 Actions</div>
          {!selected && <div className="garage-empty">Sélectionne un taxi.</div>}

          {selected && (
            <>
              {/* Réparation */}
              {(() => {
                const def = defFor("repair");
                const missing = Math.max(0, 100 - selected.condition);
                const disc = getMaintenanceDiscount();
                const cost = Math.max(0, Math.round(missing * 50 * (1 - disc)));
                const disabled = !!working || missing === 0;
                return (
                  <button className="garage-action repair" disabled={disabled} onClick={() => startWork("repair")}>
                    <span className="ico">{def.icon}</span>
                    <span className="meta">
                      <b>{def.label}</b>
                      <i>{def.desc}</i>
                    </span>
                    <span className="cost">{missing === 0 ? "OK" : `${cost} $`}</span>
                  </button>
                );
              })()}

              {/* Pneus */}
              {(["tires1", "tires2"] as UpgradeKind[]).map(k => {
                const def = defFor(k);
                const lvl = k === "tires2" ? 2 : 1;
                const installed = selected.upgrades.tires >= lvl;
                return (
                  <button key={k} className="garage-action" disabled={!!working || installed} onClick={() => startWork(k)}>
                    <span className="ico">{def.icon}</span>
                    <span className="meta"><b>{def.label}</b><i>{def.desc}</i></span>
                    <span className="cost">{installed ? "✓" : `${def.cost} $`}</span>
                  </button>
                );
              })}

              {(["engine1", "engine2"] as UpgradeKind[]).map(k => {
                const def = defFor(k);
                const lvl = k === "engine2" ? 2 : 1;
                const installed = selected.upgrades.engine >= lvl;
                return (
                  <button key={k} className="garage-action" disabled={!!working || installed} onClick={() => startWork(k)}>
                    <span className="ico">{def.icon}</span>
                    <span className="meta"><b>{def.label}</b><i>{def.desc}</i></span>
                    <span className="cost">{installed ? "✓" : `${def.cost} $`}</span>
                  </button>
                );
              })}

              {(["armor1", "armor2"] as UpgradeKind[]).map(k => {
                const def = defFor(k);
                const lvl = k === "armor2" ? 2 : 1;
                const installed = selected.upgrades.armor >= lvl;
                return (
                  <button key={k} className="garage-action" disabled={!!working || installed} onClick={() => startWork(k)}>
                    <span className="ico">{def.icon}</span>
                    <span className="meta"><b>{def.label}</b><i>{def.desc}</i></span>
                    <span className="cost">{installed ? "✓" : `${def.cost} $`}</span>
                  </button>
                );
              })}

              {/* Sticker */}
              {(() => {
                const def = defFor("sticker");
                const installed = selected.upgrades.sticker === "roof";
                return (
                  <button className="garage-action" disabled={!!working || installed} onClick={() => startWork("sticker")}>
                    <span className="ico">{def.icon}</span>
                    <span className="meta"><b>{def.label}</b><i>{def.desc}</i></span>
                    <span className="cost">{installed ? "✓" : `${def.cost} $`}</span>
                  </button>
                );
              })()}

              {/* Palette peinture */}
              <div className="garage-paint-wrap">
                <div className="garage-paint-title">🎨 Repeindre — {defFor("paint").cost} $</div>
                <div className="garage-paint-row">
                  {PAINT_PALETTE.map(p => {
                    const active = selected.paint.color === p.color;
                    return (
                      <button
                        key={p.color}
                        className={`garage-paint-swatch ${active ? "is-active" : ""}`}
                        style={{ background: p.color, borderColor: p.accent }}
                        title={p.name}
                        disabled={!!working || active}
                        onClick={() => { setPendingPaint(p); startWork("paint"); }}
                      />
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

const CSS = `
.garage-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: radial-gradient(ellipse at 50% 30%, #1f2937 0%, #07090c 75%);
  display: flex; flex-direction: column;
  animation: garage-in .25s ease-out;
  color: #e5e7eb;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
}
@keyframes garage-in { from { opacity: 0; transform: scale(.98); } to { opacity: 1; transform: scale(1); } }
.garage-top {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px;
  background: linear-gradient(180deg, #0b0d10, #1a1d22);
  border-bottom: 2px solid #fde047;
}
.garage-back {
  background: #1f2937; color: #fde047; border: 1px solid #fde047;
  padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 700;
}
.garage-back:hover { background: #fde047; color: #0b0d10; }
.garage-title { flex: 1; text-align: center; font-weight: 900; letter-spacing: 2px; color: #fde047; font-size: 14px; }
.garage-prestige { background: #1f2937; padding: 6px 10px; border-radius: 6px; font-size: 12px; border: 1px solid #374151; }

.garage-body {
  flex: 1; display: grid;
  grid-template-columns: 220px 1fr 280px;
  gap: 10px; padding: 10px; min-height: 0;
}
.garage-fleet, .garage-actions {
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid #374151; border-radius: 10px;
  padding: 10px; overflow-y: auto;
}
.garage-section-title { font-weight: 800; font-size: 12px; letter-spacing: 1px; color: #fde047; margin-bottom: 8px; }
.garage-empty { color: #9ca3af; font-size: 12px; font-style: italic; }

.garage-taxi-row {
  display: flex; align-items: center; gap: 6px; width: 100%;
  background: #1f2937; color: #e5e7eb; border: 1px solid #374151;
  border-radius: 6px; padding: 6px; margin-bottom: 4px;
  text-align: left; cursor: pointer; font-size: 12px;
}
.garage-taxi-row:hover { background: #374151; }
.garage-taxi-row.is-active { border-color: #fde047; box-shadow: 0 0 0 1px #fde047 inset; }
.garage-taxi-swatch { width: 16px; height: 16px; border-radius: 3px; border: 2px solid; flex-shrink: 0; }
.garage-taxi-name { flex: 1; font-weight: 600; }
.garage-taxi-chips { font-size: 9px; opacity: 0.8; }
.garage-taxi-chips i { font-style: normal; margin-left: 2px; }
.badge { font-size: 9px; font-weight: 800; padding: 1px 4px; border-radius: 3px; margin-left: 4px; }
.badge.danger { background: #ef4444; color: #fff; }
.badge.warn { background: #f97316; color: #fff; }

.garage-stage {
  position: relative; background: #0b0d10;
  border: 1px solid #374151; border-radius: 10px; overflow: hidden;
  display: flex; flex-direction: column;
}
.garage-scene { flex: 1; width: 100%; height: 100%; min-height: 240px; }
.garage-progress {
  padding: 8px 12px; background: rgba(0,0,0,0.7); border-top: 1px solid #fde047;
}
.garage-progress-label { font-size: 12px; color: #fde047; font-weight: 700; margin-bottom: 4px; }
.garage-progress-bar { background: #1f2937; height: 8px; border-radius: 4px; overflow: hidden; }
.garage-progress-fill { background: linear-gradient(90deg, #fde047, #f97316); height: 100%; transition: width .1s linear; }
.garage-toast {
  position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.85); color: #fde047; padding: 8px 14px; border-radius: 6px;
  font-weight: 700; font-size: 13px; border: 1px solid #fde047;
  animation: garage-toast-in .3s;
}
@keyframes garage-toast-in { from { opacity: 0; transform: translate(-50%, -10px); } to { opacity: 1; transform: translate(-50%, 0); } }

.garage-action {
  display: grid; grid-template-columns: 28px 1fr auto; gap: 8px; align-items: center;
  width: 100%; background: #1f2937; color: #e5e7eb; border: 1px solid #374151;
  border-radius: 6px; padding: 8px; margin-bottom: 6px; cursor: pointer; text-align: left;
}
.garage-action:not(:disabled):hover { background: #374151; border-color: #fde047; }
.garage-action:disabled { opacity: 0.45; cursor: not-allowed; }
.garage-action .ico { font-size: 18px; }
.garage-action .meta b { display: block; font-size: 12px; font-weight: 800; }
.garage-action .meta i { display: block; font-size: 10px; font-style: normal; color: #9ca3af; line-height: 1.2; }
.garage-action .cost { font-size: 11px; font-weight: 800; color: #fde047; }
.garage-action.repair { border-color: #ef4444; }
.garage-action.repair .cost { color: #ef4444; }

.garage-paint-wrap { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #374151; }
.garage-paint-title { font-size: 11px; font-weight: 700; color: #fde047; margin-bottom: 6px; }
.garage-paint-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.garage-paint-swatch {
  width: 100%; aspect-ratio: 1; border-radius: 6px; border: 2px solid; cursor: pointer;
  transition: transform .1s;
}
.garage-paint-swatch:hover:not(:disabled) { transform: scale(1.1); }
.garage-paint-swatch.is-active { box-shadow: 0 0 0 2px #fde047, 0 0 8px rgba(253, 224, 71, 0.6); }

@media (max-width: 760px) {
  .garage-body { grid-template-columns: 1fr; grid-template-rows: auto 1fr auto; }
  .garage-fleet, .garage-actions { max-height: 30vh; }
}
`;
