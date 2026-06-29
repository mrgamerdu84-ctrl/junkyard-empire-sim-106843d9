## Nouvelle map TAXI WORLD avec rond-point central

### 1. Upload de l'image
- Uploader `1782560568907.png` vers Lovable Assets → `src/assets/citymap-taxiworld.jpg.asset.json`
- Remplacer la map dans `src/routes/index.tsx` : `mapSrc` pointe sur la nouvelle image (en gardant la version "lite" identique en attendant)

### 2. Routes SVG (src/game/CityTraffic.tsx)
Remplacement complet du tableau `ROADS` par les 6 chemins fournis (axe vertical N/S des deux côtés du rond-point, sorties parking TAXI WORLD, diagonale haut-droite, route bas-gauche). ViewBox conservé `0 0 1920 1080`, `preserveAspectRatio="xMidYMid slice"`.

### 3. Position du dépôt QG (src/game/TaxiTycoon.tsx)
- `hqX = 580`, `hqY = 180` (parking TAXI WORLD)
- Spots de parking réalignés sur ces coordonnées
- L'asset `taxi-warehouse` repositionné/redimensionné en conséquence

### 4. Sortie/retour des taxis sans téléportation
- Spawn initial du taxi joueur : `pathIdx = 2`, `pos = 0` (sortie parking)
- Retour au dépôt : navigation forcée sur `pathIdx = 3` jusqu'à `pos = pathLen` (entrée parking)
- Aucune réinitialisation de position abrupte — uniquement progression le long du path

### 5. Hors-scope (intact)
- Logique métier (missions, mafia, camion blindé, radio, dashboard)
- RoadCache : sera reconstruit automatiquement au prochain mount avec les nouveaux paths
- Limousine, urgences, piétons, feux : inchangés (les feux se recalculent depuis les nouveaux ROADS)

### Question rapide avant implémentation
La map actuelle (`citymap2.jpg`) doit-elle être **supprimée** ou **gardée en backup** ? Je propose de la garder le temps de valider la nouvelle map en jeu, puis on la supprimera ensuite.
