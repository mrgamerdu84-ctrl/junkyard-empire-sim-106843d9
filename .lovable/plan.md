## 1. Mode plein écran de la carte

Ajouter un bouton flottant ⛶ (en haut à droite, à côté de l'engrenage) qui bascule un état `mapFullscreen`.

Quand actif :
- Le top bar, le logo central, le bouton missions, la console bois, la bande directeur et les outils bas (APK / ✦) sont masqués.
- La carte/canvas occupe 100% du viewport (portrait ET paysage).
- Un petit bouton ✕ en surimpression permet de revenir au HUD complet.
- L'état se conserve quand on tourne l'écran, ce qui règle le problème de la carte écrasée en haut en paysage.

## 2. Boutons qui ne correspondent pas à leur label

Recâblage de la console et de la bande directeur pour que chaque libellé ouvre ce qu'il annonce :

| Bouton (label visible) | Action actuelle (incorrecte) | Nouvelle action |
|---|---|---|
| 🚕 GÉRER FLOTTE | `buyTaxi()` (achat direct) | Ouvre le garage (gestion + achat des taxis) |
| 🔧 AMÉLIORATIONS QG | Shop QG | Inchangé |
| 📻 RADIO & MISSIONS | Ouvre seulement les missions | Ouvre un panneau à 2 onglets : **Radio** (stations Célébrer / Droit Libre, lecture, volume) et **Missions** (liste actuelle) |
| ⚔️ RIVALITÉ | Classement | Inchangé |
| Bande "PROFIL DIRECTEUR" (en bas, libellé seul) | Décoratif | Ouvre le garage / profil directeur |
| Bande "PSEUDO ──── ✒" | Décoratif | Ouvre une mini-dialog pour éditer le pseudo (sauvegardé dans le profil cloud) |
| Bande "CONTRATS & MANUELS" (en bas, libellé seul) | Décoratif | Ouvre le tutoriel / contrats |
| 🏆 CLASSEMENT MONDIAL | Classement | Inchangé |
| 📖 CONTRATS & MANUELS (livre) | Tutoriel | Inchangé |

## 3. Détails techniques

- Fichier principal modifié : `src/game/TaxiTycoon.tsx`
  - `useState` pour `mapFullscreen` et `pseudoDialogOpen`.
  - Bloc HUD enveloppé dans `{!mapFullscreen && (...)}` pour le top bar, le logo, la console et la bande directeur.
  - Bouton ⛶ ajouté à côté de `.tt-round.tt-settings`.
  - Nouveau composant interne `RadioMissionsPanel` (onglets) qui réutilise les contrôles existants de `RadioPlayer` (stations / volume / play / piste actuelle) et le contenu actuel de `setMissionsOpen`.
  - Dialog pseudo : input contrôlé, sauvegarde via le hook profil existant (`useCloudCustomizations` / save state).
- Pas de changement de logique de jeu, pas de modification du moteur de trafic ni des missions — uniquement présentation et câblage d'événements.