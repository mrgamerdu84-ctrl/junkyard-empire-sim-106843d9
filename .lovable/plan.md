# Plan — 6 chantiers gameplay & technique

Tout est inclus dans cette passe. Ordre d'exécution = ordre ci-dessous (trafic en premier).

---

## 1. Trafic : anti-collision + voies séparées (`src/game/CityTraffic.tsx`)

**Anti-collision (distance de sécurité 70 px)**
- Chaque véhicule expose sa position courante dans une `ref` partagée (Map<id, {x,y,dir,lane}>).
- À chaque frame (rAF), pour chaque voiture : projeter un "ray" de 70 px dans sa direction de déplacement et chercher un autre véhicule dont le centre tombe dans ce cône (même voie, même sens).
- Si obstacle détecté → l'animation CSS passe en `animation-play-state: paused` (freinage immédiat) ; reprise quand la voie est libre. Cela remplace le `duration` fixe par un mouvement contrôlé.
- Effet visible : files d'attente naturelles aux intersections, plus d'empilement.

**Voies séparées droite/gauche**
- Définir 4 couloirs par axe : NORD (x = +offset), SUD (x = −offset), EST (y = +offset), OUEST (y = −offset). Offset = demi-largeur de route − marge.
- Au spawn, la direction du véhicule détermine son couloir : aucune voiture ne peut emprunter le couloir opposé.
- Aux intersections, table de transitions autorisées (tout droit ou tourne dans le sens de la circulation à droite).

## 2. Fix tap "lancer mission" (mobile + desktop)

- Repérer le bouton/icône de mission (probable : `CityHud.tsx` ou marker dans `TaxiTycoon.tsx`).
- Remplacer `onClick` seul par `onPointerDown` + `touch-action: manipulation` CSS, avec `e.preventDefault()` pour bloquer le délai 300 ms iOS.
- Test sur viewport mobile (393×713) via Playwright pour confirmer.

## 3. Radio + TTS mobile (`src/components/TaxiRadio.tsx`)

**TTS iOS/Android**
- Garder l'unlock global déjà ajouté (pointerdown silencieux + `speechSynthesis.resume()`).
- Ajouter une option de bascule serveur (Lovable AI TTS via server function) en fallback si `speechSynthesis.speaking` ne démarre pas après 800 ms — couvre WebView Android.

**Fréquence des annonces**
- Annonce de l'heure du jeu UNIQUEMENT sur tick `minutes === 0 || minutes === 30` (lecture depuis `cityClock.ts`).
- Entre deux annonces horaires : uniquement musique (playlist) + DJ courte 1× toutes les ~4 pistes max.
- Plus de "spam" : un flag `lastAnnounceAt` empêche deux annonces dans la même fenêtre de 5 min de jeu.

## 4. PWA hors-ligne (utilise le skill PWA officiel)

- Installation de `vite-plugin-pwa` avec `generateSW`, `registerType: "autoUpdate"`.
- Wrapper `src/lib/registerSW.ts` qui REFUSE l'enregistrement en dev, iframe, `id-preview--*`, `*.lovableproject.com`, `?sw=off` (conformément au skill PWA).
- Cache : `NetworkFirst` pour les navigations HTML, `CacheFirst` pour les assets hashés (images voitures, MP3 radio, fonts).
- Manifest : nom, icônes, `display: standalone`, theme color.
- Sauvegarde joueur : déjà en `localStorage` côté `useGameStore` (à vérifier) — sinon migration vers `localStorage` pour plaques/niveau/argent.
- L'offline ne marche QUE sur le site publié (jamais dans le preview Lovable).

## 5. Concurrents évolutifs + plaque = permis

**Plaque qui évolue**
- Format plaque dépend du niveau : `LV01-AAA-001` → `LV99-ZZZ-999`. Affichage dans `HomeScreen` / profil.

**Nouveau concurrent à chaque niveau** (`src/game/CityCompetitors.tsx`)
- À chaque level-up, spawn d'un QG concurrent (bâtiment coloré) à une position libre de la carte.
- Couleur HQ = hue rotation basée sur `competitorIndex`.
- Agressivité croissante : vitesse de leurs taxis × (1 + 0.05 × index), fréquence de "narguage" textuel à l'écran (toast bulle) × (1 + 0.1 × index).
- Cap à 10 concurrents pour rester lisible.

## 6. Radar, braquages, sirènes, police garée

**Radar automatique**
- Marker noir fixe sur certaines routes. Si un taxi (joueur OU IA) franchit le radar à vitesse > limite → flash blanc plein écran 120 ms + son "click" + débit 50 $ au joueur (uniquement si c'est lui).

**Braquages rares (5%/jour)**
- Dans `CrimeEvents.tsx` : roll au tick "nouveau jour" du `cityClock` ; si `Math.random() < 0.05` → spawn camion de banque + mission braquage.

**Sirènes ambiance**
- Loop audio très bas volume (0.05) de sirènes lointaines, démarré après première interaction utilisateur. Toggle dans Admin Panel.

**Police/pompiers garés** (`CityTraffic.tsx` + `InterventionDispatcher.tsx`)
- Retirer les véhicules d'urgence du flux de trafic normal.
- Définir positions garées : commissariat(s) et caserne(s) sur la carte. Sprites statiques.
- Quand `InterventionDispatcher` déclenche une intervention (braquage, accident) → spawn d'un véhicule d'urgence depuis le QG le plus proche, gyrophare ON, trajet jusqu'au lieu, puis retour au QG, puis re-stationnement.

---

## Détails techniques

```text
Trafic loop (rAF):
  for each car:
    pos = computeCurrentPos(car)        // depuis %-progression CSS
    obstacle = scanAhead(pos, dir, 70px, sameLane)
    if obstacle: pause animation
    else: resume animation
```

Fichiers touchés :
- `src/game/CityTraffic.tsx` (gros refactor : voies + raycasting)
- `src/game/CrimeEvents.tsx` (5% braquage, radar)
- `src/game/InterventionDispatcher.tsx` (dispatch véhicules garés)
- `src/game/CityCompetitors.tsx` (spawn par level-up)
- `src/components/TaxiRadio.tsx` (TTS fallback serveur + cadence horaire)
- `src/game/CityHud.tsx` ou marker mission (pointerdown)
- `src/game/HomeScreen.tsx` (plaque évolutive)
- `src/game/AdminPanel.tsx` (toggle sirènes, toggle radar, toggle PWA debug)
- Nouveau : `src/lib/registerSW.ts`, `public/manifest.webmanifest`, icônes PWA
- `vite.config.ts` (ajout `vite-plugin-pwa`)
- Nouveau server fn : `src/lib/tts.functions.ts` (fallback TTS Lovable AI)

## Hors scope
- Refonte visuelle de la map.
- Modification du système économique (prix courses, etc.).
- Multijoueur réseau.

Une fois ce plan approuvé, j'attaque dans l'ordre 1 → 6.
