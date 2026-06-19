## Objectif
1) Renforcer le système d'accidents (police + ambulance + pompiers liés, minuterie claire).
2) Désencombrer l'écran de jeu en regroupant les infos dans un menu/panel unique.

## 1. Accidents — secours coordonnés + minuterie visible

Aujourd'hui, les 3 véhicules d'urgence (ambulance, pompiers, police) sont déjà spawn et la minuterie existe — mais ils partent en ordre dispersé et la minuterie démarre seulement quand le 1er arrive, ce qui n'est pas clair.

Changements dans `src/game/TaxiTycoon.tsx` :
- Quand un accident est créé, **tous les 3 véhicules** (ambulance + pompiers + police) sont dispatchés ensemble vers le même accident (pas seulement ceux en `patrol`).
- L'accident n'est "clos" que quand **les 3 sont arrivés sur place** (`responders.size === 3`), à ce moment la minuterie démarre (`clearAt = tMs + ACCIDENT_BLOCK_MIN_MS`).
- Affichage de la minuterie amélioré :
  - Avant arrivée des secours : badge "🚨 Secours en route" + petits indicateurs 🚑/🚒/🚓 qui passent au vert dès qu'ils sont sur place.
  - Après : compte à rebours numérique grand et lisible "⏱ 12s" centré au-dessus de l'accident.
- Les cônes oranges restent centrés (déjà OK).

## 2. UI in-game — regrouper dans un panneau "Missions"

Constat : plusieurs cartes flottantes (depot stats en haut, contrats sur le côté, alertes, profil, garage FAB, leaderboard, etc.) saturent l'écran, surtout sur mobile.

Plan de nettoyage dans `src/game/TaxiTycoon.tsx` (UI uniquement, pas de logique métier) :

- **Garder visible en permanence** (HUD minimal) :
  - Barre du haut : argent + niveau ville + score (compactée).
  - Boutons d'action en bas (conduire, etc.).
  - Alertes critiques (accidents, contrôle police) — temporaires.

- **Déplacer dans un nouveau panneau "📋 Missions"** (bouton FAB en haut à droite qui ouvre un panneau latéral coulissant) :
  - Liste des contrats en cours (actuellement affichée en permanence à droite).
  - Missions joueur spéciales.
  - Stats du dépôt (revenus, courses…).
  - Mini-onglets : "Contrats" / "Missions" / "Stats".

- **Cacher par défaut** (déjà via boutons existants) : Garage, Boutique, Profil, Leaderboard, Règles, Admin.

Résultat : l'écran de jeu n'a plus que la map + 1 barre haut + 1 barre bas + 1 bouton "Missions" → beaucoup plus lisible.

## Fichiers touchés
- `src/game/TaxiTycoon.tsx` (logique accidents + refonte UI overlays)
- `public/version.json` → `1.3.7`

## Hors scope
- Pas de changement aux véhicules uploadés, à la couleur du taxi joueur, ni au mot de passe admin.
- Pas de changement aux règles de gameplay/économie.
