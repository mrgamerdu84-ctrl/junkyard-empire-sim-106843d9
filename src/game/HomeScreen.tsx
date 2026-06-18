import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import bgAsset from "@/assets/home-bg.png.asset.json";
import { UpdateNotification } from "@/components/UpdateNotification";
import TutorialDialog from "@/components/TutorialDialog";
import LeaderboardPanel from "@/components/LeaderboardPanel";
import { hasSeenTutorial, resetTutorial, getPlayerName, setPlayerName, pushLocalScoresToCloud } from "@/lib/leaderboard";
import { useAuth, signOut } from "@/lib/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function HomeScreen({ onPlay }: { onPlay: () => void }) {
  const navigate = useNavigate();
  const { user, pseudo: cloudPseudo } = useAuth();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showPseudo, setShowPseudo] = useState(false);
  const [pseudoInput, setPseudoInput] = useState(getPlayerName());
  const [displayName, setDisplayName] = useState(getPlayerName());

  // Pseudo affiché : cloud si connecté, sinon local
  const effectiveName = user ? cloudPseudo : displayName;

  // Quand on se connecte, on pousse les scores locaux vers le cloud
  useEffect(() => {
    if (user) pushLocalScoresToCloud().catch(() => {});
  }, [user]);

  // Premier lancement → tuto auto
  useEffect(() => {
    if (!hasSeenTutorial()) setShowTutorial(true);
  }, []);



  useEffect(() => {
    if (!loading) return;
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 12 + 3;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
        setTimeout(() => onPlay(), 400);
      }
      setProgress(p);
    }, 200);
    return () => clearInterval(interval);
  }, [loading, onPlay]);

  if (loading) {
    return (
      <div className="hs-root">
        <style>{`
          .hs-root {
            position: fixed; inset: 0; z-index: 9999;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            background: linear-gradient(180deg, #1a1f2e 0%, #0a0c10 100%);
            overflow: hidden;
            font-family: system-ui, -apple-system, sans-serif;
          }
          .hs-load-car { width: 120px; height: auto; animation: hsBounce 0.6s infinite alternate ease-in-out; }
          .hs-load-track { width: 200px; height: 4px; background: #2a2d35; border-radius: 2px; margin-top: 32px; overflow: hidden; }
          .hs-load-fill { height: 100%; background: linear-gradient(90deg, #f5c542, #fde047); border-radius: 2px; transition: width 0.2s ease; }
          .hs-load-text { margin-top: 16px; color: #9ca3af; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; }
          .hs-load-dots::after { content: ''; animation: hsDots 1.5s infinite; }
          @keyframes hsBounce { from { transform: translateY(0); } to { transform: translateY(-10px); } }
          @keyframes hsDots { 0%{content:''} 33%{content:'.'} 66%{content:'..'} 100%{content:'...'} }
        `}</style>
        <svg className="hs-load-car" viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="60" cy="64" rx="44" ry="4" fill="#000" opacity="0.4" />
          <path d="M 18 55 L 18 40 Q 18 32 26 30 L 42 26 Q 50 15 62 14 L 88 14 Q 100 15 108 26 L 114 30 Q 120 32 120 40 L 120 55 Z"
                fill="#f5c542" stroke="#1a1208" strokeWidth="2" strokeLinejoin="round" />
          <path d="M 48 28 L 58 18 L 82 18 L 92 28 Z" fill="#7dd3fc" stroke="#1a1208" strokeWidth="1.5" opacity="0.85" />
          <circle cx="38" cy="56" r="9" fill="#0a0c10" stroke="#1a1208" strokeWidth="2" />
          <circle cx="92" cy="56" r="9" fill="#0a0c10" stroke="#1a1208" strokeWidth="2" />
          <rect x="52" y="38" width="18" height="7" fill="#1a1208" rx="1" />
          <text x="61" y="43.5" fontSize="5" fontWeight="900" textAnchor="middle" fill="#fde047">TAXI</text>
        </svg>
        <div className="hs-load-track">
          <div className="hs-load-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="hs-load-text">Chargement<span className="hs-load-dots" /> {Math.floor(progress)}%</div>
      </div>
    );
  }

  return (
    <div className="hs-home">
      <style>{`
        .hs-home {
          position: fixed; inset: 0; z-index: 9999;
          background: #0a0c10 url('${bgAsset.url}') center center / cover no-repeat;
          font-family: system-ui, -apple-system, sans-serif;
          overflow: hidden;
        }
        .hs-btns {
          position: absolute;
          left: 50%; bottom: 6vh;
          transform: translateX(-50%);
          display: flex; flex-direction: column; gap: 14px;
          width: min(280px, 70vw);
          z-index: 2;
        }
        .hs-btn {
          appearance: none; border: none; cursor: pointer;
          background: linear-gradient(180deg, #f5c542 0%, #e0a92a 100%);
          color: #1a1208;
          font-size: clamp(18px, 4.5vw, 22px);
          font-weight: 900;
          letter-spacing: 1px;
          padding: 14px 0;
          width: 100%;
          border-radius: 14px;
          box-shadow: 0 6px 0 #8a6510, 0 12px 20px rgba(0,0,0,0.5);
          transition: transform 0.08s, box-shadow 0.08s, filter 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          text-transform: uppercase;
        }
        .hs-btn:active {
          transform: translateY(4px);
          box-shadow: 0 2px 0 #8a6510, 0 4px 8px rgba(0,0,0,0.4);
        }
        .hs-apk-icon { width: 22px; height: 22px; fill: #1a1208; }
        .hs-name-badge {
          text-align: center;
          color: #f5c542;
          font-weight: 900;
          font-size: 16px;
          text-shadow: 0 2px 4px rgba(0,0,0,0.6);
          margin-bottom: 2px;
        }
        .hs-pseudo-overlay {
          position: fixed; inset: 0; z-index: 11000;
          background: rgba(0,0,0,0.7);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
        }
        .hs-pseudo-card {
          background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
          border: 2px solid #f5c542;
          border-radius: 16px;
          max-width: 360px; width: 100%;
          padding: 24px;
          display: flex; flex-direction: column; gap: 16px;
        }
        .hs-pseudo-title {
          color: #f5c542; font-size: 20px; font-weight: 900;
          margin: 0; text-align: center;
        }
        .hs-pseudo-input {
          width: 100%;
          background: #0a0c10;
          border: 2px solid #374151;
          border-radius: 10px;
          padding: 12px 14px;
          color: #fff;
          font-size: 18px;
          font-weight: 700;
          outline: none;
          box-sizing: border-box;
        }
        .hs-pseudo-input:focus { border-color: #f5c542; }
        .hs-pseudo-actions {
          display: flex; gap: 10px; justify-content: flex-end;
        }
        .hs-pseudo-btn {
          appearance: none; border: none; cursor: pointer;
          background: linear-gradient(180deg, #f5c542 0%, #e0a92a 100%);
          color: #1a1208;
          font-weight: 900;
          padding: 10px 18px;
          border-radius: 10px;
          font-size: 16px;
        }
        .hs-pseudo-secondary {
          background: #374151; color: #fff;
        }
      `}</style>

      <UpdateNotification />

      <div className="hs-btns">
        {displayName !== "Chauffeur" && (
          <div className="hs-name-badge">👤 {displayName}</div>
        )}
        <button className="hs-btn" onClick={() => setLoading(true)}>
          Jouer ▶
        </button>
        <button className="hs-btn" onClick={() => setShowLeaderboard(true)}>
          🏆 Classement
        </button>
        <button className="hs-btn" onClick={() => { resetTutorial(); setShowTutorial(true); }}>
          📖 Tuto
        </button>
        <button className="hs-btn" onClick={() => { setPseudoInput(getPlayerName()); setShowPseudo(true); }}>
          ✏️ Pseudo
        </button>
        <button
          className="hs-btn"
          onClick={() => {
            window.location.href = "/download";
          }}
        >
          <svg className="hs-apk-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.6 9.48l1.84-3.2c.16-.27.07-.62-.2-.78-.27-.16-.62-.07-.78.2l-1.87 3.24c-1.52-.68-3.22-1.06-5.02-1.06-1.8 0-3.5.38-5.02 1.06L4.84 5.7c-.16-.27-.51-.36-.78-.2-.27.16-.36.51-.2.78l1.84 3.2C2.8 11.36 1 14.44 1 18h22c0-3.56-1.8-6.64-4.4-8.52zM7 15.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25zm10 0c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z"/>
          </svg>
          APK
        </button>
      </div>

      {showTutorial && <TutorialDialog onClose={() => setShowTutorial(false)} />}
      {showLeaderboard && <LeaderboardPanel onClose={() => setShowLeaderboard(false)} />}

      {showPseudo && (
        <div className="hs-pseudo-overlay">
          <div className="hs-pseudo-card">
            <h3 className="hs-pseudo-title">✏️ Ton pseudo</h3>
            <input
              className="hs-pseudo-input"
              type="text"
              maxLength={16}
              value={pseudoInput}
              onChange={(e) => setPseudoInput(e.target.value)}
              placeholder="Chauffeur"
              onKeyDown={(e) => { if (e.key === "Enter") { setPlayerName(pseudoInput); setDisplayName(getPlayerName()); setShowPseudo(false); } }}
            />
            <div className="hs-pseudo-actions">
              <button className="hs-pseudo-btn hs-pseudo-secondary" onClick={() => setShowPseudo(false)}>Annuler</button>
              <button
                className="hs-pseudo-btn"
                onClick={() => { setPlayerName(pseudoInput); setDisplayName(getPlayerName()); setShowPseudo(false); }}
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

