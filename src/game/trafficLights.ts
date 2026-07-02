/* ============================================================
 * Traffic lights & "code de la route" — module partagé
 * Cycle par intersection avec durées configurables + vraie
 * alternance (rouge/vert/jaune) synchronisée entre les axes.
 * ============================================================ */

export type LightState = "green" | "orange" | "red";
export type Axis = 0 | 1;

export type LightStop = {
  pathIdx: number;
  s: number;
  /** Axe (0 ou 1) auquel appartient cette approche.
   *  Les stops du même axe passent au vert en même temps. */
  axis: Axis;
  /** Tangente normalisée du path au point d'arrêt (pour clustering). */
  tx: number;
  ty: number;
};

export type LightCycleConfig = {
  /** Durée du vert pour l'axe 0 (secondes). */
  greenA: number;
  /** Durée du vert pour l'axe 1 (secondes). */
  greenB: number;
  /** Durée de l'orange (identique aux deux axes). */
  yellow: number;
  /** Durée du "tout rouge" de sécurité entre deux phases. */
  allRed: number;
  /** Décalage global du cycle (secondes) pour désynchroniser les intersections. */
  offset: number;
};

export type TrafficLight = {
  id: number;
  x: number;
  y: number;
  cycle: LightCycleConfig;
  stops: LightStop[];
};

const DEFAULT_CYCLE: LightCycleConfig = {
  greenA: 10,
  greenB: 10,
  yellow: 2,
  allRed: 1,
  offset: 0,
};

const STOP_RADIUS = 95;
let computed: { lights: TrafficLight[] } | null = null;

function cycleLength(c: LightCycleConfig): number {
  return c.greenA + c.yellow + c.allRed + c.greenB + c.yellow + c.allRed;
}

/**
 * État d'un axe donné dans le cycle courant.
 * Séquence :
 *   [0, greenA]                      → axe 0 vert   / axe 1 rouge
 *   [greenA, greenA+yellow]          → axe 0 orange / axe 1 rouge
 *   [ +allRed]                       → tout rouge
 *   [greenB]                         → axe 1 vert   / axe 0 rouge
 *   [+yellow]                        → axe 1 orange / axe 0 rouge
 *   [+allRed]                        → tout rouge
 */
export function getLightState(l: TrafficLight, tSeconds: number, axis: Axis = 0): LightState {
  const c = l.cycle;
  const cyc = cycleLength(c);
  const t = (((tSeconds - c.offset) % cyc) + cyc) % cyc;
  const p1 = c.greenA;
  const p2 = p1 + c.yellow;
  const p3 = p2 + c.allRed;
  const p4 = p3 + c.greenB;
  const p5 = p4 + c.yellow;
  if (axis === 0) {
    if (t < p1) return "green";
    if (t < p2) return "orange";
    return "red";
  }
  if (t < p3) return "red";
  if (t < p4) return "green";
  if (t < p5) return "orange";
  return "red";
}

/** Cluster une liste de tangentes en 2 axes par angle (mod 180°). */
function assignAxes(stops: Omit<LightStop, "axis">[]): Axis[] {
  if (stops.length === 0) return [];
  // angles [0, PI)
  const angles = stops.map((s) => {
    let a = Math.atan2(s.ty, s.tx);
    if (a < 0) a += Math.PI;
    if (a >= Math.PI) a -= Math.PI;
    return a;
  });
  // Référence = premier angle. Axe 0 si angle proche, axe 1 sinon.
  const ref = angles[0];
  return angles.map((a) => {
    let d = Math.abs(a - ref);
    if (d > Math.PI / 2) d = Math.PI - d;
    return d < Math.PI / 4 ? 0 : 1;
  });
}

export function computeTrafficLights(
  paths: (SVGPathElement | null)[],
  lens: number[],
): TrafficLight[] {
  const SAMPLE = 8;
  type Sample = { pathIdx: number; s: number; x: number; y: number; tx: number; ty: number };
  const samples: Sample[] = [];
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    const l = lens[i] ?? 0;
    if (!p || l <= 0) continue;
    if (i === 1) continue;
    const n = Math.floor(l / SAMPLE);
    for (let k = 0; k <= n; k++) {
      const s = (k / n) * l;
      const pt = p.getPointAtLength(s);
      const s2 = Math.min(l, s + 1);
      const pt2 = p.getPointAtLength(s2);
      const dx = pt2.x - pt.x, dy = pt2.y - pt.y;
      const L = Math.hypot(dx, dy) || 1;
      samples.push({ pathIdx: i, s, x: pt.x, y: pt.y, tx: dx / L, ty: dy / L });
    }
  }

  const CELL = 28;
  const buckets = new Map<string, Sample[]>();
  for (const s of samples) {
    const k = `${Math.floor(s.x / CELL)},${Math.floor(s.y / CELL)}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(s);
  }

  const lights: TrafficLight[] = [];
  const taken: { x: number; y: number }[] = [];
  let id = 0;
  for (const arr of buckets.values()) {
    const byPath = new Map<number, Sample[]>();
    for (const a of arr) {
      if (!byPath.has(a.pathIdx)) byPath.set(a.pathIdx, []);
      byPath.get(a.pathIdx)!.push(a);
    }
    if (byPath.size < 2) continue;
    let cx = 0, cy = 0, n = 0;
    for (const a of arr) { cx += a.x; cy += a.y; n++; }
    cx /= n; cy /= n;
    if (taken.some(t => (t.x - cx) ** 2 + (t.y - cy) ** 2 < 120 * 120)) continue;
    taken.push({ x: cx, y: cy });

    const rawStops: Omit<LightStop, "axis">[] = [];
    for (const [pIdx, arr2] of byPath.entries()) {
      let best = arr2[0], bestD = Infinity;
      for (const a of arr2) {
        const d = (a.x - cx) ** 2 + (a.y - cy) ** 2;
        if (d < bestD) { bestD = d; best = a; }
      }
      rawStops.push({ pathIdx: pIdx, s: best.s, tx: best.tx, ty: best.ty });
    }
    const axes = assignAxes(rawStops);
    const stops: LightStop[] = rawStops.map((s, i) => ({ ...s, axis: axes[i] }));
    const lid = id++;
    lights.push({
      id: lid,
      x: cx,
      y: cy,
      // Léger décalage par intersection pour désynchroniser visuellement.
      cycle: { ...DEFAULT_CYCLE, offset: (lid * 3.7) % cycleLength(DEFAULT_CYCLE) },
      stops,
    });
  }
  return lights;
}

export function initTrafficLights(paths: (SVGPathElement | null)[], lens: number[]) {
  const lights = computeTrafficLights(paths, lens);
  // Ré-applique les overrides éventuels (utile après hot-reload).
  for (const l of lights) {
    const ov = configOverrides.get(l.id);
    if (ov) l.cycle = { ...l.cycle, ...ov };
  }
  computed = { lights };
  return computed;
}

export function getTrafficLights(): TrafficLight[] {
  return computed?.lights ?? [];
}

/** Overrides persistants (survivent à un recalcul init). */
const configOverrides = new Map<number, Partial<LightCycleConfig>>();
export function setLightCycle(id: number, cfg: Partial<LightCycleConfig>) {
  configOverrides.set(id, { ...(configOverrides.get(id) ?? {}), ...cfg });
  const l = computed?.lights.find(x => x.id === id);
  if (l) l.cycle = { ...l.cycle, ...cfg };
}
export function getLightCycle(id: number): LightCycleConfig | null {
  return computed?.lights.find(x => x.id === id)?.cycle ?? null;
}

export function nowSeconds(): number {
  return performance.now() / 1000;
}

/**
 * Faut-il s'arrêter ? Chaque stop possède son propre axe → l'état pris en
 * compte est celui de son axe (une direction perpendiculaire n'affecte pas
 * la nôtre).
 */
export function shouldStopAhead(
  pathIdx: number,
  s: number,
  forward: boolean,
  tSeconds: number,
): boolean {
  if (!computed) return false;
  for (const l of computed.lights) {
    for (const st of l.stops) {
      if (st.pathIdx !== pathIdx) continue;
      const ahead = forward ? st.s - s : s - st.s;
      if (ahead <= 0 || ahead > STOP_RADIUS) continue;
      const state = getLightState(l, tSeconds, st.axis);
      if (state === "red") return true;
      if (state === "orange" && ahead > 45) return true;
      return false;
    }
  }
  for (const a of accidents) {
    if (a.pathIdx !== pathIdx) continue;
    const ahead = forward ? a.s - s : s - a.s;
    if (ahead > 0 && ahead < ACCIDENT_STOP_RADIUS) return true;
  }
  return false;
}

// ====== Accidents bloquants (collisions) ======
export type AccidentZone = {
  id: number;
  pathIdx: number;
  s: number;
  x: number;
  y: number;
  kind: "vehicle" | "pedestrian";
};
const accidents: AccidentZone[] = [];
const ACCIDENT_STOP_RADIUS = 85;

export function registerAccident(a: AccidentZone) {
  if (!accidents.find(x => x.id === a.id)) accidents.push(a);
}
export function clearAccident(id: number) {
  const i = accidents.findIndex(a => a.id === id);
  if (i >= 0) accidents.splice(i, 1);
}
export function getAccidents(): AccidentZone[] {
  return accidents;
}

// ====== Registre partagé des positions de véhicules ======
export type VehicleSlot = {
  pathIdx: number;
  s: number;
  forward: boolean;
  updatedAt: number;
};
const vehicleSlots = new Map<string, VehicleSlot>();
const VEHICLE_STALE_MS = 400;
const CAR_QUEUE_GAP = 42;

export function reportVehicle(id: string, pathIdx: number, s: number, forward: boolean) {
  vehicleSlots.set(id, { pathIdx, s, forward, updatedAt: performance.now() });
}
export function clearVehicle(id: string) {
  vehicleSlots.delete(id);
}
export function hasVehicleAhead(
  selfId: string,
  pathIdx: number,
  s: number,
  forward: boolean,
  gap: number = CAR_QUEUE_GAP,
): boolean {
  const now = performance.now();
  for (const [id, slot] of vehicleSlots) {
    if (id === selfId) continue;
    if (slot.pathIdx !== pathIdx) continue;
    if (now - slot.updatedAt > VEHICLE_STALE_MS) continue;
    if (slot.forward !== forward) continue;
    const ahead = forward ? slot.s - s : s - slot.s;
    if (ahead > 0 && ahead < gap) return true;
  }
  return false;
}
