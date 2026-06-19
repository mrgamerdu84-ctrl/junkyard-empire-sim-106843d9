# Refonte carte + trafic

## Pourquoi un plan, pas une exécution directe

Aujourd'hui la carte = photo `citymap.jpg` (1920×1080) + 8 chemins SVG tracés à la main par squelettisation de l'asphalte. Le trafic = animations le long de ces chemins fixes. Tout est calibré dessus : QG, station essence, planques police, radars, spawns piétons, feux. Doubler la carte + passer en waypoints + IA aléatoire = on touche **CityTraffic.tsx, TaxiTycoon.tsx, trafficLights.ts** et toutes les coordonnées calibrées. C'est ~3 à 5 grosses étapes avec risques de régression. Je préfère poser le plan et avancer étape par étape.

## Choix d'implémentation découlant de tes réponses

- **Carte 2× avec nouveaux quartiers** → tu as choisi "Étendre". Comme je n'ai pas de nouvelle image photo, je propose une **extension procédurale stylisée** : on garde Pertuis en haut-gauche, et on ajoute 3 quartiers générés (résidentiel, industriel, périphérique) pour remplir un viewBox 3840×2160.
- **IA waypoints pour tous** → civils, taxis, police, secours passent tous sur le même graphe et choisissent aléatoirement à chaque intersection (sauf taxis en mission/police en chasse, qui visent leur cible via plus-court-chemin sur le graphe).
- **Spawn 4 coins** → 4 zones de spawn aux 4 coins de la nouvelle carte ; chaque taxi acheté est placé dans un coin tiré au hasard (ou rotation round-robin).

## Étapes proposées (je commiterai à la fin de chaque)

### Étape 1 — Nouvelle carte 3840×2160
- Nouveau viewBox `0 0 3840 2160` dans `CityTraffic.tsx` et `TaxiTycoon.tsx`.
- Background composé : photo Pertuis dans le quadrant 0..1920 / 0..1080 + 3 quadrants générés en SVG pur (rectangles quartiers, blocs immeubles, parcs, zones industrielles, teintes cohérentes avec la photo).
- `BASE_SPEED` et tailles véhicules recalibrés pour le nouveau viewBox (×1 en absolu, mais perception ÷2 → on bump à `BASE_SPEED ≈ 140`).

### Étape 2 — Graphe waypoints global
- Nouveau fichier `src/game/roadGraph.ts` : structure `{ nodes: {id, x, y}[], edges: {from, to, lanes: 2, allowsHeavy: bool}[] }`.
- Quadrant Pertuis : on conserve les 8 ROADS existantes, mais on les **discrétise** automatiquement en nodes tous les ~80 px et on détecte les intersections (distance < 25 px entre deux échantillons de chemins différents).
- 3 nouveaux quadrants : génération d'une **grille routière irrégulière** (avenues + rues secondaires + diagonales) avec ~120 nodes par quadrant. Connexions inter-quadrants par 4 ponts/boulevards.
- Helpers : `neighbors(nodeId)`, `randomNext(fromNode, cameFromNode)` (choisit uniformément parmi les voisins sauf demi-tour), `shortestPath(a, b)` (Dijkstra) pour police/taxis missionnés.

### Étape 3 — Trafic civil sur le graphe
- `CityTraffic.tsx` : abandon des animations CSS le long de paths fixes. Chaque véhicule a `{ currentEdge, t, fromNode, toNode }`, avance à vitesse constante, à l'arrivée sur `toNode` appelle `randomNext`.
- Spawn aux 4 coins, densité réglable via `adminConfig`.
- Feux : `trafficLights.ts` ré-indexé sur les nodes-intersections au lieu des `pathIdx`.

### Étape 4 — Taxis / police / secours sur le graphe
- Taxis : en idle → marche aléatoire sur le graphe (depuis QG ou dernier node). Avec client → `shortestPath(currentNode, pickupNode)` puis `shortestPath(pickupNode, dropoffNode)`. Retour QG : `shortestPath` vers nœud QG.
- Police : patrouille = marche aléatoire ; chasse/contrôle = shortestPath vers cible. Planques re-positionnées sur des nodes du nouveau graphe.
- Secours : shortestPath vers accident, puis retour caserne (nouveau node).
- Radars repositionnés sur des edges du nouveau graphe.

### Étape 5 — Recalibrage des éléments fixes + spawn 4 coins
- QG, QG rival, station essence, casernes, planques, jobs/clients : repositionnés dans les nouveaux quartiers (config dans `adminConfig` + AdminPanel pour ajustement live).
- `spawnTaxi()` : tirage aléatoire parmi 4 nodes-coins (NW, NE, SW, SE) au lieu de tous au QG.
- Bug runtime `createLinearGradient` non-fini : corrigé au passage (vient d'un calcul de gradient quand la carte est masquée).

## Détails techniques

```text
viewBox          1920×1080  →  3840×2160
quadrants        [Pertuis photo] [Résidentiel SVG]
                 [Industriel SVG] [Périphérique SVG]
graphe           ~600 nodes, ~900 edges, 4 inter-quadrants bridges
spawn taxis      4 nodes coins, round-robin
IA aux nodes     randomNext (uniforme sauf u-turn)
                 sauf taxi-occupé / police-chasse → Dijkstra
```

Fichiers touchés :
- `src/game/CityTraffic.tsx` (gros refactor)
- `src/game/TaxiTycoon.tsx` (paths → graphe + spawn + AI)
- `src/game/trafficLights.ts` (indexation sur nodes)
- `src/game/adminConfig.ts` (nouvelles coordonnées)
- `src/game/AdminPanel.tsx` (sliders pour nouveaux points)
- **nouveau** `src/game/roadGraph.ts`

## Risques

- **Perte de calibration fine** : la photo Pertuis ne représente plus que 1/4 de la carte ; les routes du quadrant Pertuis restent identiques mais les autres quadrants seront stylisés (pas photo-réalistes).
- **Performance** : 600 nodes × ~60 véhicules à 60 fps = OK, mais Dijkstra par taxi/police doit être mis en cache.
- **Sauvegardes existantes** : les positions stockées (taxi.pathIdx, taxi.pos) deviennent invalides → migration automatique au chargement (reset position des taxis vers QG).
- **Durée totale** : ~5 tours d'agent. Je peux livrer étape par étape pour que tu valides au fur et à mesure.

## Validation à chaque étape

Après chaque étape : screenshot Playwright + check console errors + on regarde ensemble avant de passer à la suivante.

Dis-moi si on part comme ça, ou si tu veux ajuster (ex: garder uniquement le quadrant Pertuis et juste ajouter 1 quartier au lieu de 3, ou simplifier l'IA).
