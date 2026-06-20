// =============================================================
// Lot 3 — Concurrents IA + Économie
// Quatre compagnies rivales possèdent un QG fixe sur la carte.
// Leur trésorerie évolue de façon pseudo-aléatoire et leur fortune
// est comparée en temps réel à celle du joueur (lue dans localStorage).
// Dès que le joueur les dépasse largement (×3), elles font faillite :
// le QG vire au gris, un crâne apparaît, et la compagnie est éliminée.
// =============================================================
import { useEffect, useState } from "react";

const SAVE_KEY = "taxi-tycoon-v4";

type Competitor = {
  id: string;
  name: string;
  color: string;
  // Coordonnées dans le viewBox 1920x1080 de la carte
  x: number;
  y: number;
  treasury: number;
  taxiCount: number;
  bankrupt: boolean;
};

const INITIAL: Competitor[] = [
  { id: "yellow",  name: "Yellow Cab Co.",      color: "#facc15", x: 380,  y: 240, treasury: 12_000, taxiCount: 8,  bankrupt: false },
  { id: "blue",    name: "Blue Wave Taxis",     color: "#3b82f6", x: 1480, y: 360, treasury: 18_000, taxiCount: 11, bankrupt: false },
  { id: "neon",    name: "Neon Rides",          color: "#22d3ee", x: 560,  y: 820, treasury:  9_500, taxiCount: 6,  bankrupt: false },
  { id: "shadow",  name: "Shadow Transports",   color: "#a855f7", x: 1620, y: 760, treasury: 22_000, taxiCount: 14, bankrupt: false },
];

function readPlayerMoney(): number {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return 0;
    const j = JSON.parse(raw);
    return Number(j?.money ?? 0);
  } catch { return 0; }
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return Math.round(n).toString();
}

export default function CityCompetitors() {
  const [comps, setComps] = useState<Competitor[]>(INITIAL);
  const [playerMoney, setPlayerMoney] = useState<number>(0);
  const [bankruptToast, setBankruptToast] = useState<string | null>(null);

  // Tick IA : trésorerie fluctue toutes les 5s (-8% à +12%, biais positif léger)
  useEffect(() => {
    const t = window.setInterval(() => {
      setComps((arr) =>
        arr.map((c) => {
          if (c.bankrupt) return c;
          const delta = c.treasury * (-0.08 + Math.random() * 0.20);
          const nextT = Math.max(500, c.treasury + delta);
          // évolue parfois de taxis (±1)
          const dT = Math.random() < 0.15 ? (Math.random() < 0.5 ? -1 : 1) : 0;
          return { ...c, treasury: nextT, taxiCount: Math.max(1, c.taxiCount + dT) };
        }),
      );
    }, 5000);
    return () => window.clearInterval(t);
  }, []);

  // Lit la trésorerie joueur toutes les 2s pour comparaison
  useEffect(() => {
    const tick = () => setPlayerMoney(readPlayerMoney());
    tick();
    const t = window.setInterval(tick, 2000);
    return () => window.clearInterval(t);
  }, []);

  // Faillites : si le joueur dépasse ×3 la trésorerie d'un concurrent
  useEffect(() => {
    setComps((arr) => {
      let changed = false;
      const next = arr.map((c) => {
        if (c.bankrupt) return c;
        if (playerMoney > c.treasury * 3 && playerMoney > 5000) {
          changed = true;
          setBankruptToast(`💀 ${c.name} a fait faillite !`);
          window.setTimeout(() => setBankruptToast(null), 6000);
          return { ...c, bankrupt: true, taxiCount: 0 };
        }
        return c;
      });
      return changed ? next : arr;
    });
  }, [playerMoney]);

  return (
    <>
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 6 }}
      >
        {comps.map((c) => {
          const fillBody = c.bankrupt ? "#4b5563" : c.color;
          const opacity = c.bankrupt ? 0.55 : 1;
          return (
            <g key={c.id} transform={`translate(${c.x},${c.y})`} opacity={opacity}>
              {/* ombre */}
              <ellipse cx="0" cy="34" rx="34" ry="8" fill="rgba(0,0,0,0.45)" />
              {/* bâtiment QG */}
              <rect x="-30" y="-44" width="60" height="78" rx="4" fill={fillBody} stroke="#0b0d10" strokeWidth="2" />
              <rect x="-26" y="-40" width="52" height="14" fill="rgba(0,0,0,0.35)" />
              {/* fenêtres */}
              {[-20, -6, 8].map((wx, i) => (
                <rect key={i} x={wx} y={-22 + (i % 2) * 10} width="10" height="6" fill={c.bankrupt ? "#1f2937" : "#fde68a"} opacity="0.85" />
              ))}
              {/* toit / enseigne */}
              <rect x="-32" y="-50" width="64" height="8" rx="2" fill="#0b0d10" />
              <text x="0" y="-44" textAnchor="middle" fontSize="6.5" fontWeight="900"
                fill={c.bankrupt ? "#9ca3af" : "#fde047"}
                fontFamily="system-ui, sans-serif">
                {c.name.split(" ")[0].toUpperCase()}
              </text>
              {/* badge trésorerie */}
              <g transform="translate(0,-60)">
                <rect x="-30" y="-9" width="60" height="14" rx="7" fill="rgba(15,23,42,0.85)" stroke={c.color} strokeWidth="1" />
                <text x="0" y="1" textAnchor="middle" fontSize="9" fontWeight="900"
                  fill="#fff7d6" fontFamily="system-ui, sans-serif">
                  {c.bankrupt ? "FAILLITE" : `💰 ${fmt(c.treasury)}$`}
                </text>
              </g>
              {/* taxis */}
              {!c.bankrupt && (
                <text x="0" y="50" textAnchor="middle" fontSize="9" fontWeight="800"
                  fill="#fff7d6" fontFamily="system-ui, sans-serif">
                  🚕 ×{c.taxiCount}
                </text>
              )}
              {/* crâne faillite */}
              {c.bankrupt && (
                <text x="0" y="6" textAnchor="middle" fontSize="32" opacity="0.85">💀</text>
              )}
            </g>
          );
        })}
      </svg>

      {bankruptToast && (
        <div
          style={{
            position: "fixed", top: 120, left: "50%", transform: "translateX(-50%)",
            zIndex: 10000, background: "linear-gradient(180deg,#991b1b,#450a0a)",
            color: "#fff7d6", padding: "10px 16px", borderRadius: 12,
            border: "2px solid #fde047", fontWeight: 900, fontSize: 14,
            fontFamily: "system-ui, sans-serif",
            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
          }}
        >
          {bankruptToast}
        </div>
      )}
    </>
  );
}
