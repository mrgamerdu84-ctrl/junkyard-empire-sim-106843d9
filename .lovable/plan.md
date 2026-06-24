## Contexte

Le moteur de circulation actuel (`CityTraffic.tsx` 1130 lignes, `CityRivalTaxis.tsx`, `CrimeEvents.tsx`, `ArmoredTruck.tsx`, `EmergencyStations.tsx`, `InterventionDispatcher.tsx`, `AmbientSirens.tsx`, `City3D.tsx`) totalise plus de 4 000 lignes étroitement couplées. Une refonte « tout en un coup » casserait à coup sûr le rendu actuel de la ville. Je propose une exécution **en 4 étapes livrées une par une**, validables visuellement entre chaque, **sans toucher aux composants graphiques des voitures, ambulances, pompiers ni police**.

## Règles invariantes (toutes les étapes)

- Aucune modification de `src/game/vehicles/*`, des sprites de mes taxis, ni des composants `<ArmoredTruck>`, ambulance/pompiers/police existants. On ne touche **que** les coordonnées (x, y) et la vitesse.
- Pas de téléportation : tout véhicule arrivé à la fin d'un segment **enchaîne** sur un segment voisin via un graphe d'intersections (pas de saut à `s = 0`).
- Respect des feux : tout véhicule qui arrive sur une intersection rouge décélère puis s'arrête à la ligne d'arrêt, comme déjà fait pour les taxis joueurs.

## Étape 1 — Graphe routier continu

- Extraire `ROADS` (déjà dans `CityTraffic.tsx`) vers `src/game/roadGraph.ts`.
- Construire un graphe : chaque path = arête, ses extrémités = nœuds, fusionnés par proximité (rayon ~12 px) pour reconnecter les ronds-points.
- Remplacer la logique `s = s % pathLen` du trafic ambiant et des taxis rivaux par un curseur `(edgeId, s, dir)` qui choisit un voisin au prochain nœud (tirage pondéré pour favoriser les ronds-points). → fin des « sauts » en boucle, voitures qui parcourent **toute** la carte.

## Étape 2 — Piétons code de la route

- Dans `PhotoPedestrians` (et le squelette `Pedestrian`), ajouter un état `walking | waiting | crossing`.
- Détection d'intersection : quand `s` approche d'un nœud, on relit le feu via `trafficLights.ts`. Rouge piéton → `waiting`, vert piéton → `crossing` sur le passage clouté.
- Les voitures déjà en vue d'un piéton sur passage ralentissent (réutilise le système de freinage existant des taxis).

## Étape 3 — Patrouilles urgences + flics en civil

- `EmergencyStations.tsx` : ajouter un planificateur qui sort 1 véhicule (police, ambulance, pompier) toutes les 45–90 s, le fait patrouiller via le graphe Étape 1, puis le ramène à sa station. **Le sprite reste exactement celui déjà utilisé.**
- Nouveau composant `PlainclothesCops.tsx` : 1 à 2 piétons spéciaux (sprite piéton existant + petit badge SVG en overlay) qui marchent sur les trottoirs, font des arrêts contrôle aléatoires sur les parkings (`parkingZones.ts`), fréquence très basse (60–120 s entre deux contrôles).

## Étape 4 — Événements braquages / cambriolages

- Activer pleinement la logique déjà esquissée dans `CrimeEvents.tsx` + `ArmoredTruck.tsx` :
  - Déclencheur aléatoire (cooldown 90–180 s) : cambriolage de banque **ou** braquage de camion blindé.
  - Pose d'une zone de blocage temporaire (10–25 s) sur l'arête concernée.
  - Les taxis et le trafic ambiant lisent cette zone et **recalculent** un détour via le graphe (choix d'un voisin différent au prochain nœud).
  - `InterventionDispatcher` + `AmbientSirens` envoient les véhicules d'urgence sur place.

## Détails techniques

```text
roadGraph.ts
  ├─ nodes:  [{ id, x, y, neighbors: edgeId[] }]
  ├─ edges:  [{ id, pathIdx, fromNode, toNode, length }]
  └─ pickNextEdge(nodeId, comingFromEdge, opts) → edgeId
```

Tous les acteurs mobiles passent par un seul `useTraffic` hook qui avance `(edgeId, s, dir)` et expose `(x, y, heading)`. Les composants de rendu existants restent inchangés et consomment juste `x, y, heading`.

## Livraison

Je commence par l'**Étape 1** seule pour valider visuellement que la circulation reste fluide sans régression, puis j'enchaîne 2, 3, 4 dans des messages suivants. Confirme-moi que je peux démarrer par l'Étape 1.