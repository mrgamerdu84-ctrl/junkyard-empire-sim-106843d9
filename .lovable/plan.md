# Refonte HUD pixel-perfect (image de référence)

Objectif: rendre le HUD strictement identique à la maquette envoyée. Aucune logique de jeu touchée — uniquement le visuel et le placement.

## Zones à refaire dans `src/game/TaxiTycoon.tsx` (markup + bloc `<style>`)

### 1. Barre haute (top bar)
- Pilule gauche: rond avatar bois "?" + zone vide (pseudo) — fond noir/cuir, contour cuivré.
- Pilule centrale: ⏰ "météo…" • pièce dorée "0$" — pilule sombre, bord cuivré.
- Bouton cog: bouton bois rond seul à droite.
- Bloc info (sous pilule gauche): carte noire arrondie — `Mercredi 24 juin · 16:16`, point vert "Journée", `Pertuis · Densité ×0.72`.
- Logo central "MY TAXI WORLD" avec couronne orange dégradée — colonne centrée, deux lignes blanches, police condensée.
- Bouton "Missions [2]": pilule bois large à droite avec icône presse-papier et badge rouge.

### 2. Console basse (4 boutons bois)
Mêmes 4 boutons, mêmes labels, mais visuel renforcé:
- Cadres bois texturés (gradient brun + lisérés cuivrés + ombre interne).
- Icônes plus grandes (emoji centré, ~34px), texte blanc condensé centré, sans `<small>` (retirer les compteurs sous le label pour matcher l'image).
- Ordre: GÉRER FLOTTE 🚕 / AMÉLIORATIONS QG 🔧 / RADIO & MISSIONS 📻 / RIVALITÉ ⚔️.

### 3. Bandeau Profil Directeur
- Carte bois claire arrondie à gauche: rond "?" + `[NOM DU DIRECTEUR]` + barre verte de progression + `QG NIVEAU X (Y Capacité)`. Sous-label `PROFIL DIRECTEUR` en cuivré.
- Au centre: gros trophée doré 🏆 + label `CLASSEMENT MONDIAL` (bouton).
- À droite: portefeuille cuir marron "TUTO" + label `CONTRATS & MANUELS`.
- Sous le bandeau, ligne libellée `PSEUDO ───` pointant vers un stylo doré (icône décorative au centre-bas).

### 4. Barre outils inférieure
- Bouton vert/noir pilule à gauche: 🤖 `TÉLÉCHARGER L'APK`.
- Pilule sombre centrale (vide, futur slot).
- Petit losange brillant ✦ à droite (bouton mission spéciale réduit, sans label texte).

## CSS — refonte ciblée
Réécrire les blocs suivants dans le `<style>` du composant:
- `.tt-top-bar`, `.tt-top-pill`, `.tt-cog`, `.tt-info-card`, `.tt-logo`, `.tt-mission-wood`, `.tt-mission-badge`.
- `.tt-console`, `.tt-wood-btn` (retirer `small`), `.tt-director-band`, `.tt-director-profile`, `.tt-trophy`, `.tt-book`.
- `.tt-lower-tools`, `.tt-apk`, `.tt-pen`, `.tt-special-inline` (devient losange ✦ compact).
Tokens: bois `linear-gradient(#7a4a2b → #4a2b18)`, cuivré `#d8a55c`, vert progression `#34d399`, fond carte info `rgba(15,15,20,0.92)`.

## Ce qui reste inchangé
- Tous les handlers (`buyTaxi`, `setShopOpen`, `setMissionsOpen`, `setShowLeaderboard`, `setShowTutorial`, `repairTaxis`, `triggerSpecialMission`, navigation APK).
- Logique trafic / rivaux / missions / portail / map.
- Pas de nouveau fichier, pas de dépendance.

## Vérification
- Comparer visuellement avec la maquette (392×713) via Playwright screenshot après build.
- Confirmer que chaque bouton ouvre toujours son panneau (Flotte→achat, QG→shop, Radio→missionsOpen, Rivalité→leaderboard, Tuto→tutorial, APK→/download, ✒️→repair, ✦→special).
