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
// Dépose simplement un PNG/JPG/WebP dans `src/assets/civil/`
// (ex: `src/assets/civil/my-car.png`) -> il sera utilisé automatiquement.
const civilGlob = import.meta.glob<{ default: string }>(
  "/src/assets/civil/*.{png,jpg,jpeg,webp,svg}",
  { eager: true }
);
const civilAutoUrls: string[] = Object.keys(civilGlob)
  .sort()
  .map((k) => civilGlob[k].default);

/** Liste ordonnée des skins de voitures civiles (auto + défauts du registre). */
export const CIVIL_CAR_URLS: string[] = civilAutoUrls.length > 0
  ? civilAutoUrls
  : [
      GAME_ASSETS["civil.car.1"],
      GAME_ASSETS["civil.car.2"],
      GAME_ASSETS["civil.car.3"],
      GAME_ASSETS["civil.car.4"],
    ];

/** Liste ordonnée des skins piétons photo. */
export const PEDESTRIAN_PHOTO_URLS: string[] = [
  GAME_ASSETS["pedestrian.man"],
  GAME_ASSETS["pedestrian.woman"],
];

/** API runtime pour modifier un asset depuis l'AdminPanel. */
export function setAssetOverride(key: AssetKey, url: string | null) {
  if (typeof window === "undefined") return;
  const current = readOverrides();
  if (!url) delete current[key];
  else current[key] = url;
  window.localStorage.setItem(OVERRIDE_KEY, JSON.stringify(current));
}

export function listAssetKeys(): AssetKey[] {
  return Object.keys(DEFAULTS) as AssetKey[];
}
