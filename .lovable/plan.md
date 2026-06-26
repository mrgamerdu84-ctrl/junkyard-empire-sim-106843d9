# Refonte carte — My Taxi World Rivalité

## Objectif
Repartir sur une **nouvelle carte propre top-down (style GTA 1/2)** avec un réseau routier strict, 12 quartiers fixes, et un comportement véhicules/piétons cohérent. On conserve uniquement la **progression joueur** (argent, niveau, flotte) — le reste du gameplay (concurrents, conquêtes) repart à zéro sur la nouvelle grille.

## Nouvelle carte — design

```text
+----+----+----+----+
| Q1 | Q2 | Q3 | Q4 |
+----+----+----+----+
| Q5 | Q6 | Q7 | Q8 |   <-- centre = downtown
+----+----+----+----+
| Q9 | Q10| Q11| Q12|
+----+----+----+----+
```

- Grille **4×3 = 12 quartiers** fixes, chacun avec un **QG fixe** (slot prédéfini, ne bouge jamais).
- Style **top-down GTA1/2** : vue stricte du dessus, couleurs plates par quartier (résidentiel vert pâle, commerce orange, industriel gris, downtown bleu, parc vert foncé), routes noires avec marquage blanc.
- Couleurs dynamiques : seul **le fond du quartier**, **le QG** et **les taxis de la compagnie** prennent la couleur de la compagnie qui contrôle. Le reste (routes, bâtiments, trottoirs) reste fixe.
- Carte rendue en **SVG** (vectoriel, zoom net) — fini les sprites isométriques qui se chevauchent.

## Réseau routier "réaliste léger"

- **Graphe de routes explicite** : chaque route = liste de segments (nodes + edges). Les voitures suivent strictement les arêtes, pas de trajectoires libres.
- **Intersections** : à chaque carrefour, les véhicules choisissent une sortie aléatoire (priorité droite simple, pas de feux).
- **Trottoirs** : bande dédiée le long de chaque route, les piétons y marchent.
- **Passages piétons** aux intersections : seuls endroits où un piéton traverse. Les voitures ralentissent si un piéton est sur le passage.
- **Sens unique** sur certaines avenues pour éviter les face-à-face actuels.

## Migration

| Garde-t-on ? | Détail |
|---|---|
| ✅ Argent, niveau, XP joueur | Lu depuis `localStorage` actuel |
| ✅ Flotte de taxis du joueur (skins) | Catalogue `gameAssets` conservé |
| ✅ Pseudo, photo de profil | Inchangé |
| ❌ Quartiers conquis | Reset (nouvelle grille) |
| ❌ Concurrents et leurs HQ | Re-spawnés sur les 12 nouveaux slots |
| ❌ Compétition hebdo en cours | Reset au lundi prochain |
| ❌ Anciennes coordonnées de missions | Régénérées sur la nouvelle grille |

Un flag `mapVersion: 2` dans `localStorage` déclenche le reset automatique au premier chargement.

## Fichiers impactés

**Nouveaux**
- `src/game/cityMap.ts` — définition de la grille 4×3, quartiers, QG slots, palette par type de zone.
- `src/game/roadGraph.ts` — graphe de routes (nodes, edges, sens, passages piétons), helpers `nextEdge()`, `pointAlong()`, `nearestNode()`.
- `src/game/Pedestrians.tsx` — piétons sur trottoirs + traversées aux passages.
- `src/game/CityMapRender.tsx` — rendu SVG top-down (fond quartiers + routes + marquages + passages + QGs).

**Réécrits**
- `src/game/TerritoryWar.tsx` — passe à 12 quartiers fixes lus depuis `cityMap.ts`, supprime les `hqX/hqY` calculés, lit `slot.color` du propriétaire.
- `src/game/CityTraffic.tsx` — suit le `roadGraph`, plus de paths SVG libres, taille uniforme déjà OK.
- `src/game/CityRivalTaxis.tsx` — pareil, navigation via `roadGraph`, assignation au district basé sur `cityMap`.
- `src/game/CityCompetitors.tsx` — slots fixes lus depuis `cityMap`, couleur = couleur de la compagnie propriétaire.

**Allégés / supprimés**
- `src/game/City3D.tsx` — remplacé par `CityMapRender.tsx` (on garde le fichier comme wrapper pendant la transition puis on le supprime).
- Anciennes constantes de `ROADS` éparpillées dans `CityTraffic` / `CityRivalTaxis` → centralisées dans `roadGraph.ts`.

**Inchangés**
- `TaxiTycoon.tsx` (HUD, dashboard, banner), `RadioPlayer`, `PersonnelPanel`, `AdminPanel`, `gameAssets`, `cityClock`, missions/braquage/camion blindé.

## Palette top-down

- Bitume route : `#2a2a2e`
- Marquage : `#f5f5f0`
- Trottoir : `#9a9a9a`
- Passage piéton : bandes blanches
- Quartier résidentiel : `#cde8c5`
- Quartier commercial : `#f4d8a8`
- Quartier industriel : `#bcbcc4`
- Quartier downtown : `#a8c8e8`
- Parc : `#7fb877`
- Eau (bord de carte) : `#6fa8c8`

## Découpage en étapes (1 chat = 1 étape, on valide visuellement à chaque fois)

1. **Étape 1 (cette session)** : `cityMap.ts` + `roadGraph.ts` + `CityMapRender.tsx` + intégration dans `TaxiTycoon` à la place de `City3D`. Carte statique visible, sans véhicules.
2. **Étape 2** : portage `CityTraffic` sur le `roadGraph` (voitures qui suivent vraiment les routes).
3. **Étape 3** : `Pedestrians.tsx` + logique traversées.
4. **Étape 4** : portage `CityRivalTaxis` + `CityCompetitors` + `TerritoryWar` sur les 12 nouveaux slots.
5. **Étape 5** : nettoyage de l'ancien code (City3D, vieux ROADS) + migration `mapVersion: 2`.

Je propose qu'on commence **Étape 1** dès que tu valides ce plan — tu auras une carte propre visible avant qu'on bouge le moindre véhicule.

