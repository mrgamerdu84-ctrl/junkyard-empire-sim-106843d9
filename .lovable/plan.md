## Système "Le Parrain réclame sa rançon"

### 1. Nouveau module `src/game/MafiaGodfather.tsx`
Composant overlay HUD (portal, hors zoom carte) qui gère **toute** la mécanique :

- **État local persistant** dans `localStorage` (clé `mtw.godfather.v1`) :
  - `truceUntil` : timestamp ms — fin de la trêve payée (0 si aucune).
  - `nextDemandAt` : timestamp ms — prochaine apparition du Parrain.
  - `lastPaid` : timestamp.
- **Cycle automatique** :
  - À l'arrivée sur `nextDemandAt` → ouvre le pop-up du Parrain.
  - Si le joueur **paye 1 500 $** (debit via `jce.player.cashDelta` avec `amount: -1500`, `reason: "ransom"`) :
    - `truceUntil = now + 60 min`
    - `nextDemandAt = truceUntil + 5 s` (le Parrain revient pile après la trêve)
    - Émet `jce.mafia.truce` `{ active: true, until: truceUntil }`.
  - Si le joueur **refuse** :
    - Émet `jce.mafia.raid` `{ until: now + 90 s }` → déclenche un raid sur le QG.
    - `nextDemandAt = now + 8 min` (le Parrain revient plus tard).
- **Refus si fonds insuffisants** : bouton désactivé + message "Tu n'as pas de quoi payer… mauvaise idée." → traité comme refus si timer expire.

### 2. UI du pop-up (style talkie / haut-parleur old-school)
- Overlay centré, fond semi-opaque sombre.
- Carte sombre avec bord doré, icône **haut-parleur 📢** animé (pulse rouge quand il parle).
- Portrait du Parrain (image générée : silhouette costume + chapeau, cigare, fond rouge sombre — `src/assets/godfather.png`).
- **Bulle de dialogue** type bande dessinée (queue pointant vers le portrait) avec texte tapé caractère par caractère (effet machine à écrire ~25 ms/lettre).
- Textes tirés d'un pool aléatoire (4-5 répliques signature, ex : *"Alors, gamin… on dit que ça roule pour toi. Ce serait dommage qu'il arrive un malheur à ta belle flotte. 1 500 $ et on n'en parle plus pendant une heure."*).
- Boutons :
  - 🟢 **PAYER 1 500 $** (vert, désactivé si cash < 1 500).
  - 🔴 **REFUSER** (rouge, conséquences chiffrées sous le bouton).
- Compte à rebours **15 s** pour répondre → expiration = refus.

### 3. Intégration "trêve" (1 h)
Lecture d'un helper exporté `isMafiaTruceActive()` (lit `truceUntil` dans localStorage) :

- **`src/game/MafiaAttackers.tsx`** : court-circuite le spawn des voitures de sabotage si trêve active.
- **`src/game/ArmoredTruck.tsx`** : ne lance pas de mission camion blindé pendant la trêve.
- **`src/game/TaxiTycoon.tsx`** (génération des jobs / `claimedBy`) : ignore les "vols de course" par compagnies mafia tant que `isMafiaTruceActive()` est `true`.

### 4. Intégration "raid sur QG" (refus)
Nouvel évènement `jce.mafia.raid` écouté par `MafiaAttackers.tsx` :
- Pendant la durée du raid (90 s), spawn **3–5 voitures supplémentaires** dont la cible n'est plus les taxis mais le QG joueur (`admin.hqX/hqY`).
- Le joueur doit les cliquer pour les exploser (mécanique sabotage existante).
- À l'expiration, retour au régime normal (mafia continue son sabotage standard).

### 5. HUD : badge "Trêve" sur le tableau de bord
Dans `src/game/TaxiTycoon.tsx`, ajout d'une mini-pastille dans le bandeau status (à côté du trafic/météo) :
- **🤝 TRÊVE 42:18** quand `truceUntil > now` (mm:ss restant, vert).
- **☠ MENACE** quand pas de trêve (rouge discret).
- Cliquable → ré-ouvre le pop-up Parrain à la demande (utile si fermé par erreur).

### 6. Audio (optionnel, léger)
- Court "bip" radio à l'ouverture du pop-up (Web Audio API, oscillateur 600 Hz 80 ms, déjà utilisé ailleurs dans le projet — pas de nouvel asset).
- Voix off désactivée par défaut (évite la dépendance à TTS).

### 7. Assets
- `src/assets/godfather.png` — portrait généré (fast quality, 512×512, fond sombre, costume noir, chapeau, cigare allumé, lunettes fumées) inséré dans le pop-up.

### 8. Montage
- `src/routes/index.tsx` : ajout de `<MafiaGodfather />` au même niveau que `<AdminPanel />` (HUD fixe, hors zoom).
- Premier déclenchement : `nextDemandAt = now + 3 min` après la première partie (laisse le temps au joueur de s'installer).

### Récap mécanique
| Action joueur | Effet immédiat | Suite |
|---|---|---|
| Paye 1 500 $ | −1 500 $, trêve 60 min (mafia OFF) | Parrain revient à T+60 min |
| Refuse / timeout | Raid QG 90 s (vagues mafia) | Parrain revient à T+8 min |
| Cash < 1 500 | Bouton payer grisé → forcé refus | Idem refus |

Tout est local (localStorage + évènements `window`) — aucun changement backend.
