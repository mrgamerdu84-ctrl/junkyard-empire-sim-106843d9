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
};

export const DEFAULT_ADMIN: AdminConfig = {
  depotPosNorm: 0.78,
  civilVehicleCount: 22,
  taxiSpeedMult: 1,
  spawnRateMult: 1,
  maxClientsBonus: 0,
  clientFareMult: 1,
};

const KEY = "taxi-tycoon-admin-v1";

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

let current: AdminConfig = load();
const listeners = new Set<(c: AdminConfig) => void>();

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
  useEffect(() => subscribeAdmin(setCfg), []);
  return cfg;
}
