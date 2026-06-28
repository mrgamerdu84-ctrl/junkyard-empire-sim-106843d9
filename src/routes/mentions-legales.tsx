import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/mentions-legales")({
  head: () => ({
    meta: [
      { title: "Mentions légales & confidentialité — My Taxi World : L'Empire des Rues" },
      {
        name: "description",
        content:
          "Politique de confidentialité du jeu My Taxi World : L'Empire des Rues : données collectées, utilisation, droits, suppression de compte.",
      },
      { property: "og:title", content: "Mentions légales & confidentialité — My Taxi World : L'Empire des Rues" },
      {
        property: "og:description",
        content:
          "Comment tes données sont utilisées, où elles sont stockées et comment supprimer ton compte.",
      },
    ],
  }),
  component: MentionsLegalesPage,
});

const CONTACT_EMAIL = "mrgamerdu84@gmail.com";

function MentionsLegalesPage() {
  return (
    <div className="ml-root">
      <style>{`
        .ml-root {
          min-height: 100vh;
          background: linear-gradient(180deg,#06070e 0%,#0c1018 100%);
          color: #e5e7eb;
          font-family: system-ui, -apple-system, sans-serif;
          padding: 32px 16px 80px;
        }
        .ml-wrap {
          max-width: 760px;
          margin: 0 auto;
        }
        .ml-back {
          display: inline-flex; align-items: center; gap: 6px;
          color: #f5c542; text-decoration: none;
          font-weight: 700; font-size: 14px;
          margin-bottom: 24px;
          padding: 8px 14px; border-radius: 8px;
          background: rgba(245,197,66,0.08);
          border: 1px solid rgba(245,197,66,0.25);
        }
        .ml-back:hover { background: rgba(245,197,66,0.15); }
        .ml-card {
          background: #14171c;
          border: 1px solid #2a2f38;
          border-radius: 14px;
          padding: 32px 28px;
          box-shadow: 0 14px 40px rgba(0,0,0,0.5);
        }
        .ml-card h1 {
          font-size: clamp(22px, 4vw, 30px);
          color: #f5c542;
          margin: 0 0 6px;
          letter-spacing: 0.5px;
        }
        .ml-card .ml-sub {
          color: #8a8e94; font-size: 13px;
          margin: 0 0 24px;
        }
        .ml-card h2 {
          color: #f5c542;
          font-size: 16px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin: 28px 0 10px;
          padding-top: 18px;
          border-top: 1px solid #2a2f38;
        }
        .ml-card h2:first-of-type { border-top: none; padding-top: 0; }
        .ml-card p, .ml-card li {
          font-size: 14.5px;
          line-height: 1.65;
          color: #c8ccd2;
        }
        .ml-card p { margin: 0 0 10px; }
        .ml-card ul { margin: 6px 0 12px; padding-left: 22px; }
        .ml-card li { margin-bottom: 4px; }
        .ml-card a { color: #fde047; text-decoration: underline; }
        .ml-card strong { color: #f5c542; }
        .ml-tip {
          background: #1f242b;
          border-left: 3px solid #f5c542;
          padding: 12px 14px;
          border-radius: 4px;
          margin: 10px 0;
          font-size: 14px;
          color: #d8dce2;
        }
        .ml-danger {
          background: rgba(127,29,29,0.25);
          border-left: 3px solid #ef4444;
          padding: 12px 14px;
          border-radius: 4px;
          margin: 10px 0;
          font-size: 14px;
          color: #fecaca;
        }
        .ml-foot {
          margin-top: 28px;
          padding-top: 18px;
          border-top: 1px solid #2a2f38;
          font-size: 12px;
          color: #8a8e94;
          text-align: center;
        }
      `}</style>

      <div className="ml-wrap">
        <Link to="/" className="ml-back">← Retour au jeu</Link>

        <div className="ml-card">
          <h1>📜 Mentions légales &amp; confidentialité</h1>
          <p className="ml-sub">
            My Taxi World : L'Empire des Rues — Politique de confidentialité &amp; informations légales.
          </p>

          <h2>Qui sommes-nous</h2>
          <p>
            <strong>My Taxi World : L'Empire des Rues</strong> est un jeu indépendant développé par un créateur passionné.
            Le jeu est gratuit et n'a pas de but commercial direct. Pour toute question, contacte&nbsp;:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>

          <h2>Données que l'on collecte</h2>
          <p>On collecte uniquement le strict nécessaire pour faire fonctionner ton compte et le classement&nbsp;:</p>
          <ul>
            <li><strong>Adresse email</strong> — pour créer ton compte et te reconnecter.</li>
            <li><strong>Pseudo</strong> et <strong>avatar</strong> — affichés en jeu et dans le classement.</li>
            <li><strong>Scores</strong> — pour le classement quotidien.</li>
            <li><strong>Sauvegarde de partie</strong> — stockée <em>localement</em> dans le navigateur (cash, taxis, QG…).</li>
          </ul>

          <h2>Comment on les utilise</h2>
          <p>Tes données servent <strong>uniquement</strong> à&nbsp;:</p>
          <ul>
            <li>te faire jouer et te reconnecter à ton compte ;</li>
            <li>afficher ton pseudo et avatar dans le classement ;</li>
            <li>sauvegarder ta progression entre deux sessions.</li>
          </ul>
          <div className="ml-tip">
            ✅ Pas de revente. Pas de pub. Pas de tracking publicitaire tiers.
            Tes données ne sont <strong>jamais</strong> partagées avec qui que ce soit.
          </div>

          <h2>Où sont stockées tes données</h2>
          <p>
            Les données de compte (email, pseudo, scores, avatar) sont stockées sur un backend sécurisé
            (Lovable Cloud). L'accès est limité au créateur du jeu, uniquement pour des raisons techniques
            (correction de bugs, modération).
          </p>
          <p>
            La sauvegarde de partie (ton cash, tes taxis, ton QG…) reste dans le <strong>localStorage</strong>{" "}
            de ton navigateur. Vider le cache du navigateur efface ta partie locale.
          </p>

          <h2>Tes droits</h2>
          <p>Conformément au RGPD, tu peux à tout moment&nbsp;:</p>
          <ul>
            <li><strong>Accéder</strong> à tes données depuis ton profil en jeu (☰ → Mon profil).</li>
            <li><strong>Modifier</strong> ton pseudo, ton avatar, ton nom de chauffeur depuis ton profil.</li>
            <li><strong>Supprimer</strong> définitivement ton compte (voir ci-dessous).</li>
            <li><strong>Demander une copie</strong> de tes données par email.</li>
          </ul>

          <h2>🗑️ Supprimer ton compte</h2>
          <p>
            Tu peux supprimer ton compte <strong>toi-même</strong>, à tout moment, sans avoir à le demander à personne&nbsp;:
          </p>
          <ul>
            <li>Ouvre le menu en jeu (☰) → <strong>Mon profil</strong>.</li>
            <li>Descends en bas de la carte → section <strong>« Zone dangereuse »</strong>.</li>
            <li>Clique sur <strong>« Supprimer mon compte »</strong> et confirme.</li>
          </ul>
          <div className="ml-danger">
            ⚠️ La suppression est <strong>immédiate et définitive</strong>. Ton compte, ton pseudo, ton avatar et tes scores
            sont effacés du backend et ne peuvent pas être récupérés.
          </div>
          <p>
            Si tu ne peux pas te connecter, écris-nous à{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> en précisant l'adresse email du compte à supprimer.
          </p>

          <h2>Cookies &amp; stockage local</h2>
          <p>Le jeu n'utilise <strong>aucun cookie publicitaire</strong>. On utilise uniquement&nbsp;:</p>
          <ul>
            <li>Une session de connexion (pour rester connecté entre deux visites).</li>
            <li>Le <strong>localStorage</strong> pour ta sauvegarde de partie et tes préférences (radio, son, etc.).</li>
          </ul>

          <h2>Mineurs</h2>
          <p>
            Le jeu est tout public. Si tu as moins de 15 ans, demande à tes parents avant de créer un compte avec
            une adresse email.
          </p>

          <h2>Contact</h2>
          <p>
            Pour toute question sur tes données personnelles ou pour exercer tes droits, écris-nous&nbsp;:
            <br />
            📧 <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>

          <div className="ml-foot">
            © 2026 My Taxi World : L'Empire des Rues — Tous droits réservés.
          </div>
        </div>
      </div>
    </div>
  );
}
