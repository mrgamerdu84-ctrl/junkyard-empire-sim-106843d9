# Plan — zones de parking pré-définies + clarification "micro" tutoriel

## Partie A — Clarification "micro" du tutoriel

Le tutoriel n'a **pas** de bouton micro. Le seul bouton dans le dialogue est **🔊 / 🔇 Voix**, qui coupe/réactive la voix du narrateur (sortie audio). Aucun accès `getUserMedia` n'est demandé, donc rien ne peut déclencher une page d'erreur de permission micro.

Si tu confirmes que c'est bien ce bouton 🔊 qui pose problème, je sécurise davantage l'appel TTS :
- Wrapping du constructeur `new SpeechSynthesisUtterance(...)` dans un try/catch (pas seulement le `.speak()`).
- Détection iOS Safari où `speechSynthesis.speak()` lève si pas déclenché par un geste utilisateur — on n'auto-parle plus l'étape 1, on attend le premier clic sur 🔊.
- Toast d'erreur discret en cas d'échec, jamais de page d'erreur.

Si tu parlais d'un **autre** écran (radio, course, etc.), précise-moi lequel.

## Partie B — Système `parking_zones` pré-défini

### Objectif
Remplacer le placement dynamique des voitures garées (calculé à partir du waypoint route + offset normal) par un **tableau fixe de zones de parking** placées à la main le long des trottoirs.

### Étapes

**1) Nouveau fichier `src/game/parkingZones.ts`**
```ts
export type ParkingZone = {
  id: string;
  x: number;        // coordonnée SVG (0..1920)
  y: number;        // coordonnée SVG (0..1080)
  angle: number;    // rotation en degrés, parallèle au trottoir
  side: -1 | 1;     // côté trottoir (pour orienter le piéton conducteur)
};

export const PARKING_ZONES: ParkingZone[] = [
  // 12 à 18 zones réparties sur les grands axes
  // Coordonnées choisies manuellement le long des trottoirs visibles
  // (artère centrale horizontale, axes verticaux, abords des dépôts)
];
```

**2) Modification de `CityTraffic.tsx`**
- `Parking` type : ajouter `zoneId: string` au snapshot.
- Spawner (~ ligne 722) : au lieu de calculer `px/py` depuis `wp + normal*offset`, **piocher une zone libre** dans `PARKING_ZONES` (filtrer celles déjà occupées par une autre voiture en `parking`). Si aucune zone libre → ne pas garer cette frame.
- Phase `approaching` : interpole de la position courante de la voiture vers `(zone.x, zone.y)` avec rotation cible `zone.angle`. Durée inchangée (1.4 s).
- Phase `parked` : voiture figée exactement sur la zone, transform = `translate(x,y) rotate(angle)`.
- Phase `leaving` : interpole de la zone vers le waypoint route courant, puis libère `st.parking` et réinjecte la voiture dans le trafic (déjà géré).
- Piéton conducteur : ancré à `zone.x + perp*PARK_PED_OFFSET*side`, marche parallèlement à `angle`.

**3) Garde-fou trafic**
Vérifier que la condition existante `if (st.mission || st.parking) continue;` dans les boucles de collision/file inter-lane reste active — les voitures garées ne participent plus au pathfinding routier ni au gap-checking de la circulation. Aucune logique de waypoint ne s'applique pendant `parking`.

**4) Calibration**
Je place une **première vague de ~14 zones** réparties visuellement (4 sur l'avenue centrale, 6 sur les axes verticaux, 4 près des dépôts/commerces). Tu testes, et tu me dis :
- Si une zone tombe sur la route → tu m'indiques sa position approx (je l'ajuste de quelques pixels).
- Si tu veux plus/moins de zones par quartier.

C'est un système **manuel par design** : impossible de placer mal une fois les coordonnées validées.

### Fichiers touchés
- nouveau `src/game/parkingZones.ts`
- modifié `src/game/CityTraffic.tsx` (spawner + phases parking)

### Ce qui ne change pas
HUD, sauvegarde, IA taxi joueur, feux, piétons promeneurs, missions.

---

Valide ce plan (ou réponds à la question Partie A) et j'enchaîne.
