/**
 * cityMap.ts — Définition canonique de la nouvelle carte top-down (style GTA 1/2).
 *
 * Grille fixe 4 colonnes × 3 lignes = 12 quartiers.
 * viewBox de référence : 1920 × 1080 (identique à TaxiTycoon).
 *
 * Cette source de vérité est lue par :
 *   - CityMapRender.tsx (fond visuel)
 *   - roadGraph.ts (réseau routier dérivé)
 *   - TerritoryWar.tsx (12 quartiers conquérables)
 *   - CityCompetitors.tsx (10 slots de QG concurrents)
 *   - CityRivalTaxis.tsx (assignation par district)
 *
 * Convention : tout est en coordonnées viewBox 1920×1080.
 */

export const MAP_W = 1920;
export const MAP_H = 1080;
export const GRID_COLS = 4;
export const GRID_ROWS = 3;
export const DISTRICT_W = MAP_W / GRID_COLS; // 480
export const DISTRICT_H = MAP_H / GRID_ROWS; // 360

export type DistrictType =
  | "residential"
  | "commercial"
  | "industrial"
  | "downtown"
  | "park";

export type District = {
  id: string;              // "Q1".."Q12"
  index: number;           // 0..11
  col: number;             // 0..3
  row: number;             // 0..2
  type: DistrictType;
  name: string;
  // Rectangle du quartier (coords viewBox)
  x: number; y: number; w: number; h: number;
  // Centre du quartier (utile pour le HQ)
  cx: number; cy: number;
  // Slot fixe pour le QG d'une compagnie (légèrement décalé du centre)
  hq: { x: number; y: number };
};

/** Palette par type de quartier (fond top-down "à plat") */
export const ZONE_COLORS: Record<DistrictType, string> = {
  residential: "#cde8c5",
  commercial:  "#f4d8a8",
  industrial:  "#bcbcc4",
  downtown:    "#a8c8e8",
  park:        "#7fb877",
};

/** Couleurs globales du calque carte */
export const MAP_PALETTE = {
  asphalt: "#2a2a2e",
  laneMark: "#f5f5f0",
  sidewalk: "#9a9a9a",
  crosswalk: "#ffffff",
  hqStroke: "#0a0c10",
} as const;

// Layout 4×3 — type par quartier (downtown au centre haut/bas)
const LAYOUT: DistrictType[][] = [
  ["residential", "commercial",  "downtown",   "commercial"],
  ["industrial",  "downtown",    "downtown",   "residential"],
  ["park",        "residential", "commercial", "industrial"],
];

const NAMES: string[][] = [
  ["Bellevue",   "Marché Nord",  "Centre Haut",  "Vieux Port"],
  ["Docks",      "Centre",       "Centre Sud",   "Colline"],
  ["Parc Vert",  "Quartier Sud", "Foire",        "Zone Est"],
];

function buildDistricts(): District[] {
  const out: District[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const index = row * GRID_COLS + col;
      const x = col * DISTRICT_W;
      const y = row * DISTRICT_H;
      const cx = x + DISTRICT_W / 2;
      const cy = y + DISTRICT_H / 2;
      // HQ décalé en bas-droite du centre pour ne pas chevaucher le label
      const hq = { x: cx + 70, y: cy + 40 };
      out.push({
        id: `Q${index + 1}`,
        index,
        col,
        row,
        type: LAYOUT[row][col],
        name: NAMES[row][col],
        x, y, w: DISTRICT_W, h: DISTRICT_H,
        cx, cy,
        hq,
      });
    }
  }
  return out;
}

export const DISTRICTS: District[] = buildDistricts();

/** Récupère un quartier depuis une coordonnée carte. */
export function districtAt(x: number, y: number): District | null {
  const col = Math.floor(x / DISTRICT_W);
  const row = Math.floor(y / DISTRICT_H);
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
  return DISTRICTS[row * GRID_COLS + col] ?? null;
}
