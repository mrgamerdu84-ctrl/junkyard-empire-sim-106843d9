/* ============================================================
 * GAME ASSETS REGISTRY
 * ------------------------------------------------------------
 * Point unique pour TOUS les sprites/skins du jeu (voitures,
 * taxis, piétons, musique...). Pour remplacer un visuel :
 *
 *   1) Dépose ton nouveau fichier dans `src/assets/`
 *   2) Modifie UNE SEULE ligne ci-dessous (l'import)
 *      → tout le jeu utilisera automatiquement le nouveau visuel.
 *
 * Bonus — override sans rebuild :
 *   localStorage.setItem(
 *     "jce.assetOverrides",
 *     JSON.stringify({ "taxi.yellow": "https://mon-cdn/taxi.png" })
 *   );
 *   location.reload();
 *
 * Aucun autre fichier ne doit importer directement un PNG/SVG
 * de véhicule : tout passe par `GAME_ASSETS` / `getAsset()`.
 * ============================================================ */

// --- Imports sources (remplace ici pour changer un skin) ---
import taxiYellowAsset from "@/assets/taxi-yellow-top.png";
import taxiBlackAsset from "@/assets/taxi-black-top.png";
import taxiRedAsset from "@/assets/taxi-red-top.png";
import policeCarAsset from "@/assets/police-car-top.png";
import ambulanceAsset from "@/assets/ambulance-top.png";
import firetruckAsset from "@/assets/firetruck-top.png";
import pedManTopAsset from "@/assets/pedestrian-man-top.png";
import pedWomanTopAsset from "@/assets/pedestrian-woman-top.png";
import musicAsset from "@/assets/midnight-fare.mp3.asset.json";




// --- Clés stables utilisées par le code du jeu ---
export type AssetKey =
  | "taxi.yellow"
  | "taxi.black"
  | "taxi.red"
  | "police.car"
  | "emergency.ambulance"
  | "emergency.firetruck"
  | "civil.car.1"
  | "civil.car.2"
  | "civil.car.3"
  | "civil.car.4"
  | "pedestrian.man"
  | "pedestrian.woman"
  | "audio.music";

const DEFAULTS: Record<AssetKey, string> = {
  "taxi.yellow": taxiYellowAsset,
  "taxi.black": taxiBlackAsset,
  "taxi.red": taxiRedAsset,
  "police.car": policeCarAsset,
  "emergency.ambulance": ambulanceAsset,
  "emergency.firetruck": firetruckAsset,
  "civil.car.1": taxiBlackAsset,
  "civil.car.2": taxiRedAsset,
  "civil.car.3": taxiYellowAsset,
  "civil.car.4": taxiBlackAsset,
  "pedestrian.man": pedManTopAsset,
  "pedestrian.woman": pedWomanTopAsset,

  "audio.music": musicAsset.url,
};


const OVERRIDE_KEY = "jce.assetOverrides";

function readOverrides(): Partial<Record<AssetKey, string>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(OVERRIDE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

const overrides = readOverrides();

/** Map figée des URLs à utiliser dans le jeu (override > défaut). */
export const GAME_ASSETS: Record<AssetKey, string> = (() => {
  const out = { ...DEFAULTS };
  for (const k of Object.keys(overrides) as AssetKey[]) {
    const v = overrides[k];
    if (typeof v === "string" && v.length > 0) out[k] = v;
  }
  return out;
})();

/** Helper typé. */
export function getAsset(key: AssetKey): string {
  return GAME_ASSETS[key];
}

// --- Auto-découverte des voitures civiles ---
const civilGlob = import.meta.glob<{ default: string }>(
  "/src/assets/civil/*.{png,jpg,jpeg,webp,svg}",
  { eager: true }
);
const civilAutoUrls: string[] = Object.keys(civilGlob)
  .sort()
  .map((k) => civilGlob[k].default);

// --- Véhicules personnalisés uploadés via le panel admin ---
export type CustomVehicleCategory =
  | "civil"
  | "taxi"
  | "police"
  | "ambulance"
  | "firetruck"
  | "service"
  | "robber"
  | "armored";

export type CustomVehicle = {
  id: string;
  name: string;
  url: string;
  category: CustomVehicleCategory;
};

export const VEHICLE_CATEGORY_LABELS: Record<CustomVehicleCategory, string> = {
  civil: "🚗 Voiture civile",
  taxi: "🚕 Taxi (livrée joueur)",
  police: "🚓 Police",
  ambulance: "🚑 Ambulance",
  firetruck: "🚒 Pompiers",
  service: "🚛 Utilitaire (poubelle, livraison…)",
  robber: "🦹 Braqueur / fuyard",
  armored: "💰 Camion blindé",
};

const CUSTOM_KEY = "jce.customVehicles";

export function listCustomVehicles(): CustomVehicle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => v && v.url && v.id) : [];
  } catch { return []; }
}

export function listCustomVehiclesByCategory(cat: CustomVehicleCategory): CustomVehicle[] {
  return listCustomVehicles().filter((v) => v.category === cat);
}

function emitCustomChange() {
  if (typeof window === "undefined") return;
  try { window.dispatchEvent(new Event("jce.customVehicles.changed")); } catch {}
}

export function addCustomVehicle(v: Omit<CustomVehicle, "id"> & { id?: string }): CustomVehicle {
  const item: CustomVehicle = {
    id: v.id ?? `cv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: v.name || "Véhicule",
    url: v.url,
    category: v.category ?? "civil",
  };
  const all = listCustomVehicles();
  all.push(item);
  try { window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(all)); } catch {}
  emitCustomChange();
  return item;
}

export function removeCustomVehicle(id: string) {
  if (typeof window === "undefined") return;
  const all = listCustomVehicles().filter((v) => v.id !== id);
  try { window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(all)); } catch {}
  emitCustomChange();
}

// Toutes les catégories sauf "taxi" roulent dans la circulation civile
const TRAFFIC_CATEGORIES: CustomVehicleCategory[] = ["civil", "police", "ambulance", "firetruck", "service"];

/** 🔧 DYNAMIC - Se met à jour chaque fois qu'on l'appelle */
function getCustomTrafficUrls(): string[] {
  return listCustomVehicles()
    .filter((v) => TRAFFIC_CATEGORIES.includes(v.category))
    .map((v) => v.url);
}

/** 🔧 DYNAMIC - Se met à jour via getCivilCarUrls() */
export function getCivilCarUrls(): string[] {
  const base = civilAutoUrls.length > 0
    ? civilAutoUrls
    : [
        GAME_ASSETS["civil.car.1"],
        GAME_ASSETS["civil.car.2"],
        GAME_ASSETS["civil.car.3"],
        GAME_ASSETS["civil.car.4"],
      ];
  return [...base, ...getCustomTrafficUrls()];
}

/** DEPRECATED - Utilisez getCivilCarUrls() à la place (dynamic) */
export const CIVIL_CAR_URLS: string[] = (() => {
  const base = civilAutoUrls.length > 0
    ? civilAutoUrls
    : [
        GAME_ASSETS["civil.car.1"],
        GAME_ASSETS["civil.car.2"],
        GAME_ASSETS["civil.car.3"],
        GAME_ASSETS["civil.car.4"],
      ];
  return [...base, ...getCustomTrafficUrls()];
})();

/** Liste ordonnée des skins piétons photo (statique : défauts uniquement). */
export const PEDESTRIAN_PHOTO_URLS: string[] = [
  GAME_ASSETS["pedestrian.man"],
  GAME_ASSETS["pedestrian.woman"],
];

// --- Piétons personnalisés uploadés via le panel admin (vue du ciel) ---
export type CustomPedestrian = {
  id: string;
  name: string;
  url: string;
};

const CUSTOM_PED_KEY = "jce.customPedestrians";
const PED_CHANGE_EVENT = "jce.customPedestrians.changed";

export function listCustomPedestrians(): CustomPedestrian[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_PED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => v && v.url && v.id) : [];
  } catch { return []; }
}

function emitPedChange() {
  if (typeof window === "undefined") return;
  try { window.dispatchEvent(new Event(PED_CHANGE_EVENT)); } catch {}
}

export function addCustomPedestrian(v: Omit<CustomPedestrian, "id"> & { id?: string }): CustomPedestrian {
  const item: CustomPedestrian = {
    id: v.id ?? `cp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: v.name || "Piéton",
    url: v.url,
  };
  const all = listCustomPedestrians();
  all.push(item);
  try { window.localStorage.setItem(CUSTOM_PED_KEY, JSON.stringify(all)); } catch {}
  emitPedChange();
  return item;
}

export function removeCustomPedestrian(id: string) {
  if (typeof window === "undefined") return;
  const all = listCustomPedestrians().filter((v) => v.id !== id);
  try { window.localStorage.setItem(CUSTOM_PED_KEY, JSON.stringify(all)); } catch {}
  emitPedChange();
}

/** Tous les sprites piétons disponibles (défauts + custom). Dynamique. */
export function getPedestrianPhotoUrls(): string[] {
  return [...PEDESTRIAN_PHOTO_URLS, ...listCustomPedestrians().map((p) => p.url)];
}

/** API runtime pour modifier un asset depuis l'AdminPanel. */
export function setAssetOverride(key: AssetKey, url: string | null) {
  if (typeof window === "undefined") return;
  const current = readOverrides();
  if (!url) {
    delete current[key];
    GAME_ASSETS[key] = DEFAULTS[key];
  } else {
    current[key] = url;
    GAME_ASSETS[key] = url;
  }
  window.localStorage.setItem(OVERRIDE_KEY, JSON.stringify(current));
}

export function listAssetKeys(): AssetKey[] {
  return Object.keys(DEFAULTS) as AssetKey[];
}
