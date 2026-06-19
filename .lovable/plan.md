## Problème
Sur les véhicules d'urgence (ambulance, pompiers, police), c'est tout le véhicule qui semble clignoter à cause du gros halo bleu/rouge pulsant autour. L'utilisateur veut que ce soient **les gyrophares sur le toit** qui clignotent, pas la voiture entière.

## Solution
Dans `src/game/TaxiTycoon.tsx`, dans le rendu `emergencyRef.current.map(...)` :

- **Supprimer** le grand cercle pulsant `<circle r="26" fill={t === 0 ? "#3b82f6" : "#ef4444"} opacity="0.3">` qui englobe le véhicule entier.
- **Ajouter** une petite barre de gyrophares posée sur le toit du véhicule, composée de :
  - 2 petits dômes/rectangles côte à côte (bleu à gauche, rouge à droite) qui alternent en clignotant rapidement (~150 ms).
  - Un léger halo très localisé autour de chaque dôme (rayon ~3 px) pour l'effet lumineux, sans déborder sur la carrosserie.
- Le clignotement utilise déjà `t = Math.floor(performance.now() / 200) % 2` — on garde ce principe mais on l'applique uniquement aux dômes, pas à une aura globale.
- Effet visible seulement quand `alerting` (mode `respond` ou `onsite`).

Aucun changement de comportement / dispatch : c'est purement visuel.

## Fichier touché
- `src/game/TaxiTycoon.tsx` (rendu SVG des véhicules d'urgence)
- `public/version.json` → `1.3.8`
