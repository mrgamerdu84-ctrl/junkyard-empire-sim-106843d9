
## Objectif

Repartir sur une base propre. Un seul composant `GameMap` pilote l'affichage de la carte et le mouvement des taxis selon les coordonnées strictes fournies — toutes les anciennes couches de trafic qui calculaient leurs propres trajectoires sont coupées.

## 1. Nouveau fichier `src/game/GameMap.tsx`

Composant unique, autonome. Aucune logique de détection auto, aucun ancien tracé.

Constantes injectées en dur (pas d'import de l'ancien `mapConfig` pour éviter tout conflit) :

```ts
const ROADS = {
  axeGauche: [{x:100,y:150},{x:420,y:360},{x:320,y:780},{x:100,y:1000}],
  axeDroite: [{x:1800,y:100},{x:1460,y:280},{x:1520,y:740},{x:1850,y:950}],
  axeBas:    [{x:320,y:780},{x:960,y:840},{x:1520,y:740}],
};
const HANGARS = { gauche:{x:880,y:520}, droite:{x:1040,y:520} };
const PORTAIL = { x:960, y:840 };
const IDLE_PARKING = { x:1000, y:920 };
```

Rendu :
- `<svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid meet">` calé sur l'image de fond `citymap-v3.jpg` (même viewBox que le `<img>` existant → alignement pixel-près).
- Un `<path>` par axe (3 polylines reliant les waypoints, fin, semi-transparent — utile pour vérifier le tracé, peut être masqué par flag).
- Pour chaque taxi du joueur : un sprite animé via `<animateMotion>` SVG sur un `<path>` composé Hangar → Portail → axe choisi (Gauche/Droite/Bas). Au retour idle, path Portail → IDLE_PARKING.

Pas de boucle physique, pas de `requestAnimationFrame` maison : `animateMotion` gère l'interpolation strictement le long du path = zéro dérive.

API exposée : `<GameMap taxiCount={n} />` (lit le nombre de taxis depuis le state actuel de `TaxiTycoon` via un petit hook ou prop).

## 2. `src/routes/index.tsx`

Dans le bloc `<div className="tt-world">` :
- **Supprimer** : `<CityTraffic />`, `<CityCompetitors />`, `<CityRivalTaxis />`, `<EmergencyStations />`, `<EmergencyPatrols />`, `<PlainclothesCops />`, `<CrimeEvents />`, `<CrimeResponses />`, `<InterventionDispatcher />`, `<ArmoredTruck />`, `<DebugMapGrid />`.
- **Remplacer** par `<GameMap />`.
- **Garder intacts** : `<img>` de fond, vignette, `<TaxiTycoon />` (UI bas : Acheter taxi, Améliorer dépôt…), `<CityHud />`, `<AdminPanel />`, `<RulesPanel />`, `<VersionBanner />`, `<GameMenu />`, `<RadioPlayer />`, bouton zoom.

## 3. `src/game/TaxiTycoon.tsx`

Aucune modif fonctionnelle des boutons (achat taxi / upgrade dépôt restent identiques). On supprime juste son rendu interne de taxis sur la carte (ancien système) — ils sont désormais affichés par `GameMap`. Le compteur de taxis achetés est partagé via le state existant (lu par `GameMap`).

Si le state n'est pas déjà exporté, ajout d'un petit store local (zustand-style via `useSyncExternalStore`) pour que `GameMap` lise `taxiCount` sans toucher à la logique d'achat.

## 4. Fichiers laissés en place mais inutilisés

`CityTraffic.tsx`, `CityRivalTaxis.tsx`, `EmergencyPatrols.tsx`, etc. ne sont plus montés → plus aucun calcul en arrière-plan. On ne les supprime pas (rollback facile), mais ils sortent du graphe React.

## 5. Vérification

Après build : lancer Playwright en headless, screenshot de `/`, vérifier visuellement qu'un taxi sort du hangar (880,520), passe par le portail (960,840) et suit un des 3 axes sans déborder.

## Question avant exécution

L'image de fond actuelle est `citymap-v3.jpg` (asset déjà câblé dans `index.tsx`). Tu mentionnes `1000024732.jpg` — je pars sur l'asset actuel `citymap-v3.jpg`, dis-moi si tu veux qu'on bascule sur un autre fichier image avant que j'implémente.
