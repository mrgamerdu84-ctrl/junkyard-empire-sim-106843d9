// =============================================================
// Taxis rivaux qui circulent sur la map, aux couleurs des QG concurrents.
// Lit la liste des concurrents publiée par CityCompetitors via
// `window.__jceCompetitors` + l'event "jce:competitors-changed".
// Réutilise les ROADS de CityTraffic pour rester aligné sur les routes.
// Animation propre (pas de couplage avec la boucle CityTraffic) :
// simple progression linéaire avec lane offset, fade-out à la faillite.
// =============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { ROADS } from "./CityTraffic";

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

const LANE_HALF = 11;
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
        pathIdx: i % ROADS.length,
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
        const ox = (-tdy / L) * LANE_HALF;
        const oy = (tdx / L) * LANE_HALF;
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
          {/* Sprite taxi vu du dessus, nez vers la droite (rotate angle = direction marche) */}
          <g transform="rotate(-90)">
            {sp.vehicleUrl ? (
              <>
                {/* ombre */}
                <ellipse cx="0" cy="2" rx="14" ry="5" fill="rgba(0,0,0,0.45)" />
                {/* image personnalisée du concurrent (nez vers le haut dans le sprite) */}
                <image href={sp.vehicleUrl} x="-16" y="-20" width="32" height="40" preserveAspectRatio="xMidYMid meet" />
                {/* pastille couleur pour distinguer */}
                <circle cx="11" cy="-14" r="3.5" fill={sp.color} stroke="#0b0d10" strokeWidth="0.8" />
              </>
            ) : (
              <>
                {/* ombre */}
                <ellipse cx="0" cy="2" rx="13" ry="5" fill="rgba(0,0,0,0.45)" />
                {/* carrosserie */}
                <rect x="-10" y="-16" width="20" height="32" rx="4" fill={sp.color} stroke="#0b0d10" strokeWidth="1.5" />
                {/* damier toit */}
                <rect x="-9" y="-6" width="18" height="6" fill="#fff" />
                <rect x="-9" y="-6" width="3" height="3" fill="#0b0d10" />
                <rect x="-3" y="-6" width="3" height="3" fill="#0b0d10" />
                <rect x="3" y="-6" width="3" height="3" fill="#0b0d10" />
                <rect x="-6" y="-3" width="3" height="3" fill="#0b0d10" />
                <rect x="0" y="-3" width="3" height="3" fill="#0b0d10" />
                <rect x="6" y="-3" width="3" height="3" fill="#0b0d10" />
                {/* pare-brises */}
                <rect x="-8" y="-14" width="16" height="6" rx="1.5" fill="rgba(15,23,42,0.7)" />
                <rect x="-8" y="8" width="16" height="6" rx="1.5" fill="rgba(15,23,42,0.7)" />
                {/* phares */}
                <circle cx="-7" cy="-15" r="1.4" fill="#fde047" />
                <circle cx="7" cy="-15" r="1.4" fill="#fde047" />
                {/* badge couleur concurrent */}
                <circle cx="0" cy="3" r="3" fill={sp.color} stroke="#0b0d10" strokeWidth="0.8" />
                <text x="0" y="5.5" textAnchor="middle" fontSize="5" fontWeight="900"
                  fill="#0b0d10" fontFamily="system-ui, sans-serif">
                  {sp.letter}
                </text>
              </>
            )}
          </g>
        </g>
      ))}
    </svg>
  );
}
