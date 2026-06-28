import { useEffect, useMemo, useRef } from "react";
import { getCivilCarUrls, getPedestrianPhotoUrls } from "./gameAssets";
import { targetFps, trafficBudget } from "@/lib/perf";

export const ROADS = [
  "M 80 300 C 430 255 760 270 1040 320 C 1320 370 1580 355 1840 300",
  "M 300 80 C 340 300 330 560 300 1000",
  "M 1620 90 C 1570 300 1585 640 1630 1000",
  "M 90 720 C 420 690 780 720 1100 760 C 1380 795 1600 770 1840 720",
  "M 520 160 C 720 320 820 520 760 760 C 720 900 610 985 460 1020",
  "M 1280 150 C 1180 330 1130 540 1180 760 C 1220 900 1350 990 1500 1020",
];

export const VILLAGE_PATHS = new Set<number>();
export const SIDEWALK_OFFSET = 34;
export const SIDEWALK_LOCK_OFFSET = SIDEWALK_OFFSET;

export function lockToSidewalk(
  _roadPoint: { x: number; y: number },
  tangent: { dx: number; dy: number },
  side: 1 | -1,
  x: number,
  y: number,
): { x: number; y: number } {
  const len = Math.hypot(tangent.dx, tangent.dy) || 1;
  const nx = -tangent.dy / len;
  const ny = tangent.dx / len;
  return { x: x + nx * side * 2, y: y + ny * side * 2 };
}

type Car = { id: number; pathIdx: number; pos: number; speed: number; dir: 1 | -1; url: string };
type Ped = { id: number; pathIdx: number; pos: number; speed: number; side: 1 | -1; url?: string };

const MAP_W = 1920;
const MAP_H = 1080;
const LANE_HALF = 11;

function makePath(d: string): SVGPathElement | null {
  try {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    return p.getTotalLength() > 1 ? p : null;
  } catch {
    return null;
  }
}

function at(path: SVGPathElement, s: number, forward: boolean, offset: number) {
  const len = path.getTotalLength();
  const safe = ((s % len) + len) % len;
  const p = path.getPointAtLength(safe);
  const p2 = path.getPointAtLength(Math.max(0, Math.min(len, safe + (forward ? 8 : -8))));
  let dx = p2.x - p.x;
  let dy = p2.y - p.y;
  if (!forward) { dx = -dx; dy = -dy; }
  const m = Math.hypot(dx, dy) || 1;
  return {
    x: p.x + (-dy / m) * offset,
    y: p.y + (dx / m) * offset,
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}

export default function CityTraffic() {
  const carRefs = useRef<Map<number, SVGGElement>>(new Map());
  const pedRefs = useRef<Map<number, SVGGElement>>(new Map());
  const paths = useMemo(() => ROADS.map(makePath).filter((p): p is SVGPathElement => Boolean(p)), []);

  const cars = useMemo<Car[]>(() => {
    const urls = getCivilCarUrls();
    if (!paths.length || !urls.length) return [];
    const count = Math.max(6, trafficBudget(16));
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      pathIdx: i % paths.length,
      pos: paths[i % paths.length].getTotalLength() * ((i * 0.37) % 1),
      speed: 45 + (i % 5) * 10,
      dir: i % 2 === 0 ? 1 : -1,
      url: urls[i % urls.length],
    }));
  }, [paths]);

  const peds = useMemo<Ped[]>(() => {
    const photos = getPedestrianPhotoUrls();
    if (!paths.length) return [];
    return Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      pathIdx: i % paths.length,
      pos: paths[i % paths.length].getTotalLength() * ((i * 0.51) % 1),
      speed: 10 + (i % 4) * 3,
      side: i % 2 === 0 ? 1 : -1,
      url: photos.length ? photos[i % photos.length] : undefined,
    }));
  }, [paths]);

  useEffect(() => {
    if (!paths.length) return;
    let raf = 0;
    let last = performance.now();
    const minFrame = 1000 / Math.max(24, targetFps());
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < minFrame) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      for (const car of cars) {
        const path = paths[car.pathIdx];
        const node = carRefs.current.get(car.id);
        if (!path || !node) continue;
        car.pos += car.dir * car.speed * dt;
        const p = at(path, car.pos, car.dir === 1, car.dir === 1 ? LANE_HALF : -LANE_HALF);
        node.setAttribute("transform", `translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) rotate(${p.angle.toFixed(1)})`);
      }
      for (const ped of peds) {
        const path = paths[ped.pathIdx];
        const node = pedRefs.current.get(ped.id);
        if (!path || !node) continue;
        ped.pos += ped.speed * dt;
        const p = at(path, ped.pos, true, SIDEWALK_OFFSET * ped.side);
        node.setAttribute("transform", `translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) rotate(${p.angle.toFixed(1)})`);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paths, cars, peds]);

  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 3 }}>
      {cars.map((car) => (
        <g key={car.id} ref={(el) => { if (el) carRefs.current.set(car.id, el); else carRefs.current.delete(car.id); }} opacity="0.94">
          <ellipse cx="0" cy="3" rx="12" ry="4" fill="rgba(0,0,0,0.35)" />
          <g transform="rotate(90)"><image href={car.url} x="-17" y="-17" width="34" height="34" preserveAspectRatio="xMidYMid meet" /></g>
        </g>
      ))}
      {peds.map((ped) => (
        <g key={ped.id} ref={(el) => { if (el) pedRefs.current.set(ped.id, el); else pedRefs.current.delete(ped.id); }}>
          <ellipse cx="0" cy="3" rx="5" ry="2" fill="rgba(0,0,0,0.35)" />
          {ped.url ? <image href={ped.url} x="-10" y="-10" width="20" height="20" preserveAspectRatio="xMidYMid meet" /> : <text x="0" y="4" textAnchor="middle" fontSize="18">🚶</text>}
        </g>
      ))}
    </svg>
  );
}
