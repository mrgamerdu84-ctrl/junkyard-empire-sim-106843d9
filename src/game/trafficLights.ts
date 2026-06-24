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
const STOP_RADIUS = 95; // distance d'arrêt en amont du feu (renforcé pour respect du code de la route)

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
  _paths: (SVGPathElement | null)[],
  _lens: number[],
): TrafficLight[] {
  // Désactivé : avec la nouvelle grille de routes, les intersections sont
  // trop nombreuses pour des feux automatiques et stoppaient les voitures
  // partout. Trafic fluide = aucun feu auto. Les véhicules respectent
  // seulement l'anti-collision (gap + cross-lane raycast) dans CityTraffic.
  return [];
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
      // Orange : arrêt si on est encore assez loin pour freiner sereinement (sinon on passe).
      if (state === "orange" && ahead > 45) return true;
      return false;
    }
  }
  // Accidents bloquants : stoppe sur 80 px en amont
  for (const a of accidents) {
    if (a.pathIdx !== pathIdx) continue;
    const ahead = forward ? a.s - s : s - a.s;
    if (ahead > 0 && ahead < ACCIDENT_STOP_RADIUS) return true;
  }
  return false;
}

export function nowSeconds(): number {
  return performance.now() / 1000;
}

// ====== Accidents bloquants (collisions) ======
export type AccidentZone = {
  id: number;
  pathIdx: number;
  s: number;        // position le long du path
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

