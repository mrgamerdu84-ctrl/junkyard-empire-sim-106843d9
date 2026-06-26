## Objectifs

1. **QG verrouillés** : poser les QG (joueur + rival) une bonne fois sur la carte et ne plus jamais y toucher (ni admin, ni reset).
2. **Véhicules à taille constante** quel que soit le zoom / la taille d'écran : un taxi doit faire la même taille en pixels écran qu'on soit dézoomé au max ou plein écran.
3. **Mode paysage** : quand on tourne le téléphone, la carte doit rester visible (aujourd'hui elle est masquée par le bandeau / la barre du haut).

---

## 1) Geler les QG sur la carte

Fichier : `src/game/TaxiTycoon.tsx`, `src/game/adminConfig.ts`, `src/game/AdminPanel.tsx`.

- Introduire deux constantes figées (ex : `FIXED_PLAYER_HQ = { x: 1030, y: 360, scale: 0.75, rotation: 0 }` et `FIXED_RIVAL_HQ = { x: ..., y: ... }`) utilisées directement par le rendu et par la logique des taxis.
- Dans `TaxiTycoon.tsx`, remplacer `admin.hqX/hqY/hqScale/hqRotation` et `admin.rivalHQX/rivalHQY` par ces constantes pour le placement visuel du QG joueur, du dépôt rival et du calcul `closestOnPath(...)`.
- Dans `AdminPanel.tsx`, retirer (ou désactiver/griser) les sliders QG X/Y/Échelle/Rotation et le bouton « poser le QG sur la carte » : un simple texte « QG verrouillé sur la carte » à la place.
- Dans `adminConfig.ts`, garder les champs pour compat mais les ignorer (forcés aux valeurs fixes au chargement) pour ne pas casser les sauvegardes existantes.

Les QG de quartiers (`TerritoryWar.tsx`) sont déjà figés → rien à faire.

## 2) Véhicules à taille écran constante

Aujourd'hui tout le rendu est dans un seul `<svg viewBox="0 0 1920 1080">` : quand le SVG est dessiné en plus petit (téléphone, paysage, future feature zoom), tout shrink — y compris les voitures.

Approche : compenser l'échelle de rendu sur chaque véhicule.

- Dans `TaxiTycoon.tsx`, mesurer la taille rendue du conteneur via `ResizeObserver` sur `containerRef`, calculer `renderedScale = clientWidth / 1920` (ou min(clientWidth/1920, clientHeight/1080) si on passe en `meet`).
- Exposer une `vehicleScale = clamp(1 / renderedScale, 0.6, 3)` dans un state.
- Modifier chaque `<g transform="translate(x,y) rotate(a)">` de véhicule (taxis joueur, rivaux, circulation, urgences, braqueurs, camion blindé, piétons si trop petits) pour ajouter `scale(${vehicleScale})` à la fin du transform → la voiture garde sa taille écran.
- Faire pareil pour les marqueurs/labels qui doivent rester lisibles (numéro de taxi, icônes). Le QG, les routes et les bâtiments restent à l'échelle du monde (ils doivent bien se dézoomer).

Aucun changement de logique de path/IA — uniquement un facteur d'échelle visuel.

## 3) Carte visible en paysage

Fichier : `src/game/TaxiTycoon.tsx` (CSS du bloc `<style>` en bas + HUD).

- Ajouter une media query `@media (orientation: landscape) and (max-height: 500px)` qui :
  - masque le bandeau `tt-topbar` / `tt-title-banner` (ou le réduit à un mini-logo en coin),
  - retire le cadre `box-shadow` interne (`tt-hud`) qui rogne la zone utile,
  - colle le tableau de bord (console basse) en overlay semi-transparent escamotable (`transform: translateY(...)` + bouton flèche),
  - force `body, html, #root, .tt-hud { height: 100dvh; }` pour utiliser la vraie hauteur dispo.
- Passer le SVG carte de `preserveAspectRatio="xMidYMid slice"` à un mode adaptatif : en paysage on garde `slice` (remplit), en portrait étroit on bascule sur `meet` pour ne rien couper. Implémentation simple : un state `aspectMode` mis à jour via `matchMedia('(orientation: landscape)')`.
- Vérifier que le bouton plein écran ⛶ reste accessible en paysage (coin haut-droit, z-index élevé).

## Validation

- Tourner l'appareil en paysage : la carte occupe toute la zone, le HUD ne la masque pas.
- Dézoomer (réduire la fenêtre / mobile) : routes et QG rapetissent, les taxis gardent la même taille écran.
- Ouvrir le panneau admin : les contrôles de position QG ne sont plus là, le QG ne bouge pas.

## Hors scope

- Pas de nouveau système de pinch-zoom utilisateur (l'utilisateur parle bien du zoom déjà existant lié à la taille d'écran/plein écran).
- Pas de modification des règles de jeu, IA rivaux, économie.
