import { useState } from "react";
import { Link } from "@tanstack/react-router";


/* Bouton 📖 + overlay des règles du jeu. */
export default function RulesPanel() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <style>{`
        .rules-btn {
          position: absolute; top: 14px; right: 66px; z-index: 50;
          width: 44px; height: 44px; border-radius: 50%; border: none;
          background: rgba(20,22,28,0.85); color: #f5c542; font-size: 20px;
          cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(8px);
        }
        .rules-btn:hover { background: rgba(40,42,50,0.95); }
        .rules-overlay {
          position: absolute; inset: 0; z-index: 60;
          background: rgba(0,0,0,0.7);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
        }
        .rules-card {
          background: #14171c; color: #e8edf2;
          border: 1px solid #2a2f38; border-radius: 12px;
          width: min(520px, 100%); max-height: 90vh; overflow-y: auto;
          box-shadow: 0 12px 48px rgba(0,0,0,0.6);
          padding: 22px 24px 28px;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .rules-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .rules-h h2 { margin: 0; font-size: 20px; color: #f5c542; letter-spacing: 0.5px; }
        .rules-close { background: transparent; border: none; color: #8a8e94; font-size: 26px; cursor: pointer; line-height: 1; }
        .rules-card h3 {
          margin: 18px 0 6px; font-size: 14px; color: #f5c542;
          letter-spacing: 0.4px; text-transform: uppercase;
        }
        .rules-card p { margin: 0 0 6px; font-size: 13.5px; line-height: 1.55; color: #c8ccd2; }
        .rules-card ul { margin: 4px 0 6px; padding-left: 20px; }
        .rules-card li { font-size: 13.5px; line-height: 1.55; color: #c8ccd2; margin-bottom: 3px; }
        .rules-tip {
          background: #1f242b; border-left: 3px solid #f5c542;
          padding: 10px 12px; border-radius: 4px; margin-top: 6px;
          font-size: 13px; color: #d8dce2;
        }
      `}</style>

      {!open && (
        <button className="rules-btn" onClick={() => setOpen(true)} aria-label="Règles du jeu" title="Règles du jeu">📖</button>
      )}

      {open && (
        <div className="rules-overlay" onClick={() => setOpen(false)}>
          <div className="rules-card" onClick={(e) => e.stopPropagation()}>
            <div className="rules-h">
              <h2>📖 Règles du jeu</h2>
              <button className="rules-close" onClick={() => setOpen(false)} aria-label="Fermer">×</button>
            </div>

            <h3>🎯 But du jeu</h3>
            <p>Tu diriges <b>My Taxi World : L'Empire des Rues</b> : une compagnie de taxis qui doit grandir tout en repoussant la <b>Mafia</b> qui veut t'éliminer. Embauche, encaisse, détruis les saboteurs, détourne le camion blindé du Parrain — et deviens la légende de la ville.</p>

            <h3>🏢 Ton QG (entrepôt jaune)</h3>
            <ul>
              <li>Au centre de la ville. Tous tes taxis y dorment.</li>
              <li><b>Clique sur l'entrepôt</b> pour rappeler instantanément toute la flotte (utile en cas de raid Mafia).</li>
              <li>Tu peux le <b>déplacer et le faire pivoter</b> depuis le Panel Admin → onglet <b>QG</b>.</li>
            </ul>

            <h3>👥 Équipe (bouton ÉQUIPE)</h3>
            <ul>
              <li>Chaque <b>Chauffeur</b> embauché débloque +1 taxi qui sort automatiquement en course.</li>
              <li><b>Mécano</b> : réduit le coût d'entretien.</li>
              <li><b>Manager</b> : bonus sur les revenus globaux.</li>
              <li><b>Secrétaire</b> : +8% sur le prix de chaque course (max 2).</li>
            </ul>

            <h3>🚖 Auto-dispatch</h3>
            <ul>
              <li>Un client apparaît (point bleu) → le taxi le plus proche est envoyé tout seul.</li>
              <li>Flèche bleue = prise en charge. Flèche orange = destination.</li>
              <li>L'argent tombe à la dépose. Si le client expire, la course est perdue (pas de pénalité).</li>
            </ul>

            <h3>🕹️ Mode PILOTE manuel</h3>
            <p>Le bouton rose <b>PILOTE</b> du tableau de bord fait apparaître un taxi spécial que tu conduis <b>au doigt</b> directement sur la carte. Utile pour les courses stratégiques ou pour escorter le camion blindé.</p>

            <h3>⚠️ La menace Mafia</h3>
            <ul>
              <li>Des <b>voitures noires</b> roulent dans la ville et tentent de saboter tes taxis pendant leurs courses.</li>
              <li><b>Clique vite dessus</b> pour les faire exploser avant qu'elles ne t'atteignent.</li>
              <li>Plus ton empire grossit, plus la Mafia s'acharne.</li>
            </ul>

            <h3>🚚 Camion blindé du Parrain</h3>
            <ul>
              <li>Périodiquement, la Mafia transporte son butin vers son dépôt — escorté par ses voitures.</li>
              <li><b>Intercepte le camion</b> et ramène-le à TON QG pour empocher le magot.</li>
              <li>La Mafia envoie 10 voitures pour le récupérer : <b>aucune ne doit arriver à ton entrepôt</b>, sinon tu perds.</li>
            </ul>

            <h3>🎩 Rançon du Parrain</h3>
            <ul>
              <li>Le Parrain te propose une <b>trêve de 1h</b> contre <b>1 500 $</b>.</li>
              <li><b>Accepter</b> → tranquillité une heure (badge TRÊVE sur le dashboard).</li>
              <li><b>Refuser</b> → <span style={{ color: "#f87171" }}>RAID immédiat</span> : 10 voitures Mafia foncent sur ton QG. Détruis-les toutes pour survivre.</li>
            </ul>

            <h3>📻 Radio &amp; Contrats</h3>
            <ul>
              <li>Deux stations : <b>Célébrer Radio</b> (musiques libres) et <b>Droit Libre</b> (rotation du jeu).</li>
              <li>Bouton CONTRATS pour les missions spéciales chronométrées avec bonus.</li>
            </ul>

            <h3>⚔️ Arène Mondiale (multijoueur)</h3>
            <p>Défie d'autres compagnies en temps réel via Supabase Realtime, classement ELO mondial. Fair-play obligatoire : pas de triche, pas d'insulte.</p>

            <h3>🪪 Profil joueur</h3>
            <ul>
              <li>Pseudo, avatar, photo, modèle de taxi, couleur — tout est sync entre tes appareils.</li>
              <li>Le <b>permis</b> monte avec les courses et débloque les clients VIP / STAR (meilleurs pourboires).</li>
            </ul>

            <h3>💡 Astuces</h3>
            <div className="rules-tip">
              • Embauche au moins 3 chauffeurs avant de provoquer la Mafia.<br/>
              • Garde toujours 1 500 $ d'avance pour la rançon — ça évite les raids.<br/>
              • Le mode PILOTE est imbattable pour escorter le camion blindé.<br/>
              • Clique l'entrepôt = recall d'urgence quand un raid tourne mal.
            </div>

            <h3>🚧 Bientôt</h3>
            <ul>
              <li>Extension de la ville vers le nord (route en travaux à côté du QG).</li>
              <li>Nouveaux véhicules Mafia et boss exclusifs.</li>
              <li>Événements saisonniers et défis quotidiens.</li>
            </ul>

            <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid #2a2f38", textAlign: "center" }}>
              <Link
                to="/mentions-legales"
                style={{ color: "#8a8e94", fontSize: 12, textDecoration: "underline" }}
                onClick={() => setOpen(false)}
              >
                📜 Mentions légales &amp; confidentialité
              </Link>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
