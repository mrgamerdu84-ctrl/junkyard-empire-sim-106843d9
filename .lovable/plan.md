## Objectif
Remplacer l'ancien bâtiment QG (image `player-hq.png` ancrée sur `admin.hqX/hqY`) par un nouvel entrepôt-dépôt de taxis avec grand panneau et places de parking visibles, le rendre cliquable pour rappeler les taxis, et garantir que les taxis y entrent en empruntant les routes (pas de coupe à travers décors).

## 1. Nouvel asset entrepôt
- Générer une image isométrique « Taxi Depot » : grand hangar gris/jaune, enseigne lumineuse « TAXI DEPOT », 6 places de parking jaunes dessinées au sol, allée d'entrée alignée avec la route → `src/assets/taxi-warehouse.png` (via `imagegen`, transparent_background).
- Créer le pointeur `src/assets/taxi-warehouse.png.asset.json` et remplacer l'import `playerHqAsset` dans `src/game/TaxiTycoon.tsx`.
- L'ancien `player-hq.png` reste sur disque mais n'est plus importé.

## 2. Intégration sur la carte
Dans `src/game/TaxiTycoon.tsx` (bloc ligne ~2410-2440) :
- Garder l'ancrage `admin.hqX/hqY/hqScale/hqRotation` (configurable via Admin Panel, donc l'utilisateur pourra repositionner finement sur l'emplacement de l'ancien QG en haut).
- Augmenter légèrement la `baseW` par défaut pour matcher la silhouette du hangar.
- Conserver le tarmac mask pour cacher tout résidu de l'image de fond.

## 3. Zone cliquable « Rappeler les taxis »
- Wrapper le `<image href={TAXI_WAREHOUSE_IMG}>` dans un `<g>` avec `onClick` + `style={{ cursor: "pointer" }}` + `<title>Rappeler les taxis</title>`.
- Ajouter un handler `recallAllTaxis()` qui, pour chaque taxi en état `idle|enroute|return`, force `state = "returning"` et `beginSegment(...)` vers `closestOnPath(pathIdx, hqX, hqY)`. Les taxis en `pickup`/`delivery` finissent leur course actuelle puis rentrent (flag `mustDeposit = true`).
- Feedback : `popFloat("📣 Rappel général", hqX, hqY-30)` + halo pulse 600 ms sur le bâtiment (state local `recallPulse`).

## 4. Pathfinding propre vers le parking
- Pas de nouveau moteur de pathfinding : les taxis utilisent déjà les `paths` SVG du circuit. La règle anti-saut (`beginSegment` snap si distance > 60 px) est en place.
- Ajout : définir un point d'entrée parking `PARK_ENTRY = closestOnPath(0, hqX, hqY)` calculé une fois. Le retour QG vise désormais `PARK_ENTRY` (sur route) puis lerp court (≤ 40 px, 800 ms) vers la place de parking assignée — garantit que le taxi suit la route, prend le rond-point si nécessaire, puis tourne dans l'allée.
- Les places de parking restent assignées par index (logique existante alignée sur le tarmac).

## 5. Hors-scope (non touché)
- Pas de modification du HUD, radio, mafia, missions, ou Admin Panel autre que l'image.
- Pas de changement de la logique économique du QG (upgrades, tiers, dépôt).

## Détails techniques
- Fichiers modifiés : `src/game/TaxiTycoon.tsx` uniquement.
- Fichiers créés : `src/assets/taxi-warehouse.png`, `src/assets/taxi-warehouse.png.asset.json`.
- Aucune migration BDD, aucun nouveau package.
