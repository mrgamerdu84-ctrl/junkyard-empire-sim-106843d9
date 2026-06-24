import { useEffect, useRef, useState } from "react";
import { useAdminConfig } from "./adminConfig";
import { getPedestrianPhotoUrls, listCustomVehicles, getCivilCarUrls, GAME_ASSETS, type CustomVehicleCategory } from "./gameAssets";
import { VehicleSvg, type VehicleSvgKind } from "./vehicles/VehicleSvgs";
import {
  initTrafficLights,
  getTrafficLights,
  getLightState,
  shouldStopAhead,
  nowSeconds,
  type TrafficLight,
} from "./trafficLights";
import { PARKING_ZONES, pickFreeZone } from "./parkingZones";

// Dynamique : inclut les piétons custom uploadés via le panel admin.
// Recalculé à chaque appel — les composants qui en dépendent écoutent
// 'jce.customPedestrians.changed' pour re-render.
const getPedPhotoImages = () => getPedestrianPhotoUrls();

// === RÉSEAU DE ROUTES ===
// Plus aucun tracé pré-défini : le réseau est entièrement piloté par les
// waypoints que le joueur dessine dans le panel admin (onglet Circuit).
// On garde l'export `ROADS` (vide) et `VILLAGE_PATHS` (vide) pour la
// compat des anciens modules qui les importent encore.
export const ROADS: string[] = [];
export const VILLAGE_PATHS = new Set<number>();

// === SÉPARATION DES VOIES (code de la route) ===
// Demi-largeur d'une route ≈ 23 px. On place chaque véhicule à LANE_HALF px
// du centre, à DROITE de son sens de marche.
const LANE_HALF = 11;

/* eslint-disable prettier/prettier */



type VehicleKind = VehicleSvgKind;
type VehicleVariant = "black" | "red";

type CarSpec = {
  color: string;
  accent: string;
  duration: number;
  delay: number;
  pathIdx: number;
  flip?: boolean;
  scale?: number;
  kind: VehicleKind;
  variant?: VehicleVariant;
  imageUrl?: string;       // sprite uploadé (vue du ciel, nez ↑)
  category?: CustomVehicleCategory;
};

// Trafic civil par défaut VIDE — toutes les voitures qui roulent sont
// celles ajoutées par le joueur via le panel admin (📦⬇️ Import en lot).
// Voir buildCarsFromCustom() dans le composant ci-dessous.





// Anciennes voitures basées sur des photos remplacées par des SVG vectoriels
// vus du dessus (avant pointant vers le haut). Voir src/game/vehicles/VehicleSvgs.tsx.
// La taille effective des véhicules civils en viewBox 1920×1080 :
//   spec.scale (~0.6) × CIVIL_SCALE = ~36px (= taille du taxi joueur).
const CIVIL_SCALE = 1.5;

function Vehicle({
  kind,
  color,
  accent,
  scale = 1,
}: {
  kind: VehicleKind;
  color: string;
  accent: string;
  scale?: number;
  variant?: VehicleVariant;
  photoIdx?: number;
}) {
  return <VehicleSvg kind={kind} color={color} accent={accent} scale={scale * CIVIL_SCALE} />;
}





// === Piétons photos qui marchent sur les trottoirs ===
type PhotoPedSpec = {
  pathIdx: number;
  side: 1 | -1;
  speed: number;     // px/s
  startFrac: number; // 0..1
  imageIdx: number;
  scale: number;
};
const PHOTO_PEDS: PhotoPedSpec[] = [
  { pathIdx: 0, side: 1,  speed: 22, startFrac: 0.08, imageIdx: 0, scale: 0.55 },
  { pathIdx: 0, side: -1, speed: 18, startFrac: 0.22, imageIdx: 1, scale: 0.55 },
  { pathIdx: 0, side: 1,  speed: 20, startFrac: 0.42, imageIdx: 1, scale: 0.5 },
  { pathIdx: 0, side: -1, speed: 24, startFrac: 0.62, imageIdx: 0, scale: 0.55 },
  { pathIdx: 0, side: 1,  speed: 19, startFrac: 0.82, imageIdx: 0, scale: 0.5 },
  { pathIdx: 2, side: 1,  speed: 21, startFrac: 0.12, imageIdx: 1, scale: 0.55 },
  { pathIdx: 2, side: -1, speed: 23, startFrac: 0.34, imageIdx: 0, scale: 0.55 },
  { pathIdx: 2, side: 1,  speed: 18, startFrac: 0.56, imageIdx: 1, scale: 0.5 },
  { pathIdx: 2, side: -1, speed: 25, startFrac: 0.78, imageIdx: 1, scale: 0.55 },
];
// === Verrou de trottoir ===
// Distance perpendiculaire MINIMALE entre un piéton et l'axe de la route.
// La largeur visible d'une route ≈ 46 px ; on garde une marge confortable
// pour qu'AUCUN piéton ne puisse glisser sur la chaussée — même si une IA,
// une collision ou un futur effet tentait d'altérer sa position.
export const SIDEWALK_LOCK_OFFSET = 64;
// Les piétons photo marchent JUSTE à côté de la chaussée (stroke route = 46 → demi-largeur ≈ 23).
// Un offset de 30 px les place sur le trottoir, sans déborder sur la chaussée d'une route perpendiculaire.
const PHOTO_PED_OFFSET = 30;
const PHOTO_PED_MIN_OFFSET = 26; // jamais plus près de l'axe que ça (anti-glissement chaussée)


/** Verrouille une coordonnée XY sur le trottoir : si elle est plus proche
 *  de l'axe que `SIDEWALK_LOCK_OFFSET`, on la repousse vers `side`. */
export function lockToSidewalk(
  pathPoint: { x: number; y: number },
  tangent: { dx: number; dy: number },
  side: 1 | -1,
  x: number,
  y: number,
): { x: number; y: number } {
  const L = Math.hypot(tangent.dx, tangent.dy) || 1;
  const nx = -tangent.dy / L;
  const ny = tangent.dx / L;
  // Distance signée du point (x,y) à l'axe, projetée sur la normale `side`.
  const dist = ((x - pathPoint.x) * nx + (y - pathPoint.y) * ny) * side;
  if (dist >= SIDEWALK_LOCK_OFFSET) return { x, y };
  return {
    x: pathPoint.x + nx * SIDEWALK_LOCK_OFFSET * side,
    y: pathPoint.y + ny * SIDEWALK_LOCK_OFFSET * side,
  };
}

function PhotoPedestrians({ pathRefs }: { pathRefs: React.MutableRefObject<(SVGPathElement | null)[]> }) {
  const nodes = useRef<(SVGGElement | null)[]>([]);
  // Rotation aléatoire des sprites parmi tous ceux dispos (défaut + custom admin).
  const [pool, setPool] = useState<string[]>(() => getPedPhotoImages());
  useEffect(() => {
    const onChange = () => setPool(getPedPhotoImages());
    window.addEventListener("jce.customPedestrians.changed", onChange);
    return () => window.removeEventListener("jce.customPedestrians.changed", onChange);
  }, []);
  useEffect(() => {
    const lens = pathRefs.current.map(p => p ? p.getTotalLength() : 0);
    if (lens.some(l => l <= 1)) return;
    const states = PHOTO_PEDS.map(spec => ({
      spec,
      pathLen: lens[spec.pathIdx],
      s: spec.startFrac * lens[spec.pathIdx],
    }));
    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      for (let i = 0; i < states.length; i++) {
        const st = states[i];
        const node = nodes.current[i];
        const path = pathRefs.current[st.spec.pathIdx];
        if (!path || !node) continue;
        st.s = (st.s + st.spec.speed * dt) % st.pathLen;
        const p = path.getPointAtLength(st.s);
        // CULLING : hors viewport SVG (avec marge) → skip getPointAtLength d'appoint + DOM write.
        if (p.x < -200 || p.x > 2120 || p.y < -200 || p.y > 1280) continue;
        const p2 = path.getPointAtLength(Math.min(st.pathLen, st.s + 1));
        const dx = p2.x - p.x, dy = p2.y - p.y;
        const L = Math.hypot(dx, dy) || 1;
        // perpendiculaire = trottoir
        const nx = -dy / L * PHOTO_PED_OFFSET * st.spec.side;
        const ny =  dx / L * PHOTO_PED_OFFSET * st.spec.side;
        // angle de marche (le sprite top-down tourne dans la direction du mouvement)
        const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
        // 🔒 Verrou trottoir local (offset piéton, pas celui des clients taxi)
        // Clamp la distance perpendiculaire à PHOTO_PED_MIN_OFFSET minimum.
        let px = p.x + nx;
        let py = p.y + ny;
        const nUnitX = -dy / L;
        const nUnitY = dx / L;
        const signedDist = ((px - p.x) * nUnitX + (py - p.y) * nUnitY) * st.spec.side;
        if (signedDist < PHOTO_PED_MIN_OFFSET) {
          px = p.x + nUnitX * PHOTO_PED_MIN_OFFSET * st.spec.side;
          py = p.y + nUnitY * PHOTO_PED_MIN_OFFSET * st.spec.side;
        }
        node.setAttribute(
          "transform",
          `translate(${px.toFixed(2)},${py.toFixed(2)}) rotate(${ang.toFixed(2)})`,
        );
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [pathRefs]);
  return (
    <g pointerEvents="none">
      {PHOTO_PEDS.map((spec, i) => {
        // Sprites top-down ~36px (vue du ciel), rotation = sens de marche
        const S = 36 * spec.scale;
        return (
          <g key={i} ref={el => { nodes.current[i] = el; }}>
            <ellipse cx="0" cy={S * 0.2} rx={S * 0.35} ry={S * 0.18} fill="rgba(0,0,0,0.45)" />
            {/* +90° : sprite top-down "tête au nord", parent applique rotate(angle) basé sur +x */}
            <g transform="rotate(90)">
              <image
                href={pool[(spec.imageIdx + i) % Math.max(1, pool.length)] ?? pool[0]}
                x={-S / 2}
                y={-S / 2}
                width={S}
                height={S}
                preserveAspectRatio="xMidYMid meet"
              />
            </g>
          </g>
        );
      })}
    </g>
  );
}

// Lampadaires retirés à la demande du joueur.



type PedSpec = {
  pathIdx: number;
  duration: number;
  delay: number;
  side: 1 | -1;   // trottoir gauche/droite
  flip?: boolean;
  shirt: string;
  pants: string;
  skin: string;
  scale?: number;
};

const PEDESTRIANS: PedSpec[] = [
  { pathIdx: 0, duration: 140, delay: -10, side:  1, shirt: "#e94e4e", pants: "#2a2f38", skin: "#f1c79b", scale: 0.85 },
  { pathIdx: 0, duration: 160, delay: -55, side: -1, shirt: "#3b82f6", pants: "#1f2937", skin: "#c89372", flip: true, scale: 0.9 },
  { pathIdx: 0, duration: 180, delay: -90, side:  1, shirt: "#fbbf24", pants: "#374151", skin: "#e8b48a", scale: 0.8 },
  { pathIdx: 0, duration: 150, delay: -130,side: -1, shirt: "#10b981", pants: "#111827", skin: "#a06c44", flip: true, scale: 0.88 },
  // Path 1 retiré (voir VILLAGE_PATHS) — pas de piétons sur la route off-screen
  { pathIdx: 2, duration: 165, delay: -10, side:  1, shirt: "#a855f7", pants: "#1f2937", skin: "#f0c8a0", scale: 0.82 },
  { pathIdx: 0, duration: 195, delay: -200, side: -1, shirt: "#ec4899", pants: "#0f172a", skin: "#d4a37a", flip: true, scale: 0.86 },
  { pathIdx: 2, duration: 170, delay: -20, side:  1, shirt: "#f97316", pants: "#1e293b", skin: "#c89372", scale: 0.85 },
  { pathIdx: 2, duration: 190, delay: -75, side: -1, shirt: "#06b6d4", pants: "#1f2937", skin: "#e8b48a", flip: true, scale: 0.9 },
  { pathIdx: 2, duration: 155, delay: -120,side:  1, shirt: "#ffffff", pants: "#0b1220", skin: "#a06c44", scale: 0.83 },
  { pathIdx: 2, duration: 200, delay: -170,side: -1, shirt: "#facc15", pants: "#374151", skin: "#f1c79b", flip: true, scale: 0.88 },
];
void PEDESTRIANS; void PedestrianSVG;


// Largeur d'asphalte visible sur la carte ≈ 28-34px (stroke). On place
// les piétons à 34px du centre du path => clairement sur le trottoir,
// jamais sur la chaussée, même côté contre-voie.
export const SIDEWALK_OFFSET = 34;

function PedestrianSVG({ shirt, pants, skin, side, scale = 1 }: { shirt: string; pants: string; skin: string; side: -1 | 0 | 1; scale?: number }) {
  // Offset Y dans le repère local = perpendiculaire au sens de marche (rotate="auto").
  // side ∈ {-1, 0, 1} : 0 = au centre (utilisé pour la traversée piétonne).
  const oy = side === 0 ? 0 : side * SIDEWALK_OFFSET;
  return (
    <g transform={`translate(0,${oy}) scale(${scale})`}>
      <ellipse cx="0" cy="6" rx="4.5" ry="1.6" fill="rgba(0,0,0,0.5)" />
      {/* jambes (animation marche) */}
      <g>
        <rect x="-2.4" y="0" width="2" height="6" rx="0.6" fill={pants}>
          <animateTransform attributeName="transform" type="translate" values="0 0;0 -1;0 0;0 -1;0 0" dur="0.6s" repeatCount="indefinite" />
        </rect>
        <rect x="0.4" y="0" width="2" height="6" rx="0.6" fill={pants}>
          <animateTransform attributeName="transform" type="translate" values="0 -1;0 0;0 -1;0 0;0 -1" dur="0.6s" repeatCount="indefinite" />
        </rect>
      </g>
      {/* torse */}
      <path d="M -3.2 -5 Q 0 -7 3.2 -5 L 2.6 1 L -2.6 1 Z" fill={shirt} stroke="rgba(0,0,0,0.4)" strokeWidth="0.4" />
      {/* bras */}
      <rect x="-4.2" y="-4" width="1.4" height="4.5" rx="0.5" fill={shirt}>
        <animateTransform attributeName="transform" type="rotate" values="-10;15;-10" dur="0.6s" repeatCount="indefinite" />
      </rect>
      <rect x="2.8" y="-4" width="1.4" height="4.5" rx="0.5" fill={shirt}>
        <animateTransform attributeName="transform" type="rotate" values="15;-10;15" dur="0.6s" repeatCount="indefinite" />
      </rect>
      {/* tête */}
      <circle cx="0" cy="-8" r="2.4" fill={skin} stroke="rgba(0,0,0,0.5)" strokeWidth="0.4" />
      <path d="M -2.4 -9.2 Q 0 -11 2.4 -9.2 L 2.2 -8 L -2.2 -8 Z" fill="#1f2937" />
    </g>
  );
}

// Distance de sécurité et freinage (en px du viewBox 1920x1080)
const SAFE_GAP = 110;    // distance désirée pare-chocs à pare-chocs
const BRAKE_GAP = 220;   // au-delà : pleine vitesse ; en deçà : freinage progressif
const ACCEL = 0.6;       // px/s² lissage vers la vitesse cible (réaccélération douce)
const BRAKE = 2.4;       // px/s² lissage en freinage (mordant pour anti-empilement)
const MIN_SPEED_RATIO = 0.18; // plancher anti-figeage (% de baseSpeed)
// Anti-collision cross-lane (intersections) : si une autre voiture (toute lane confondue)
// est dans ce rayon DEVANT moi (cône avant), je freine fort. Évite les empilements aux carrefours.
const CROSS_LANE_RADIUS = 75;
const CROSS_LANE_FORWARD_DOT = 0.3; // ~72° devant moi

type Mission = {
  eventId: number;
  phase: "going" | "staying" | "returning";
  startedAt: number;
  fromX: number; fromY: number;
  toX: number; toY: number;
  travelMs: number;
  arriveAt: number;
  stayUntil: number;
  returnUntil: number;
  returnFromX: number; returnFromY: number;  // snapshot au départ du retour
  pausedS: number;                            // st.s gelé pendant la mission
};

// === Stationnement dynamique ===
// Cycle : approaching → parked (conducteur sort, marche, revient) → leaving → reprise.
type ParkPhase = "approaching" | "parked" | "leaving";
type Parking = {
  phase: ParkPhase;
  phaseEndsAt: number;
  parkedUntil: number;          // fin de la phase "parked"
  zoneId: string;               // zone de parking pré-définie occupée
  // Pose figée pendant le parking (snapshot à la fin de l'approche)
  startX: number; startY: number; // position monde avant décalage trottoir
  px: number; py: number;        // position monde de la voiture garée (sur trottoir) = zone.x/y
  angle: number;                 // angle (deg) de la voiture garée = zone.angle
  tdx: number; tdy: number;      // tangente unitaire au moment du parking (cos/sin angle)
  side: 1 | -1;                  // côté trottoir (selon flip)
  // Conducteur
  pedSpriteIdx: number;
  pedWalkMs: number;             // durée d'aller (puis idem pour retour)
  pedReturnAt: number;           // instant où il commence à revenir
};

type CarState = {
  spec: CarSpec;
  pathLen: number;
  baseSpeed: number;   // px/s à allure libre
  s: number;           // progression linéaire le long du path (px), repère "avant"
  speed: number;       // px/s instantanée
  laneKey: string;     // pathIdx + sens -> regroupe les véhicules qui peuvent se gêner
  node: SVGGElement | null;
  pedNode: SVGGElement | null;   // sprite du conducteur (caché par défaut)
  mission?: Mission;
  parking?: Parking;
  pausedS?: number;              // st.s gelé pendant le parking
  nextParkAttemptAt?: number;    // cooldown anti re-park immédiat
  visible?: boolean;             // CULLING : dans le viewport visible (+ marge)
};

// Réglages parking
const PARK_TARGET_MIN = 0;
const PARK_TARGET_MAX = 0;
const PARK_APPROACH_MS = 1400;
const PARK_LEAVE_MS = 1100;
const PARK_DURATION_MIN_MS = 10000;
const PARK_DURATION_MAX_MS = 22000;
const PARK_COOLDOWN_MS = 45000;
const PARK_LANE_OFFSET = 18;
const PARK_PED_OFFSET = 34;
const PARK_PED_WALK_PX = 55;

// Catégories autorisées dans le trafic libre : uniquement les civils & véhicules
// de service. Police / ambulance / pompiers ne roulent QUE sur intervention
// (cf. EmergencyStations + InterventionDispatcher) → ils restent à leur QG
// le reste du temps.
const TRAFFIC_CATEGORIES: CustomVehicleCategory[] = [
  "civil", "service",
];

function buildCarsFromCustom(pathCount: number, count?: number): CarSpec[] {
  if (pathCount <= 0) return [];
  const customs = listCustomVehicles().filter(v => TRAFFIC_CATEGORIES.includes(v.category));
  // Tous les paths disponibles sont autorisés (le réseau = le circuit du joueur).
  const allowedPaths: number[] = [];
  for (let i = 0; i < pathCount; i++) allowedPaths.push(i);

  // Pool d'URLs disponibles : assets civils par défaut + customs roulants.
  // Permet d'avoir du trafic même sans uploads, et boucle modulo si N > pool.length.
  const civilUrls = getCivilCarUrls();
  type Entry = { url: string; category: CustomVehicleCategory };
  const pool: Entry[] = [
    ...civilUrls.map((url): Entry => ({ url, category: "civil" })),
    ...customs.map((v): Entry => ({ url: v.url, category: v.category })),
  ];
  if (pool.length === 0) return [];


  const N = Math.max(0, count ?? pool.length);
  const out: CarSpec[] = [];
  for (let i = 0; i < N; i++) {
    const entry = pool[i % pool.length];
    const pathIdx = allowedPaths[i % allowedPaths.length];
    const flip = (i % 2) === 1;
    const isHeavy = entry.category === "firetruck" || entry.category === "service" || entry.category === "ambulance";
    const baseDur = isHeavy ? 18 : 14;
    const duration = baseDur + (i % 5) * 0.6;
    out.push({
      kind: "sedan",
      color: "#888",
      accent: "#111",
      duration,
      delay: -i * 4,
      pathIdx,
      flip,
      scale: 0.6,
      imageUrl: entry.url,
      category: entry.category,
    });
  }
  return out;
}



export default function CityTraffic() {
  const [night, setNight] = useState(0.25);
  const [lightsTick, setLightsTick] = useState(0);
  const admin = useAdminConfig();
  const [customTick, setCustomTick] = useState(0);
  // Re-render quand le joueur ajoute/supprime un véhicule custom.
  useEffect(() => {
    const onChange = () => setCustomTick(t => t + 1);
    window.addEventListener("jce.customVehicles.changed", onChange);
    return () => window.removeEventListener("jce.customVehicles.changed", onChange);
  }, []);
  // Trafic = uniquement véhicules uploadés par le joueur (catégories roulantes).
  // Le slider "Véhicules civils" du panel admin sert de plafond (0 = aucun, max = tous).
  const allCustomCars = buildCarsFromCustom(admin.civilVehicleCount);
  void customTick;
  const activeCars = allCustomCars;
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const carNodes = useRef<(SVGGElement | null)[]>([]);
  const parkPedNodes = useRef<(SVGGElement | null)[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Viewport visible en coordonnées SVG (avec preserveAspectRatio="xMidYMid slice").
  // Recalculé sur resize. Marge de 200 px pour pré-activer les véhicules qui entrent.
  const visibleRect = useRef<{ minX: number; minY: number; maxX: number; maxY: number }>({
    minX: -9999, minY: -9999, maxX: 9999, maxY: 9999,
  });
  useEffect(() => {
    const recompute = () => {
      const svg = svgRef.current;
      if (!svg) return;
      const r = svg.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const VB_W = 1920, VB_H = 1080;
      const containerRatio = r.width / r.height;
      const vbRatio = VB_W / VB_H;
      let visW: number, visH: number;
      if (containerRatio > vbRatio) {
        // largeur entièrement visible, hauteur slicée
        visW = VB_W;
        visH = VB_W / containerRatio;
      } else {
        // hauteur entièrement visible, largeur slicée
        visH = VB_H;
        visW = VB_H * containerRatio;
      }
      const cx = VB_W / 2, cy = VB_H / 2;
      const margin = 220;
      visibleRect.current = {
        minX: cx - visW / 2 - margin,
        minY: cy - visH / 2 - margin,
        maxX: cx + visW / 2 + margin,
        maxY: cy + visH / 2 + margin,
      };
    };
    recompute();
    window.addEventListener("resize", recompute);
    window.addEventListener("orientationchange", recompute);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("orientationchange", recompute);
    };
  }, []);
  const [lights, setLights] = useState<TrafficLight[]>([]);


  // Radars retirés à la demande du joueur.


  // Cycle jour/nuit 300s (5 minutes). Démarre en plein jour.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = (performance.now() % 300000) / 300000;
      // décalage π/2 pour partir au midi (sin = 1)
      const daylight = Math.max(0, Math.sin(t * Math.PI * 2 + Math.PI / 2));
      setNight(0.1 + (1 - daylight) * 0.6);
      setLightsTick(v => (v + 1) % 1000000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);


  // Boucle de trafic : positions JS pilotées avec freinage progressif.
  useEffect(() => {
    // Mesurer les longueurs réelles des paths.
    const lens = pathRefs.current.map((p: SVGPathElement | null) => (p ? p.getTotalLength() : 1));
    if (lens.some((l: number) => l <= 1)) return;

    // Initialise les feux rouges (singleton partagé avec TaxiTycoon).
    initTrafficLights(pathRefs.current, lens);
    setLights(getTrafficLights());

    // Paths autorisés pour le trafic civil : tout sauf village.
    const civilAllowed: number[] = [];
    for (let i = 0; i < pathRefs.current.length; i++) {
      if (!VILLAGE_PATHS.has(i)) civilAllowed.push(i);
    }
    // Round-robin strict pour garantir une distribution équilibrée sur toutes les routes
    // (sinon la route du haut, plus courte, reste souvent vide visuellement).
    let pickCursor = Math.floor(Math.random() * Math.max(1, civilAllowed.length));
    const pickPath = () => {
      const p = civilAllowed[pickCursor % civilAllowed.length];
      pickCursor++;
      return p;
    };
    // Rerolle path + sens + durée à chaque tour pour casser la régularité.
    // Trafic civil : conduite tranquille (durée allongée, peu de variation) — pas agressif.
    const rerollSpec = (spec: CarSpec): CarSpec => {
      const newPath = pickPath();
      const baseDur = Math.max(10, spec.duration);
      // 0.9× à 1.2× → voitures rapides (~10–18s par tour de path)
      const dur = baseDur * (0.9 + Math.random() * 0.3);
      return {
        ...spec,
        pathIdx: newPath,
        flip: Math.random() < 0.5,
        duration: dur,
      };
    };

    const states: CarState[] = activeCars.map((rawSpec, i) => {
      // Init aléatoire : chaque voiture civile prend un path/dir/durée tirés au sort
      const spec = rerollSpec(rawSpec);
      const pathLen = lens[spec.pathIdx];
      const baseSpeed = pathLen / spec.duration; // px/s
      return {
        spec,
        pathLen,
        baseSpeed,
        s: Math.random() * pathLen,
        speed: baseSpeed,
        laneKey: `${spec.pathIdx}:${spec.flip ? "r" : "f"}`,
        node: carNodes.current[i],
        pedNode: parkPedNodes.current[i] ?? null,
        nextParkAttemptAt: performance.now() + 5000 + Math.random() * 15000,
      };
    });

    // Index par lane pour la recherche du véhicule devant (recalculé après chaque reroll).
    const rebuildLanes = (): Map<string, CarState[]> => {
      const m = new Map<string, CarState[]>();
      for (const st of states) {
        if (!m.has(st.laneKey)) m.set(st.laneKey, []);
        m.get(st.laneKey)!.push(st);
      }
      return m;
    };
    let lanes = rebuildLanes();

    // Radars retirés : noop pour préserver l'API d'appel dans la boucle.
    const checkRadars = (_st: CarState, _prev: number) => {};

    // === Helper : position monde courante d'une voiture sur son path ===
    const worldPos = (st: CarState) => {
      const path = pathRefs.current[st.spec.pathIdx];
      if (!path) return null;
      const fwd = st.spec.flip ? st.pathLen - st.s : st.s;
      const p = path.getPointAtLength(fwd);
      const p2 = path.getPointAtLength(Math.min(st.pathLen, fwd + (st.spec.flip ? -1 : 1)));
      const tdx = p2.x - p.x, tdy = p2.y - p.y;
      const L = Math.hypot(tdx, tdy) || 1;
      const ox = (-tdy / L) * LANE_HALF;
      const oy = (tdx / L) * LANE_HALF;
      return { x: p.x + ox, y: p.y + oy };
    };

    // === Mission d'intervention : un véhicule de la map se détourne ===
    const onIntervention = (ev: Event) => {
      const d = (ev as CustomEvent<{
        id: number; x: number; y: number; category: CustomVehicleCategory; label: string;
      }>).detail;
      if (!d) return;
      // Cherche le véhicule libre le plus proche de la bonne catégorie.
      let best: CarState | null = null;
      let bestDist = Infinity;
      for (const st of states) {
        if (st.mission) continue;
        if (st.spec.category !== d.category) continue;
        const w = worldPos(st);
        if (!w) continue;
        const dd = Math.hypot(w.x - d.x, w.y - d.y);
        if (dd < bestDist) { bestDist = dd; best = st; }
      }
      if (!best) {
        window.dispatchEvent(new CustomEvent("jce.intervention.nomatch", { detail: { id: d.id, category: d.category, label: d.label } }));
        return;
      }
      const w = worldPos(best);
      if (!w) return;
      const dist = Math.hypot(d.x - w.x, d.y - w.y);
      // ~260 px/s en intervention (un peu plus vite que le trafic normal)
      const travelMs = Math.max(1200, Math.min(5000, (dist / 260) * 1000));
      const now = performance.now();
      best.mission = {
        eventId: d.id,
        phase: "going",
        startedAt: now,
        fromX: w.x, fromY: w.y,
        toX: d.x, toY: d.y,
        travelMs,
        arriveAt: now + travelMs,
        stayUntil: now + travelMs + 2800,
        returnUntil: now + travelMs + 2800 + travelMs,
        returnFromX: d.x, returnFromY: d.y,
        pausedS: best.s,
      };
      best.speed = 0;
      window.dispatchEvent(new CustomEvent("jce.intervention.assigned", {
        detail: { id: d.id, category: d.category, label: d.label },
      }));
    };
    window.addEventListener("jce.intervention.request", onIntervention as EventListener);


    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); // clamp à 50ms (onglet inactif)
      last = now;

      // 1) calcul de la vitesse cible (freinage selon distance au véhicule devant)
      //    Les voitures en mission sont retirées de la circulation : on les ignore.
      // 1a) Pré-calcul des positions monde + vecteur direction pour le check cross-lane.
      type WP = { x: number; y: number; dx: number; dy: number };
      const wps = new Map<CarState, WP>();
      const vr = visibleRect.current;
      for (const st of states) {
        if (st.mission || st.parking) { st.visible = true; continue; }
        const path = pathRefs.current[st.spec.pathIdx];
        if (!path) { st.visible = false; continue; }
        const fwd = st.spec.flip ? st.pathLen - st.s : st.s;
        const p = path.getPointAtLength(fwd);
        // CULLING : hors viewport (+ marge) → pas de tangente, pas de raycast, pas de DOM write.
        st.visible = p.x >= vr.minX && p.x <= vr.maxX && p.y >= vr.minY && p.y <= vr.maxY;
        if (!st.visible) continue;
        const p2 = path.getPointAtLength(Math.min(st.pathLen, fwd + (st.spec.flip ? -1 : 1)));
        const tdx = p2.x - p.x, tdy = p2.y - p.y;
        const L = Math.hypot(tdx, tdy) || 1;
        wps.set(st, { x: p.x, y: p.y, dx: tdx / L, dy: tdy / L });
      }
      for (const lane of lanes.values()) {
        const sorted = [...lane].filter(s => !s.mission && !s.parking && s.visible).sort((a, b) => b.s - a.s);
        for (let i = 0; i < sorted.length; i++) {
          const me = sorted[i];
          const ahead = sorted[(i - 1 + sorted.length) % sorted.length];
          let gap = ahead.s - me.s;
          if (gap <= 0) gap += me.pathLen;
          const myLen = me.spec.kind === "truck" ? 60 : me.spec.kind === "van" ? 50 : 38;
          const safe = SAFE_GAP + myLen * 0.2;
          const brake = BRAKE_GAP + myLen * 0.2;
          let target = me.baseSpeed;
          const forward = !me.spec.flip;
          const sigS = me.spec.flip ? me.pathLen - me.s : me.s;
          if (shouldStopAhead(me.spec.pathIdx, sigS, forward, nowSeconds())) {
            target = 0;
          } else if (gap < brake) {
            const k = Math.max(0, (gap - safe) / (brake - safe));
            const leaderEff = Math.max(ahead.speed, ahead.baseSpeed * MIN_SPEED_RATIO);
            target = leaderEff * (1 - k) + me.baseSpeed * k;
            if (gap < safe) target = Math.min(target, leaderEff * (gap / safe));
          }
          // 1b) Cross-lane raycast : freine si un autre véhicule est devant moi
          //     dans CROSS_LANE_RADIUS (carrefours, voies qui se croisent).
          const myWp = wps.get(me);
          if (myWp) {
            for (const other of states) {
              if (other === me || other.mission || other.parking || !other.visible) continue;
              if (other.laneKey === me.laneKey) continue; // même lane déjà traité
              const owp = wps.get(other);
              if (!owp) continue;
              const rx = owp.x - myWp.x, ry = owp.y - myWp.y;
              const dist = Math.hypot(rx, ry);
              if (dist > CROSS_LANE_RADIUS || dist < 1) continue;
              const dot = (rx / dist) * myWp.dx + (ry / dist) * myWp.dy;
              if (dot < CROSS_LANE_FORWARD_DOT) continue; // pas devant moi
              // proximité : plus c'est proche, plus on freine ; en dessous de 25 px → stop
              const stopAt = 25;
              const k = Math.max(0, Math.min(1, (dist - stopAt) / (CROSS_LANE_RADIUS - stopAt)));
              const ct = me.baseSpeed * k * 0.6;
              if (ct < target) target = ct;
            }
          }
          const diff = target - me.speed;
          const rate = diff < 0 ? BRAKE * (target === 0 ? 2.5 : 1) : ACCEL;
          const maxStep = rate * me.baseSpeed * dt;
          me.speed += Math.max(-maxStep, Math.min(maxStep, diff));
          if (target > 0) {
            const floor = me.baseSpeed * MIN_SPEED_RATIO;
            if (me.speed < floor) me.speed = floor;
          } else if (me.speed < 0) me.speed = 0;
        }
      }
      // Cars hors-écran : roulent à vitesse de base (pas de calcul de gap, pas de raycast).
      for (const st of states) {
        if (st.mission || st.parking || st.visible) continue;
        st.speed = st.baseSpeed;
      }

      // 1c) Spawner de stationnements — pioche une zone fixe dans PARKING_ZONES.
      //     Les voitures garées n'utilisent PAS le réseau de waypoints :
      //     elles sont alignées exactement sur (zone.x, zone.y, zone.angle).
      const activeParked = states.reduce((n, s) => n + (s.parking ? 1 : 0), 0);
      const target = PARK_TARGET_MIN + Math.floor(Math.random() * (PARK_TARGET_MAX - PARK_TARGET_MIN + 1));
      if (activeParked < target && PARKING_ZONES.length > 0) {
        if (Math.random() < 0.02) {
          const occupied = new Set<string>();
          for (const s of states) if (s.parking) occupied.add(s.parking.zoneId);
          const zone = pickFreeZone(occupied);
          if (zone) {
            const candidates = states.filter(s =>
              !s.mission && !s.parking &&
              (s.nextParkAttemptAt === undefined || now >= s.nextParkAttemptAt) &&
              s.speed > s.baseSpeed * 0.3,
            );
            if (candidates.length > 0) {
              const victim = candidates[Math.floor(Math.random() * candidates.length)];
              const wp = wps.get(victim);
              if (wp) {
                const side: 1 | -1 = (zone.side as 1 | -1);
                const angleRad = (zone.angle * Math.PI) / 180;
                const tdx = Math.cos(angleRad);
                const tdy = Math.sin(angleRad);
                const parkedMs = PARK_DURATION_MIN_MS + Math.random() * (PARK_DURATION_MAX_MS - PARK_DURATION_MIN_MS);
                victim.parking = {
                  phase: "approaching",
                  phaseEndsAt: now + PARK_APPROACH_MS,
                  parkedUntil: now + PARK_APPROACH_MS + parkedMs,
                  zoneId: zone.id,
                  startX: wp.x, startY: wp.y,
                  px: zone.x, py: zone.y,
                  angle: zone.angle,
                  tdx, tdy,
                  side,
                  pedSpriteIdx: Math.floor(Math.random() * getPedPhotoImages().length),
                  pedWalkMs: 1800 + Math.random() * 1400,
                  pedReturnAt: now + PARK_APPROACH_MS + parkedMs - 2000,
                };
                victim.pausedS = victim.s;
                victim.speed = 0;
              }
            }
          }
        }
      }


      // 2) avancer et appliquer le transform
      let needsRebuild = false;
      for (const st of states) {
        const node = st.node;
        if (!node) continue;

        // ===== Branche MISSION : la voiture quitte le path et fonce =====
        if (st.mission) {
          const m = st.mission;
          let cx = m.toX, cy = m.toY, ang = 0;
          if (now < m.arriveAt) {
            const k = (now - m.startedAt) / m.travelMs;
            cx = m.fromX + (m.toX - m.fromX) * k;
            cy = m.fromY + (m.toY - m.fromY) * k;
            ang = (Math.atan2(m.toY - m.fromY, m.toX - m.fromX) * 180) / Math.PI;
          } else if (now < m.stayUntil) {
            if (m.phase === "going") {
              m.phase = "staying";
              window.dispatchEvent(new CustomEvent("jce.intervention.resolved", { detail: { id: m.eventId } }));
            }
            cx = m.toX; cy = m.toY;
            ang = (Math.atan2(m.toY - m.fromY, m.toX - m.fromX) * 180) / Math.PI;
          } else if (now < m.returnUntil) {
            if (m.phase !== "returning") {
              m.phase = "returning";
              m.returnFromX = m.toX; m.returnFromY = m.toY;
            }
            // Retour vers la position où elle était sur le path
            const w = worldPos({ ...st, s: m.pausedS });
            const tx = w?.x ?? m.fromX;
            const ty = w?.y ?? m.fromY;
            const k = (now - m.stayUntil) / (m.returnUntil - m.stayUntil);
            cx = m.returnFromX + (tx - m.returnFromX) * k;
            cy = m.returnFromY + (ty - m.returnFromY) * k;
            ang = (Math.atan2(ty - m.returnFromY, tx - m.returnFromX) * 180) / Math.PI;
          } else {
            // Fin de mission : reprend sa boucle normale
            st.s = m.pausedS;
            st.speed = st.baseSpeed;
            st.mission = undefined;
          }
          // Sprite top-down : nez ↑. On compense de +90° (cf. rendu image).
          // Le rendu applique <g transform="rotate(90)"> donc le rotate externe = angle de marche.
          node.setAttribute("transform", `translate(${cx.toFixed(2)},${cy.toFixed(2)}) rotate(${ang.toFixed(2)})`);
          if (st.mission) continue; // reste en mission → skip path logic
        }

        // ===== Branche PARKING : la voiture se gare sur le trottoir =====
        if (st.parking) {
          const pk = st.parking;
          let cx = pk.px, cy = pk.py;
          // Phase approaching : lerp depuis startX/Y vers px/py
          if (pk.phase === "approaching") {
            const k = Math.min(1, 1 - (pk.phaseEndsAt - now) / PARK_APPROACH_MS);
            cx = pk.startX + (pk.px - pk.startX) * k;
            cy = pk.startY + (pk.py - pk.startY) * k;
            if (now >= pk.phaseEndsAt) {
              pk.phase = "parked";
            }
          } else if (pk.phase === "parked") {
            if (now >= pk.parkedUntil) {
              pk.phase = "leaving";
              pk.phaseEndsAt = now + PARK_LEAVE_MS;
            }
          } else if (pk.phase === "leaving") {
            const k = Math.min(1, 1 - (pk.phaseEndsAt - now) / PARK_LEAVE_MS);
            cx = pk.px + (pk.startX - pk.px) * k;
            cy = pk.py + (pk.startY - pk.py) * k;
            if (now >= pk.phaseEndsAt) {
              // Fin : reprise du trafic
              st.parking = undefined;
              st.speed = st.baseSpeed * 0.4;
              st.nextParkAttemptAt = now + PARK_COOLDOWN_MS;
              if (st.pedNode) st.pedNode.setAttribute("opacity", "0");
            }
          }
          node.setAttribute("transform", `translate(${cx.toFixed(2)},${cy.toFixed(2)}) rotate(${pk.angle.toFixed(2)})`);

          // Animation du conducteur : sort, marche en avant, idle, revient
          const ped = st.pedNode;
          if (ped) {
            if (pk.phase === "parked") {
              // Base : position sur le trottoir, à côté de la voiture garée
              // Base : position sur le trottoir, à côté de la voiture garée (zone fixe)
              const baseX = pk.px + (-pk.tdy) * PARK_PED_OFFSET * pk.side;
              const baseY = pk.py + ( pk.tdx) * PARK_PED_OFFSET * pk.side;
              let walkK = 0;
              let facingBack = false;
              if (now < pk.pedReturnAt) {
                // aller : 0 → 1 sur pedWalkMs
                walkK = Math.max(0, Math.min(1, (now - (pk.pedReturnAt - pk.pedWalkMs)) / pk.pedWalkMs));
              } else {
                // retour : 1 → 0 sur ce qui reste avant parkedUntil
                const back = Math.max(400, pk.parkedUntil - pk.pedReturnAt);
                walkK = 1 - Math.max(0, Math.min(1, (now - pk.pedReturnAt) / back));
                facingBack = true;
              }
              const off = walkK * PARK_PED_WALK_PX;
              const px = baseX + pk.tdx * off;
              const py = baseY + pk.tdy * off;
              const pAng = (Math.atan2(pk.tdy, pk.tdx) * 180) / Math.PI + (facingBack ? 180 : 0);
              ped.setAttribute("transform", `translate(${px.toFixed(2)},${py.toFixed(2)}) rotate(${pAng.toFixed(2)})`);
              ped.setAttribute("opacity", "1");
            } else {
              ped.setAttribute("opacity", "0");
            }
          }
          if (st.parking) continue;
        }

        // ===== Trafic normal =====
        const prev = st.s;
        st.s += st.speed * dt;
        if (st.s >= st.pathLen) {
          const newSpec = rerollSpec(st.spec);
          st.spec = newSpec;
          st.pathLen = lens[newSpec.pathIdx];
          st.baseSpeed = st.pathLen / newSpec.duration;
          st.s = 0;
          st.speed = st.baseSpeed;
          const newKey = `${newSpec.pathIdx}:${newSpec.flip ? "r" : "f"}`;
          if (newKey !== st.laneKey) {
            st.laneKey = newKey;
            needsRebuild = true;
          }
        } else if (prev > st.s) {
          st.s = st.s % st.pathLen;
        }
        // CULLING : hors-écran → on n'a pas besoin de calculer la tangente ni
        // d'écrire dans le DOM. La voiture continue d'avancer (st.s) à
        // baseSpeed et sera remise à jour visuellement dès qu'elle réapparaît.
        if (!st.visible) {
          checkRadars(st, prev);
          continue;
        }
        const path = pathRefs.current[st.spec.pathIdx];
        if (!path) continue;
        const lenForward = st.spec.flip ? st.pathLen - st.s : st.s;
        const p = path.getPointAtLength(lenForward);
        const p2 = path.getPointAtLength(Math.min(st.pathLen, lenForward + (st.spec.flip ? -1 : 1)));
        const tdx = p2.x - p.x, tdy = p2.y - p.y;
        const L = Math.hypot(tdx, tdy) || 1;
        const ang = (Math.atan2(tdy, tdx) * 180) / Math.PI;
        const ox = (-tdy / L) * LANE_HALF;
        const oy = (tdx / L) * LANE_HALF;
        node.setAttribute("transform", `translate(${(p.x + ox).toFixed(2)},${(p.y + oy).toFixed(2)}) rotate(${ang.toFixed(2)})`);
        checkRadars(st, prev);
      }
      if (needsRebuild) lanes = rebuildLanes();

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("jce.intervention.request", onIntervention as EventListener);
    };
  }, [activeCars.length]);


  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 3 }}
    >
      <defs>
        {ROADS.map((d, i) => (
          <path
            key={i}
            id={`jce-road-${i}`}
            d={d}
            ref={(el) => {
              pathRefs.current[i] = el;
            }}
          />
        ))}
        <filter id="jce-soft-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>

      <g opacity="0.12">
        {ROADS.map((d, i) => (
          VILLAGE_PATHS.has(i) ? null : (
            <path key={i} d={d} stroke="#0b0d10" strokeWidth={i >= 4 ? 34 : 46} fill="none" strokeLinecap="round" />
          )
        ))}
        {ROADS.slice(0, 4).map((d, i) => (
          VILLAGE_PATHS.has(i) ? null : (
            <path key={`dash-${i}`} d={d} stroke="#f6d56a" strokeWidth="2.4" strokeDasharray="18 18" fill="none" opacity="0.72" />
          )
        ))}
      </g>





      {activeCars.map((car, i) => {
        // Sprite uploadé : image vue du ciel, nez vers ↑.
        // Le moteur calcule rotate(angle) à partir de la tangente (atan2 → 0° = est).
        // On compense avec un rotate(90) interne pour que "haut de l'image" = sens de marche.
        const SPRITE_SIZE = 48 * (car.scale ?? 0.6) * CIVIL_SCALE;
        return (
          <g
            key={i}
            ref={(el) => {
              carNodes.current[i] = el;
            }}
          >
            {car.imageUrl ? (
              <g transform="rotate(90)">
                
                <image
                  href={car.imageUrl}
                  x={-SPRITE_SIZE / 2}
                  y={-SPRITE_SIZE / 2}
                  width={SPRITE_SIZE}
                  height={SPRITE_SIZE}
                  preserveAspectRatio="xMidYMid meet"
                />
              </g>
            ) : (
              <Vehicle kind={car.kind} color={car.color} accent={car.accent} scale={car.scale} variant={car.variant} photoIdx={i} />
            )}
          </g>
        );
      })}



      {/* Conducteurs sortis de leur voiture garée (cachés par défaut, opacity=0) */}
      <g pointerEvents="none">
        {activeCars.map((_, i) => {
          const S = 22;
          return (
            <g
              key={`pd-${i}`}
              opacity="0"
              ref={(el) => { parkPedNodes.current[i] = el; }}
            >
              <ellipse cx="0" cy={S * 0.2} rx={S * 0.35} ry={S * 0.18} fill="rgba(0,0,0,0.45)" />
              <g transform="rotate(90)">
                <image
                  href={getPedPhotoImages()[0]}
                  x={-S / 2}
                  y={-S / 2}
                  width={S}
                  height={S}
                  preserveAspectRatio="xMidYMid meet"
                />
              </g>
            </g>
          );
        })}
      </g>

      {/* Piétons photos qui marchent sur les trottoirs (markets/promeneurs) */}
      <PhotoPedestrians pathRefs={pathRefs} />


      {/* Piétons cartoon SVG retirés — remplacés par les sprites top-down (PhotoPedestrians) */}


      {/* Feux rouges aux intersections + feux piétons synchronisés */}
      {lights.map((l) => {
        // lightsTick force le re-render à chaque frame pour animer la couleur
        void lightsTick;
        const st = getLightState(l, nowSeconds());
        const red = st === "red", orange = st === "orange", green = st === "green";
        // Feu piéton : vert uniquement quand le feu voiture est rouge.
        const pedGreen = red;
        const pedColor = pedGreen ? "#22e36a" : "#ff2a2a";
        return (
          <g key={`tl-${l.id}`} transform={`translate(${l.x},${l.y}) scale(1.6)`} pointerEvents="none">
            <ellipse cx="0" cy="14" rx="14" ry="4" fill="rgba(0,0,0,0.45)" />
            <rect x="-7" y="-22" width="14" height="36" rx="3" fill="#0e1217" stroke="#000" strokeWidth="1" />
            <circle cx="0" cy="-14" r="3.4" fill={red ? "#ff2a2a" : "#2a0808"} opacity={red ? 1 : 0.4}>
              {red && <animate attributeName="r" values="3.4;4.2;3.4" dur="1s" repeatCount="indefinite" />}
            </circle>
            <circle cx="0" cy="-4"  r="3.4" fill={orange ? "#ffb020" : "#2a1a00"} opacity={orange ? 1 : 0.4} />
            <circle cx="0" cy="6"   r="3.4" fill={green ? "#22e36a" : "#0a2a14"} opacity={green ? 1 : 0.4} />
            {/* halo lumineux la nuit */}
            {night > 0.4 && (
              <circle cx="0" cy={red ? -14 : orange ? -4 : 6} r="10"
                fill={red ? "#ff2a2a" : orange ? "#ffb020" : "#22e36a"}
                opacity={night * 0.35} />
            )}
            {/* Feu piéton — pictogramme à côté du feu voiture */}
            <g transform="translate(16,-6)">
              <rect x="-5" y="-9" width="10" height="18" rx="2" fill="#0e1217" stroke="#000" strokeWidth="0.8" />
              <g fill={pedColor}>
                <circle cx="0" cy="-5" r="1.4" />
                {pedGreen ? (
                  <>
                    <rect x="-0.8" y="-3.6" width="1.6" height="4" rx="0.4" />
                    <rect x="-2.2" y="0.4" width="1.4" height="3" rx="0.4" transform="rotate(-18 -1.5 1.9)" />
                    <rect x="0.8" y="0.4" width="1.4" height="3" rx="0.4" transform="rotate(18 1.5 1.9)" />
                  </>
                ) : (
                  <>
                    <rect x="-1" y="-3.6" width="2" height="4.2" rx="0.5" />
                    <rect x="-1.6" y="0.6" width="1.4" height="3" rx="0.4" />
                    <rect x="0.2" y="0.6" width="1.4" height="3" rx="0.4" />
                  </>
                )}
              </g>
              {pedGreen && night > 0.4 && (
                <circle r="7" fill="#22e36a" opacity={night * 0.35} />
              )}
            </g>
            {/* Passages piétons (zébras) aux 4 côtés de l'intersection */}
            <g opacity="0.65" pointerEvents="none">
              {/* Sud */}
              {[-12, -6, 0, 6, 12].map((ox) => (
                <rect key={`s${ox}`} x={ox - 1.5} y={20} width="3" height="14" fill="#f4f4f4" rx="0.5" />
              ))}
              {/* Nord */}
              {[-12, -6, 0, 6, 12].map((ox) => (
                <rect key={`n${ox}`} x={ox - 1.5} y={-34} width="3" height="14" fill="#f4f4f4" rx="0.5" />
              ))}
              {/* Est */}
              {[-12, -6, 0, 6, 12].map((oy) => (
                <rect key={`e${oy}`} x={20} y={oy - 1.5} width="14" height="3" fill="#f4f4f4" rx="0.5" />
              ))}
              {/* Ouest */}
              {[-12, -6, 0, 6, 12].map((oy) => (
                <rect key={`w${oy}`} x={-34} y={oy - 1.5} width="14" height="3" fill="#f4f4f4" rx="0.5" />
              ))}
            </g>
          </g>
        );
      })}

      {/* Plus aucun piéton ne marche/traverse sur la chaussée — exigence joueur. */}

      {/* Radars retirés à la demande du joueur. */}


      <rect width="1920" height="1080" fill="#0a1530" opacity={Math.max(0, (night - 0.15)) * 0.55} pointerEvents="none" />
    </svg>
  );
}