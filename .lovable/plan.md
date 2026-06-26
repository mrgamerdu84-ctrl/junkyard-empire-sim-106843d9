## Cadre style "écran de téléphone"

Ajouter un cadre noir tout autour de la zone de jeu (top, gauche, droite) avec coins arrondis, comme la bordure d'un smartphone. La carte du jeu vit à l'intérieur.

## Bandeau supérieur — uniquement le titre

Dans `.tt-topbar`, **supprimer** :
- bouton `?` aide
- pastille HEURE · MÉTÉO · ARGENT (info déjà dans le LCD du bas)
- bouton Missions (descendu dans le tableau de bord)

**Garder / ajouter** :
- Gros titre centré **MY TAXI WORLD RIVALITÉ** (style enseigne lumineuse ambrée, Orbitron, glow doré)
- Bouton ⛶ plein écran/zoom carte à droite (déjà existant `tt-fs-toggle` — repositionné sur le bandeau)

## Radio intégrée dans le tableau de bord

Remplacer la touche `RADIO` (rangée 4) par un **mini écran tactile radio** intégré dans la même rangée mais sur 2 slots de large :
- Écran LCD ambré avec nom de la station qui défile (marquee si tronqué)
- Indicateur ▶ / ⏸
- Boutons tactiles ⏮ ⏭ pour changer de station
- Petit séparateur "CÉLÉBRER" / "DROIT LIBRE" (catégorie active)
- Au tap sur l'écran : ouvre le panneau radio complet pour choisir la station/volume

Rangée 4 reconfigurée en 5 cellules (radio = 2) : `[RADIO écran ××][FLOTTE][QG][RIVALITÉ][TUTO]` — CLASSEMENT est déjà accessible via RIVALITÉ.

## Bouton Missions

Descendu dans la rangée 5 (outils) avec compteur rouge intégré :
`[MISSIONS (n)][ENTRETIEN][SPÉCIAL][APK][ADMIN]` — rangée 5 passe à 5 colonnes.

## Fichier modifié

`src/game/TaxiTycoon.tsx` uniquement :
- JSX `.tt-topbar` (réduit au titre + bouton zoom)
- JSX `.tt-console-lcd` rangée 4 (radio intégrée) et rangée 5 (ajout Missions)
- CSS : nouveau `.tt-phone-frame` (cadre), `.tt-title-banner` (enseigne lumineuse), `.tt-lcd-radio` (écran radio tactile avec animation marquee)
- Logique radio : réutilise le store existant (RadioPlayer) ; expose `currentStation`, `next()`, `prev()`, `togglePlay()` via hook déjà en place ou via événements custom si besoin.

Aucune logique de jeu modifiée — uniquement présentation et réorganisation des contrôles existants.
