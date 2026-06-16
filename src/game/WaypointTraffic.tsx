/* ============================================================
 * WaypointTraffic — vrai système de circulation par graphe.
 * Nodes = intersections / points clés des routes (viewBox 1920x1080).
 * Edges = segments routiers entre deux nodes (bidirectionnels par paire).
 * Véhicules : suivent un edge, choisissent un edge sortant au node d'arrivée,
 * s'arrêtent à l'intersection si elle est déjà occupée (verrou par node).
 * ============================================================ */
import { useEffect, useMemo, useRef } from "react";
import npcTopdown from "@/assets/car-npc-topdown.png";
import npcRedTopdown from "@/assets/car-npc-red-topdown.png";

type NodeId = string;
type Node = { id: NodeId; x: number; y: number };
type Edge = { from: NodeId; to: NodeId };

// --- Carte des nodes (calés sur citymap2.jpg, viewBox 1920x1080) ----------
const NODES: Node[] = [
  // Route horizontale haute (légèrement diagonale)
  { id: "TL", x:   80, y: 305 },  // top-left
  { id: "TC", x:  957, y: 275 },  // top-center (intersection N-S / haute)
  { id: "TR", x: 1860, y: 240 },  // top-right
  // Bords verticaux
  { id: "ML", x:   80, y: 545 },  // mid-left
  { id: "MR", x: 1860, y: 545 },  // mid-right
  // Route horizontale basse
  { id: "BL", x:   80, y: 800 },  // bottom-left
  { id: "BC", x:  957, y: 815 },  // bottom-center (intersection N-S / basse)
  { id: "BR", x: 1860, y: 765 },  // bottom-right
  // Rond-point central (4 entrées + 4 points sur l'anneau)
  { id: "RN", x:  957, y: 410 },  // entrée nord
  { id: "RE", x: 1190, y: 545 },  // entrée est
  { id: "RS", x:  957, y: 670 },  // entrée sud
  { id: "RW", x:  727, y: 545 },  // entrée ouest
];

// Edges bidirectionnels : on liste chaque arête une fois, on génère les 2 sens.
const RAW_EDGES: [NodeId, NodeId][] = [
  // Route horizontale haute (en 2 segments : TL-TC-TR)
  ["TL", "TC"], ["TC", "TR"],
  // Route horizontale basse
  ["BL", "BC"], ["BC", "BR"],
  // Verticales latérales
  ["TL", "ML"], ["ML", "BL"],
  ["TR", "MR"], ["MR", "BR"],
  // Axe N-S central via rond-point
  ["TC", "RN"], ["RS", "BC"],
  // Connexions latérales au rond-point
  ["ML", "RW"], ["MR", "RE"],
  // Anneau du rond-point (sens horaire : RN -> RE -> RS -> RW -> RN)
  ["RN", "RE"], ["RE", "RS"], ["RS", "RW"], ["RW", "RN"],
];

const EDGES: Edge[] = [];
for (const [a, b] of RAW_EDGES) {
  EDGES.push({ from: a, to: b });
  EDGES.push({ from: b, to: a });
}

const NODE_MAP = new Map<NodeId, Node>(NODES.map((n) => [n.id, n]));
const ADJ = new Map<NodeId, Edge[]>();
for (const n of NODES) ADJ.set(n.id, []);
for (const e of EDGES) ADJ.get(e.from)!.push(e);

function edgeLen(e: Edge): number {
  const a = NODE_MAP.get(e.from)!;
  const b = NODE_MAP.get(e.to)!;
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// --- Spécifications de véhicules -------------------------------------------
type VehicleKind = "sedan" | "van" | "truck" | "hatch";
type VehicleVariant = "black" | "red";

type Spec = {
  kind: VehicleKind;
  color: string;
  scale: number;
  variant?: VehicleVariant;
  startEdgeIdx: number;
  startT: number;
  baseSpeed: number; // px/s
};

const VEHICLES: Spec[] = [
  { kind: "sedan", color: "#d83a2a", scale: 0.62, variant: "red", startEdgeIdx:  0, startT: 0.10, baseSpeed: 110 },
  { kind: "van",   color: "#2f7a4a", scale: 0.66,                  startEdgeIdx:  2, startT: 0.60, baseSpeed: 95  },
  { kind: "truck", color: "#1f2937", scale: 0.72,                  startEdgeIdx:  4, startT: 0.35, baseSpeed: 85  },
  { kind: "hatch", color: "#facc15", scale: 0.58, variant: "red", startEdgeIdx:  6, startT: 0.20, baseSpeed: 115 },
  { kind: "sedan", color: "#e8edf2", scale: 0.62,                  startEdgeIdx:  8, startT: 0.50, baseSpeed: 105 },
  { kind: "hatch", color: "#7c3aed", scale: 0.58, variant: "red", startEdgeIdx: 10, startT: 0.30, baseSpeed: 120 },
  { kind: "van",   color: "#ffffff", scale: 0.68,                  startEdgeIdx: 12, startT: 0.45, baseSpeed: 95  },
  { kind: "truck", color: "#b8410f", scale: 0.74,                  startEdgeIdx: 14, startT: 0.15, baseSpeed: 80  },
  { kind: "sedan", color: "#2b6ed8", scale: 0.62,                  startEdgeIdx: 16, startT: 0.40, baseSpeed: 110 },
  { kind: "hatch", color: "#22c55e", scale: 0.58, variant: "red", startEdgeIdx: 18, startT: 0.70, baseSpeed: 115 },
  { kind: "van",   color: "#0ea5e9", scale: 0.66,                  startEdgeIdx: 20, startT: 0.25, baseSpeed: 100 },
  { kind: "sedan", color: "#f59e0b", scale: 0.62, variant: "red", startEdgeIdx: 22, startT: 0.55, baseSpeed: 108 },
  { kind: "truck", color: "#06b6d4", scale: 0.74,                  startEdgeIdx: 24, startT: 0.20, baseSpeed: 82  },
  { kind: "hatch", color: "#a855f7", scale: 0.58, variant: "red", startEdgeIdx: 26, startT: 0.65, baseSpeed: 118 },
];

// --- Composant véhicule (image PNG topdown) --------------------------------
function VehicleSprite({ kind, color, scale, variant }: { kind: VehicleKind; color: string; scale: number; variant?: VehicleVariant }) {
  const baseLen = kind === "truck" ? 92 : kind === "van" ? 78 : kind === "hatch" ? 58 : 68;
  const baseWid = kind === "truck" ? 36 : kind === "van" ? 34 : 30;
  const isRed = variant === "red";
  const href = isRed ? npcRedTopdown : npcTopdown;
  const innerRotate = isRed ? -90 : 90;
  return (
    <g transform={`scale(${scale})`}>
      <ellipse cx="0" cy="3" rx={baseLen / 2 + 2} ry={baseWid / 2 - 1} fill="rgba(0,0,0,0.4)" />
      <g transform={`rotate(${innerRotate})`}>
        <image href={href} x={-baseWid / 2} y={-baseLen / 2} width={baseWid} height={baseLen} preserveAspectRatio="xMidYMid meet" />
        <rect x={-baseWid / 2} y={-baseLen / 2} width={baseWid} height={baseLen} fill={color} opacity="0.45" style={{ mixBlendMode: "multiply" }} />
      </g>
    </g>
  );
}

// --- Simulation -----------------------------------------------------------
type Veh = {
  spec: Spec;
  edge: Edge;
  t: number;          // 0..1 le long de l'edge courant
  speed: number;      // px/s
  prevFrom: NodeId;   // dernier node quitté (pour interdire le demi-tour)
  claimedNode: NodeId | null; // node verrouillé (si on est dans son rayon)
  node: SVGGElement | null;
};

const STOP_RADIUS = 42;    // si on s'approche à <STOP_RADIUS d'un node, on demande le verrou
const RELEASE_RADIUS = 55; // on libère le verrou quand on s'éloigne au-delà
const LANE_OFFSET = 14;    // décalage à droite pour rouler en sens correct
const ACCEL = 220;         // px/s²
const BRAKE = 380;         // px/s²

export default function WaypointTraffic() {
  const carNodes = useRef<(SVGGElement | null)[]>([]);
  const initialVehicles = useMemo(() => {
    return VEHICLES.map((spec) => {
      const edge = EDGES[spec.startEdgeIdx % EDGES.length];
      return { spec, edge, t: spec.startT, prevFrom: edge.from } as Omit<Veh, "speed" | "claimedNode" | "node"> & { speed: number; claimedNode: NodeId | null; node: SVGGElement | null };
    });
  }, []);

  useEffect(() => {
    const vehs: Veh[] = initialVehicles.map((v, i) => ({
      spec: v.spec,
      edge: v.edge,
      t: v.t,
      prevFrom: v.prevFrom,
      speed: v.spec.baseSpeed * 0.6,
      claimedNode: null,
      node: carNodes.current[i],
    }));

    // Lock par node : un seul véhicule peut le tenir à la fois.
    const nodeLock = new Map<NodeId, number>(); // nodeId -> vehicle index

    let raf = 0;
    let last = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // 1) Mettre à jour les verrous (libérer ceux dont le véhicule s'est éloigné)
      for (let i = 0; i < vehs.length; i++) {
        const v = vehs[i];
        if (!v.claimedNode) continue;
        const n = NODE_MAP.get(v.claimedNode)!;
        const a = NODE_MAP.get(v.edge.from)!;
        const b = NODE_MAP.get(v.edge.to)!;
        const px = a.x + (b.x - a.x) * v.t;
        const py = a.y + (b.y - a.y) * v.t;
        if (Math.hypot(px - n.x, py - n.y) > RELEASE_RADIUS) {
          if (nodeLock.get(v.claimedNode) === i) nodeLock.delete(v.claimedNode);
          v.claimedNode = null;
        }
      }

      // 2) Pour chaque véhicule : calcul cible de vitesse, freinage si intersection occupée
      for (let i = 0; i < vehs.length; i++) {
        const v = vehs[i];
        const a = NODE_MAP.get(v.edge.from)!;
        const b = NODE_MAP.get(v.edge.to)!;
        const L = Math.hypot(b.x - a.x, b.y - a.y);
        const distToEnd = L * (1 - v.t);

        let targetSpeed = v.spec.baseSpeed;

        // Si on approche du node d'arrivée et qu'on n'a pas encore le verrou
        if (distToEnd < STOP_RADIUS && v.claimedNode !== v.edge.to) {
          const holder = nodeLock.get(v.edge.to);
          if (holder === undefined) {
            // libre : on prend le verrou
            nodeLock.set(v.edge.to, i);
            v.claimedNode = v.edge.to;
          } else if (holder !== i) {
            // occupé : on freine pour s'arrêter avant le node
            const stopDist = Math.max(0, distToEnd - 10);
            // v² = 2 * BRAKE * d => v_max = sqrt(2*BRAKE*d)
            targetSpeed = Math.min(targetSpeed, Math.sqrt(Math.max(0, 2 * BRAKE * stopDist)));
          }
        }

        // Lissage vitesse
        const diff = targetSpeed - v.speed;
        const rate = diff >= 0 ? ACCEL : BRAKE;
        const maxStep = rate * dt;
        v.speed += Math.max(-maxStep, Math.min(maxStep, diff));
        if (v.speed < 0) v.speed = 0;

        // Avancer
        v.t += (v.speed * dt) / L;

        // Transition au node d'arrivée
        if (v.t >= 1) {
          const arrived = v.edge.to;
          // Choisir un edge sortant qui n'est pas un demi-tour
          const outs = ADJ.get(arrived)!;
          const valid = outs.filter((e) => e.to !== v.edge.from);
          const pick = (valid.length ? valid : outs)[Math.floor(Math.random() * (valid.length ? valid.length : outs.length))];
          v.prevFrom = v.edge.from;
          v.edge = pick;
          v.t = 0;
        }
      }

      // 3) Appliquer le transform SVG
      for (let i = 0; i < vehs.length; i++) {
        const v = vehs[i];
        const node = v.node;
        if (!node) continue;
        const a = NODE_MAP.get(v.edge.from)!;
        const b = NODE_MAP.get(v.edge.to)!;
        const dx = b.x - a.x, dy = b.y - a.y;
        const L = Math.hypot(dx, dy) || 1;
        const ux = dx / L, uy = dy / L;
        // perpendiculaire à droite (rouler à droite)
        const rx = uy, ry = -ux;
        const px = a.x + dx * v.t + rx * LANE_OFFSET;
        const py = a.y + dy * v.t + ry * LANE_OFFSET;
        const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
        node.setAttribute("transform", `translate(${px.toFixed(2)},${py.toFixed(2)}) rotate(${ang.toFixed(2)})`);
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [initialVehicles]);

  return (
    <svg
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 4 }}
    >
      <defs>
        <filter id="wt-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>
      {VEHICLES.map((spec, i) => (
        <g
          key={i}
          filter="url(#wt-shadow)"
          ref={(el) => { carNodes.current[i] = el; }}
        >
          <VehicleSprite kind={spec.kind} color={spec.color} scale={spec.scale} variant={spec.variant} />
        </g>
      ))}
    </svg>
  );
}
