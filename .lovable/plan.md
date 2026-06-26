## Déplacer le bouton Admin (⚙) dans la barre d'outils du bas

### Contexte
Le bouton Admin (⚙) est actuellement dans la barre du haut (`tt-topbar-slim`). L'utilisateur le veut à côté du bouton **Mission spéciale** (`.tt-diamond`) dans la zone du bas (`tt-lower-tools`), là où se trouvent aussi le bouton noir **Entretien flotte** (`.tt-slot`).

### Changements
1. **Supprimer** le `<button className="tt-round tt-settings">⚙</button>` de la barre du haut.
2. **Ajouter** un nouveau bouton Admin (⚙) dans la `<div className="tt-lower-tools">`, à côté du bouton `.tt-diamond`.
3. **Ajuster** le CSS `grid-template-columns` de `.tt-lower-tools` pour accueillir le 4e bouton (passer de 3 à 4 colonnes).
4. **Styliser** le nouveau bouton Admin pour qu'il soit cohérent visuellement avec les autres boutons de cette zone (format carré arrondi, fond sombre, icône blanche).

### Fichier modifié
- `src/game/TaxiTycoon.tsx` (JSX + CSS inline dans le fichier)

### Résultat attendu
Le bouton ⚙ n'apparaît plus en haut ; il est visible en bas, à côté du bouton Mission spéciale (✦), permettant l'accès aux réglages/QG depuis la console du bas.