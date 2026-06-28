import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import bgAssetV2 from "@/assets/menu-bg-v2.jpg";
import { UpdateNotification } from "@/components/UpdateNotification";
import TutorialDialog from "@/components/TutorialDialog";
import LeaderboardPanel from "@/components/LeaderboardPanel";
import ProfileCard, { resolveAvatarSrc } from "@/components/ProfileCard";
import { hasSeenTutorial, resetTutorial, getPlayerName, setPlayerName, pushLocalScoresToCloud } from "@/lib/leaderboard";
import { useAuth, signOut } from "@/lib/useAuth";
import { supabase } from "@/integrations/supabase/client";
import LoadingScreen from "./LoadingScreen";

export default function HomeScreen({ onPlay, onReplayIntro }: { onPlay: () => void; onReplayIntro?: () => void }) {
  const navigate = useNavigate();
  const { user, pseudo: cloudPseudo, avatarKind, avatarUrl } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showPseudo, setShowPseudo] = useState(false);
  const [showTrialEnded, setShowTrialEnded] = useState(false);
  const [pseudoInput, setPseudoInput] = useState(getPlayerName());
  const [displayName, setDisplayName] = useState(getPlayerName());
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminErr, setAdminErr] = useState("");
  const [titleTaps, setTitleTaps] = useState(0);
  const [lastTap, setLastTap] = useState(0);

  // Période d'essai 7 jours pour le pseudo local
  const TRIAL_MS = 7 * 24 * 60 * 60 * 1000;
  const trialStart = (() => {
    try {
      let v = localStorage.getItem("pseudo_trial_start");
      if (!v) {
        v = String(Date.now());
        localStorage.setItem("pseudo_trial_start", v);
      }
      return parseInt(v, 10);
    } catch { return Date.now(); }
  })();
  const trialExpired = !user && Date.now() - trialStart > TRIAL_MS;
  const daysLeft = Math.max(0, Math.ceil((TRIAL_MS - (Date.now() - trialStart)) / (24 * 60 * 60 * 1000)));

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
    return <LoadingScreen progress={progress} />;
  }

  return (
    <div className="hs-home">
      <style>{`
        .hs-home {
          position: fixed; inset: 0; z-index: 9999;
          background: #0a0c10 url('${bgAssetV2}') center center / cover no-repeat;
          background-attachment: fixed;
          font-family: system-ui, -apple-system, sans-serif;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
        }
        .hs-home::before {
          content: ""; position: fixed; inset: 0;
          background: linear-gradient(180deg, rgba(10,12,16,0.35) 0%, rgba(10,12,16,0.7) 55%, rgba(10,12,16,0.96) 100%);
          z-index: 1; pointer-events: none;
        }
        .hs-scroll {
          position: relative; z-index: 2;
          min-height: 100%;
          display: flex; flex-direction: column; align-items: center;
          padding: calc(28px + env(safe-area-inset-top)) 16px calc(72px + env(safe-area-inset-bottom));
          gap: 22px;
        }
        .hs-center {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          width: 100%; max-width: 380px;
        }
        .hs-title {
          font-size: clamp(24px, 6vw, 38px);
          font-weight: 900;
          color: #f5c542;
          text-shadow: 0 4px 16px rgba(0,0,0,0.8), 0 0 28px rgba(245,197,66,0.25);
          letter-spacing: 1.5px;
          text-align: center;
          margin: 0;
          line-height: 1.05;
        }
        .hs-tagline {
          color: #fde047; opacity: 0.85;
          font-size: 12px; font-weight: 700; letter-spacing: 1.5px;
          text-transform: uppercase;
          text-shadow: 0 1px 3px rgba(0,0,0,0.7);
        }
        .hs-btns {
          display: flex; flex-direction: column; gap: 10px;
          width: min(320px, 88vw);
        }
        .hs-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
          width: min(320px, 88vw);
        }
        .hs-btn {
          appearance: none; border: none; cursor: pointer;
          background: linear-gradient(180deg, #f5c542 0%, #e0a92a 100%);
          color: #1a1208;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: 0.5px;
          padding: 13px 14px;
          width: 100%;
          border-radius: 14px;
          border: 2px solid #fde047;
          box-shadow: 0 5px 0 #8a6510, 0 10px 18px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25);
          transition: transform 0.08s, box-shadow 0.08s, filter 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          text-transform: uppercase;
          text-shadow: 0 1px 0 rgba(255,255,255,0.35);
          text-decoration: none;
          box-sizing: border-box;
          min-width: 0;
        }
        .hs-btn:hover { filter: brightness(1.08); }
        .hs-btn:active {
          transform: translateY(3px);
          box-shadow: 0 2px 0 #8a6510, 0 3px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2);
        }
        .hs-btn-hero {
          font-size: 20px;
          padding: 18px 0;
          background: linear-gradient(180deg, #fde047 0%, #f5c542 50%, #d49419 100%);
          box-shadow: 0 7px 0 #6b4f0c, 0 14px 26px rgba(245,197,66,0.5), inset 0 1px 0 rgba(255,255,255,0.4);
          letter-spacing: 2px;
          animation: hs-pulse 2.2s ease-in-out infinite;
        }
        .hs-btn-hero:active { box-shadow: 0 3px 0 #6b4f0c, 0 5px 10px rgba(0,0,0,0.4); }
        @keyframes hs-pulse {
          0%,100% { box-shadow: 0 7px 0 #6b4f0c, 0 14px 26px rgba(245,197,66,0.5), inset 0 1px 0 rgba(255,255,255,0.4); }
          50% { box-shadow: 0 7px 0 #6b4f0c, 0 14px 32px rgba(245,197,66,0.85), inset 0 1px 0 rgba(255,255,255,0.5); }
        }
        .hs-apk-icon { width: 18px; height: 18px; fill: #1a1208; }
        .hs-name-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 14px;
          background: rgba(0,0,0,0.55);
          border: 1px solid rgba(245,197,66,0.45);
          border-radius: 999px;
          color: #f5c542;
          font-weight: 800;
          font-size: 13px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.6);
          backdrop-filter: blur(6px);
        }
        .hs-section-label {
          width: min(320px, 88vw);
          color: #fde047;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 2px;
          text-transform: uppercase;
          opacity: 0.7;
          margin: 4px 0 -4px 6px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.8);
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
        .hs-pseudo-title { color: #f5c542; font-size: 20px; font-weight: 900; margin: 0; text-align: center; }
        .hs-pseudo-input {
          width: 100%; background: #0a0c10;
          border: 2px solid #374151; border-radius: 10px;
          padding: 12px 14px; color: #fff;
          font-size: 18px; font-weight: 700; outline: none; box-sizing: border-box;
        }
        .hs-pseudo-input:focus { border-color: #f5c542; }
        .hs-pseudo-actions { display: flex; gap: 10px; justify-content: flex-end; }
        .hs-pseudo-btn {
          appearance: none; border: none; cursor: pointer;
          background: linear-gradient(180deg, #f5c542 0%, #e0a92a 100%);
          color: #1a1208; font-weight: 900;
          padding: 10px 18px; border-radius: 10px; font-size: 16px;
        }
        .hs-footer {
          color: #fde047;
          font-size: 11px;
          font-weight: 700;
          text-align: center;
          text-shadow: 0 1px 2px rgba(0,0,0,0.8);
          padding: 12px;
          opacity: 0.85;
        }
      `}</style>


      <UpdateNotification />

      {/* Bouton admin caché (créateur du jeu) */}
      <button
        aria-label="admin"
        onClick={() => setShowAdmin(true)}
        style={{
          position: "absolute", top: 0, left: 0,
          width: 32, height: 32, opacity: 0,
          background: "transparent", border: "none", cursor: "default",
          zIndex: 5,
        }}
      />

      <div className="hs-center">
        <h1
          className="hs-title"
          onClick={() => {
            const now = Date.now();
            const next = now - lastTap < 800 ? titleTaps + 1 : 1;
            setTitleTaps(next);
            setLastTap(now);
            if (next >= 5) {
              setTitleTaps(0);
              setShowAdmin(true);
            }
          }}
          style={{ cursor: "default", userSelect: "none", WebkitUserSelect: "none" }}
        >
          My Taxi World : L'Empire des Rues
        </h1>
      </div>

      <div className="hs-btns">
        {effectiveName !== "Chauffeur" && (
          <div className="hs-name-badge" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {user && (
              <img
                src={resolveAvatarSrc(avatarKind, avatarUrl)}
                alt="avatar"
                style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid #f5c542", background: "#fff", objectFit: "cover" }}
              />
            )}
            <span>{user ? "🔒" : "👤"} {effectiveName}</span>
            {user && <span style={{ fontSize: 11, opacity: 0.7 }}>(en ligne)</span>}
          </div>
        )}
        {user && (
          <button className="hs-btn" onClick={() => setLoading(true)}>
            Jouer ▶
          </button>
        )}
        {user && (
          <button
            className="hs-btn"
            style={{ background: "linear-gradient(180deg,#ef4444,#b91c1c)", color: "#fff", boxShadow: "0 6px 0 #7f1d1d, 0 12px 20px rgba(0,0,0,0.5)", border: "2px solid #fca5a5", textShadow: "0 1px 0 rgba(0,0,0,0.3)" }}
            onClick={() => navigate({ to: "/arena" })}
          >
            ⚔️ Arène Mondiale
          </button>
        )}
        <button className="hs-btn" onClick={() => setShowLeaderboard(true)}>
          🏆 Classement
        </button>
        <button className="hs-btn" onClick={() => { resetTutorial(); setShowTutorial(true); }}>
          📖 Tuto
        </button>
        {onReplayIntro && (
          <button className="hs-btn" onClick={onReplayIntro}>
            🎬 Histoire
          </button>
        )}
        <button
          className="hs-btn"
          style={trialExpired ? { background: "linear-gradient(180deg,#6b7280,#4b5563)", color: "#d1d5db", boxShadow: "0 6px 0 #1f2937, 0 12px 20px rgba(0,0,0,0.5)", opacity: 0.85 } : undefined}
          onClick={() => {
            if (trialExpired) { setShowTrialEnded(true); return; }
            setPseudoInput(user ? cloudPseudo : getPlayerName());
            setShowPseudo(true);
          }}
        >
          ✏️ Pseudo {!user && (trialExpired ? "🔒" : `(${daysLeft}j)`)}
        </button>
        {user && (
          <button className="hs-btn" style={{ background: "linear-gradient(180deg,#3b82f6,#1d4ed8)", color: "#fff", boxShadow: "0 6px 0 #1e3a8a, 0 12px 20px rgba(0,0,0,0.5)", border: "2px solid #60a5fa", textShadow: "0 1px 0 rgba(0,0,0,0.3)" }} onClick={() => setShowProfile(true)}>
            🪪 Mon profil
          </button>
        )}
        {user ? (
          <button className="hs-btn" style={{ background: "linear-gradient(180deg,#6b7280,#374151)", color: "#fff", boxShadow: "0 6px 0 #1f2937, 0 12px 20px rgba(0,0,0,0.5)", border: "2px solid #6b7280", textShadow: "0 1px 0 rgba(0,0,0,0.3)" }} onClick={() => signOut()}>
            🚪 Déconnexion
          </button>
        ) : (
          <button className="hs-btn" style={{ background: "linear-gradient(180deg,#10b981,#059669)", color: "#fff", boxShadow: "0 6px 0 #064e3b, 0 12px 20px rgba(0,0,0,0.5)", border: "2px solid #34d399", textShadow: "0 1px 0 rgba(0,0,0,0.3)" }} onClick={() => navigate({ to: "/auth" })}>
            🔐 Connexion
          </button>
        )}
        <button
          className="hs-btn"
          style={{ background: "linear-gradient(180deg,#6b7280,#374151)", color: "#fde047", boxShadow: "0 6px 0 #1f2937, 0 12px 20px rgba(0,0,0,0.5)", border: "2px dashed #fde047", textShadow: "0 1px 0 rgba(0,0,0,0.4)" }}
          onClick={() => alert("🚧 Extension en développement — débloquera une nouvelle carte vers le nord avec de nouvelles missions.")}
        >
          🔒 Étendre la ville (bientôt)
        </button>
        <button className="hs-btn" onClick={() => navigate({ to: "/download" })}>
          <svg className="hs-apk-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.6 9.48l1.84-3.2c.16-.27.07-.62-.2-.78-.27-.16-.62-.07-.78.2l-1.87 3.24c-1.52-.68-3.22-1.06-5.02-1.06-1.8 0-3.5.38-5.02 1.06L4.84 5.7c-.16-.27-.51-.36-.78-.2-.27.16-.36.51-.2.78l1.84 3.2C2.8 11.36 1 14.44 1 18h22c0-3.56-1.8-6.64-4.4-8.52zM7 15.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25zm10 0c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z"/>
          </svg>
          Télécharger l'APK
        </button>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "max(6px, env(safe-area-inset-bottom))",
          textAlign: "center",
          color: "#fde047",
          fontSize: 11,
          fontWeight: 700,
          textShadow: "0 1px 2px rgba(0,0,0,0.8)",
          zIndex: 2,
          pointerEvents: "none",
          padding: "0 12px",
        }}
      >
        © 2026 My Taxi World : L'Empire des Rues — Tous droits réservés.
      </div>

      {showTutorial && <TutorialDialog onClose={() => setShowTutorial(false)} />}
      {showLeaderboard && <LeaderboardPanel onClose={() => setShowLeaderboard(false)} />}
      {showProfile && <ProfileCard onClose={() => setShowProfile(false)} />}

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
            />
            <div className="hs-pseudo-actions">
              <button className="hs-pseudo-btn hs-pseudo-secondary" onClick={() => setShowPseudo(false)}>Annuler</button>
              <button
                className="hs-pseudo-btn"
                onClick={async () => {
                  const newName = pseudoInput.trim() || "Chauffeur";
                  setPlayerName(newName);
                  setDisplayName(getPlayerName());
                  if (user) {
                    await supabase.from("profiles").update({ pseudo: newName }).eq("id", user.id);
                  }
                  setShowPseudo(false);
                  if (!user) setLoading(true);
                }}
              >
                {user ? "Valider" : "Jouer ▶"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdmin && (
        <div className="hs-pseudo-overlay" onClick={() => setShowAdmin(false)}>
          <div className="hs-pseudo-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="hs-pseudo-title">🛠️ Accès créateur</h3>
            <input
              className="hs-pseudo-input"
              type="email"
              placeholder="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
            />
            <input
              className="hs-pseudo-input"
              type="password"
              placeholder="mot de passe"
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
            />
            {adminErr && <div style={{ color: "#f87171", fontSize: 13, textAlign: "center" }}>{adminErr}</div>}
            <div className="hs-pseudo-actions">
              <button className="hs-pseudo-btn hs-pseudo-secondary" onClick={() => setShowAdmin(false)}>Annuler</button>
              <button
                className="hs-pseudo-btn"
                onClick={async () => {
                  setAdminErr("");
                  const { error } = await supabase.auth.signInWithPassword({ email: adminEmail, password: adminPass });
                  if (error) { setAdminErr(error.message); return; }
                  setShowAdmin(false);
                  setAdminEmail(""); setAdminPass("");
                }}
              >
                Connexion
              </button>
            </div>
          </div>
        </div>
      )}

      {showTrialEnded && (
        <div className="hs-pseudo-overlay">
          <div className="hs-pseudo-card">
            <h3 className="hs-pseudo-title">⏰ Essai terminé</h3>
            <p style={{ color: "#e5e7eb", fontSize: 15, lineHeight: 1.5, margin: 0, textAlign: "center" }}>
              Ta période d'essai de 7 jours est terminée.<br />
              Crée un compte pour garder ton pseudo et sauvegarder tes scores en ligne.
            </p>
            <div className="hs-pseudo-actions" style={{ justifyContent: "center" }}>
              <button className="hs-pseudo-btn hs-pseudo-secondary" onClick={() => window.close()}>
                Quitter
              </button>
              <button className="hs-pseudo-btn" onClick={() => { setShowTrialEnded(false); navigate({ to: "/auth" }); }}>
                S'inscrire
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

