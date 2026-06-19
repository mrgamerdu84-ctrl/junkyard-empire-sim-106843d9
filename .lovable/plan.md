## Objectif
Ajouter un système de **permis chauffeur** avec niveaux qui débloquent des clients VIP / Star, refondre la carte profil (deux champs distincts : nom du chauffeur + pseudo) et corriger l'enregistrement du pseudo.

## 1. Permis chauffeur (système de progression)

Ajout d'un permis qui monte en niveau avec l'XP gagnée à chaque course.

**Paliers proposés :**

```text
Niv. 1  — Apprenti       (0 XP)        clients standard
Niv. 2  — Confirmé       (200 XP)      clients standard
Niv. 3  — Professionnel  (600 XP)      🥈 débloque clients VIP (+50% pourboire)
Niv. 4  — Élite          (1500 XP)     🥇 débloque clients STAR (+100% pourboire, courses longues)
Niv. 5  — Légende        (3500 XP)     ⭐ taxi doré + VIP & STAR plus fréquents
```

- **XP** : +10 par course terminée, bonus +5 si course longue, +10 si client VIP, +20 si client STAR.
- **Probabilité d'apparition** : VIP à 5% dès niv. 3 (10% à niv. 5), STAR à 2% dès niv. 4 (5% à niv. 5).
- Clients VIP/STAR utilisent les sprites existants avec un halo doré/violet et un libellé "VIP" / "★".

## 2. Carte profil — refonte

Deux cases clairement séparées en haut de la carte :

```text
┌──────────────────────────────┐
│ 🪪 Chauffeur                  │
│ [ Jean Dupont          ]     │  ← nom (affichage carte pro)
│                              │
│ Pseudo (visible en jeu)      │
│ [ TaxiKing             ]     │  ← pseudo
└──────────────────────────────┘
```

Plus, sous l'avatar, le bloc **Permis** :

```text
🪪 PERMIS — Niv. 3 Professionnel
[██████████░░░░░] 720 / 1500 XP
🥈 Clients VIP débloqués
```

## 3. Correction enregistrement du pseudo

Le bouton "Enregistrer" utilise `.update()` qui échoue silencieusement si la ligne profile n'existe pas encore (cas connu sur certaines connexions Google). Passage à `.upsert({ id, ... })` + affichage clair de l'erreur si elle remonte.

## Détails techniques

- **Migration DB** sur `public.profiles` :
  - `driver_name text` (nom du chauffeur affiché sur la carte pro)
  - `license_level int not null default 1`
  - `license_xp int not null default 0`
- **Fonction RPC** `add_license_xp(amount int)` sécurisée (SECURITY DEFINER, scope `auth.uid()`) qui ajoute l'XP et recalcule le niveau côté serveur (anti-triche basique).
- **Client** :
  - `useAuth.ts` : ajout de `driverName`, `licenseLevel`, `licenseXp` dans le state.
  - `ProfileCard.tsx` : 2 champs (driver_name + pseudo), bloc permis avec barre de progression, upsert au lieu d'update.
  - `TaxiTycoon.tsx` : appel `add_license_xp` à la fin de chaque course, génération aléatoire de clients VIP/STAR selon le niveau.

## À confirmer
- OK avec les paliers d'XP proposés ou tu préfères des valeurs différentes (plus rapide / plus long) ?
- Le **nom du chauffeur** est libre (le joueur tape ce qu'il veut) ou tu veux qu'on récupère le vrai nom du compte Google ?