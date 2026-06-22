# Camion blindé & braquages

Un camion blindé qui traverse la ville de temps en temps, transportant l'argent des banques. Le joueur (ou un rival) peut l'intercepter pour rafler le butin — mais la police s'en mêle, et un échec coûte cher.

## Comportement du camion

- **Apparition** : toutes les 5 à 8 minutes, à un bord de la map. Il roule sur les routes normales (réutilise `ROADS` de `CityTraffic`) vers une "banque" (point fixe sur la map). Une seule instance à la fois.
- **Butin** : montant aléatoire entre **500 et 1500 $** affiché en pastille au-dessus du camion.
- **Cible cliquable** : tant qu'il roule, un halo doré pulse autour du camion. Cliquer dessus = "tentative de braquage".

## Boucle de braquage (joueur)

1. Clic sur le camion → un de tes taxis libres est envoyé l'intercepter (le plus proche).
2. Quand le taxi atteint le camion, le camion est immobilisé et **2-3 voitures de police** (sprite `police` existant) spawnent et convergent vers le taxi avec sirène visuelle.
3. Le taxi doit ramener le butin au **QG du joueur**. Pendant le trajet de retour, les voitures de police le poursuivent.
4. **Issue** :
   - Arrivé au QG avant capture → **+butin complet** au joueur.
   - Rattrapé par la police (distance < seuil) → **−50 % du butin** retiré du cash du joueur (min 0), notif "Braqué !".

## Boucle de braquage (rivaux)

- Chaque rival actif a une petite chance (~25 %) de tenter le braquage à chaque apparition. Si un rival arrive en premier, il fait le même cycle (taxi rival → QG rival), avec un sprite "halo" de sa couleur sur le camion.
- Si un **rival réussit** son braquage → **chaque autre compagnie (joueur inclus) perd 15 % de son cash**.
- Si un **rival échoue** → seul ce rival paie la pénalité (50 % de son cash).
- Si **personne ne braque** → le camion atteint la banque, disparaît, aucun effet.

## UI

- **Toast d'apparition** : "🚛 Camion blindé repéré ! Butin : 1 240 $".
- **Toast de résolution** : "💰 Braquage réussi !" / "🚨 Braquage raté, −620 $" / "💸 [Rival] vous a braqué, −15 %".
- **Pastille butin** suit le camion (chiffre lisible).

## Slot upload Admin

Nouveau champ dans `AdminPanel.tsx` : **"Camion blindé (sprite)"** — un seul upload, stocké dans `localStorage` (`jce.armored.sprite`). Fallback : sprite SVG par défaut (rectangle gris foncé avec coffre, gyrophare).

## Architecture technique

Nouveau composant **`src/game/ArmoredTruck.tsx`** :
- Manage le state d'un seul camion (`idle | rolling | intercepted | escaping | done`).
- Timer d'apparition (`setTimeout` 5-8 min aléatoire).
- Anime le sprite sur un path `ROADS` choisi au hasard.
- Expose des événements : `jce:armored-spawn`, `jce:armored-claim`, `jce:armored-resolved` (CustomEvent avec `{ winner: "player" | "rivalId" | null, amount, success }`).
- Spawn temporaire de 2-3 sprites "police" (composant interne, animation simple de poursuite — pas de couplage avec `CityTraffic`).

Modifications :
- **`TaxiTycoon.tsx`** : écoute `jce:armored-claim` (envoie le taxi libre le plus proche), `jce:armored-resolved` (applique +butin ou −50 %).
- **`CityCompetitors.tsx`** : écoute les mêmes events, applique les gains/pertes aux rivaux + applique la pénalité de 15 % aux autres compagnies sur succès rival.
- **`AdminPanel.tsx`** : ajoute le slot upload "Camion blindé".
- **`src/routes/index.tsx`** : monte `<ArmoredTruck />` à côté des autres calques de la map.

Pas de migration DB — tout est côté client (state in-memory + localStorage pour le sprite).
