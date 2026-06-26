## Objectif
Unifier tout le tableau de bord du bas dans le même style LCD ambré que la rangée JOUR/HEURE/TRAFIC, regrouper tous les boutons dedans, et nettoyer les doublons du bandeau supérieur.

## Refonte console basse (`.tt-console`)
5 rangées LCD cohérentes, fond noir mat + glow ambre + Orbitron :

1. **JOUR · HORLOGE · TRAFIC** — inchangée (déjà au bon style).
2. **STATUS LCD** (nouveau) — petits écrans : MÉTÉO · ARGENT · FLOTTE x/max · COURSES EN COURS. Clic = Infos Ville / Dépôt.
3. **PILOTE** — photo chauffeur ronde cadran chromé + pseudo + barre progression QG + niveau. Bouton ✒ change pseudo.
4. **TOUCHES PRINCIPALES** (6 boutons style dashboard) : FLOTTE · QG · RADIO · RIVALITÉ · CLASSEMENT · TUTO.
5. **OUTILS** (4 boutons compacts) : ENTRETIEN ✦ · MISSION SPÉCIALE ✦ · APK · ADMIN ⚙.

## Nettoyage bandeau haut (`.tt-topbar`)
Garder : `?` aide, pastille Heure·Météo·Argent, bouton Missions bois.
Retirer : bouton Admin transparent (descend en rangée 5).

## Suppressions de doublons (bas actuel)
- `.tt-director-band` (TUTO + CLASSEMENT) → fusionné rangées 3 et 4.
- `.tt-director-foot` (PROFIL / PSEUDO / CONTRATS) → redondant, supprimé.
- Badge `.tt-admin-badge` superposé sur ✦ → remplacé par vrai bouton ADMIN en rangée 5.

## Fichier
- `src/game/TaxiTycoon.tsx` : JSX de `.tt-topbar` + `.tt-console`, et bloc `<style>` correspondant (classes `.tt-lcd-*`, nouvelles `.tt-lcd-row2`, `.tt-lcd-pilot`, `.tt-lcd-key`, `.tt-lcd-tool`).

Aucune logique métier modifiée — uniquement présentation et câblage des handlers existants (`setGarageOpen`, `setShopOpen`, `setRadioOpen`, `setShowLeaderboard`, `setCityInfoOpen`, `setPseudoOpen`, `setShowTutorial`, `repairTaxis`, `triggerSpecialMission`, événement admin).
