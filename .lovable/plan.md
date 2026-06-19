## Objectif
Faire que les **accidents graves** aient un temps de réponse des secours (pompiers, ambulance, police) **plus long et aléatoire**.

## Implémentation

### 1. Sévérité des accidents
- Ajouter un champ `severity: "minor" | "serious"` au type `Accident`.
- Les accidents de type `vehicle` seront **toujours graves** (collision = grave).
- Les accidents de type `pedestrian` restent **légers**.

### 2. Délai de départ aléatoire pour les secours
- Ajouter un champ `respondAfter: number` (timestamp ms) au type `EmergencyVehicle`.
- Quand un accident **grave** survient, chaque véhicule d'urgence se voit assigner un délai aléatoire avant de partir :
  - Pompiers : `random(3000, 8000)` ms
  - Ambulance : `random(2000, 6000)` ms  
  - Police : `random(1000, 5000)` ms
- Les véhicules restent en mode `patrol` jusqu'à ce que `performance.now() >= respondAfter`.

### 3. Intervention sur place plus longue
- Pour un accident **grave**, la durée d'intervention sur place (`clearAt`) sera aléatoire :
  - `ACCIDENT_BLOCK_MIN_MS` (9000ms) + `random(4000, 10000)` ms → **13 à 19 secondes** au total.
- Pour un accident **léger**, garder le comportement actuel (9000ms fixe).

### 4. Impact visuel
- Ajouter un indicateur textuel sur le marqueur d'accident grave (ex: "⚠️ ACCIDENT GRAVE" au lieu de juste les cônes).
- La minuterie affichée sur l'accident reflétera la durée aléatoire.

## Fichier concerné
- `src/game/TaxiTycoon.tsx` uniquement.

## Aucun autre changement
La logique de patrouille, les feux de circulation, les courses taxi et le reste du jeu restent inchangés.