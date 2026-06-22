## Objectif

Remplacer l'horloge accélérée (5 min réelles = 1 jour de jeu) par l'heure et le jour réels du joueur, et faire varier la densité de circulation selon la taille de sa vraie ville (déduite du reverse-geo déjà en place).

## Changements

### 1. `src/game/cityClock.ts` — heure réelle

- `getGameTime()` lit `new Date()` au lieu de `performance.now() / DAY_MS`.
  - `hour` / `minute` = heure locale du joueur.
  - `dayOfWeek` = `Date.getDay()` (0 dim … 6 sam) — vrai jour de la semaine.
  - `isWeekend` = samedi/dimanche réels.
  - `isHoliday` = jours fériés français (liste fixe : 01/01, 01/05, 08/05, 14/07, 15/08, 01/11, 11/11, 25/12, + Pâques/Ascension/Pentecôte calculés via Butcher/Meeus). Aucune dépendance externe.
  - `label` = `"Lundi 14:37"` formaté en français.
- Les périodes (`rushAM`, `lunch`, `rushPM`, etc.) et la fonction `densityFor` restent inchangées — elles consomment juste les nouvelles valeurs.
- Ajout d'un export `getCityDensityMultiplier(population: number | null)` :
  - `null` → 1.0
  - `< 10 000` → 0.55 (village)
  - `< 100 000` → 0.85
  - `< 500 000` → 1.10
  - `< 2 000 000` → 1.35 (grande ville type Lyon/Marseille)
  - `≥ 2 000 000` → 1.6 (mégapole type Paris)

### 2. `src/lib/realWorldEnv.ts` — récupérer la taille de la ville

- Étendre `RealWorldEnv` avec `population: number | null`.
- Dans `reverseCity()`, garder BigDataCloud comme aujourd'hui, puis appeler l'API gratuite Open-Meteo Geocoding `https://geocoding-api.open-meteo.com/v1/search?name=<city>&count=1` qui renvoie un champ `population`. Stocké en cache localStorage à côté du reste.
- Fallback Paris : si géoloc refusée ET IP échoue → `{ city: "Paris", country: "France", lat: 48.8566, lon: 2.3522, population: 2161000 }` (au lieu du flou "votre ville" actuel).

### 3. Branchement densité → trafic

- `getGameTime()` accepte un paramètre optionnel `cityPopulation?: number | null` et multiplie `density` par `getCityDensityMultiplier(cityPopulation)`.
- `src/game/CityHud.tsx` : lit `useRealWorldEnv()` et passe `env.population` à `getGameTime()`. Le tick passe de 1 s à 30 s (l'heure réelle change lentement).
- `src/game/CrimeEvents.tsx` : même branchement (la criminalité suit déjà `density`).
- Les autres consommateurs du trafic (taxis, files d'attente) utilisent déjà `density` indirectement via les périodes — rien à toucher.

### 4. Affichage

`CityHud` montre désormais :
- `"Lundi 22 juin · 14:37"` (vraie date + heure locale)
- `"Paris · Pointe soir · Densité ×1.85"` (ville réelle + multiplicateur appliqué)

## Hors scope

- Pas d'intégration TomTom/HERE (payant, l'utilisateur a choisi l'option gratuite).
- Pas de saisie manuelle de ville (fallback Paris confirmé).
- Aucun changement de gameplay au-delà de la densité ; les revenus/missions restent calibrés.
