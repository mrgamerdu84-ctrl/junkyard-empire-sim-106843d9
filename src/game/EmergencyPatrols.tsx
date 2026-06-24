// =============================================================
// Étape 3 — Patrouilles d'urgence (police / pompiers / ambulance)
// Chaque QG envoie périodiquement UN véhicule en patrouille sur le
// réseau routier. Les sprites utilisés sont EXACTEMENT ceux déjà
// définis dans GAME_ASSETS (police.car / emergency.ambulance /
// emergency.firetruck) — aucun modèle existant n'est modifié.
//
// Le véhicule sort du QG, parcourt un tronçon de ROADS aller-retour
// puis revient se garer. Pas de téléport : on suit la longueur du
// path en continu via getPointAtLength().
// =============================================================
import { useEffect, useRef, useState } from "react";
import { ROADS, VILLAGE_PATHS } from "./CityTraffic";
import { GAME_ASSETS } from "./gameAssets";

type Category = "police" | "firetruck" | "ambulance";

type Station = {
  id: string;
  category: Category;
  x: number;
  y: number;
  sprite: string;
  // intervalle entre deux patrouilles (ms)
  minGap: number;
  maxGap: number;
};

const STATIONS: Station[] = [
  { id: "patrol-police",    category: "police",    x: 360,  y: 760, sprite: GAME_ASSETS["police.car"],          minGap: 45000, maxGap: 90000 },
  { id: "patrol-firetruck", category: "firetruck", x: 1460, y: 220, sprite: GAME_ASSETS["emergency.firetruck"], minGap: 60000, maxGap: 120000 },
  { id: "patrol-ambulance", category: "ambulance", x: 1100, y: 880, sprite: GAME_ASSETS["emergency.ambulance"], minGap: 55000, maxGap: 110000 },
];

type Patrol = {
  id: number;
  stationId: string;
  category: Category;
  sprite: string;
  pathIdx: number;
  startedAt: number;
  durationMs: number;       // durée totale aller-retour
  approachMs: number;       // fade-in depuis le QG
  returnMs: number;         // fade-out vers le QG
  stationX: number;
  stationY: number;
};

const ALLOWED_PATHS: number[] = (() => {
  const r: number[] = [];
  for (let i = 0; i < ROADS.length; i++) if (!VILLAGE_PATHS.has(i)) r.push(i);
  return r;
})();

export default function EmergencyPatrols() {
  const [patrols, setPatrols] = useState<Patrol[]>([]);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const groupRefs = useRef<Map<number, SVGGElement | null>>(new Map());
  const idSeq = useRef(1);

  // === Planner : chaque station programme sa prochaine sortie. ===
  useEffect(() => {
    const timers: number[] = [];
    const scheduleNext = (s: Station) => {
      const delay = s.minGap + Math.random() * (s.maxGap - s.minGap);
      const t = window.setTimeout(() => {
        // Sortie d'une patrouille
        const pathIdx = ALLOWED_PATHS[Math.floor(Math.random() * ALLOWED_PATHS.length)];
        const approachMs = 1400;
        const returnMs = 1400;
        const cruiseMs = 18000 + Math.random() * 14000; // 18-32s sur le réseau
        const p: Patrol = {
          id: idSeq.current++,
          stationId: s.id,
          category: s.category,
          sprite: s.sprite,
          pathIdx,
          startedAt: performance.now(),
          durationMs: approachMs + cruiseMs + returnMs,
          approachMs,
          returnMs,
          stationX: s.x,
          stationY: s.y,
        };
        setPatrols(prev => [...prev, p]);
        // retire la patrouille à la fin
        window.setTimeout(() => {
          setPatrols(prev => prev.filter(pp => pp.id !== p.id));
        }, p.durationMs + 200);
        scheduleNext(s);
      }, delay);
      timers.push(t);
    };
    // Démarrage échelonné pour éviter trois sorties simultanées
    STATIONS.forEach((s, i) => {
      const initial = window.setTimeout(() => scheduleNext(s), 8000 + i * 6000);
      timers.push(initial);
    });
    return () => { timers.forEach(t => window.clearTimeout(t)); };
  }, []);

  // === Animation : déplace chaque sprite le long du path choisi. ===
  useEffect(() => {
    if (patrols.length === 0) return;
    let raf = 0;
    const step = () => {
      const now = performance.now();
      for (const p of patrols) {
        const g = groupRefs.current.get(p.id);
        const path = pathRefs.current[p.pathIdx];
        if (!g || !path) continue;
        const pathLen = path.getTotalLength();
        const elapsed = now - p.startedAt;
        const cruiseMs = p.durationMs - p.approachMs - p.returnMs;

        let x = p.stationX, y = p.stationY, heading = 0;

        if (elapsed < p.approachMs) {
          // Sortie : interpolation linéaire QG -> entrée du path
          const t = elapsed / p.approachMs;
          const pt = path.getPointAtLength(0);
          x = p.stationX + (pt.x - p.stationX) * t;
          y = p.stationY + (pt.y - p.stationY) * t;
          const pt2 = path.getPointAtLength(Math.min(pathLen, 4));
          heading = Math.atan2(pt2.y - pt.y, pt2.x - pt.x);
        } else if (elapsed < p.approachMs + cruiseMs) {
          // Aller-retour le long du path (triangle 0 -> 1 -> 0)
          const u = (elapsed - p.approachMs) / cruiseMs; // 0..1
          const tri = u < 0.5 ? (u * 2) : (1 - (u - 0.5) * 2);
          const s = tri * pathLen;
          const dir = u < 0.5 ? 1 : -1;
          const pt = path.getPointAtLength(s);
          const pt2 = path.getPointAtLength(Math.max(0, Math.min(pathLen, s + dir * 4)));
          x = pt.x; y = pt.y;
          heading = Math.atan2(pt2.y - pt.y, pt2.x - pt.x);
        } else {
          // Retour : sortie path -> QG
          const t = Math.min(1, (elapsed - p.approachMs - cruiseMs) / p.returnMs);
          const pt = path.getPointAtLength(0);
          x = pt.x + (p.stationX - pt.x) * t;
          y = pt.y + (p.stationY - pt.y) * t;
          heading = Math.atan2(p.stationY - pt.y, p.stationX - pt.x);
        }

        // Le sprite a son "nez" vers le haut → +90° pour aligner sur le mouvement.
        const deg = (heading * 180) / Math.PI + 90;
        g.setAttribute("transform", `translate(${x} ${y}) rotate(${deg})`);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [patrols]);

  return (
    <>
      <style>{`
        @keyframes jce-patrol-gyro-blue {
          0%,100% { fill: #1e40af; }
          50%     { fill: #ef4444; }
        }
        @keyframes jce-patrol-gyro-red {
          0%,100% { fill: #b91c1c; }
          50%     { fill: #1e40af; }
        }
      `}</style>
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          zIndex: 5, pointerEvents: "none",
        }}
        aria-hidden
      >
        {/* Paths invisibles, partagés avec CityTraffic pour suivre exactement le bitume */}
        <defs>
          {ROADS.map((d, i) => (
            <path
              key={i}
              ref={el => { pathRefs.current[i] = el; }}
              d={d}
            />
          ))}
        </defs>

        {patrols.map(p => (
          <g
            key={p.id}
            ref={el => {
              if (el) groupRefs.current.set(p.id, el);
              else groupRefs.current.delete(p.id);
            }}
          >
            <image
              href={p.sprite}
              x={-22} y={-14}
              width={44} height={28}
              preserveAspectRatio="xMidYMid meet"
            />
            {/* Gyrophare clignotant */}
            <circle
              cx={0} cy={-2} r={3.2}
              style={{
                animation: `${p.category === "firetruck" ? "jce-patrol-gyro-red" : "jce-patrol-gyro-blue"} 0.45s linear infinite`,
              }}
            />
          </g>
        ))}
      </svg>
    </>
  );
}
