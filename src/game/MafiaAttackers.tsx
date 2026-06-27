// =============================================================
// MAFIA — Les familles mafia (configurées dans le panel admin)
// envoient des voitures saboter les taxis du joueur pendant leurs
// courses. Les mafieux suivent strictement le réseau routier
// (mêmes paths SVG que le trafic civil).
//
// Skins :
//  - Si une famille mafia a un `vehicleUrl` configuré → on l'utilise
//    tel quel (pas de teinte noire).
//  - Sinon, on prend un sprite de voiture civile du jeu et on le
//    teinte en noir (filtre SVG `mafia-black`).
//
// Le joueur doit TAPER chaque voiture mafia pour la stopper net /
// la faire exploser et protéger son taxi. +100 $ par mafieux.
// =============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { getCivilCarUrls } from "./gameAssets";
import { ROADS, VILLAGE_PATHS } from "./CityTraffic";
import { VEHICLE_SIZE } from "./TaxiTycoon";

type PlayerTaxi = { id: number; x: number; y: number; onMission: boolean };
type CompetitorLite = {
  id: string;
  name?: string;
  vehicleUrl?: string;
  color?: string;
};

type Mafia = {
  id: number;
  sprite: string;
  tinted: boolean;
  pathIdx: number;
  pathLen: number;
  t: number;
  dir: 1 | -1;
  speed: number;
  x: number;
  y: number;
  angle: number;
  targetTaxiId: number | null;
  state: "hunt" | "exploding";
  explodedAt?: number;
};

const REWARD = 100;
const MAP_W = 1920;
const MAP_H = 1080;
const SPAWN_INTERVAL_MS = 7000;
const MAX_CARS = 4;
const EXPLOSION_MS = 900;

function getPlayerTaxis(): PlayerTaxi[] {
  const w = window as unknown as { __jcePlayerTaxis?: PlayerTaxi[] };
  return Array.isArray(w.__jcePlayerTaxis) ? w.__jcePlayerTaxis : [];
}

function getMafiaFamilies(): CompetitorLite[] {
  const w = window as unknown as { __jceCompetitors?: CompetitorLite[] };
  return Array.isArray(w.__jceCompetitors) ? w.__jceCompetitors : [];
}

function buildPathEls(): SVGPathElement[] {
  const ns = "http://www.w3.org/2000/svg";
  const out: SVGPathElement[] = [];
  for (let i = 0; i < ROADS.length; i++) {
    if (VILLAGE_PATHS.has(i)) continue;
    try {
      const p = document.createElementNS(ns, "path");
      p.setAttribute("d", ROADS[i]);
      // touche getTotalLength pour vérifier que le path est valide
      if (p.getTotalLength() > 0) out.push(p);
    } catch {
      /* path invalide, on ignore */
    }
  }
  return out;
}

// Trouve l'index du path dont un point est le plus proche d'une cible,
// + la distance le long du path du point le plus proche.
// Échantillonnage léger pour éviter les pics CPU.
function nearestOnPath(
  paths: SVGPathElement[],
  lens: number[],
  tx: number,
  ty: number,
): { idx: number; t: number } {
  let bestIdx = 0;
  let bestT = 0;
  let bestD = Infinity;
  const STEPS = 24;
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    const len = lens[i];
    for (let s = 0; s <= STEPS; s++) {
      const t = (s / STEPS) * len;
      const pt = p.getPointAtLength(t);
      const dx = pt.x - tx;
      const dy = pt.y - ty;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
        bestT = t;
      }
    }
  }
  return { idx: bestIdx, t: bestT };
}

export default function MafiaAttackers() {
  const [, setTick] = useState(0);
  const carsRef = useRef<Mafia[]>([]);
  const idRef = useRef(0);
  const lastSpawn = useRef(0);
  const startedAt = useRef(Date.now());
  const pathEls = useMemo(() => buildPathEls(), []);
  const pathLens = useMemo(() => pathEls.map((p) => p.getTotalLength()), [pathEls]);

  useEffect(() => {
    if (pathEls.length === 0) return;
    let raf = 0;
    let last = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      frame++;

      const taxis = getPlayerTaxis();
      const onMission = taxis.filter((t) => t.onMission);

      const minutes = (Date.now() - startedAt.current) / 60000;
      const spawnEvery = Math.max(3500, SPAWN_INTERVAL_MS - minutes * 500);

      // Spawn uniquement quand un taxi joueur est en course.
      if (
        onMission.length > 0 &&
        carsRef.current.filter((c) => c.state === "hunt").length < MAX_CARS &&
        now - lastSpawn.current > spawnEvery
      ) {
        lastSpawn.current = now;
        const target = onMission[Math.floor(Math.random() * onMission.length)];
        const near = nearestOnPath(pathEls, pathLens, target.x, target.y);
        const pathIdx = near.idx;
        const len = pathLens[pathIdx];
        const offset = (300 + Math.random() * 300) * (Math.random() < 0.5 ? -1 : 1);
        let startT = near.t + offset;
        if (startT < 0) startT += len;
        if (startT > len) startT -= len;
        startT = Math.max(0, Math.min(len, startT));
        const dir: 1 | -1 = offset >= 0 ? -1 : 1;

        // Choix du sprite : priorité aux familles mafia avec vehicleUrl,
        // sinon sprite civil teinté en noir.
        const families = getMafiaFamilies();
        const withSprite = families.filter((f) => f && typeof f.vehicleUrl === "string" && f.vehicleUrl.length > 0);
        let sprite = "";
        let tinted = true;
        if (withSprite.length > 0) {
          sprite = withSprite[Math.floor(Math.random() * withSprite.length)].vehicleUrl!;
          tinted = false;
        } else {
          const urls = getCivilCarUrls();
          sprite = urls.length ? urls[Math.floor(Math.random() * urls.length)] : "";
          tinted = true;
        }

        let pt: { x: number; y: number };
        try {
          pt = pathEls[pathIdx].getPointAtLength(startT);
        } catch {
          return;
        }
        const mafia: Mafia = {
          id: ++idRef.current,
          sprite,
          tinted,
          pathIdx,
          pathLen: len,
          t: startT,
          dir,
          speed: 130 + Math.random() * 60 + minutes * 8,
          x: pt.x,
          y: pt.y,
          angle: 0,
          targetTaxiId: target.id,
          state: "hunt",
        };
        carsRef.current = [...carsRef.current, mafia];
      }

      // Avance chaque voiture le long de SA route.
      let changed = false;
      const next: Mafia[] = [];
      for (const c of carsRef.current) {
        if (c.state === "exploding") {
          if (now - (c.explodedAt ?? now) < EXPLOSION_MS) next.push(c);
          else changed = true;
          continue;
        }
        const p = pathEls[c.pathIdx];
        if (!p) { changed = true; continue; }
        const len = c.pathLen;
        let nt = c.t + c.dir * c.speed * dt;

        if (nt < 0 || nt > len) {
          const tgt = taxis.find((t) => t.id === c.targetTaxiId) ?? taxis[0];
          if (!tgt) { changed = true; continue; }
          const near = nearestOnPath(pathEls, pathLens, tgt.x, tgt.y);
          const newPath = near.idx;
          const newLen = pathLens[newPath];
          const startT = Math.max(0, Math.min(newLen, near.t));
          const newDir: 1 | -1 = startT < newLen / 2 ? 1 : -1;
          try {
            const pt = pathEls[newPath].getPointAtLength(startT);
            const a0 = pathEls[newPath].getPointAtLength(
              Math.max(0, Math.min(newLen, startT + newDir * 4)),
            );
            const angle = (Math.atan2(a0.y - pt.y, a0.x - pt.x) * 180) / Math.PI;
            next.push({
              ...c,
              pathIdx: newPath,
              pathLen: newLen,
              t: startT,
              dir: newDir,
              x: pt.x,
              y: pt.y,
              angle,
            });
          } catch {
            // path foireux, on retire la voiture
          }
          changed = true;
          continue;
        }

        try {
          const pt = p.getPointAtLength(nt);
          const ahead = p.getPointAtLength(
            Math.max(0, Math.min(len, nt + c.dir * 4)),
          );
          const angle = (Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180) / Math.PI;
          next.push({ ...c, t: nt, x: pt.x, y: pt.y, angle });
        } catch {
          changed = true;
          continue;
        }
      }
      carsRef.current = next;
      // Limite les re-renders : 1 frame sur 2, ou si le set a changé.
      if (changed || frame % 2 === 0) setTick((n) => (n + 1) & 0xffff);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pathEls, pathLens]);

  const explode = (id: number) => {
    const t = performance.now();
    carsRef.current = carsRef.current.map((c) =>
      c.id === id && c.state === "hunt" ? { ...c, state: "exploding", explodedAt: t } : c,
    );
    setTick((n) => (n + 1) & 0xffff);
    window.dispatchEvent(
      new CustomEvent("jce.player.cashDelta", { detail: { amount: REWARD } }),
    );
  };

  const cars = carsRef.current;
  const S = VEHICLE_SIZE; // taille uniforme avec tous les autres véhicules

  return (
    <svg
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 6 }}
    >
      <defs>
        <filter id="mafia-black">
          <feColorMatrix
            type="matrix"
            values="0.10 0 0 0 0
                    0 0.10 0 0 0
                    0 0 0.12 0 0
                    0 0 0 1 0"
          />
        </filter>
      </defs>

      {cars.map((c) => {
        if (c.state === "exploding") {
          const age = (performance.now() - (c.explodedAt ?? 0)) / EXPLOSION_MS;
          const r = 22 + age * 95;
          const op = 1 - age;
          return (
            <g key={c.id} transform={`translate(${c.x},${c.y})`} pointerEvents="none">
              <circle r={r * 1.2} fill="none" stroke="rgba(255,200,80,0.7)" strokeWidth={3} opacity={op} />
              <circle r={r} fill="rgba(255,170,40,0.7)" opacity={op} />
              <circle r={r * 0.7} fill="rgba(255,90,30,0.9)" opacity={op} />
              <circle r={r * 0.35} fill="rgba(255,240,180,0.95)" opacity={op} />
              <text y={-r - 6} textAnchor="middle" fontSize={30} fontWeight={900}
                fill="#fde047" stroke="#1a1306" strokeWidth={1.6} opacity={op}>
                +{REWARD}$
              </text>
            </g>
          );
        }
        return (
          <g
            key={c.id}
            transform={`translate(${c.x},${c.y}) rotate(${c.angle})`}
            style={{ pointerEvents: "auto", cursor: "pointer" }}
            onClick={(e) => { e.stopPropagation(); explode(c.id); }}
            onTouchStart={(e) => { e.preventDefault(); explode(c.id); }}
          >
            {/* zone de tap confortable */}
            <rect x={-S * 0.7} y={-S * 0.7} width={S * 1.4} height={S * 1.4} fill="transparent" />
            <ellipse cx={0} cy={S * 0.04} rx={S * 0.34} ry={S * 0.07} fill="rgba(0,0,0,0.5)" />
            <g transform="rotate(90)">
              {c.sprite ? (
                <image
                  href={c.sprite}
                  x={-S / 2}
                  y={-S / 2}
                  width={S}
                  height={S}
                  preserveAspectRatio="xMidYMid meet"
                  filter={c.tinted ? "url(#mafia-black)" : undefined}
                />
              ) : (
                <rect x={-S / 2} y={-S / 2} width={S} height={S} rx={6} fill="#0a0a0a" />
              )}
            </g>
            <circle r={5} fill="rgba(0,0,0,0.75)" />
            <text y={2} textAnchor="middle" fontSize={7} fontWeight={900} fill="#dc2626">M</text>
          </g>
        );
      })}
    </svg>
  );
}
