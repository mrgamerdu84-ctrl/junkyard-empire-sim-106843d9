export type RoadPoint = {
  x: number;
  y: number;
  angle: number;
  nx: number;
  ny: number;
};

export type CachedRoad = {
  length: number;
  points: RoadPoint[];
};

const roadCache: CachedRoad[] = [];

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function clearRoadCache() {
  roadCache.length = 0;
}

export function buildRoadCache(paths: SVGPathElement[], samples = 420): CachedRoad[] {
  clearRoadCache();
  for (const path of paths) {
    const total = path.getTotalLength();
    const points: RoadPoint[] = [];
    if (!Number.isFinite(total) || total <= 1) {
      roadCache.push({ length: 0, points });
      continue;
    }
    for (let i = 0; i <= samples; i++) {
      const dist = (i / samples) * total;
      const p = path.getPointAtLength(dist);
      const p2 = path.getPointAtLength(Math.min(total, dist + 2));
      const dx = p2.x - p.x;
      const dy = p2.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      points.push({
        x: p.x,
        y: p.y,
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
        nx: -dy / len,
        ny: dx / len,
      });
    }
    roadCache.push({ length: total, points });
  }
  return roadCache;
}

export function getRoad(index: number): CachedRoad | undefined {
  return roadCache[index];
}

export function getRoadPoint(pathIdx: number, progress: number, laneOffset = 0): RoadPoint | undefined {
  const road = getRoad(pathIdx);
  if (!road || road.points.length === 0) return undefined;
  const idx = Math.min(
    road.points.length - 1,
    Math.max(0, Math.floor(clamp01(progress) * (road.points.length - 1))),
  );
  const pt = road.points[idx];
  return {
    x: pt.x + pt.nx * laneOffset,
    y: pt.y + pt.ny * laneOffset,
    angle: pt.angle,
    nx: pt.nx,
    ny: pt.ny,
  };
}

export function hasRoadCache(): boolean {
  return roadCache.length > 0 && roadCache.some((road) => road.points.length > 0);
}
