// =============================================================
// GameMap — système de carte propre, pixel-précis.
// Source unique de vérité pour les routes des taxis joueur :
// waypoints injectés en dur, animation SVG <animateMotion> qui
// suit STRICTEMENT les paths (zéro calcul, zéro dérive).
// Image de fond : src/routes/index.tsx (citymap-v3.jpg).
// =============================================================
import { useEffect, useState } from "react";
import taxiYellow from "@/assets/taxi-yellow-top.png";

type P = { x: number; y: number };

const ROADS: Record<"axeGauche" | "axeDroite" | "axeBas", P[]> = {
  axeGauche: [{ x: 100, y: 150 }, { x: 420, y: 360 }, { x: 320, y: 780 }, { x: 100, y: 1000 }],
  axeDroite: [{ x: 1800, y: 100 }, { x: 1460, y: 280 }, { x: 1520, y: 740 }, { x: 1850, y: 950 }],
  axeBas:    [{ x: 320, y: 780 }, { x: 960, y: 840 }, { x: 1520, y: 740 }],
};
const HANGARS: P[] = [{ x: 880, y: 520 }, { x: 1040, y: 520 }];
const PORTAIL: P = { x: 960, y: 840 };
const IDLE_PARKING: P = { x: 1000, y: 920 };

const toPath = (pts: P[]) => pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

const ROUTE_KEYS = ["axeGauche", "axeDroite", "axeBas"] as const;
type RouteKey = (typeof ROUTE_KEYS)[number];

// Construit un trajet Hangar → Portail → axe complet → retour Portail → Idle.
function buildTaxiTrip(hangar: P, routeKey: RouteKey): string {
  const axe = ROADS[routeKey];
  return toPath([hangar, PORTAIL, ...axe, PORTAIL, IDLE_PARKING]);
}

// Lit le nombre de taxis depuis la sauvegarde de TaxiTycoon (sans toucher au composant).
const SAVE_KEY = "taxi-tycoon-v4";
function useTaxiCount(): number {
  const [n, setN] = useState<number>(() => readCount());
  useEffect(() => {
    const tick = () => setN(readCount());
    const id = window.setInterval(tick, 800);
    window.addEventListener("storage", tick);
    return () => { window.clearInterval(id); window.removeEventListener("storage", tick); };
  }, []);
  return n;
}
function readCount(): number {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return 1;
    const j = JSON.parse(raw);
    return Array.isArray(j?.taxis) ? Math.max(1, j.taxis.length) : 1;
  } catch { return 1; }
}

export default function GameMap({ showDebugRoutes = false }: { showDebugRoutes?: boolean }) {
  const count = useTaxiCount();
  const taxis = Array.from({ length: count }, (_, i) => {
    const hangar = HANGARS[i % HANGARS.length];
    const routeKey = ROUTE_KEYS[i % ROUTE_KEYS.length];
    const duration = 28 + (i % 3) * 4; // 28-36s par boucle
    const delay = (i * 1.7) % 6;
    return { id: i, hangar, routeKey, duration, delay };
  });

  return (
    <svg
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid meet"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 3, pointerEvents: "none" }}
      aria-hidden
    >
      <defs>
        {taxis.map((t) => (
          <path
            key={`p-${t.id}`}
            id={`gm-trip-${t.id}`}
            d={buildTaxiTrip(t.hangar, t.routeKey)}
            fill="none"
          />
        ))}
        <filter id="gm-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.45" />
        </filter>
      </defs>

      {showDebugRoutes && (
        <g opacity="0.5">
          {(Object.keys(ROADS) as RouteKey[]).map((k) => (
            <path key={k} d={toPath(ROADS[k])} stroke="#ffeb3b" strokeWidth="3" fill="none" strokeDasharray="6 4" />
          ))}
          {HANGARS.map((h, i) => (<circle key={`h-${i}`} cx={h.x} cy={h.y} r="8" fill="#22c55e" />))}
          <circle cx={PORTAIL.x} cy={PORTAIL.y} r="10" fill="#ef4444" />
          <circle cx={IDLE_PARKING.x} cy={IDLE_PARKING.y} r="10" fill="#3b82f6" />
        </g>
      )}

      {taxis.map((t) => (
        <g key={t.id} filter="url(#gm-shadow)">
          <image
            href={taxiYellow}
            width="56"
            height="56"
            x="-28"
            y="-28"
          >
            <animateMotion
              dur={`${t.duration}s`}
              begin={`${t.delay}s`}
              repeatCount="indefinite"
              rotate="auto"
            >
              <mpath href={`#gm-trip-${t.id}`} />
            </animateMotion>
          </image>
        </g>
      ))}
    </svg>
  );
}
