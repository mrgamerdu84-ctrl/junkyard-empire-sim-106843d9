# Ranger la barre du haut

## Problème
La zone tout en haut empile actuellement : bouton Aide, plaque nom, pastille météo+argent, bouton Réglages, puis une carte info (heure/jour/ville/densité) + le logo. Sur mobile c'est tassé, ça déborde et ça cache une partie du jeu.

## Solution
Garder en haut **uniquement l'essentiel toujours visible**, et déplacer le reste dans un **panneau déroulant** accessible depuis le tableau de bord en bas.

### 1. Barre du haut (minimaliste, transparente)
Une seule pastille compacte centrée + 2 petits boutons ronds aux coins :
- Gauche : `?` (tutoriel)
- Centre : pastille fine avec **heure réelle** · **icône météo** · **argent**
- Droite : `⚙` (réglages) et `⛶` (plein écran)

Plus de plaque bois "tt-wood-name", plus de carte info séparée, plus de gros logo en haut → la carte de jeu reprend l'espace.

### 2. Panneau "Infos ville" dans le dashboard du bas
Ajouter un bouton dans la console bois en bas (à côté de Radio/Flotte) intitulé **« INFOS VILLE »**. Au clic, ouverture d'un panneau (drawer en bas) qui affiche tout le détail aujourd'hui éparpillé :
- Jour et date complète
- Heure + période (matin/jour/soir/nuit)
- Ville détectée + météo détaillée
- Densité de trafic ×N
- Logo couronne décoratif

Fermeture par clic extérieur ou bouton ✕.

### 3. Comportement
- En mode plein écran carte (⛶), la barre du haut disparaît déjà — inchangé.
- La pastille du haut reste cliquable : un tap dessus ouvre aussi le panneau « Infos ville » (raccourci).
- Aucun changement de logique de jeu, uniquement présentation HUD.

## Fichiers touchés
- `src/game/TaxiTycoon.tsx` : refonte du bloc `tt-topbar` + suppression de `tt-info-card`/`tt-logo-mark` du haut, ajout du drawer « Infos ville » et du bouton correspondant dans la console bois, ajustement CSS associé.
