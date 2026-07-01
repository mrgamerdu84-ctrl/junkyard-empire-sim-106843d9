# Concessionnaire Taxi — Plan d'implémentation

## Objectif
Ajouter une boutique de taxis progressive gatée par la campagne, avec un système d'affectation chauffeur↔véhicule, sans casser la flotte existante ni le panel Admin.

## Fichiers créés

### `src/game/dealership/taxiModels.ts`
Catalogue de 8 modèles avec toutes les stats :
```ts
export type TaxiModel = {
  id: string;
  name: string;
  emoji: string;
  unlockChapter: number;   // 1, 2, 3, 5, 7, 8, 10, 12
  price: number;           // 0 pour Héritage
  speed: number;           // 1-10
  fuel: number;            // consommation
  reliability: number;
  comfort: number;
  maintenance: number;     // coût mensuel
  prestige: number;
  assetKey: string;        // clé dans GAME_ASSETS
};
```
Contient les 8 modèles (Héritage, Classique, Berline Confort, Premium, Électrique, Van 7 places, Luxe, Limousine).

### `src/game/dealership/dealershipState.ts`
- `getOwnedModels()` / `buyModel(id)` — lit/écrit dans `taxi-tycoon-v4` (ajoute champ `ownedModelIds` + `assignments` par taxi).
- `assignDriver(taxiId, driverId)` / `unassign(taxiId)`.
- `isModelUnlocked(id)` — croise `unlockChapter` avec `campaignState.currentChapterIndex + 1` ou `empireUnlocked`.
- Événement `dealership.updated` pour rafraîchir l'UI.

### `src/game/DealershipPanel.tsx`
Deux onglets :
- **Concessionnaire** : grille de cartes (photo asset, stats en barres, prix, bouton Acheter). Modèles verrouillés grisés avec badge "Disponible Chapitre X". Bouton Acheter désactivé si argent insuffisant ou verrouillé.
- **Mon Garage** : liste des taxis possédés + select d'affectation vers les chauffeurs de `personnel.ts`. Un taxi sans chauffeur = badge "Inactif". Un chauffeur non affecté = warning en haut.

### Intégration UI
- `src/game/HomeScreen.tsx` ou console dashboard (TaxiTycoon) : bouton "🏪 Concessionnaire" gaté via `useUnlock("dealership")` (nouvelle feature clé, chapitre min = 2, après recrutement du 1er chauffeur — on ajoute une clé `personnel.first_driver` complétée par la mission `m2c` ou équivalent).
- Ajout dans `FEATURE_MIN_CHAPTER` de `unlocks.ts` : `"dealership": 2`.

## Intégration avec l'existant

### `src/game/TaxiTycoon.tsx`
- La flotte reste gérée par le système actuel (`taxis[]`, `dispatchTaxi`, `unlockedTaxiCount`).
- Quand on achète un modèle dans le concessionnaire, on **appelle la logique d'achat de taxi existante** en passant `assetKey` + `modelId` pour que le nouveau taxi utilise le bon sprite (via `GAME_ASSETS`).
- Le cap `unlockedTaxiCount()` de la campagne reste actif : le concessionnaire refuse l'achat si la flotte est déjà au max du chapitre (message clair).
- Le taxi index 0 (Héritage/"Taxi du Père") reste forcé, aucun changement.

### `src/game/personnel.ts`
- Ajout des helpers `listDrivers()` / `getDriverById(id)` s'ils manquent, pour le picker d'affectation.
- Le champ `assignedTaxiId` par chauffeur (persisté dans le state personnel existant).

### `src/game/gameAssets.ts`
- Enregistrer les 8 asset keys correspondants. Réutiliser les assets existants (taxi-yellow, taxi-red, taxi-gold, taxi-black, armored-truck pour van, etc.) au démarrage — l'admin pourra les remplacer via le panel comme aujourd'hui.

### `src/game/resetGame.ts`
- Ajouter la clé `DEALERSHIP_KEY` au reset complet.

## Contraintes respectées
- ✅ Panel Admin : les assets restent surchargeables (rotation, upload custom).
- ✅ Véhicules achetés circulent sur les vraies routes (même pipeline que la flotte actuelle).
- ✅ Système de taxis existant préservé, uniquement étendu.
- ✅ Compatibilité cloud : les nouveaux champs `ownedModelIds` / `assignments` s'ajoutent au save existant sans casser les anciennes parties (grandfathering : modèles déjà en flotte marqués comme possédés à la volée).

## Ce que je ne touche pas
- Trafic civil, Mafia, Baron, Radar, Radio.
- Logique de mission / dispatch.
- Système de sauvegarde cloud (juste des nouveaux champs additifs).
