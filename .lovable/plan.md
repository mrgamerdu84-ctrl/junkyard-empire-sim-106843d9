# Refonte du QG : Bureau du Patron + Écran GPS + Biper

Pivot du gameplay actuel (carte SVG vue de dessus avec taxis pilotés par le joueur) vers une **vue Patron** : tu ne conduis plus, tu **supervises** une flotte depuis ton bureau via un écran GPS et un biper Motorola.

## Ce qui sera fait

### 1. Nouveau composant `OfficeControlCenter.tsx`
Intégrer le code fourni dans `src/game/OfficeControlCenter.tsx` avec corrections :
- Nettoyer la chaîne cassée `backgroundColor: '#333\n'` (saut de ligne parasite).
- Extraire les `<style>` keyframes (`zoomIn`, `blink`) dans un bloc CSS injecté.
- Typage strict TS pour les états.

### 2. Assets visuels (générés, pas de carrés de couleur)
- `src/assets/decor_bureau_realiste.jpg` — bureau isométrique du patron (fauteuil cuir, écran allumé, lampe verte, café, biper sur la table).
- `src/assets/map_vierge_paysage.jpg` — **basée sur l'image de référence uploadée** : map 2D isométrique style city-builder (bitume, rond-point, station, parc à voitures, immeubles, espaces verts), sans démarcation carrée.
- `src/assets/taxi_yellow_isometric.png` — sprite taxi jaune isométrique transparent (32×32 visuel net, pas de rectangle).

### 3. Intégration dans le jeu
- Dans `TaxiTycoon.tsx`, ajouter un bouton/onglet « 🏢 Bureau » qui ouvre `OfficeControlCenter` en plein écran (overlay).
- Conserver tout le gameplay existant (tutoriel Léo, police, radars, braquages, QG 3 paliers, rivaux). Le bureau est un **module additionnel**, pas un remplacement.
- Brancher les vrais chauffeurs/taxis du state du jeu sur les panneaux du bureau (au lieu du mock statique) dans un 2ᵉ temps — pour cette itération on garde les données mock du composant fourni pour valider visuellement, puis on câble.

### 4. Biper fonctionnel
- Le compte à rebours d'interception rivale réutilisera le système de vol de clients déjà discuté (rivaux verts/rouges).
- Synthèse vocale Léo (déjà dans le code fourni) conservée, avec `cancel()` avant chaque `speak` pour éviter le bug mobile.

## Hors scope (à confirmer)
- Câblage complet des données live (chauffeurs/taxis réels du moteur de jeu) → itération suivante.
- Pan & zoom réels sur la map GPS → itération suivante (pour l'instant fond statique + sprites positionnés en absolu).
- Radio avec vrais MP3 → boutons UI seulement.

## Fichiers touchés
- **Créer** : `src/game/OfficeControlCenter.tsx`, 3 assets dans `src/assets/`.
- **Modifier** : `src/game/TaxiTycoon.tsx` (ajout du bouton + overlay).
- **Inchangé** : tutoriel, rivaux, police, radars, braquages, QG paliers.

Confirme et je l'implémente.