/**
 * roadGraph.ts — Réseau routier explicite dérivé de la grille cityMap.
 *
 * Le réseau est un graphe orienté simple :
 *   - Nodes : intersections (carrefours) aux coins des quartiers.
 *   - Edges : segments de route (toujours horizontaux ou verticaux pour
 *             un look top-down GTA1/2 propre).
 *
 * À chaque intersection, un véhicule choisit aléatoirement une sortie
 * (en évitant le demi-tour). Les passages piétons sont placés aux
 * extrémités des edges (juste avant l'intersection).
 *
 * Coordonnées en viewBox 1920×1080.
 */

import {
  MAP_W, MAP_H, GRID_COLS, GRID_ROWS, DISTRICT_W, DISTRICT_H,
} from "./cityMap";

export const ROAD_WIDTH = 26;        // largeur asphalte (px viewBox)
export const SIDEWALK_WIDTH = 6;     // trottoir de chaque côté
export const CROSSWALK_INSET = 18;   // distance du passage piéton au coin
export const CROSSWALK_LEN = 22;     // longueur d'un passage piéton

export type NodeId = number;

export type RoadNode = {
  id: NodeId;
  x: number;
  y: number;
  col: number; // 0..GRID_COLS
  row: number; // 0..GRID_ROWS
};

export type RoadEdge = {
  id: number;
  from: NodeId;
  to: NodeId;
  dir: "h" | "v";       // horizontal ou vertical
  length: number;
};

export type Crosswalk = {
  edgeId: number;
  x: number;            // centre
  y: number;
  dir: "h" | "v";       // direction du passage (perpendiculaire à la route)
};

function buildGraph() {
  const nodes: RoadNode[] = [];
  const idxOf = (col: number, row: number) => row * (GRID_COLS + 1) + col;

  for (let row = 0; row <= GRID_ROWS; row++) {
    for (let col = 0; col <= GRID_COLS; col++) {
      nodes.push({
        id: idxOf(col, row),
        x: col * DISTRICT_W,
        y: row * DISTRICT_H,
        col, row,
      });
    }
  }

  const edges: RoadEdge[] = [];
  let eid = 0;
  // Horizontales
  for (let row = 0; row <= GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const from = idxOf(col, row);
      const to = idxOf(col + 1, row);
      edges.push({
        id: eid++,
        from, to,
        dir: "h",
        length: DISTRICT_W,
      });
    }
  }
  // Verticales
  for (let col = 0; col <= GRID_COLS; col++) {
    for (let row = 0; row < GRID_ROWS; row++) {
      const from = idxOf(col, row);
      const to = idxOf(col, row + 1);
      edges.push({
        id: eid++,
        from, to,
        dir: "v",
        length: DISTRICT_H,
      });
    }
  }

  // Crosswalks : un de chaque côté de chaque edge (proche des intersections)
  const crosswalks: Crosswalk[] = [];
  for (const e of edges) {
    const a = nodes[e.from];
    const b = nodes[e.to];
    if (e.dir === "h") {
      crosswalks.push({ edgeId: e.id, x: a.x + CROSSWALK_INSET + CROSSWALK_LEN / 2, y: a.y, dir: "v" });
      crosswalks.push({ edgeId: e.id, x: b.x - CROSSWALK_INSET - CROSSWALK_LEN / 2, y: a.y, dir: "v" });
    } else {
      crosswalks.push({ edgeId: e.id, x: a.x, y: a.y + CROSSWALK_INSET + CROSSWALK_LEN / 2, dir: "h" });
      crosswalks.push({ edgeId: e.id, x: a.x, y: b.y - CROSSWALK_INSET - CROSSWALK_LEN / 2, dir: "h" });
    }
  }

  // Adjacence : pour chaque node, edges sortants (les deux sens d'un même edge)
  const adjacency = new Map<NodeId, Array<{ edge: RoadEdge; nextNode: NodeId; heading: { dx: number; dy: number } }>>();
  for (const n of nodes) adjacency.set(n.id, []);
  for (const e of edges) {
    const a = nodes[e.from];
    const b = nodes[e.to];
    adjacency.get(a.id)!.push({
      edge: e, nextNode: b.id,
      heading: { dx: Math.sign(b.x - a.x), dy: Math.sign(b.y - a.y) },
    });
    adjacency.get(b.id)!.push({
      edge: e, nextNode: a.id,
      heading: { dx: Math.sign(a.x - b.x), dy: Math.sign(a.y - b.y) },
    });
  }

  return { nodes, edges, crosswalks, adjacency };
}

const GRAPH = buildGraph();

export const NODES = GRAPH.nodes;
export const EDGES = GRAPH.edges;
export const CROSSWALKS = GRAPH.crosswalks;

export function adjacencyFor(nodeId: NodeId) {
  return GRAPH.adjacency.get(nodeId) ?? [];
}

/** Choisit une sortie aléatoire depuis `node`, évitant le retour d'où on vient. */
export function chooseNextEdge(nodeId: NodeId, cameFromEdgeId?: number) {
  const options = adjacencyFor(nodeId);
  const filtered = cameFromEdgeId == null
    ? options
    : options.filter(o => o.edge.id !== cameFromEdgeId);
  const pool = filtered.length ? filtered : options;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Calcule un point le long d'un edge (t ∈ [0,1] depuis `from` vers `to`). */
export function pointAlongEdge(edge: RoadEdge, t: number, reverse = false) {
  const a = NODES[edge.from];
  const b = NODES[edge.to];
  const tt = reverse ? 1 - t : t;
  return {
    x: a.x + (b.x - a.x) * tt,
    y: a.y + (b.y - a.y) * tt,
  };
}

export function nearestNode(x: number, y: number): RoadNode {
  let best = NODES[0];
  let bestD = Infinity;
  for (const n of NODES) {
    const dx = n.x - x;
    const dy = n.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}

export const MAP_BOUNDS = { w: MAP_W, h: MAP_H };
