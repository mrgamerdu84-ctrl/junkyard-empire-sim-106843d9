
## Réponse rapide à tes deux questions

### 1. Mise à jour vraiment automatique → impossible avec ton setup actuel

Tu utilises **Capacitor avec assets embarqués**. Ça veut dire que le code HTML/JS du jeu est *physiquement copié* à l'intérieur de ton APK quand Android Studio le compile. Tant que les assets restent embarqués, **aucune mise à jour ne peut atterrir sur le téléphone sans réinstaller l'APK** (= refaire un ZIP + rebuild). C'est une limite d'Android, pas de mon côté.

Les deux seules façons d'avoir du vrai "auto-update" seraient :
- charger l'URL Lovable directement en WebView (ce que tu as refusé)
- utiliser un système type "Capacitor Live Updates" (payant, complexe)

Donc on reste sur ton workflow ZIP, mais on rend le rappel **automatique**.

### 2. La "page blanche / task"

J'ai vérifié le code actuel :
- `src/routes/index.tsx`, `TaxiTycoon`, `AdminPanel`, `CityTraffic` → propres
- Aucune erreur dans les logs du serveur de dev
- L'aperçu Lovable tourne (les animations défilent dans la session)

Donc côté **code, rien de cassé en ce moment**. La page blanche d'il y a quelques jours venait probablement d'un build cassé temporairement (logique de véhicules — message #210 où je te disais de revenir en arrière). C'est résolu.

---

## Ce que je vais construire

Un **système de notification de nouvelle version** : l'APK déjà installé sur ton téléphone, au lancement, vérifie discrètement s'il existe un ZIP plus récent côté Lovable. Si oui, une bannière apparaît dans le jeu.

### Comment ça marche

```text
Build du jeu                APK installé (téléphone)         Lovable (web publié)
──────────────              ────────────────────────         ────────────────────
genère version.json   ───►  /version.json (embarqué)         /version.json (live)
{                           valeur figée au build            valeur mise à jour
  buildId: "2026...",            │                            à chaque déploiement
  builtAt: 1718...               │
}                                ▼
                          au démarrage, fetch la version live
                          compare avec la version embarquée
                                 │
                                 ▼
                          différente ? → bannière :
                          "🆕 Nouvelle version dispo,
                           demande à Lovable : fais-moi le zip"
```

### Étapes concrètes

1. **Génération automatique d'un `version.json`** à chaque build
   - Petit plugin Vite qui écrit `public/version.json` avec `{ buildId, builtAt }` dérivés du timestamp de build
   - Embarqué dans le ZIP → finit dans l'APK
   - Embarqué aussi dans le site Lovable publié

2. **Hook `useVersionCheck()`** côté client
   - Au démarrage, lit le `version.json` local (figé dans l'APK)
   - Fetch `https://<ton-url>.lovable.app/version.json` (la version "live")
   - Compare les `buildId` / `builtAt`
   - Gestion gracieuse si pas de réseau : silence, pas d'erreur visible

3. **Bannière discrète** en haut du jeu quand une nouvelle version est dispo
   - Texte : *"🆕 Nouvelle version dispo (15 juin 14:30). Demande à Lovable : « fais-moi le zip »"*
   - Bouton "×" pour la masquer
   - Style cohérent avec l'UI du panel admin (fond `#14171c`, accent `#f5c542`)
   - Affichée une fois par session, mémorise le dismiss en `localStorage`

4. **Petit indicateur dans l'onglet Export** du panel admin
   - Affiche la version installée (ex: *"v. 18/06 06:56"*)
   - Affiche la version dispo en ligne
   - Bouton "Vérifier maintenant" qui force un refetch

### Détails techniques

- Pas de serveur custom à déployer, juste un fichier statique `version.json`
- L'URL Lovable est stable (`project--ab16a35f-...lovable.app`)
- Si l'utilisateur est offline, pas de bannière, pas d'erreur, pas de log bruyant
- Aucun changement à la logique du jeu, juste une couche d'info

### Fichiers à toucher

- `vite.config.ts` — petit plugin qui génère `public/version.json` au build
- `src/lib/version-check.ts` — hook React + logique de comparaison (nouveau)
- `src/game/VersionBanner.tsx` — composant bannière (nouveau)
- `src/routes/index.tsx` — ajouter `<VersionBanner />`
- `src/game/AdminPanel.tsx` — enrichir l'onglet Export avec les deux versions

### Limites à connaître

- **Première fois** : tu dois publier le site Lovable une fois (`Publish`) pour que la version "live" soit accessible. Ensuite chaque ZIP que je te donne contient la version au moment du build, et le site publié reflète la dernière version dès qu'on republie.
- La bannière n'apparaîtra **que si je publie aussi le site web** après chaque modif (ou que tu cliques Publier). Sinon ton APK ne saura pas qu'il y a du neuf.
- C'est un **rappel**, pas une vraie maj : tu devras toujours me demander "fais-moi le zip" et réimporter dans Android Studio.

Tu valides ? Si oui, je passe en mode build.
