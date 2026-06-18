# Voitures civiles — auto-découvertes

Dépose simplement un fichier image dans ce dossier :

- formats acceptés : `.png` `.jpg` `.jpeg` `.webp` `.svg`
- vue de dessus (top-down) recommandée, capot vers la **gauche** (le moteur applique un flip horizontal pour matcher la direction des routes).
- pas besoin de modifier le code : au prochain rebuild, ta voiture apparaît dans le trafic civil.

L'ordre d'affichage suit l'ordre alphabétique des noms de fichiers.

Si ce dossier est vide, le jeu retombe sur les 4 voitures par défaut définies dans `src/game/gameAssets.ts`.
