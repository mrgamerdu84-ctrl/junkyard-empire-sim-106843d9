# Multijoueur temps réel mondial — My Taxi World Rivalité

## Mon avis franchement

**Oui, ça vaut le coup, mais avec un cadre précis.** Le vrai temps réel (voir la voiture adverse rouler sur ta carte) est techniquement lourd et coûteux en bande passante. Je propose un **"temps réel compétitif léger"** : tu joues ta partie, ton adversaire joue la sienne en simultané, et vous voyez en direct son score, ses courses terminées, son chrono, ses notifications ("Adversaire a terminé une course +52€"). C'est nerveux, ça pousse à jouer vite, et ça reste fluide.

Pour voir littéralement la voiture adverse rouler sur la même ville, il faudrait synchroniser positions 10 fois par seconde — possible mais ça change la nature du jeu (collisions ? blocage ?). À garder pour une V2 si la base marche.

## Ce que je propose pour la V1

### Modes de jeu
- **Match rapide mondial** : bouton "Trouver un adversaire", matchmaking automatique parmi les joueurs en attente
- **Durée fixe** : 5 min (rapide) ou 10 min (standard)
- **Objectif** : faire le plus de chiffre d'affaires en taxi pendant le temps imparti
- **Même seed de ville et même flux de clients** pour les deux joueurs → équitable
- **Écran de fin** : gagnant, scores, gains XP/€

### HUD pendant le match
- Bandeau adversaire en haut : pseudo, score live, courses terminées, écart
- Notifications discrètes : "🚕 Adversaire +47€", "⚡ Adversaire prend la tête"
- Compte à rebours commun

### Récompenses
- Victoire : +XP licence, +€ bonus
- Défaite : petit lot de consolation
- Classement ELO mondial (top 100 affiché)

## Détails techniques

### Backend (Lovable Cloud / Supabase)
Tables à créer :
- `mp_matches` : id, status (waiting/active/finished), seed, duration_sec, started_at, ended_at, winner_id
- `mp_match_players` : match_id, user_id, score, missions_completed, elo_before, elo_after
- `mp_match_events` : match_id, user_id, event_type, payload, created_at (pour le score live)
- `mp_queue` : user_id, duration_sec, joined_at (file d'attente matchmaking)
- `mp_elo` : user_id, rating, wins, losses, draws

### Realtime
- Souscription Supabase Realtime sur `mp_match_events` filtré par `match_id` → score adversaire en direct
- Souscription sur `mp_matches` → notification quand match passe à `active`/`finished`

### Server functions (TanStack `createServerFn` + `requireSupabaseAuth`)
- `joinMatchmaking({ duration })` : insère dans `mp_queue`, tente d'apparier avec un joueur en attente
- `submitMatchEvent({ matchId, type, amount })` : enregistre une course terminée (anti-triche : cap par seconde comme dans `submit_defi_run`)
- `finishMatch({ matchId })` : calcule gagnant, met à jour ELO, distribue récompenses
- `getLeaderboard()` : top 100 ELO

### Anti-triche
- Cap serveur : 1 course / 8s max (déjà fait dans `submit_defi_run`)
- Score recalculé serveur depuis le seed (le client envoie l'index de course, pas le montant)
- Match annulé si un joueur n'envoie aucun event pendant 60s (déconnexion)

### Frontend
- `src/game/multiplayer/MatchmakingScreen.tsx` : écran de recherche d'adversaire avec timer
- `src/game/multiplayer/MultiplayerHUD.tsx` : bandeau adversaire pendant la partie
- `src/game/multiplayer/MatchResultScreen.tsx` : écran de fin avec gagnant + ELO
- `src/game/multiplayer/LeaderboardScreen.tsx` : classement mondial
- Bouton "Multijoueur" sur `HomeScreen`

### Réutilisation
- Le système de `defis` existe déjà (asynchrone, 1v1 par pseudo) → on garde, et le mode mondial temps réel devient un nouveau mode parallèle

## Limites assumées de la V1
- Pas de voiture adverse visible sur la carte (V2)
- Pas de chat (V2, risque modération)
- Pas de parties privées avec amis (V2, tu n'en as pas demandé)
- Matchmaking simple par durée + ELO proche (pas de filtres avancés)

## Question avant que je code

**Durée des matchs** : je pars sur **5 min seulement** (plus simple, plus addictif, file d'attente plus rapide à remplir), ou tu veux **5 et 10 min au choix** ?

Si tu valides ce plan, je l'implémente en build mode.