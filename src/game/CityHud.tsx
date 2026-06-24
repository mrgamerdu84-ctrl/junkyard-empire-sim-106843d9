// =============================================================
// HUD haut de jeu — design "MY TAXI WORLD" :
//   - Carte date/jour/densité (en haut à gauche, fond sombre)
//   - Logo central "MY TAXI WORLD" avec couronne
// Les autres widgets (avatar, météo, $, cog, Missions) sont gérés
// dans leurs composants respectifs (HomeScreen / TaxiTycoon / GameMenu).
// =============================================================
import { useEffect, useState } from "react";
import { getGameTime, periodLabel, type GameTime } from "./cityClock";
import { useRealWorldEnv } from "@/lib/realWorldEnv";

export default function CityHud() {
  const env = useRealWorldEnv();
  const pop = env?.population ?? null;
  const [t, setT] = useState<GameTime>(() => getGameTime(undefined, pop));

  useEffect(() => {
    setT(getGameTime(undefined, pop));
    const id = window.setInterval(() => setT(getGameTime(undefined, pop)), 30_000);
    return () => window.clearInterval(id);
  }, [pop]);

  const periodColor =
    t.period === "rushAM" || t.period === "rushPM" ? "#ef4444" :
    t.period === "night" ? "#60a5fa" :
    t.period === "lunch" ? "#f59e0b" :
    "#22c55e";

  return (
    <>
      {/* Carte date / période / densité */}
      <div
        aria-label="Horloge de la ville"
        style={{
          position: "absolute",
          top: 54,
          left: 10,
          zIndex: 30,
          padding: "8px 12px",
          borderRadius: 12,
          background: "linear-gradient(180deg, rgba(20,24,34,0.92), rgba(8,10,16,0.92))",
          border: "1px solid rgba(245,197,66,0.35)",
          color: "#e8edf5",
          font: "600 11px/1.2 ui-sans-serif, system-ui",
          backdropFilter: "blur(6px)",
          pointerEvents: "none",
          display: "flex", flexDirection: "column", gap: 3,
          minWidth: 150,
          boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ fontSize: 12, color: "#fde047", fontWeight: 800 }}>{t.label}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.95 }}>
          <span style={{
            width: 7, height: 7, borderRadius: 99, background: periodColor,
            boxShadow: `0 0 6px ${periodColor}`,
          }} />
          <span>{periodLabel(t.period)}</span>
          {t.isHoliday && <span style={{ color: "#fbbf24" }}>· Férié</span>}
        </div>
        <div style={{ opacity: 0.8, fontSize: 10 }}>
          {env?.city ? `${env.city} · ` : ""}Densité ×{t.density.toFixed(2)}
        </div>
      </div>

      {/* Logo central MY TAXI WORLD */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 50,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 30,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          textShadow: "0 2px 6px rgba(0,0,0,0.8)",
        }}
      >
        <svg width="36" height="22" viewBox="0 0 36 22" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.6))" }}>
          <path d="M2 18 L6 6 L12 12 L18 4 L24 12 L30 6 L34 18 Z"
            fill="url(#crownGrad)" stroke="#7a4a0a" strokeWidth="1" strokeLinejoin="round" />
          <circle cx="6" cy="6" r="1.8" fill="#fef08a" />
          <circle cx="18" cy="4" r="2" fill="#ef4444" />
          <circle cx="30" cy="6" r="1.8" fill="#fef08a" />
          <defs>
            <linearGradient id="crownGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fde047" />
              <stop offset="1" stopColor="#b88715" />
            </linearGradient>
          </defs>
        </svg>
        <div style={{
          fontFamily: "system-ui, sans-serif",
          fontWeight: 900,
          fontSize: 11,
          color: "#fde047",
          letterSpacing: 1,
          lineHeight: 1,
          textAlign: "center",
        }}>
          MY TAXI<br />WORLD
        </div>
      </div>
    </>
  );
}
