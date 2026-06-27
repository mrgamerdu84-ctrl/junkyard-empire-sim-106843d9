… Voici ce que je propose de faire en un seul sprint :

## 1. Tutoriel & Règlement mis à jour
- Réécrire le **tutoriel** (`src/game/Tutorial.tsx` ou équivalent) avec le gameplay actuel :
  - Flotte de taxis autonomes + chauffeurs embauchés
  - Menace Mafia (sabotage, raids, rançon du Parrain)
  - Détournement du camion blindé mafieux vers le QG
  - Pilote manuel au doigt (mode 🕹️)
  - Tableau de bord LCD (radio, équipe, profil, contrats, admin)
- Réécrire le **règlement / principes du jeu** : objectifs, économie, conditions de défaite (raid réussi mafia), trêve, fair-play multijoueur Arène.
- Accessible depuis le menu principal + bouton "?" dans le tableau de bord.

## 2. Carte de profil refaite
- Mise à jour de `ProfileCard.tsx` : nouveau design cohérent avec le tableau de bord LCD (cadre noir, écran tactile), affichage flotte réelle, chauffeurs embauchés, stats Mafia (raids repoussés, camions détournés), ELO Arène, photo conducteur.

## 3. Menu du jeu refait (beau fond + style tableau de bord)
- Refonte de l'écran d'accueil/menu (`src/routes/index.tsx` ou `MainMenu`) :
  - Nouveau **fond illustré** (image générée : skyline nocturne avec taxis jaunes + entrepôt + ambiance mafia néon)
  - Boutons type LCD/console bois comme le dashboard
  - Entrées : Jouer, Tutoriel, Règlement, Profil, Arène, Admin, Quitter

## 4. Route nord du QG en travaux
- Dans `TaxiTycoon.tsx` : identifier le tronçon de route inutilisé au nord du QG.
- Le **barrer visuellement** : barrières rouges/blanches, panneau "🚧 EN DÉVELOPPEMENT — Nouvelle extension bientôt", cônes.
- Désactiver le pathing des voitures sur ce segment (filtrer dans `roadPaths`).

## 5. Bouton "Nouvelle extension" (préparation future carte)
- Bouton verrouillé 🔒 dans le menu/dashboard : "Étendre la ville (bientôt)".
- Au clic actuel : toast "Extension en développement — débloquera une nouvelle carte avec circulation vers le nord."
- Architecture prête pour brancher plus tard une 2ᵉ scène SVG.

## Détails techniques
- Nouvelle image fond menu : `src/assets/menu-bg.jpg` (généré).
- Nouvelle image barrières travaux : SVG inline (pas besoin d'asset lourd).
- Aucun changement backend ; tout est frontend/présentation.
- Pas de nouvelle table Supabase.

Confirme et je lance l'implémentation. Une question rapide avant : **veux-tu que le menu principal soit une vraie page séparée (route `/menu`) avec bouton "JOUER" qui lance la partie, ou un overlay qui s'affiche par-dessus la carte au démarrage ?**