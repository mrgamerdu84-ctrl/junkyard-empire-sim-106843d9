## Ce que je vais ajouter

### 1. Nouvel onglet **"💥 Missions spéciales"** dans le panneau Admin

Un onglet dédié dans `AdminPanel.tsx` avec :

- **Bouton "🚛 Lancer un camion blindé maintenant"** — déclenche immédiatement un convoi (au lieu d'attendre 5–8 min). Le joueur **et** les rivaux peuvent l'intercepter, exactement comme le système actuel.
- **Bouton "🏦 Braquage de banque"** — apparition immédiate d'un marqueur "robbery" (sirène rouge) sur la carte, cliquable par le joueur (envoie la police), avec course contre l'IA pour rafler la mission (système `CrimeEvents` existant).
- **Réglage "Fréquence camion blindé"** — multiplicateur 0.25× → 3× sur l'intervalle d'apparition automatique (stocké dans `adminConfig`).
- **Toggle "Rivals peuvent braquer"** — on/off de la tentative IA (35% par défaut).
- **Toggle "Auto-spawn camion blindé"** — pour désactiver l'apparition automatique et ne déclencher que manuellement.

### 2. Section **"🎨 Skins véhicules"** mieux mise en avant

L'onglet **Skins** existe déjà et permet de remplacer voiture police / ambulance / pompiers / taxis / civils + camion blindé par upload d'image. Je vais juste :

- Ajouter une bannière en haut de l'onglet Missions spéciales avec un lien rapide "→ Changer les skins" qui ouvre l'onglet Skins (les véhicules par défaut que tu trouves moches sont remplaçables là).
- Vérifier que le skin "police" uploadé via la section "Véhicules personnalisés" (catégorie 🚓 Police) est bien utilisé par les voitures de police d'intervention — actuellement il n'alimente que le trafic civil. Je le branche aussi sur `EmergencyStations` / `TaxiTycoon` (véhicules d'urgence police), avec rotation aléatoire si plusieurs skins police sont uploadés.

## Fichiers modifiés

- `src/game/adminConfig.ts` — 3 nouveaux champs : `armoredFreqMult`, `armoredAutoSpawn`, `rivalsCanHeist`.
- `src/game/ArmoredTruck.tsx` — écoute `jce:armored-spawn-now` (clic admin) ; respecte les 3 nouveaux réglages ; lit la palette des skins police custom pour les flics affichés.
- `src/game/CrimeEvents.tsx` — écoute `jce:crime-spawn-now` (kind="robbery") pour spawn manuel.
- `src/game/EmergencyStations.tsx` + `src/game/TaxiTycoon.tsx` — utilise un skin police custom s'il en existe (catégorie "police"), sinon retombe sur `GAME_ASSETS["police.car"]`.
- `src/game/AdminPanel.tsx` — nouvel onglet "Missions spéciales", bannière vers Skins.

Aucun changement DB, aucun nouveau composant lourd, pas de toucher au gameplay existant.
