import { useEffect, useMemo, useRef } from "react";
import { ROADS, VILLAGE_PATHS } from "./CityTraffic";
import { getCivilCarUrls } from "./gameAssets";
import { targetFps, trafficBudget } from "@/lib/perf";

type Car = {
  id: number;
  pathIdx: number;
  len: number;
  s: number;
  dir: 1 | -1;
  speed: number;
  url: string;
};

const MAP_W = 1920;
const MAP_H = 1080;
const LANE_HALF = 11;
const DEFAULT_COUNT = 22;
const MIN_COUNT = 6;

function createPath(d: string): SVGPathElement | null {
  try {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    if (p.getTotalLength() <= 1) return null;
    return p;
  } catch {
    return null;
  }
}

export default function SimpleCivilTraffic() {
  const groupRefs = useRef<Map<number, SVGGElement>>(new Map());

  const pathData = useMemo(() => {
    return ROADS
      .map((d, idx) => ({ idx, path: createPath(d) }))
      .filter((r): r is { idx: number; path: SVGPathElement } => Boolean(r.path) && !VILLAGE_PATHS.has(r.idx));
  }, []);

  const cars = useMemo<Car[]>(() => {
    const urls = getCivilCarUrls();
    if (urls.length === 0 || pathData.length === 0) return [];
    const count = Math.max(MIN_COUNT, trafficBudget(DEFAULT_COUNT));
    return Array.from({ length: count }).map((_, i) => {
      const road = pathData[i % pathData.length];
      const len = road.path.getTotalLength();
      return {
        id: i + 1,
        pathIdx: road.idx,
        len,
        s: (len * ((i * 0.618) % 1)) || Math.random() * len,
        dir: i % 2 === 0 ? 1 : -1,
        speed: 55 + (i % 5) * 8,
        url: urls[i % urls.length],
      };
    });
  }, [pathData]);

  useEffect(() => {
    if (cars.length === 0 || pathData.length === 0) return;
    const pathByIdx = new Map(pathData.map((r) => [r.idx, r.path]));
    let raf = 0;
    let last = performance.now();
    const minFrame = 1000 / Math.max(15, targetFps());

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < minFrame) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      for (const car of cars) {
        const path = pathByIdx.get(car.pathIdx);
        const node = groupRefs.current.get(car.id);
        if (!path || !node) continue;

        car.s += car.dir * car.speed * dt;
        if (car.s < 0) car.s += car.len;
        if (car.s > car.len) car.s -= car.len;

        const aheadS = Math.max(0, Math.min(car.len, car.s + car.dir * 6));
        const p = path.getPointAtLength(car.s);
        const p2 = path.getPointAtLength(aheadS);
        const dx = p2.x - p.x;
        const dy = p2.y - p.y;
        const mag = Math.hypot(dx, dy) || 1;
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const laneSide = car.dir === 1 ? 1 : -1;
        const ox = (-dy / mag) * LANE_HALF * laneSide;
        const oy = (dx / mag) * LANE_HALF * laneSide;

        node.setAttribute("transform", `translate(${(p.x + ox).toFixed(2)},${(p.y + oy).toFixed(2)}) rotate(${angle.toFixed(2)})`);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cars, pathData]);

  if (cars.length === 0) return null;

  return (
    <svg
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 3.5 }}
    >
      {cars.map((car) => (
        <g
          key={car.id}
          ref={(el) => {
            if (el) groupRefs.current.set(car.id, el);
            else groupRefs.current.delete(car.id);
          }}
          opacity="0.92"
        >
          <ellipse cx="0" cy="3" rx="12" ry="4" fill="rgba(0,0,0,0.35)" />
          <g transform="rotate(90)">
            <image href={car.url} x="-18" y="-18" width="36" height="36" preserveAspectRatio="xMidYMid meet" />
          </g>
        </g>
      ))}
    </svg>
  );
}
