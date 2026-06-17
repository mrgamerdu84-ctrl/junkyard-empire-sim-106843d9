/* ============================================================
 * Traffic lights & "code de la route" — module partagé
 * Détecte automatiquement les intersections entre les ROADS
 * et expose un singleton avec l'état courant des feux.
 * ============================================================ */

export type LightState = "green" | "orange" | "red";

export type TrafficLight = {
  id: number;
  x: number;
  y: number;
  axis: 0 | 1;            // 2 groupes d'axes alternés
  stops: { pathIdx: number; s: number }[]; // ligne d'arrêt par path concerné
};

type Computed = {
  lights: TrafficLight[];
  // Cycle global : t en secondes
  state: (l: TrafficLight, t: number) => LightState;
};

let computed: Computed | null = null;
const PHASE = 10; // sec vert, puis 2 sec orange, puis 12 sec rouge (axe opposé vert)
const CYCLE = (PHASE + 2 + PHASE + 2) ; // = 24s par cycle complet
const STOP_RADIUS = 70; // distance à laquelle on arrête le véhicule en amont du feu

function stateFor(l: TrafficLight, t: number): LightState {
  const c = ((t % CYCLE) + CYCLE) % CYCLE;
  // axe 0 : 0..PHASE vert, PHASE..PHASE+2 orange, sinon rouge
  // axe 1 : décalé de PHASE+2
  const offset = l.axis === 0 ? 0 : PHASE + 2;
  const x = ((c - offset) % CYCLE + CYCLE) % CYCLE;
  if (x < PHASE) return "green";
  if (x < PHASE + 2) return "orange";
  return "red";
}

export function computeTrafficLights(
  paths: (SVGPathElement | null)[],
  lens: number[],
): TrafficLight[] {
  // Échantillonne chaque path (~6px) → cherche les zones où 2+ paths se croisent
  const SAMPLE = 8;
  type Sample = { pathIdx: number; s: number; x: number; y: number };
  const samples: Sample[] = [];
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    const l = lens[i] ?? 0;
    if (!p || l <= 0) continue;
    if (i === 1) continue; // village skip
    const n = Math.floor(l / SAMPLE);
    for (let k = 0; k <= n; k++) {
      const s = (k / n) * l;
      const pt = p.getPointAtLength(s);
      samples.push({ pathIdx: i, s, x: pt.x, y: pt.y });
    }
  }

  // Grille spatiale pour grouper
  const CELL = 28;
  const buckets = new Map<string, Sample[]>();
  for (const s of samples) {
    const k = `${Math.floor(s.x / CELL)},${Math.floor(s.y / CELL)}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(s);
  }

  // Pour chaque cellule, garde les intersections (≥ 2 paths différents)
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
    // moyenne du centre
    let cx = 0, cy = 0, n = 0;
    for (const a of arr) { cx += a.x; cy += a.y; n++; }
    cx /= n; cy /= n;
    // évite les doublons proches
    if (taken.some(t => (t.x - cx) ** 2 + (t.y - cy) ** 2 < 120 * 120)) continue;
    taken.push({ x: cx, y: cy });

    const stops: { pathIdx: number; s: number }[] = [];
    for (const [pIdx, arr2] of byPath.entries()) {
      // garde la position la + proche du centre
      let bestS = arr2[0].s, bestD = Infinity;
      for (const a of arr2) {
        const d = (a.x - cx) ** 2 + (a.y - cy) ** 2;
        if (d < bestD) { bestD = d; bestS = a.s; }
      }
      stops.push({ pathIdx: pIdx, s: bestS });
    }
    lights.push({
      id: id++,
      x: cx,
      y: cy,
      axis: (id % 2) as 0 | 1,
      stops,
    });
  }
  return lights;
}

export function initTrafficLights(paths: (SVGPathElement | null)[], lens: number[]) {
  const lights = computeTrafficLights(paths, lens);
  computed = { lights, state: stateFor };
  return computed;
}

export function getTrafficLights(): TrafficLight[] {
  return computed?.lights ?? [];
}

export function getLightState(l: TrafficLight, tSeconds: number): LightState {
  return stateFor(l, tSeconds);
}

/**
 * Doit-on s'arrêter ? On regarde tous les feux qui ont une ligne d'arrêt sur ce path,
 * dans la direction d'avancée du véhicule, à moins de STOP_RADIUS.
 * Retourne true si rouge (ou orange & proche) → STOP.
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
      const state = stateFor(l, tSeconds);
      if (state === "red") return true;
      if (state === "orange" && ahead > 30) return true;
      return false;
    }
  }
  return false;
}

export function nowSeconds(): number {
  return performance.now() / 1000;
}
