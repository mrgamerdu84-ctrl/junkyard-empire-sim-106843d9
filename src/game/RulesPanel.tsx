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
            <p>Fais prospérer ta compagnie de taxis. Tu hérites d'un garage délabré : achète des voitures, prends des clients, encaisse de l'argent et améliore ton QG pour devenir l'empire du taxi.</p>

            <h3>🚖 Les taxis</h3>
            <ul>
              <li>Tu achètes tes taxis depuis le menu en bas (bouton "Acheter taxi").</li>
              <li>Ils sortent automatiquement du QG dès qu'un client apparaît.</li>
              <li>Tu peux limiter combien de taxis circulent en même temps depuis le Panel Admin → onglet <b>Trafic</b>.</li>
            </ul>

            <h3>👥 Les clients</h3>
            <ul>
              <li>Ils apparaissent au bord des routes (point 📍 jaune = destination, point bleu = client en attente).</li>
              <li>Le taxi <b>le plus proche</b> est envoyé chercher le client.</li>
              <li>Le client a <b>35 secondes</b> de patience. Au-delà, il s'en va et tu perds la course.</li>
            </ul>

            <h3>💰 Les courses</h3>
            <ul>
              <li>Le tarif dépend de la <b>distance</b> entre le client et sa destination.</li>
              <li>Plus ton QG est avancé, plus les tarifs grimpent.</li>
              <li>L'argent tombe au moment où tu déposes le client.</li>
            </ul>

            <h3>🏛️ Le QG</h3>
            <p>5 niveaux d'évolution :</p>
            <ul>
              <li>🏚️ Garage abandonné — 1 taxi max</li>
              <li>🔧 Atelier rouillé — 2 taxis</li>
              <li>🏢 Garage rénové — 4 taxis</li>
              <li>🏬 Station moderne — 7 taxis</li>
              <li>🏛️ QG Taxicorp — 12 taxis, meilleurs tarifs</li>
            </ul>
            <p>Tu peux aussi <b>déplacer, agrandir et faire pivoter</b> ton QG depuis le Panel Admin → onglet <b>QG</b>.</p>

            <h3>📜 Les contrats</h3>
            <ul>
              <li>Missions optionnelles avec un objectif (servir X clients, gagner Y $, etc.) avant un délai.</li>
              <li>Récompense : cash bonus + <b>×2 sur les tarifs</b> pendant 20 secondes.</li>
            </ul>

            <h3>📻 Les radios du taxi</h3>
            <ul>
              <li>4 stations dispos depuis le bouton 📻 : musiques variées + <b>Junky Infos</b> en continu.</li>
              <li><b>Météo et heure réelles</b> annoncées à l'antenne selon ta position.</li>
              <li>Au début de chaque heure, <b>toutes les stations passent en mode "Infos" pendant 10 minutes</b>, puis la musique reprend.</li>
              <li>Junky Infos diffuse les infos en continu, avec un peu de musique entre deux flashs.</li>
            </ul>

            <h3>🏆 Classement &amp; profil</h3>
            <ul>
              <li>Crée un compte pour sauvegarder ton <b>pseudo</b>, ton <b>avatar</b> et tes scores en ligne.</li>
              <li>Choisis ton modèle de taxi et sa couleur depuis <b>Mon profil</b> (menu ☰).</li>
              <li>Le <b>permis</b> monte de niveau au fil des courses et débloque des clients VIP / STAR avec de meilleurs pourboires.</li>
            </ul>

            <h3>💡 Astuces</h3>
            <div className="rules-tip">
              • Limite les taxis actifs pour éviter les embouteillages.<br/>
              • Place ton QG près d'un croisement dense pour réduire les trajets à vide.<br/>
              • Améliore ton QG dès que possible : plus de taxis = plus de revenus.<br/>
              • Vise les contrats : le bonus ×2 paye vite tes upgrades.
            </div>

            <h3>🚧 Bientôt</h3>
            <ul>
              <li>Nouveaux modèles de véhicules et livrées exclusives.</li>
              <li>Événements météo dynamiques en jeu (pluie, nuit, embouteillages).</li>
              <li>Missions spéciales (urgences, VIP, défis chrono).</li>
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
