// =============================================================
// Stations d'urgence — commissariat, caserne, hôpital.
// Les véhicules restent garés au QG et ne sortent que lorsqu'une mission
// demande explicitement leur catégorie.
// =============================================================
import { useEffect, useState } from "react";
import { GAME_ASSETS } from "./gameAssets";
import { ROADS } from "./CityTraffic";
import { getRoad, getRoadPoint, hasRoadCache } from "./RoadCache";

// Projette (x,y) sur le réseau routier et renvoie le path le plus proche
// avec la fraction (0..1) correspondante.
function projectOnRoads(x: number, y: number): { pathIdx: number; frac: number; dist: number } | null {
  if (!hasRoadCache()) return null;
  let best: { pathIdx: number; frac: number; dist: number } | null = null;
  for (let i = 0; i < ROADS.length; i++) {
    const road = getRoad(i);
    if (!road || road.points.length === 0) continue;
    for (let j = 0; j < road.points.length; j++) {
      const p = road.points[j];
      const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (!best || d < best.dist) {
        best = { pathIdx: i, frac: j / (road.points.length - 1), dist: d };
      }
    }
  }
  return best;
}

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

// Les sprites police / ambulance / pompiers sont dessinés en vue du dessus,
// nez vers le haut. La route calcule 0° vers la droite, donc +90° aligne
// toujours l'avant du véhicule sur le sens de circulation.
const ROAD_SPRITE_FORWARD_OFFSET = 90;

type Responder = {
  id: number;
  eventId: number;
  category: "police" | "firetruck" | "ambulance";
  label: string;
  sprite: string;
  color: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startedAt: number;
  arriveAt: number;
  leaveAt: number;
  doneAt: number;
  resolved: boolean;
  // Trajet "snappé" sur une route réelle (si disponible) pour ne pas
  // traverser la map en ligne droite.
  roadPathIdx?: number;
  roadFracFrom?: number;
  roadFracTo?: number;
};

let responderSeq = 1;

export default function EmergencyStations() {
  const [active, setActive] = useState<Active>({});
  const [responders, setResponders] = useState<Responder[]>([]);
  const [, forceFrame] = useState(0);

  useEffect(() => {
    const onAssigned = (ev: Event) => {
      const d = (ev as CustomEvent<{ category?: string }>).detail;
      const cat = d?.category;
      if (!cat) return;
      setActive((prev) => ({ ...prev, [cat]: performance.now() + 6000 }));
    };
    const onRequest = (ev: Event) => {
      const d = (ev as CustomEvent<{ id: number; x: number; y: number; category?: string; label?: string }>).detail;
      if (!d?.category) return;
      const station = STATIONS.find((s) => s.category === d.category);
      if (!station) {
        window.dispatchEvent(new CustomEvent("jce.intervention.nomatch", {
          detail: { id: d.id, category: d.category, label: d.label ?? "Mission" },
        }));
        return;
      }
      const dist = Math.hypot(d.x - station.x, d.y - station.y);
      const travelMs = Math.max(1400, Math.min(5200, (dist / 250) * 1000));
      const now = performance.now();
      setActive((prev) => ({ ...prev, [station.category]: now + travelMs * 2 + 2600 }));
      setResponders((prev) => [
        ...prev.filter((r) => r.category !== station.category),
        {
          id: responderSeq++,
          eventId: d.id,
          category: station.category,
          label: d.label ?? station.label,
          sprite: station.sprite,
          color: station.color,
          fromX: station.x,
          fromY: station.y,
          toX: d.x,
          toY: d.y,
          startedAt: now,
          arriveAt: now + travelMs,
          leaveAt: now + travelMs + 2200,
          doneAt: now + travelMs * 2 + 2200,
          resolved: false,
        },
      ]);
      window.dispatchEvent(new CustomEvent("jce.intervention.assigned", {
        detail: { id: d.id, category: station.category, label: d.label ?? station.label },
      }));
    };
    window.addEventListener("jce.intervention.assigned", onAssigned as EventListener);
    window.addEventListener("jce.intervention.request", onRequest as EventListener);
    return () => {
      window.removeEventListener("jce.intervention.assigned", onAssigned as EventListener);
      window.removeEventListener("jce.intervention.request", onRequest as EventListener);
    };
  }, []);

  // Nettoie les états expirés et clôture les missions arrivées sur place.
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
      setResponders((prev) => {
        const toResolve: number[] = [];
        const next = prev
          .map((r) => {
            if (!r.resolved && now >= r.arriveAt) {
              toResolve.push(r.eventId);
              return { ...r, resolved: true };
            }
            return r;
          })
          .filter((r) => now < r.doneAt);
        if (toResolve.length) {
          queueMicrotask(() => {
            for (const id of toResolve) {
              window.dispatchEvent(new CustomEvent("jce.intervention.resolved", { detail: { id } }));
            }
          });
        }
        return next;
      });
    }, 180);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    // Tick à 15 fps : suffit pour le clignotement des gyrophares, et libère
    // beaucoup de CPU sur les smartphones d'entrée de gamme.
    const id = window.setInterval(() => {
      forceFrame((v) => (v + 1) % 1_000_000);
    }, 66);
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
          const isAway = responders.some((r) => r.category === s.category);
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
                  opacity: isAway ? 0.28 : isActive ? 0.5 : 1,
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
        {responders.map((r) => {
          const now = performance.now();
          const outbound = now < r.leaveAt;
          const start = outbound ? r.startedAt : r.leaveAt;
          const end = outbound ? r.arriveAt : r.doneAt;
          const rawK = end > start ? (now - start) / (end - start) : 1;
          const k = Math.max(0, Math.min(1, rawK));
          const ax = outbound ? r.fromX : r.toX;
          const ay = outbound ? r.fromY : r.toY;
          const bx = outbound ? r.toX : r.fromX;
          const by = outbound ? r.toY : r.fromY;
          const x = ax + (bx - ax) * k;
          const y = ay + (by - ay) * k;
          const angle = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
          const flash = Math.floor(now / 160) % 2 === 0;
          return (
            <g key={r.id} transform={`translate(${x} ${y}) rotate(${angle})`}>
              <circle r="25" fill={flash ? "#3b82f6" : "#ef4444"} opacity="0.24" />
              <g transform={`rotate(${ROAD_SPRITE_FORWARD_OFFSET})`}>
                <image href={r.sprite} x={-22} y={-17} width={44} height={34} preserveAspectRatio="xMidYMid meet" />
              </g>
              {/* Gyrophare perpendiculaire au sens de marche (en travers du toit) */}
              <rect x="-2.5" y="-9" width="5" height="18" rx="1.2" fill="#0b0d10" />
              <rect x="-2" y="-8.5" width="4" height="8.5" rx="0.8" fill={flash ? "#60a5fa" : "#1e3a8a"} />
              <rect x="-2" y="0" width="4" height="8.5" rx="0.8" fill={flash ? "#7f1d1d" : "#f87171"} />
              <text x="0" y="30" textAnchor="middle" fontSize="4.5" fontWeight="900" fill="#fbbf24" stroke="#0b0d10" strokeWidth="0.9" paintOrder="stroke">
                {r.label.toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
    </>
  );
}
