## Objectif

Éviter que les taxis envahissent les routes, et rendre le QG entièrement personnalisable depuis le Panel Admin (position libre sur la map + taille ajustable + options visuelles).

## 1. Régulation du trafic taxi

Ajout d'un "Traffic Controller" pour les taxis dans `src/game/CityTraffic.tsx` (ou module dédié `TaxiManager.ts`) :

- **Nombre max de taxis actifs simultanément** sur la map (slider Admin, ex. 1–20, défaut 6).
- **Délai minimum entre deux spawns** (cooldown, ex. 2–15 s).
- **Densité par route** : maximum N taxis par circuit pour éviter les files.
- **Despawn automatique** des taxis inactifs (sans client depuis X secondes) pour libérer la place.
- **File d'attente de spawn** : si la limite est atteinte, le prochain taxi attend au QG au lieu d'être ajouté.

Ces règles s'appliquent en plus des sliders déjà présents (vitesse taxi, fréquence clients, etc.).

## 2. QG personnalisable

Refonte du QG (actuellement position fixe via slider X/Y) :

- **Position libre** : drag & drop du QG directement sur la map en mode Admin (poignée visible quand le panel est ouvert), + champs X/Y numériques précis.
- **Taille ajustable** : slider d'échelle (0.5× à 3×) avec aperçu en direct.
- **Rotation** (optionnel, slider 0–360°) pour aligner avec une route.
- **Style** : choix entre 2–3 presets visuels (garage, tour, dépôt) + couleur principale.
- **Snap aux routes** : option pour aligner automatiquement la sortie du QG sur la route la plus proche (les taxis sortent proprement).

## 3. Panel Admin — nouvelle section "QG & Taxis"

Ajout d'un onglet dans le panel ⚙ existant :

```
[ Général ] [ Trafic ] [ QG & Taxis ] [ Missions ]
```

Contrôles ajoutés :
- Max taxis simultanés (slider)
- Cooldown spawn (slider)
- Densité max par route (slider)
- Despawn auto inactifs (toggle + durée)
- QG : X, Y, échelle, rotation, style, couleur
- Bouton "Placer le QG sur la carte" (active le mode drag)
- Bouton "Réinitialiser"

Tous les réglages sont persistés (localStorage, comme l'existant) et appliqués en live.

## 4. Détails techniques

- Nouveau hook `useTaxiManager()` qui gère pool, cooldowns, et file d'attente.
- Le composant `HQ` devient `<HQ x y scale rotation style color />` contrôlé par le store admin.
- Mode "édition QG" : overlay sur le SVG avec une poignée draggable (pointer events) qui met à jour x/y du store.
- Mise à jour du ZIP export Unity/Android avec les nouveaux paramètres dans `data/trajectories.json` (section `hq` + `taxiLimits`).

## Fichiers touchés

- `src/game/CityTraffic.tsx` — intégration du TaxiManager + HQ paramétrable
- `src/game/TaxiManager.ts` *(nouveau)* — logique de régulation
- `src/game/HQ.tsx` *(nouveau ou extrait)* — composant QG paramétrable + drag
- `src/components/AdminPanel.tsx` — nouvel onglet "QG & Taxis"
- `src/state/adminStore.ts` *(ou équivalent)* — nouveaux champs
- Script d'export ZIP — inclure les nouveaux paramètres

## À confirmer

1. Le drag & drop direct du QG sur la map te convient, ou tu préfères uniquement des sliders X/Y ?
2. Pour les presets visuels de QG (garage / tour / dépôt), je pars sur des formes SVG stylisées simples, ou tu veux que je génère de vraies illustrations ?
