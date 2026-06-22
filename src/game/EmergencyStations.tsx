// =============================================================
// Stations d'urgence — overlays statiques (commissariat, caserne,
// hôpital) avec véhicules garés visibles + gyrophares qui clignotent
// quand une intervention de la catégorie correspondante est active.
//
// Purement visuel : le système d'assignation (CityTraffic) garde
// 1 véhicule de chaque catégorie en circulation pour répondre aux
// missions. Ces sprites donnent l'impression que la flotte est
// "garée au QG" la majeure partie du temps.
// =============================================================
import { useEffect, useState } from "react";
import { GAME_ASSETS } from "./gameAssets";

// Coordonnées dans le même viewBox 1920×1080 que CityTraffic.
// Tu peux ajuster ces positions si la map change.
const STATIONS = [
  {
    id: "commissariat",
    label: "Commissariat",
    icon: "🚓",
    color: "#3b82f6",
    category: "police" as const,
    x: 360, y: 760,
    sprite: GAME_ASSETS["police.car"],
  },
  {
    id: "caserne",
    label: "Caserne",
    icon: "🚒",
    color: "#ef4444",
    category: "firetruck" as const,
    x: 1460, y: 220,
    sprite: GAME_ASSETS["emergency.firetruck"],
  },
  {
    id: "hopital",
    label: "Hôpital",
    icon: "🚑",
    color: "#22c55e",
    category: "ambulance" as const,
    x: 1100, y: 880,
    sprite: GAME_ASSETS["emergency.ambulance"],
  },
];

type Active = Record<string, number>; // category -> expiresAt

export default function EmergencyStations() {
  const [active, setActive] = useState<Active>({});

  useEffect(() => {
    const on = (ev: Event) => {
      const d = (ev as CustomEvent<{ category?: string }>).detail;
      const cat = d?.category;
      if (!cat) return;
      setActive((prev) => ({ ...prev, [cat]: performance.now() + 6000 }));
    };
    window.addEventListener("jce.intervention.assigned", on as EventListener);
    window.addEventListener("jce.intervention.request", on as EventListener);
    return () => {
      window.removeEventListener("jce.intervention.assigned", on as EventListener);
      window.removeEventListener("jce.intervention.request", on as EventListener);
    };
  }, []);

  // Nettoie les états expirés régulièrement pour stopper les gyrophares.
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = performance.now();
      setActive((prev) => {
        const next: Active = {};
        let changed = false;
        for (const k of Object.keys(prev)) {
          if (prev[k] > now) next[k] = prev[k]; else changed = true;
        }
        return changed ? next : prev;
      });
      force((v) => (v + 1) % 1000);
    }, 1500);
    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      <style>{`
        @keyframes jce-gyro-blue {
          0%, 100% { background: #1e40af; box-shadow: 0 0 8px #3b82f6; }
          50%      { background: #ef4444; box-shadow: 0 0 12px #f87171; }
        }
        @keyframes jce-gyro-red {
          0%, 100% { background: #b91c1c; box-shadow: 0 0 8px #ef4444; }
          50%      { background: #1e40af; box-shadow: 0 0 12px #3b82f6; }
        }
      `}</style>
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          zIndex: 4, pointerEvents: "none",
        }}
        aria-hidden
      >
        {STATIONS.map((s) => {
          const isActive = (active[s.category] ?? 0) > performance.now();
          return (
            <g key={s.id} transform={`translate(${s.x} ${s.y})`}>
              {/* Plateforme du garage */}
              <rect
                x={-46} y={-30} width={92} height={60}
                rx={6}
                fill="rgba(20,22,28,0.78)"
                stroke={s.color}
                strokeWidth={2}
              />
              {/* Toit / badge */}
              <rect
                x={-46} y={-44} width={92} height={16}
                rx={3}
                fill={s.color}
                opacity={0.85}
              />
              <text
                x={0} y={-31}
                textAnchor="middle"
                fontSize={12}
                fontWeight={900}
                fill="#fff"
                style={{ font: "900 12px ui-sans-serif, system-ui" }}
              >
                {s.label.toUpperCase()}
              </text>
              {/* Véhicule garé */}
              <image
                href={s.sprite}
                x={-22} y={-14}
                width={44} height={28}
                preserveAspectRatio="xMidYMid meet"
                style={{
                  opacity: isActive ? 0.5 : 1,
                  filter: isActive ? "grayscale(0.5)" : "none",
                }}
              />
              {/* Gyrophare clignotant si intervention en cours */}
              {isActive && (
                <foreignObject x={-8} y={-22} width={16} height={10}>
                  <div style={{
                    width: 10, height: 6, margin: "2px auto",
                    borderRadius: 2,
                    animation: `${s.category === "firetruck" ? "jce-gyro-red" : "jce-gyro-blue"} 0.5s linear infinite`,
                  }} />
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>
    </>
  );
}
