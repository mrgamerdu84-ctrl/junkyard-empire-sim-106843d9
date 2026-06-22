/* ============================================================
 * ADMIN CONFIG — paramètres ajustables en jeu via le panneau Admin.
 * Persisté en localStorage. Mises à jour propagées via subscribe.
 * ============================================================ */
import { useEffect, useState } from "react";

export type AdminConfig = {
  depotPosNorm: number;       // 0..1 — position du QG le long du path principal
  civilVehicleCount: number;  // 0..24 — voitures civiles affichées
  taxiSpeedMult: number;      // 0.5..3 — multiplicateur vitesse taxis
  spawnRateMult: number;      // 0.25..3 — < 1 = clients plus rapides ; > 1 = plus lents
  maxClientsBonus: number;    // 0..10 — clients additionnels autorisés en simultané
  clientFareMult: number;     // 0.5..5 — multiplicateur de tarif des courses

  // ====== Régulation du trafic taxi ======
  maxActiveTaxis: number;        // 1..20 — nb max de taxis simultanément en mission
  taxiSpawnCooldown: number;     // 0..15 — délai (s) entre deux sorties de taxi du QG

  // ====== Personnalisation du QG ======
  hqUseFreePos: boolean;         // false = suit le path (depotPosNorm) ; true = X/Y libres
  hqX: number;                   // 0..1920 — position absolue X (SVG)
  hqY: number;                   // 0..1080 — position absolue Y (SVG)
  hqScale: number;               // 0.5..3 — échelle visuelle
  hqRotation: number;            // -180..180 — rotation (deg)

  // ====== Carburant ======
  fuelConsumption: number;       // 0.1..3 — points de carburant consommés / seconde de roulage
  gasStationX: number;           // 0..1920 — position X de la station-service
  gasStationY: number;           // 0..1080 — position Y de la station-service

  // ====== Entreprise concurrente (IA) ======
  rivalEnabled: boolean;         // active la concurrence IA
  rivalHQX: number;              // 0..1920
  rivalHQY: number;              // 0..1080
  rivalTaxiCount: number;        // 1..6 — nb de taxis IA
  rivalReactionTime: number;     // 1..15 — délai (s) avant qu'un taxi IA ne snipe une course
  rivalSpeedMult: number;        // 0.5..2.5

  // ====== Difficulté IA globale ======
  // Affecte la vitesse à laquelle l'IA rafle les missions d'urgence
  // ET le multiplicateur de vitesse appliqué aux taxis IA.
  aiDifficulty: "easy" | "normal" | "hard";

  // ====== Police ======
  policeCarCount: number;        // 0..6 — nb de voitures de police qui patrouillent

  // ====== Missions spéciales ======
  armoredAutoSpawn: boolean;     // si false, le camion blindé n'apparaît que sur déclenchement admin
  armoredFreqMult: number;       // 0.25..3 — multiplicateur de l'intervalle entre apparitions auto
  rivalsCanHeist: boolean;       // si false, les rivaux ne tentent jamais le braquage

  // ====== Circuit personnalisé ======
  circuitPoints: { x: number; y: number }[]; // polyligne dessinée par le joueur
  circuitTaxiCount: number;      // 0..8 — nb de taxis qui tournent en boucle
  circuitSpeedMult: number;      // 0.5..3
};

export const DEFAULT_ADMIN: AdminConfig = {
  depotPosNorm: 0.78, // conservé pour compat ; non utilisé en mode XY libre
  civilVehicleCount: 32,
  taxiSpeedMult: 1,
  spawnRateMult: 1,
  maxClientsBonus: 0,
  clientFareMult: 1,

  maxActiveTaxis: 6,
  taxiSpawnCooldown: 1.5,

  // QG compact ancré en bas-gauche (parking + petit bâtiment).
  // Grossit visuellement via les upgrades (capLvl/revLvl/prodLvl).
  hqUseFreePos: true,
  hqX: 230,
  hqY: 900,
  hqScale: 0.75,
  hqRotation: 0,

  fuelConsumption: 0.6,
  gasStationX: 1450,
  gasStationY: 540,

  rivalEnabled: true,
  rivalHQX: 1650,
  rivalHQY: 220,
  rivalTaxiCount: 3,
  rivalReactionTime: 4,
  rivalSpeedMult: 1,

  policeCarCount: 2,
  aiDifficulty: "normal",

  circuitPoints: [],
  circuitTaxiCount: 0,
  circuitSpeedMult: 1,
};

const KEY = "taxi-tycoon-admin-v3";


function load(): AdminConfig {
  if (typeof window === "undefined") return DEFAULT_ADMIN;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_ADMIN;
    return { ...DEFAULT_ADMIN, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_ADMIN;
  }
}

// On démarre toujours avec les valeurs par défaut pour rester SSR-safe ;
// les valeurs persistées sont rechargées après le mount (cf. useAdminConfig).
let current: AdminConfig = { ...DEFAULT_ADMIN };
let hydrated = false;
const listeners = new Set<(c: AdminConfig) => void>();

function hydrateOnce() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  const loaded = load();
  current = loaded;
  for (const l of listeners) l(current);
}

export function getAdmin(): AdminConfig {
  return current;
}

export function setAdmin(patch: Partial<AdminConfig>) {
  current = { ...current, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch {}
  for (const l of listeners) l(current);
}

export function resetAdmin() {
  current = { ...DEFAULT_ADMIN };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch {}
  for (const l of listeners) l(current);
}

export function subscribeAdmin(fn: (c: AdminConfig) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function useAdminConfig(): AdminConfig {
  const [cfg, setCfg] = useState(current);
  useEffect(() => {
    hydrateOnce();
    setCfg(current);
    return subscribeAdmin(setCfg);
  }, []);
  return cfg;
}
