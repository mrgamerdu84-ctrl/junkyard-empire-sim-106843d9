
## Oui, c'est faisable — et gratuit

Pas besoin de payer. On utilise deux APIs publiques sans clé :

- **Open-Meteo** (https://open-meteo.com) — météo temps réel + lever/coucher du soleil. 100% gratuit, sans clé API, sans limite raisonnable.
- **BigDataCloud reverse-geocode-client** — nom de ville à partir des coordonnées GPS. Gratuit, sans clé, conçu pour le navigateur.

Localisation : `navigator.geolocation` du navigateur. Le joueur doit accepter une fois la demande de position. S'il refuse → fallback ville par défaut (Paris) ou IP-geo (`https://ipapi.co/json/`, gratuit, sans clé, basé IP donc approximatif).

## Ce qu'on ajoute

### 1. Hook `useRealWorldEnv` (`src/lib/realWorldEnv.ts`)
- Demande la géoloc au démarrage (avec bouton « Autoriser la localisation » dans le menu si refusée).
- Cache résultat dans `localStorage` (ville + coords) pour éviter re-prompt.
- Appelle Open-Meteo : `temperature_2m, weather_code, is_day, wind_speed_10m` + `daily=sunrise,sunset`.
- Refresh toutes les 15 min.
- Expose : `{ city, weather: 'clear'|'clouds'|'rain'|'snow'|'fog'|'storm', tempC, isDay, sunrise, sunset }`.

### 2. Annonce radio (`CityRadio` / système radio existant)
- Nouveau type de message radio : `"Météo à {city} : {description}, {temp}°C"`.
- Joué toutes les ~3 min en rotation avec les autres messages radio existants.
- Exemples : « Soleil sur Marseille, 24°C, bonne route ! », « Pluie battante à Lille, prudence sur les routes ».

### 3. Cycle jour/nuit visuel
- `isDay` pilote un overlay CSS sur la map (teinte bleutée sombre la nuit, opacité ~0.35).
- Phares des voitures : nouveau composant SVG `<CarHeadlights />` (deux cônes jaunes devant le véhicule) rendu uniquement si `!isDay`. S'applique au taxi joueur, rivaux, et trafic.
- Lampadaires : petits halos jaunes sur la map la nuit (optionnel, points fixes).

### 4. Météo visuelle (léger)
- `rain` / `storm` : overlay CSS de gouttes animées + assombrissement.
- `snow` : flocons CSS.
- `fog` : voile blanc semi-opaque.
- `clear` / `clouds` : rien de spécial le jour, ciel normal.

### 5. Réglages admin
- Dans `AdminPanel` → onglet « Monde » : toggle « Météo réelle » + « Cycle jour/nuit » + override manuel (forcer jour, nuit, pluie…) pour debug.

## Détails techniques

- **Aucune clé API** → aucun secret à stocker côté serveur. Tout côté client.
- **Privacy** : la position reste dans le navigateur, jamais envoyée à notre backend. On appelle Open-Meteo et BigDataCloud directement depuis le client.
- **Fallback** : si géoloc refusée ET ipapi échoue → ville = « Paris », météo désactivée, cycle jour/nuit basé sur l'heure locale du device (06h–20h = jour).
- **Mapping weather_code Open-Meteo** : 0→clear, 1-3→clouds, 45/48→fog, 51-67→rain, 71-77→snow, 80-82→rain, 95-99→storm.

## Hors scope

- Pas de prévisions multi-jours, juste la météo actuelle.
- Pas de saisons (neige seulement si l'API la signale).
- Pas de vent qui pousse les voitures, pas de routes glissantes — purement visuel + radio.
