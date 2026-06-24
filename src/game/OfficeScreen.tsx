import { useState } from "react";
import bureauBg from "@/assets/decor_bureau_realiste.jpg";
import LeaderboardPanel from "@/components/LeaderboardPanel";
import TutorialDialog from "@/components/TutorialDialog";
import ProfileCard from "@/components/ProfileCard";
import { getPlayerName, setPlayerName } from "@/lib/leaderboard";

type Props = { onPlay: () => void };

type Panel = null | "pseudo" | "profile" | "leaderboard" | "arena" | "tutorial";

export default function OfficeScreen({ onPlay }: Props) {
  const [panel, setPanel] = useState<Panel>(null);
  const [pseudo, setPseudo] = useState(getPlayerName());
  const [draft, setDraft] = useState(pseudo);

  const savePseudo = () => {
    const v = draft.trim().slice(0, 20) || "Mrgamerdu084";
    setPlayerName(v);
    setPseudo(v);
    setPanel(null);
  };

  return (
    <div className="os-root">
      <style>{`
        .os-root{position:fixed;inset:0;background:#0a0a0a;overflow:hidden;font-family:system-ui,sans-serif;}
        .os-bg{position:absolute;inset:0;background:url(${bureauBg}) center/cover no-repeat;}
        .os-stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;}
        /* Moniteur central : zone calée sur le grand écran incurvé du décor */
        .os-monitor{
          position:absolute;
          left:34%;top:18%;width:38%;height:42%;
          background:linear-gradient(180deg,#0b1a14 0%, #07120d 100%);
          border:2px solid #1f3a2c;
          border-radius:14px;
          box-shadow:inset 0 0 60px rgba(0,255,170,0.08), 0 0 30px rgba(0,255,170,0.15);
          padding:14px 16px;
          display:flex;flex-direction:column;gap:10px;
          overflow:hidden;
        }
        .os-monitor::before{
          content:"";position:absolute;inset:0;pointer-events:none;
          background:repeating-linear-gradient(0deg, rgba(0,255,170,0.04) 0 2px, transparent 2px 4px);
        }
        .os-title{
          font-family:'Courier New',monospace;color:#7CFFB2;font-weight:900;
          font-size:13px;letter-spacing:1px;text-shadow:0 0 8px #00ff99;
          text-align:center;
        }
        .os-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;flex:1;}
        .os-btn{
          background:linear-gradient(180deg,#10221a,#081410);
          border:1px solid #2dd4a8;color:#7CFFB2;
          font-family:'Courier New',monospace;font-weight:800;
          font-size:11px;letter-spacing:1px;border-radius:6px;
          cursor:pointer;padding:6px 8px;
          text-shadow:0 0 6px rgba(45,212,168,0.6);
          transition:transform .08s, background .15s;
        }
        .os-btn:hover{background:linear-gradient(180deg,#163228,#0c1a14);}
        .os-btn:active{transform:translateY(1px);}
        .os-btn.play{
          grid-column:1/-1;
          background:linear-gradient(180deg,#f5c542,#e0a92a);
          color:#1a1208;border-color:#fde047;
          font-size:14px;text-shadow:none;
        }
        .os-pseudo-tag{
          font-family:'Courier New',monospace;color:#9ad9bb;font-size:10px;
          text-align:center;opacity:.85;
        }

        /* Biper droite */
        .os-beeper{
          position:absolute;right:3%;top:22%;width:18%;min-width:180px;max-width:240px;
          background:linear-gradient(180deg,#2a2a2a,#1a1a1a);
          border:2px solid #444;border-radius:10px;
          box-shadow:0 10px 30px rgba(0,0,0,.6);
          padding:10px;display:flex;flex-direction:column;gap:8px;
          color:#cfd;font-family:'Courier New',monospace;
        }
        .os-beeper h4{margin:0;font-size:10px;color:#9cf;letter-spacing:1px;}
        .os-beeper-screen{
          background:#0b1410;border:1px solid #1f3a2c;border-radius:6px;
          padding:8px;color:#7CFFB2;font-size:11px;
          box-shadow:inset 0 0 12px rgba(0,255,170,.15);
        }
        .os-radio-row{display:flex;gap:4px;}
        .os-radio-btn{
          flex:1;background:#222;border:1px solid #555;color:#fff;
          border-radius:4px;font-size:11px;padding:4px;cursor:pointer;
        }
        .os-radio-btn.rec{color:#f55;}

        /* Modale */
        .os-modal{
          position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:50;
          display:flex;align-items:center;justify-content:center;padding:16px;
        }
        .os-card{
          background:#111;border:1px solid #333;border-radius:12px;
          padding:18px;max-width:380px;width:100%;color:#fff;
          box-shadow:0 20px 60px rgba(0,0,0,.7);
        }
        .os-input{
          width:100%;padding:10px 12px;border-radius:8px;
          background:#000;color:#fff;border:1px solid #444;
          font-size:14px;margin:10px 0;
        }
        .os-row{display:flex;gap:8px;justify-content:flex-end;}
        .os-row button{
          padding:8px 14px;border-radius:8px;border:1px solid #444;
          background:#1f1f1f;color:#fff;cursor:pointer;font-weight:700;
        }
        .os-row button.primary{background:#f5c542;color:#1a1208;border-color:#fde047;}

        @media (max-width: 720px){
          .os-monitor{left:6%;right:6%;top:10%;width:auto;height:46%;}
          .os-beeper{right:50%;transform:translateX(50%);top:auto;bottom:4%;width:80%;max-width:320px;}
        }
      `}</style>

      <div className="os-bg" />
      <div className="os-stage">
        <div className="os-monitor" role="region" aria-label="Hub principal">
          <div className="os-title">▣ MY TAXI WORLD — CENTRE DE COMMANDE ▣</div>
          <div className="os-pseudo-tag">Directeur : {pseudo}</div>
          <div className="os-grid">
            <button className="os-btn play" onClick={onPlay}>▶ JOUER</button>
            <button className="os-btn" onClick={() => setPanel("arena")}>🌐 ARÈNE</button>
            <button className="os-btn" onClick={() => setPanel("leaderboard")}>🏆 CLASSEMENT</button>
            <button className="os-btn" onClick={() => setPanel("tutorial")}>🎓 TUTO</button>
            <button className="os-btn" onClick={() => setPanel("profile")}>👤 MON PROFIL</button>
            <button className="os-btn" onClick={() => { setDraft(pseudo); setPanel("pseudo"); }}>✏️ MON PSEUDO</button>
          </div>
        </div>

        <aside className="os-beeper" aria-label="Biper Motorola">
          <h4>📟 MOTOROLA — MISSIONS</h4>
          <div className="os-beeper-screen">
            M. Martin • 45$ • 12s<br/>
            <span style={{color:'#ffb84d'}}>Course prioritaire en attente</span>
          </div>
          <h4>💬 MESSAGES — LÉO</h4>
          <div className="os-beeper-screen">
            « Patron, lance la flotte ! »
          </div>
          <h4>📻 RADIO — Pop Station</h4>
          <div className="os-beeper-screen" style={{textAlign:'center'}}>♪ Florent Pagny ♪</div>
          <div className="os-radio-row">
            <button className="os-radio-btn rec">●</button>
            <button className="os-radio-btn">⏮</button>
            <button className="os-radio-btn">■</button>
            <button className="os-radio-btn">⏭</button>
          </div>
        </aside>
      </div>

      {panel === "pseudo" && (
        <div className="os-modal" onClick={() => setPanel(null)}>
          <div className="os-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{margin:'0 0 8px'}}>Mon Pseudo</h3>
            <input
              className="os-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={20}
              placeholder="Mrgamerdu084"
              autoFocus
            />
            <div className="os-row">
              <button onClick={() => setPanel(null)}>Annuler</button>
              <button className="primary" onClick={savePseudo}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {panel === "leaderboard" && <LeaderboardPanel onClose={() => setPanel(null)} />}
      {panel === "arena" && <LeaderboardPanel onClose={() => setPanel(null)} />}
      {panel === "tutorial" && <TutorialDialog onClose={() => setPanel(null)} />}
      {panel === "profile" && (
        <div className="os-modal" onClick={() => setPanel(null)}>
          <div className="os-card" onClick={(e) => e.stopPropagation()}>
            <ProfileCard onClose={() => setPanel(null)} />
            <div className="os-row" style={{marginTop:12}}>
              <button onClick={() => setPanel(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
