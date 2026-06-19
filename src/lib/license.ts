// Permis chauffeur — cache local du niveau/XP du joueur connecté.
// Source de vérité : table public.profiles (license_level, license_xp).
// Mises à jour : RPC add_license_xp (SECURITY DEFINER) côté serveur.

import { supabase } from "@/integrations/supabase/client";

export type LicenseState = {
  level: number; // 1..5
  xp: number;
};

export type LicenseTier = {
  level: number;
  name: string;
  badge: string;
  minXp: number;
  nextXp: number | null;
  vipChance: number;   // probabilité d'apparition d'un client VIP (0..1)
  starChance: number;  // idem pour STAR
};

export const LICENSE_TIERS: LicenseTier[] = [
  { level: 1, name: "Apprenti",      badge: "🪪", minXp: 0,    nextXp: 200,  vipChance: 0,    starChance: 0    },
  { level: 2, name: "Confirmé",      badge: "🛂", minXp: 200,  nextXp: 600,  vipChance: 0,    starChance: 0    },
  { level: 3, name: "Professionnel", badge: "🥈", minXp: 600,  nextXp: 1500, vipChance: 0.05, starChance: 0    },
  { level: 4, name: "Élite",         badge: "🥇", minXp: 1500, nextXp: 3500, vipChance: 0.08, starChance: 0.02 },
  { level: 5, name: "Légende",       badge: "⭐", minXp: 3500, nextXp: null, vipChance: 0.10, starChance: 0.05 },
];

export function tierFor(level: number): LicenseTier {
  return LICENSE_TIERS.find((t) => t.level === level) ?? LICENSE_TIERS[0];
}

let cache: LicenseState = { level: 1, xp: 0 };
const listeners = new Set<(s: LicenseState) => void>();

function emit() {
  for (const l of listeners) l(cache);
}

export function getLicense(): LicenseState {
  return cache;
}

export function subscribeLicense(fn: (s: LicenseState) => void): () => void {
  listeners.add(fn);
  fn(cache);
  return () => { listeners.delete(fn); };
}

export async function refreshLicense(): Promise<LicenseState> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) { cache = { level: 1, xp: 0 }; emit(); return cache; }
  const { data } = await supabase
    .from("profiles")
    .select("license_level, license_xp")
    .eq("id", uid)
    .maybeSingle();
  if (data) {
    cache = { level: data.license_level ?? 1, xp: data.license_xp ?? 0 };
    emit();
  }
  return cache;
}

export async function addLicenseXp(amount: number): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) return;
  const safe = Math.min(200, Math.max(1, Math.round(amount)));
  try {
    const { data, error } = await supabase.rpc("add_license_xp", { _amount: safe });
    if (error) { console.warn("[license] rpc error", error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (row && typeof (row as any).level === "number") {
      const prevLevel = cache.level;
      cache = { level: (row as any).level, xp: (row as any).xp };
      emit();
      if (cache.level > prevLevel) {
        try { window.dispatchEvent(new CustomEvent("jce:license-up", { detail: cache })); } catch {}
      }
    }
  } catch (e) {
    console.warn("[license] addXp failed", e);
  }
}

// Tire le tier d'un nouveau client selon le permis joueur.
export function rollClientTier(level: number): "normal" | "vip" | "star" {
  const t = tierFor(level);
  const r = Math.random();
  if (r < t.starChance) return "star";
  if (r < t.starChance + t.vipChance) return "vip";
  return "normal";
}

export type ClientTier = "normal" | "vip" | "star" | "special";

export function tierFareMult(tier: ClientTier): number {
  if (tier === "special") return 1; // le multiplicateur des missions spéciales est appliqué ailleurs
  if (tier === "star") return 2.0;
  if (tier === "vip") return 1.5;
  return 1;
}

export function tierXp(tier: ClientTier): number {
  if (tier === "special") return 0; // l'XP des missions spéciales est appliquée ailleurs
  if (tier === "star") return 30;
  if (tier === "vip") return 20;
  return 10;
}
