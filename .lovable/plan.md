## Objectif

Effacer toutes les routes que j'ai posées sur la carte. Tu dessines ton propre tracé via le panel admin (onglet Circuit → "📍 Dessiner un circuit (point par point)"), tu valides, et c'est CE tracé qui devient le seul réseau utilisé par toutes les voitures du jeu.

## Ce que je vais changer

1. **Vider `ROADS` dans `src/game/CityTraffic.tsx`** — tableau réduit à `[]`. Plus aucune autoroute, grille, diagonale, anneau ou boucle village pré-dessinée. `VILLAGE_PATHS` également vidé (plus aucune route à exclure puisqu'il n'y en a plus).

2. **Brancher le trafic civil sur ton circuit admin** — dans `CityTraffic.tsx`, la liste des chemins disponibles (`civilAllowed`, `allowedPaths`) lit `admin.circuitPoints`. S'il y a < 2 points → aucune voiture ne spawn (carte propre). Dès que tu valides ton circuit → les voitures civiles l'empruntent en boucle.

3. **Pareil pour les taxis rivaux** — `CityRivalTaxis.tsx` cesse d'utiliser les anciens `RIVAL_ROAD_IDX` et utilise ton circuit comme parcours unique. Pas de circuit = pas de rivaux visibles.

4. **Pareil pour le fourgon blindé** — `ArmoredTruck.tsx` suit ton circuit. Pas de circuit = pas de fourgon.

5. **Feux de circulation** — `trafficLights.ts` retourne déjà `[]`, pas de changement.

6. **Zones de parking** (`parkingZones.ts`) — coupées de l'ancienne `ROADS`. Les véhicules ne s'arrêtent plus aux anciennes places ; ils tournent en boucle sur ton tracé sans s'arrêter.

7. **Garder le panel admin tel quel** — le système "Circuit" point par point que tu utilises déjà est conservé intact (dessin invisible avec les petits points verts pendant l'édition, sauvegarde via "✓ Terminer le circuit", cloud sync déjà branché).

## Résultat attendu

- Avant : carte couverte de routes que j'ai inventées, voitures qui passent dans le village.
- Après ton ouverture du jeu : carte vide, aucun véhicule.
- Tu ouvres le panel admin → Circuit → Dessiner → tu poses tes points où TU veux → Terminer.
- Toutes les voitures (civiles + rivaux + fourgon) tournent sur ton tracé, et nulle part ailleurs. Si tu veux ajouter une autre boucle plus tard, on étendra le panel pour gérer plusieurs circuits — pour l'instant on reste sur un seul circuit comme aujourd'hui.

## Détails techniques

- `ROADS = []` et `VILLAGE_PATHS = new Set<number>()` dans `CityTraffic.tsx`.
- Helper interne `getActivePaths()` qui retourne `[circuitSvgPath]` si `admin.circuitPoints.length >= 2`, sinon `[]`. Les boucles `pathRefs` et `getTotalLength()` continuent de fonctionner avec un seul path dynamique.
- Conversion des points `{x,y}` du circuit en `"M x0 y0 L x1 y1 ... Z"` (Z optionnel — si premier ≈ dernier point on boucle, sinon on fait un aller-retour).
- `CityRivalTaxis.tsx` et `ArmoredTruck.tsx` : remplacement de leur lecture statique de `ROADS[idx]` par lecture du même circuit dynamique via un petit util partagé `getCircuitPath()` exporté de `CityTraffic.tsx`.
- Aucun changement DB, aucune migration. Le circuit est déjà sauvegardé dans `admin.circuitPoints` (déjà synchronisé via `useCloudCustomizations`).
