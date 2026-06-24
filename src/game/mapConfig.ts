// =============================================================
// Configuration centrale de la carte (citymap-v3.jpg, 1920×1080).
// Points fournis par l'utilisateur après calibrage visuel via la
// grille de debug. Sert de source unique de vérité pour les
// ronds-points, les axes routiers et les zones de parking.
// =============================================================

export type Point = { x: number; y: number };

export const ROUNDABOUTS = {
  HAUT_GAUCHE: { x: 420, y: 360 },
  HAUT_DROITE: { x: 1460, y: 280 },
  BAS_GAUCHE:  { x: 320, y: 780 },
  BAS_DROITE:  { x: 1520, y: 740 },
} as const;

export const ROADS: Record<string, Point[]> = {
  diagonalLeft: [
    { x: 100, y: 150 },
    ROUNDABOUTS.HAUT_GAUCHE,
    ROUNDABOUTS.BAS_GAUCHE,
    { x: 100, y: 1000 },
  ],
  diagonalRight: [
    { x: 1800, y: 100 },
    ROUNDABOUTS.HAUT_DROITE,
    ROUNDABOUTS.BAS_DROITE,
    { x: 1850, y: 950 },
  ],
  horizontalBas: [
    ROUNDABOUTS.BAS_GAUCHE,
    { x: 960, y: 840 },
    ROUNDABOUTS.BAS_DROITE,
  ],
  horizontalHaut: [
    ROUNDABOUTS.HAUT_GAUCHE,
    { x: 940, y: 240 },
    ROUNDABOUTS.HAUT_DROITE,
  ],
};

export const SPAWN_POINTS = {
  HANGAR_GAUCHE:  { x: 880,  y: 520 },
  HANGAR_DROITE:  { x: 1040, y: 520 },
  PORTAIL_SORTIE: { x: 960,  y: 840 },
} as const;

export const PARKING_ZONES = [
  { id: "P0", name: "Grand Parking Public Avant", x: 1000, y: 920 },
  { id: "P1", name: "Cour QG Gauche",             x: 750,  y: 650 },
  { id: "P2", name: "Cour QG Droite",             x: 1150, y: 650 },
];
