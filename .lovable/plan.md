
# Refonte missions + QG sur la map

On garde le moteur actuel (path, sprites, sauvegarde, AdminPanel) et on change la **logique de mission** + **ancrage du QG**.

## 1. Nouveau flow de missions

**Avant** : clients spawn automatiquement sur le trottoir, taxi le plus proche part tout seul. Le panneau Contrats sert juste de side-quest (gagner X$, faire X courses).

**Après** : 
- Le panneau Contrats devient la **file de courses** (le « répartiteur »).
- Chaque entrée = une vraie course (icône client, pickup → dropoff, tarif, deadline avant que le client annule).
- Le joueur clique **« Accepter »** → un taxi libre sort du QG, va au pickup, dépose, revient au QG.
- Si tous les taxis sont occupés → bouton « Accepter » grisé (« File pleine »).
- Si la course n'est pas acceptée dans son temps imparti → le client annule (malus léger : rien gagné).
- Plus de spawn automatique de clients sur le trottoir ni d'auto-dispatch.

Bonus visuels conservés : pickup/dropoff toujours dessinés sur la map dès qu'une course est acceptée, popup gain à la dépose, contrats bonus (streak, earn) supprimés au profit d'un format unique « course ».

## 2. QG réintégré à la map

**Avant** : QG flottant sur le path principal (ou XY libre via admin), donc se balade sur la route.

**Après** :
- Position par défaut = un emplacement fixe pensé pour la map (à côté du rond-point en bas-gauche, où il y a déjà visuellement le bâtiment TAXI CORP).
- Le QG **ne suit plus le path** : il est ancré en XY absolu.
- Admin → onglet QG : on garde uniquement « Placer sur la carte » + sliders X/Y/échelle/rotation. On retire le mode « suit le circuit » (qui causait le décalage visuel).
- Les taxis sortent et reviennent à ce point fixe. Pour aller au pickup, ils empruntent toujours le path le plus proche : on calcule la longueur sur le path la plus proche du QG (`hqPathPos`) et c'est de là qu'ils démarrent / reviennent.

## 3. Détails techniques

```text
SaveData
  + jobs: Job[]            // file de courses en attente (remplace partiellement contracts)
Job = {
  id, pickup, dropoff, fare, deadline, status: "offered"|"accepted"|"done"
}

Taxi
  mode: "idle"|"to_pickup"|"to_dest"|"returning"
  jobId: number|null       // remplace clientId

AdminConfig
  hqUseFreePos: true par défaut (ancré)
  hqX, hqY: position par défaut sur le bâtiment TAXI CORP (≈ 220, 760 sur viewBox 1920×1080, à ajuster visuellement)
```

- Suppression de `lastSpawnRef` / `lastTaxiDispatchRef` côté auto-dispatch ; on garde un cooldown sortie QG pour éviter que tous les taxis partent en même temps.
- Suppression de `genContract` (les bonus streak/earn) → remplacé par `genJob(tier)` qui produit une vraie course (pickup/dropoff aléatoires sur le path, tarif basé sur la distance × `fareMult` × `clientFareMult`).
- Le panneau « CONTRATS » est renommé **« COURSES »**. Chaque carte = un job avec bouton **Accepter** vert et timer.
- Le bouton **✕** (annuler) reste pour refuser une course.
- File auto-remplie jusqu'à `MAX_JOBS = 3` (configurable via admin).

## 4. Hors-scope de ce plan (à faire après si tu valides)

- Réparer les sliders bloqués (à investiguer après la refonte, peut être un side-effect du nouveau code).
- Piétons sur trottoirs, feux rouges, panneaux, animation de ville → étape ultérieure (gros morceau séparé).
- Nouveau sprite QG dédié → on reste sur le sprite Depot actuel pour l'instant.
