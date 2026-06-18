## Ce que je vais ajouter

### 1. Tuto narratif au démarrage
- Nouveau composant `TutorialDialog.tsx` : avatar d'un personnage (chauffeur) + bulles de texte cliquables ("Suivant").
- ~6 étapes : bienvenue → comment prendre un client → carburant → station-service → concurrent IA → "à toi de jouer".
- S'affiche au 1er lancement (flag `localStorage`). Bouton "Revoir le tuto" dans l'écran d'accueil.

### 2. Classement quotidien + récompense hebdo (local par appareil)
- Fichier `src/lib/leaderboard.ts` :
  - Sauvegarde score quotidien dans `localStorage` (clé = date du jour).
  - Historique des 7 derniers jours.
  - À chaque fin de semaine (lundi), détermine le meilleur jour de la semaine écoulée → débloque le taxi spécial.
- Composant `Leaderboard.tsx` : panneau accessible depuis l'écran d'accueil. Affiche classement par jour de la semaine + meilleur score, indique si le taxi spécial est débloqué.
- Le score du jour est mis à jour automatiquement quand le joueur gagne de l'argent (hook dans `TaxiTycoon`).

### 3. Taxi spécial doré (récompense)
- Génère une image de taxi doré/premium (IA).
- Stocké comme asset. Apparaît dans le garage / sélection une fois débloqué.
- Bonus appliqué : tarif des courses x1.5, carburant -30%.

### 4. Concurrent IA
- Déjà en place via `rivalEnabled` dans `adminConfig`. Je vérifie qu'il est activé par défaut (oui : `rivalEnabled: true`).

### 5. Fix orientation des voitures
- Audit de `CityTraffic.tsx` : vérifier le calcul de l'angle de rotation des voitures placées sur les paths.
- S'assurer que la rotation suit la tangente du chemin (`Math.atan2(dy, dx)`) et que le pivot de l'image est correct.
- Les sprites doivent être normalisés "tête vers la droite" puis pivotés selon le sens de marche.

### 6. Multijoueur
- Pas de multijoueur en ligne (mode IA confirmé). Pas de Lovable Cloud / auth nécessaire pour cette feature.

## Détails techniques

- **Stockage** : tout en `localStorage` — pas de backend, pas de comptes.
- **Tuto** : flag `tt-tutorial-seen`. Avatar généré en image IA (style cartoon, chauffeur sympa).
- **Leaderboard** : `tt-daily-scores` = `Record<YYYY-MM-DD, number>`. Calcul dimanche soir → débloque taxi.
- **Taxi spécial** : `tt-special-taxi-unlocked` = bool. Sprite généré (taxi doré avec liserés).
- **Orientation** : audit du composant existant, fix si la rotation est inversée ou décalée de 90°.

## Ce que je ne fais pas
- Pas de système de comptes/multijoueur en ligne.
- Pas de notifications push pour annoncer le gagnant.
- Pas de partage de score sur les réseaux.