// =============================================================
// Étape 3 — Flics en civil
// Piétons discrets qui patrouillent sur les trottoirs (mêmes
// ROADS que CityTraffic, avec offset latéral). Sprite = piéton
// homme existant (GAME_ASSETS["pedestrian.man"]), avec un badge
// SVG discret superposé — aucun nouveau modèle ajouté.
//
// Trajectoires :
//   - chaque flic en civil suit un path (ROADS), aller-retour
//     en continu sur le trottoir (offset perpendiculaire).
//   - vitesse marche réaliste (16-22 px/s).
// =============================================================
import { useEffect, useRef } from "react";
import { ROADS, VILLAGE_PATHS } from "./CityTraffic";
import { GAME_ASSETS } from "./gameAssets";

type Cop = {
  pathIdx: number;
  side: 1 | -1;
  speed: number;     // px/s
  startFrac: number; // 0..1
  scale: number;
};

const ALLOWED_PATHS: number[] = (() => {
  const r: number[] = [];
  for (let i = 0; i < ROADS.length; i++) if (!VILLAGE_PATHS.has(i)) r.push(i);
  return r;
})();

const COPS: Cop[] = [
  { pathIdx: ALLOWED_PATHS[0],                                  side:  1, speed: 18, startFrac: 0.15, scale: 0.55 },
  { pathIdx: ALLOWED_PATHS[Math.min(1, ALLOWED_PATHS.length-1)], side: -1, speed: 20, startFrac: 0.65, scale: 0.55 },
];

const SIDEWALK_OFFSET = 30;

export default function PlainclothesCops() {
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const nodeRefs = useRef<(SVGGElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    type State = { s: number; dir: 1 | -1; len: number };
    const states: State[] = COPS.map(c => {
      const path = pathRefs.current[c.pathIdx];
      const len = path ? path.getTotalLength() : 1000;
      return { s: c.startFrac * len, dir: 1, len };
    });

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      for (let i = 0; i < COPS.length; i++) {
        const cop = COPS[i];
        const st = states[i];
        const path = pathRefs.current[cop.pathIdx];
        const node = nodeRefs.current[i];
        if (!path || !node) continue;
        st.s += st.dir * cop.speed * dt;
        if (st.s >= st.len) { st.s = st.len; st.dir = -1; }
        if (st.s <= 0) { st.s = 0; st.dir = 1; }
        const p = path.getPointAtLength(st.s);
        const p2 = path.getPointAtLength(Math.max(0, Math.min(st.len, st.s + st.dir * 2)));
        const dx = p2.x - p.x, dy = p2.y - p.y;
        const L = Math.hypot(dx, dy) || 1;
        const nx = -dy / L * SIDEWALK_OFFSET * cop.side;
        const ny =  dx / L * SIDEWALK_OFFSET * cop.side;
        const x = p.x + nx, y = p.y + ny;
        node.setAttribute("transform", `translate(${x} ${y})`);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        zIndex: 5, pointerEvents: "none",
      }}
      aria-hidden
    >
      <defs>
        {ROADS.map((d, i) => (
          <path key={i} ref={el => { pathRefs.current[i] = el; }} d={d} />
        ))}
      </defs>
      {COPS.map((c, i) => (
        <g key={i} ref={el => { nodeRefs.current[i] = el; }}>
          <image
            href={GAME_ASSETS["pedestrian.man"]}
            x={-10} y={-14}
            width={20} height={28}
            preserveAspectRatio="xMidYMid meet"
            style={{ transform: `scale(${c.scale})`, transformOrigin: "center" }}
          />
          {/* Badge discret accroché à la ceinture */}
          <g transform="translate(6 4)">
            <circle r={2.6} fill="#facc15" stroke="#1f2937" strokeWidth={0.6} />
            <text
              x={0} y={0.9}
              textAnchor="middle"
              fontSize={2.6}
              fontWeight={900}
              fill="#1f2937"
              style={{ font: "900 2.6px ui-sans-serif, system-ui" }}
            >★</text>
          </g>
        </g>
      ))}
    </svg>
  );
}
