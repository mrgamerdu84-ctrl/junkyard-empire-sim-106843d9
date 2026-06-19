## Objectif

Tous les véhicules de la carte (taxis IA, police, ambulance, pompiers, civils, véhicules custom uploadés) doivent être rendus à la **même taille que le taxi joueur d'origine = 36 px**. Aujourd'hui les non-taxis sont à 40 px, ce qui les fait paraître ~10 % plus gros.

## Changements (3 endroits, taille unique)

Centraliser la taille dans une constante exportée pour éviter que le problème revienne.

### 1. `src/game/TaxiTycoon.tsx`
- Ajouter en haut, à côté des autres constantes :
  ```ts
  export const VEHICLE_SIZE = 36; // taille unifiée tous véhicules (taxi joueur, police, urgences, civils)
  ```
- `TaxiSprite` : remplacer `size = 36` par `size = VEHICLE_SIZE` (no-op fonctionnel, juste pour la cohérence).
- `RoadAlignedVehicleSprite` : remplacer `size = 40` par `size = VEHICLE_SIZE`.
- Ligne 2357 (`emergencyRef.current.map`) : remplacer `const W = 40;` par `const W = VEHICLE_SIZE;`.

### 2. `src/game/CityTraffic.tsx`
- Importer `VEHICLE_SIZE` depuis `./TaxiTycoon`.
- Ligne 220-221 (rendu des voitures civiles dans le trafic) : remplacer `const W = 40; const H = 40;` par `const W = VEHICLE_SIZE; const H = VEHICLE_SIZE;`.

### 3. Vérification
- Les véhicules custom uploadés via le panel admin sont injectés dans `CIVIL_CAR_URLS` (catégorie civil) ou utilisés via les sprites police/urgence — tous passent par les composants ci-dessus, donc l'unification couvre aussi les uploads à venir et déjà présents.
- Aucun changement de stockage / d'asset : juste la dimension de rendu SVG.

## Hors scope

- Pas de modification des assets sources (PNG/SVG).
- Pas de modification des piétons (`PHOTO_PEDS`, ligne 353) — ils ont leur propre échelle voulue.
- Pas de modification de la taille des sprites dans la boutique / le garage (UI) : seulement le rendu en jeu.

## Risque

Quasi nul : changement purement visuel (taille de rendu), pas de logique de collision dépendante car les distances de stop accident/trafic sont indépendantes de la taille du sprite.
