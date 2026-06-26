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
import React, { useEffect, useMemo, useState } from "react";
import {
  applyPaint,
  applyRepair,
  applySticker,
  applyUpgrade,
  buyGarageEquipment,
  GARAGE_EQUIPMENT_CATALOG,
  getCompany,
  getFleetPrestige,
  getGarageEquipment,
  getRepairSpeedMul,
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
    const eqNow = getGarageEquipment();
    const tireD = eqNow.tireRack ? 0.10 : 0;
    const engineD = eqNow.workbench ? 0.10 : 0;
    const paintD = eqNow.paintBooth ? 0.50 : 0;
    let r: { ok: boolean; msg?: string; cost?: number } = { ok: false };
    if (k === "repair") {
      r = applyRepair(selected.id, getMaintenanceDiscount());
    } else if (k === "tires1" || k === "tires2") {
      const def = defFor(k);
      r = applyUpgrade(selected.id, "tires", k === "tires2" ? 2 : 1, Math.round(def.cost * (1 - tireD)));
    } else if (k === "engine1" || k === "engine2") {
      const def = defFor(k);
      r = applyUpgrade(selected.id, "engine", k === "engine2" ? 2 : 1, Math.round(def.cost * (1 - engineD)));
    } else if (k === "armor1" || k === "armor2") {
      const def = defFor(k);
      r = applyUpgrade(selected.id, "armor", k === "armor2" ? 2 : 1, def.cost);
    } else if (k === "paint") {
      const p = pendingPaint;
      if (p) applyPaint(selected.id, p.color, p.accent, Math.round(defFor("paint").cost * (1 - paintD)));
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
  }

  function startWork(kind: UpgradeKind) {
    if (!selected || working) return;
    const def = defFor(kind);
    const speedMul = getRepairSpeedMul();
    const dur = kind === "repair" ? def.durationMs * speedMul : def.durationMs;
    setWorking({ kind, endsAt: Date.now() + dur, mode: modeFor(kind) });
  }

  const prestige = getFleetPrestige();
  const eq = getGarageEquipment();
  const tireDisc = eq.tireRack ? 0.10 : 0;
  const engineDisc = eq.workbench ? 0.10 : 0;
  const paintDisc = eq.paintBooth ? 0.50 : 0;

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
          <svg viewBox="0 0 800 520" className="garage-scene" preserveAspectRatio="xMidYMid meet">
            <defs>
              {/* damier iso */}
              <linearGradient id="floorA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#4b5563" /><stop offset="1" stopColor="#374151" />
              </linearGradient>
              <linearGradient id="floorB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#374151" /><stop offset="1" stopColor="#1f2937" />
              </linearGradient>
              <linearGradient id="wallL" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#1f2937" /><stop offset="1" stopColor="#374151" />
              </linearGradient>
              <linearGradient id="wallR" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#475569" /><stop offset="1" stopColor="#1f2937" />
              </linearGradient>
              <linearGradient id="carBodyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={selected?.paint.color || "#facc15"} stopOpacity="1" />
                <stop offset="1" stopColor={selected?.paint.accent || "#a16207"} stopOpacity="1" />
              </linearGradient>
              <radialGradient id="spot" cx="0.5" cy="0.4" r="0.6">
                <stop offset="0" stopColor="#fde047" stopOpacity="0.35" />
                <stop offset="1" stopColor="#fde047" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* === MURS ISO (perspective avion) === */}
            {/* Mur gauche : trapèze qui plonge vers l'arrière */}
            <polygon points="60,90 400,260 400,500 60,330" fill="url(#wallL)" stroke="#0b0d10" strokeWidth="2" />
            {/* Mur droite */}
            <polygon points="740,90 400,260 400,500 740,330" fill="url(#wallR)" stroke="#0b0d10" strokeWidth="2" />
            {/* Fenêtres mur gauche */}
            {[0, 1, 2].map(i => {
              const t = 0.18 + i * 0.22;
              const x1 = 60 + (400 - 60) * t, y1 = 90 + (260 - 90) * t;
              const x2 = x1 + 70, y2 = y1 + 35;
              return (
                <polygon key={`wl${i}`}
                  points={`${x1},${y1} ${x2},${y1 + 18} ${x2},${y2 + 18} ${x1},${y2}`}
                  fill="#7dd3fc" opacity="0.55" stroke="#0b0d10" strokeWidth="1.5" />
              );
            })}
            {/* Fenêtres mur droite */}
            {[0, 1, 2].map(i => {
              const t = 0.18 + i * 0.22;
              const x1 = 740 - (740 - 400) * t, y1 = 90 + (260 - 90) * t;
              const x2 = x1 - 70, y2 = y1 + 35;
              return (
                <polygon key={`wr${i}`}
                  points={`${x1},${y1} ${x2},${y1 + 18} ${x2},${y2 + 18} ${x1},${y2}`}
                  fill="#7dd3fc" opacity="0.55" stroke="#0b0d10" strokeWidth="1.5" />
              );
            })}
            {/* Bandeau enseigne suspendu */}
            <polygon points="280,70 520,70 520,100 280,100" fill="#0b0d10" stroke="#fde047" strokeWidth="2" />
            <text x="400" y="92" textAnchor="middle" fontSize="16" fontWeight="900" fill="#fde047" letterSpacing="2">
              MY TAXI WORLD · ATELIER
            </text>

            {/* === SOL ISO en damier === */}
            {(() => {
              const tiles: React.ReactElement[] = [];
              // Origin centrale (400, 260). Iso : x' = (i-j)*tw, y' = (i+j)*th
              const tw = 40, th = 20;
              const cx0 = 400, cy0 = 260;
              for (let i = -4; i <= 4; i++) {
                for (let j = -4; j <= 4; j++) {
                  const x = cx0 + (i - j) * tw;
                  const y = cy0 + (i + j) * th;
                  if (y < 250 || y > 510) continue;
                  const fill = (i + j) % 2 === 0 ? "url(#floorA)" : "url(#floorB)";
                  tiles.push(
                    <polygon key={`t${i}_${j}`}
                      points={`${x},${y} ${x + tw},${y + th} ${x},${y + 2 * th} ${x - tw},${y + th}`}
                      fill={fill} stroke="#0b0d10" strokeWidth="0.6" opacity="0.95" />
                  );
                }
              }
              return tiles;
            })()}

            {/* Halo spot sur la zone de travail */}
            <ellipse cx="400" cy="340" rx="220" ry="80" fill="url(#spot)" />

            {/* === ÉQUIPEMENT iso === */}
            {eq.tireRack && (
              <g transform="translate(140,330)">
                <polygon points="0,0 60,30 60,90 0,60" fill="#374151" stroke="#0b0d10" strokeWidth="1.5" />
                <polygon points="0,0 -50,30 -50,90 0,60" fill="#1f2937" stroke="#0b0d10" strokeWidth="1.5" />
                <polygon points="0,0 60,30 10,60 -50,30" fill="#4b5563" stroke="#0b0d10" strokeWidth="1.5" />
                {[0, 1, 2].map(r => (
                  <g key={r} transform={`translate(0,${15 + r * 18})`}>
                    <ellipse cx="5" cy="22" rx="22" ry="6" fill="#0b0d10" />
                    <ellipse cx="5" cy="20" rx="22" ry="6" fill="#1f2937" stroke="#0b0d10" />
                  </g>
                ))}
                <text x="5" y="105" textAnchor="middle" fontSize="9" fill="#fde047" fontWeight="800">RACK PNEUS</text>
              </g>
            )}

            {eq.workbench && (
              <g transform="translate(620,310)">
                {/* plateau iso */}
                <polygon points="0,20 90,65 90,80 0,35" fill="#92400e" stroke="#0b0d10" strokeWidth="1.5" />
                <polygon points="0,20 -60,50 -60,65 0,35" fill="#78350f" stroke="#0b0d10" strokeWidth="1.5" />
                <polygon points="0,20 90,65 30,95 -60,50" fill="#b45309" stroke="#0b0d10" strokeWidth="1.5" />
                {/* outils dessus */}
                <rect x="10" y="8" width="18" height="6" fill="#9ca3af" stroke="#0b0d10" />
                <circle cx="45" cy="10" r="5" fill="#dc2626" stroke="#0b0d10" />
                <rect x="55" y="6" width="4" height="12" fill="#475569" stroke="#0b0d10" />
                {/* pieds */}
                <rect x="-55" y="60" width="3" height="22" fill="#1a1d22" />
                <rect x="85"  y="78" width="3" height="22" fill="#1a1d22" />
                <text x="15" y="110" textAnchor="middle" fontSize="9" fill="#fde047" fontWeight="800">ÉTABLI</text>
              </g>
            )}

            {eq.paintBooth && (
              <g transform="translate(560,150)">
                <polygon points="0,0 120,60 120,180 0,120" fill="#1e293b" stroke="#fde047" strokeWidth="2" />
                <polygon points="0,0 -90,45 -90,165 0,120" fill="#0f172a" stroke="#fde047" strokeWidth="2" />
                <polygon points="0,0 120,60 30,105 -90,45" fill="#334155" stroke="#fde047" strokeWidth="2" />
                {/* vitre iso */}
                <polygon points="15,20 100,62 100,95 15,55" fill="#7dd3fc" opacity="0.45" stroke="#0b0d10" />
                <text x="20" y="170" fontSize="10" fill="#fde047" fontWeight="800">CABINE PEINTURE</text>
              </g>
            )}

            {/* === PONT ÉLÉVATEUR iso (zone de travail principale) === */}
            <g>
              {/* ombre au sol */}
              <ellipse cx="400" cy="380" rx="170" ry="40" fill="rgba(0,0,0,0.5)" />
              {/* plateau supérieur jaune iso */}
              <polygon points="400,290 580,360 400,430 220,360" fill="#facc15" stroke="#0b0d10" strokeWidth="2" />
              <polygon points="400,295 575,362 400,425 225,362" fill="#fde047" stroke="#0b0d10" strokeWidth="0.8" opacity="0.6" />
              {/* colonne hydraulique */}
              <rect x="392" y="360" width="16" height="60" fill="#1a1d22" stroke="#0b0d10" />
              <rect x="388" y="416" width="24" height="10" fill="#374151" stroke="#0b0d10" />
            </g>

            {/* === TAXI iso 3D sur le pont === */}
            {selected && (() => {
              const cx0 = 400, cy0 = 320;
              const body = selected.paint.color;
              const dark = selected.paint.accent;
              return (
                <g transform={`translate(${cx0},${cy0})`}>
                  {/* ombre dynamique */}
                  <ellipse cx="0" cy="50" rx="120" ry="22" fill="rgba(0,0,0,0.45)" />

                  {/* ROUES iso (4 ellipses) */}
                  {(() => {
                    const tireR = 9 + selected.upgrades.tires * 2;
                    const wheels = [
                      { x: -80, y: 20 }, { x: 80, y: 20 },
                      { x: -55, y: 50 }, { x: 55, y: 50 },
                    ];
                    return wheels.map((w, i) => (
                      <g key={i}>
                        <ellipse cx={w.x} cy={w.y} rx={tireR} ry={tireR * 0.45} fill="#0b0d10" stroke="#4b5563" strokeWidth="1.5" />
                        <ellipse cx={w.x} cy={w.y - 1} rx={tireR * 0.5} ry={tireR * 0.22} fill="#9ca3af" />
                      </g>
                    ));
                  })()}

                  {/* CHÂSSIS bas iso */}
                  <polygon points="-110,0 0,40 110,0 0,-40" fill={dark} stroke="#0b0d10" strokeWidth="2" />

                  {/* FACE LATÉRALE droite (profondeur) */}
                  <polygon points="110,0 110,-25 0,-65 0,-40" fill={dark} stroke="#0b0d10" strokeWidth="1.5" />
                  {/* FACE LATÉRALE gauche */}
                  <polygon points="-110,0 -110,-25 0,-65 0,-40" fill={body} stroke="#0b0d10" strokeWidth="1.5" opacity="0.92" />

                  {/* TOIT iso losange */}
                  <polygon points="-95,-22 0,-58 95,-22 0,15" fill="url(#carBodyGrad)" stroke="#0b0d10" strokeWidth="2" />

                  {/* PARE-BRISE avant (face nord-est) */}
                  <polygon points="0,-58 60,-38 60,-22 0,-42" fill="#0b1626" opacity="0.92" stroke="#0b0d10" strokeWidth="1" />
                  {/* PARE-BRISE arrière */}
                  <polygon points="0,-58 -60,-38 -60,-22 0,-42" fill="#0b1626" opacity="0.75" stroke="#0b0d10" strokeWidth="1" />

                  {/* portière */}
                  <polygon points="20,-50 50,-40 50,-12 20,-22" fill={dark} stroke="rgba(0,0,0,0.6)" strokeWidth="1" />
                  <circle cx="42" cy="-26" r="1.4" fill="#fde047" />

                  {/* Phares */}
                  <ellipse cx="92" cy="-12" rx="6" ry="3" fill="#fef9c3" stroke="#0b0d10" />
                  <ellipse cx="-92" cy="-12" rx="6" ry="3" fill="#7f1d1d" stroke="#0b0d10" />

                  {/* PANNEAU TAXI sur le toit */}
                  <g transform="translate(0,-50)">
                    <polygon points="-16,-6 0,-12 16,-6 0,0" fill="#fde047" stroke="#0b0d10" strokeWidth="1" />
                    <text x="0" y="-4" fontSize="6" fontWeight="900" fill="#0b0d10" textAnchor="middle">TAXI</text>
                  </g>

                  {/* RAMPE LUMINEUSE si upgrade */}
                  {selected.upgrades.sticker === "roof" && (
                    <polygon points="-20,-52 0,-60 20,-52 0,-44" fill="#fde047" stroke="#0b0d10" strokeWidth="1">
                      <animate attributeName="opacity" values="1;0.4;1" dur="0.9s" repeatCount="indefinite" />
                    </polygon>
                  )}

                  {/* BLINDAGE — bandes latérales iso */}
                  {selected.upgrades.armor >= 1 && (
                    <polygon points="-105,-5 0,-43 105,-5 0,33" fill="#52525b" opacity="0.55" stroke="#0b0d10" strokeWidth="1" />
                  )}
                  {selected.upgrades.armor >= 2 && (
                    <>
                      <rect x="-100" y="-30" width="20" height="14" fill="#71717a" stroke="#0b0d10" transform="skewY(-18)" />
                      <rect x="80"   y="-30" width="20" height="14" fill="#71717a" stroke="#0b0d10" transform="skewY(18)" />
                    </>
                  )}

                  {/* Barre de vie au-dessus */}
                  <g transform="translate(-40,-90)">
                    <rect width="80" height="7" fill="#1a1d22" rx="2" stroke="#0b0d10" />
                    <rect width={80 * (selected.condition / 100)} height="7" rx="2"
                      fill={selected.condition < 30 ? "#ef4444" : selected.condition < 70 ? "#f97316" : "#22c55e"} />
                    <text x="40" y="-2" textAnchor="middle" fontSize="8" fontWeight="800" fill="#fde047">
                      {Math.round(selected.condition)}%
                    </text>
                  </g>
                </g>
              );
            })()}

            {/* === Ponts supplémentaires (vides) === */}
            {eq.lifts >= 2 && (
              <g transform="translate(180,440)">
                <ellipse cx="0" cy="20" rx="70" ry="14" fill="rgba(0,0,0,0.45)" />
                <polygon points="0,-10 70,25 0,60 -70,25" fill="#a16207" stroke="#0b0d10" strokeWidth="1.5" />
                <rect x="-6" y="25" width="12" height="30" fill="#1a1d22" />
              </g>
            )}
            {eq.lifts >= 3 && (
              <g transform="translate(620,460)">
                <ellipse cx="0" cy="20" rx="70" ry="14" fill="rgba(0,0,0,0.45)" />
                <polygon points="0,-10 70,25 0,60 -70,25" fill="#a16207" stroke="#0b0d10" strokeWidth="1.5" />
                <rect x="-6" y="25" width="12" height="30" fill="#1a1d22" />
              </g>
            )}

            {/* MÉCANO animé qui tourne autour du taxi */}
            {selected && working && (
              <MechanicSprite mode={working.mode} cx={400} cy={340} radius={130} />
            )}

            {/* Étincelles soudure */}
            {working && working.mode === "weld" && (
              <g>
                {[0,1,2,3,4].map(i => (
                  <circle key={i} cx={380 + i * 12} cy={330 + (i % 2) * 6} r={1.4} fill={i % 2 ? "#fde047" : "#f97316"}>
                    <animate attributeName="opacity" values="0;1;0" dur={`${0.4 + i * 0.1}s`} repeatCount="indefinite" />
                  </circle>
                ))}
              </g>
            )}

            {/* Brume peinture */}
            {working && working.mode === "paint" && (
              <g opacity="0.6">
                <ellipse cx="400" cy="320" rx="120" ry="40" fill={pendingPaint?.color || "#7dd3fc"} opacity="0.25">
                  <animate attributeName="opacity" values="0.1;0.4;0.1" dur="1.2s" repeatCount="indefinite" />
                </ellipse>
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

          {/* === Équipement du garage === */}
          <div className="garage-section-title" style={{ marginTop: 14 }}>🏗 Équipement</div>
          <div className="garage-eq-note">
            Ponts: <b>{eq.lifts}/3</b>
            {eq.tireRack && " · 🛞−10%"}
            {eq.workbench && " · ⚙−10%"}
            {eq.paintBooth && " · 🎨−50%"}
          </div>
          {GARAGE_EQUIPMENT_CATALOG.map(def => {
            const owned =
              def.key === "lift"
                ? eq.lifts >= 3
                : !!(eq as Record<string, unknown>)[def.key];
            const lvlInfo = def.key === "lift" ? ` (${eq.lifts}/3)` : "";
            return (
              <button
                key={def.key}
                className="garage-action"
                disabled={!!working || owned}
                onClick={() => {
                  const r = buyGarageEquipment(def.key as "lift" | "tireRack" | "workbench" | "paintBooth");
                  showToast(r.msg);
                }}
              >
                <span className="ico">{def.icon}</span>
                <span className="meta">
                  <b>{def.label}{lvlInfo}</b>
                  <i>{def.desc}</i>
                </span>
                <span className="cost">{owned ? "✓" : `${def.cost} $`}</span>
              </button>
            );
          })}
          {/* lint anti-warning */}
          <span hidden>{tireDisc}{engineDisc}{paintDisc}</span>
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
