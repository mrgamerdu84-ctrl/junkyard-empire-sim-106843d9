# Panel admin par compte + concurrents synchronisés

## 1. Accès admin par email (plus de mot de passe)

### Côté base
- Lookup de ton user `mrgamerdu84@gmail.com` dans `auth.users`, puis `INSERT INTO public.user_roles(user_id, role) VALUES (<ton uid>, 'admin')` (table et fonction `has_role` déjà en place).
- Nouvelle server fn `isAdmin()` (`createServerFn` + `requireSupabaseAuth`) qui retourne `await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' })`. RLS naturelle : un user lambda ne peut pas se faire passer pour admin.

### Côté UI (`AdminPanel.tsx`)
- Au mount du panel, appel `isAdmin()` via `useQuery`.
  - **Non connecté** → message "Connecte-toi pour accéder à l'admin" + bouton retour.
  - **Connecté mais pas admin** → message "Accès réservé" (et on cache même le bouton engrenage).
  - **Admin** → panel ouvert direct, plus aucun champ mot de passe.
- Suppression du gros bloc password (hash SHA-256, `sessionStorage`, reset phrase, "Changer le mot de passe admin"). Code mort retiré.

## 2. Données du panel synchronisées sur ton compte

Une seule table pour tout l'état admin (concurrents + véhicules custom + config sliders), keyed par user.

### Nouvelle table `public.admin_state`
- `user_id uuid` (PK, FK `auth.users`)
- `competitors jsonb` (array d'objets `{id, name, color, x, y, treasury, taxiCount, bankrupt}`)
- `custom_vehicles jsonb` (array existant côté `gameAssets.listCustomVehicles()`)
- `config jsonb` (snapshot `AdminConfig` actuel)
- RLS : un user voit/modifie uniquement sa ligne (admin compris — la table est par compte). Aucun accès `anon`.

### Server fns (`src/lib/admin-state.functions.ts`)
- `loadAdminState()` → renvoie la ligne du user (ou défauts).
- `saveAdminState({ competitors?, customVehicles?, config? })` → upsert partiel (merge des clés fournies).

### Câblage client
- Au login (ou ouverture du panel), `loadAdminState()` hydrate :
  - `setComps(...)` dans `CityCompetitors`
  - import dans la store `gameAssets` (réutilise `addCustomVehicle` ligne par ligne)
  - `setAdmin(...)` pour la config
- Toute mutation (ajout véhicule, ajout/suppression concurrent, slider) appelle `saveAdminState(...)` débouncé (~800ms) sur le champ concerné.
- Bouton manuel **"🔄 Synchroniser maintenant"** dans le panel (utile si bug) qui :
  - **Pousser** : envoie l'état local en base.
  - **Tirer** : remplace l'état local par celui de la base.

## 3. Ajouter des concurrents comme on ajoute des véhicules

Nouvel onglet **"Concurrents"** dans `AdminPanel` (ou dans l'onglet `rival` existant), liste éditable :
- Tableau des concurrents actuels (couleur, nom, treasury, position X/Y, bouton 🗑).
- Formulaire d'ajout : champ nom + color picker + bouton "📍 Placer sur la carte" (même UX que le QG joueur, pose en cliquant sur la map) + treasury initiale (slider).
- Cap conservé à 10 (`MAX_COMPETITORS`).
- Les concurrents IA "level-up" continuent de spawner automatiquement ; ceux ajoutés à la main vivent dans la même liste et sont aussi synchronisés.

`CityCompetitors.tsx` :
- L'état `comps` part de `loadAdminState().competitors` au lieu de la constante `INITIAL` figée (qui ne sert plus que de fallback à la première ouverture). Les level-ups continuent d'`append` dans la liste, qui re-sync vers la base.
- L'event `jce:competitors-changed` continue d'alimenter `CityRivalTaxis` côté affichage (pas de changement de format).

## Hors scope

- Pas de version multi-utilisateurs partagée (chaque compte a sa propre sandbox admin).
- Pas de migration des concurrents IA legacy (`INITIAL`) : ils restent les valeurs par défaut tant que la table est vide.
- Pas de modif du look des rivaux (déjà fait au tour précédent).

## Validation

- Connecté avec ton email → engrenage ouvre direct le panel, plus de prompt mot de passe.
- Connecté avec un autre compte → bouton engrenage caché.
- Ajout d'un concurrent depuis le panel → apparaît sur la map et un taxi de sa couleur circule.
- Recharge page / change d'appareil → tout est restauré depuis ton compte.
- Bouton "Synchroniser maintenant" → permet de force-push ou force-pull en cas de désync.
