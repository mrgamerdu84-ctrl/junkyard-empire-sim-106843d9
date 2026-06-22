// =============================================================
// Petit HUD : horloge, période et densité estimée.
// Heure et jour RÉELS du joueur ; densité ajustée à la taille
// de sa vraie ville (population via reverse-geo).
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
    <div
      aria-label="Horloge de la ville"
      style={{
        position: "absolute",
        top: 54,
        left: 10,
        zIndex: 30,
        padding: "6px 10px",
        borderRadius: 10,
        background: "rgba(12, 14, 22, 0.78)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "#e8edf5",
        font: "600 11px/1.2 ui-sans-serif, system-ui",
        backdropFilter: "blur(6px)",
        pointerEvents: "none",
        display: "flex", flexDirection: "column", gap: 2,
        minWidth: 140,
      }}
    >
      <div style={{ fontSize: 12 }}>{t.label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.9 }}>
        <span style={{
          width: 7, height: 7, borderRadius: 99, background: periodColor,
          boxShadow: `0 0 6px ${periodColor}`,
        }} />
        <span>{periodLabel(t.period)}</span>
        {t.isHoliday && <span style={{ color: "#fbbf24" }}>· Férié</span>}
      </div>
      <div style={{ opacity: 0.75, fontSize: 10 }}>
        {env?.city ? `${env.city} · ` : ""}Densité ×{t.density.toFixed(2)}
      </div>
    </div>
  );
}
