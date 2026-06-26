# Refonte finale : Solo vs Mafia (clean slate)

Beaucoup d'éléments du cahier des charges sont déjà en place suite à nos passes précédentes (atelier vide jusqu'à l'achat du pont, routes en pointillés, récompense mafia +100 $, échelle inverse des véhicules sur le zoom caméra). Ce plan finit le ménage et corrige les vrais écarts restants.

## 1. Supprimer entièrement les "rivaux" et la "guerre de territoire"

Tu as demandé : *"Il n'y a plus aucune entreprise rivale classique"* et *"supprime l'ancien système de guerre de territoire ou de quartiers"*.

À retirer du jeu :
- `src/game/CityRivalTaxis.tsx` (taxis rouges rivaux qui roulent en ville) + son montage dans `src/routes/index.tsx`.
- Le bâtiment **RIVAL CABS** (HQ rouge avec enseigne ⚔️) rendu dans `TaxiTycoon.tsx` (lignes ~470-513) et son rendu conditionnel à `admin.rivalEnabled` (ligne 2494).
- Le bouton **TERRITOIRE** et l'ouverture de `TerritoryPanel` depuis le dashboard.
- Les fichiers `src/game/TerritoryWar.tsx` et `src/game/TerritoryPanel.tsx` (orphelins après suppression).
- Les événements `mtw:district-owner-changed` et le multiplicateur `districtMult` du calcul de tarif (ligne 878-886 de `TaxiTycoon.tsx`).

Effet visible : plus aucun rouge sur la carte, plus aucune référence à "quartiers conquis", plus de taxis ennemis.

## 2. Voitures mafia avec de VRAIS modèles du jeu, colorés en noir

Aujourd'hui `src/game/MafiaAttacks.tsx` dessine un simple rectangle. Le cahier dit : *"utilise des modèles de voitures déjà présents dans le jeu, mais colorés en noir"*.

Action : remplacer le rectangle par le même composant SVG que la circulation civile (`VehicleSvgs` / asset de `gameAssets`) en forçant la peinture en noir mat (`#0b0d10`) avec liseré rouge sombre pour rester reconnaissable comme menace. Conserver le halo cliquable et l'animation explosion. La voiture garde l'échelle inverse via `vehicleScale` (déjà câblé pour le sélecteur `.mafia-vehicle` équivalent SVG).

## 3. Difficulté évolutive de la Mafia

Le tick `companyV2` déclenche déjà `mtw:mafia-attack-spawn`. À ajuster pour matcher le cahier ("plus on grandit, plus la mafia s'énerve") :
- Probabilité de spawn par tick = `base + k1 * (cash / 10 000) + k2 * fleetSize`.
- Plafond de vagues simultanées passe de 6 à 10.
- Vitesse des voitures noires : `durationMs` se raccourcit avec le niveau de colère mafia.

## 4. Vérification du bug zoom (pointillés solidaires du décor)

Le zoom passe par un `viewBox` SVG dynamique (`TaxiTycoon.tsx` ligne 2163-2238). Tout ce qui est dessiné dans le `<svg>` — sol, bâtiments, ROADS dashed — scale de façon synchrone par construction. Les véhicules reçoivent un `scale(1/zoom)` via `vehicleScale.ts`.

Audit prévu : confirmer qu'aucune route/dashed n'a de `transform` indépendant et que `strokeDasharray` est exprimé en unités viewBox (ce qui le fait scaler avec la carte). Si un écart est détecté, le corriger.

## 5. Ce qui ne change PAS (déjà OK, conservé tel quel)

- Atelier iso 3D vide tant que `lifts < 1`, mécano animé qui marche autour du taxi sur le pont.
- Routes blanches en pointillés (`stroke="#fff"`, `strokeDasharray="10 15"`, width 2).
- Clic mafia = explosion + `+100 $`.
- Échelle écran constante des taxis et des voitures mafia.
- Onglet 🏢 COMPAGNIE pour gérer flotte/personnel.

## Détails techniques

- **Fichiers supprimés** : `src/game/CityRivalTaxis.tsx`, `src/game/TerritoryWar.tsx`, `src/game/TerritoryPanel.tsx`.
- **Fichiers édités** : `src/routes/index.tsx` (retrait de `<CityRivalTaxis/>`), `src/game/TaxiTycoon.tsx` (suppression de `RivalDepot`, du bouton TERRITOIRE, du calcul `districtMult`, des refs `rivalTaxisRef`), `src/game/MafiaAttacks.tsx` (réutilisation du SVG de véhicule existant), `src/game/companyV2.ts` (courbe de spawn mafia).
- **Aucun changement** dans `adminConfig` côté schéma ; le flag `rivalEnabled` devient simplement inutilisé (à laisser pour ne pas casser le storage existant).

## Risque

`CityRivalTaxis` écoute des events territoire et publie des positions de taxis rivaux. La suppression est franche et locale ; aucun consommateur externe identifié dans la base.
