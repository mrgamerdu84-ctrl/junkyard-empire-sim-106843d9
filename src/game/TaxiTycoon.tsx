import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ROADS } from "./CityTraffic";
import taxiTopdown from "@/assets/taxi-topdown.png";
import { getAdmin, useAdminConfig } from "./adminConfig";

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
  { id: "red",    name: "Rouge", body: "#d83a2a", trim: "#7c1c10" },
  { id: "blue",   name: "Bleu",  body: "#2b6ed8", trim: "#143f7c" },
  { id: "green",  name: "Vert",  body: "#3a8a48", trim: "#1c4a22" },
  { id: "white",  name: "Blanc", body: "#e8edf2", trim: "#8a8e94" },
  { id: "black",  name: "Noir",  body: "#1a1d22", trim: "#050607" },
  { id: "orange", name: "Orange",body: "#ff6b35", trim: "#8f2d10" },
  { id: "purple", name: "Violet",body: "#a855f7", trim: "#5b1aa0" },
];

type TaxiMode = "idle" | "to_pickup" | "to_dest" | "returning";
type Taxi = {
  id: number;
  pos: number;        // longueur le long du path
  target: number;
  mode: TaxiMode;
  speed: number;
  colorId: string;
  clientId: number | null;
};

type Client = {
  id: number;
  pickup: number;
  dropoff: number;
  fare: number;
  assigned: number | null;
  spawnedAt: number;
  sidePickup: 1 | -1;
  sideDrop: 1 | -1;
};

const DEFAULT_DEPOT_POS = 0.78; // 78% le long de la route ; override possible via Admin Panel
const SAVE_KEY = "taxi-tycoon-v1";
const BASE_SPEED = 60; // px (sur viewBox 1920) par seconde
const SPEED_UPGRADE_COST_BASE = 800;
const TAXI_COST_BASE = 600;
const MAX_CONTRACTS = 3;

type ContractKind = "clients" | "earn" | "streak";
type Contract = {
  id: number;
  kind: ContractKind;
  label: string;
  icon: string;
  target: number;
  progress: number;
  deadline: number;     // epoch ms
  duration: number;     // ms initial
  rewardCash: number;
  rewardMult?: number;
  rewardMultSec?: number;
};

type ActiveBoost = { mult: number; until: number } | null;

type SaveData = {
  money: number;
  customersServed: number;
  totalEarned: number;
  depotTier: number;
  taxiSpeedLvl: number;
  taxis: { colorId: string }[];
  defaultColor: string;
  contractsCompleted: number;
};

const DEFAULT_SAVE: SaveData = {
  money: 250,
  customersServed: 0,
  totalEarned: 0,
  depotTier: 0,
  taxiSpeedLvl: 0,
  taxis: [{ colorId: "yellow" }],
  defaultColor: "yellow",
  contractsCompleted: 0,
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
  body,
  trim,
  withClient,
  moving,
}: {
  body: string;
  trim: string;
  withClient: boolean;
  moving: boolean;
}) {
  // Image top-down réelle du taxi. L'image native pointe le capot vers le haut ;
  // on la tourne de 90° pour que "forward" du sprite (angle 0 = vers la droite)
  // corresponde au sens de déplacement le long du path.
  const W = 64; // longueur du taxi (sens de la marche)
  const H = 38; // largeur du taxi
  const uid = React.useId().replace(/:/g, "");
  const maskId = `taxi-mask-${uid}`;
  const needTint = body.toLowerCase() !== "#f5c542";
  return (
    <g>
      {/* lignes de vitesse derrière le taxi quand il roule */}
      {moving && (
        <g opacity="0.55">
          <line x1={-W / 2 - 10} y1="-6" x2={-W / 2 - 2} y2="-6" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round">
            <animate attributeName="x1" values={`${-W / 2 - 2};${-W / 2 - 12}`} dur="0.45s" repeatCount="indefinite" />
          </line>
          <line x1={-W / 2 - 12} y1="0" x2={-W / 2 - 3} y2="0" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round">
            <animate attributeName="x1" values={`${-W / 2 - 3};${-W / 2 - 14}`} dur="0.4s" begin="0.15s" repeatCount="indefinite" />
          </line>
          <line x1={-W / 2 - 10} y1="6" x2={-W / 2 - 2} y2="6" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round">
            <animate attributeName="x1" values={`${-W / 2 - 4};${-W / 2 - 14}`} dur="0.45s" begin="0.3s" repeatCount="indefinite" />
          </line>
        </g>
      )}
      <ellipse cx="0" cy="2" rx={W / 2 + 2} ry={H / 2 - 2} fill="rgba(0,0,0,0.45)" />
      {/* groupe carrosserie avec léger bobbing de suspension quand le taxi roule */}
      <g>
        {moving && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 -0.4; 0 0.4; 0 -0.4"
            dur="0.22s"
            repeatCount="indefinite"
          />
        )}
        <g transform="rotate(90)">
          {needTint && (
            <defs>
              <mask id={maskId} maskUnits="userSpaceOnUse">
                <image
                  href={taxiTopdown}
                  x={-H / 2}
                  y={-W / 2}
                  width={H}
                  height={W}
                  preserveAspectRatio="xMidYMid meet"
                />
              </mask>
            </defs>
          )}
          <image
            href={taxiTopdown}
            x={-H / 2}
            y={-W / 2}
            width={H}
            height={W}
            preserveAspectRatio="xMidYMid meet"
          />
          {needTint && (
            <rect
              x={-H / 2}
              y={-W / 2}
              width={H}
              height={W}
              fill={body}
              opacity={0.55}
              style={{ mixBlendMode: "multiply" }}
              mask={`url(#${maskId})`}
            />
          )}
        </g>
        {withClient && (
          <g>
            <circle cx="-4" cy="-3" r="2.6" fill="#ffd9b0" stroke="#1a1d22" strokeWidth="0.4" />
            <circle cx="-4" cy="3" r="2.6" fill="#c89372" stroke="#1a1d22" strokeWidth="0.4" />
          </g>
        )}
      </g>
      <ellipse cx="0" cy={H / 2 - 1} rx={W / 2 - 4} ry="1.2" fill={trim} opacity="0.35" />
    </g>
  );
}

function Depot({ tier, x, y, scale = 1, rotation = 0 }: { tier: DepotTier; x: number; y: number; scale?: number; rotation?: number }) {
  const idx = DEPOT_TIERS.indexOf(tier);
  const gradId = `dpt-g-${idx}`;
  const roofId = `dpt-r-${idx}`;
  const winId = `dpt-w-${idx}`;
  return (
    <g transform={`translate(${x},${y}) scale(${scale}) rotate(${rotation})`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d0d5dc" />
          <stop offset="30%" stopColor="#9ea4ad" />
          <stop offset="100%" stopColor={tier.core} />
        </linearGradient>
        <linearGradient id={roofId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8edf2" />
          <stop offset="60%" stopColor={tier.ring} />
          <stop offset="100%" stopColor="#1a1d22" />
        </linearGradient>
        <linearGradient id={winId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff1a3" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      {/* ombre + parvis béton */}
      <ellipse cx="0" cy="48" rx="98" ry="18" fill="rgba(0,0,0,0.55)" />
      <path d="M -88 38 L 88 38 L 108 48 L -108 48 Z" fill="#3d4148" stroke="#1a1d22" strokeWidth="1.2" />
      <path d="M -78 43 L 78 43" stroke="#f5c542" strokeWidth="1.2" strokeDasharray="6 5" opacity="0.7" />
      {/* corps tôle métallique */}
      <rect x="-78" y="-18" width="156" height="58" rx="2" fill={`url(#${gradId})`} stroke="#1a1d22" strokeWidth="1.8" />
      {[-66, -52, -38, 38, 52, 66].map((rx) => (
        <line key={rx} x1={rx} y1={-18} x2={rx} y2={40} stroke="#1a1d22" strokeWidth="0.5" opacity="0.55" />
      ))}
      {/* toit */}
      <path d="M -84 -18 L 0 -52 L 84 -18 Z" fill={`url(#${roofId})`} stroke="#1a1d22" strokeWidth="1.8" />
      <path d="M -84 -18 L 0 -52 L 84 -18 L 78 -16 L 0 -49 L -78 -16 Z" fill="#1a1d22" opacity="0.4" />
      {[-78, -40, 0, 40, 78].map((rx) => (
        <circle key={`r${rx}`} cx={rx} cy={-15} r="1.4" fill="#5a606a" stroke="#1a1d22" strokeWidth="0.4" />
      ))}
      {/* portes garage avec rails */}
      <rect x="-60" y="-4" width="34" height="42" fill="#1f242b" stroke="#000" strokeWidth="1.4" />
      {[2, 10, 18, 26, 34].map((dy) => (
        <line key={`l1-${dy}`} x1={-60} y1={-4 + dy} x2={-26} y2={-4 + dy} stroke="#0a0b0d" strokeWidth="0.8" />
      ))}
      <rect x="-58" y="-2" width="4" height="38" fill={`url(#${winId})`} opacity="0.6" />
      <rect x="26" y="-4" width="34" height="42" fill="#1f242b" stroke="#000" strokeWidth="1.4" />
      {[2, 10, 18, 26, 34].map((dy) => (
        <line key={`l2-${dy}`} x1={26} y1={-4 + dy} x2={60} y2={-4 + dy} stroke="#0a0b0d" strokeWidth="0.8" />
      ))}
      <rect x="54" y="-2" width="4" height="38" fill={`url(#${winId})`} opacity="0.6" />
      {/* bureau central éclairé */}
      <rect x="-20" y="2" width="40" height="22" fill={`url(#${winId})`} stroke="#1a1d22" strokeWidth="1.2" />
      <line x1="0" y1="2" x2="0" y2="24" stroke="#1a1d22" strokeWidth="0.6" />
      <line x1="-20" y1="13" x2="20" y2="13" stroke="#1a1d22" strokeWidth="0.6" />
      <ellipse cx="-10" cy="18" rx="3" ry="4" fill="#1a1d22" opacity="0.6" />
      {/* enseigne */}
      <rect x="-58" y="-44" width="116" height="18" rx="2.5" fill={tier.flag} stroke="#1a1d22" strokeWidth="1.6" />
      <rect x="-58" y="-44" width="116" height="4" fill="#fff" opacity="0.35" />
      <text x="0" y="-31" fontSize="11" fontWeight="900" textAnchor="middle" fill="#1a1d22" letterSpacing="1">TAXI CORP</text>
      <rect x="-2" y="-26" width="4" height="8" fill="#5a606a" />
      {/* badge tier */}
      <circle cx="65" cy="-32" r="11" fill="#0a0c10" stroke={tier.flag} strokeWidth="2" />
      <text x="65" y="-28" fontSize="13" textAnchor="middle">{tier.badge}</text>
      {/* antenne + flash */}
      <line x1="-60" y1="-52" x2="-60" y2="-66" stroke="#1a1d22" strokeWidth="1.4" />
      <circle cx="-60" cy="-67" r="2.2" fill="#ff3028">
        <animate attributeName="opacity" values="1;0.2;1" dur="1.4s" repeatCount="indefinite" />
      </circle>
      {/* lampes extérieures */}
      <circle cx="-72" cy="-12" r="2.5" fill="#fff7a8">
        <animate attributeName="opacity" values="0.8;1;0.8" dur="3s" repeatCount="indefinite" />
      </circle>
      <circle cx="72" cy="-12" r="2.5" fill="#fff7a8">
        <animate attributeName="opacity" values="0.9;1;0.9" dur="3.2s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

export default function TaxiTycoon() {
  const measureRef = useRef<SVGPathElement | null>(null);
  const containerRef = useRef<SVGSVGElement | null>(null);
  const [pathLen, setPathLen] = useState(0);
  const admin = useAdminConfig(); // re-render quand l'admin change

  // === Persistent state ===
  const [save, setSave] = useState<SaveData>(DEFAULT_SAVE);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setSave(loadSave()); setHydrated(true); }, []);
  const saveRef = useRef(save);
  saveRef.current = save;

  // === Dynamic state (not persisted) ===
  const taxisRef = useRef<Taxi[]>([]);
  const clientsRef = useRef<Client[]>([]);
  const nextIdRef = useRef(1);
  const lastSpawnRef = useRef(0);
  const lastTaxiDispatchRef = useRef(0);
  const [, forceRender] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [popups, setPopups] = useState<{ id: number; text: string; x: number; y: number }[]>([]);
  const popIdRef = useRef(0);

  // Contracts state
  const [contracts, setContracts] = useState<Contract[]>([]);
  const contractsRef = useRef<Contract[]>([]);
  contractsRef.current = contracts;
  const [boost, setBoost] = useState<ActiveBoost>(null);
  const boostRef = useRef<ActiveBoost>(null);
  boostRef.current = boost;
  const [nowTick, setNowTick] = useState(Date.now());
  const contractIdRef = useRef(1);

  const genContract = (tierIdx: number): Contract => {
    const now = Date.now();
    const t = DEPOT_TIERS[tierIdx];
    const kinds: ContractKind[] = ["clients", "earn", "streak"];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const id = contractIdRef.current++;
    const tierBoost = 1 + tierIdx * 0.3;
    if (kind === "clients") {
      const target = Math.round((3 + Math.floor(Math.random() * 4)) * (1 + tierIdx * 0.5));
      const duration = (45 + target * 8) * 1000;
      const rewardCash = Math.round(target * 80 * t.fareMult * tierBoost);
      return { id, kind, icon: "👥", label: `Servir ${target} clients`, target, progress: 0, deadline: now + duration, duration, rewardCash };
    }
    if (kind === "earn") {
      const target = Math.round((300 + Math.random() * 400) * t.fareMult * (1 + tierIdx * 0.6));
      const duration = (60 + target / 8) * 1000;
      const rewardCash = Math.round(target * 0.55);
      return { id, kind, icon: "💵", label: `Gagner ${fmt(target)}$`, target, progress: 0, deadline: now + duration, duration, rewardCash };
    }
    // streak: course rapide x2 pendant N sec
    const target = 2 + Math.floor(Math.random() * 3);
    const duration = (35 + target * 10) * 1000;
    const rewardCash = Math.round(target * 100 * t.fareMult * tierBoost);
    return {
      id, kind, icon: "🔥",
      label: `Enchaîner ${target} courses`,
      target, progress: 0, deadline: now + duration, duration,
      rewardCash,
      rewardMult: 2, rewardMultSec: 20,
    };
  };


  // Mesure de la longueur du path principal au montage
  useEffect(() => {
    if (measureRef.current) {
      const l = measureRef.current.getTotalLength();
      setPathLen(l);
    }
  }, []);

  // Sync taxis runtime list with save
  useEffect(() => {
    if (pathLen === 0) return;
    const depotPos = pathLen * (admin.depotPosNorm || DEFAULT_DEPOT_POS);
    const newSpeed = (BASE_SPEED + save.taxiSpeedLvl * 18) * admin.taxiSpeedMult;
    // Ajoute les taxis manquants
    while (taxisRef.current.length < save.taxis.length) {
      const idx = taxisRef.current.length;
      taxisRef.current.push({
        id: nextIdRef.current++,
        pos: depotPos,
        target: depotPos,
        mode: "idle",
        speed: newSpeed,
        colorId: save.taxis[idx].colorId,
        clientId: null,
      });
    }
    // Sync couleurs + vitesse
    taxisRef.current.forEach((t, i) => {
      t.speed = newSpeed;
      if (save.taxis[i]) t.colorId = save.taxis[i].colorId;
    });
    forceRender((n) => n + 1);
  }, [pathLen, save.taxis, save.taxiSpeedLvl, admin.taxiSpeedMult, admin.depotPosNorm]);

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

  // === Boucle de jeu ===
  useEffect(() => {
    if (pathLen === 0) return;
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      const adm = getAdmin();
      const depotPos = pathLen * (adm.depotPosNorm || DEFAULT_DEPOT_POS);
      const cur = saveRef.current;
      const curTier = DEPOT_TIERS[cur.depotTier];

      // Spawn client
      const maxClients = curTier.maxTaxis + 1 + adm.maxClientsBonus;
      if (now - lastSpawnRef.current > curTier.spawnEvery * 1000 * adm.spawnRateMult && clientsRef.current.length < maxClients) {
        lastSpawnRef.current = now;
        const pickup = Math.random() * pathLen;
        const dropoff = Math.random() * pathLen;
        const dist = Math.abs(dropoff - pickup);
        const fare = Math.round((20 + (dist / pathLen) * 180) * curTier.fareMult * adm.clientFareMult);
        clientsRef.current.push({
          id: nextIdRef.current++,
          pickup, dropoff, fare,
          assigned: null,
          spawnedAt: now,
          sidePickup: Math.random() < 0.5 ? 1 : -1,
          sideDrop: Math.random() < 0.5 ? 1 : -1,
        });
      }

      // Despawn old waiting clients (impatience: 35s)
      clientsRef.current = clientsRef.current.filter(
        (c) => c.assigned !== null || now - c.spawnedAt < 35000
      );

      // Assigner clients aux taxis idle — avec régulation
      const activeTaxiCount = taxisRef.current.filter((t) => t.mode !== "idle").length;
      const maxActive = Math.max(1, adm.maxActiveTaxis | 0);
      const cooldownMs = Math.max(0, adm.taxiSpawnCooldown) * 1000;
      const canDispatch = activeTaxiCount < maxActive && (now - lastTaxiDispatchRef.current) >= cooldownMs;

      if (canDispatch) {
        for (const taxi of taxisRef.current) {
          if (taxi.mode !== "idle") continue;
          let best: Client | null = null;
          let bestDist = Infinity;
          for (const c of clientsRef.current) {
            if (c.assigned !== null) continue;
            const d = Math.abs(c.pickup - taxi.pos);
            if (d < bestDist) { bestDist = d; best = c; }
          }
          if (best) {
            best.assigned = taxi.id;
            taxi.clientId = best.id;
            taxi.mode = "to_pickup";
            taxi.target = best.pickup;
            lastTaxiDispatchRef.current = now;
            break; // un seul dispatch par tick → respecte le cooldown
          }
        }
      }

      // Mouvement des taxis
      for (const taxi of taxisRef.current) {
        if (taxi.mode === "idle") continue;
        const diff = taxi.target - taxi.pos;
        const step = taxi.speed * dt;
        if (Math.abs(diff) <= step) {
          taxi.pos = taxi.target;
          if (taxi.mode === "to_pickup") {
            const c = clientsRef.current.find((x) => x.id === taxi.clientId);
            if (c) {
              taxi.mode = "to_dest";
              taxi.target = c.dropoff;
            } else {
              taxi.mode = "returning";
              taxi.target = depotPos;
              taxi.clientId = null;
            }
          } else if (taxi.mode === "to_dest") {
            const c = clientsRef.current.find((x) => x.id === taxi.clientId);
            if (c && measureRef.current) {
              const activeBoost = boostRef.current && boostRef.current.until > now ? boostRef.current.mult : 1;
              const finalFare = Math.round(c.fare * activeBoost);
              const p = measureRef.current.getPointAtLength(c.dropoff);
              popFloat(`+${fmt(finalFare)}$${activeBoost > 1 ? " ×" + activeBoost : ""}`, p.x, p.y);
              setSave((s) => ({
                ...s,
                money: s.money + finalFare,
                totalEarned: s.totalEarned + finalFare,
                customersServed: s.customersServed + 1,
              }));
              // Update contracts progress
              setContracts((cs) => cs.map((ct) => {
                if (ct.deadline < now) return ct;
                if (ct.kind === "clients" || ct.kind === "streak") return { ...ct, progress: ct.progress + 1 };
                if (ct.kind === "earn") return { ...ct, progress: ct.progress + finalFare };
                return ct;
              }));
              clientsRef.current = clientsRef.current.filter((x) => x.id !== c.id);
            }
            taxi.clientId = null;
            taxi.mode = "returning";
            taxi.target = depotPos;
          } else if (taxi.mode === "returning") {
            taxi.mode = "idle";
          }
        } else {
          taxi.pos += Math.sign(diff) * step;
        }
      }

      forceRender((n) => (n + 1) % 1_000_000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pathLen]);

  // === Helpers de rendu position ===
  const getXY = (len: number): { x: number; y: number; angle: number } => {
    if (!measureRef.current) return { x: 0, y: 0, angle: 0 };
    const safe = ((len % pathLen) + pathLen) % pathLen;
    const p = measureRef.current.getPointAtLength(safe);
    const p2 = measureRef.current.getPointAtLength(Math.min(pathLen - 0.1, safe + 2));
    const angle = (Math.atan2(p2.y - p.y, p2.x - p.x) * 180) / Math.PI;
    return { x: p.x, y: p.y, angle };
  };

  // Position décalée sur le trottoir (perpendiculaire à la route)
  const SIDEWALK_OFFSET = 22;
  const getSidewalk = (len: number, side: 1 | -1) => {
    if (!measureRef.current) return { x: 0, y: 0, angle: 0 };
    const safe = ((len % pathLen) + pathLen) % pathLen;
    const p = measureRef.current.getPointAtLength(safe);
    const p2 = measureRef.current.getPointAtLength(Math.min(pathLen - 0.1, safe + 2));
    const dx = p2.x - p.x, dy = p2.y - p.y;
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L; // normale unitaire
    return {
      x: p.x + nx * SIDEWALK_OFFSET * side,
      y: p.y + ny * SIDEWALK_OFFSET * side,
      angle: (Math.atan2(dy, dx) * 180) / Math.PI,
    };
  };

  const depotXY = useMemo(() => {
    if (admin.hqUseFreePos) return { x: admin.hqX, y: admin.hqY, angle: 0 };
    return getXY(pathLen * (admin.depotPosNorm || DEFAULT_DEPOT_POS));
  }, [pathLen, admin.depotPosNorm, admin.hqUseFreePos, admin.hqX, admin.hqY]);

  // === Actions UI ===
  const taxiCount = save.taxis.length;
  const taxiBuyCost = Math.round(TAXI_COST_BASE * Math.pow(1.65, taxiCount));
  const speedCost = Math.round(SPEED_UPGRADE_COST_BASE * Math.pow(2.1, save.taxiSpeedLvl));

  const buyTaxi = () => {
    if (taxiCount >= tier.maxTaxis) {
      showToast(`Capacité max : améliore le dépôt`);
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

  const setColor = (id: string) => {
    setSave((s) => ({ ...s, defaultColor: id, taxis: s.taxis.map((t) => ({ colorId: id })) }));
  };

  // === Boucle contrats : refresh slots + expiration + complétion ===
  useEffect(() => {
    const iv = window.setInterval(() => {
      const now = Date.now();
      setNowTick(now);
      // Boost expiration
      setBoost((b) => (b && b.until <= now ? null : b));
      // Évalue complétion + expiration + refill
      setContracts((cs) => {
        let changed = false;
        const kept: Contract[] = [];
        for (const c of cs) {
          if (c.progress >= c.target) {
            // Récompense
            setSave((s) => ({ ...s, money: s.money + c.rewardCash, contractsCompleted: s.contractsCompleted + 1 }));
            if (c.rewardMult && c.rewardMultSec) {
              setBoost({ mult: c.rewardMult, until: now + c.rewardMultSec * 1000 });
            }
            showToast(`✅ Contrat réussi : +${fmt(c.rewardCash)}$${c.rewardMult ? ` • x${c.rewardMult} ${c.rewardMultSec}s` : ""}`);
            changed = true;
            continue;
          }
          if (c.deadline <= now) {
            showToast(`⏱️ Contrat expiré`);
            changed = true;
            continue;
          }
          kept.push(c);
        }
        // Refill jusqu'à MAX
        while (kept.length < MAX_CONTRACTS) {
          kept.push(genContract(saveRef.current.depotTier));
          changed = true;
        }
        return changed ? kept : cs;
      });
    }, 500);
    return () => clearInterval(iv);
  }, []);

  const cancelContract = (id: number) => {
    setContracts((cs) => cs.filter((c) => c.id !== id));
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
          <path ref={measureRef} id="taxi-road" d={ROADS[0]} />
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

        {/* Clients en attente — sur le trottoir */}
        {clientsRef.current.map((c) => {
          if (c.assigned !== null) return null;
          const p = getSidewalk(c.pickup, c.sidePickup);
          const age = (performance.now() - c.spawnedAt) / 1000;
          const bob = Math.sin(age * 3) * 0.8;
          const pulse = 1 + Math.sin(age * 4) * 0.18;
          return (
            <g key={c.id} transform={`translate(${p.x},${p.y + bob})`} filter="url(#taxi-shadow)">
              {/* halo d'attente */}
              <circle r={16 * pulse} fill="#10b981" opacity="0.28" />
              {/* personnage qui attend */}
              <ellipse cx="0" cy="9" r="6" rx="6" ry="2" fill="rgba(0,0,0,0.5)" />
              <rect x="-3" y="-2" width="2.4" height="7" rx="0.6" fill="#1f2937" />
              <rect x="0.6" y="-2" width="2.4" height="7" rx="0.6" fill="#1f2937" />
              <path d="M -4 -8 Q 0 -10 4 -8 L 3.4 -1 L -3.4 -1 Z" fill="#10b981" stroke="#0f172a" strokeWidth="0.5" />
              <rect x="-5" y="-7" width="1.6" height="5" rx="0.5" fill="#10b981" />
              <rect x="3.4" y="-7" width="1.6" height="5" rx="0.5" fill="#10b981" />
              <circle cx="0" cy="-12" r="3" fill="#f1c79b" stroke="#0f172a" strokeWidth="0.5" />
              {/* main levée pour héler */}
              <rect x="4" y="-14" width="1.4" height="6" rx="0.5" fill="#10b981" transform="rotate(-30 4 -14)">
                <animateTransform attributeName="transform" type="rotate" values="-30 4 -14;-10 4 -14;-30 4 -14" dur="0.9s" repeatCount="indefinite" />
              </rect>
              {/* bulle prix */}
              <g transform="translate(0,-26)">
                <rect x="-18" y="-9" width="36" height="13" rx="3" fill="#0f172a" stroke="#34d399" strokeWidth="1" />
                <text y="0.5" fontSize="8.5" fontWeight="900" textAnchor="middle" fill="#34d399">{fmt(c.fare)}$</text>
              </g>
            </g>
          );
        })}

        {/* Dropoffs — sur le trottoir */}
        {clientsRef.current.map((c) => {
          if (c.assigned === null) return null;
          const p = getSidewalk(c.dropoff, c.sideDrop);
          return (
            <g key={"d" + c.id} transform={`translate(${p.x},${p.y})`}>
              <circle r="11" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="4 3" opacity="0.85">
                <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite" />
              </circle>
              <circle r="6" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" />
              <text y="3" fontSize="9" textAnchor="middle">📍</text>
            </g>
          );
        })}

        {/* Dépôt */}
        {pathLen > 0 && <Depot tier={tier} x={depotXY.x} y={depotXY.y - 18} scale={admin.hqScale} rotation={admin.hqRotation} />}

        {/* Taxis */}
        {taxisRef.current.map((taxi) => {
          const p = getXY(taxi.pos);
          const color = TAXI_COLORS.find((c) => c.id === taxi.colorId) ?? TAXI_COLORS[0];
          // Sens du déplacement
          const movingForward = taxi.target >= taxi.pos;
          const angle = movingForward ? p.angle : p.angle + 180;
          return (
            <g key={taxi.id} transform={`translate(${p.x},${p.y}) rotate(${angle})`} filter="url(#taxi-shadow)">
              <TaxiSprite body={color.body} trim={color.trim} withClient={taxi.mode === "to_dest"} moving={taxi.mode !== "idle"} />
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
            <span className="tt-stat-val">{taxiCount}/{tier.maxTaxis}</span>
          </div>
        </div>

        <div className="tt-depot-card">
          <div className="tt-depot-name">{tier.badge} {tier.name}</div>
          <div className="tt-depot-stats">
            Tarifs ×{tier.fareMult.toFixed(1)} • Capa {tier.maxTaxis} taxis
          </div>
        </div>

        {/* === Contrats === */}
        <div className="tt-contracts">
          <div className="tt-contracts-head">
            <span>📋 CONTRATS</span>
            {boost && boost.until > nowTick && (
              <span className="tt-boost">x{boost.mult} {Math.max(0, Math.ceil((boost.until - nowTick) / 1000))}s</span>
            )}
          </div>
          {contracts.map((c) => {
            const remain = Math.max(0, c.deadline - nowTick);
            const remainSec = Math.ceil(remain / 1000);
            const timePct = Math.max(0, Math.min(1, remain / c.duration));
            const progPct = Math.max(0, Math.min(1, c.progress / c.target));
            const urgent = remainSec <= 10;
            const progressLabel = c.kind === "earn"
              ? `${fmt(c.progress)} / ${fmt(c.target)}$`
              : `${c.progress} / ${c.target}`;
            return (
              <div key={c.id} className={`tt-contract ${urgent ? "urgent" : ""}`}>
                <div className="tt-c-row">
                  <span className="tt-c-icon">{c.icon}</span>
                  <span className="tt-c-label">{c.label}</span>
                  <button className="tt-c-x" onClick={() => cancelContract(c.id)} title="Abandonner">✕</button>
                </div>
                <div className="tt-c-bar"><div className="tt-c-bar-fill" style={{ width: `${progPct * 100}%` }} /></div>
                <div className="tt-c-meta">
                  <span>{progressLabel}</span>
                  <span className="tt-c-reward">+{fmt(c.rewardCash)}${c.rewardMult ? ` • x${c.rewardMult}` : ""}</span>
                </div>
                <div className="tt-c-time"><div className="tt-c-time-fill" style={{ width: `${timePct * 100}%` }} /></div>
                <div className="tt-c-time-lbl">{remainSec}s</div>
              </div>
            );
          })}
        </div>

        <div className="tt-actions">
          <button className="tt-btn primary" onClick={buyTaxi} disabled={save.money < taxiBuyCost || taxiCount >= tier.maxTaxis}>
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
        </div>

        <div className="tt-colors">
          {TAXI_COLORS.map((c) => (
            <button
              key={c.id}
              className={`tt-color ${save.defaultColor === c.id ? "selected" : ""}`}
              onClick={() => setColor(c.id)}
              style={{ background: c.body, borderColor: c.trim }}
              title={`Repeindre tous en ${c.name}`}
            />
          ))}
        </div>

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

        .tt-colors {
          position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
          display: flex; gap: 6px; padding: 6px 8px;
          background: rgba(10,12,16,0.75); border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.08);
          pointer-events: auto;
        }
        .tt-color {
          width: 28px; height: 28px; border-radius: 50%;
          border: 2px solid; cursor: pointer; padding: 0;
          transition: transform 0.12s ease;
        }
        .tt-color:hover { transform: scale(1.15); }
        .tt-color.selected { outline: 2px solid #fde68a; outline-offset: 2px; transform: scale(1.18); }

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
          width: 210px;
          display: flex; flex-direction: column; gap: 6px;
          pointer-events: auto;
        }
        .tt-contracts-head {
          display: flex; justify-content: space-between; align-items: center;
          font-size: 10px; font-weight: 900; letter-spacing: 1px;
          color: #fde68a; padding: 0 4px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.9);
        }
        .tt-boost {
          background: linear-gradient(180deg, #f59e0b, #b45309);
          color: #1a1d22; padding: 2px 7px; border-radius: 999px;
          font-size: 10px; font-weight: 900;
          box-shadow: 0 0 8px rgba(245,158,11,0.7);
          animation: ttBoostPulse 1s ease-in-out infinite;
        }
        @keyframes ttBoostPulse { 50% { transform: scale(1.06); } }
        .tt-contract {
          background: linear-gradient(180deg, rgba(20,22,28,0.95), rgba(8,9,12,0.95));
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; padding: 6px 8px;
          box-shadow: 0 3px 10px rgba(0,0,0,0.5);
          position: relative;
        }
        .tt-contract.urgent { border-color: #ef4444; box-shadow: 0 0 12px rgba(239,68,68,0.5); }
        .tt-c-row { display: flex; align-items: center; gap: 6px; }
        .tt-c-icon { font-size: 14px; }
        .tt-c-label { flex: 1; font-size: 11px; font-weight: 800; color: #fff; line-height: 1.15; }
        .tt-c-x {
          background: transparent; border: none; color: #6b7280; cursor: pointer;
          font-size: 12px; padding: 0 2px; line-height: 1;
        }
        .tt-c-x:hover { color: #ef4444; }
        .tt-c-bar {
          height: 5px; background: rgba(255,255,255,0.08);
          border-radius: 3px; overflow: hidden; margin-top: 5px;
        }
        .tt-c-bar-fill {
          height: 100%; background: linear-gradient(90deg, #10b981, #34d399);
          transition: width 0.3s ease;
        }
        .tt-c-meta {
          display: flex; justify-content: space-between;
          font-size: 9.5px; font-weight: 700; margin-top: 3px;
          color: #b0b4ba;
        }
        .tt-c-reward { color: #fde68a; }
        .tt-c-time {
          height: 3px; background: rgba(255,255,255,0.06);
          border-radius: 2px; overflow: hidden; margin-top: 4px;
        }
        .tt-c-time-fill {
          height: 100%; background: linear-gradient(90deg, #ef4444, #f59e0b);
        }
        .tt-c-time-lbl {
          position: absolute; top: 4px; right: 22px;
          font-size: 9px; font-weight: 900; color: #f59e0b;
        }
      `}</style>
    </>
  );
}
