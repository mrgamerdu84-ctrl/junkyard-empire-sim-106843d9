// Progression du trafic civil par chapitre.
// La ville commence avec de vieux véhicules et se modernise au fil de la
// campagne. Chaque sprite dans `src/assets/civil/` est classé par époque via
// son préfixe de nom (`era1-`, `era2-`, `era3-`, `era4-`). Les fichiers sans
// préfixe sont considérés modernes (era3) pour ne pas casser l'existant.
//
// Ch 1-3  → era1 (70-80)
// Ch 4-6  → era1 + era2 (90)
// Ch 7-9  → era1..era3 (2000-2010)
// Ch 10+  → toutes les époques (contemporain / Empire)

import { listCustomVehicles } from "./gameAssets";

type Era = 1 | 2 | 3 | 4;

const civilGlob = import.meta.glob<{ default: string }>(
  "/src/assets/civil/*.{png,jpg,jpeg,webp,svg}",
  { eager: true },
);

type CivilAsset = { url: string; era: Era; name: string };

const CIVIL_ASSETS: CivilAsset[] = Object.keys(civilGlob)
  .sort()
  .map((path) => {
    const name = path.split("/").pop() ?? "";
    const m = name.match(/^era(\d)/i);
    const era = (m ? Math.min(4, Math.max(1, parseInt(m[1], 10))) : 3) as Era;
    return { url: civilGlob[path].default, era, name };
  });

export function eraForChapter(chapter: number): Era {
  if (chapter <= 3) return 1;
  if (chapter <= 6) return 2;
  if (chapter <= 9) return 3;
  return 4;
}

const TRAFFIC_CATS = new Set([
  "civil", "service", "taxi", "police", "ambulance", "firetruck", "robber", "armored", "limo",
]);

/** URLs actives pour le chapitre courant.
 *  - Filtre les sprites civils par époque ≤ époque(chapitre)
 *  - Ajoute les véhicules custom uploadés (toujours actifs)
 *  - Fallback : si aucun sprite civil ne correspond, renvoie tous les sprites
 */
export function getActiveCivilCarUrls(chapter: number): string[] {
  const maxEra = eraForChapter(chapter);
  let civils = CIVIL_ASSETS.filter((a) => a.era <= maxEra).map((a) => a.url);
  if (civils.length === 0) civils = CIVIL_ASSETS.map((a) => a.url);
  const customUrls = listCustomVehicles()
    .filter((v) => TRAFFIC_CATS.has(v.category))
    .map((v) => v.url);
  return [...civils, ...customUrls];
}
