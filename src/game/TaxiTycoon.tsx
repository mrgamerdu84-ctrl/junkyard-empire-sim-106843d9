import { useEffect, useMemo, useRef, useState } from "react";
import { ROADS, VILLAGE_PATHS } from "./CityTraffic";
import taxiYellowAsset from "@/assets/taxi-yellow-top.png";
import taxiBlackAsset from "@/assets/taxi-black-top.png";
import taxiRedAsset from "@/assets/taxi-red-top.png";
import musicAsset from "@/assets/midnight-fare.mp3.asset.json";
import { shouldStopAhead, nowSeconds } from "./trafficLights";
import { getAdmin, useAdminConfig } from "./adminConfig";

const TAXI_YELLOW_URL = taxiYellowAsset;
const TAXI_BLACK_URL = taxiBlackAsset;
const TAXI_RED_URL = taxiRedAsset;
const MUSIC_URL = musicAsset.url;

/* ============================================================
 * TAXI TYCOON — entreprise de taxis idle
 * Le neveu hérite d'un entrepôt délabré. Les taxis sortent du dépôt,
 * vont chercher les clients qui spawnent sur la map, les déposent,
 * encaissent. Le joueur achète des taxis, améliore le dépôt, repeint.
 * ============================================================ */

export type DepotTier = {
  name: string;
  cost: number;
  maxTaxis: number;
  fareMult: number;
  spawnEvery: number; // secondes
  badge: string;
  ring: string;
  core: string;
  flag: string;
};

const DEPOT_TIERS: DepotTier[] = [
  { name: "GARAGE ABANDONNÉ", cost: 0,     maxTaxis: 1,  fareMult: 1.0, spawnEvery: 8.0, badge: "🏚️", ring: "#5a4030", core: "#3a2a1f", flag: "#7a5030" },
  { name: "ATELIER ROUILLÉ",  cost: 1500,  maxTaxis: 2,  fareMult: 1.3, spawnEvery: 6.5, badge: "🔧", ring: "#7a5a35", core: "#4a3a25", flag: "#c08a3a" },
  { name: "GARAGE RÉNOVÉ",    cost: 7500,  maxTaxis: 4,  fareMult: 1.7, spawnEvery: 5.0, badge: "🏢", ring: "#a07a4a", core: "#604832", flag: "#e8b850" },
  { name: "STATION MODERNE",  cost: 35000, maxTaxis: 7,  fareMult: 2.2, spawnEvery: 3.8, badge: "🏬", ring: "#3a8ad0", core: "#1f4a7a", flag: "#5cb8ff" },
  { name: "QG TAXICORP",      cost: 150000,maxTaxis: 12, fareMult: 3.2, spawnEvery: 2.6, badge: "🏛️", ring: "#f5c542", core: "#7a5a10", flag: "#fde68a" },
];

export const TAXI_COLORS = [
  { id: "yellow", name: "Jaune", body: "#f5c542", trim: "#9c7a1c" },
];

type TaxiMode = "idle" | "to_pickup" | "to_dest" | "returning" | "to_gas" | "refueling";
type Taxi = {
  id: number;
  pathIdx: number;    // path actuel emprunté (0..ROADS.length-1)
  pos: number;        // longueur le long du path actuel
  target: number;
  mode: TaxiMode;
  speed: number;
  colorId: string;
  jobId: number | null;
  fuel: number;       // 0..100
  refuelUntil?: number; // timestamp ms : fin du remplissage
};

type JobStatus = "offered" | "accepted";
type Job = {
  id: number;
  pickupPath: number;
  pickup: number;       // longueur sur pickupPath
  dropoffPath: number;
  dropoff: number;      // longueur sur dropoffPath
  fare: number;
  deadline: number;     // epoch ms — quand le client annule s'il n'est pas accepté
  duration: number;     // ms (pour la barre)
  status: JobStatus;
  sidePickup: 1 | -1;
  sideDrop: 1 | -1;
  acceptedAt?: number;
};

const DEFAULT_DEPOT_POS = 0.78; // fallback si mode "suit le circuit" (legacy)
const SAVE_KEY = "taxi-tycoon-v4";
const BASE_SPEED = 60; // px (sur viewBox 1920) par seconde
const SPEED_UPGRADE_COST_BASE = 800;
const TAXI_COST_BASE = 600;
const MAX_JOBS_BASE = 3;
const FUEL_REFILL_MS = 4000;
const FUEL_LOW_THRESHOLD = 25;

// === Livrées de taxi inspirées de vraies compagnies (yellow body only) ===
export type Livery = {
  id: string;
  name: string;
  city: string;
  roofLabel: string;
  roofBg: string;
  roofFg: string;
  stripe: "checker" | "band" | "dots" | "none";
  stripeColor: string;
  image: string;
  faceRight: boolean; // true if image's car nose points right
};

export const LIVERIES: Livery[] = [
  { id: "classic",  name: "Classic Cab",   city: "Origine",     roofLabel: "TAXI",      roofBg: "#1a1d22", roofFg: "#fde047", stripe: "none",    stripeColor: "#1a1d22", image: TAXI_YELLOW_URL, faceRight: true  },
  { id: "executive", name: "Executive",    city: "Berline noire", roofLabel: "VIP",     roofBg: "#0a0c10", roofFg: "#fde047", stripe: "none",    stripeColor: "#0a0c10", image: TAXI_BLACK_URL,  faceRight: false },
  { id: "sport",    name: "Sport Cab",     city: "Coupé rouge",  roofLabel: "TAXI",     roofBg: "#1a1d22", roofFg: "#ffffff", stripe: "none",    stripeColor: "#1a1d22", image: TAXI_RED_URL,    faceRight: false },
];

type SaveData = {
  money: number;
  customersServed: number;
  totalEarned: number;
  depotTier: number;
  taxiSpeedLvl: number;
  taxis: { colorId: string }[];
  defaultColor: string;
  jobsCompleted: number;
  liveryId: string;
  // ====== Boutique QG ======
  hqCapacityLvl: number;   // +1 taxi de capacité par niveau (0..5)
  hqProductionLvl: number; // -15% cooldown sortie par niveau (0..5)
  hqRevenueLvl: number;    // +10% revenu par niveau (0..5)
};

const HQ_UPGRADE_MAX = 5;
const HQ_UPGRADE_BASE_COST = { capacity: 1200, production: 1500, revenue: 2000 } as const;

const DEFAULT_SAVE: SaveData = {
  money: 250,
  customersServed: 0,
  totalEarned: 0,
  depotTier: 0,
  taxiSpeedLvl: 0,
  taxis: [{ colorId: "yellow" }],
  defaultColor: "yellow",
  jobsCompleted: 0,
  liveryId: "classic",
  hqCapacityLvl: 0,
  hqProductionLvl: 0,
  hqRevenueLvl: 0,
};


function loadSave(): SaveData {
  if (typeof window === "undefined") return DEFAULT_SAVE;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return DEFAULT_SAVE;
    return { ...DEFAULT_SAVE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SAVE;
  }
}

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 10_000) return Math.round(n / 1000) + "k";
  return Math.round(n).toLocaleString("fr-FR");
}

function TaxiSprite({
  withClient,
  moving,
  image,
  faceRight,
  size = 48,
}: {
  withClient: boolean;
  moving: boolean;
  image: string;
  faceRight: boolean;
  size?: number;
}) {
  // Side-view PNG on transparent square. Car body fills ~70% of width and
  // sits horizontally centered in the source — so we draw it large and let
  // the transparent padding overflow the road; SVG image origin is the car center.
  const S = size;
  return (
    <g>
      {/* Shadow under the car body (visible car ~60% of sprite width) */}
      <ellipse cx="0" cy={S * 0.04} rx={S * 0.34} ry={S * 0.07} fill="rgba(0,0,0,0.5)" />
      <g>
        {moving && (
          <animateTransform attributeName="transform" type="translate" values="0 -0.3; 0 0.3; 0 -0.3" dur="0.22s" repeatCount="indefinite" />
        )}
        <g transform={faceRight ? "rotate(90)" : "rotate(-90)"}>
          <image href={image} x={-S / 2} y={-S / 2} width={S} height={S} preserveAspectRatio="xMidYMid meet" />
        </g>
        {withClient && (
          <g transform="translate(0,-4)">
            <circle r="3" fill="#ffd9b0" stroke="#1a1d22" strokeWidth="0.5" />
          </g>
        )}
      </g>
    </g>
  );
}




function Depot({ tier, x, y, scale = 1, rotation = 0, capLvl = 0, revLvl = 0, prodLvl = 0, night = 0 }: { tier: DepotTier; x: number; y: number; scale?: number; rotation?: number; capLvl?: number; revLvl?: number; prodLvl?: number; night?: number }) {
  // QG "Garage industriel chic" — SVG vue du ciel.
  // Évolue avec les upgrades : places parking (cap), néons (rev), enseigne lumineuse (prod).
  const W = 260;
  const H = 260;
  const _tier = tier; void _tier;
  const lit = night > 0.35;
  const neonOp = 0.55 + 0.09 * revLvl; // plus de revLvl = néons + lumineux
  const slots = 4 + capLvl; // 4..9 places
  const slotW = (W - 60) / slots;
  return (
    <g transform={`translate(${x},${y}) scale(${scale}) rotate(${rotation})`}>
      {/* ombre */}
      <ellipse cx="0" cy={H / 2 - 8} rx={W / 2 + 6} ry="18" fill="rgba(0,0,0,0.5)" />

      {/* Dalle béton + marquages */}
      <rect x={-W / 2} y={-H / 2} width={W} height={H} rx="6" fill="#2a2d33" stroke="#0a0b0d" strokeWidth="2" />
      {/* Hachures bordure */}
      <g opacity="0.55">
        {Array.from({ length: 18 }).map((_, i) => (
          <rect key={i} x={-W / 2 + i * (W / 18)} y={-H / 2} width={W / 36} height="6" fill="#f5c542" />
        ))}
      </g>

      {/* Bâtiment principal (atelier toit plat) */}
      <rect x={-W / 2 + 16} y={-H / 2 + 22} width={W - 32} height={H / 2 - 10} rx="3" fill="#3a3e46" stroke="#0a0b0d" strokeWidth="1.5" />
      {/* Skylights */}
      {[0, 1, 2, 3].map(i => (
        <rect key={i} x={-W / 2 + 30 + i * ((W - 60) / 4)} y={-H / 2 + 34} width={(W - 80) / 4} height="14" rx="1" fill={lit ? "#ffe48a" : "#7d8390"} opacity={lit ? 0.95 : 0.6} />
      ))}
      {/* Cheminée d'aération */}
      <circle cx={W / 2 - 36} cy={-H / 2 + 32} r="6" fill="#1a1d22" stroke="#000" strokeWidth="1" />
      <circle cx={W / 2 - 36} cy={-H / 2 + 32} r="2.5" fill="#5a5f68" />

      {/* Enseigne au sol */}
      <rect x={-70} y={-H / 2 + 6} width={140} height={14} rx="3" fill="#0a0b0d" stroke={lit ? "#f5c542" : "#7a5f1a"} strokeWidth="1.5" opacity={lit ? neonOp + 0.3 : 0.9} />
      <text x="0" y={-H / 2 + 16} fontSize="11" fontWeight="900" textAnchor="middle" fill={lit ? "#fff7c0" : "#f5c542"} letterSpacing="2" style={{ filter: lit ? "drop-shadow(0 0 4px #f5c542)" : undefined }}>TAXI HQ</text>

      {/* Parvis : places de parking taxis (visibles, jaunes) */}
      <g>
        {Array.from({ length: slots }).map((_, i) => {
          const px = -W / 2 + 30 + i * slotW + slotW / 2;
          const py = 30;
          return (
            <g key={i}>
              <rect x={px - slotW / 2 + 3} y={py - 18} width={slotW - 6} height="36" rx="2" fill="#1f2228" stroke="#f5c542" strokeWidth="1.2" strokeDasharray="3 2" opacity="0.9" />
              {/* numéro */}
              <text x={px} y={py + 24} fontSize="6" textAnchor="middle" fill="#f5c542" opacity="0.6">{String(i + 1).padStart(2, "0")}</text>
            </g>
          );
        })}
      </g>

      {/* Bandes de circulation au sol (entrée / sortie) */}
      <path d={`M ${-W / 2 + 8} ${H / 2 - 14} L ${W / 2 - 8} ${H / 2 - 14}`} stroke="#f5c542" strokeWidth="2" strokeDasharray="8 6" opacity="0.7" />
      {/* Flèche entrée */}
      <path d={`M ${-W / 2 + 16} ${H / 2 - 6} l 10 -4 l -10 -4 z`} fill="#f5c542" opacity="0.8" />
      <path d={`M ${W / 2 - 16} ${H / 2 - 6} l -10 -4 l 10 -4 z`} fill="#f5c542" opacity="0.8" />

      {/* Néons bord de toit */}
      {lit && (
        <g>
          <rect x={-W / 2 + 16} y={-H / 2 + 20} width={W - 32} height="2" fill="#ffd84a" opacity={neonOp}>
            <animate attributeName="opacity" values={`${neonOp};${Math.min(1, neonOp + 0.25)};${neonOp}`} dur="2.4s" repeatCount="indefinite" />
          </rect>
          <rect x={-W / 2 + 16} y={H / 2 / 2 + 10} width={W - 32} height="1.5" fill="#ffd84a" opacity={neonOp * 0.7} />
        </g>
      )}

      {/* Plot d'entrée illuminé (proportionnel à prodLvl) */}
      <g>
        {Array.from({ length: 2 }).map((_, i) => {
          const cx = i === 0 ? -W / 2 + 8 : W / 2 - 8;
          return (
            <g key={i} transform={`translate(${cx},${H / 2 - 26})`}>
              <circle r="5" fill="#0e1217" stroke="#f5c542" strokeWidth="1.2" />
              <circle r="2.5" fill={lit ? "#ffd84a" : "#5a4818"} opacity={lit ? Math.min(1, 0.6 + 0.08 * prodLvl) : 0.7} />
            </g>
          );
        })}
      </g>

      {/* Halo nuit global */}
      {lit && <circle r={W * 0.62} fill="#f5c542" opacity={night * 0.08} />}
    </g>
  );
}


function RivalDepot({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx="0" cy="48" rx="92" ry="16" fill="rgba(0,0,0,0.55)" />
      <path d="M -82 38 L 82 38 L 102 48 L -102 48 Z" fill="#2a2024" stroke="#1a0a10" strokeWidth="1.2" />
      <rect x="-72" y="-14" width="144" height="54" rx="2" fill="#3a1820" stroke="#1a0a10" strokeWidth="1.8" />
      <path d="M -78 -14 L 0 -46 L 78 -14 Z" fill="#7a1020" stroke="#1a0a10" strokeWidth="1.8" />
      <rect x="-54" y="-2" width="32" height="40" fill="#0a0608" stroke="#000" strokeWidth="1.4" />
      <rect x="22" y="-2" width="32" height="40" fill="#0a0608" stroke="#000" strokeWidth="1.4" />
      <rect x="-18" y="4" width="36" height="20" fill="#ff3040" opacity="0.9" stroke="#1a0a10" strokeWidth="1" />
      <rect x="-54" y="-40" width="108" height="16" rx="2.5" fill="#dc1a2a" stroke="#1a0a10" strokeWidth="1.6" />
      <text x="0" y="-28" fontSize="10" fontWeight="900" textAnchor="middle" fill="#fff" letterSpacing="1">RIVAL CABS</text>
      <circle cx="58" cy="-30" r="10" fill="#0a0608" stroke="#ff3040" strokeWidth="2" />
      <text x="58" y="-26" fontSize="12" textAnchor="middle">⚔️</text>
      <line x1="-56" y1="-46" x2="-56" y2="-60" stroke="#1a0a10" strokeWidth="1.4" />
      <circle cx="-56" cy="-61" r="2" fill="#ff3040">
        <animate attributeName="opacity" values="1;0.2;1" dur="1.1s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

export default function TaxiTycoon() {
  // Une ref par chemin disponible — permet de varier les trajets des taxis.
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const pathLensRef = useRef<number[]>([]);
  const containerRef = useRef<SVGSVGElement | null>(null);
  const [pathsReady, setPathsReady] = useState(false);
  const admin = useAdminConfig(); // re-render quand l'admin change

  // === Persistent state ===
  const [save, setSave] = useState<SaveData>(DEFAULT_SAVE);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setSave(loadSave()); setHydrated(true); }, []);
  const saveRef = useRef(save);
  saveRef.current = save;

  // === Dynamic state (not persisted) ===
  const taxisRef = useRef<Taxi[]>([]);
  const nextIdRef = useRef(1);
  const lastJobSpawnRef = useRef(0);
  const lastTaxiDispatchRef = useRef(0);
  const [, forceRender] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [popups, setPopups] = useState<{ id: number; text: string; x: number; y: number }[]>([]);
  const popIdRef = useRef(0);

  // Jobs (file de courses proposées au joueur) — state React car affichées dans le HUD.
  const [jobs, setJobs] = useState<Job[]>([]);
  const jobsRef = useRef<Job[]>([]);
  jobsRef.current = jobs;
  const [nowTick, setNowTick] = useState(Date.now());
  const jobIdRef = useRef(1);

  // === Concurrent IA ===
  type RivalTaxi = { id: number; pathIdx: number; pos: number; target: number; mode: TaxiMode; jobId: number | null };
  const rivalTaxisRef = useRef<RivalTaxi[]>([]);
  const rivalJobsRef = useRef<Job[]>([]); // courses prises en charge par l'IA
  const [rivalStolen, setRivalStolen] = useState(0);

  // === Police ===
  type PoliceCar = {
    id: number;
    pathIdx: number;
    pos: number;
    target: number;
    mode: "patrol" | "chase" | "stakeout_drive" | "stakeout_wait";
    chaseRivalId: number | null;
    chasePlayerTaxiId: number | null;
    hideoutXY?: { x: number; y: number };
  };
  const policeCarsRef = useRef<PoliceCar[]>([]);
  const wantedRivalIdRef = useRef<number | null>(null);
  const wantedUntilRef = useRef<number>(0);
  const lastViolationRef = useRef<number>(performance.now());
  const POLICE_SPEED = 92;     // px/s patrol
  const POLICE_CHASE_SPEED = 140;
  const POLICE_FINE = 200;
  const POLICE_CATCH_DIST = 48; // px

  // === Radars fixes & planques police (Speed Traps) ===
  // Radars : couples (pathIdx, posFraction) -> position le long du path.
  type RadarSpec = { id: number; pathIdx: number; posFrac: number };
  const RADARS: RadarSpec[] = [
    { id: 1, pathIdx: 0, posFrac: 0.25 },
    { id: 2, pathIdx: 0, posFrac: 0.72 },
    { id: 3, pathIdx: 2, posFrac: 0.40 },
  ];
  const SPEED_LIMIT = 78;          // px/s ; déclenche dès l'upgrade vitesse niveau 1+
  const RADAR_FINE = 120;
  const RADAR_TRIGGER_DIST = 26;   // px le long du path
  const RADAR_COOLDOWN_MS = 6000;  // évite les amendes en chaîne
  const radarLastHitRef = useRef<Record<string, number>>({}); // key = `${radarId}:${taxiId}`
  const radarFlashRef = useRef<{ id: number; x: number; y: number; t: number } | null>(null);
  const [radarFlashTick, setRadarFlashTick] = useState(0);

  // Planques : points XY au bord de la route où la police se cache.
  type HideoutSpec = { id: number; x: number; y: number };
  const HIDEOUTS: HideoutSpec[] = [
    { id: 1, x: 540,  y: 760 },
    { id: 2, x: 1150, y: 540 },
    { id: 3, x: 1620, y: 320 },
  ];
  const HIDEOUT_TRAP_DIST = 95;      // px : portée de détection radar embusqué
  const HIDEOUT_FINE = 400;
  const STAKEOUT_DURATION_MS = 18000;
  const stakeoutHideoutRef = useRef<Record<number, number>>({}); // policeId -> hideoutId
  const stakeoutUntilRef = useRef<Record<number, number>>({});   // policeId -> until ms
  const wantedPlayerTaxiIdRef = useRef<number | null>(null);
  const wantedPlayerUntilRef = useRef<number>(0);
  const lastStakeoutTriggerRef = useRef<number>(performance.now());



  // === Circuit personnalisé (dessiné par le joueur) ===
  // Pré-calcule la longueur totale + offsets cumulés.
  const circuitInfo = useMemo(() => {
    const pts = admin.circuitPoints;
    if (!pts || pts.length < 2) return { pts: [], total: 0, offsets: [] as number[] };
    const offsets: number[] = [0];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      offsets.push(total);
    }
    // boucle : ferme vers le premier point
    total += Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
    return { pts, total, offsets };
  }, [admin.circuitPoints]);

  const circuitTaxisRef = useRef<{ id: number; pos: number }[]>([]);
  const circuitInfoRef = useRef(circuitInfo);
  circuitInfoRef.current = circuitInfo;
  // Sync le nombre de taxis sur le circuit
  useEffect(() => {
    const target = circuitInfo.pts.length >= 2 ? Math.max(0, Math.min(8, admin.circuitTaxiCount)) : 0;
    while (circuitTaxisRef.current.length < target) {
      const i = circuitTaxisRef.current.length;
      circuitTaxisRef.current.push({ id: 20000 + i, pos: (i / Math.max(1, target)) * circuitInfo.total });
    }
    while (circuitTaxisRef.current.length > target) circuitTaxisRef.current.pop();
  }, [admin.circuitTaxiCount, circuitInfo.total, circuitInfo.pts.length]);

  // Récupère (x,y,angle) à une position le long du circuit (en pixels)
  const circuitAt = (s: number) => {
    const info = circuitInfo;
    if (info.pts.length < 2 || info.total <= 0) return { x: 0, y: 0, angle: 0 };
    let d = ((s % info.total) + info.total) % info.total;
    for (let i = 0; i < info.pts.length; i++) {
      const a = info.pts[i];
      const b = info.pts[(i + 1) % info.pts.length];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      if (d <= segLen || i === info.pts.length - 1) {
        const t = segLen > 0 ? d / segLen : 0;
        return {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
        };
      }
      d -= segLen;
    }
    return { x: info.pts[0].x, y: info.pts[0].y, angle: 0 };
  };







  const genJob = (tierIdx: number): Job => {
    const now = Date.now();
    const t = DEPOT_TIERS[tierIdx];
    const id = jobIdRef.current++;
    const lens = pathLensRef.current;
    const allowed: number[] = [];
    for (let i = 0; i < lens.length; i++) if (!VILLAGE_PATHS.has(i)) allowed.push(i);
    const pickupPath = allowed[Math.floor(Math.random() * allowed.length)];
    let dropoffPath = allowed[Math.floor(Math.random() * allowed.length)];
    if (allowed.length > 1 && dropoffPath === pickupPath && Math.random() < 0.65) {
      const others = allowed.filter(p => p !== pickupPath);
      dropoffPath = others[Math.floor(Math.random() * others.length)];
    }
    const pickup = Math.random() * lens[pickupPath];
    const dropoff = Math.random() * lens[dropoffPath];
    // tarif basé sur la distance approximative + tier + admin
    const distNorm = 0.4 + Math.random() * 0.6;
    const adm = getAdmin();
    const revBonus = 1 + 0.10 * (saveRef.current.hqRevenueLvl ?? 0);
    const fare = Math.round((25 + distNorm * 220) * t.fareMult * adm.clientFareMult * revBonus);
    const duration = (22 + Math.min(20, fare / 30)) * 1000;
    return {
      id, pickupPath, pickup, dropoffPath, dropoff, fare,
      deadline: now + duration, duration,
      status: "offered",
      sidePickup: Math.random() < 0.5 ? 1 : -1,
      sideDrop: Math.random() < 0.5 ? 1 : -1,
    };
  };

  // Mesure des longueurs réelles de chaque path au montage.
  useEffect(() => {
    const lens = pathRefs.current.map((p) => (p ? p.getTotalLength() : 0));
    pathLensRef.current = lens;
    if (lens.every((l) => l > 0)) setPathsReady(true);
  }, []);

  const pathLen = pathLensRef.current[0] ?? 0;

  // === Helpers de rendu position (déclarés tôt pour usage dans les effets) ===
  const SIDEWALK_OFFSET = 32;

  // Trouve la longueur sur `pathIdx` la plus proche d'un point (x,y) du SVG.
  const closestOnPath = (pathIdx: number, x: number, y: number): number => {
    const p = pathRefs.current[pathIdx];
    const plen = pathLensRef.current[pathIdx] ?? 0;
    if (!p || plen === 0) return 0;
    let bestL = 0, bestD = Infinity;
    const N = 160;
    for (let i = 0; i <= N; i++) {
      const l = (i / N) * plen;
      const pt = p.getPointAtLength(l);
      const dx = pt.x - x, dy = pt.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; bestL = l; }
    }
    return bestL;
  };

  // Récupère les coordonnées XY courantes d'un taxi.
  const taxiXY = (taxi: Taxi): { x: number; y: number } => {
    const p = pathRefs.current[taxi.pathIdx];
    const plen = pathLensRef.current[taxi.pathIdx] ?? 0;
    if (!p || plen === 0) return { x: 0, y: 0 };
    const safe = ((taxi.pos % plen) + plen) % plen;
    const pt = p.getPointAtLength(safe);
    return { x: pt.x, y: pt.y };
  };

  // Choisit aléatoirement un path différent du dernier (variété de trajet),
  // en évitant les paths du village (haut de la map).
  const pickPath = (avoid?: number): number => {
    const n = pathLensRef.current.length;
    const allowed: number[] = [];
    for (let i = 0; i < n; i++) if (!VILLAGE_PATHS.has(i)) allowed.push(i);
    if (allowed.length === 0) return 0;
    if (allowed.length === 1) return allowed[0];
    let idx = allowed[Math.floor(Math.random() * allowed.length)];
    if (idx === avoid) {
      const others = allowed.filter(p => p !== avoid);
      idx = others[Math.floor(Math.random() * others.length)];
    }
    return idx;
  };

  // Sync taxis runtime list with save
  useEffect(() => {
    if (!pathsReady) return;
    const newSpeed = (BASE_SPEED + save.taxiSpeedLvl * 18) * admin.taxiSpeedMult;
    while (taxisRef.current.length < save.taxis.length) {
      const idx = taxisRef.current.length;
      // taxi neuf : path 0, posé près du QG
      const pIdx = 0;
      const pos = closestOnPath(pIdx, admin.hqX, admin.hqY);
      taxisRef.current.push({
        id: nextIdRef.current++,
        pathIdx: pIdx,
        pos,
        target: pos,
        mode: "idle",
        speed: newSpeed,
        colorId: save.taxis[idx].colorId,
        jobId: null,
        fuel: 100,
      });
    }
    taxisRef.current.forEach((t, i) => {
      t.speed = newSpeed;
      if (save.taxis[i]) t.colorId = save.taxis[i].colorId;
      if (t.mode === "idle") {
        const pos = closestOnPath(t.pathIdx, admin.hqX, admin.hqY);
        t.pos = pos; t.target = pos;
      }
    });
    forceRender((n) => n + 1);
  }, [pathsReady, save.taxis, save.taxiSpeedLvl, admin.taxiSpeedMult, admin.hqX, admin.hqY]);

  // Sync rival AI taxis fleet
  useEffect(() => {
    if (!pathsReady) return;
    const target = admin.rivalEnabled ? Math.max(0, Math.min(6, admin.rivalTaxiCount)) : 0;
    while (rivalTaxisRef.current.length < target) {
      const pos = closestOnPath(0, admin.rivalHQX, admin.rivalHQY);
      rivalTaxisRef.current.push({
        id: 10000 + rivalTaxisRef.current.length,
        pathIdx: 0, pos, target: pos, mode: "idle", jobId: null,
      });
    }
    while (rivalTaxisRef.current.length > target) rivalTaxisRef.current.pop();
    forceRender((n) => n + 1);
  }, [pathsReady, admin.rivalEnabled, admin.rivalTaxiCount, admin.rivalHQX, admin.rivalHQY]);

  // Sync police fleet (2 voitures qui patrouillent en permanence)
  useEffect(() => {
    if (!pathsReady) return;
    const N = pathLensRef.current.length;
    if (N === 0) return;
    const allowed: number[] = [];
    for (let i = 0; i < N; i++) if (!VILLAGE_PATHS.has(i)) allowed.push(i);
    if (allowed.length === 0) return;
    const target = 2;
    while (policeCarsRef.current.length < target) {
      const pIdx = allowed[policeCarsRef.current.length % allowed.length];
      const plen = pathLensRef.current[pIdx] ?? 0;
      policeCarsRef.current.push({
        id: 30000 + policeCarsRef.current.length,
        pathIdx: pIdx,
        pos: (policeCarsRef.current.length / target) * plen,
        target: plen - 1,
        mode: "patrol",
        chaseRivalId: null,
        chasePlayerTaxiId: null,
      });
    }
    while (policeCarsRef.current.length > target) policeCarsRef.current.pop();
    forceRender((n) => n + 1);
  }, [pathsReady]);






  // Save persistence (debounced)
  useEffect(() => {
    if (!hydrated) return;
    const id = setTimeout(() => {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {}
    }, 400);
    return () => clearTimeout(id);
  }, [save, hydrated]);

  const tier = DEPOT_TIERS[save.depotTier];
  const nextTier = DEPOT_TIERS[save.depotTier + 1];

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1600);
  };

  const popFloat = (text: string, x: number, y: number) => {
    const id = ++popIdRef.current;
    setPopups((p) => [...p, { id, text, x, y }]);
    window.setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 1100);
  };

  // === Boucle de jeu : mouvement des taxis + génération des courses proposées ===
  useEffect(() => {
    if (!pathsReady) return;
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      const adm = getAdmin();
      const cur = saveRef.current;
      const curTier = DEPOT_TIERS[cur.depotTier];

      // === Génération de courses proposées dans la file ===
      const maxJobs = MAX_JOBS_BASE + adm.maxClientsBonus;
      if (
        jobsRef.current.length < maxJobs &&
        now - lastJobSpawnRef.current > curTier.spawnEvery * 1000 * adm.spawnRateMult
      ) {
        lastJobSpawnRef.current = now;
        const job = genJob(cur.depotTier);
        setJobs((js) => [...js, job]);
      }

      // === Mouvement des taxis ===
      for (const taxi of taxisRef.current) {
        // Consommation carburant si en mouvement
        if (taxi.mode !== "idle" && taxi.mode !== "refueling") {
          taxi.fuel = Math.max(0, taxi.fuel - adm.fuelConsumption * dt);
        }

        // Idle : check si carburant bas → aller à la station
        if (taxi.mode === "idle") {
          if (taxi.fuel < FUEL_LOW_THRESHOLD) {
            const pIdx = pickPath(taxi.pathIdx);
            const here = taxiXY(taxi);
            taxi.pathIdx = pIdx;
            taxi.pos = closestOnPath(pIdx, here.x, here.y);
            taxi.target = closestOnPath(pIdx, adm.gasStationX, adm.gasStationY);
            taxi.mode = "to_gas";
          }
          continue;
        }

        // Refueling : attendre que le timer se termine
        if (taxi.mode === "refueling") {
          if (taxi.refuelUntil && Date.now() >= taxi.refuelUntil) {
            taxi.fuel = 100;
            taxi.refuelUntil = undefined;
            // retour QG
            const pIdx = pickPath(taxi.pathIdx);
            const here = taxiXY(taxi);
            taxi.pathIdx = pIdx;
            taxi.pos = closestOnPath(pIdx, here.x, here.y);
            taxi.target = closestOnPath(pIdx, adm.hqX, adm.hqY);
            taxi.mode = "returning";
          }
          continue;
        }

        const diff = taxi.target - taxi.pos;
        const step = taxi.speed * dt;
        if (Math.abs(diff) <= step) {
          taxi.pos = taxi.target;
          if (taxi.mode === "to_pickup") {
            const j = jobsRef.current.find((x) => x.id === taxi.jobId);
            if (j) {
              // Bascule vers le path de la destination
              const here = taxiXY(taxi);
              taxi.pathIdx = j.dropoffPath;
              taxi.pos = closestOnPath(j.dropoffPath, here.x, here.y);
              taxi.target = j.dropoff;
              taxi.mode = "to_dest";
            } else {
              const pIdx = pickPath(taxi.pathIdx);
              const here = taxiXY(taxi);
              taxi.pathIdx = pIdx;
              taxi.pos = closestOnPath(pIdx, here.x, here.y);
              taxi.target = closestOnPath(pIdx, adm.hqX, adm.hqY);
              taxi.mode = "returning";
              taxi.jobId = null;
            }
          } else if (taxi.mode === "to_dest") {
            const j = jobsRef.current.find((x) => x.id === taxi.jobId);
            if (j) {
              const p = pathRefs.current[j.dropoffPath];
              if (p) {
                const pt = p.getPointAtLength(j.dropoff);
                popFloat(`+${fmt(j.fare)}$`, pt.x, pt.y);
              }
              setSave((s) => ({
                ...s,
                money: s.money + j.fare,
                totalEarned: s.totalEarned + j.fare,
                customersServed: s.customersServed + 1,
                jobsCompleted: s.jobsCompleted + 1,
              }));
              setJobs((js) => js.filter((x) => x.id !== j.id));
            }
            taxi.jobId = null;
            const pIdx = pickPath(taxi.pathIdx);
            const here = taxiXY(taxi);
            taxi.pathIdx = pIdx;
            taxi.pos = closestOnPath(pIdx, here.x, here.y);
            taxi.target = closestOnPath(pIdx, adm.hqX, adm.hqY);
            taxi.mode = "returning";
          } else if (taxi.mode === "returning") {
            taxi.mode = "idle";
            taxi.jobId = null;
          } else if (taxi.mode === "to_gas") {
            taxi.mode = "refueling";
            taxi.refuelUntil = Date.now() + FUEL_REFILL_MS;
          }
        } else {
          // Respect des feux : si rouge devant, on s'arrête (skip ce frame)
          const forward = diff > 0;
          if (!shouldStopAhead(taxi.pathIdx, taxi.pos, forward, nowSeconds())) {
            taxi.pos += Math.sign(diff) * step;
          }
        }
      }

      // === IA Concurrent : tente de sniper les courses "offered" ===
      if (adm.rivalEnabled && rivalTaxisRef.current.length > 0) {
        const speed = (BASE_SPEED + 6) * adm.rivalSpeedMult;
        const reactMs = Math.max(1, adm.rivalReactionTime) * 1000;
        const nowMs = Date.now();

        for (const r of rivalTaxisRef.current) {
          if (r.mode === "idle") {
            // cherche une course offerte assez ancienne pour être sniped
            const candidate = jobsRef.current.find((j) => {
              if (j.status !== "offered") return false;
              const age = nowMs - (j.deadline - j.duration);
              return age >= reactMs;
            });
            if (candidate) {
              r.jobId = candidate.id;
              r.pathIdx = candidate.pickupPath;
              r.pos = closestOnPath(candidate.pickupPath, admin.rivalHQX, admin.rivalHQY);
              r.target = candidate.pickup;
              r.mode = "to_pickup";
              // mémorise la course côté rival, puis la retire de la file joueur
              rivalJobsRef.current.push(candidate);
              setJobs((js) => js.filter((x) => x.id !== candidate.id));
              setRivalStolen((n) => n + 1);
              showToast("⚔️ Course volée par Rival Cabs !");
            }
            continue;
          }

          const diff = r.target - r.pos;
          const step = speed * dt;
          if (Math.abs(diff) <= step) {
            r.pos = r.target;
            if (r.mode === "to_pickup") {
              const job = rivalJobsRef.current.find((x) => x.id === r.jobId);
              if (job) {
                const here = pathRefs.current[r.pathIdx]?.getPointAtLength(r.pos);
                r.pathIdx = job.dropoffPath;
                r.pos = here ? closestOnPath(job.dropoffPath, here.x, here.y) : 0;
                r.target = job.dropoff;
                r.mode = "to_dest";
              } else {
                r.mode = "returning";
                r.target = closestOnPath(r.pathIdx, admin.rivalHQX, admin.rivalHQY);
              }
            } else if (r.mode === "to_dest") {
              rivalJobsRef.current = rivalJobsRef.current.filter((x) => x.id !== r.jobId);
              r.jobId = null;
              r.target = closestOnPath(r.pathIdx, admin.rivalHQX, admin.rivalHQY);
              r.mode = "returning";
            } else if (r.mode === "returning") {
              r.mode = "idle";
            }
          } else {
            const forward = diff > 0;
            if (!shouldStopAhead(r.pathIdx, r.pos, forward, nowSeconds())) {
              r.pos += Math.sign(diff) * step;
            }
          }
        }
      }

      // ====== Radars fixes : flash + amende automatique aux taxis en excès ======
      {
        const nowMs = performance.now();
        for (const taxi of taxisRef.current) {
          if (taxi.mode === "idle" || taxi.mode === "refueling") continue;
          if (taxi.speed <= SPEED_LIMIT) continue;
          for (const rd of RADARS) {
            if (taxi.pathIdx !== rd.pathIdx) continue;
            const plen = pathLensRef.current[rd.pathIdx] ?? 0;
            if (plen <= 0) continue;
            const rdPos = rd.posFrac * plen;
            if (Math.abs(taxi.pos - rdPos) > RADAR_TRIGGER_DIST) continue;
            const key = `${rd.id}:${taxi.id}`;
            if (nowMs - (radarLastHitRef.current[key] ?? 0) < RADAR_COOLDOWN_MS) continue;
            radarLastHitRef.current[key] = nowMs;
            const pt = pathRefs.current[rd.pathIdx]?.getPointAtLength(rdPos);
            setSave(s => ({ ...s, money: Math.max(0, s.money - RADAR_FINE) }));
            if (pt) {
              radarFlashRef.current = { id: rd.id, x: pt.x, y: pt.y, t: nowMs };
              setRadarFlashTick(n => (n + 1) % 1_000_000);
              popFloat(`-${RADAR_FINE}$ radar`, pt.x, pt.y - 10);
            }
            showToast(`📷 Flash radar ! Amende de ${RADAR_FINE}$`);
          }
        }
        // expire le flash après 300ms
        if (radarFlashRef.current && nowMs - radarFlashRef.current.t > 300) {
          radarFlashRef.current = null;
        }
      }

      // ====== Police : patrouille, course-poursuite rivaux, planques + piège joueur ======
      if (policeCarsRef.current.length > 0) {
        const nowMs = performance.now();

        // 1) Trigger aléatoire d'une infraction par un rival mobile (toutes les ~25-40 s)
        if (
          wantedRivalIdRef.current === null &&
          nowMs - lastViolationRef.current > 25000 + Math.random() * 15000 &&
          rivalTaxisRef.current.length > 0
        ) {
          const movingRivals = rivalTaxisRef.current.filter(r => r.mode !== "idle");
          if (movingRivals.length > 0) {
            const victim = movingRivals[Math.floor(Math.random() * movingRivals.length)];
            wantedRivalIdRef.current = victim.id;
            wantedUntilRef.current = nowMs + 20000;
            lastViolationRef.current = nowMs;
            showToast("🚨 Rival Cabs grille un feu — la police arrive !");
          } else {
            lastViolationRef.current = nowMs;
          }
        }
        if (wantedRivalIdRef.current !== null && nowMs > wantedUntilRef.current) {
          wantedRivalIdRef.current = null;
        }
        if (wantedPlayerTaxiIdRef.current !== null && nowMs > wantedPlayerUntilRef.current) {
          wantedPlayerTaxiIdRef.current = null;
        }

        const wantedRival = wantedRivalIdRef.current !== null
          ? rivalTaxisRef.current.find(r => r.id === wantedRivalIdRef.current) ?? null
          : null;
        const wantedPlayer = wantedPlayerTaxiIdRef.current !== null
          ? taxisRef.current.find(t => t.id === wantedPlayerTaxiIdRef.current) ?? null
          : null;

        // 2) Périodiquement, une police libre va se planquer (toutes les ~30-45s)
        if (
          !wantedRival && !wantedPlayer &&
          nowMs - lastStakeoutTriggerRef.current > 30000 + Math.random() * 15000
        ) {
          const patrolling = policeCarsRef.current.filter(p => p.mode === "patrol");
          const usedHideouts = new Set(Object.values(stakeoutHideoutRef.current));
          const freeHideouts = HIDEOUTS.filter(h => !usedHideouts.has(h.id));
          if (patrolling.length > 0 && freeHideouts.length > 0) {
            const pc = patrolling[Math.floor(Math.random() * patrolling.length)];
            const ho = freeHideouts[Math.floor(Math.random() * freeHideouts.length)];
            pc.mode = "stakeout_drive";
            pc.hideoutXY = { x: ho.x, y: ho.y };
            // snap au point du path le + proche du hideout pour s'y diriger
            let bestIdx = pc.pathIdx, bestPos = pc.pos, bestD = Infinity;
            for (let pi = 0; pi < pathRefs.current.length; pi++) {
              if (VILLAGE_PATHS.has(pi)) continue;
              const cp = closestOnPath(pi, ho.x, ho.y);
              const pt = pathRefs.current[pi]?.getPointAtLength(cp);
              if (!pt) continue;
              const d = Math.hypot(pt.x - ho.x, pt.y - ho.y);
              if (d < bestD) { bestD = d; bestIdx = pi; bestPos = cp; }
            }
            // sauter sur le path cible
            const here = pathRefs.current[pc.pathIdx]?.getPointAtLength(pc.pos);
            pc.pathIdx = bestIdx;
            pc.pos = here ? closestOnPath(bestIdx, here.x, here.y) : bestPos;
            pc.target = bestPos;
            stakeoutHideoutRef.current[pc.id] = ho.id;
            stakeoutUntilRef.current[pc.id] = nowMs + STAKEOUT_DURATION_MS;
            lastStakeoutTriggerRef.current = nowMs;
          } else {
            lastStakeoutTriggerRef.current = nowMs;
          }
        }

        // 3) MAJ chaque police
        for (const pc of policeCarsRef.current) {
          // Priorité chase : si quelqu'un est wanted et police libre -> chase
          const isStakeout = pc.mode === "stakeout_drive" || pc.mode === "stakeout_wait";
          if (wantedRival && !isStakeout && pc.mode !== "chase") {
            pc.mode = "chase";
            pc.chaseRivalId = wantedRival.id;
            pc.chasePlayerTaxiId = null;
            const here = pathRefs.current[pc.pathIdx]?.getPointAtLength(pc.pos);
            pc.pathIdx = wantedRival.pathIdx;
            pc.pos = here ? closestOnPath(wantedRival.pathIdx, here.x, here.y) : 0;
          } else if (!wantedRival && !wantedPlayer && pc.mode === "chase") {
            pc.mode = "patrol";
            pc.chaseRivalId = null;
            pc.chasePlayerTaxiId = null;
          }

          // ----- Mode CHASE -----
          if (pc.mode === "chase") {
            const targetTaxi: { pathIdx: number; pos: number; id: number } | null =
              pc.chasePlayerTaxiId !== null
                ? (taxisRef.current.find(t => t.id === pc.chasePlayerTaxiId) ?? null)
                : (wantedRival ?? null);
            if (!targetTaxi) {
              pc.mode = "patrol";
              pc.chaseRivalId = null;
              pc.chasePlayerTaxiId = null;
            } else {
              if (pc.pathIdx !== targetTaxi.pathIdx) {
                const here = pathRefs.current[pc.pathIdx]?.getPointAtLength(pc.pos);
                pc.pathIdx = targetTaxi.pathIdx;
                pc.pos = here ? closestOnPath(targetTaxi.pathIdx, here.x, here.y) : pc.pos;
              }
              pc.target = targetTaxi.pos;
              const diff = pc.target - pc.pos;
              const step = POLICE_CHASE_SPEED * dt;
              if (Math.abs(diff) > 0.5) pc.pos += Math.sign(diff) * Math.min(step, Math.abs(diff));

              const pcPt = pathRefs.current[pc.pathIdx]?.getPointAtLength(pc.pos);
              const tPt = pathRefs.current[targetTaxi.pathIdx]?.getPointAtLength(targetTaxi.pos);
              if (pcPt && tPt) {
                const d = Math.hypot(pcPt.x - tPt.x, pcPt.y - tPt.y);
                if (d < POLICE_CATCH_DIST) {
                  if (pc.chasePlayerTaxiId !== null) {
                    setSave(s => ({ ...s, money: Math.max(0, s.money - HIDEOUT_FINE) }));
                    popFloat(`-${HIDEOUT_FINE}$ gros PV`, tPt.x, tPt.y - 8);
                    showToast(`🚓 Piégé par la planque ! Amende ${HIDEOUT_FINE}$`);
                    wantedPlayerTaxiIdRef.current = null;
                  } else {
                    setSave(s => ({ ...s, money: s.money + POLICE_FINE }));
                    popFloat(`+${POLICE_FINE}$ amende`, tPt.x, tPt.y - 8);
                    showToast("🚓 Rival arrêté ! Amende reversée.");
                    wantedRivalIdRef.current = null;
                  }
                  pc.mode = "patrol";
                  pc.chaseRivalId = null;
                  pc.chasePlayerTaxiId = null;
                  delete stakeoutHideoutRef.current[pc.id];
                }
              }
            }
            continue;
          }

          // ----- Mode STAKEOUT_DRIVE : rouler vers la planque -----
          if (pc.mode === "stakeout_drive") {
            const diff = pc.target - pc.pos;
            const step = POLICE_SPEED * dt;
            if (Math.abs(diff) <= step) {
              pc.pos = pc.target;
              pc.mode = "stakeout_wait";
            } else {
              const forward = diff > 0;
              if (!shouldStopAhead(pc.pathIdx, pc.pos, forward, nowSeconds())) {
                pc.pos += Math.sign(diff) * step;
              }
            }
            continue;
          }

          // ----- Mode STAKEOUT_WAIT : embuscade -----
          if (pc.mode === "stakeout_wait") {
            // Détecte un taxi joueur rapide à portée
            const pcPt = pathRefs.current[pc.pathIdx]?.getPointAtLength(pc.pos);
            if (pcPt) {
              for (const taxi of taxisRef.current) {
                if (taxi.mode === "idle" || taxi.mode === "refueling") continue;
                if (taxi.speed <= SPEED_LIMIT) continue;
                const tPt = pathRefs.current[taxi.pathIdx]?.getPointAtLength(taxi.pos);
                if (!tPt) continue;
                const d = Math.hypot(pcPt.x - tPt.x, pcPt.y - tPt.y);
                if (d < HIDEOUT_TRAP_DIST) {
                  wantedPlayerTaxiIdRef.current = taxi.id;
                  wantedPlayerUntilRef.current = nowMs + 15000;
                  pc.mode = "chase";
                  pc.chasePlayerTaxiId = taxi.id;
                  pc.chaseRivalId = null;
                  delete stakeoutHideoutRef.current[pc.id];
                  delete stakeoutUntilRef.current[pc.id];
                  showToast("🚨 Police planquée — gyrophares allumés !");
                  break;
                }
              }
            }
            // Expire la planque sans capture
            if (pc.mode === "stakeout_wait" && nowMs > (stakeoutUntilRef.current[pc.id] ?? 0)) {
              pc.mode = "patrol";
              delete stakeoutHideoutRef.current[pc.id];
              delete stakeoutUntilRef.current[pc.id];
              const plen = pathLensRef.current[pc.pathIdx] ?? 0;
              pc.target = plen - 1;
            }
            continue;
          }

          // ----- Mode PATROL : aller-retour -----
          const diff = pc.target - pc.pos;
          const step = POLICE_SPEED * dt;
          const plen = pathLensRef.current[pc.pathIdx] ?? 0;
          if (Math.abs(diff) <= step) {
            pc.target = pc.target > 1 ? 1 : Math.max(1, plen - 1);
          } else {
            const forward = diff > 0;
            if (!shouldStopAhead(pc.pathIdx, pc.pos, forward, nowSeconds())) {
              pc.pos += Math.sign(diff) * step;
            }
          }
        }
      }



      // ====== Circuit taxis : avance le long de la boucle ======
      const cInfo = circuitInfoRef.current;
      if (circuitTaxisRef.current.length > 0 && cInfo.total > 0) {
        const cSpeed = (BASE_SPEED + 10) * (adm.circuitSpeedMult ?? 1);
        const step = cSpeed * dt;
        for (const ct of circuitTaxisRef.current) {
          ct.pos = (ct.pos + step) % cInfo.total;
        }
      }

      forceRender((n) => (n + 1) % 1_000_000);

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pathsReady]);

  // === Helpers de rendu position ===
  const LANE_OFFSET = 12; // px à droite de l'axe de la route, dans le sens de marche
  const getXYOn = (pathIdx: number, len: number): { x: number; y: number; angle: number } => {
    const p = pathRefs.current[pathIdx];
    const plen = pathLensRef.current[pathIdx] ?? 0;
    if (!p || plen === 0) return { x: 0, y: 0, angle: 0 };
    const safe = ((len % plen) + plen) % plen;
    const pt = p.getPointAtLength(safe);
    const pt2 = p.getPointAtLength(Math.min(plen - 0.1, safe + 2));
    const angle = (Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180) / Math.PI;
    return { x: pt.x, y: pt.y, angle };
  };
  // Position décalée d'une voie sur la droite (en sens de marche).
  // forward = true si le véhicule progresse dans le sens du path.
  const getLaneXY = (pathIdx: number, len: number, forward: boolean) => {
    const p = pathRefs.current[pathIdx];
    const plen = pathLensRef.current[pathIdx] ?? 0;
    if (!p || plen === 0) return { x: 0, y: 0, angle: 0 };
    const safe = ((len % plen) + plen) % plen;
    const pt = p.getPointAtLength(safe);
    const pt2 = p.getPointAtLength(Math.min(plen - 0.1, safe + 2));
    let dx = pt2.x - pt.x, dy = pt2.y - pt.y;
    if (!forward) { dx = -dx; dy = -dy; }
    const L = Math.hypot(dx, dy) || 1;
    // perpendiculaire « à droite » du sens de marche (repère y vers le bas)
    const rx = dy / L, ry = -dx / L;
    return {
      x: pt.x + rx * LANE_OFFSET,
      y: pt.y + ry * LANE_OFFSET,
      angle: (Math.atan2(dy, dx) * 180) / Math.PI,
    };
  };

  // Position décalée sur le trottoir (perpendiculaire à la route)
  const getSidewalk = (pathIdx: number, len: number, side: 1 | -1) => {
    const p = pathRefs.current[pathIdx];
    const plen = pathLensRef.current[pathIdx] ?? 0;
    if (!p || plen === 0) return { x: 0, y: 0, angle: 0 };
    const safe = ((len % plen) + plen) % plen;
    const pt = p.getPointAtLength(safe);
    const pt2 = p.getPointAtLength(Math.min(plen - 0.1, safe + 2));
    const dx = pt2.x - pt.x, dy = pt2.y - pt.y;
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L; // normale unitaire
    return {
      x: pt.x + nx * SIDEWALK_OFFSET * side,
      y: pt.y + ny * SIDEWALK_OFFSET * side,
      angle: (Math.atan2(dy, dx) * 180) / Math.PI,
    };
  };

  // Le QG est ancré en XY absolu sur la map.
  const depotXY = useMemo(() => ({ x: admin.hqX, y: admin.hqY, angle: 0 }),
    [admin.hqX, admin.hqY]);



  // === Actions UI ===
  const taxiCount = save.taxis.length;
  const effectiveMaxTaxis = tier.maxTaxis + (save.hqCapacityLvl ?? 0);
  const taxiBuyCost = Math.round(TAXI_COST_BASE * Math.pow(1.65, taxiCount));
  const speedCost = Math.round(SPEED_UPGRADE_COST_BASE * Math.pow(2.1, save.taxiSpeedLvl));

  const hqCostFor = (base: number, lvl: number) => Math.round(base * Math.pow(1.9, lvl));
  type HqKind = "capacity" | "production" | "revenue";
  const hqLevel = (k: HqKind) =>
    k === "capacity" ? save.hqCapacityLvl : k === "production" ? save.hqProductionLvl : save.hqRevenueLvl;
  const hqCost = (k: HqKind) => hqCostFor(HQ_UPGRADE_BASE_COST[k], hqLevel(k));
  const hqUpgrade = (k: HqKind) => {
    const lvl = hqLevel(k);
    if (lvl >= HQ_UPGRADE_MAX) { showToast("Niveau max atteint"); return; }
    const cost = hqCost(k);
    if (save.money < cost) { showToast(`Il manque ${fmt(cost - save.money)} $`); return; }
    setSave((s) => ({
      ...s,
      money: s.money - cost,
      hqCapacityLvl: k === "capacity" ? s.hqCapacityLvl + 1 : s.hqCapacityLvl,
      hqProductionLvl: k === "production" ? s.hqProductionLvl + 1 : s.hqProductionLvl,
      hqRevenueLvl: k === "revenue" ? s.hqRevenueLvl + 1 : s.hqRevenueLvl,
    }));
    const labels: Record<HqKind, string> = { capacity: "🚕 Capacité +1", production: "⚙️ Production accélérée", revenue: "💰 Revenu boosté" };
    showToast(labels[k]);
  };

  const buyTaxi = () => {
    if (taxiCount >= effectiveMaxTaxis) {
      showToast(`Capacité max : améliore le QG`);
      return;
    }
    if (save.money < taxiBuyCost) {
      showToast(`Il manque ${fmt(taxiBuyCost - save.money)} $`);
      return;
    }
    setSave((s) => ({
      ...s,
      money: s.money - taxiBuyCost,
      taxis: [...s.taxis, { colorId: s.defaultColor }],
    }));
    showToast("🚕 Nouveau taxi acheté !");
  };


  const upgradeDepot = () => {
    if (!nextTier) { showToast("Dépôt déjà au max"); return; }
    if (save.money < nextTier.cost) {
      showToast(`Il manque ${fmt(nextTier.cost - save.money)} $`);
      return;
    }
    setSave((s) => ({ ...s, money: s.money - nextTier.cost, depotTier: s.depotTier + 1 }));
    showToast(`🏗️ Dépôt amélioré : ${nextTier.name}`);
  };

  const upgradeSpeed = () => {
    if (save.money < speedCost) {
      showToast(`Il manque ${fmt(speedCost - save.money)} $`);
      return;
    }
    setSave((s) => ({ ...s, money: s.money - speedCost, taxiSpeedLvl: s.taxiSpeedLvl + 1 }));
    showToast(`⚡ Taxis plus rapides !`);
  };

  const [garageOpen, setGarageOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentLivery = LIVERIES.find((l) => l.id === save.liveryId) ?? LIVERIES[0];


  // === Boucle de file de courses : tick du timer + expiration des offres ===
  useEffect(() => {
    const iv = window.setInterval(() => {
      const now = Date.now();
      setNowTick(now);
      // Expire les courses « offered » dont le client a abandonné
      setJobs((js) => {
        let changed = false;
        const kept: Job[] = [];
        for (const j of js) {
          if (j.status === "offered" && j.deadline <= now) {
            changed = true;
            continue;
          }
          kept.push(j);
        }
        return changed ? kept : js;
      });
    }, 250);
    return () => clearInterval(iv);
  }, []);

  // Le joueur refuse / annule une course proposée
  const rejectJob = (id: number) => {
    setJobs((js) => js.filter((j) => j.id !== id));
  };

  // Le joueur accepte la course → on cherche un taxi idle, sinon on râle.
  const acceptJob = (id: number) => {
    const job = jobsRef.current.find((j) => j.id === id);
    if (!job || job.status !== "offered") return;
    const free = taxisRef.current.find((t) => t.mode === "idle");
    if (!free) {
      showToast("🚖 Tous les taxis sont occupés");
      return;
    }
    const adm = getAdmin();
    const prodReduction = Math.max(0.2, 1 - 0.15 * (saveRef.current.hqProductionLvl ?? 0));
    const cooldownMs = Math.max(0, adm.taxiSpawnCooldown) * 1000 * prodReduction;
    const now = performance.now();
    if (now - lastTaxiDispatchRef.current < cooldownMs) {
      showToast(`⏱️ Cooldown sortie QG`);
      return;
    }
    lastTaxiDispatchRef.current = now;
    // Si carburant trop bas, refuser et envoyer à la station d'abord.
    if (free.fuel < FUEL_LOW_THRESHOLD) {
      showToast("⛽ Taxi en panne — il file à la station");
      return;
    }
    free.jobId = job.id;
    // Bascule vers le path du pickup, partant de sa position actuelle.
    const here = taxiXY(free);
    free.pathIdx = job.pickupPath;
    free.pos = closestOnPath(job.pickupPath, here.x, here.y);
    free.target = job.pickup;
    free.mode = "to_pickup";
    setJobs((js) => js.map((j) => j.id === id ? { ...j, status: "accepted", acceptedAt: Date.now() } : j));
  };




  return (
    <>
      {/* === Calque SVG du jeu === */}
      <svg
        ref={containerRef}
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 4 }}
      >
        <defs>
          {ROADS.map((d, i) => (
            <path
              key={i}
              ref={(el) => { pathRefs.current[i] = el; }}
              id={`taxi-road-${i}`}
              d={d}
            />
          ))}
          <filter id="taxi-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#000" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Asphalte visualisé légèrement (assombri sous les taxis) */}
        <g opacity="0.18">
          {ROADS.map((d, i) => (
            <path key={i} d={d} stroke="#0a0c10" strokeWidth={28} fill="none" strokeLinecap="round" />
          ))}
        </g>

        {/* Station-service */}
        {pathsReady && (
          <g transform={`translate(${admin.gasStationX},${admin.gasStationY})`} filter="url(#taxi-shadow)">
            <ellipse cx="0" cy="18" rx="34" ry="8" fill="rgba(0,0,0,0.5)" />
            <rect x="-28" y="-10" width="56" height="28" rx="2" fill="#1f242b" stroke="#0a0c10" strokeWidth="1.4" />
            <rect x="-28" y="-26" width="56" height="8" rx="1.5" fill="#dc2626" stroke="#0a0c10" strokeWidth="1.2" />
            <text y="-20" fontSize="6.5" fontWeight="900" textAnchor="middle" fill="#fff">STATION</text>
            <rect x="-22" y="-4" width="14" height="18" fill="#dc2626" />
            <rect x="8" y="-4" width="14" height="18" fill="#dc2626" />
            <text y="9" fontSize="11" textAnchor="middle">⛽</text>
            <circle cx="0" cy="-30" r="2.5" fill="#fde68a">
              <animate attributeName="opacity" values="0.4;1;0.4" dur="1.6s" repeatCount="indefinite" />
            </circle>
          </g>
        )}

        {/* Clients en attente (course offerte ou acceptée) — sur le trottoir */}
        {jobs.map((j) => {
          const p = getSidewalk(j.pickupPath, j.pickup, j.sidePickup);
          const age = (Date.now() - (j.deadline - j.duration)) / 1000;
          const bob = Math.sin(age * 3) * 0.8;
          const pulse = 1 + Math.sin(age * 4) * 0.18;
          const haloColor = j.status === "accepted" ? "#3b82f6" : "#10b981";
          return (
            <g key={j.id} transform={`translate(${p.x},${p.y + bob})`} filter="url(#taxi-shadow)">
              <circle r={16 * pulse} fill={haloColor} opacity="0.28" />
              <ellipse cx="0" cy="9" r="6" rx="6" ry="2" fill="rgba(0,0,0,0.5)" />
              <rect x="-3" y="-2" width="2.4" height="7" rx="0.6" fill="#1f2937" />
              <rect x="0.6" y="-2" width="2.4" height="7" rx="0.6" fill="#1f2937" />
              <path d="M -4 -8 Q 0 -10 4 -8 L 3.4 -1 L -3.4 -1 Z" fill={haloColor} stroke="#0f172a" strokeWidth="0.5" />
              <rect x="-5" y="-7" width="1.6" height="5" rx="0.5" fill={haloColor} />
              <rect x="3.4" y="-7" width="1.6" height="5" rx="0.5" fill={haloColor} />
              <circle cx="0" cy="-12" r="3" fill="#f1c79b" stroke="#0f172a" strokeWidth="0.5" />
              {j.status === "offered" && (
                <rect x="4" y="-14" width="1.4" height="6" rx="0.5" fill={haloColor} transform="rotate(-30 4 -14)">
                  <animateTransform attributeName="transform" type="rotate" values="-30 4 -14;-10 4 -14;-30 4 -14" dur="0.9s" repeatCount="indefinite" />
                </rect>
              )}
              <g transform="translate(0,-26)">
                <rect x="-18" y="-9" width="36" height="13" rx="3" fill="#0f172a" stroke={haloColor} strokeWidth="1" />
                <text y="0.5" fontSize="8.5" fontWeight="900" textAnchor="middle" fill={haloColor}>{fmt(j.fare)}$</text>
              </g>
            </g>
          );
        })}

        {/* Dropoffs — sur le trottoir, uniquement pour les courses acceptées */}
        {jobs.map((j) => {
          if (j.status !== "accepted") return null;
          const p = getSidewalk(j.dropoffPath, j.dropoff, j.sideDrop);
          return (
            <g key={"d" + j.id} transform={`translate(${p.x},${p.y})`}>
              <circle r="11" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="4 3" opacity="0.85">
                <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite" />
              </circle>
              <circle r="6" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" />
              <text y="3" fontSize="9" textAnchor="middle">📍</text>
            </g>
          );
        })}


        {/* Dépôt */}
        {pathsReady && (() => {
          const t = (performance.now() % 300000) / 300000;
          const daylight = Math.max(0, Math.sin(t * Math.PI * 2 + Math.PI / 2));
          const night = 0.1 + (1 - daylight) * 0.6;
          return (
            <Depot
              tier={tier}
              x={depotXY.x}
              y={depotXY.y - 18}
              scale={admin.hqScale}
              rotation={admin.hqRotation}
              capLvl={save.hqCapacityLvl ?? 0}
              revLvl={save.hqRevenueLvl ?? 0}
              prodLvl={save.hqProductionLvl ?? 0}
              night={night}
            />
          );
        })()}

        {/* Petit garage de personnalisation à côté du QG */}
        {pathsReady && (
          <g
            transform={`translate(${depotXY.x + 130},${depotXY.y - 4})`}
            style={{ cursor: "pointer", pointerEvents: "auto" }}
            onClick={() => setGarageOpen(true)}
          >
            <title>Garage — personnaliser le taxi</title>
            <ellipse cx="0" cy="22" rx="42" ry="9" fill="rgba(0,0,0,0.55)" />
            <rect x="-36" y="-8" width="72" height="32" rx="2" fill="#3a3f48" stroke="#0a0c10" strokeWidth="1.4" />
            <path d="M -38 -8 L 0 -28 L 38 -8 Z" fill="#f5c542" stroke="#0a0c10" strokeWidth="1.4" />
            <rect x="-28" y="-2" width="22" height="26" fill="#1a1d22" stroke="#000" strokeWidth="1" />
            <rect x="6" y="-2" width="22" height="26" fill="#1a1d22" stroke="#000" strokeWidth="1" />
            {[2, 8, 14, 20].map((dy) => (
              <g key={dy}>
                <line x1={-28} y1={-2 + dy} x2={-6} y2={-2 + dy} stroke="#0a0c10" strokeWidth="0.5" />
                <line x1={6} y1={-2 + dy} x2={28} y2={-2 + dy} stroke="#0a0c10" strokeWidth="0.5" />
              </g>
            ))}
            <rect x="-30" y="-24" width="60" height="10" rx="1.5" fill="#f5c542" stroke="#0a0c10" strokeWidth="1.2" />
            <text x="0" y="-17" fontSize="7" fontWeight="900" textAnchor="middle" fill="#1a1d22">GARAGE</text>
            <circle cx="0" cy="32" r="6" fill="#f5c542" opacity="0.9">
              <animate attributeName="r" values="5;8;5" dur="1.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.85;0.4;0.85" dur="1.6s" repeatCount="indefinite" />
            </circle>
            <text x="0" y="35" fontSize="9" textAnchor="middle">🏁</text>
          </g>
        )}

        {/* QG concurrent */}
        {pathsReady && admin.rivalEnabled && <RivalDepot x={admin.rivalHQX} y={admin.rivalHQY - 18} />}

        {/* Circuit dessiné par le joueur */}
        {circuitInfo.pts.length >= 2 && (
          <g>
            <polyline
              points={[...circuitInfo.pts, circuitInfo.pts[0]].map(p => `${p.x},${p.y}`).join(" ")}
              fill="none" stroke="#22c55e" strokeWidth="6" strokeOpacity="0.35"
              strokeLinecap="round" strokeLinejoin="round" strokeDasharray="10 8"
            />
            <polyline
              points={[...circuitInfo.pts, circuitInfo.pts[0]].map(p => `${p.x},${p.y}`).join(" ")}
              fill="none" stroke="#22c55e" strokeWidth="2.5" strokeOpacity="0.9"
              strokeLinecap="round" strokeLinejoin="round"
            />
            {circuitInfo.pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="6" fill="#0a0c10" stroke="#22c55e" strokeWidth="2" />
            ))}
          </g>
        )}
        {/* Aperçu pendant le dessin : si un seul point, affiche-le */}
        {circuitInfo.pts.length === 1 && (
          <circle cx={circuitInfo.pts[0].x} cy={circuitInfo.pts[0].y} r="7" fill="#0a0c10" stroke="#22c55e" strokeWidth="2" />
        )}

        {/* Taxis qui tournent sur le circuit personnalisé */}
        {circuitInfo.pts.length >= 2 && circuitTaxisRef.current.map((ct) => {
          const p = circuitAt(ct.pos);
          return (
            <g key={ct.id} transform={`translate(${p.x},${p.y}) rotate(${p.angle})`} filter="url(#taxi-shadow)">
              <TaxiSprite image={currentLivery.image} faceRight={currentLivery.faceRight} withClient={false} moving={true} />
            </g>
          );
        })}

        {/* Taxis rivaux (couleur sombre + bandeau rouge) */}
        {admin.rivalEnabled && rivalTaxisRef.current.map((r) => {
          const movingForward = r.target >= r.pos;
          const p = getLaneXY(r.pathIdx, r.pos, movingForward);
          const angle = p.angle;
          return (
            <g key={r.id}>
              <g transform={`translate(${p.x},${p.y}) rotate(${angle})`} filter="url(#taxi-shadow)">
                <TaxiSprite image={TAXI_RED_URL} faceRight={true} withClient={r.mode === "to_dest"} moving={r.mode !== "idle"} />
              </g>
              <text x={p.x} y={p.y - 22} fontSize="9" textAnchor="middle" fill="#ff4d5c" fontWeight="900" stroke="#0a0608" strokeWidth="2" paintOrder="stroke">R</text>
            </g>
          );
        })}

        {/* Voitures de police — patrouillent et chassent les contrevenants */}
        {policeCarsRef.current.map((pc) => {
          const movingForward = pc.target >= pc.pos;
          const p = getLaneXY(pc.pathIdx, pc.pos, movingForward);
          const chasing = pc.mode === "chase";
          // gyrophare : alternance rouge/bleu via t
          const t = Math.floor(performance.now() / 200) % 2;
          const ledA = chasing ? (t === 0 ? "#3b82f6" : "#ef4444") : "#1f2937";
          const ledB = chasing ? (t === 0 ? "#ef4444" : "#3b82f6") : "#1f2937";
          return (
            <g key={pc.id} transform={`translate(${p.x},${p.y}) rotate(${p.angle})`} filter="url(#taxi-shadow)">
              {/* halo lumineux pendant la chasse */}
              {chasing && (
                <circle r="22" fill={t === 0 ? "#3b82f6" : "#ef4444"} opacity="0.28">
                  <animate attributeName="r" values="18;26;18" dur="0.6s" repeatCount="indefinite" />
                </circle>
              )}
              {/* corps voiture vue du ciel */}
              <rect x="-14" y="-7" width="28" height="14" rx="3" fill="#f8fafc" stroke="#0b0d10" strokeWidth="1" />
              {/* bande latérale noire (POLICE) */}
              <rect x="-14" y="-1.4" width="28" height="2.8" fill="#0b0d10" />
              {/* capot / coffre */}
              <rect x="-12" y="-5.5" width="6" height="11" rx="1.2" fill="#dbe2ea" opacity="0.9" />
              <rect x="6" y="-5.5" width="6" height="11" rx="1.2" fill="#dbe2ea" opacity="0.9" />
              {/* gyrophare sur toit */}
              <rect x="-4" y="-3" width="8" height="6" rx="1.2" fill="#0b0d10" />
              <circle cx="-2" cy="0" r="1.6" fill={ledA} />
              <circle cx="2" cy="0" r="1.6" fill={ledB} />
              <text x="0" y="1.6" textAnchor="middle" fontSize="3" fontWeight="900" fill="#0b0d10" pointerEvents="none">POLICE</text>
            </g>
          );
        })}


        {taxisRef.current.map((taxi) => {
          const movingForward = taxi.target >= taxi.pos;
          const p = getLaneXY(taxi.pathIdx, taxi.pos, movingForward);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const _ = taxi.colorId;
          const angle = p.angle;
          const fuelPct = Math.max(0, Math.min(1, taxi.fuel / 100));
          const fuelLow = taxi.fuel < FUEL_LOW_THRESHOLD;
          return (
            <g key={taxi.id}>
              <g transform={`translate(${p.x},${p.y}) rotate(${angle})`} filter="url(#taxi-shadow)">
                <TaxiSprite image={currentLivery.image} faceRight={currentLivery.faceRight} withClient={taxi.mode === "to_dest"} moving={taxi.mode !== "idle" && taxi.mode !== "refueling"} />
              </g>
              {/* Mini jauge essence sous le taxi */}
              <g transform={`translate(${p.x - 12},${p.y + 22})`}>
                <rect x="0" y="0" width="24" height="3" rx="1" fill="#0a0c10" opacity="0.7" />
                <rect x="0" y="0" width={24 * fuelPct} height="3" rx="1" fill={fuelLow ? "#ef4444" : "#34d399"} />
              </g>
              {taxi.mode === "refueling" && (
                <text x={p.x} y={p.y - 30} fontSize="11" textAnchor="middle" fill="#fde68a" fontWeight="900">⛽</text>
              )}
            </g>
          );
        })}

        {/* Popups gains */}
        {popups.map((p) => (
          <g key={p.id} transform={`translate(${p.x},${p.y})`}>
            <text fontSize="22" fontWeight="900" textAnchor="middle" fill="#34d399" stroke="#0a0c10" strokeWidth="3" paintOrder="stroke">
              {p.text}
              <animate attributeName="y" from="0" to="-40" dur="1.1s" fill="freeze" />
              <animate attributeName="opacity" from="1" to="0" dur="1.1s" fill="freeze" />
            </text>
          </g>
        ))}
      </svg>

      {/* === HUD HTML === */}
      <div className="tt-hud">
        <div className="tt-top">
          <div className="tt-stat money">
            <span className="tt-stat-icon">💰</span>
            <span className="tt-stat-val">{fmt(save.money)}$</span>
          </div>
          <div className="tt-stat">
            <span className="tt-stat-icon">👥</span>
            <span className="tt-stat-val">{save.customersServed}</span>
          </div>
          <div className="tt-stat">
            <span className="tt-stat-icon">🚕</span>
            <span className="tt-stat-val">{taxiCount}/{effectiveMaxTaxis}</span>
          </div>
          {admin.rivalEnabled && (
            <div className="tt-stat" style={{ color: "#ff6b7a" }} title="Courses volées par Rival Cabs">
              <span className="tt-stat-icon">⚔️</span>
              <span className="tt-stat-val">{rivalStolen}</span>
            </div>
          )}
        </div>

        <div className="tt-depot-card">
          <div className="tt-depot-name">{tier.badge} {tier.name}</div>
          <div className="tt-depot-stats">
            Tarifs ×{tier.fareMult.toFixed(1)} • Capa {effectiveMaxTaxis} taxis
          </div>
        </div>

        {/* === File de courses (offres + courses en cours) === */}
        <div className="tt-contracts">
          <div className="tt-contracts-head">
            <span>📋 COURSES</span>
            <span className="tt-fleet">
              {taxisRef.current.filter((t) => t.mode !== "idle").length}/{taxiCount} en course
            </span>
          </div>
          {jobs.length === 0 && (
            <div className="tt-empty">En attente d'appels…</div>
          )}
          {jobs.slice().sort((a, b) => {
            // offered en premier, puis par deadline ascendant
            if (a.status !== b.status) return a.status === "offered" ? -1 : 1;
            return a.deadline - b.deadline;
          }).map((j) => {
            const isOffered = j.status === "offered";
            const remain = Math.max(0, j.deadline - nowTick);
            const remainSec = Math.ceil(remain / 1000);
            const timePct = isOffered ? Math.max(0, Math.min(1, remain / j.duration)) : 1;
            const urgent = isOffered && remainSec <= 6;
            const freeTaxi = taxisRef.current.some((t) => t.mode === "idle");
            return (
              <div key={j.id} className={`tt-contract ${urgent ? "urgent" : ""} ${!isOffered ? "in-progress" : ""}`}>
                <div className="tt-c-row">
                  <span className="tt-c-icon">{isOffered ? "🙋" : "🚕"}</span>
                  <span className="tt-c-label">
                    {isOffered ? `Course ${fmt(j.fare)}$` : `En cours — ${fmt(j.fare)}$`}
                  </span>
                  {isOffered && (
                    <button className="tt-c-x" onClick={() => rejectJob(j.id)} title="Refuser">✕</button>
                  )}
                </div>
                {isOffered ? (
                  <>
                    <div className="tt-c-time"><div className="tt-c-time-fill" style={{ width: `${timePct * 100}%` }} /></div>
                    <button
                      className="tt-c-accept"
                      onClick={() => acceptJob(j.id)}
                      disabled={!freeTaxi}
                      title={freeTaxi ? "Envoyer un taxi" : "Tous les taxis sont occupés"}
                    >
                      {freeTaxi ? `▶ Accepter (${remainSec}s)` : `Flotte pleine (${remainSec}s)`}
                    </button>
                  </>
                ) : (
                  <div className="tt-c-meta">
                    <span>Taxi en route…</span>
                    <span className="tt-c-reward">+{fmt(j.fare)}$</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>


        <div className="tt-actions">
          <button className="tt-btn primary" onClick={buyTaxi} disabled={save.money < taxiBuyCost || taxiCount >= effectiveMaxTaxis}>
            <span className="tt-btn-ico">🚕</span>
            <span className="tt-btn-lbl">Acheter taxi</span>
            <span className="tt-btn-cost">{fmt(taxiBuyCost)}$</span>
          </button>
          <button className="tt-btn" onClick={upgradeSpeed} disabled={save.money < speedCost}>
            <span className="tt-btn-ico">⚡</span>
            <span className="tt-btn-lbl">Vitesse +{save.taxiSpeedLvl + 1}</span>
            <span className="tt-btn-cost">{fmt(speedCost)}$</span>
          </button>
          <button className="tt-btn upgrade" onClick={upgradeDepot} disabled={!nextTier || save.money < (nextTier?.cost ?? 0)}>
            <span className="tt-btn-ico">🏗️</span>
            <span className="tt-btn-lbl">{nextTier ? `Améliorer dépôt` : `Dépôt max`}</span>
            <span className="tt-btn-cost">{nextTier ? `${fmt(nextTier.cost)}$` : "—"}</span>
          </button>
          <button className="tt-btn shop" onClick={() => setShopOpen(true)} title="Boutique d'améliorations QG">
            <span className="tt-btn-ico">🏪</span>
            <span className="tt-btn-lbl">Boutique QG</span>
            <span className="tt-btn-cost">Améliorations</span>
          </button>
        </div>

        {/* === Modal Boutique QG === */}
        {shopOpen && (
          <div className="tt-shop-overlay" onClick={() => setShopOpen(false)}>
            <div className="tt-shop" onClick={(e) => e.stopPropagation()}>
              <div className="tt-shop-head">
                <h2>🏪 Boutique du QG</h2>
                <button className="tt-shop-close" onClick={() => setShopOpen(false)}>×</button>
              </div>
              <div className="tt-shop-money">💵 {fmt(save.money)} $</div>

              {([
                { k: "capacity" as const, ico: "🚕", title: "Capacité de taxis", desc: "+1 taxi de capacité par niveau" },
                { k: "production" as const, ico: "⚙️", title: "Vitesse de production", desc: "−15% sur le cooldown de sortie du QG" },
                { k: "revenue" as const, ico: "💰", title: "Niveau du QG", desc: "+10% de revenu par course" },
              ]).map(({ k, ico, title, desc }) => {
                const lvl = hqLevel(k);
                const maxed = lvl >= HQ_UPGRADE_MAX;
                const cost = hqCost(k);
                const cantPay = save.money < cost;
                return (
                  <div key={k} className="tt-shop-row">
                    <div className="tt-shop-row-ico">{ico}</div>
                    <div className="tt-shop-row-body">
                      <div className="tt-shop-row-title">{title}</div>
                      <div className="tt-shop-row-desc">{desc}</div>
                      <div className="tt-shop-bar">
                        {Array.from({ length: HQ_UPGRADE_MAX }).map((_, i) => (
                          <span key={i} className={`tt-shop-pip ${i < lvl ? "on" : ""}`} />
                        ))}
                        <span className="tt-shop-lvl">Niv. {lvl}/{HQ_UPGRADE_MAX}</span>
                      </div>
                    </div>
                    <button
                      className="tt-shop-buy"
                      onClick={() => hqUpgrade(k)}
                      disabled={maxed || cantPay}
                    >
                      {maxed ? "MAX" : `${fmt(cost)} $`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bouton garage : ouvre le modal de personnalisation */}
        <button className="tt-garage-fab" onClick={() => setGarageOpen(true)} title="Garage — personnaliser le taxi">
          🏁
        </button>

        {/* Musique de fond */}
        <audio ref={audioRef} src={MUSIC_URL} loop preload="auto" />
        <button
          className="tt-music-fab"
          onClick={() => {
            const a = audioRef.current;
            if (!a) return;
            if (musicOn) { a.pause(); setMusicOn(false); }
            else { a.volume = 0.45; a.play().catch(() => {}); setMusicOn(true); }
          }}
          title={musicOn ? "Couper la musique" : "Activer la musique"}
        >
          {musicOn ? "🎵" : "🔇"}
        </button>

        {garageOpen && (
          <div className="tt-modal-overlay" onClick={() => setGarageOpen(false)}>
            <div className="tt-modal" onClick={(e) => e.stopPropagation()}>
              <div className="tt-modal-h">
                <h3>🏁 Garage — Livrées de taxi</h3>
                <button className="tt-modal-x" onClick={() => setGarageOpen(false)}>×</button>
              </div>
              <p className="tt-modal-sub">Choisis le modèle de ta flotte :</p>
              <div className="tt-livery-grid">
                {LIVERIES.map((l) => (
                  <button
                    key={l.id}
                    className={`tt-livery-card ${save.liveryId === l.id ? "selected" : ""}`}
                    onClick={() => setSave((s) => ({ ...s, liveryId: l.id }))}
                  >
                    <img src={l.image} alt={l.name} className="tt-livery-img" style={{ transform: l.faceRight ? undefined : "scaleX(-1)" }} />
                    <div className="tt-livery-name">{l.name}</div>
                    <div className="tt-livery-city">{l.city}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}


        {toast && <div className="tt-toast">{toast}</div>}
      </div>

      <style>{`
        .tt-hud {
          position: absolute; inset: 0; z-index: 30;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #fff; pointer-events: none;
        }
        .tt-top {
          position: absolute; top: 10px; left: 10px; right: 10px;
          display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;
        }
        .tt-stat {
          display: flex; align-items: center; gap: 6px;
          background: linear-gradient(180deg, #1f2127 0%, #0d0e12 100%);
          border: 1px solid #000; border-radius: 10px;
          padding: 6px 12px;
          box-shadow: 0 3px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);
          font-size: 14px; font-weight: 800;
          pointer-events: auto;
        }
        .tt-stat.money { color: #34d399; }
        .tt-stat-icon { font-size: 16px; }

        .tt-depot-card {
          position: absolute; top: 56px; left: 50%; transform: translateX(-50%);
          background: linear-gradient(180deg, rgba(15,17,22,0.85), rgba(8,9,12,0.92));
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          padding: 7px 14px;
          text-align: center;
          box-shadow: 0 6px 18px rgba(0,0,0,0.55);
          pointer-events: auto;
        }
        .tt-depot-name { font-size: 12px; font-weight: 900; letter-spacing: 0.5px; }
        .tt-depot-stats { font-size: 10px; color: #b0b4ba; margin-top: 2px; font-weight: 700; }

        .tt-actions {
          position: absolute; bottom: 70px; left: 8px; right: 8px;
          display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;
          pointer-events: auto;
        }
        .tt-btn {
          display: flex; flex-direction: column; align-items: center; gap: 1px;
          background: linear-gradient(180deg, #2a2d34, #14161b);
          border: 1px solid #000; border-radius: 12px;
          padding: 8px 12px;
          color: #fff; font-family: inherit; cursor: pointer;
          box-shadow: 0 3px 0 rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08);
          min-width: 95px;
          transition: transform 0.08s ease;
        }
        .tt-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(0,0,0,0.6); }
        .tt-btn:disabled { opacity: 0.42; cursor: not-allowed; }
        .tt-btn.primary { background: linear-gradient(180deg, #d4a017, #8b6914); border-color: #5a4400; }
        .tt-btn.upgrade { background: linear-gradient(180deg, #16a34a, #064e29); border-color: #022c17; }
        .tt-btn-ico { font-size: 20px; line-height: 1; }
        .tt-btn-lbl { font-size: 11px; font-weight: 800; letter-spacing: 0.3px; }
        .tt-btn-cost { font-size: 11px; font-weight: 900; color: #fde68a; }
        .tt-btn.upgrade .tt-btn-cost { color: #d1fae5; }
        .tt-btn.shop { background: linear-gradient(180deg, #7c3aed, #3b0c7a); border-color: #2a0a55; }
        .tt-btn.shop .tt-btn-cost { color: #e9d5ff; }

        /* === Boutique QG === */
        .tt-shop-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 200;
          display: flex; align-items: center; justify-content: center; padding: 16px;
          backdrop-filter: blur(4px);
        }
        .tt-shop {
          width: 100%; max-width: 460px; background: #14171c; color: #e8edf2;
          border: 1px solid #2a2f38; border-radius: 14px; padding: 16px;
          box-shadow: 0 18px 50px rgba(0,0,0,0.7);
          font-family: system-ui, -apple-system, sans-serif;
          max-height: 86vh; overflow-y: auto;
        }
        .tt-shop-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .tt-shop-head h2 { margin: 0; font-size: 17px; color: #f5c542; letter-spacing: 0.3px; }
        .tt-shop-close { background: transparent; border: none; color: #8a8e94; font-size: 26px; cursor: pointer; line-height: 1; }
        .tt-shop-money { font-size: 13px; color: #34d399; font-weight: 700; margin-bottom: 12px; }
        .tt-shop-row {
          display: flex; gap: 10px; align-items: center; padding: 10px;
          background: #1a1d22; border: 1px solid #2a2f38; border-radius: 10px; margin-bottom: 8px;
        }
        .tt-shop-row-ico { font-size: 26px; }
        .tt-shop-row-body { flex: 1; min-width: 0; }
        .tt-shop-row-title { font-size: 13px; font-weight: 700; color: #f5c542; }
        .tt-shop-row-desc { font-size: 11px; color: #9ca0a6; margin-top: 2px; }
        .tt-shop-bar { display: flex; align-items: center; gap: 4px; margin-top: 6px; }
        .tt-shop-pip { width: 12px; height: 6px; border-radius: 2px; background: #2a2f38; }
        .tt-shop-pip.on { background: #f5c542; }
        .tt-shop-lvl { font-size: 10px; color: #c8ccd2; margin-left: 6px; font-variant-numeric: tabular-nums; }
        .tt-shop-buy {
          background: linear-gradient(180deg, #f5c542, #b8860b); color: #14171c;
          border: 1px solid #6e5108; border-radius: 8px; padding: 8px 12px;
          font-weight: 800; font-size: 12px; cursor: pointer; min-width: 78px;
        }
        .tt-shop-buy:disabled { opacity: 0.45; cursor: not-allowed; }

        .tt-garage-fab {
          position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
          width: 44px; height: 44px; border-radius: 50%;
          background: linear-gradient(180deg, #f5c542, #b88a16);
          border: 2px solid #1a1d22; color: #1a1d22;
          font-size: 20px; cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.25);
          pointer-events: auto;
          display: flex; align-items: center; justify-content: center;
        }
        .tt-garage-fab:hover { transform: translateX(-50%) scale(1.08); }

        .tt-music-fab {
          position: absolute; bottom: 14px; right: 12px;
          width: 38px; height: 38px; border-radius: 50%;
          background: linear-gradient(180deg, #2a2d34, #14161b);
          border: 2px solid #000; color: #fde68a;
          font-size: 16px; cursor: pointer;
          box-shadow: 0 4px 10px rgba(0,0,0,0.6);
          pointer-events: auto;
          display: flex; align-items: center; justify-content: center;
        }
        .tt-livery-img {
          width: 100%; height: 70px; object-fit: contain; display: block;
          background: radial-gradient(ellipse at center, rgba(255,255,255,0.05), transparent 70%);
        }

        .tt-modal-overlay {
          position: absolute; inset: 0; z-index: 60;
          background: rgba(0,0,0,0.7);
          display: flex; align-items: center; justify-content: center;
          padding: 16px; pointer-events: auto;
          backdrop-filter: blur(4px);
        }
        .tt-modal {
          background: linear-gradient(180deg, #1a1d22 0%, #0d0e12 100%);
          border: 1px solid #f5c542; border-radius: 14px;
          padding: 16px; width: 100%; max-width: 520px;
          max-height: 90vh; overflow-y: auto;
          box-shadow: 0 20px 50px rgba(0,0,0,0.8);
        }
        .tt-modal-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .tt-modal-h h3 { margin: 0; color: #fde68a; font-size: 15px; letter-spacing: 0.5px; }
        .tt-modal-x { background: transparent; border: none; color: #8a8e94; font-size: 26px; line-height: 1; cursor: pointer; padding: 0 4px; }
        .tt-modal-sub { color: #9ca3af; font-size: 11px; margin: 0 0 12px; }
        .tt-livery-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 8px;
        }
        .tt-livery-card {
          background: #14171c; border: 2px solid #2a2f38; border-radius: 8px;
          padding: 8px 6px; cursor: pointer; color: #e8edf2;
          font-family: inherit; text-align: center;
          transition: border-color 0.15s, transform 0.08s;
        }
        .tt-livery-card:hover { border-color: #5a606a; }
        .tt-livery-card.selected { border-color: #f5c542; background: #20231a; }
        .tt-livery-preview { width: 100%; height: 50px; display: block; }
        .tt-livery-name { font-size: 12px; font-weight: 800; margin-top: 4px; }
        .tt-livery-city { font-size: 10px; color: #8a8e94; }

        /* Mobile paysage : compresse le HUD verticalement */
        @media (max-height: 500px) and (orientation: landscape) {
          .tt-actions { bottom: 8px; gap: 6px; }
          .tt-btn { padding: 5px 10px; min-width: 80px; }
          .tt-btn-ico { font-size: 16px; }
          .tt-btn-lbl { font-size: 10px; }
          .tt-btn-cost { font-size: 10px; }
          .tt-garage-fab { bottom: 6px; width: 36px; height: 36px; font-size: 16px; }
          .tt-depot-card { top: 48px; padding: 4px 10px; }
          .tt-contracts { top: 48px; width: 180px; max-height: calc(100% - 110px); }
        }


        .tt-toast {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(10,12,16,0.92);
          border: 1px solid #fde68a;
          color: #fff; font-weight: 800; font-size: 14px;
          padding: 10px 18px; border-radius: 10px;
          box-shadow: 0 12px 30px rgba(0,0,0,0.7);
          pointer-events: none;
          animation: ttToast 1.6s ease;
        }
        @keyframes ttToast {
          0% { opacity: 0; transform: translate(-50%, -40%); }
          15%, 80% { opacity: 1; transform: translate(-50%, -50%); }
          100% { opacity: 0; transform: translate(-50%, -60%); }
        }

        .tt-contracts {
          position: absolute; top: 56px; right: 10px;
          width: 220px;
          display: flex; flex-direction: column; gap: 6px;
          pointer-events: auto;
          max-height: calc(100% - 200px);
          overflow-y: auto;
        }
        .tt-contracts-head {
          display: flex; justify-content: space-between; align-items: center;
          font-size: 10px; font-weight: 900; letter-spacing: 1px;
          color: #fde68a; padding: 0 4px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.9);
        }
        .tt-fleet { color: #9ca3af; font-size: 9px; letter-spacing: 0.5px; }
        .tt-empty {
          background: rgba(20,22,28,0.7);
          border: 1px dashed rgba(255,255,255,0.12);
          border-radius: 8px; padding: 10px;
          font-size: 11px; color: #6b7280; text-align: center; font-style: italic;
        }
        .tt-contract {
          background: linear-gradient(180deg, rgba(20,22,28,0.95), rgba(8,9,12,0.95));
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; padding: 6px 8px;
          box-shadow: 0 3px 10px rgba(0,0,0,0.5);
          position: relative;
        }
        .tt-contract.urgent { border-color: #ef4444; box-shadow: 0 0 12px rgba(239,68,68,0.5); }
        .tt-contract.in-progress { border-color: rgba(59,130,246,0.5); opacity: 0.85; }
        .tt-c-row { display: flex; align-items: center; gap: 6px; }
        .tt-c-icon { font-size: 14px; }
        .tt-c-label { flex: 1; font-size: 11px; font-weight: 800; color: #fff; line-height: 1.15; }
        .tt-c-x {
          background: transparent; border: none; color: #6b7280; cursor: pointer;
          font-size: 12px; padding: 0 2px; line-height: 1;
        }
        .tt-c-x:hover { color: #ef4444; }
        .tt-c-meta {
          display: flex; justify-content: space-between;
          font-size: 9.5px; font-weight: 700; margin-top: 3px;
          color: #b0b4ba;
        }
        .tt-c-reward { color: #fde68a; }
        .tt-c-time {
          height: 3px; background: rgba(255,255,255,0.06);
          border-radius: 2px; overflow: hidden; margin-top: 5px;
        }
        .tt-c-time-fill {
          height: 100%; background: linear-gradient(90deg, #ef4444, #f59e0b);
          transition: width 0.25s linear;
        }
        .tt-c-accept {
          width: 100%; margin-top: 6px; padding: 6px 8px;
          background: linear-gradient(180deg, #16a34a, #064e29);
          border: 1px solid #022c17; border-radius: 6px;
          color: #d1fae5; font-weight: 900; font-size: 11px;
          cursor: pointer; letter-spacing: 0.4px;
          transition: transform 0.08s ease, filter 0.15s;
        }
        .tt-c-accept:hover:not(:disabled) { filter: brightness(1.15); }
        .tt-c-accept:active:not(:disabled) { transform: translateY(1px); }
        .tt-c-accept:disabled {
          background: linear-gradient(180deg, #3a3f48, #14171c);
          color: #6b7280; cursor: not-allowed; border-color: #14171c;
        }

      `}</style>
    </>
  );
}
