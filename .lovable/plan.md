# Trafic civil évolutif par chapitre

La ville commence avec de vieilles voitures (années 70-80, cohérent avec le Taxi du Père) et se modernise chapitre après chapitre. À la fin (Mode Empire), on voit surtout des berlines modernes, SUV et électriques.

## Découpage par époque

| Chapitres | Époque | Style |
|---|---|---|
| Ch 1-3 | Vintage 70-80 | Vieilles berlines carrées, break familial, coupé rouillé, van hippie |
| Ch 4-6 | Rétro 90 | Compactes bombées, berline 90s, SUV première génération |
| Ch 7-9 | Moderne 2000-2010 | Citadines rondes, SUV, monospaces |
| Ch 10-13 | Contemporain / Empire | Berlines premium, crossovers, électriques, sportives |

## Nouveaux assets à générer (fond transparent — pas de calque blanc)

12 sprites top-down premium, PNG transparent, orientation vers le haut, même échelle que le Taxi Héritage. Style Tycoon premium, silhouettes reconnaissables, carrosseries avec courbes/reflets/ombres douces. Générés avec `transparent_background: true` pour éviter le carré blanc autour du sprite.

Dépôt dans `src/assets/civil/` avec préfixe d'époque pour tri :

```
era1-sedan-brown.png       era1-wagon-beige.png       era1-coupe-rust.png
era2-hatchback-red.png     era2-sedan-silver.png      era2-suv-green.png
era3-citadine-blue.png     era3-suv-black.png         era3-van-white.png
era4-premium-dark.png      era4-crossover-white.png   era4-electric-teal.png
```

## Nouveau fichier `src/game/civilFleetProgression.ts`

- Export `getActiveCivilCarUrls(chapter: number): string[]`
- Mappe chaque URL à son époque (`era1..era4`)
- Retourne uniquement les sprites dont l'époque est ≤ époque du chapitre courant
- Inclut aussi les véhicules custom uploadés par l'admin (toujours actifs, indépendants)
- Fallback : si `src/assets/civil/` vide, retombe sur `getCivilCarUrls()` actuel

## Câblage dans `src/game/CityTraffic.tsx`

- Remplace l'appel à `getCivilCarUrls()` par `getActiveCivilCarUrls(currentChapterNumber())`
- Écoute `mtw:campaign-changed` pour rafraîchir le pool de sprites quand le joueur change de chapitre
- Aucune modification de la logique de conduite / feux / piétons

## Ce qui ne change pas

- Concessionnaire, taxis, Mafia, admin panel, performance
- Les 7 voitures civiles premium déjà générées restent en place et sont classées `era3/era4` (modernes)
- Les véhicules ajoutés via le panel Admin restent visibles à tous les chapitres

## Détails techniques

- Auto-découverte via `import.meta.glob` déjà en place → il suffit de déposer les fichiers dans `src/assets/civil/`
- Époque déduite du préfixe `era{n}-` du filename dans le nouveau helper
- `currentChapterNumber()` déjà exposé par `dealership/dealershipState.ts`, réutilisé
