# Refonte visuelle du QG — 3 paliers stylés, zéro carré moche

## Objectif
Remplacer le rendu actuel du QG (`Depot` dans `src/game/TaxiTycoon.tsx`, lignes ~319-405) qui affiche une dalle béton rectangulaire grise très visible, par un vrai bâtiment 2D vue de dessus/3/4 qui évolue en 3 paliers selon le niveau total des upgrades (`capLvl + revLvl + prodLvl`).

Aucune dalle rectangulaire pleine en fond. Le bâtiment et son parvis s'intègrent au bitume/herbe de la map via des bords irréguliers (asphalte avec coins coupés, micro-texture) et une ombre douce elliptique — pas de `rect` plein qui découpe le décor.

## Les 3 paliers

**Palier 1 — QG Abandonné** (`total < 3`)
- Hangar industriel vieux : murs en bardage métallique délavé (gris-beige) avec traînées de rouille
- Porte de garage enroulable visible avec rainures horizontales, peinture écaillée
- Petite enseigne lumineuse rectangulaire au-dessus de la porte « TAXI » à moitié éteinte (lettres `TA_I` clignotantes la nuit, tube néon cassé)
- 2-3 tags graffitis discrets (formes SVG stylisées, pas du texte lisible) sur le mur latéral
- Toit plat en tôle ondulée avec une cheminée d'aération rouillée
- Quelques places de parking au sol mais marquages effacés (peinture jaune fanée, traits brisés)
- Halo lumineux nocturne faible et vacillant

**Palier 2 — QG Rénové** (`total 3-7`)
- Mêmes proportions de bâtiment mais murs repeints en beige propre + bandeau jaune taxi
- Nouvelle porte de garage sectionnelle nette (panneaux gris anthracite avec hublots)
- Grande enseigne lumineuse « MY TAXI WORLD » bien éclairée au-dessus de la porte (fond noir, lettres jaune vif avec halo)
- Barrières de sécurité chromées autour du parvis (petits poteaux + chaînes ou tubes)
- Marquages parking nets (lignes jaunes pleines, numéros lisibles)
- Toit avec petits panneaux solaires ou skylights propres
- Néons bord de toit allumés régulièrement la nuit

**Palier 3+ — Empire du Taxi** (`total ≥ 8`)
- Bâtiment agrandi visuellement (~+25% largeur) avec une aile vitrée moderne
- Grandes baies vitrées teintées (dégradés bleu-noir avec reflets) sur la façade
- Grand parking goudronné devant : asphalte noir lisse, marquages blancs/jaunes ultra-nets, places numérotées, allées de circulation marquées
- Auvent design au-dessus de l'entrée taxis : structure en porte-à-faux jaune avec spots LED en dessous
- Logo lumineux « MY TAXI WORLD » sur l'auvent + drapeau ou totem vertical
- Éclairage architectural (bandes LED le long des arêtes, halos colorés au sol la nuit)

## Intégration map (anti-carré)
- Supprimer la grosse `rect` de dalle béton plein écran (ligne 335 actuelle)
- Remplacer par un parvis d'asphalte à forme **octogonale ou avec coins arrondis variables** (un seul `path` avec coins biseautés) limité au strict nécessaire autour du bâtiment
- Ajouter une ombre portée douce (`ellipse` floutée) au lieu d'une bordure dure
- Bords du parvis fondus avec micro-bandes herbe/gravier autour
- Aucun `stroke` noir épais sur le rectangle de fond

## Détails techniques

**Fichier modifié** : `src/game/TaxiTycoon.tsx` — fonction `Depot` uniquement (lignes 319-405). API/props inchangées (`tier, x, y, scale, rotation, capLvl, revLvl, prodLvl, night`), donc l'appel ligne 2341 reste identique.

**Calcul du palier visuel** :
```ts
const upgradeTotal = capLvl + revLvl + prodLvl;
const visualTier = upgradeTotal >= 8 ? 3 : upgradeTotal >= 3 ? 2 : 1;
```

**Structure SVG** par palier : un sous-composant ou un `switch (visualTier)` interne rendant 3 sous-arbres SVG distincts partageant un même footprint d'asphalte. Le nombre de places de parking visibles continue d'évoluer avec `capLvl` (4..9), l'intensité des néons avec `revLvl`, et l'éclairage entrée avec `prodLvl` — mais cette fois en s'appliquant aux éléments cohérents avec le palier (enseigne cassée P1, enseigne nette P2, auvent LED P3).

**Aucun changement gameplay** : on touche uniquement au rendu SVG. Les coûts d'upgrade, capacités, multiplicateurs, logique de spawn/dépôt restent identiques.

## Hors scope
- Pas de remplacement par une image PNG (rester en SVG vectoriel pur, cohérent avec le reste du jeu)
- Pas de modification du `RivalDepot` concurrent
- Pas de changement de la boutique QG ni des libellés d'upgrade
