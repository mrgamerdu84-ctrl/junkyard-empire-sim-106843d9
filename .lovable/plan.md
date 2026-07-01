# Refonte : Progression 100% pilotée par la campagne

## Principe

Créer **un seul module central** `src/game/campaign/unlocks.ts` qui expose des flags booléens (`isUnlocked(featureId)`) calculés à partir de `campaignState`. Tous les autres systèmes existants **restent intacts** mais consultent ce module pour s'auto-masquer si le chapitre requis n'est pas atteint.

Aucun composant n'est supprimé. Aucune sauvegarde n'est cassée : les parties existantes voient simplement `campaignState.started = true` et sont considérées comme "campagne en cours" au chapitre courant. Une migration douce garde les taxis déjà achetés au-dessus du cap (grandfather).

## Table des déblocages (feature → chapitre requis)

| Feature ID | Débloqué à | Contrôlé par |
|---|---|---|
| `taxi.count` (cap flotte) | progressif | déjà en place (`unlockedTaxiCount`) |
| `depot.clean` | Ch1 | Chapter1Manager |
| `depot.repair_taxi` | Ch1 | Chapter1Manager |
| `personnel.marcel` | Ch2 | PersonnelPanel |
| `depot.gate`, `depot.power`, `depot.workshop2` | Ch2 | DepotEvolution |
| `office.explore`, `item.cassette`, `item.keyB12` | Ch3 | (nouveau) OfficePanel |
| `mail.system`, `baron.hint` | Ch4 | MafiaLimo (indirect) |
| `baron.active`, `baron.dialogue` | Ch5 | BaronConvoy / BaronNegotiation / MafiaGodfather |
| `contracts.system`, `reputation.system` | Ch6 | MissionOfferToast (special) |
| `security.system`, `driver.morale`, `sabotage.repair` | Ch7 | MafiaAttackers |
| `depot.b12`, `evidence.docs`, `map.hidden_zone` | Ch8 | (zone carte) |
| `investigation.system`, `choice.justice_pardon` | Ch9 | CampaignPanel choices |
| `pnj.journalist`, `evidence.gather`, `evidence.protect` | Ch10 | CampaignPanel |
| `choice.three_paths` | Ch11 | CampaignPanel |
| `baron.final`, `campaign.end` | Ch12 | — |
| `empire.mode` (dépôts, VTC, limos, navettes, minibus, événements infinis) | Épilogue | HomeScreen + AdminPanel |

## Modifications

### 1. Nouveau fichier `src/game/campaign/unlocks.ts`
- Exporte `isUnlocked(featureId)`, `requiredChapter(featureId)`, `useUnlock(id)` (hook réactif via `campaign.updated`).
- Table de mapping feature → chapitre.
- Helper `withLock(featureId, jsx)` pour rendus conditionnels.
- Événement `campaign.updated` déjà émis par `campaignState.ts`.

### 2. `src/game/campaign/campaignState.ts`
- Ajouter `ensureStartedForNewPlayers()` appelé au boot : si aucune sauvegarde campagne mais taxis > 1 en mémoire, marquer `started=true` et fixer `currentChapterIndex` selon nombre de taxis (migration douce, grandfathering).
- Ne pas casser les sauvegardes.

### 3. Gate des systèmes existants
Chaque composant ajoute un `if (!isUnlocked('xxx')) return null;` en tête. Aucun code métier retiré.

- `MafiaLimo.tsx` → `baron.hint` (Ch4)
- `BaronConvoy.tsx`, `BaronManor.tsx`, `BaronNegotiation.tsx` → `baron.active` (Ch5)
- `MafiaGodfather.tsx` → `baron.dialogue` (Ch5)
- `MafiaAttackers.tsx` → `security.system` (Ch7)
- `ArmoredTruck.tsx` → `empire.mode` (post-campagne, événement mafia haut niveau)
- `PersonnelPanel.tsx` → bouton Marcel gate Ch2, autres rôles gate Ch7 (moral), managers gate Empire
- `MissionOfferToast.tsx` → missions spéciales gate Ch6 (contrats)
- `CrimeEvents.tsx` → gate Ch7
- `HomeScreen.tsx` → entrées "Arène", "Défis", "Empire" gate épilogue
- `AdminPanel.tsx` : inchangé (outil admin, pas gameplay)
- `TaxiTycoon.tsx` :
  - `buyTaxi` déjà cappé
  - masquer boutons "acheter 2e taxi" tant que Ch2 non atteint
  - désactiver spawn de rivaux (`CityRivalTaxis`, `CityCompetitors`) tant que Ch6 non atteint

### 4. Routes protégées (`_authenticated/arena.tsx`, `defis.tsx`)
- Ajouter un garde côté composant : si `!isUnlocked('empire.mode')`, afficher écran "Débloqué après la campagne" au lieu de rediriger (pas de changement de router).

### 5. Chapter1Manager
- Déjà présent. S'assurer que l'intro se lance automatiquement sur nouvelle partie (déjà OK).
- Ajouter au 1er lancement `startCampaign()` si non démarré.

### 6. UX
- CampaignHud déjà en place → conservé.
- Toast discret quand une feature se débloque : `window.dispatchEvent('feature.unlocked', {id, chapter})` émis par unlocks.ts au changement de chapitre; un composant global `UnlockToast.tsx` affiche "🔓 Nouveauté débloquée : …".

## Ce qui NE change PAS
- CSS/interface générale, panel Admin, économie, DB, sauvegardes cloud, radio, trafic, feux rouges, piétons, `UltraFluidPanel`, `RadioPlayer`, HUD console, `DepotEvolution` visuel.

## Détails techniques
- `useUnlock` : `useState + useEffect` sur `campaign.updated`, renvoie boolean.
- Aucune migration SQL. Uniquement `localStorage`.
- Grandfather : joueurs existants avec > 1 taxi → `currentChapterIndex = min(taxis-1, 11)`, `completedChapters` remplis en conséquence, pour ne rien leur retirer.
- Compilation : tous les composants gardés, pas de refactor router.

## Fichiers touchés
Nouveau : `src/game/campaign/unlocks.ts`, `src/game/UnlockToast.tsx`.
Modifiés (ajout d'un gate en tête, ~3 lignes chacun) : MafiaLimo, BaronConvoy, BaronManor, BaronNegotiation, MafiaGodfather, MafiaAttackers, ArmoredTruck, PersonnelPanel, MissionOfferToast, CrimeEvents, HomeScreen, TaxiTycoon (spawn rivaux + bouton achat), CityRivalTaxis, CityCompetitors, Chapter1Manager (autostart), campaignState (grandfather), routes arena/defis (gate composant), routes/index.tsx (monter UnlockToast).
