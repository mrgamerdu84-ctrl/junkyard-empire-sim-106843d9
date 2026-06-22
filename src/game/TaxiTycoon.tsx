import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ROADS, VILLAGE_PATHS, SIDEWALK_LOCK_OFFSET, lockToSidewalk } from "./CityTraffic";
import { GAME_ASSETS, listCustomVehicles } from "./gameAssets";
import { shouldStopAhead, nowSeconds, registerAccident, clearAccident, getAccidents, type AccidentZone } from "./trafficLights";
import { getAdmin, useAdminConfig } from "./adminConfig";
import { recordEarning, isSpecialTaxiUnlocked } from "@/lib/leaderboard";
import { pushNews } from "@/lib/radioNews";
import { useRealWorldEnv, weatherLabelFr, weatherLabelEn, refreshRealWorldEnv } from "@/lib/realWorldEnv";
import { WeatherNightOverlay } from "@/components/WeatherNightOverlay";
import { getLicense, addLicenseXp, rollClientTier, tierFareMult, tierXp } from "@/lib/license";
import { pickSpecialMission, SPECIAL_COOLDOWN_MS } from "@/lib/specialMissions";



// Skins centralisés — pour changer un taxi / la voiture de police,
// édite `src/game/gameAssets.ts` (clés "taxi.*" / "police.car").
const TAXI_YELLOW_URL = GAME_ASSETS["taxi.yellow"];
const TAXI_BLACK_URL = GAME_ASSETS["taxi.black"];
const TAXI_RED_URL = GAME_ASSETS["taxi.red"];
const POLICE_CAR_URL = GAME_ASSETS["police.car"];
const AMBULANCE_URL = GAME_ASSETS["emergency.ambulance"];
const FIRETRUCK_URL = GAME_ASSETS["emergency.firetruck"];

const MUSIC_URL = GAME_ASSETS["audio.music"];

// Taille unifiée de tous les véhicules (taxi joueur, police, urgences, civils, customs)
export const VEHICLE_SIZE = 36;

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

export const TAXI_PAINTS = [
  { id: "blue", name: "Bleu joueur", color: "#38bdf8", filter: "hue-rotate(172deg) saturate(1.65) brightness(1.03)" },
  { id: "yellow", name: "Jaune taxi", color: "#f5c542", filter: "none" },
  { id: "green", name: "Vert", color: "#22c55e", filter: "hue-rotate(92deg) saturate(1.55) brightness(0.96)" },
  { id: "pink", name: "Rose", color: "#ec4899", filter: "hue-rotate(305deg) saturate(1.45) brightness(1.05)" },
  { id: "white", name: "Blanc", color: "#f8fafc", filter: "grayscale(1) brightness(1.45) contrast(0.95)" },
] as const;

type TaxiMode = "idle" | "to_pickup" | "to_dest" | "returning" | "to_gas" | "refueling" | "depositing";
type LanePosition = { x: number; y: number; angle: number };
type Taxi = {
  id: number;
  pathIdx: number;    // path actuel emprunté (0..ROADS.length-1)
  pos: number;        // longueur le long du path actuel
  target: number;
  lane?: LanePosition;
  mode: TaxiMode;
  speed: number;
  colorId: string;
  jobId: number | null;
  fuel: number;       // 0..100
  refuelUntil?: number; // timestamp ms : fin du remplissage
  ridesSinceDeposit: number; // nb courses depuis le dernier dépôt au QG
  depositUntil?: number;     // timestamp ms : fin du dépôt au QG
  mustDeposit?: boolean;     // flag : doit déposer au QG en retournant
  // Transition douce lors d'un changement de path (acceptation de course) :
  // on évite le « saut » visuel en interpolant entre la position d'origine
  // et la nouvelle position sur le path pickup pendant TRANSITION_MS.
  transitionFromX?: number;
  transitionFromY?: number;
  transitionUntil?: number;
};
const TRANSITION_MS = 700;


// Mécanique : retour au QG tous les N courses, attente de DEPOSIT_MS
const DEPOSIT_EVERY_RIDES = 3;
const DEPOSIT_MS = 5000;

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
  tier?: "normal" | "vip" | "star" | "special";
  specialMissionId?: string;
  specialFareMult?: number;
  specialXp?: number;
  // Compagnie qui "détient" la mission (couleur de pastille).
  // "player" = joueur ; sinon = id de concurrent. Peut changer dynamiquement
  // pendant que la mission est "offered" (vol / reprise entre compagnies).
  claimedBy?: string;
  claimedColor?: string;
};



const DEFAULT_DEPOT_POS = 0.78; // fallback si mode "suit le circuit" (legacy)
const SAVE_KEY = "taxi-tycoon-v4";
const BASE_SPEED = 74; // px (sur viewBox 1920) par seconde — taxis un peu plus vifs que la circulation
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

/** Liste complète des livrées : base + skins uploadés via le panel admin. */
export function getAllLiveries(): Livery[] {
  const customTaxis = listCustomVehicles()
    .filter((v) => v.category === "taxi")
    .map<Livery>((v) => ({
      id: `custom_${v.id}`,
      name: v.name,
      city: "Custom (admin)",
      roofLabel: "TAXI",
      roofBg: "#1a1d22",
      roofFg: "#fde047",
      stripe: "none",
      stripeColor: "#1a1d22",
      image: v.url,
      faceRight: true,
    }));
  return [...LIVERIES, ...customTaxis];
}

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
  cityFund: number;        // 💰 Caisse de la ville (alimentée par les amendes)
  playerTaxiColor: string; // couleur visuelle du taxi joueur
  taxiWear: number;        // 🔧 usure flotte 0..100 — au-delà de 70 pénalise les revenus
};


const HQ_UPGRADE_MAX = 5;
const HQ_UPGRADE_BASE_COST = { capacity: 1200, production: 1500, revenue: 2000 } as const;

// === Niveaux de prospérité de la ville ===
// La ville grandit avec sa caisse — chaque palier débloque un nouveau statut.
export const CITY_LEVELS: { name: string; threshold: number; emoji: string }[] = [
  { name: "Village",     threshold: 0,     emoji: "🏘️" },
  { name: "Bourg",       threshold: 500,   emoji: "🏡" },
  { name: "Petite ville", threshold: 1500,  emoji: "🏪" },
  { name: "Ville",       threshold: 4000,  emoji: "🏙️" },
  { name: "Grande ville", threshold: 9000,  emoji: "🌆" },
  { name: "Métropole",   threshold: 20000, emoji: "🌇" },
];

export function getCityLevel(fund: number) {
  let lvl = 0;
  for (let i = 0; i < CITY_LEVELS.length; i++) {
    if (fund >= CITY_LEVELS[i].threshold) lvl = i;
  }
  return { index: lvl, ...CITY_LEVELS[lvl], next: CITY_LEVELS[lvl + 1] };
}

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
  cityFund: 0,
  playerTaxiColor: "blue",
  taxiWear: 0,
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
  paintFilter = "none",
  markerColor,
  size = VEHICLE_SIZE,
}: {
  withClient: boolean;
  moving: boolean;
  image: string;
  faceRight: boolean;
  paintFilter?: string;
  markerColor?: string;
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
          <image href={image} x={-S / 2} y={-S / 2} width={S} height={S} preserveAspectRatio="xMidYMid meet" style={{ filter: paintFilter }} />
        </g>
        {markerColor && <circle cx="0" cy={-S * 0.56} r="4.2" fill={markerColor} stroke="#0a0c10" strokeWidth="1.2" />}
        {withClient && (
          <g transform="translate(0,-4)">
            <circle r="3" fill="#ffd9b0" stroke="#1a1d22" strokeWidth="0.5" />
          </g>
        )}
      </g>
    </g>
  );
}

function RoadAlignedVehicleSprite({
  image,
  size = VEHICLE_SIZE,
  opacity = 1,
  children,
}: {
  image: string;
  size?: number;
  opacity?: number;
  children?: ReactNode;
}) {
  return (
    <g transform="rotate(90)">
      <image href={image} x={-size / 2} y={-size / 2} width={size} height={size} preserveAspectRatio="xMidYMid meet" opacity={opacity} />
      {children}
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
      <text x="0" y={-H / 2 + 16} fontSize="11" fontWeight="900" textAnchor="middle" fill={lit ? "#fff7c0" : "#f5c542"} letterSpacing="2" style={{ filter: lit ? "drop-shadow(0 0 4px #f5c542)" : undefined }}>TAXI DEPOT</text>

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
  // Vrai QG concurrent : dalle, immeuble 2 étages, vitrines, enseigne lumineuse,
  // places de parking rouges, antenne radio. Aucun simple cube.
  const W = 220;
  const H = 200;
  return (
    <g transform={`translate(${x},${y})`} filter="url(#taxi-shadow)">
      {/* ombre portée */}
      <ellipse cx="0" cy={H / 2 - 8} rx={W / 2 + 4} ry="14" fill="rgba(0,0,0,0.55)" />

      {/* Dalle / parvis */}
      <rect x={-W / 2} y={-H / 2} width={W} height={H} rx="5" fill="#1f1418" stroke="#0a0608" strokeWidth="2" />
      <g opacity="0.55">
        {Array.from({ length: 14 }).map((_, i) => (
          <rect key={i} x={-W / 2 + i * (W / 14)} y={-H / 2} width={W / 28} height="5" fill="#ff3040" />
        ))}
      </g>

      {/* Bâtiment principal (2 étages, façade vitrée) */}
      <rect x={-W / 2 + 18} y={-H / 2 + 20} width={W - 36} height={H / 2 + 4} rx="2.5" fill="#3a1d24" stroke="#0a0608" strokeWidth="1.6" />
      {/* Toit en pente */}
      <path d={`M ${-W / 2 + 14} ${-H / 2 + 20} L 0 ${-H / 2 - 8} L ${W / 2 - 14} ${-H / 2 + 20} Z`} fill="#7a1020" stroke="#0a0608" strokeWidth="1.6" />
      <rect x="-6" y={-H / 2 - 28} width="3" height="22" fill="#0a0608" />
      <circle cx="-4.5" cy={-H / 2 - 30} r="2.2" fill="#ff3040">
        <animate attributeName="opacity" values="1;0.2;1" dur="1.1s" repeatCount="indefinite" />
      </circle>

      {/* Vitrines / fenêtres (2 rangées) */}
      {[0, 1].map(row => (
        <g key={row}>
          {[0, 1, 2, 3].map(col => (
            <rect
              key={col}
              x={-W / 2 + 30 + col * ((W - 60) / 4)}
              y={-H / 2 + 30 + row * 28}
              width={(W - 80) / 4}
              height={20}
              fill="#0a0608"
              stroke="#1a0a10"
              strokeWidth="1"
            />
          ))}
        </g>
      ))}
      {/* Porte centrale */}
      <rect x="-12" y={-H / 2 + 90} width="24" height="20" fill="#0a0608" stroke="#ff3040" strokeWidth="1.2" />
      <rect x="-1" y={-H / 2 + 90} width="2" height="20" fill="#ff3040" opacity="0.7" />

      {/* Enseigne au-dessus de la porte */}
      <rect x={-70} y={-H / 2 + 4} width={140} height={14} rx="2" fill="#0a0608" stroke="#ff3040" strokeWidth="1.6" />
      <text x="0" y={-H / 2 + 14} fontSize="11" fontWeight="900" textAnchor="middle" fill="#ff5566" letterSpacing="2" style={{ filter: "drop-shadow(0 0 4px #ff3040)" }}>RIVAL CABS</text>

      {/* Bandes parking rouges */}
      <g>
        {[-3, -1, 1, 3].map((k, i) => {
          const px = k * 22;
          const py = H / 2 - 28;
          return (
            <g key={i}>
              <rect x={px - 14} y={py - 16} width="28" height="32" rx="2" fill="#1a0a10" stroke="#ff3040" strokeWidth="1.1" strokeDasharray="3 2" opacity="0.9" />
              <text x={px} y={py + 22} fontSize="5.5" textAnchor="middle" fill="#ff5566" opacity="0.7">R{String(i + 1).padStart(2, "0")}</text>
            </g>
          );
        })}
      </g>

      {/* Plots éclairés entrée */}
      <g>
        {[-W / 2 + 8, W / 2 - 8].map((cx, i) => (
          <g key={i} transform={`translate(${cx},${H / 2 - 26})`}>
            <circle r="5" fill="#0a0608" stroke="#ff3040" strokeWidth="1.2" />
            <circle r="2.5" fill="#ff5566" opacity="0.85" />
          </g>
        ))}
      </g>

      {/* Badge ⚔️ */}
      <g transform={`translate(${W / 2 - 24},${-H / 2 + 30})`}>
        <circle r="10" fill="#0a0608" stroke="#ff3040" strokeWidth="2" />
        <text y="4" fontSize="12" textAnchor="middle">⚔️</text>
      </g>
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
  useEffect(() => {
    // 1) hydratation immédiate depuis localStorage pour zéro flash
    const local = loadSave();
    setSave(local);
    setHydrated(true);
    // 2) tentative de surcharge depuis le cloud si l'utilisateur est connecté
    (async () => {
      try {
        const { fetchCloudSave } = await import("@/lib/cloudSave");
        const cloud = await fetchCloudSave();
        if (cloud && cloud.data && typeof cloud.data === "object") {
          setSave({ ...DEFAULT_SAVE, ...(cloud.data as Partial<SaveData>) });
        }
      } catch (e) {
        console.warn("[TaxiTycoon] cloud load skipped", e);
      }
    })();
  }, []);
  const saveRef = useRef(save);
  saveRef.current = save;

  // === Dynamic state (not persisted) ===
  const taxisRef = useRef<Taxi[]>([]);
  const nextIdRef = useRef(1);
  const lastJobSpawnRef = useRef(0);
  const lastTaxiDispatchRef = useRef(0);
  const [, forceRender] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [saveBlink, setSaveBlink] = useState(false);
  const [popups, setPopups] = useState<{ id: number; text: string; x: number; y: number }[]>([]);
  const popIdRef = useRef(0);

  // Jobs (file de courses proposées au joueur) — state React car affichées dans le HUD.
  const [jobs, setJobs] = useState<Job[]>([]);
  const jobsRef = useRef<Job[]>([]);
  jobsRef.current = jobs;
  const [nowTick, setNowTick] = useState(Date.now());
  const jobIdRef = useRef(1);
  const [specialCooldownUntil, setSpecialCooldownUntil] = useState<number>(0);

  // === Concurrent IA ===
  type RivalTaxi = { id: number; pathIdx: number; pos: number; target: number; lane?: LanePosition; mode: TaxiMode; jobId: number | null };
  const rivalTaxisRef = useRef<RivalTaxi[]>([]);
  const rivalJobsRef = useRef<Job[]>([]); // courses prises en charge par l'IA
  const [rivalStolen, setRivalStolen] = useState(0);
  const [rivalEarnings, setRivalEarnings] = useState(0);
  const [rivalTaunt, setRivalTaunt] = useState<string | null>(null);

  // === Police ===
  type PoliceCar = {
    id: number;
    pathIdx: number;
    pos: number;
    target: number;
    lane?: LanePosition;
    mode: "patrol" | "chase" | "stakeout_drive" | "stakeout_wait" | "control_drive" | "control_wait";
    chaseRivalId: number | null;
    chasePlayerTaxiId: number | null;
    hideoutXY?: { x: number; y: number };
    controlUntil?: number;     // ms — fin du contrôle civil
    controlStoppedPos?: number; // pos figée pendant le contrôle
  };
  const policeCarsRef = useRef<PoliceCar[]>([]);
  const wantedRivalIdRef = useRef<number | null>(null);
  const wantedUntilRef = useRef<number>(0);
  const lastViolationRef = useRef<number>(performance.now()); void lastViolationRef;
  const lastCivilControlRef = useRef<number>(performance.now());
  const POLICE_SPEED = 55;        // px/s patrouille lente (rondes)
  const POLICE_RESPONSE_SPEED = 150; // px/s vers un contrôle (gyrophares)
  const POLICE_CHASE_SPEED = 160;
  const POLICE_FINE = 200;
  const POLICE_CATCH_DIST = 48; // px
  const CIVIL_CONTROL_DURATION_MS = 6500; // durée d'un contrôle


  // === Radars fixes & planques police (Speed Traps) ===
  // Radars : couples (pathIdx, posFraction) -> position le long du path.
  type RadarSpec = { id: number; pathIdx: number; posFrac: number };
  const RADARS: RadarSpec[] = [
    { id: 1, pathIdx: 0, posFrac: 0.25 },
    { id: 2, pathIdx: 0, posFrac: 0.72 },
    { id: 3, pathIdx: 2, posFrac: 0.40 },
  ];
  const SPEED_LIMIT = 78;          // px/s ; déclenche dès l'upgrade vitesse niveau 1+
  const RADAR_FINE = 50;
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

  // === Véhicules d'urgence (ambulance / pompiers) ===
  type EmergencyVehicle = {
    id: number;
    kind: "ambulance" | "firetruck" | "police";
    pathIdx: number;
    pos: number;
    target: number;
    lane?: LanePosition;
    mode: "patrol" | "respond" | "onsite";
    onsiteUntil: number;     // ms — fin d'intervention sur place
    accidentId: number | null;
    respondAfter: number;    // ms — délai avant de partir (accident grave)
  };
  const emergencyRef = useRef<EmergencyVehicle[]>([]);
  const EMERGENCY_SPEED = 70;       // px/s patrouille
  const EMERGENCY_RUSH_SPEED = 165; // px/s en intervention (sirènes)

  // === Accidents aléatoires ===
  type Accident = AccidentZone & {
    startedAt: number;
    clearAt: number | null; // ms — quand les secours auront fini
    responders: Set<number>;
    severity: "minor" | "serious";
    interventionMs: number; // durée de l'intervention sur place
  };
  const accidentsRef = useRef<Accident[]>([]);
  const nextAccidentAtRef = useRef<number>(performance.now() + 25000 + Math.random() * 20000);
  const accidentIdRef = useRef<number>(50000);
  const ACCIDENT_BLOCK_MIN_MS = 9000;  // intervention sur place (mineur)





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







  // === Circuit VIP de session (invisible) ===
  // 6 points planqués sur les trottoirs où surgissent en priorité des clients
  // VIP/STAR pour le joueur. Régénéré aléatoirement à chaque session / lorsque vide.
  const vipCircuitRef = useRef<{ pickupPath: number; pickup: number; sidePickup: 1 | -1 }[]>([]);
  const regenVipCircuit = () => {
    const lens = pathLensRef.current;
    const allowed: number[] = [];
    for (let i = 0; i < lens.length; i++) if (!VILLAGE_PATHS.has(i) && lens[i] > 0) allowed.push(i);
    if (allowed.length === 0) return;
    const count = 5 + Math.floor(Math.random() * 4); // 5..8
    const pts: { pickupPath: number; pickup: number; sidePickup: 1 | -1 }[] = [];
    for (let k = 0; k < count; k++) {
      const p = allowed[Math.floor(Math.random() * allowed.length)];
      pts.push({
        pickupPath: p,
        pickup: Math.random() * lens[p],
        sidePickup: Math.random() < 0.5 ? 1 : -1,
      });
    }
    vipCircuitRef.current = pts;
  };

  const genJob = (tierIdx: number): Job => {
    const now = Date.now();
    const t = DEPOT_TIERS[tierIdx];
    const id = jobIdRef.current++;
    const lens = pathLensRef.current;
    const allowed: number[] = [];
    for (let i = 0; i < lens.length; i++) if (!VILLAGE_PATHS.has(i)) allowed.push(i);

    // Tente d'utiliser un point du circuit VIP (invisible) pour booster la course
    const license = getLicense();
    const wantVip = vipCircuitRef.current.length > 0 && Math.random() < 0.35;
    let pickupPath: number;
    let pickup: number;
    let sidePickup: 1 | -1;
    let forcedTier: "vip" | "star" | null = null;
    if (wantVip) {
      const wp = vipCircuitRef.current.shift()!;
      pickupPath = wp.pickupPath;
      pickup = wp.pickup;
      sidePickup = wp.sidePickup;
      forcedTier = license.level >= 4 ? "star" : "vip";
      if (vipCircuitRef.current.length === 0) regenVipCircuit();
    } else {
      pickupPath = allowed[Math.floor(Math.random() * allowed.length)];
      pickup = Math.random() * lens[pickupPath];
      sidePickup = Math.random() < 0.5 ? 1 : -1;
    }
    let dropoffPath = allowed[Math.floor(Math.random() * allowed.length)];
    if (allowed.length > 1 && dropoffPath === pickupPath && Math.random() < 0.65) {
      const others = allowed.filter(p => p !== pickupPath);
      dropoffPath = others[Math.floor(Math.random() * others.length)];
    }
    const dropoff = Math.random() * lens[dropoffPath];
    // tarif basé sur la distance approximative + tier + admin
    const distNorm = 0.4 + Math.random() * 0.6;
    const adm = getAdmin();
    const revBonus = 1 + 0.10 * (saveRef.current.hqRevenueLvl ?? 0);
    // tier client : forcé par circuit VIP, sinon roll selon permis
    const tier = forcedTier ?? rollClientTier(license.level);
    const tMult = tierFareMult(tier);
    // 🏙️ Tarif dynamique par quartier : centre-ville paie plus, banlieue moins.
    const pPath = pathRefs.current[pickupPath];
    let districtMult = 1;
    if (pPath) {
      const pt = pPath.getPointAtLength(pickup);
      const dx = pt.x - 960, dy = pt.y - 540;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // 0 au centre → 1.30, ~1100 (coin) → 0.85
      districtMult = Math.max(0.85, Math.min(1.30, 1.30 - (dist / 1100) * 0.45));
    }
    const baseFare = Math.round((25 + distNorm * 220) * t.fareMult * adm.clientFareMult * revBonus * tMult * districtMult);

    const duration = (22 + Math.min(20, baseFare / 30)) * 1000;
    return {
      id, pickupPath, pickup, dropoffPath, dropoff, fare: baseFare,
      deadline: now + duration, duration,
      status: "offered",
      sidePickup,
      sideDrop: Math.random() < 0.5 ? 1 : -1,
      tier,
    };
  };


  // Mesure des longueurs réelles de chaque path au montage.
  useEffect(() => {
    const lens = pathRefs.current.map((p) => (p ? p.getTotalLength() : 0));
    pathLensRef.current = lens;
    if (lens.every((l) => l > 0)) {
      setPathsReady(true);
      regenVipCircuit();
    }
  }, []);

  const pathLen = pathLensRef.current[0] ?? 0;

  // === Helpers de rendu position (déclarés tôt pour usage dans les effets) ===
  const SIDEWALK_OFFSET = SIDEWALK_LOCK_OFFSET;

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
      const spawnedTaxi: Taxi = {
        id: nextIdRef.current++,
        pathIdx: pIdx,
        pos,
        target: pos,
        mode: "idle",
        speed: newSpeed,
        colorId: save.taxis[idx].colorId,
        jobId: null,
        fuel: 100,
        ridesSinceDeposit: 0,
      };
      syncVehicleLane(spawnedTaxi);
      taxisRef.current.push(spawnedTaxi);
    }
    taxisRef.current.forEach((t, i) => {
      t.speed = newSpeed;
      if (save.taxis[i]) t.colorId = save.taxis[i].colorId;
      if (t.mode === "idle") {
        const pos = closestOnPath(t.pathIdx, admin.hqX, admin.hqY);
        t.pos = pos; t.target = pos;
      }
      syncVehicleLane(t);
    });
    forceRender((n) => n + 1);
  }, [pathsReady, save.taxis, save.taxiSpeedLvl, admin.taxiSpeedMult, admin.hqX, admin.hqY]);

  // Sync rival AI taxis fleet — l'IA décide elle-même combien de taxis déployer
  // (aléatoire entre 1 et flotte joueur + 2, rerollé toutes les 35-70s) + balance des taunts.
  useEffect(() => {
    if (!pathsReady) return;
    if (!admin.rivalEnabled) {
      rivalTaxisRef.current.length = 0;
      forceRender((n) => n + 1);
      return;
    }
    const TAUNTS = [
      "Trop lent, bleu !",
      "T'as vu ma flotte ?",
      "Rival Cabs domine la ville 😎",
      "Tes clients préfèrent le rouge 🚕",
      "Encore une course volée !",
      "Range ton taxi, c'est l'heure de la sieste 💤",
      "On se revoit au classement… loin devant toi.",
      "Hé chauffeur, t'as pris du retard !",
    ];
    const rebuildFleet = () => {
      const playerFleet = Math.max(1, save.taxis.length);
      const target = Math.max(1, Math.min(7, 1 + Math.floor(Math.random() * (playerFleet + 2))));
      while (rivalTaxisRef.current.length < target) {
        const pos = closestOnPath(0, admin.rivalHQX, admin.rivalHQY);
        const spawnedRival: RivalTaxi = {
          id: 10000 + rivalTaxisRef.current.length,
          pathIdx: 0, pos, target: pos, mode: "idle", jobId: null,
        };
        syncVehicleLane(spawnedRival);
        rivalTaxisRef.current.push(spawnedRival);
      }
      while (rivalTaxisRef.current.length > target) rivalTaxisRef.current.pop();
      forceRender((n) => n + 1);
    };
    rebuildFleet();
    const fleetTimer = window.setInterval(rebuildFleet, 35000 + Math.random() * 35000);
    const tauntTimer = window.setInterval(() => {
      const msg = TAUNTS[Math.floor(Math.random() * TAUNTS.length)];
      setRivalTaunt(msg);
      window.setTimeout(() => setRivalTaunt(null), 5500);
    }, 22000 + Math.random() * 20000);
    return () => {
      window.clearInterval(fleetTimer);
      window.clearInterval(tauntTimer);
    };
  }, [pathsReady, admin.rivalEnabled, save.taxis.length, admin.rivalHQX, admin.rivalHQY]);

  // Sync police fleet (nombre paramétrable depuis le panel admin)
  useEffect(() => {
    if (!pathsReady) return;
    const N = pathLensRef.current.length;
    if (N === 0) return;
    const allowed: number[] = [];
    for (let i = 0; i < N; i++) if (!VILLAGE_PATHS.has(i)) allowed.push(i);
    if (allowed.length === 0) return;
    const target = Math.max(0, Math.min(6, admin.policeCarCount ?? 2));
    while (policeCarsRef.current.length < target) {
      const pIdx = allowed[policeCarsRef.current.length % allowed.length];
      const plen = pathLensRef.current[pIdx] ?? 0;
      const spawnedPolice: PoliceCar = {
        id: 30000 + policeCarsRef.current.length,
        pathIdx: pIdx,
        pos: (policeCarsRef.current.length / Math.max(1, target)) * plen,
        target: plen - 1,
        mode: "patrol",
        chaseRivalId: null,
        chasePlayerTaxiId: null,
      };
      syncVehicleLane(spawnedPolice);
      policeCarsRef.current.push(spawnedPolice);
    }
    while (policeCarsRef.current.length > target) policeCarsRef.current.pop();
    forceRender((n) => n + 1);
  }, [pathsReady, admin.policeCarCount]);

  // Spawn ambulance + camion pompiers (1 de chaque) qui patrouillent
  useEffect(() => {
    if (!pathsReady) return;
    const N = pathLensRef.current.length;
    if (N === 0) return;
    const allowed: number[] = [];
    for (let i = 0; i < N; i++) if (!VILLAGE_PATHS.has(i)) allowed.push(i);
    if (allowed.length < 1) return;
    if (emergencyRef.current.length === 0) {
      const mkVeh = (kind: "ambulance" | "firetruck" | "police", i: number): EmergencyVehicle => {
        const pIdx = allowed[i % allowed.length];
        const plen = pathLensRef.current[pIdx] ?? 0;
        const v: EmergencyVehicle = {
          id: 40000 + i,
          kind,
          pathIdx: pIdx,
          pos: (i / 3) * plen,
          target: plen - 1,
          mode: "patrol",
          onsiteUntil: 0,
          accidentId: null,
          respondAfter: 0,
        };
        syncVehicleLane(v);
        return v;
      };
      emergencyRef.current.push(mkVeh("ambulance", 0));
      emergencyRef.current.push(mkVeh("firetruck", 1));
      emergencyRef.current.push(mkVeh("police", 2));
    }

    forceRender((n) => n + 1);
  }, [pathsReady]);









  // Save persistence (debounced) — local d'abord, puis push cloud si connecté.
  useEffect(() => {
    if (!hydrated) return;
    const id = setTimeout(() => {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {}
      setSaveBlink(true);
      window.setTimeout(() => setSaveBlink(false), 1000);
      (async () => {
        try {
          const { pushCloudSave } = await import("@/lib/cloudSave");
          await pushCloudSave(save);
        } catch {}
      })();
    }, 800);
    return () => clearTimeout(id);
  }, [save, hydrated]);

  const tier = DEPOT_TIERS[save.depotTier];
  const nextTier = DEPOT_TIERS[save.depotTier + 1];

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1600);
  };

  // Pénalité / bonus croisé avec l'IA sur les missions d'urgence
  useEffect(() => {
    const onCashDelta = (ev: Event) => {
      const d = (ev as CustomEvent<{ amount: number; reason: string; label: string }>).detail;
      if (!d || !d.amount) return;
      setSave(s => ({ ...s, money: Math.max(0, s.money + d.amount) }));
      if (d.amount > 0) showToast(`💰 +${d.amount}$ — mission ${d.label} remportée !`);
      else showToast(`💸 ${d.amount}$ — l'IA a pris ${d.label}`);
    };
    window.addEventListener("jce.player.cashDelta", onCashDelta as EventListener);
    return () => window.removeEventListener("jce.player.cashDelta", onCashDelta as EventListener);
  }, []);

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
        if (taxi.mode !== "idle" && taxi.mode !== "refueling" && taxi.mode !== "depositing") {
          taxi.fuel = Math.max(0, taxi.fuel - adm.fuelConsumption * dt);
        }

        // Idle : check si carburant bas → station. Sinon le taxi reste garé au QG
        // (il y est déjà retourné via le mode "returning" après sa dernière course).
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

        // Depositing : taxi garé au QG, attend 5s avant de repartir
        if (taxi.mode === "depositing") {
          if (taxi.depositUntil && Date.now() >= taxi.depositUntil) {
            taxi.depositUntil = undefined;
            taxi.mustDeposit = false;
            taxi.ridesSinceDeposit = 0;
            taxi.mode = "idle";
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
              // Bonus Taxi d'Or : +50% tarif si débloqué
              const bonus = isSpecialTaxiUnlocked() ? 1.5 : 1;
              const specialMult = j.tier === "special" ? (j.specialFareMult ?? 1) : 1;
              // 🔧 Usure de la flotte : pénalité progressive au-delà de 70
              const wear = saveRef.current.taxiWear ?? 0;
              const wearMult = wear >= 90 ? 0.75 : wear >= 70 ? 0.9 : 1;
              // 💵 Pourboire : 30% de chance, +5 à +25%
              const tipRoll = Math.random();
              const tipMult = tipRoll < 0.30 ? 1 + (0.05 + Math.random() * 0.20) : 1;
              const finalFare = Math.round(j.fare * bonus * specialMult * wearMult * tipMult);
              if (p) {
                const pt = p.getPointAtLength(j.dropoff);
                const tag = j.tier === "special"
                  ? `👑 MISSION +${fmt(finalFare)}$`
                  : j.tier === "star" ? `⭐ +${fmt(finalFare)}$`
                  : j.tier === "vip" ? `🥈 +${fmt(finalFare)}$`
                  : tipMult > 1 ? `💵 +${fmt(finalFare)}$ (pourboire)`
                  : `+${fmt(finalFare)}$`;
                popFloat(tag, pt.x, pt.y);
              }
              recordEarning(finalFare);
              // XP permis : 10 normal, 20 VIP, 30 STAR, ou XP custom mission spéciale
              const xpGain = j.tier === "special" ? (j.specialXp ?? 50) : tierXp(j.tier ?? "normal");
              addLicenseXp(xpGain);
              setSave((s) => ({
                ...s,
                money: s.money + finalFare,
                totalEarned: s.totalEarned + finalFare,
                customersServed: s.customersServed + 1,
                jobsCompleted: s.jobsCompleted + 1,
                taxiWear: Math.min(100, (s.taxiWear ?? 0) + 1.5),
              }));
              setJobs((js) => js.filter((x) => x.id !== j.id));
            }



            taxi.jobId = null;
            taxi.ridesSinceDeposit = (taxi.ridesSinceDeposit ?? 0) + 1;
            const pIdx = pickPath(taxi.pathIdx);
            const here = taxiXY(taxi);
            taxi.pathIdx = pIdx;
            taxi.pos = closestOnPath(pIdx, here.x, here.y);
            taxi.target = closestOnPath(pIdx, adm.hqX, adm.hqY);
            taxi.mode = "returning";
            // tous les N courses, doit déposer au QG
            if (taxi.ridesSinceDeposit >= DEPOSIT_EVERY_RIDES) {
              taxi.mustDeposit = true;
            }
          } else if (taxi.mode === "returning") {
            if (taxi.mustDeposit) {
              // arrivé au garage : dépose et attend 5s
              taxi.mode = "depositing";
              taxi.depositUntil = Date.now() + DEPOSIT_MS;
              popFloat("💰 Dépôt", adm.hqX, adm.hqY - 24);
            } else {
              taxi.mode = "idle";
            }
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
        // L'AI suit le niveau du joueur : +8 px/s par palier de QG → toujours un poil devant.
        const playerSpeed = BASE_SPEED + cur.taxiSpeedLvl * 18;
        const rivalBase = Math.max(BASE_SPEED + 6 + cur.depotTier * 8, playerSpeed * 1.06);
        const speed = rivalBase * adm.rivalSpeedMult;
        const reactMs = Math.max(1, adm.rivalReactionTime) * 1000;
        const nowMs = Date.now();

        for (const r of rivalTaxisRef.current) {
          if (r.mode === "idle") {
            // cherche une course offerte assez ancienne pour être sniped
            const candidate = jobsRef.current.find((j) => {
              if (j.status !== "offered") return false;
              const age = performance.now() - (j.deadline - j.duration);
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
              const job = rivalJobsRef.current.find((x) => x.id === r.jobId);
              if (job) setRivalEarnings((n) => n + Math.round(job.fare * 0.9));
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
          if (taxi.mode === "idle" || taxi.mode === "refueling" || taxi.mode === "depositing") continue;
          if (taxi.speed <= SPEED_LIMIT) continue;
          for (const rd of RADARS) {
            if (taxi.pathIdx !== rd.pathIdx) continue;
            const plen = pathLensRef.current[rd.pathIdx] ?? 0;
            if (plen <= 0) continue;
            const rdPos = rd.posFrac * plen;
            if (Math.abs(taxi.pos - rdPos) > RADAR_TRIGGER_DIST) continue;
            const key = `${rd.id}:${taxi.id}`;
            if (performance.now() - (radarLastHitRef.current[key] ?? 0) < RADAR_COOLDOWN_MS) continue;
            radarLastHitRef.current[key] = performance.now();
            const pt = pathRefs.current[rd.pathIdx]?.getPointAtLength(rdPos);
            setSave(s => ({ ...s, money: Math.max(0, s.money - RADAR_FINE), cityFund: s.cityFund + RADAR_FINE }));
            if (pt) {
              radarFlashRef.current = { id: rd.id, x: pt.x, y: pt.y, t: performance.now() };
              setRadarFlashTick(n => (n + 1) % 1_000_000);
              popFloat(`-${RADAR_FINE}$ radar`, pt.x, pt.y - 10);
            }
            showToast(`📷 Flash radar ! Amende de ${RADAR_FINE}$`);
          }
        }
        // expire le flash après 300ms
        if (radarFlashRef.current && performance.now() - radarFlashRef.current.t > 300) {
          radarFlashRef.current = null;
        }
      }

      // ====== Police : patrouille, course-poursuite rivaux, planques + piège joueur ======
      if (policeCarsRef.current.length > 0) {
        const nowMs = performance.now();

        // 1) Plus de déclenchement aléatoire : la police n'arrête JAMAIS
        //    rivaux/PNJ sans raison. Une arrestation ne survient que sur
        //    vraie infraction (radar = excès de vitesse, planque = excès
        //    de vitesse, ou collision déclenchée ailleurs dans le code).
        if (wantedRivalIdRef.current !== null && performance.now() > wantedUntilRef.current) {
          wantedRivalIdRef.current = null;
        }
        if (wantedPlayerTaxiIdRef.current !== null && performance.now() > wantedPlayerUntilRef.current) {
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
          performance.now() - lastStakeoutTriggerRef.current > 30000 + Math.random() * 15000
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
            stakeoutUntilRef.current[pc.id] = performance.now() + STAKEOUT_DURATION_MS;
            lastStakeoutTriggerRef.current = performance.now();
          } else {
            lastStakeoutTriggerRef.current = performance.now();
          }
        }

        // 2-bis) Contrôle aléatoire de civils : toutes les ~20-45s, une
        //        police libre s'arrête sur le bas-côté pendant ~6s avec
        //        gyrophares allumés pour "contrôler les papiers" d'un civil.
        if (
          !wantedRival && !wantedPlayer &&
          performance.now() - lastCivilControlRef.current > 20000 + Math.random() * 25000
        ) {
          const freePatrol = policeCarsRef.current.filter(p => p.mode === "patrol");
          if (freePatrol.length > 0) {
            const pc = freePatrol[Math.floor(Math.random() * freePatrol.length)];
            const plen = pathLensRef.current[pc.pathIdx] ?? 0;
            // Roule en alerte (gyrophares) vers un point ~120-220 px devant
            const forwardDist = 120 + Math.random() * 100;
            const dir = pc.target >= pc.pos ? 1 : -1;
            const tgt = Math.max(2, Math.min(plen - 2, pc.pos + dir * forwardDist));
            pc.mode = "control_drive";
            pc.target = tgt;
            pc.controlUntil = performance.now() + CIVIL_CONTROL_DURATION_MS;
            showToast("🚨 Police en intervention — contrôle imminent…");
          }
          lastCivilControlRef.current = performance.now();
        }


        // 3) MAJ chaque police
        for (const pc of policeCarsRef.current) {
          // Priorité chase : si quelqu'un est wanted et police libre -> chase
          const isStakeout = pc.mode === "stakeout_drive" || pc.mode === "stakeout_wait";
          const isControl = pc.mode === "control_drive" || pc.mode === "control_wait";
          if (wantedRival && !isStakeout && !isControl && pc.mode !== "chase") {
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
                    setSave(s => ({ ...s, money: Math.max(0, s.money - HIDEOUT_FINE), cityFund: s.cityFund + HIDEOUT_FINE }));
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
                if (taxi.mode === "idle" || taxi.mode === "refueling" || taxi.mode === "depositing") continue;
                if (taxi.speed <= SPEED_LIMIT) continue;
                const tPt = pathRefs.current[taxi.pathIdx]?.getPointAtLength(taxi.pos);
                if (!tPt) continue;
                const d = Math.hypot(pcPt.x - tPt.x, pcPt.y - tPt.y);
                if (d < HIDEOUT_TRAP_DIST) {
                  wantedPlayerTaxiIdRef.current = taxi.id;
                  wantedPlayerUntilRef.current = performance.now() + 15000;
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
            if (pc.mode === "stakeout_wait" && performance.now() > (stakeoutUntilRef.current[pc.id] ?? 0)) {
              pc.mode = "patrol";
              delete stakeoutHideoutRef.current[pc.id];
              delete stakeoutUntilRef.current[pc.id];
              const plen = pathLensRef.current[pc.pathIdx] ?? 0;
              pc.target = plen - 1;
            }
            continue;
          }

          // ----- Mode CONTROL_DRIVE : fonce gyrophares allumés vers le point de contrôle -----
          if (pc.mode === "control_drive") {
            const diff = pc.target - pc.pos;
            const stepD = POLICE_RESPONSE_SPEED * dt;
            if (Math.abs(diff) <= stepD) {
              pc.pos = pc.target;
              pc.mode = "control_wait";
              pc.controlStoppedPos = pc.pos;
              pc.controlUntil = performance.now() + CIVIL_CONTROL_DURATION_MS;
              showToast("🚓 Contrôle de papiers en cours…");
            } else {
              pc.pos += Math.sign(diff) * stepD;
            }
            continue;
          }

          // ----- Mode CONTROL_WAIT : voiture stoppée, gyrophares, "contrôle" -----
          if (pc.mode === "control_wait") {
            if (pc.controlStoppedPos !== undefined) pc.pos = pc.controlStoppedPos;
            if (performance.now() > (pc.controlUntil ?? 0)) {
              pc.mode = "patrol";
              pc.controlUntil = undefined;
              pc.controlStoppedPos = undefined;
              const plen = pathLensRef.current[pc.pathIdx] ?? 0;
              pc.target = pc.pos < plen / 2 ? plen - 1 : 1;
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

      taxisRef.current.forEach(syncVehicleLane);
      rivalTaxisRef.current.forEach(syncVehicleLane);
      policeCarsRef.current.forEach(syncVehicleLane);

      // ====== Accidents aléatoires + dispatch des secours ======
      {
        const tMs = performance.now();
        // Spawn d'un nouvel accident périodique (1 max à la fois pour éviter le chaos)
        if (accidentsRef.current.length === 0 && tMs >= nextAccidentAtRef.current) {
          const allowed: number[] = [];
          for (let i = 0; i < pathRefs.current.length; i++) if (!VILLAGE_PATHS.has(i)) allowed.push(i);
          if (allowed.length > 0) {
            const pIdx = allowed[Math.floor(Math.random() * allowed.length)];
            const plen = pathLensRef.current[pIdx] ?? 0;
            const sPos = 80 + Math.random() * Math.max(80, plen - 160);
            const pt = pathRefs.current[pIdx]?.getPointAtLength(sPos);
            if (pt) {
              const id = ++accidentIdRef.current;
              const kind: "vehicle" | "pedestrian" = Math.random() < 0.7 ? "vehicle" : "pedestrian";
              const severity: "minor" | "serious" = kind === "vehicle" ? "serious" : "minor";
              const interventionMs = severity === "serious"
                ? ACCIDENT_BLOCK_MIN_MS + 4000 + Math.random() * 6000  // 13–19s
                : ACCIDENT_BLOCK_MIN_MS;                                 // 9s
              const acc: Accident = {
                id, pathIdx: pIdx, s: sPos, x: pt.x, y: pt.y, kind,
                startedAt: tMs, clearAt: null, responders: new Set(),
                severity, interventionMs,
              };
              accidentsRef.current.push(acc);
              registerAccident({ id, pathIdx: pIdx, s: sPos, x: pt.x, y: pt.y, kind });
              // Délais de réponse aléatoires (plus longs si accident grave)
              const delayRanges = severity === "serious"
                ? { police: [1000, 5000], ambulance: [2000, 6000], firetruck: [3000, 8000] }
                : { police: [0, 1500], ambulance: [0, 1500], firetruck: [0, 1500] };
              for (const ev of emergencyRef.current) {
                const r = delayRanges[ev.kind];
                ev.respondAfter = tMs + r[0] + Math.random() * (r[1] - r[0]);
              }
              showToast(severity === "serious"
                ? "💥 Accident GRAVE ! Secours dépêchés…"
                : "🚑 Piéton renversé ! Ambulance en route…");
              pushNews(severity === "serious"
                ? { fr: "Flash info : accident grave de la circulation, pompiers, ambulance et police sont mobilisés.", en: "News flash: a serious traffic accident, firefighters, ambulance and police have been dispatched." }
                : { fr: "Flash info : un piéton vient d'être renversé, l'ambulance est en chemin.", en: "News flash: a pedestrian has just been hit, an ambulance is on its way." }
              );
            }
          }
          nextAccidentAtRef.current = tMs + 40000 + Math.random() * 40000;
        }

        // Dispatch : tous les EV (même en respond/onsite d'un ancien) -> respond vers l'accident courant
        for (const ev of emergencyRef.current) {
          if (accidentsRef.current.length > 0 && tMs >= ev.respondAfter) {
            const acc = accidentsRef.current[0];
            if (ev.mode === "patrol" || (ev.mode !== "onsite" && ev.accidentId !== acc.id)) {
              ev.mode = "respond";
              ev.accidentId = acc.id;
              const here = pathRefs.current[ev.pathIdx]?.getPointAtLength(ev.pos);
              ev.pathIdx = acc.pathIdx;
              ev.pos = here ? closestOnPath(acc.pathIdx, here.x, here.y) : ev.pos;
              ev.target = acc.s;
            }
          }
        }

        // MAJ chaque véhicule d'urgence
        for (const ev of emergencyRef.current) {
          const plen = pathLensRef.current[ev.pathIdx] ?? 0;
          if (plen <= 1) continue;
          const acc = ev.accidentId != null ? accidentsRef.current.find(a => a.id === ev.accidentId) ?? null : null;

          if (ev.mode === "onsite") {
            if (acc) acc.responders.add(ev.id);
            if (tMs >= ev.onsiteUntil) {
              // Fin d'intervention pour ce véhicule
              ev.mode = "patrol";
              ev.accidentId = null;
              ev.onsiteUntil = 0;
              ev.target = ev.pos < plen / 2 ? plen - 1 : 1;
            }
            continue;
          }

          if (ev.mode === "respond") {
            if (!acc) { ev.mode = "patrol"; ev.accidentId = null; continue; }
            const diff = acc.s - ev.pos;
            const step = EMERGENCY_RUSH_SPEED * dt;
            if (Math.abs(diff) <= step) {
              ev.pos = acc.s;
              ev.mode = "onsite";
              acc.responders.add(ev.id);
              // La minuterie de dégagement ne démarre que quand les 3 secours sont sur place
              const allHere = emergencyRef.current.every(e => e.accidentId === acc.id && e.mode === "onsite") || acc.responders.size >= 3;
              if (allHere && !acc.clearAt) {
                acc.clearAt = tMs + acc.interventionMs;
                // Aligne la fin d'intervention de tous les secours présents
                for (const e of emergencyRef.current) {
                  if (e.accidentId === acc.id) e.onsiteUntil = acc.clearAt;
                }
              } else if (!acc.clearAt) {
                // En attendant les autres, reste sur place sans limite
                ev.onsiteUntil = tMs + 60000;
              } else {
                ev.onsiteUntil = acc.clearAt;
              }
            } else {
              ev.pos += Math.sign(diff) * step;
            }
            continue;
          }

          // patrol
          const diff = ev.target - ev.pos;
          const step = EMERGENCY_SPEED * dt;
          if (Math.abs(diff) <= step) {
            ev.target = ev.target > 1 ? 1 : Math.max(1, plen - 1);
          } else {
            const forward = diff > 0;
            if (!shouldStopAhead(ev.pathIdx, ev.pos, forward, nowSeconds())) {
              ev.pos += Math.sign(diff) * step;
            }
          }
        }

        // Clôture des accidents : quand les responders ont fini ET clearAt atteint
        for (let i = accidentsRef.current.length - 1; i >= 0; i--) {
          const a = accidentsRef.current[i];
          if (a.clearAt && tMs >= a.clearAt && a.responders.size > 0) {
            const stillOnsite = emergencyRef.current.some(e => e.accidentId === a.id && e.mode === "onsite");
            if (!stillOnsite) {
              clearAccident(a.id);
              accidentsRef.current.splice(i, 1);
              showToast("✅ Accident dégagé, circulation rétablie.");
              pushNews({ fr: "Bonne nouvelle : l'accident a été dégagé, la circulation reprend normalement.", en: "Good news: the accident has been cleared, traffic is back to normal." });
            }
          }
        }
      }
      emergencyRef.current.forEach(syncVehicleLane);



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
  const clampRoadLen = (pathIdx: number, len: number): number => {
    const plen = pathLensRef.current[pathIdx] ?? 0;
    if (plen <= 0 || !Number.isFinite(len)) return 0;
    return Math.max(0, Math.min(plen - 0.1, len));
  };

  const getRoadTangent = (pathIdx: number, len: number) => {
    const p = pathRefs.current[pathIdx];
    const plen = pathLensRef.current[pathIdx] ?? 0;
    if (!p || plen === 0) return { dx: 1, dy: 0 };
    const aLen = Math.max(0, len - 2);
    const bLen = Math.min(plen - 0.1, len + 2);
    const a = p.getPointAtLength(aLen);
    const b = p.getPointAtLength(bLen);
    return { dx: b.x - a.x, dy: b.y - a.y };
  };

  const getXYOn = (pathIdx: number, len: number): { x: number; y: number; angle: number } => {
    const p = pathRefs.current[pathIdx];
    const plen = pathLensRef.current[pathIdx] ?? 0;
    if (!p || plen === 0) return { x: 0, y: 0, angle: 0 };
    const safe = clampRoadLen(pathIdx, len);
    const pt = p.getPointAtLength(safe);
    const { dx, dy } = getRoadTangent(pathIdx, safe);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    return { x: pt.x, y: pt.y, angle };
  };
  // Position décalée d'une voie sur la droite (en sens de marche).
  // forward = true si le véhicule progresse dans le sens du path.
  const getLaneXY = (pathIdx: number, len: number, forward: boolean) => {
    const p = pathRefs.current[pathIdx];
    const plen = pathLensRef.current[pathIdx] ?? 0;
    if (!p || plen === 0) return { x: 0, y: 0, angle: 0 };
    const safe = clampRoadLen(pathIdx, len);
    const pt = p.getPointAtLength(safe);
    let { dx, dy } = getRoadTangent(pathIdx, safe);
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

  function syncVehicleLane(vehicle: { pathIdx: number; pos: number; target: number; lane?: LanePosition }) {
    vehicle.pos = clampRoadLen(vehicle.pathIdx, vehicle.pos);
    vehicle.target = clampRoadLen(vehicle.pathIdx, vehicle.target);
    vehicle.lane = getLaneXY(vehicle.pathIdx, vehicle.pos, vehicle.target >= vehicle.pos);
  }

  // Position décalée sur le trottoir (perpendiculaire à la route)
  const getSidewalk = (pathIdx: number, len: number, side: 1 | -1) => {
    const p = pathRefs.current[pathIdx];
    const plen = pathLensRef.current[pathIdx] ?? 0;
    if (!p || plen === 0) return { x: 0, y: 0, angle: 0 };
    const safe = clampRoadLen(pathIdx, len);
    const pt = p.getPointAtLength(safe);
    const { dx, dy } = getRoadTangent(pathIdx, safe);
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L; // normale unitaire
    // 🔒 Verrou trottoir : on passe la position finale dans lockToSidewalk
    // pour qu'AUCUN client/piéton ne puisse jamais déborder sur la chaussée,
    // même si un futur code IA / collision tentait de l'y pousser.
    const raw = {
      x: pt.x + nx * SIDEWALK_OFFSET * side,
      y: pt.y + ny * SIDEWALK_OFFSET * side,
    };
    const locked = lockToSidewalk({ x: pt.x, y: pt.y }, { dx, dy }, side, raw.x, raw.y);
    return {
      x: locked.x,
      y: locked.y,
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

  // 🔧 Entretien : 8 $ par point d'usure, remet la flotte à neuf.
  const wearNow = Math.round(save.taxiWear ?? 0);
  const maintenanceCost = Math.max(0, wearNow * 8);
  const repairTaxis = () => {
    if (wearNow <= 0) { showToast("Flotte déjà en parfait état"); return; }
    if (save.money < maintenanceCost) {
      showToast(`Il manque ${fmt(maintenanceCost - save.money)} $`);
      return;
    }
    setSave((s) => ({ ...s, money: s.money - maintenanceCost, taxiWear: 0 }));
    showToast("🔧 Flotte entretenue, revenus restaurés !");
  };


  const [garageOpen, setGarageOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [missionsTab, setMissionsTab] = useState<"contracts" | "depot">("contracts");
  const [actionsOpen, setActionsOpen] = useState<boolean>(() => {
    try { return localStorage.getItem("tt-actions-open") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("tt-actions-open", actionsOpen ? "1" : "0"); } catch {}
  }, [actionsOpen]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Taxis qui klaxonnent (phares + bip court) — déclenché au clic joueur.
  const [honkingTaxis, setHonkingTaxis] = useState<Set<number>>(() => new Set());
  const honkTaxi = (id: number) => {
    setHonkingTaxis((s) => {
      const n = new Set(s); n.add(id); return n;
    });
    window.setTimeout(() => {
      setHonkingTaxis((s) => {
        const n = new Set(s); n.delete(id); return n;
      });
    }, 700);
    // Bip court — Web Audio (pas d'asset à charger).
    try {
      const W = window as unknown as { __jceHonkCtx?: AudioContext };
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (!Ctor) return;
      if (!W.__jceHonkCtx) W.__jceHonkCtx = new Ctor();
      const ctx = W.__jceHonkCtx!;
      if (ctx.state === "suspended") void ctx.resume();
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(520, t0);
      osc.frequency.exponentialRampToValueAtTime(420, t0 + 0.18);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.25);
    } catch {}
  };
  const allLiveries = useMemo(() => getAllLiveries(), []);
  const currentLivery = allLiveries.find((l) => l.id === save.liveryId) ?? allLiveries[0];
  const currentPaint = TAXI_PAINTS.find((p) => p.id === save.playerTaxiColor) ?? TAXI_PAINTS[0];

  // Publie la couleur joueur pour les autres composants (ArmoredTruck, etc.)
  useEffect(() => {
    (window as unknown as { __jcePlayerColor?: string }).__jcePlayerColor = currentPaint.color;
  }, [currentPaint.color]);

  // === Vol & reprise de missions par couleur de compagnie ===
  // Chaque mission "offered" porte une couleur de compagnie ; toutes les ~4 s,
  // un rival peut "voler" la pastille d'une mission (sa couleur la remplace),
  // et le joueur peut la reprendre (chance plus faible). Acceptation = reprise.
  useEffect(() => {
    const t = window.setInterval(() => {
      const w = window as unknown as { __jceCompetitors?: { id: string; color: string; bankrupt: boolean; taxiCount: number }[] };
      const rivals = (w.__jceCompetitors ?? []).filter((c) => !c.bankrupt && c.taxiCount > 0);
      setJobs((js) => {
        let changed = false;
        const next = js.map((j) => {
          if (j.status !== "offered") return j;
          // Init : par défaut joueur si rien n'est revendiqué
          if (!j.claimedBy) {
            changed = true;
            return { ...j, claimedBy: "player", claimedColor: currentPaint.color };
          }
          // Si actuellement au joueur : 18% de chance qu'un rival vole la couleur
          if (j.claimedBy === "player") {
            if (rivals.length && Math.random() < 0.18) {
              const r = rivals[Math.floor(Math.random() * rivals.length)];
              changed = true;
              return { ...j, claimedBy: r.id, claimedColor: r.color };
            }
            // Garder la couleur joueur à jour si elle a changé
            if (j.claimedColor !== currentPaint.color) {
              changed = true;
              return { ...j, claimedColor: currentPaint.color };
            }
            return j;
          }
          // Si à un rival : 22% que le joueur la reprenne, 8% qu'un autre rival la vole
          const roll = Math.random();
          if (roll < 0.22) {
            changed = true;
            return { ...j, claimedBy: "player", claimedColor: currentPaint.color };
          }
          if (roll < 0.30 && rivals.length > 1) {
            const others = rivals.filter((r) => r.id !== j.claimedBy);
            if (others.length) {
              const r = others[Math.floor(Math.random() * others.length)];
              changed = true;
              return { ...j, claimedBy: r.id, claimedColor: r.color };
            }
          }
          return j;
        });
        return changed ? next : js;
      });
    }, 4000);
    return () => window.clearInterval(t);
  }, [currentPaint.color]);


  // Synchronise la livrée/couleur si le joueur les change depuis le profil
  useEffect(() => {
    const onLivery = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (typeof id === "string") setSave((s) => ({ ...s, liveryId: id }));
    };
    const onColor = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (typeof id === "string") setSave((s) => ({ ...s, playerTaxiColor: id }));
    };
    window.addEventListener("jce:livery-changed", onLivery);
    window.addEventListener("jce:taxi-color-changed", onColor);
    return () => {
      window.removeEventListener("jce:livery-changed", onLivery);
      window.removeEventListener("jce:taxi-color-changed", onColor);
    };
  }, []);


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
    syncVehicleLane(free);
    // Transition douce : on mémorise la position actuelle pour interpoler
    // visuellement vers le nouveau path (évite le « saut » de voie).
    free.transitionFromX = here.x;
    free.transitionFromY = here.y;
    free.transitionUntil = performance.now() + TRANSITION_MS;
    setJobs((js) => js.map((j) => j.id === id ? { ...j, status: "accepted", acceptedAt: Date.now() } : j));
  };

  // === Mission spéciale joueur ===
  // Déclenchée par le bouton HUD. Injecte un client doré dans la file avec
  // récompense majorée + gros XP, et applique un cooldown.
  const triggerSpecialMission = () => {
    const now = Date.now();
    if (now < specialCooldownUntil) {
      const sec = Math.ceil((specialCooldownUntil - now) / 1000);
      showToast(`⏳ Prochaine mission dans ${sec}s`);
      return;
    }
    if (jobsRef.current.some((j) => j.tier === "special")) {
      showToast("👑 Une mission est déjà active");
      return;
    }
    const license = getLicense();
    const def = pickSpecialMission(license.level);
    // Génère un Job de base puis le surcharge en "special".
    const base = genJob(saveRef.current.depotTier);
    const special: Job = {
      ...base,
      tier: "special",
      specialMissionId: def.id,
      specialFareMult: def.fareMult,
      specialXp: def.xpReward,
      // tarif affiché = tarif majoré directement (clarté UX)
      fare: Math.round(base.fare * def.fareMult),
      duration: def.durationMs,
      deadline: now + def.durationMs,
      status: "offered",
    };
    setJobs((js) => [...js, special]);
    setSpecialCooldownUntil(now + SPECIAL_COOLDOWN_MS);
    showToast(`${def.emoji} ${def.title} — récupère le client !`);
  };



  // === Météo réelle : pousse une brève radio dès qu'on a les données, puis toutes les ~6 min ===
  const realEnv = useRealWorldEnv();
  useEffect(() => {
    if (!realEnv) return;
    const lang = (() => { try { return localStorage.getItem("mttw.lang") || "fr"; } catch { return "fr"; } })();
    const tempPart = realEnv.tempC != null ? `, ${realEnv.tempC}°C` : "";
    const news = {
      fr: `Météo en direct à ${realEnv.city} : ${weatherLabelFr(realEnv.weather)}${tempPart}. ${realEnv.isDay ? "Belle journée pour rouler !" : "Phares allumés, c'est la nuit en ville."}`,
      en: `Live weather in ${realEnv.city}: ${weatherLabelEn(realEnv.weather)}${tempPart}. ${realEnv.isDay ? "Great day for a ride!" : "Headlights on, night has fallen."}`,
    };
    // Pousse une première fois après 20 s, puis toutes les 6 min
    const t0 = window.setTimeout(() => pushNews(news), 20_000);
    const iv = window.setInterval(() => {
      refreshRealWorldEnv(false).then((e) => {
        if (!e) return;
        const tp = e.tempC != null ? `, ${e.tempC}°C` : "";
        pushNews({
          fr: `Bulletin météo à ${e.city} : ${weatherLabelFr(e.weather)}${tp}.`,
          en: `Weather update in ${e.city}: ${weatherLabelEn(e.weather)}${tp}.`,
        });
      });
    }, 6 * 60 * 1000);
    return () => { window.clearTimeout(t0); window.clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realEnv?.city, realEnv?.weather, realEnv?.isDay]);

  return (
    <>
      <WeatherNightOverlay />

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



        {/* Station-service — vraie station avec auvent, deux pompes, boutique */}
        {pathsReady && (
          <g transform={`translate(${admin.gasStationX},${admin.gasStationY})`} filter="url(#taxi-shadow)">
            {/* ombre globale */}
            <ellipse cx="0" cy="34" rx="62" ry="10" fill="rgba(0,0,0,0.55)" />

            {/* Dalle béton + marquages */}
            <rect x="-58" y="-6" width="116" height="42" rx="3" fill="#2b2f36" stroke="#0a0c10" strokeWidth="1.2" />
            <g opacity="0.6" stroke="#f5c542" strokeWidth="0.8" strokeDasharray="3 2" fill="none">
              <line x1="-58" y1="14" x2="58" y2="14" />
            </g>

            {/* Boutique (à droite) */}
            <rect x="18" y="-22" width="40" height="22" rx="1.5" fill="#e7ecf2" stroke="#0a0c10" strokeWidth="1.2" />
            <rect x="18" y="-28" width="40" height="6" rx="1" fill="#dc2626" stroke="#0a0c10" strokeWidth="1.2" />
            <text x="38" y="-23.5" fontSize="4.5" fontWeight="900" textAnchor="middle" fill="#fff" letterSpacing="0.8">SHOP 24/7</text>
            <rect x="22" y="-18" width="10" height="12" fill="#7dd3fc" opacity="0.9" stroke="#0a0c10" strokeWidth="0.6" />
            <rect x="34" y="-18" width="10" height="12" fill="#7dd3fc" opacity="0.9" stroke="#0a0c10" strokeWidth="0.6" />
            <rect x="46" y="-12" width="10" height="6" fill="#0a0c10" />

            {/* Auvent (canopée jaune) au-dessus des pompes */}
            <rect x="-58" y="-34" width="68" height="6" rx="1.5" fill="#f5c542" stroke="#0a0c10" strokeWidth="1.2" />
            <rect x="-56" y="-28" width="3" height="32" fill="#0a0c10" />
            <rect x="7" y="-28" width="3" height="32" fill="#0a0c10" />
            <rect x="-58" y="-38" width="68" height="4" rx="1" fill="#dc2626" stroke="#0a0c10" strokeWidth="1" />
            <text x="-24" y="-34.5" fontSize="3.6" fontWeight="900" textAnchor="middle" fill="#fff" letterSpacing="1.2">GAS &amp; GO</text>

            {/* Deux pompes */}
            {[-38, -14].map((px, i) => (
              <g key={i} transform={`translate(${px},6)`}>
                <rect x="-5" y="-12" width="10" height="18" rx="1" fill="#1f242b" stroke="#0a0c10" strokeWidth="0.8" />
                <rect x="-4" y="-10" width="8" height="6" fill="#22c55e" />
                <text y="-5.6" fontSize="3.4" fontWeight="900" textAnchor="middle" fill="#0a0c10">95</text>
                <rect x="-1" y="6" width="2" height="3" fill="#0a0c10" />
                {/* tuyau */}
                <path d={`M 5 -6 Q 9 -2 8 4`} stroke="#0a0c10" strokeWidth="1" fill="none" />
                <rect x="7" y="3" width="3" height="4" fill="#0a0c10" />
              </g>
            ))}

            {/* Totem prix sur le bord */}
            <g transform="translate(-66,8)">
              <rect x="-1" y="-22" width="2" height="22" fill="#0a0c10" />
              <rect x="-9" y="-30" width="18" height="14" rx="1.2" fill="#0e1217" stroke="#f5c542" strokeWidth="1" />
              <text y="-22" fontSize="3.6" fontWeight="900" textAnchor="middle" fill="#f5c542">⛽ 1.79</text>
              <text y="-17" fontSize="3.2" fontWeight="700" textAnchor="middle" fill="#fde68a">DIESEL</text>
            </g>

            {/* Petite enseigne illuminée */}
            <circle cx="-58" cy="-40" r="2.2" fill="#fde68a">
              <animate attributeName="opacity" values="0.4;1;0.4" dur="1.6s" repeatCount="indefinite" />
            </circle>
          </g>
        )}


        {/* Clients en attente (course offerte ou acceptée) — vue du ciel, sur le trottoir */}
        {jobs.map((j) => {
          const p = getSidewalk(j.pickupPath, j.pickup, j.sidePickup);
          const isSpecial = j.tier === "special";
          const isStar = j.tier === "star";
          const isVip = j.tier === "vip";
          // Couleur du joueur pour les courses encore proposées : chaque compagnie a sa
          // teinte, les missions affichent celle de qui les "revendique" (par défaut le joueur).
          const playerColor = currentPaint.color;
          // Couleur "revendiquée" par une compagnie (joueur ou rival).
          const claimColor = j.claimedColor ?? playerColor;
          const haloColor = isSpecial ? "#fde047" : isStar ? "#a855f7" : isVip ? "#fbbf24" : (j.status === "accepted" ? "#3b82f6" : claimColor);
          const ringColor = isSpecial ? "#a855f7" : haloColor;
          return (
            <g
              key={j.id}
              transform={`translate(${p.x},${p.y})`}
              style={{ cursor: j.status === "offered" ? "pointer" : "default", pointerEvents: "auto" }}
              onClick={(e) => {
                e.stopPropagation();
                if (j.status === "offered") acceptJob(j.id);
              }}
            >
              {/* halo au sol — plus gros et pulsant pour MISSION SPÉCIALE */}
              {isSpecial && (
                <circle r="22" fill="none" stroke={ringColor} strokeWidth="2" opacity="0.85">
                  <animate attributeName="r" values="18;26;18" dur="1.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0.3;0.9" dur="1.4s" repeatCount="indefinite" />
                </circle>
              )}
              <circle r={isSpecial ? 18 : (isStar || isVip ? 16 : 13)} fill={haloColor} opacity={isSpecial ? 0.5 : (isStar || isVip ? 0.35 : 0.22)} />
              <circle r="9" fill={haloColor} opacity="0.55" />
              {/* ombre douce au sol */}
              <ellipse cx="0" cy="0" rx="5.5" ry="5" fill="rgba(0,0,0,0.35)" />
              {/* épaules / corps vu du dessus */}
              <ellipse cx="0" cy="0" rx="5" ry="4" fill={haloColor} stroke="#0f172a" strokeWidth="0.7" />
              {/* tête vue du ciel */}
              <circle cx="0" cy="0" r="2.6" fill="#f1c79b" stroke="#0f172a" strokeWidth="0.5" />
              {/* badge VIP / STAR / SPECIAL */}
              {(isSpecial || isStar || isVip) && (
                <g transform="translate(0,-28)">
                  <rect x={isSpecial ? -18 : -12} y="-8" width={isSpecial ? 36 : 24} height="11" rx="3" fill={isSpecial ? "#a855f7" : isStar ? "#7c3aed" : "#b45309"} stroke="#fde047" strokeWidth="0.8" />
                  <text y="0.5" fontSize="7" fontWeight="900" textAnchor="middle" fill="#fde047">{isSpecial ? "👑 MISSION" : isStar ? "★ STAR" : "VIP"}</text>
                </g>
              )}
              {/* étiquette tarif */}
              <g transform="translate(0,-18)">
                <rect x="-16" y="-8" width="32" height="12" rx="3" fill="#0f172a" stroke={haloColor} strokeWidth="1" />
                <text y="1" fontSize="8" fontWeight="900" textAnchor="middle" fill={haloColor}>{fmt(j.fare)}$</text>
              </g>
            </g>

          );
        })}

        {/* Itinéraires des courses acceptées — flèche guide entre le taxi,
            le client (pickup) et la destination (dropoff). */}
        <defs>
          <marker id="tt-route-arrow" viewBox="0 0 10 10" refX="8" refY="5"
            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
          </marker>
          <marker id="tt-route-arrow-orange" viewBox="0 0 10 10" refX="8" refY="5"
            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
          </marker>
        </defs>
        {jobs.map((j) => {
          if (j.status !== "accepted") return null;
          const taxi = taxisRef.current.find((t) => t.jobId === j.id);
          if (!taxi) return null;
          const pickup = getSidewalk(j.pickupPath, j.pickup, j.sidePickup);
          const drop = getSidewalk(j.dropoffPath, j.dropoff, j.sideDrop);
          if (taxi.mode === "to_pickup") {
            const here = taxiXY(taxi);
            return (
              <line key={"r" + j.id} x1={here.x} y1={here.y} x2={pickup.x} y2={pickup.y}
                stroke="#3b82f6" strokeWidth="3" strokeOpacity="0.75"
                strokeDasharray="10 6" strokeLinecap="round"
                markerEnd="url(#tt-route-arrow)" pointerEvents="none" />
            );
          }
          if (taxi.mode === "to_dest") {
            const here = taxiXY(taxi);
            return (
              <line key={"r" + j.id} x1={here.x} y1={here.y} x2={drop.x} y2={drop.y}
                stroke="#f59e0b" strokeWidth="3" strokeOpacity="0.75"
                strokeDasharray="10 6" strokeLinecap="round"
                markerEnd="url(#tt-route-arrow-orange)" pointerEvents="none" />
            );
          }
          return null;
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


        {/* Dépôt principal — grand bâtiment cingé dans le décor (cliquable pour personnaliser) */}
        {pathsReady && (() => {
          const t = (performance.now() % 300000) / 300000;
          const daylight = Math.max(0, Math.sin(t * Math.PI * 2 + Math.PI / 2));
          const night = 0.1 + (1 - daylight) * 0.6;
          return (
            <g
              style={{ cursor: "pointer", pointerEvents: "auto" }}
              onClick={() => setShopOpen(true)}
            >
              <title>QG — Parking taxis (cliquer pour la boutique)</title>
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
            </g>
          );
        })()}



        {/* QG concurrent */}
        {pathsReady && admin.rivalEnabled && <RivalDepot x={admin.rivalHQX} y={admin.rivalHQY - 18} />}

        {/* Mascotte rivale qui nargue le joueur */}
        {pathsReady && admin.rivalEnabled && (
          <g transform={`translate(${admin.rivalHQX + 130},${admin.rivalHQY - 70})`} style={{ pointerEvents: "none" }}>
            {/* petit bonhomme */}
            <g>
              <ellipse cx="0" cy="34" rx="14" ry="3.5" fill="rgba(0,0,0,0.45)" />
              {/* corps */}
              <rect x="-9" y="6" width="18" height="22" rx="4" fill="#c81b2c" stroke="#0b0d10" strokeWidth="1.2" />
              {/* bras */}
              <rect x="-13" y="10" width="5" height="12" rx="2" fill="#c81b2c" stroke="#0b0d10" strokeWidth="1" />
              <rect x="8" y="10" width="5" height="12" rx="2" fill="#c81b2c" stroke="#0b0d10" strokeWidth="1" />
              {/* tête */}
              <circle cx="0" cy="-2" r="9" fill="#f1c27d" stroke="#0b0d10" strokeWidth="1.2" />
              {/* casquette */}
              <path d="M -9 -4 Q 0 -14 9 -4 L 9 -2 L -9 -2 Z" fill="#0b0d10" />
              <rect x="-12" y="-3" width="10" height="2" rx="1" fill="#0b0d10" />
              {/* yeux */}
              <circle cx="-3" cy="-2" r="1.1" fill="#0b0d10" />
              <circle cx="3" cy="-2" r="1.1" fill="#0b0d10" />
              {/* sourire narquois */}
              <path d="M -3 3 Q 0 5.5 3 3" stroke="#0b0d10" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              <animateTransform attributeName="transform" type="translate" values="0 0; 0 -3; 0 0" dur="1.6s" repeatCount="indefinite" />
            </g>
            {/* bulle de dialogue */}
            {rivalTaunt && (() => {
              const w = Math.max(70, rivalTaunt.length * 4.2 + 16);
              return (
                <g transform={`translate(${w / 2 + 12},-22)`}>
                  <path d={`M -${w / 2} -14 h ${w} q 6 0 6 6 v 14 q 0 6 -6 6 h -${w / 2 - 10} l -6 7 l -1 -7 h -${w / 2 - 3} q -6 0 -6 -6 v -14 q 0 -6 6 -6 z`}
                    fill="#fff" stroke="#0b0d10" strokeWidth="1.2" />
                  <text x="0" y="2" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#0b0d10">
                    {rivalTaunt}
                  </text>
                </g>
              );
            })()}
          </g>
        )}


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
              <TaxiSprite image={currentLivery.image} faceRight={currentLivery.faceRight} paintFilter={currentPaint.filter} markerColor={currentPaint.color} withClient={false} moving={true} />
            </g>
          );
        })}

        {/* Taxis rivaux (couleur sombre + bandeau rouge) */}
        {admin.rivalEnabled && rivalTaxisRef.current.map((r) => {
          const movingForward = r.target >= r.pos;
          const p = r.lane ?? getLaneXY(r.pathIdx, r.pos, movingForward);
          const angle = p.angle;
          return (
            <g key={r.id}>
              <g transform={`translate(${p.x},${p.y}) rotate(${angle})`} filter="url(#taxi-shadow)">
                <TaxiSprite image={TAXI_RED_URL} faceRight={true} withClient={r.mode === "to_dest"} moving={r.mode !== "idle"} />
              </g>
              
            </g>
          );
        })}

        {/* Radars fixes au bord de la route */}
        {RADARS.map((rd) => {
          const plen = pathLensRef.current[rd.pathIdx] ?? 0;
          if (plen <= 0) return null;
          // Radar ancré sur le trottoir (bord droit de la route), pas sur la voie
          const p = getSidewalk(rd.pathIdx, rd.posFrac * plen, 1);
          return (
            <g key={`radar-${rd.id}`} transform={`translate(${p.x},${p.y}) rotate(${p.angle})`}>
              {/* poteau */}
              <rect x="-1.5" y="-2" width="3" height="14" fill="#0b0d10" />
              {/* boîtier caméra */}
              <rect x="-7" y="-9" width="14" height="9" rx="2" fill="#222831" stroke="#0b0d10" strokeWidth="1" />
              <circle cx="0" cy="-4.5" r="3" fill="#0b0d10" stroke="#94a3b8" strokeWidth="0.8" />
              <circle cx="0" cy="-4.5" r="1.4" fill="#3b82f6" />
              <text x="0" y="-12" textAnchor="middle" fontSize="3.4" fontWeight="900" fill="#fbbf24" stroke="#0b0d10" strokeWidth="0.8" paintOrder="stroke">RADAR</text>
            </g>
          );
        })}

        {/* Planques police — emplacements de stationnement */}
        {HIDEOUTS.map((ho) => {
          const occupied = Object.values(stakeoutHideoutRef.current).includes(ho.id);
          return (
            <g key={`hideout-${ho.id}`} transform={`translate(${ho.x},${ho.y})`}>
              <rect x="-14" y="-9" width="28" height="18" rx="2"
                fill="#1f2937" opacity="0.45"
                stroke={occupied ? "#ef4444" : "#fbbf24"}
                strokeWidth="1.2" strokeDasharray="3 2" />
              {/* arbres autour pour la cachette */}
              <circle cx="-18" cy="-2" r="6" fill="#0f3d2e" opacity="0.85" />
              <circle cx="18" cy="2"   r="6" fill="#0f3d2e" opacity="0.85" />
              <circle cx="-16" cy="10" r="5" fill="#0f3d2e" opacity="0.85" />
            </g>
          );
        })}

        {/* Flash radar (cercle blanc bref) */}
        {(() => {
          void radarFlashTick;
          const fl = radarFlashRef.current;
          if (!fl) return null;
          return (
            <g key={`flash-${fl.id}-${fl.t}`} transform={`translate(${fl.x},${fl.y})`} pointerEvents="none">
              <circle r="60" fill="#ffffff" opacity="0.85">
                <animate attributeName="r" values="20;120" dur="0.3s" fill="freeze" />
                <animate attributeName="opacity" values="0.95;0" dur="0.3s" fill="freeze" />
              </circle>
            </g>
          );
        })()}

        {/* Voitures de police — patrouillent et chassent les contrevenants */}
        {policeCarsRef.current.map((pc) => {
          const movingForward = pc.target >= pc.pos;
          // Si planquée, on l'affiche sur le slot de stationnement
          const hidden = pc.mode === "stakeout_wait" && pc.hideoutXY;
          const p = hidden
            ? { x: pc.hideoutXY!.x, y: pc.hideoutXY!.y, angle: 0 }
            : (pc.lane ?? getLaneXY(pc.pathIdx, pc.pos, movingForward));
          const chasing = pc.mode === "chase";
          const controlling = pc.mode === "control_wait" || pc.mode === "control_drive";
          const t = Math.floor(performance.now() / 200) % 2;
          const flashing = chasing || controlling;
          const ledA = flashing ? (t === 0 ? "#3b82f6" : "#ef4444") : "#1f2937";
          const ledB = flashing ? (t === 0 ? "#ef4444" : "#3b82f6") : "#1f2937";
          void ledA; void ledB;

          return (
            <g key={pc.id} transform={`translate(${p.x},${p.y}) rotate(${p.angle})`} filter="url(#taxi-shadow)">
              {flashing && (
                <circle r="24" fill={t === 0 ? "#3b82f6" : "#ef4444"} opacity="0.28">
                  <animate attributeName="r" values="20;28;20" dur="0.5s" repeatCount="indefinite" />
                </circle>
              )}
              <g>
                <RoadAlignedVehicleSprite image={POLICE_CAR_URL} opacity={hidden ? 0.85 : 1}>
                {/* Voiture civile contrôlée, juste devant la police */}
                {controlling && (
                  <g transform="translate(0,-34)">
                    <rect x="-9" y="-14" width="18" height="28" rx="4" fill="#3a4a5a" stroke="#0b0d10" strokeWidth="1" />
                    <rect x="-7" y="-10" width="14" height="8" rx="2" fill="#1a2230" />
                    <rect x="-7" y="4" width="14" height="6" rx="1.5" fill="#1a2230" />
                    <circle cx="-6" cy="-13" r="1.4" fill="#fff7c0" />
                    <circle cx="6" cy="-13" r="1.4" fill="#fff7c0" />
                  </g>
                )}
                </RoadAlignedVehicleSprite>
              </g>
              {hidden && (
                <text x="0" y="-32" textAnchor="middle" fontSize="3.4" fontWeight="900" fill="#fbbf24" stroke="#0b0d10" strokeWidth="0.8" paintOrder="stroke">PLANQUE</text>
              )}
              {controlling && (
                <text x="0" y="36" textAnchor="middle" fontSize="3.6" fontWeight="900" fill="#fbbf24" stroke="#0b0d10" strokeWidth="0.8" paintOrder="stroke">CONTRÔLE</text>
              )}
            </g>
          );
        })}

        {/* Marqueurs d'accidents : cônes centrés, triangle, fumée + minuterie */}
        {accidentsRef.current.map((a) => {
          // Cônes orange placés en cercle autour du point d'accident
          const conePositions = [
            { x: -14, y: 0 }, { x: 14, y: 0 },
            { x: 0, y: -14 }, { x: 0, y: 14 },
            { x: -10, y: -10 }, { x: 10, y: 10 },
            { x: 10, y: -10 }, { x: -10, y: 10 },
          ];
          const remaining = a.clearAt ? Math.max(0, Math.ceil((a.clearAt - performance.now()) / 1000)) : null;
          return (
            <g key={`acc-${a.id}`} transform={`translate(${a.x},${a.y})`} pointerEvents="none">
              {/* zone rouge pulsante */}
              <circle r="22" fill="#ef4444" opacity="0.18">
                <animate attributeName="r" values="18;28;18" dur="1.4s" repeatCount="indefinite" />
              </circle>
              {/* Cônes de signalisation orange centrés autour de l'accident */}
              {conePositions.map((c, i) => (
                <g key={i} transform={`translate(${c.x},${c.y})`}>
                  <ellipse cx="0" cy="2" rx="3" ry="1" fill="#0b0d10" opacity="0.6" />
                  <polygon points="0,-4 2.6,2 -2.6,2" fill="#fb923c" stroke="#0b0d10" strokeWidth="0.5" />
                  <rect x="-2" y="-0.6" width="4" height="0.9" fill="#fff" opacity="0.9" />
                </g>
              ))}
              {/* fumée */}
              <circle cx="-4" cy="-8" r="5" fill="#1f2937" opacity="0.55">
                <animate attributeName="cy" values="-8;-16;-8" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.55;0.1;0.55" dur="2.4s" repeatCount="indefinite" />
              </circle>
              <circle cx="5" cy="-10" r="4" fill="#374151" opacity="0.5">
                <animate attributeName="cy" values="-10;-18;-10" dur="2.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0.05;0.5" dur="2.8s" repeatCount="indefinite" />
              </circle>
              {/* triangle de signalisation */}
              <polygon points="0,-9 8,5 -8,5" fill="#fbbf24" stroke="#0b0d10" strokeWidth="1.2" />
              <text x="0" y="3" textAnchor="middle" fontSize="7" fontWeight="900" fill="#0b0d10">!</text>
              <text x="0" y="18" textAnchor="middle" fontSize="3.6" fontWeight="900" fill={a.severity === "serious" ? "#ef4444" : "#fbbf24"} stroke="#0b0d10" strokeWidth="0.8" paintOrder="stroke">
                {a.severity === "serious" ? "⚠ ACCIDENT GRAVE" : (a.kind === "vehicle" ? "ACCIDENT" : "BLESSÉ")}
              </text>
              {/* Indicateurs de présence des 3 secours (🚑 🚒 🚓) */}
              {(() => {
                const kinds: Array<"ambulance" | "firetruck" | "police"> = ["ambulance", "firetruck", "police"];
                const icons = { ambulance: "🚑", firetruck: "🚒", police: "🚓" } as const;
                const here = new Set(
                  emergencyRef.current
                    .filter((e) => e.accidentId === a.id && e.mode === "onsite")
                    .map((e) => e.kind)
                );
                return (
                  <g transform="translate(0,-30)">
                    {kinds.map((k, i) => {
                      const ok = here.has(k);
                      return (
                        <g key={k} transform={`translate(${(i - 1) * 8},0)`}>
                          <circle r="3.4" fill={ok ? "#16a34a" : "#3a3f48"} stroke="#0b0d10" strokeWidth="0.5" />
                          <text x="0" y="1.6" textAnchor="middle" fontSize="3.8">{icons[k]}</text>
                        </g>
                      );
                    })}
                  </g>
                );
              })()}
              {/* Minuterie d'intervention (démarre quand les 3 secours sont arrivés) */}
              {remaining !== null && remaining > 0 ? (
                <g transform="translate(0,-40)">
                  <rect x="-11" y="-6" width="22" height="11" rx="2.5" fill="#0b0d10" stroke="#16a34a" strokeWidth="1" />
                  <text x="0" y="2.4" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#34d399">⏱ {remaining}s</text>
                </g>
              ) : (
                <g transform="translate(0,-40)">
                  <rect x="-16" y="-6" width="32" height="11" rx="2.5" fill="#0b0d10" stroke="#ef4444" strokeWidth="1" />
                  <text x="0" y="2.4" textAnchor="middle" fontSize="5" fontWeight="900" fill="#fca5a5">SECOURS…</text>
                </g>
              )}
            </g>
          );
        })}


        {emergencyRef.current.map((ev) => {
          const movingForward = ev.target >= ev.pos;
          const p = ev.lane ?? getLaneXY(ev.pathIdx, ev.pos, movingForward);
          const alerting = ev.mode === "respond" || ev.mode === "onsite";
          const t = Math.floor(performance.now() / 200) % 2;
          const href = ev.kind === "ambulance" ? AMBULANCE_URL : ev.kind === "firetruck" ? FIRETRUCK_URL : POLICE_CAR_URL;
          const W = VEHICLE_SIZE; // même taille que tous les autres véhicules
          const blueOn = t === 0;
          return (
            <g key={ev.id} transform={`translate(${p.x},${p.y}) rotate(${p.angle})`} filter="url(#taxi-shadow)">
              <g>
                <RoadAlignedVehicleSprite image={href} size={W}>
                {alerting && (
                  <g>
                    {/* halo lumineux localisé autour de chaque dôme */}
                    <circle cx="-3" cy="0" r="3.2" fill="#3b82f6" opacity={blueOn ? 0.55 : 0.12} />
                    <circle cx="3" cy="0" r="3.2" fill="#ef4444" opacity={blueOn ? 0.12 : 0.55} />
                    {/* barre de gyrophares posée en travers du toit */}
                    <rect x="-6" y="-1.7" width="12" height="3.4" rx="1.1" fill="#0b0d10" stroke="#1f2937" strokeWidth="0.3" />
                    <rect x="-5.5" y="-1.4" width="5" height="2.8" rx="0.8" fill={blueOn ? "#60a5fa" : "#1e3a8a"} />
                    <rect x="0.5" y="-1.4" width="5" height="2.8" rx="0.8" fill={blueOn ? "#7f1d1d" : "#f87171"} />
                  </g>
                )}
                </RoadAlignedVehicleSprite>
              </g>
              {alerting && (
                <text x="0" y="32" textAnchor="middle" fontSize="3.6" fontWeight="900" fill="#fbbf24" stroke="#0b0d10" strokeWidth="0.8" paintOrder="stroke">
                  {ev.kind === "ambulance" ? "URGENCE" : ev.kind === "firetruck" ? "POMPIERS" : "POLICE"}
                </text>
              )}
            </g>
          );
        })}




        {(() => {
          // Calcule les positions monde des places de parking du QG
          const hqCx = depotXY.x;
          const hqCy = depotXY.y - 18;
          const scale = admin.hqScale;
          const rot = (admin.hqRotation * Math.PI) / 180;
          const cosR = Math.cos(rot);
          const sinR = Math.sin(rot);
          const W = 260;
          const slotsCount = 4 + (save.hqCapacityLvl ?? 0);
          const slotW = (W - 60) / slotsCount;
          const slotWorld = (i: number) => {
            const lx = -W / 2 + 30 + i * slotW + slotW / 2;
            const ly = 30;
            const sx = lx * scale;
            const sy = ly * scale;
            return {
              x: hqCx + sx * cosR - sy * sinR,
              y: hqCy + sx * sinR + sy * cosR,
              angle: -90 + admin.hqRotation, // taxi nez vers le bâtiment
            };
          };
          // Tout taxi idle ou en dépôt est garé visuellement dans le QG
          // (sa logique de retour s'est déjà assurée qu'il a rejoint le QG).
          const parked: { taxi: Taxi; slot: number }[] = [];
          const parkedIds = new Set<number>();
          taxisRef.current.forEach((t) => {
            if (t.mode === "depositing" || t.mode === "idle") {
              parked.push({ taxi: t, slot: 0 });
              parkedIds.add(t.id);
            }
          });

          parked.forEach((p, i) => { p.slot = i % slotsCount; });

          return taxisRef.current.map((taxi) => {
            const movingForward = taxi.target >= taxi.pos;
            const onPath = taxi.lane ?? getLaneXY(taxi.pathIdx, taxi.pos, movingForward);
            const parkInfo = parked.find((q) => q.taxi.id === taxi.id);
            let p = parkInfo ? slotWorld(parkInfo.slot) : onPath;
            // Transition douce après acceptation : lerp visuel pour éviter le saut.
            if (!parkInfo && taxi.transitionUntil && taxi.transitionFromX != null && taxi.transitionFromY != null) {
              const tNow = performance.now();
              if (tNow < taxi.transitionUntil) {
                const k = 1 - (taxi.transitionUntil - tNow) / TRANSITION_MS;
                const ease = k * k * (3 - 2 * k);
                const lx = taxi.transitionFromX + (onPath.x - taxi.transitionFromX) * ease;
                const ly = taxi.transitionFromY + (onPath.y - taxi.transitionFromY) * ease;
                const dxA = onPath.x - taxi.transitionFromX;
                const dyA = onPath.y - taxi.transitionFromY;
                const ang = Math.hypot(dxA, dyA) > 2
                  ? (Math.atan2(dyA, dxA) * 180) / Math.PI
                  : onPath.angle;
                p = { x: lx, y: ly, angle: ang };
              }
            }
            const angle = p.angle;
            const fuelPct = Math.max(0, Math.min(1, taxi.fuel / 100));
            const fuelLow = taxi.fuel < FUEL_LOW_THRESHOLD;
            const isHonking = honkingTaxis.has(taxi.id);
            return (
              <g key={taxi.id}>
                <g
                  transform={`translate(${p.x},${p.y}) rotate(${angle})`}
                  filter="url(#taxi-shadow)"
                  style={{ cursor: "pointer", pointerEvents: "auto" }}
                  onClick={(e) => { e.stopPropagation(); honkTaxi(taxi.id); }}
                >
                  <TaxiSprite image={currentLivery.image} faceRight={currentLivery.faceRight} paintFilter={currentPaint.filter} markerColor={currentPaint.color} withClient={taxi.mode === "to_dest"} moving={taxi.mode !== "idle" && taxi.mode !== "refueling" && taxi.mode !== "depositing"} />
                </g>
                {/* Coup de phare + halo klaxon */}
                {isHonking && (
                  <g transform={`translate(${p.x},${p.y})`} pointerEvents="none">
                    <circle r="34" fill="none" stroke="#fde047" strokeWidth="3" opacity="0.85">
                      <animate attributeName="r" from="14" to="44" dur="0.6s" fill="freeze" />
                      <animate attributeName="opacity" from="0.95" to="0" dur="0.6s" fill="freeze" />
                    </circle>
                    <text y="-36" fontSize="14" fontWeight="900" textAnchor="middle" fill="#fde047" stroke="#0a0c10" strokeWidth="2" paintOrder="stroke">📯 BIP</text>
                  </g>
                )}
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
          });
        })()}


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
            <span className="tt-stat-val">{taxiCount}/{effectiveMaxTaxis} taxis</span>
          </div>
          {admin.rivalEnabled && (() => {
            const me = save.totalEarned;
            const them = rivalEarnings;
            const total = Math.max(1, me + them);
            const mePct = Math.round((me / total) * 100);
            const lead = me - them;
            return (
              <div
                className="tt-stat"
                style={{ color: lead >= 0 ? "#34d399" : "#ff6b7a", flexDirection: "column", alignItems: "stretch", gap: 2, minWidth: 130 }}
                title={`Toi : ${fmt(me)}$ • Rival : ${fmt(them)}$ • Volées : ${rivalStolen}`}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span>⚔️ DUEL</span>
                  <span>{lead >= 0 ? `+${fmt(lead)}$` : `${fmt(lead)}$`}</span>
                </div>
                <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: "#1f2127" }}>
                  <div style={{ width: `${mePct}%`, background: "#34d399" }} />
                  <div style={{ flex: 1, background: "#ff6b7a" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#9ca3af" }}>
                  <span>Toi {fmt(me)}$</span>
                  <span>Rival {fmt(them)}$ · {rivalStolen} vol.</span>
                </div>
              </div>
            );
          })()}
          {(() => {
            const city = getCityLevel(save.cityFund);
            const nextT = city.next?.threshold ?? city.threshold;
            const prevT = city.threshold;
            const pct = city.next ? Math.min(100, Math.round(((save.cityFund - prevT) / (nextT - prevT)) * 100)) : 100;
            return (
              <div className="tt-stat tt-city" title={`Caisse de la ville : ${fmt(save.cityFund)}$ — alimentée par les amendes`}>
                <span className="tt-stat-icon">{city.emoji}</span>
                <span className="tt-stat-val">{city.name}</span>
                <div className="tt-city-bar"><div className="tt-city-fill" style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })()}
          {saveBlink && (
            <div className="tt-save-blink">💾 Sauvegardé</div>
          )}
        </div>


        {/* === Bouton flottant Missions (compact) === */}
        {(() => {
          const offeredCount = jobs.filter((j) => j.status === "offered").length;
          const inProgressCount = jobs.filter((j) => j.status !== "offered").length;
          return (
            <button
              className="tt-missions-fab"
              onClick={() => setMissionsOpen(true)}
              title="Missions, contrats et dépôt"
            >
              <span className="tt-mfab-ico">📋</span>
              <span className="tt-mfab-lbl">Missions</span>
              {offeredCount > 0 && <span className="tt-mfab-badge">{offeredCount}</span>}
              {inProgressCount > 0 && <span className="tt-mfab-badge tt-mfab-badge-blue">{inProgressCount}</span>}
            </button>
          );
        })()}

        {/* === Panneau Missions === */}
        {missionsOpen && (
          <div className="tt-missions-overlay" onClick={() => setMissionsOpen(false)}>
            <div className="tt-missions-panel" onClick={(e) => e.stopPropagation()}>
              <div className="tt-missions-head">
                <h3>📋 Missions & Dépôt</h3>
                <button className="tt-missions-x" onClick={() => setMissionsOpen(false)}>×</button>
              </div>
              <div className="tt-missions-tabs">
                <button
                  className={`tt-missions-tab ${missionsTab === "contracts" ? "active" : ""}`}
                  onClick={() => setMissionsTab("contracts")}
                >
                  🚕 Courses ({jobs.length})
                </button>
                <button
                  className={`tt-missions-tab ${missionsTab === "depot" ? "active" : ""}`}
                  onClick={() => setMissionsTab("depot")}
                >
                  🏢 Dépôt
                </button>
              </div>

              {missionsTab === "contracts" && (
                <div className="tt-missions-body">
                  {jobs.length === 0 && (
                    <div className="tt-empty">En attente d'appels…</div>
                  )}
                  {jobs.slice().sort((a, b) => {
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
                      <div
                        key={j.id}
                        className={`tt-contract tt-mission-player ${urgent ? "urgent" : ""} ${!isOffered ? "in-progress" : ""}`}
                        style={{
                          borderLeft: `5px solid ${currentPaint.color}`,
                          boxShadow: `inset 3px 0 0 ${currentPaint.color}33`,
                        }}
                      >
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
                              onClick={() => { acceptJob(j.id); }}
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
              )}

              {missionsTab === "depot" && (
                <div className="tt-missions-body">
                  <div className="tt-depot-card-inline">
                    <div className="tt-depot-name">{tier.name} (x{tier.fareMult.toFixed(1)})</div>
                    <div className="tt-depot-stats">
                      {taxiCount}/{effectiveMaxTaxis} taxis • Tarifs ×{tier.fareMult.toFixed(1)}
                    </div>
                  </div>
                  <div className="tt-depot-stat-row"><span>👥 Clients servis</span><b>{save.customersServed}</b></div>
                  <div className="tt-depot-stat-row"><span>🚕 Flotte</span><b>{taxiCount}/{effectiveMaxTaxis}</b></div>
                  <div className="tt-depot-stat-row"><span>🚦 En course</span><b>{taxisRef.current.filter((t) => t.mode !== "idle").length}</b></div>
                  <div className="tt-depot-stat-row"><span>💵 Trésorerie</span><b style={{ color: "#34d399" }}>{fmt(save.money)}$</b></div>
                </div>
              )}
            </div>
          </div>
        )}




        <button
          className="tt-actions-fab"
          onClick={() => setActionsOpen((v) => !v)}
          title={actionsOpen ? "Réduire les actions" : "Afficher les actions"}
          aria-expanded={actionsOpen}
        >
          <span className="tt-mfab-ico">{actionsOpen ? "✕" : "🛠️"}</span>
          <span className="tt-mfab-lbl">{actionsOpen ? "Fermer" : "Actions"}</span>
        </button>

        {actionsOpen && (
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
          <button
            className="tt-btn"
            onClick={repairTaxis}
            disabled={wearNow <= 0 || save.money < maintenanceCost}
            title={wearNow >= 70 ? "Usure critique : revenus réduits !" : "Garde ta flotte en forme"}
          >
            <span className="tt-btn-ico">{wearNow >= 70 ? "⚠️" : "🔧"}</span>
            <span className="tt-btn-lbl">Entretien {wearNow}%</span>
            <span className="tt-btn-cost">{wearNow > 0 ? `${fmt(maintenanceCost)}$` : "OK"}</span>
          </button>
          <button className="tt-btn shop" onClick={() => setShopOpen(true)} title="Boutique d'améliorations QG">
            <span className="tt-btn-ico">🏪</span>
            <span className="tt-btn-lbl">Boutique QG</span>
            <span className="tt-btn-cost">Améliorations</span>
          </button>
        </div>
        )}


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

        {/* Bouton MISSION SPÉCIALE — déclenche un client doré */}
        {(() => {
          const now = nowTick;
          const remaining = Math.max(0, specialCooldownUntil - now);
          const cooling = remaining > 0;
          const sec = Math.ceil(remaining / 1000);
          const pct = cooling ? 1 - remaining / SPECIAL_COOLDOWN_MS : 1;
          return (
            <button
              className={`tt-special-fab ${cooling ? "cooling" : "ready"}`}
              onClick={triggerSpecialMission}
              disabled={cooling}
              title={cooling ? `Cooldown ${sec}s` : "Déclencher une mission spéciale"}
            >
              <span className="tt-special-ring" style={{ background: `conic-gradient(#fde047 ${pct * 360}deg, rgba(255,255,255,0.15) 0deg)` }} />
              <span className="tt-special-core">{cooling ? `${sec}s` : "👑"}</span>
              <span className="tt-special-lbl">Mission</span>
            </button>
          );
        })()}

        {/* Musique de fond : gérée globalement par <BackgroundMusic /> dans __root.tsx */}

        {garageOpen && (
          <div className="tt-modal-overlay" onClick={() => setGarageOpen(false)}>
            <div className="tt-modal" onClick={(e) => e.stopPropagation()}>
              <div className="tt-modal-h">
                <h3>🏁 Garage — Livrées de taxi</h3>
                <button className="tt-modal-x" onClick={() => setGarageOpen(false)}>×</button>
              </div>
              <p className="tt-modal-sub">Couleur du taxi joueur :</p>
              <div className="tt-paint-grid">
                {TAXI_PAINTS.map((paint) => (
                  <button
                    key={paint.id}
                    className={`tt-paint ${save.playerTaxiColor === paint.id ? "selected" : ""}`}
                    onClick={() => setSave((s) => ({ ...s, playerTaxiColor: paint.id }))}
                    title={paint.name}
                  >
                    <span style={{ background: paint.color }} />
                    {paint.name}
                  </button>
                ))}
              </div>
              <p className="tt-modal-sub">Choisis le modèle de ta flotte :</p>
              <div className="tt-livery-grid">
                {allLiveries.map((l) => (
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
        .tt-stat.tt-city { color: #fde047; position: relative; padding-right: 10px; }
        .tt-city-bar { position: absolute; left: 8px; right: 8px; bottom: 2px; height: 3px; background: rgba(255,255,255,0.15); border-radius: 2px; overflow: hidden; }
        .tt-city-fill { height: 100%; background: linear-gradient(90deg, #fde047, #f97316); transition: width 0.4s ease; }

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
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        .tt-missions-fab, .tt-garage-fab, .tt-c-accept, .tt-c-x, .tt-missions-x, .tt-missions-tab {
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
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
          pointer-events: auto;
        }
        .tt-shop-overlay * { pointer-events: auto; }
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

        .tt-special-fab {
          position: absolute; bottom: 12px; right: 60px;
          width: 58px; height: 58px; border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, #fef3c7, #a855f7 70%, #4c1d95);
          border: 2px solid #1a1d22; color: #fff;
          cursor: pointer; pointer-events: auto;
          box-shadow: 0 4px 14px rgba(168,85,247,0.55), inset 0 1px 0 rgba(255,255,255,0.3);
          display: flex; align-items: center; justify-content: center; flex-direction: column;
          padding: 0; overflow: hidden;
        }
        .tt-special-fab.ready { animation: ttSpecialPulse 1.8s ease-in-out infinite; }
        .tt-special-fab:disabled { cursor: not-allowed; opacity: 0.85; animation: none; }
        .tt-special-ring {
          position: absolute; inset: 3px; border-radius: 50%;
          -webkit-mask: radial-gradient(circle, transparent 60%, #000 62%);
                  mask: radial-gradient(circle, transparent 60%, #000 62%);
          pointer-events: none;
        }
        .tt-special-core { font-size: 20px; line-height: 1; z-index: 1; font-weight: 900; text-shadow: 0 1px 2px rgba(0,0,0,0.6); }
        .tt-special-lbl { font-size: 8px; font-weight: 800; letter-spacing: 0.5px; z-index: 1; margin-top: 2px; color: #fde047; }
        @keyframes ttSpecialPulse {
          0%, 100% { box-shadow: 0 4px 14px rgba(168,85,247,0.55), inset 0 1px 0 rgba(255,255,255,0.3); }
          50% { box-shadow: 0 4px 22px rgba(253,224,71,0.85), inset 0 1px 0 rgba(255,255,255,0.5); }
        }

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
        .tt-paint-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
          gap: 8px; margin-bottom: 14px;
        }
        .tt-paint {
          min-height: 38px; display: flex; align-items: center; justify-content: center; gap: 7px;
          background: #14171c; border: 2px solid #2a2f38; border-radius: 8px;
          color: #e8edf2; font-size: 11px; font-weight: 800; cursor: pointer;
        }
        .tt-paint span { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.65); box-shadow: 0 2px 6px rgba(0,0,0,0.5); }
        .tt-paint.selected { border-color: #f5c542; background: #20231a; }
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
          .tt-missions-fab { top: 48px; padding: 4px 8px; font-size: 10px; }
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

        /* === Bouton flottant Missions + Panneau coulissant === */
        .tt-missions-fab {
          position: absolute; top: 56px; right: 10px;
          display: flex; align-items: center; gap: 6px;
          background: linear-gradient(180deg, #1f2127 0%, #0d0e12 100%);
          border: 1px solid #f5c542; border-radius: 999px;
          padding: 7px 14px; color: #fde68a;
          font-family: inherit; font-weight: 900; font-size: 12px;
          cursor: pointer; pointer-events: auto;
          box-shadow: 0 4px 12px rgba(0,0,0,0.6);
        }
        .tt-missions-fab:hover { filter: brightness(1.15); }
        .tt-mfab-ico { font-size: 16px; }
        .tt-mfab-badge {
          background: #ef4444; color: #fff; font-size: 10px; font-weight: 900;
          border-radius: 999px; padding: 1px 6px; min-width: 16px; text-align: center;
        }
        .tt-mfab-badge-blue { background: #3b82f6; }

        .tt-actions-fab {
          position: absolute; bottom: 16px; right: 10px;
          display: flex; align-items: center; gap: 6px;
          background: linear-gradient(180deg, #2a2d34, #14161b);
          border: 1px solid #f5c542; border-radius: 999px;
          padding: 10px 16px; color: #fde68a;
          font-family: inherit; font-weight: 900; font-size: 12px;
          cursor: pointer; pointer-events: auto;
          box-shadow: 0 4px 12px rgba(0,0,0,0.65);
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          min-height: 44px;
          z-index: 31;
        }
        .tt-actions-fab:active { transform: translateY(1px); }
        .tt-actions-fab:hover { filter: brightness(1.15); }

        .tt-missions-overlay {
          position: absolute; inset: 0; z-index: 80;
          background: rgba(0,0,0,0.55);
          display: flex; justify-content: flex-end;
          pointer-events: auto; backdrop-filter: blur(3px);
        }
        .tt-missions-panel {
          width: 100%; max-width: 360px; height: 100%;
          background: linear-gradient(180deg, #14171c 0%, #0a0c10 100%);
          border-left: 1px solid #2a2f38;
          display: flex; flex-direction: column;
          box-shadow: -10px 0 30px rgba(0,0,0,0.7);
          animation: ttMissionsSlide 0.22s ease;
        }
        @keyframes ttMissionsSlide {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .tt-missions-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 14px; border-bottom: 1px solid #2a2f38;
        }
        .tt-missions-head h3 { margin: 0; color: #fde68a; font-size: 15px; }
        .tt-missions-x { background: transparent; border: none; color: #8a8e94; font-size: 26px; line-height: 1; cursor: pointer; }
        .tt-missions-tabs { display: flex; gap: 4px; padding: 8px 8px 0; }
        .tt-missions-tab {
          flex: 1; padding: 8px; background: #1a1d22; color: #9ca0a6;
          border: 1px solid #2a2f38; border-radius: 8px 8px 0 0;
          font-family: inherit; font-weight: 800; font-size: 12px; cursor: pointer;
        }
        .tt-missions-tab.active { background: #20231a; color: #fde68a; border-color: #f5c542; border-bottom-color: transparent; }
        .tt-missions-body {
          flex: 1; overflow-y: auto; padding: 12px;
          display: flex; flex-direction: column; gap: 8px;
        }
        .tt-depot-card-inline {
          background: rgba(20,22,28,0.95); border: 1px solid #f5c542;
          border-radius: 10px; padding: 10px; text-align: center;
        }
        .tt-depot-stat-row {
          display: flex; justify-content: space-between;
          padding: 8px 12px; background: #1a1d22; border: 1px solid #2a2f38;
          border-radius: 8px; font-size: 13px; color: #c8ccd2;
        }
        .tt-depot-stat-row b { color: #fff; }

        .tt-save-blink {
          position: absolute; top: 12px; right: 12px;
          background: rgba(20,22,28,0.92);
          border: 1px solid #34d399;
          color: #34d399;
          font-size: 11px; font-weight: 800;
          padding: 4px 10px; border-radius: 20px;
          pointer-events: none;
          animation: ttSaveBlink 1s ease forwards;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          z-index: 40;
        }
        @keyframes ttSaveBlink {
          0% { opacity: 0; transform: translateY(-6px); }
          20%, 80% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-6px); }
        }
      `}</style>

    </>
  );
}
