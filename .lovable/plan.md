# Atelier de Réparation & Personnalisation

## Objectif
Cliquer sur le QG du joueur ouvre un **atelier-garage** immersif (vue intérieure) où un mécano animé répare les taxis abîmés par la mafia, et où le joueur achète des améliorations **visibles** sur la carte.

## 1. Entrée dans l'atelier
- Zone cliquable invisible posée sur l'image `player-hq.png` (coords déjà fixées 1030/360).
- Au clic → overlay plein écran `GaragePanel.tsx` avec animation d'ouverture (zoom + fade).
- Bouton « ← Retour à la ville » qui referme.

## 2. Vue intérieure (2.5D isométrique, pas de vraie 3D)
Pour rester léger et cohérent avec le style actuel (SVG + isométrique) :
- Décor : sol béton, baies vitrées, panneaux d'outils, pont élévateur, néons.
  → un SVG composé (pas d'asset binaire requis) + 1 image de fond optionnelle générée.
- Taxi sélectionné posé au centre sur le pont élévateur, vu de 3/4.
- **Mécano animé** : sprite SVG qui se déplace autour du taxi (translateX/Y CSS keyframes), avec outil en main (clé à molette, pistolet à peinture selon l'action). Étincelles ponctuelles quand il répare, gouttes de peinture quand il repeint.

## 3. Sélection de flotte
- Liste latérale : tous les taxis du joueur (issus de `companyV2.fleet`).
- Chaque ligne montre : nom, état (PV %), couleur, niveau pneus/moteur/blindage.
- Les taxis **endommagés par la mafia** (PV < 100 %) ont un badge rouge « À réparer ».

## 4. Actions disponibles par taxi
| Action | Coût | Effet | Temps animé |
|---|---|---|---|
| Réparer carrosserie | 50 $/PV manquant (−mécano discount) | PV → 100 % | 3 s + étincelles |
| Pneus sport | 800 $ | +8 % vitesse | 2 s |
| Pneus pro | 2 200 $ | +15 % vitesse | 2 s |
| Moteur V2 | 1 800 $ | +10 % revenus/course | 4 s |
| Moteur V3 | 4 500 $ | +20 % revenus/course | 4 s |
| Blindage léger | 1 500 $ | −40 % dégâts mafia | 3 s |
| Blindage lourd | 3 800 $ | immunité mafia 1 attaque/jour | 3 s |
| Repeindre (palette couleurs) | 300 $ | change `color`/`accent` du taxi | 2 s |
| Stickers (toit lumineux, bandes) | 250 $ | ajoute calque visuel | 1 s |

Pendant l'animation : barre de progression, mécano qui bouge, blocage des autres actions sur ce taxi.

## 5. Stockage & propagation à la carte
- Étendre `companyV2.Taxi` avec :
  ```ts
  upgrades: { tires: 0|1|2; engine: 0|1|2; armor: 0|1|2; sticker: null|"roof"|"stripes" }
  paint: { color: string; accent: string }
  hp: number  // 0..100
  ```
- Émettre `mtw:fleet-upgraded` quand une amélioration est appliquée.
- `CityRivalTaxis.tsx` (ou le calque qui dessine les taxis employés du joueur) lit `paint` pour la couleur du SVG, et ajoute :
  - calque pneus plus larges si tires ≥ 1
  - plaque de blindage (rect gris) si armor ≥ 1
  - barre lumineuse jaune sur le toit si sticker = "roof"
- Vitesse du taxi sur la carte multipliée par `(1 + 0.08*tires_level)` ; revenu de course multiplié par `(1 + 0.1*engine_level)` dans `companyV2.simTick`.

## 6. Dégâts mafia (boucle gameplay)
- `CrimeEvents` / mafia attaque déjà existante → quand un taxi du joueur est touché, son `hp` baisse de 20–40 %.
- S'il tombe à 0 → marqué « hors-service », ne roule plus jusqu'à passage au garage.
- Le joueur DOIT visiter l'atelier pour réparer → boucle économique forte.

## 7. Progression Tycoon
- Score « qualité flotte » = moyenne (tires+engine+armor)/6.
- Plus le score grimpe :
  - +5 % de clients VIP générés par tick dans `companyV2`
  - +10 % de pourboires
  - déblocage de contrats B2B premium (déjà existants) à partir de qualité ≥ 0.5
- Affichage d'une jauge « Prestige flotte » dans l'atelier + dans le LCD du tableau de bord.

## Fichiers
- **Créer** : `src/game/garage/GaragePanel.tsx`, `src/game/garage/MechanicSprite.tsx`, `src/game/garage/garageUpgrades.ts` (catalogue + types).
- **Modifier** : `src/game/companyV2.ts` (champs upgrades/paint/hp + maths), `src/game/TaxiTycoon.tsx` (hotspot clic QG → ouvre `GaragePanel`), `src/game/CityRivalTaxis.tsx` (lecture paint + calques d'upgrade), `src/game/vehicles/VehicleSvgs.tsx` (ajouter props `tires`, `armor`, `sticker` au `SedanSvg`).

## Hors scope
- Pas de vraie 3D WebGL (resterait du SVG isométrique stylé).
- Pas de marketplace de pièces, pas de réparations facturées par chauffeur (forfait simple).
- Pas de modification du système mafia existant au-delà de l'ajout du champ `hp`.

Réponds **« go »** pour lancer l'implémentation, ou indique ce que tu veux ajuster (catalogue d'upgrades, prix, vrai rendu 3D Three.js plutôt qu'isométrique SVG, etc.).
