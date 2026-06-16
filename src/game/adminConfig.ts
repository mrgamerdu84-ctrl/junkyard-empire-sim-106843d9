/* ============================================================
 * ADMIN CONFIG — paramètres ajustables en jeu via le panneau Admin.
 * Persisté en localStorage. Mises à jour propagées via subscribe.
 * ============================================================ */
import { useEffect, useState } from "react";

export type AdminConfig = {
  depotPosNorm: number;       // 0..1 — position du QG le long du path principal
  civilVehicleCount: number;  // 0..35 — voitures civiles affichées
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

  // ====== Circuit personnalisé ======
  circuitPoints: { x: number; y: number }[]; // polyligne dessinée par le joueur
  circuitTaxiCount: number;      // 0..8 — nb de taxis qui tournent en boucle
  circuitSpeedMult: number;      // 0.5..3
};

export const DEFAULT_ADMIN: AdminConfig = {
  depotPosNorm: 0.78, // conservé pour compat ; non utilisé en mode XY libre
  civilVehicleCount: 35,
  taxiSpeedMult: 1,
  spawnRateMult: 1,
  maxClientsBonus: 0,
  clientFareMult: 1,

  maxActiveTaxis: 6,
  taxiSpawnCooldown: 1.5,

  // QG ancré par défaut sur le bâtiment TAXI CORP en bas-gauche de la map.
  hqUseFreePos: true,
  hqX: 230,
  hqY: 780,
  hqScale: 1,
  hqRotation: 0,

  fuelConsumption: 0.6,
  gasStationX: 1450,
  gasStationY: 540,

  rivalEnabled: true,
  rivalHQX: 1650,
  rivalHQY: 220,
  rivalTaxiCount: 2,
  rivalReactionTime: 5,
  rivalSpeedMult: 1,

  circuitPoints: [],
  circuitTaxiCount: 0,
  circuitSpeedMult: 1,
};

const KEY = "taxi-tycoon-admin-v2";


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
