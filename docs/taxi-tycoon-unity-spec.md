# Taxi Tycoon — Specs pour portage Unity

Document de référence pour recréer le jeu dans Unity (C#).
Le code web ne se convertit pas automatiquement : il faut reconstruire les systèmes ci-dessous.

---

## 1. Concept

Jeu de gestion : le joueur dirige une compagnie de taxis. Il achète des voitures,
prend des clients dans une ville vue de dessus, encaisse des courses et améliore son QG
pour devenir l'empire du taxi.

Vue : top-down 2D (en Unity → caméra orthographique sur sprites 2D, ou 3D avec caméra fixe).

---

## 2. Boucle de gameplay

1. Des **clients** apparaissent aléatoirement au bord des routes.
2. Le **taxi le plus proche** disponible est envoyé.
3. Le taxi va chercher le client → l'amène à destination.
4. Le joueur encaisse de l'argent (proportionnel à la distance).
5. Le joueur **achète** d'autres taxis et **améliore** son QG.

---

## 3. Entités

### 3.1 Taxi
- Propriétés : `position`, `vitesse`, `état` (`Idle | GoingToClient | Driving | Returning | Refueling`), `carburant`, `clientActuel`.
- Pathfinding : suit le réseau de routes (graphe de nœuds).
- Vitesse de base : ~60 unités/s (modulable par `taxiSpeedMult` : 0.5 → 3).
- Consommation : `fuelConsumption` (0.1 → 3) points/sec en roulage.
- Doit aller à la station-service quand carburant bas.

### 3.2 Client
- Apparait à un point aléatoire de route avec une **destination** aléatoire.
- Patience : **35 secondes**. Au-delà → disparait, course perdue.
- Visuel : point bleu = client en attente, point jaune 📍 = destination.

### 3.3 QG (siège de l'entreprise)
- 5 niveaux d'upgrade :
  | Niv | Nom | Taxis max | Multiplicateur tarif |
  |-----|-----|-----------|---------------------|
  | 1 | Garage abandonné | 1 | x1.0 |
  | 2 | Atelier rouillé | 2 | x1.1 |
  | 3 | Garage rénové | 4 | x1.25 |
  | 4 | Station moderne | 7 | x1.4 |
  | 5 | QG Taxicorp | 12 | x1.6 |
- Position, taille, rotation déplaçables (mode admin/édition).

### 3.4 Station-service
- Position unique sur la carte.
- Recharge le carburant du taxi qui s'y arrête.

### 3.5 Entreprise rivale (IA, optionnel)
- QG séparé, 1 à 6 taxis IA qui peuvent "snipe" des courses.
- `rivalReactionTime` : délai (1–15 s) avant qu'un taxi rival ne vole une course.

---

## 4. Économie

- **Tarif d'une course** = `distance_client_destination × tarif_base × niveau_QG_mult × clientFareMult × bonusContrat`
- Tarif de base ≈ 1$ par unité de distance.
- **Contrats** (missions optionnelles) : objectif type "servir 10 clients en 60 s" → récompense cash + **bonus ×2 sur tarifs pendant 20 s**.

---

## 5. Paramètres ajustables (panneau admin)

Reproduire en Unity via un `ScriptableObject` `AdminConfig.asset` ou un panneau debug :

| Paramètre | Min | Max | Défaut | Effet |
|-----------|-----|-----|--------|-------|
| `civilVehicleCount` | 0 | 24 | 22 | Voitures civiles (déco/trafic) |
| `taxiSpeedMult` | 0.5 | 3 | 1 | Vitesse globale taxis |
| `spawnRateMult` | 0.25 | 3 | 1 | <1 = clients plus rapides |
| `maxClientsBonus` | 0 | 10 | 0 | Clients simultanés en plus |
| `clientFareMult` | 0.5 | 5 | 1 | Multiplicateur tarif |
| `maxActiveTaxis` | 1 | 20 | 6 | Taxis en mission max |
| `taxiSpawnCooldown` | 0 | 15 s | 1.5 | Délai entre sorties du QG |
| `fuelConsumption` | 0.1 | 3 | 0.6 | Conso carburant/s |
| `rivalEnabled` | – | – | true | Active la concurrence |
| `rivalTaxiCount` | 1 | 6 | 2 | Nb taxis rivaux |
| `rivalReactionTime` | 1 | 15 s | 5 | Délai snipe IA |
| `rivalSpeedMult` | 0.5 | 2.5 | 1 | Vitesse taxis rivaux |

---

## 6. Ville et routes

- Réseau de routes = **graphe** (nœuds + arêtes). En Unity : utiliser **A*** (package `A* Pathfinding Project` gratuit ou NavMesh 2D).
- Les clients spawnent à un nœud aléatoire, destination = autre nœud à distance > seuil.
- Voitures civiles : suivent des boucles prédéfinies pour décor.
- Feux de circulation : cycle rouge/vert aux croisements (les taxis s'arrêtent au rouge).

---

## 7. UI minimale

- **HUD haut** : cash courant, nombre de taxis, niveau QG.
- **Menu bas** : boutons `Acheter taxi`, `Upgrade QG`, `Contrats`.
- **Écran d'accueil** : pseudo, jouer, classement, tuto.
- **Classement** : top scores quotidiens (en Unity → service externe comme PlayFab, Firebase, ou Unity Gaming Services Leaderboards).
- **Panneau admin** (touche cachée) : sliders pour tous les paramètres ci-dessus.

---

## 8. Sauvegarde

Web actuel : `localStorage` + cloud Supabase pour les scores.
Unity équivalent :
- Local : `PlayerPrefs` (simple) ou `JsonUtility` + `File.WriteAllText` dans `Application.persistentDataPath`.
- Cloud (optionnel) : Unity Cloud Save, PlayFab, ou Firebase.

À sauvegarder : cash, taxis possédés, niveau QG, position QG, pseudo, scores quotidiens.

---

## 9. Architecture Unity suggérée

```text
Scenes/
  Boot.unity         → splash + chargement
  Home.unity         → menu principal
  Game.unity         → ville + gameplay

Scripts/
  Core/
    GameManager.cs       (singleton, état global, cash)
    AdminConfig.cs       (ScriptableObject avec tous les sliders)
    SaveSystem.cs
  Entities/
    Taxi.cs              (FSM : Idle/GoingToClient/Driving/Refueling)
    Client.cs            (spawn, patience timer, destination)
    HQ.cs                (niveau, upgrade, capacité)
    RivalTaxi.cs
    GasStation.cs
  Systems/
    ClientSpawner.cs     (timing basé sur spawnRateMult)
    DispatchSystem.cs    (assigne client → taxi le plus proche)
    ContractSystem.cs    (missions + bonus ×2)
    TrafficLightSystem.cs
    RoadGraph.cs         (nœuds + A*)
  UI/
    HUD.cs
    HomeScreen.cs
    AdminPanel.cs
    Leaderboard.cs
```

---

## 10. Assets

Le visuel actuel est en SVG (vectoriel). À refaire en Unity :
- Sprites 2D simples (taxi vue de dessus, bâtiment QG, client pin, route texture).
- Ou modèles 3D low-poly avec caméra orthographique.
- Palette dominante : jaune taxi `#F5C542`, fond sombre `#1A1F2E`.

---

## 11. Ce qui ne se porte PAS directement

- React/TypeScript → C# : tout est à réécrire.
- SVG → Unity Sprites ou meshes.
- TanStack Router/Supabase → scènes Unity + Unity Services.
- Animations CSS → Unity Animator / DOTween.

---

## 12. Ordre de développement conseillé

1. Une ville statique avec routes (graphe + A*).
2. Un taxi qui suit un chemin entre deux points.
3. Un client qui spawn + dispatch automatique.
4. Cash + UI HUD.
5. Achat de taxis supplémentaires.
6. Upgrades du QG.
7. Carburant + station-service.
8. Contrats + bonus.
9. Taxis rivaux.
10. Panneau admin + sauvegarde + leaderboard.

## 11. Build / Identité

| Champ | Valeur |
|-------|--------|
| Nom affiché | My Taxi World Tycoon |
| Package Android | `com.mytaxiworldtycoon` |
| Package iOS | `com.mytaxiworldtycoon` (si portage) |
| Version initiale | 1.0.0 |
