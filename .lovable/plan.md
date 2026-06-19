## Missions spéciales dorées (joueur)

Ajouter un système de **missions spéciales** que le joueur déclenche manuellement, en plus des courses automatiques de la flotte.

### Concept

- La flotte de taxis IA continue ses courses normales en arrière-plan.
- Le joueur a un **bouton "Mission spéciale"** (icône étoile dorée) en HUD.
- Quand il clique, une **mission dorée** apparaît sur la carte avec un client unique (halo doré pulsant + couronne) et un objectif clair (ex. "Conduire le maire à l'aéroport en 60s").
- Le joueur doit assigner un de ses taxis (ou un taxi dédié "joueur") pour réussir.
- Récompense majorée : **gros bonus $ + gros XP permis** (ex. 3x fare + 50 XP).

### Règles de déclenchement

- Cooldown : 1 mission spéciale toutes les **2 minutes** (timer visible sur le bouton).
- Déblocage progressif via le permis :
  - Niv. 1-2 : mission "VIP Express" (course rapide, 2x fare, +30 XP)
  - Niv. 3+ : mission "STAR" (long trajet, 3x fare, +50 XP)
  - Niv. 4+ : mission "Légende" (multi-arrêts, 4x fare, +80 XP)
- Échec (timer dépassé ou client annulé) : pas de pénalité, juste pas de récompense, cooldown remis.

### UI

- **Bouton flottant** en bas-droite de l'écran de jeu : pastille dorée ronde avec étoile, ring de cooldown, label "Mission".
- Au clic : petite modale "Mission disponible : {titre} — Récompense {x}$ + {xp} XP — [Lancer]".
- Une fois lancée : bandeau doré en haut "MISSION ACTIVE — {objectif} — {timer}".
- Client doré sur la carte avec halo intense + icône couronne.

### Technique

- Nouveau fichier `src/lib/specialMissions.ts` : catalogue des missions (titre, durée, multiplicateur, XP, niveau requis).
- `src/game/TaxiTycoon.tsx` : 
  - état local `specialMission: { id, kind, startedAt, expiresAt, targetJobId } | null`
  - état `specialCooldownUntil: number`
  - injection d'un `Job` avec `tier: "special"` (nouveau tier) quand lancée
  - logique de victoire (course complétée avant `expiresAt`) → bonus + appel RPC `add_license_xp`
- Nouveau composant `src/game/SpecialMissionButton.tsx` (bouton + modale + bandeau actif).
- Réutilise le rendu halo existant (gold/STAR) avec une intensité supérieure pour le tier `special`.

### À confirmer

- OK pour cooldown 2 min ? (sinon dis-moi la durée souhaitée)
- Le joueur a-t-il un **taxi personnel dédié** qui prend la mission, ou n'importe quel taxi de la flotte est éligible ?
