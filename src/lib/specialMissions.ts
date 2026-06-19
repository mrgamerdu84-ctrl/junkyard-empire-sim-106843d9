// Missions spéciales — déclenchées par le joueur via un bouton dédié.
// Une mission spéciale apparaît comme un Job de tier "special" dans la file,
// avec une récompense majorée et un gain d'XP plus fort.

export type SpecialMissionDef = {
  id: string;
  title: string;
  emoji: string;
  minLicenseLevel: number;
  fareMult: number;   // multiplicateur appliqué sur le tarif de base
  xpReward: number;   // XP permis accordée à la livraison
  durationMs: number; // délai avant que le client annule
};

export const SPECIAL_MISSIONS: SpecialMissionDef[] = [
  {
    id: "vip_express",
    title: "VIP Express",
    emoji: "🥈",
    minLicenseLevel: 1,
    fareMult: 2.0,
    xpReward: 30,
    durationMs: 45_000,
  },
  {
    id: "star_long",
    title: "Course STAR",
    emoji: "⭐",
    minLicenseLevel: 3,
    fareMult: 3.0,
    xpReward: 50,
    durationMs: 60_000,
  },
  {
    id: "legend",
    title: "Mission Légende",
    emoji: "👑",
    minLicenseLevel: 4,
    fareMult: 4.0,
    xpReward: 80,
    durationMs: 75_000,
  },
];

export const SPECIAL_COOLDOWN_MS = 120_000; // 2 minutes

/** Renvoie la meilleure mission disponible selon le niveau du permis. */
export function pickSpecialMission(licenseLevel: number): SpecialMissionDef {
  const eligible = SPECIAL_MISSIONS.filter((m) => licenseLevel >= m.minLicenseLevel);
  return eligible[eligible.length - 1] ?? SPECIAL_MISSIONS[0];
}
