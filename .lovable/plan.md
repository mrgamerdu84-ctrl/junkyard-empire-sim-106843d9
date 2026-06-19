## 1. Mettre à jour les règles du jeu (`src/game/RulesPanel.tsx`)

Refonte du contenu du panneau 📖 :

- **Supprimer** toute la section « ⚙ Panel Admin » (réservée au créateur, ne doit pas apparaître pour les joueurs).
- **Ajouter** une nouvelle section « 📻 Radios » expliquant :
  - 4 stations dans le taxi (musiques + Junky Infos en continu)
  - Météo et heure réelles annoncées à l'antenne
  - Toutes les radios basculent en mode « Infos » la 1ʳᵉ moitié de chaque heure
- **Ajouter** une section « 🏆 Classement & profil » (pseudo, avatar, scores cloud).
- **Ajouter** une section « 🚧 Bientôt » avec quelques teasers (nouveaux véhicules, événements météo en jeu, missions spéciales — copie sobre, sans promesses datées).
- Garder But du jeu, Taxis, Clients, Courses, QG, Contrats, Astuces.
- Ajouter en bas un petit lien discret « 📜 Mentions légales & confidentialité » qui ouvre la nouvelle page.

## 2. Nouvelle page `/mentions-legales`

Nouveau fichier `src/routes/mentions-legales.tsx` avec :

- **Head SEO** dédié (title, description, og:title, og:description).
- Layout sombre cohérent avec l'app (mêmes couleurs jaune/sombre que `RulesPanel`).
- Bouton « ← Retour » qui ramène à `/`.

**Sections de la page :**

1. **Qui sommes-nous** — jeu indépendant, contact email du créateur.
2. **Données collectées** — uniquement :
   - email (compte)
   - pseudo + avatar (affichage)
   - scores de jeu (classement)
   - sauvegarde de partie locale (navigateur)
3. **Comment on les utilise** — uniquement pour faire fonctionner le compte, afficher le classement et te reconnecter. Pas de revente, pas de pub, pas de tracking tiers.
4. **Où sont stockées les données** — backend sécurisé (Lovable Cloud), accès limité au créateur.
5. **Tes droits** — accès, modification du pseudo/avatar depuis « Mon profil », suppression du compte (bouton dans le profil ou via email).
6. **Suppression du compte** — explique que le bouton « 🗑️ Supprimer mon compte » dans Mon profil efface immédiatement et définitivement le compte, le pseudo, l'avatar et les scores cloud.
7. **Cookies / stockage local** — uniquement la sauvegarde du jeu et la session de connexion, aucun cookie publicitaire.
8. **Contact** — email pour toute question RGPD.
9. **Date de mise à jour**.

## 3. Lien dans le menu en jeu (`src/game/GameMenu.tsx`)

Ajouter un bouton discret « 📜 Mentions légales » avant le bouton « Fermer », qui navigue vers `/mentions-legales`.

## 4. Bouton « Supprimer mon compte » dans le profil (`src/components/ProfileCard.tsx`)

- Ajouter en bas de la carte profil une section « Zone dangereuse » avec un bouton rouge « 🗑️ Supprimer mon compte ».
- Au clic : modale de confirmation qui demande de taper le pseudo pour confirmer.
- Côté serveur : nouvelle server function `deleteOwnAccount` (`src/lib/account.functions.ts`) protégée par `requireSupabaseAuth` qui :
  1. supprime le profil + scores liés dans les tables `profiles` et `scores` (via service role, après vérif de l'identité du caller)
  2. appelle `supabase.auth.admin.deleteUser(userId)` pour supprimer le compte auth
- Après suppression : déconnexion, retour à l'accueil, message « Compte supprimé ».

## 5. Version

Bump `public/version.json` → `1.15.0`, changelog : « Règles à jour (radios, classement), mentions légales & confidentialité, suppression de compte ».

## Détails techniques

- Page `/mentions-legales` = simple route TanStack Start (`createFileRoute("/mentions-legales")`) avec contenu statique JSX, accessible sans login.
- Server function `deleteOwnAccount` placée dans `src/lib/account.functions.ts` (client-safe path), avec le client admin importé dynamiquement à l'intérieur du `.handler()` pour rester côté serveur uniquement.
- Tables ciblées par la suppression : `profiles`, `scores` (les autres tables référencent `auth.users(id)` avec `ON DELETE CASCADE` ou seront nettoyées par cascade).
- Aucun changement de schéma DB nécessaire.

## Questions / hypothèses

- J'utilise une **adresse email de contact générique** dans la page (placeholder `contact@…`) — dis-moi ton vrai email pour que je le mette, sinon je laisse un placeholder visible.
- La copie « Bientôt » dans les règles reste vague (« nouveaux véhicules, événements, missions ») — sans dates ni promesses fermes.
