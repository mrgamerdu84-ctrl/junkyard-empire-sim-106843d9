import { GAME_ASSETS, getCivilCarUrls } from "./gameAssets";

// Modèles de voitures civiles par défaut
export const CIVIL_CARS = [
  { id: "civil.blue", name: "Citadine Bleue", url: GAME_ASSETS["civil.blue"] || "" },
  { id: "civil.green", name: "Berline Verte", url: GAME_ASSETS["civil.green"] || "" },
];

// Configuration des routes de la ville (coordonnées SVG pour le trafic)
export const ROADS = [
  "M 100 300 L 1800 300", // Boulevard Principal
  "M 300 100 L 300 900",  // Avenue de la Gare
  "M 1600 100 L 1600 900", // Rue du Dépôt
  "M 100 700 L 1800 700"  // Boulevard Sud
];

export const VILLAGE_PATHS = [
  "M 500 400 L 900 400 L 900 600 L 500 600 Z" // Boucle du centre-ville
];

export const SIDEWALK_LOCK_OFFSET = 12;

export function lockToSidewalk(x: number, y: number): { x: number; y: number } {
  return { x: x + SIDEWALK_LOCK_OFFSET, y: y + SIDEWALK_LOCK_OFFSET };
}

// Liste des piétons pour animer les trottoirs
export const PHOTO_PEDS = [
  { id: 1, name: "Piéton A", emoji: "🚶" },
  { id: 2, name: "Piéton B", emoji: "🏃" },
  { id: 3, name: "Piéton C", emoji: "🚶" }
];

export interface CarSpec {
  color: string;
  accent: string;
  duration: number;
  delay: number;
  pathIdx: number;
  kind: string;
  imageUrl: string;
  scale: number;
  flip: boolean;
}

/**
 * Génère la liste des véhicules civils en fonction de la densité choisie
 * VITESSE BOOSTÉE x2.5 : duration réduite à 4-7 secondes !
 */
export function generateCivilTraffic(density: number): CarSpec[] {
  const generatedCars: CarSpec[] = [];
  const availableUrls = getCivilCarUrls();
  
  if (!availableUrls || availableUrls.length === 0) {
    return generatedCars;
  }

  const colors = ["#ff5555", "#33aa33", "#3355ff", "#eeee22", "#ff8822"];
  const carKinds = ["sedan", "suv", "compact"];

  // On génère autant de voitures que demandé par le slider de densité
  for (let i = 0; i < density; i++) {
    const pathIdx = i % ROADS.length;
    const imgUrl = availableUrls[i % availableUrls.length];

    generatedCars.push({
      color: colors[Math.floor(Math.random() * colors.length)],
      accent: "#ffffff",
      // AVANT : duration: 10 + Math.random() * 8
      // APRÈS : 4 à 7 secondes = beaucoup plus rapide
      duration: 4 + Math.random() * 3, 
      delay: -(Math.random() * 30),
      pathIdx,
      kind: carKinds[Math.floor(Math.random() * carKinds.length)],
      imageUrl: imgUrl,
      scale: 0.55 + Math.random() * 0.1,
      flip: Math.random() > 0.5
    });
  }

  return generatedCars;
}
