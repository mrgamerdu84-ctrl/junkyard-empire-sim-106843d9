## Refonte complète de la map et du QG

### 1. Grande map 2D avec caméra zoomable
- Remplacer le fond SVG actuel de `TaxiTycoon.tsx` par une vraie grande carte (4000×4000) avec texture bitume (pattern SVG hachuré gris foncé + grain), bandes blanches centrales, passages piétons, trottoirs en béton clair, espaces verts (parcs arborés).
- Quartiers définis par zones :
  - **Centre (toujours débloqué)** : QG + rues principales
  - **Quartier Est (niveau 2+)** : pompe à essence stylée
  - **Quartier Ouest (niveau 3+)** : radars + commissariat
  - **Quartier Nord (niveau 4+)** : zone fourgons blindés
- Zones verrouillées : overlay sombre + cadenas + texte "Niveau X requis", non franchissables par le taxi joueur.
- **Caméra avec zoom** : hook `useMapCamera` gérant `scale` (0.5 → 2.5) et `translate`. Support :
  - Molette souris (`wheel` → zoom centré sur curseur)
  - Pinch tactile (2 doigts, distance entre touches)
  - Pan via drag (souris/1 doigt)
  - Suivi automatique du taxi joueur (recadrage doux quand le taxi sort d'une marge)
- Application via `transform: translate() scale()` sur le conteneur SVG.

### 2. IA des rivaux (taxis Verts & Rouges)
- Nouveau fichier `src/game/RivalAI.ts` :
  - 2 compagnies : `GREEN_CO` (apparaît niveau 2), `RED_CO` (niveau 3)
  - Chaque rival : `{ id, color, x, y, targetClientId, speed, capturedToday }`
  - Boucle IA dans `gameLoop` : à chaque tick, chaque rival cherche le client libre le plus proche, fonce dessus en ligne droite (pathing simple évitant les zones vertes), et le "vole" s'il l'atteint avant le joueur.
  - Réduction de gains du joueur : un client volé n'apparaît plus dans sa file.
- Rendu : SVG `<g>` distinct par rival avec carrosserie verte (#10b981) ou rouge (#dc2626), gyrophare animé, plaque "GREEN" / "RED".
- Spawn : 1 rival vert au niveau 2, +1 vert au niveau 4 ; 1 rouge au niveau 3, +1 rouge au niveau 5.

### 3. Évolution visuelle du QG (3 paliers réels)
Le composant `Depot` actuel n'a pas les 3 tiers détaillés demandés. Le réécrire intégralement avec :
- **Tier 1 (Hangar abandonné, `upgradeTotal < 3`)** : silhouette de hangar industriel à toit en bac acier rouillé, mur de tôle ondulée délavée (pattern SVG), porte de garage enroulable cabossée mi-baissée, tags graffitis (3 splashs colorés), enseigne néon "TA_I" qui clignote (lettre éteinte), gouttière cassée, herbes folles à la base.
- **Tier 2 (Garage rénové, `3 ≤ upgradeTotal < 8`)** : façade beige propre repeinte, porte sectionnelle blanche neuve, enseigne lumineuse stable "MY TAXI WORLD" avec halo doré, barrières chromées délimitant 4 places de parking marquées au sol nettes, panneaux solaires sur le toit, lampadaires.
- **Tier 3 (Empire moderne, `upgradeTotal ≥ 8`)** : bâtiment plus grand avec façade anthracite, grandes baies vitrées teintées (dégradé bleu nuit reflets), auvent moderne en porte-à-faux au-dessus de l'entrée taxis avec spots LED, logo "MY TAXI WORLD" rétroéclairé sur l'auvent, grand parvis goudronné avec marquages au sol blancs nets (6+ places), bandes LED architecturales bleues, totem vertical "TAXI" lumineux.
- **Intégration map** : suppression de tout `rect` plein-écran derrière le QG. Le bâtiment se pose sur un parvis octogonal en asphalte qui se fond dans la texture de route — aucun cadre carré visible. Ombre portée elliptique douce sous le bâtiment.

### 4. Conservation gameplay (inchangé)
- Tutoriel vétéran : intact
- Police circulante : intacte
- Radars : intacts (déplacés dans le quartier Ouest)
- Braquages fourgons blindés : intacts (déplacés dans le quartier Nord)

### Fichiers modifiés / créés
- `src/game/TaxiTycoon.tsx` — refonte map, intégration caméra, spawn rivaux, conservation gameplay
- `src/game/Depot.tsx` (nouveau, extrait) — composant QG 3 tiers
- `src/game/MapBackground.tsx` (nouveau) — grande carte 2D + textures + zones verrouillées
- `src/game/RivalAI.ts` (nouveau) — logique IA rivaux
- `src/game/useMapCamera.ts` (nouveau) — hook zoom/pan/pinch
- `src/game/gameAssets.ts` — patterns SVG bitume/herbe/tôle

### Hors scope
- Pas de changement DB / multiplayer
- Pas de changement radios / pellicules
- Pas de nouveau système d'upgrade (les niveaux QG existants pilotent le tier visuel)
