## Objectifs

Améliorer le réalisme de la circulation : police active, radars fixes, piétons bien placés, plus de trafic, et véhicules toujours orientés dans le bon sens de la route.

## 1. Police — contrôles aléatoires de civils

- Ajouter un comportement « patrouille » à chaque voiture de police (state machine : `patrolling` → `pursuing` → `stopped_control` → `returning`).
- Toutes les 20–60 s (aléatoire), une voiture de police choisit une cible civile proche sur la même route.
- La police rattrape la cible, les deux véhicules s'arrêtent sur le bas-côté (offset latéral vers le trottoir).
- Un sprite policier (piéton) sort de la voiture de police, marche jusqu'à la portière du civil, attend 4–8 s (contrôle des papiers), puis remonte dans sa voiture.
- Les deux véhicules redémarrent dans le sens de la route d'origine.
- Paramètres exposés dans l'AdminPanel : fréquence des contrôles, durée du contrôle, probabilité.

## 2. Radars fixes sur trottoirs

- Nouveau type d'entité `Radar` (position figée, pas de mouvement, pas de pathfinding).
- Placement : sur le trottoir (offset perpendiculaire à la route, côté droit), pas au milieu de la chaussée.
- Slider AdminPanel : nombre de radars (0–10), répartis aléatoirement sur les segments de route au spawn.
- Sprite radar orienté face à la circulation ; flash visuel quand un véhicule passe au-dessus d'un seuil de vitesse.

## 3. Piétons — repositionnement

- Forcer les piétons à spawn et marcher sur les `sidewalk` (trottoirs), pas sur la chaussée.
- Recalculer l'offset latéral depuis l'axe de route : `roadHalfWidth + sidewalkOffset`.
- Vérifier les passages piétons : traversée uniquement aux intersections marquées.

## 4. Trafic — plus de véhicules

- Augmenter les valeurs par défaut dans `adminConfig.ts` : `civilCarCount` 8 → 16, `taxiCount` par défaut +50 %.
- Slider AdminPanel déjà présent : élargir la plage max (ex. 30 civils, 10 police).
- Vérifier que le spawner ne plafonne pas en dessous des valeurs admin.

## 5. Orientation des véhicules (CRITIQUE)

Bug actuel : certaines voitures roulent en marche arrière selon le sens de spawn.

- Centraliser le calcul `rotation = atan2(velocity.y, velocity.x) + spriteBaseOffset`.
- `spriteBaseOffset` par asset (les sprites top-down regardent vers le haut → +π/2).
- Au spawn, choisir la voie selon le sens de la route (conduite à droite) et initialiser `velocity` colinéaire à la tangente de route.
- Au demi-tour aux extrémités, recalculer la voie + la direction au lieu d'inverser la vitesse.
- Test de validation : ajouter un véhicule via l'admin et vérifier visuellement que le capot pointe dans le sens de marche sur tous les segments.

## Détails techniques

- Fichiers touchés : `src/game/TaxiTycoon.tsx` (boucle de simulation, spawn), `src/game/CityTraffic.tsx` (vehicles + pedestrians), `src/game/AdminPanel.tsx` (sliders radars/police/contrôles), `src/game/adminConfig.ts` (defaults + champs `radarCount`, `policeControlFrequency`, `policeControlDuration`), `src/game/gameAssets.ts` (asset radar + sprite policier piéton si manquant).
- Nouveaux assets si absents : `radar-top.png`, `police-officer-walk.png` (générés si nécessaires).
- Pas de changement backend.

## Validation finale

- Lancer une partie, ouvrir l'admin, régler 4 polices + 3 radars + 20 civils.
- Observer pendant 60 s : au moins un contrôle police déclenché, radars immobiles sur trottoirs, piétons sur trottoirs, aucun véhicule en marche arrière.
