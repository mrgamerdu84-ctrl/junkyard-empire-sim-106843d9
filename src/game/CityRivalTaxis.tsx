// =============================================================
// Taxis rivaux qui circulent sur la map, aux couleurs des QG concurrents.
// Lit la liste des concurrents publiée par CityCompetitors via
// `window.__jceCompetitors` + l'event "jce:competitors-changed".
// Réutilise les ROADS de CityTraffic pour rester aligné sur les routes.
// Animation propre (pas de couplage avec la boucle CityTraffic) :
// simple progression linéaire avec lane offset, fade-out à la faillite.
// =============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { ROADS, VILLAGE_PATHS } from "./CityTraffic";

// Routes utilisables par les taxis rivaux : on exclut les "village paths"
// (ex: index 1, off-screen en portrait) pour ne pas voir des voitures voler.
const RIVAL_ROAD_IDX = ROADS.map((_, i) => i).filter((i) => !VILLAGE_PATHS.has(i));

type Competitor = {
  id: string;
  name: string;
  color: string;
  bankrupt: boolean;
  vehicleUrl?: string;
};

type RivalSpec = {
  compId: string;
  color: string;
  pathIdx: number;
  flip: boolean;
  duration: number; // s pour parcourir le path
  offset: number;   // 0..1 décalage initial le long du path
  letter: string;
  vehicleUrl?: string;
};

const LANE_HALF = 9;
const MAX_RIVALS = 10;

function buildSpecs(comps: Competitor[]): RivalSpec[] {
  const alive = comps.filter((c) => !c.bankrupt);
  if (alive.length === 0) return [];
  const out: RivalSpec[] = [];
  const perComp = Math.max(1, Math.min(2, Math.floor(MAX_RIVALS / Math.max(1, alive.length))));
  let i = 0;
  for (const c of alive) {
    for (let k = 0; k < perComp && out.length < MAX_RIVALS; k++) {
      out.push({
        compId: c.id,
        color: c.color,
        pathIdx: RIVAL_ROAD_IDX[i % RIVAL_ROAD_IDX.length] ?? 0,
        flip: (i % 2) === 1,
        duration: 16 + ((i * 3) % 7),
        offset: ((i * 0.137) + k * 0.41) % 1,
        letter: (c.name?.[0] ?? "?").toUpperCase(),
        vehicleUrl: c.vehicleUrl,
      });
      i++;
    }
  }
  return out;
}

export default function CityRivalTaxis() {
  const [comps, setComps] = useState<Competitor[]>(() => {
    const w = window as unknown as { __jceCompetitors?: Competitor[] };
    return w.__jceCompetitors ?? [];
  });

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<Competitor[]>).detail;
      if (Array.isArray(detail)) setComps(detail);
    };
    window.addEventListener("jce:competitors-changed", onChange as EventListener);
    return () => window.removeEventListener("jce:competitors-changed", onChange as EventListener);
  }, []);

  const specs = useMemo(() => buildSpecs(comps), [comps]);

  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const carRefs = useRef<(SVGGElement | null)[]>([]);

  useEffect(() => {
    const lens = pathRefs.current.map((p) => (p ? p.getTotalLength() : 0));
    if (lens.some((l) => l <= 1)) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const tSec = (now - t0) / 1000;
      for (let i = 0; i < specs.length; i++) {
        const sp = specs[i];
        const node = carRefs.current[i];
        const path = pathRefs.current[sp.pathIdx];
        if (!node || !path) continue;
        const len = lens[sp.pathIdx];
        const u = ((tSec / sp.duration) + sp.offset) % 1;
        const fwd = sp.flip ? len * (1 - u) : len * u;
        const p = path.getPointAtLength(fwd);
        const p2 = path.getPointAtLength(Math.min(len, fwd + (sp.flip ? -1 : 1)));
        const tdx = p2.x - p.x, tdy = p2.y - p.y;
        const L = Math.hypot(tdx, tdy) || 1;
        const ang = (Math.atan2(tdy, tdx) * 180) / Math.PI;
        // Lane offset : voiture qui descend (flip=false) à droite, qui monte à gauche.
        const laneSign = sp.flip ? -1 : 1;
        const ox = (-tdy / L) * LANE_HALF * laneSign;
        const oy = (tdx / L) * LANE_HALF * laneSign;
        node.setAttribute(
          "transform",
          `translate(${(p.x + ox).toFixed(2)},${(p.y + oy).toFixed(2)}) rotate(${ang.toFixed(2)})`,
        );
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [specs]);

  return (
    <svg
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 4 }}
    >
      <defs>
        {ROADS.map((d, i) => (
          <path
            key={i}
            id={`jce-rival-road-${i}`}
            d={d}
            ref={(el) => { pathRefs.current[i] = el; }}
            fill="none"
            stroke="none"
          />
        ))}
      </defs>
      {specs.map((sp, i) => (
        <g
          key={`${sp.compId}-${i}`}
          ref={(el) => { carRefs.current[i] = el; }}
          opacity="0.95"
        >
          {/* Ombre compacte au sol, alignée avec l'angle de marche (axe X). */}
          <ellipse cx="0" cy="0" rx="9" ry="3" fill="rgba(0,0,0,0.35)" />
          {sp.vehicleUrl ? (
            <>
              {/* Sprite custom uploadé : nez vers le haut dans la source → rotate(90) pour aligner sur l'axe de marche (X+). */}
              <g transform="rotate(90)">
                <image href={sp.vehicleUrl} x="-14" y="-17" width="28" height="34" preserveAspectRatio="xMidYMid meet" />
              </g>
              {/* pastille couleur (en haut de la voiture, après rotation) */}
              <circle cx="10" cy="-7" r="2.8" fill={sp.color} stroke="#0b0d10" strokeWidth="0.8" />
            </>
          ) : (
            <>
              {/* Sprite SVG par défaut : dessiné nez vers la droite (axe X+) directement. */}
              <g transform="rotate(90)">
                <rect x="-8" y="-14" width="16" height="28" rx="4" fill={sp.color} stroke="#0b0d10" strokeWidth="1.5" />
                {/* damier toit */}
                <rect x="-7" y="-4" width="14" height="5" fill="#fff" />
                <rect x="-7" y="-4" width="2.5" height="2.5" fill="#0b0d10" />
                <rect x="-2" y="-4" width="2.5" height="2.5" fill="#0b0d10" />
                <rect x="3" y="-4" width="2.5" height="2.5" fill="#0b0d10" />
                <rect x="-4.5" y="-1.5" width="2.5" height="2.5" fill="#0b0d10" />
                <rect x="0.5" y="-1.5" width="2.5" height="2.5" fill="#0b0d10" />
                {/* pare-brises */}
                <rect x="-6" y="-12" width="12" height="5" rx="1.2" fill="rgba(15,23,42,0.7)" />
                <rect x="-6" y="7" width="12" height="5" rx="1.2" fill="rgba(15,23,42,0.7)" />
                {/* phares à l'avant (nez à droite après rotation = bas du sprite) */}
                <circle cx="-5.5" cy="-13" r="1.2" fill="#fde047" />
                <circle cx="5.5" cy="-13" r="1.2" fill="#fde047" />
                {/* badge initiale */}
                <circle cx="0" cy="3" r="3" fill={sp.color} stroke="#0b0d10" strokeWidth="0.8" />
                <text x="0" y="5.2" textAnchor="middle" fontSize="5" fontWeight="900"
                  fill="#0b0d10" fontFamily="system-ui, sans-serif">
                  {sp.letter}
                </text>
              </g>
            </>
          )}
        </g>
      ))}
    </svg>
  );
}
