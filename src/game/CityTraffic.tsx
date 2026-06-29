import { useEffect, useMemo, useRef, useState } from "react";
import { useAdminConfig } from "./adminConfig";
import { getPedestrianPhotoUrls, listCustomVehicles, getCivilCarUrls, type CustomVehicleCategory } from "./gameAssets";
import { VehicleSvg, type VehicleSvgKind } from "./vehicles/VehicleSvgs";
import {
  initTrafficLights,
  getTrafficLights,
  getLightState,
  nowSeconds,
  type TrafficLight,
} from "./trafficLights";
import { getGameTime } from "./cityClock";
import { densityMult, isUltraLite, perfTier, reduceMotion, targetFps, trafficBudget } from "@/lib/perf";
import { buildRoadCache, getRoadPoint, hasRoadCache, type CachedRoad } from "./RoadCache";


// Dynamique : inclut les piétons custom uploadés via le panel admin.
// Recalculé à chaque appel — les composants qui en dépendent écoutent
// 'jce.customPedestrians.changed' pour re-render.
const getPedPhotoImages = () => getPedestrianPhotoUrls();

// Plus aucun path n'est interdit : toutes les routes de la map sont utilisées
// par le trafic civil, les courses taxi et les concurrents. On conserve
// l'export pour la compat avec TaxiTycoon (qui filtre via cet ensemble).
// Index 1 = petite arche tout en haut (y≈0-90) : off-screen en portrait,
// les voitures semblaient "voler". On l'exclut du trafic et on ne la
// dessine plus comme route (ci-dessous dans le rendu).
export const VILLAGE_PATHS = new Set<number>();

// === SÉPARATION DES VOIES (code de la route) ===
// Demi-largeur d'une route ≈ 23 px. On place chaque véhicule à LANE_HALF px
// du centre, à DROITE de son sens de marche. Les véhicules en sens inverse
// se retrouvent donc de l'autre côté du centre → voies séparées strictes,
// plus aucun contre-sens visuel.
// Demi-largeur d'une route principale ≈ 23 px (stroke 46). Chaque voie
// tient ~11 px de chaque côté de l'axe → LANE_HALF=11 place les véhicules
// pile au milieu de leur voie, sans déborder sur la voie d'en face.
const LANE_HALF = 11;

/* eslint-disable prettier/prettier */

/* ============================================================
 * JUNKY CITY EMPIRE — overlay aligné sur citymap.jpg
 * IMPORTANT : le SVG utilise le même ratio que l'image 1920x1080.
 * Avec preserveAspectRatio="xMidYMid slice", les voitures restent
 * calées sur les routes même en mobile recadré.
 * ============================================================ */

// Trajectoires auto-calibrées : extraites par squelettisation du masque
// asphalte de citymap.jpg (1920x1080), simplifiées en courbes quadratiques.
// Chaque path suit STRICTEMENT le bitume visible — aucune sortie sur
// chantiers, parkings, toits ou bâtiments.
export const ROADS = [
  // 0 : Axe vertical principal — du haut vers le bas, côté droit du rond-point
  "M 879 0 L 879 479 A 112 112 0 0 1 991 591 L 1920 591",
  // 1 : Axe vertical principal — du bas vers le haut, côté gauche du rond-point
  "M 879 1080 L 879 703 A 112 112 0 0 0 767 591 L 0 591",
  // 2 : Sortie parking TAXI WORLD → rond-point
  "M 520 60 L 520 200 L 684 200 L 684 309 C 684 400 750 479 820 520 A 112 112 0 0 1 879 479",
  // 3 : Rond-point → retour parking
  "M 879 479 A 112 112 0 0 0 820 520 C 750 479 684 400 684 309 L 684 200 L 520 200 L 520 60",
  // 4 : Diagonale haut-droite (intersection haut-droite)
  "M 1920 200 L 1200 200 L 991 380 A 112 112 0 0 1 991 591 L 1920 591",
  // 5 : Route bas-gauche vers bas de la map
  "M 0 591 L 767 591 A 112 112 0 0 1 767 703 L 500 900 L 300 1080",
];

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
// Offset 42 = trottoir large, jamais sur la chaussée même en intersection.
const PHOTO_PED_OFFSET = 42;
const PHOTO_PED_MIN_OFFSET = 38; // jamais plus près de l'axe que ça (anti-glissement chaussée)
// Rayon autour d'un feu où le piéton doit respecter le passage piéton.
const PED_CROSSING_RADIUS = 44;


/** Verrouille une coordonnée XY sur le trottoir : si elle est plus proche
 *  de l'axe que `SIDEWALK_LOCK_OFFSET`, on la repousse vers `side`. */
// Cache pré-calculé des points de chemin — évite getPointAtLength dans la boucle RAF
const PEDESTRIAN_SAMPLES = 300;
type PathCache = CachedRoad;

function buildPathCache(path: SVGPathElement, samples: number): PathCache {
  const len = path.getTotalLength();
  const points = [];
  for (let i = 0; i <= samples; i++) {
    const s = (i / samples) * len;
    const p = path.getPointAtLength(s);
    const p2 = path.getPointAtLength(Math.min(len, s + 2));
    const dx = p2.x - p.x; const dy = p2.y - p.y;
    const L = Math.hypot(dx, dy) || 1;
    points.push({ x: p.x, y: p.y, angle: (Math.atan2(dy, dx) * 180) / Math.PI, nx: -dy / L, ny: dx / L });
  }
  return { length: len, points };
}

function sampleCache(cache: PathCache, s: number) {
  const frac = Math.max(0, Math.min(1, s / cache.length));
  return cache.points[Math.min(cache.points.length - 1, Math.floor(frac * (cache.points.length - 1)))];
}

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
  const pedSpecs = isUltraLite() ? [] : (perfTier() === "low" ? PHOTO_PEDS.slice(0, 3) : PHOTO_PEDS);
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
    if (pedSpecs.length === 0) return;
    const caches: (PathCache | null)[] = pathRefs.current.map(p =>
      p ? buildPathCache(p, PEDESTRIAN_SAMPLES) : null
    );
    const states = pedSpecs.map(spec => ({
      spec, pathLen: lens[spec.pathIdx], s: spec.startFrac * lens[spec.pathIdx],
    }));
    let last = performance.now();
    let raf = 0;
    const PED_INTERVAL = 1000 / Math.min(30, targetFps());
    let lastPedFrame = 0;
    const tSec = nowSeconds();
    const lights = getTrafficLights();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (now - lastPedFrame < PED_INTERVAL) { raf = requestAnimationFrame(step); return; }
      lastPedFrame = now;
      for (let i = 0; i < states.length; i++) {
        const st = states[i];
        const node = nodes.current[i];
        const cache = caches[st.spec.pathIdx];
        if (!cache || !node) continue;
        const cur = sampleCache(cache, st.s);
        let blocked = false;
        for (const l of lights) {
          const dx0 = l.x - cur.x, dy0 = l.y - cur.y;
          if (dx0 * dx0 + dy0 * dy0 < PED_CROSSING_RADIUS * PED_CROSSING_RADIUS) {
            if (getLightState(l, tSec) !== "red") { blocked = true; break; }
          }
        }
        if (!blocked) st.s = (st.s + st.spec.speed * dt) % st.pathLen;
        const p = sampleCache(cache, st.s);
        if (p.x < -200 || p.x > 2120 || p.y < -200 || p.y > 1280) continue;
        const L = Math.hypot(p.nx, p.ny) || 1;
        const nx = -p.ny / L * PHOTO_PED_OFFSET * st.spec.side;
        const ny = p.nx / L * PHOTO_PED_OFFSET * st.spec.side;
        const ang = p.angle;
        let px = p.x + nx, py = p.y + ny;
        const signedDist = ((px - p.x) * (-p.ny / L) + (py - p.y) * (p.nx / L)) * st.spec.side;
        if (signedDist < PHOTO_PED_MIN_OFFSET) {
          px = p.x + (-p.ny / L) * PHOTO_PED_MIN_OFFSET * st.spec.side;
          py = p.y + (p.nx / L) * PHOTO_PED_MIN_OFFSET * st.spec.side;
        }
        node.setAttribute("transform", `translate(${px.toFixed(1)},${py.toFixed(1)}) rotate(${ang.toFixed(1)})`);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathRefs, pedSpecs.length]);
  if (pedSpecs.length === 0) return null;
  return (
    <g pointerEvents="none">
      {pedSpecs.map((spec, i) => {
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

type CarState = {
  spec: CarSpec;
  pathLen: number;
  baseSpeed: number;   // px/s à allure libre
  s: number;           // progression linéaire le long du path (px), repère "avant"
  speed: number;       // px/s instantanée
  laneKey: string;     // pathIdx + sens -> regroupe les véhicules qui peuvent se gêner
  node: SVGGElement | null;
  visible?: boolean;             // CULLING : dans le viewport visible (+ marge)
};

// Catégories autorisées dans le trafic libre : uniquement les civils & véhicules
// de service. Police / ambulance / pompiers ne roulent QUE sur intervention
// (cf. EmergencyStations + InterventionDispatcher) → ils restent à leur QG
// le reste du temps.
const TRAFFIC_CATEGORIES: CustomVehicleCategory[] = [
  "civil", "service",
];

function buildCarsFromCustom(count?: number): CarSpec[] {
  const customs = listCustomVehicles().filter(v => TRAFFIC_CATEGORIES.includes(v.category));
  // Paths autorisés : tout sauf "village".
  const allowedPaths: number[] = [];
  for (let i = 0; i < ROADS.length; i++) if (!VILLAGE_PATHS.has(i)) allowedPaths.push(i);

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
  const tier = perfTier();
  const reducedFx = reduceMotion();
  const admin = useAdminConfig();
  const [customTick, setCustomTick] = useState(0);
  // Re-render quand le joueur ajoute/supprime un véhicule custom.
  useEffect(() => {
    const onChange = () => setCustomTick(t => t + 1);
    window.addEventListener("jce.customVehicles.changed", onChange);
    return () => window.removeEventListener("jce.customVehicles.changed", onChange);
  }, []);
  // Trafic civil réactivé avec un budget agressivement limité par perfTier.
  // Le bug réel qui faisait ramer (setState pendant le rendu) a été corrigé ;
  // on peut donc remettre quelques civils et piétons.
  void admin;
  const desiredCars = isUltraLite() ? 4 : tier === "low" ? 8 : tier === "mid" ? 14 : 22;
  const carBudget = trafficBudget(desiredCars);
  const activeCars = useMemo<CarSpec[]>(() => buildCarsFromCustom(carBudget), [carBudget, customTick]);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const carNodes = useRef<(SVGGElement | null)[]>([]);
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
  // PERF : on n'a pas besoin de 60 setState/s pour la nuit ; un rafraîchissement
  // toutes les 250 ms est totalement invisible à l'œil et libère le main thread.
  useEffect(() => {
    let last = 0;
    const id = window.setInterval(() => {
      const now = performance.now();
      if (now - last < 240) return;
      last = now;
      const t = (now % 300000) / 300000;
      const daylight = Math.max(0, Math.sin(t * Math.PI * 2 + Math.PI / 2));
      setNight(0.1 + (1 - daylight) * 0.6);
      setLightsTick(v => (v + 1) % 1000000);
    }, tier === "ultra" || tier === "low" ? 1000 : 500);
    return () => window.clearInterval(id);
  }, []);



  // Boucle de trafic : positions JS pilotées avec freinage progressif.
  useEffect(() => {
    // Mesurer les longueurs réelles des paths.
    const lens = pathRefs.current.map((p: SVGPathElement | null) => (p ? p.getTotalLength() : 1));
    if (lens.some((l: number) => l <= 1)) return;

    // Initialise les feux rouges (singleton partagé avec TaxiTycoon).
    initTrafficLights(pathRefs.current, lens);
    setLights(getTrafficLights());

    // ✅ Pré-calcul des caches une seule fois
    const TRAFFIC_SAMPLES = 420;
    const pathCaches: (PathCache | null)[] = pathRefs.current.map(p =>
      p ? buildPathCache(p, TRAFFIC_SAMPLES) : null
    );

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
      };
    });

    // Radars retirés : noop pour préserver l'API d'appel dans la boucle.
    const checkRadars = (_st: CarState, _prev: number) => {};


    let last = performance.now();
    let raf = 0;
    // 30 fps suffit largement pour du trafic vu de haut, ça divise le coût CPU
    // par 2 sur les smartphones d'entrée de gamme (Xiaomi, Redmi, etc.).
    const MIN_FRAME = 1000 / targetFps();
    let lastDensityCheck = 0;
    let activeCount = states.length;
    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      if (now - last < MIN_FRAME) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (now - lastDensityCheck > 4000) {
        lastDensityCheck = now;
        const gt = getGameTime();
        // Beaucoup de monde le jour, trafic très réduit la nuit.
        const ratio = Math.max(0.12, Math.min(1, gt.density / 1.2));
        // densityMult ramène l'effectif sur appareils low-end (≈35%).
        activeCount = Math.max(1, Math.round(states.length * ratio * densityMult()));
      }


      const vr = visibleRect.current;
      for (let i = 0; i < states.length; i++) {
        const st = states[i];
        const path = pathRefs.current[st.spec.pathIdx];
        const densityVisible = i < activeCount;
        if (!path || !densityVisible) {
          st.visible = false;
          if (st.node) st.node.setAttribute("opacity", "0");
          continue;
        }
        const cache = pathCaches[st.spec.pathIdx];
        const fwd = st.spec.flip ? st.pathLen - st.s : st.s;
        const p = cache ? sampleCache(cache, fwd) : null;
        if (!p) { st.visible = false; if (st.node) st.node.setAttribute("opacity", "0"); continue; }
        st.visible = p.x >= vr.minX && p.x <= vr.maxX && p.y >= vr.minY && p.y <= vr.maxY;
        if (st.node) st.node.setAttribute("opacity", st.visible ? "1" : "0");
        st.speed = st.baseSpeed;
      }

      // Spacing pass : on garde une distance min entre voitures d'une même voie.
      // Évite que les voitures se collent / se traversent visuellement.
      const MIN_GAP = 70;
      const BRAKE_GAP = 140;
      const lanesMap = new Map<string, CarState[]>();
      for (const st of states) {
        if (!st.visible) continue;
        const arr = lanesMap.get(st.laneKey);
        if (arr) arr.push(st); else lanesMap.set(st.laneKey, [st]);
      }
      for (const arr of lanesMap.values()) {
        if (arr.length < 2) continue;
        arr.sort((a, b) => a.s - b.s);
        for (let i = 0; i < arr.length; i++) {
          const me = arr[i];
          const next = arr[(i + 1) % arr.length];
          let gap = next.s - me.s;
          if (gap <= 0) gap += me.pathLen;
          if (gap < MIN_GAP) me.speed = 0;
          else if (gap < BRAKE_GAP) {
            const k = (gap - MIN_GAP) / (BRAKE_GAP - MIN_GAP);
            me.speed = me.baseSpeed * k;
          }
        }
      }


      let needsRebuild = false;
      for (const st of states) {
        const node = st.node;
        if (!node) continue;
        // ===== Trafic normal =====
        const prev = st.s;
        st.s += st.speed * dt;
        // En bout de path → demi-tour sur place (inversion du sens), pas de saut
        // à l'autre extrémité de la carte.
        if (st.s >= st.pathLen) {
          st.s = st.pathLen;
          st.spec = { ...st.spec, flip: !st.spec.flip };
          const newKey = `${st.spec.pathIdx}:${st.spec.flip ? "r" : "f"}`;
          if (newKey !== st.laneKey) {
            st.laneKey = newKey;
            needsRebuild = true;
          }
          st.s = 0; // repart depuis l'autre bout, mais visuellement c'est le même point (demi-tour)
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
        const cache2 = pathCaches[st.spec.pathIdx];
        if (!cache2) continue;
        const lenForward = st.spec.flip ? st.pathLen - st.s : st.s;
        const pt = sampleCache(cache2, lenForward);
        const L = 1;
        const ang = pt.angle;
        const side = st.spec.flip ? -1 : 1;
        const ox = pt.nx * LANE_HALF * side;
        const oy = pt.ny * LANE_HALF * side;
        node.setAttribute("transform", `translate(${(pt.x + ox).toFixed(1)},${(pt.y + oy).toFixed(1)}) rotate(${ang.toFixed(1)})`);
        checkRadars(st, prev);
      }
      void needsRebuild;
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [activeCars]);


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
      {/* Piétons réactivés — désactivés uniquement en mode ultra-lite */}
      {!isUltraLite() && <PhotoPedestrians pathRefs={pathRefs} />}


      {/* Piétons cartoon SVG retirés — remplacés par les sprites top-down (PhotoPedestrians) */}


      {/* Feux rouges aux intersections + feux piétons synchronisés */}
      {lights.map((l) => {
        // lightsTick force le re-render à chaque frame pour animer la couleur
        void lightsTick;
        const st = getLightState(l, nowSeconds());
        const red = st === "red", orange = st === "orange", green = st === "green";
        // Feu piéton : vert uniquement quand le feu voiture est rouge.
        const pedGreen = red;
        void pedGreen;
        return (
          <g key={`tl-${l.id}`} transform={`translate(${l.x},${l.y}) scale(1.6)`} pointerEvents="none">
            <ellipse cx="0" cy="14" rx="14" ry="4" fill="rgba(0,0,0,0.45)" />
            <rect x="-7" y="-22" width="14" height="36" rx="3" fill="#0e1217" stroke="#000" strokeWidth="1" />
            <circle cx="0" cy="-14" r="3.4" fill={red ? "#ff2a2a" : "#2a0808"} opacity={red ? 1 : 0.4}>
              {red && !reducedFx && <animate attributeName="r" values="3.4;4.2;3.4" dur="1s" repeatCount="indefinite" />}
            </circle>
            <circle cx="0" cy="-4"  r="3.4" fill={orange ? "#ffb020" : "#2a1a00"} opacity={orange ? 1 : 0.4} />
            <circle cx="0" cy="6"   r="3.4" fill={green ? "#22e36a" : "#0a2a14"} opacity={green ? 1 : 0.4} />
            {/* halo lumineux la nuit */}
            {night > 0.4 && (
              <circle cx="0" cy={red ? -14 : orange ? -4 : 6} r="10"
                fill={red ? "#ff2a2a" : orange ? "#ffb020" : "#22e36a"}
                opacity={night * 0.35} />
            )}
            {/* Feu piéton — retiré en ultra-léger pour réduire les nœuds SVG */}
            {!reducedFx && <g transform="translate(18,-4)">
              {/* Boîtier noir */}
              <rect x="-7" y="-13" width="14" height="26" rx="2.5" fill="#0a0c10" stroke="#000" strokeWidth="0.8" />
              {/* Écran rouge (ne pas marcher) */}
              <rect x="-5.5" y="-11.5" width="11" height="11" rx="1.2" fill={pedGreen ? "#2a0808" : "#1a0303"} />
              {/* Écran vert (marcher) */}
              <rect x="-5.5" y="0.5" width="11" height="11" rx="1.2" fill={pedGreen ? "#062a14" : "#06160c"} />
              {pedGreen ? (
                // ▶ MARCHE : silhouette "walking man" verte, animée
                <g fill="#22e36a" transform="translate(0,6)">
                  <circle cx="0" cy="-4.5" r="1.3" />
                  {/* Torse incliné */}
                  <rect x="-1" y="-3.2" width="2" height="3.6" rx="0.5" transform="rotate(-8)" />
                  {/* Bras */}
                  <rect x="-2.6" y="-2.6" width="1.1" height="2.6" rx="0.4" transform="rotate(-35 -2 -1.3)" />
                  <rect x="1.5" y="-2.6" width="1.1" height="2.6" rx="0.4" transform="rotate(30 2 -1.3)" />
                  {/* Jambes en mouvement */}
                  <rect x="-1.6" y="0.2" width="1.3" height="3.4" rx="0.4" transform="rotate(-20 -1 1.9)">
                    <animateTransform attributeName="transform" type="rotate" values="-25 -1 1.9;0 -1 1.9;-25 -1 1.9" dur="0.6s" repeatCount="indefinite" />
                  </rect>
                  <rect x="0.3" y="0.2" width="1.3" height="3.4" rx="0.4" transform="rotate(25 1 1.9)">
                    <animateTransform attributeName="transform" type="rotate" values="25 1 1.9;0 1 1.9;25 1 1.9" dur="0.6s" repeatCount="indefinite" />
                  </rect>
                  {night > 0.4 && <circle r="7" fill="#22e36a" opacity={night * 0.45} />}
                </g>
              ) : (
                // ✋ NE PAS MARCHER : main rouge levée (style US "DON'T WALK")
                <g fill="#ff2a2a" transform="translate(0,-6)">
                  {/* Paume */}
                  <path d="M -3 -1 Q -3 -4.2 0 -4.2 Q 3 -4.2 3 -1 L 3 2.6 Q 3 4 1.6 4 L -1.6 4 Q -3 4 -3 2.6 Z" />
                  {/* Poignet */}
                  <rect x="-1.6" y="3.4" width="3.2" height="2" rx="0.5" />
                  {/* Doigts (4 traits) */}
                  <rect x="-2.4" y="-4.2" width="0.9" height="2.4" rx="0.3" />
                  <rect x="-1.2" y="-4.8" width="0.9" height="3" rx="0.3" />
                  <rect x="0.3" y="-4.8" width="0.9" height="3" rx="0.3" />
                  <rect x="1.5" y="-4.2" width="0.9" height="2.4" rx="0.3" />
                  {night > 0.4 && <circle r="7" fill="#ff2a2a" opacity={night * 0.4} />}
                </g>
              )}
            </g>}
            {/* Passages piétons (zébras) aux 4 côtés de l'intersection */}
            {!reducedFx && <g opacity="0.65" pointerEvents="none">
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
            </g>}
          </g>
        );
      })}

      {/* Plus aucun piéton ne marche/traverse sur la chaussée — exigence joueur. */}

      {/* Radars retirés à la demande du joueur. */}


      <rect width="1920" height="1080" fill="#0a1530" opacity={Math.max(0, (night - 0.15)) * 0.55} pointerEvents="none" />
    </svg>
  );
}