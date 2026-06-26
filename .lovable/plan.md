## Réassignation automatique des taxis lors d'un changement de propriétaire de quartier

### Objectif
Quand un quartier (district) change de propriétaire — conquis par le joueur, perdu, ou repris par un rival — les taxis rivaux dont le QG se trouve dans ce quartier doivent immédiatement basculer leur secteur d'opération vers le nouveau propriétaire, sans attendre un rechargement de page.

### Comportement

- **Quartier conquis par le joueur** : les rivaux affiliés à l'opérateur qui possédait ce quartier perdent leur droit d'y patrouiller. Ils sont réassignés à un autre quartier encore détenu par leur opérateur (le plus proche de leur position actuelle). Si leur opérateur n'a plus aucun quartier, ils se replient vers leur QG d'origine puis sortent en mode "itinérant" (pas de biais sectoriel).
- **Quartier perdu par le joueur** (repris par un rival) : les taxis du joueur ne changent pas de comportement (le joueur conduit manuellement), mais les rivaux du nouveau propriétaire ajoutent ce quartier à leur pool de patrouille.
- **Course en cours** : un rival qui transporte déjà un client termine sa course avant d'appliquer la nouvelle assignation (pas de demi-tour brutal).
- **Effet visuel** : un court flash sur le marqueur QG du quartier qui vient de changer de mains, pour signaler l'événement.

### Détails techniques

1. **Événement central** : ajouter un événement `mtw:district-owner-changed` émis par `TerritoryWar.tsx` dès qu'un district passe de `owned:false` → `true` ou inversement. Payload : `{ districtId, previousOwner, newOwner }`.
2. **CityRivalTaxis.tsx** :
   - Écouter l'événement et recalculer `homeDistrictId` pour chaque rival concerné via la nouvelle fonction `reassignSector(rival, ownedDistrictsByOperator)`.
   - Sélection du nouveau secteur : plus proche district encore détenu par l'opérateur → sinon fallback `null` (mode itinérant, `SECTOR_BIAS` ignoré).
   - Si le rival est `state === "with-client"`, marquer `pendingReassign = true` et appliquer après dépose.
3. **Mapping opérateur → quartiers possédés** : maintenu côté `TerritoryWar` (déjà présent dans `mtw-territory-v2`) et exposé via le payload de l'événement ou lu directement depuis localStorage.
4. **Flash QG** : dans le SVG overlay de `TerritoryWar.tsx`, ajouter une classe d'animation 1,2 s (pulse doré ou rouge selon gain/perte) déclenchée sur le `hqX/hqY` du district modifié.

### Fichiers touchés
- `src/game/TerritoryWar.tsx` — émission de l'événement + animation QG.
- `src/game/CityRivalTaxis.tsx` — écoute, réassignation, gestion `pendingReassign`.

Aucun changement de schéma de données ni de stockage.