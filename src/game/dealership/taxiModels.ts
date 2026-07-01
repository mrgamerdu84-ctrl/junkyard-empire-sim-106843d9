// Catalogue des modèles vendus au Concessionnaire.
// Les stats sont purement descriptives (affichées en jauges dans l'UI).
// L'`assetKey` pointe vers `GAME_ASSETS` — remplaçable via le panel Admin.

import type { AssetKey } from "../gameAssets";

export type TaxiModel = {
  id: string;
  name: string;
  emoji: string;
  unlockChapter: number; // chapitre requis (1..12, 13 = Mode Empire)
  price: number;         // 0 pour le Taxi Héritage (offert)
  speed: number;         // 1..10
  fuel: number;          // consommation 1..10 (haut = plus gourmand)
  reliability: number;   // 1..10
  comfort: number;       // 1..10
  maintenance: number;   // coût mensuel affiché ($)
  prestige: number;      // 1..10 — influence la réputation
  assetKey: AssetKey;    // sprite affiché sur la carte
  desc: string;
};

export const TAXI_MODELS: TaxiModel[] = [
  {
    id: "heritage",
    name: "Taxi Héritage",
    emoji: "🚖",
    unlockChapter: 1,
    price: 0,
    speed: 4, fuel: 7, reliability: 4, comfort: 3, maintenance: 45, prestige: 2,
    assetKey: "dealer.heritage",
    desc: "Le taxi du père. Fatigué mais increvable.",
  },
  {
    id: "classic",
    name: "Taxi Classique",
    emoji: "🚕",
    unlockChapter: 2,
    price: 4500,
    speed: 5, fuel: 6, reliability: 6, comfort: 5, maintenance: 60, prestige: 3,
    assetKey: "dealer.classic",
    desc: "La berline jaune de série. Fiable et rentable.",
  },
  {
    id: "comfort",
    name: "Berline Confort",
    emoji: "🚙",
    unlockChapter: 3,
    price: 9500,
    speed: 6, fuel: 6, reliability: 7, comfort: 7, maintenance: 90, prestige: 5,
    assetKey: "dealer.comfort",
    desc: "Suspensions revues, sièges cuir. Les clients tips mieux.",
  },
  {
    id: "premium",
    name: "Taxi Premium",
    emoji: "🚘",
    unlockChapter: 5,
    price: 18000,
    speed: 7, fuel: 5, reliability: 8, comfort: 8, maintenance: 130, prestige: 6,
    assetKey: "dealer.premium",
    desc: "Turbo diesel, finitions haut de gamme.",
  },
  {
    id: "electric",
    name: "Taxi Électrique",
    emoji: "⚡",
    unlockChapter: 7,
    price: 32000,
    speed: 8, fuel: 2, reliability: 8, comfort: 8, maintenance: 70, prestige: 7,
    assetKey: "dealer.electric",
    desc: "Zéro carburant, silencieux. Entretien réduit.",
  },
  {
    id: "van7",
    name: "Van 7 places",
    emoji: "🚐",
    unlockChapter: 8,
    price: 48000,
    speed: 6, fuel: 8, reliability: 7, comfort: 7, maintenance: 160, prestige: 6,
    assetKey: "dealer.van",
    desc: "Idéal aéroport & groupes. Course facturée +30%.",
  },
  {
    id: "luxury",
    name: "Taxi Luxe",
    emoji: "💎",
    unlockChapter: 10,
    price: 85000,
    speed: 8, fuel: 6, reliability: 9, comfort: 10, maintenance: 240, prestige: 9,
    assetKey: "dealer.luxury",
    desc: "Cuir Nappa, écrans arrière. Les VIP réclament ce modèle.",
  },
  {
    id: "limousine",
    name: "Limousine",
    emoji: "🥂",
    unlockChapter: 12,
    price: 175000,
    speed: 7, fuel: 9, reliability: 9, comfort: 10, maintenance: 480, prestige: 10,
    assetKey: "dealer.limousine",
    desc: "Mode Empire. La signature de Taxi Co.",
  },

];

export function findModel(id: string): TaxiModel | undefined {
  return TAXI_MODELS.find((m) => m.id === id);
}
