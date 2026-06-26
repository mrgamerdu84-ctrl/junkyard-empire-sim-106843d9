// Catalogue d'améliorations de l'Atelier (My Taxi World Rivalité).
// Les valeurs sont volontairement lisibles pour ajustement gameplay rapide.

export type UpgradeKind =
  | "repair"
  | "tires1" | "tires2"
  | "engine1" | "engine2"
  | "armor1" | "armor2"
  | "paint" | "sticker";

export type UpgradeDef = {
  kind: UpgradeKind;
  label: string;
  icon: string;
  cost: number;          // $; "repair" est dynamique
  durationMs: number;    // animation mécano
  desc: string;
};

export const UPGRADE_CATALOG: UpgradeDef[] = [
  { kind: "repair",  label: "Réparer carrosserie", icon: "🔧", cost: 0,    durationMs: 3000, desc: "Remet le taxi à 100% de PV. 50 $/PV manquant." },
  { kind: "tires1",  label: "Pneus sport",         icon: "🛞", cost: 800,  durationMs: 2200, desc: "+8% de vitesse, meilleure tenue de route." },
  { kind: "tires2",  label: "Pneus pro",           icon: "🛞", cost: 2200, durationMs: 2200, desc: "+15% de vitesse, freinage compétition." },
  { kind: "engine1", label: "Moteur V2",           icon: "⚙️", cost: 1800, durationMs: 4000, desc: "+10% de revenus par course (courses plus rapides)." },
  { kind: "engine2", label: "Moteur V3",           icon: "⚙️", cost: 4500, durationMs: 4000, desc: "+20% de revenus par course." },
  { kind: "armor1",  label: "Blindage léger",      icon: "🛡️", cost: 1500, durationMs: 3000, desc: "−40% de dégâts subis lors des attaques mafia." },
  { kind: "armor2",  label: "Blindage lourd",      icon: "🛡️", cost: 3800, durationMs: 3500, desc: "Immunité à 1 attaque mafia par jour." },
  { kind: "paint",   label: "Repeindre",           icon: "🎨", cost: 300,  durationMs: 2000, desc: "Change la couleur principale du taxi." },
  { kind: "sticker", label: "Toit lumineux",       icon: "✨", cost: 250,  durationMs: 1200, desc: "Ajoute une rampe lumineuse jaune visible en ville." },
];

export const PAINT_PALETTE: { color: string; accent: string; name: string }[] = [
  { color: "#fde047", accent: "#a16207", name: "Or classique" },
  { color: "#ef4444", accent: "#7f1d1d", name: "Rouge feu" },
  { color: "#22c55e", accent: "#14532d", name: "Vert émeraude" },
  { color: "#3b82f6", accent: "#1e3a8a", name: "Bleu nuit" },
  { color: "#a855f7", accent: "#4c1d95", name: "Violet royal" },
  { color: "#f97316", accent: "#7c2d12", name: "Orange métal" },
  { color: "#ffffff", accent: "#1f2937", name: "Blanc perle" },
  { color: "#0f172a", accent: "#fde047", name: "Noir sport" },
];

export function defFor(kind: UpgradeKind): UpgradeDef {
  return UPGRADE_CATALOG.find(u => u.kind === kind)!;
}
