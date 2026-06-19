import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import ProfileCard, { resolveAvatarSrc } from "@/components/ProfileCard";
import LeaderboardPanel from "@/components/LeaderboardPanel";
import TutorialDialog from "@/components/TutorialDialog";
import { useAuth, signOut } from "@/lib/useAuth";
import { resetTutorial } from "@/lib/leaderboard";

export default function GameMenu({ onHome }: { onHome: () => void }) {
  const navigate = useNavigate();
  const { user, pseudo, avatarKind, avatarUrl } = useAuth();
  const [open, setOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  const close = () => setOpen(false);

  return (
    <>
      <style>{`
        .gm-fab {
          position: fixed; top: max(10px, env(safe-area-inset-top)); left: 10px;
          width: 46px; height: 46px; border-radius: 50%;
          background: linear-gradient(180deg,#f5c542,#e0a92a);
          border: 2px solid #fde047;
          box-shadow: 0 4px 0 #8a6510, 0 8px 16px rgba(0,0,0,0.5);
          color: #1a1208; font-size: 22px; font-weight: 900;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; z-index: 9000;
          padding: 0;
        }
        .gm-fab:active { transform: translateY(2px); box-shadow: 0 2px 0 #8a6510, 0 4px 8px rgba(0,0,0,0.4); }
        .gm-overlay {
          position: fixed; inset: 0; z-index: 9500;
          background: rgba(0,0,0,0.72);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
        }
        .gm-card {
          background: linear-gradient(180deg,#1f2937,#111827);
          border: 2px solid #f5c542;
          border-radius: 16px;
          width: min(320px, 90vw);
          padding: 20px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .gm-head {
          display: flex; align-items: center; gap: 10px;
          padding-bottom: 10px; margin-bottom: 4px;
          border-bottom: 1px solid #374151;
        }
        .gm-head img { width: 38px; height: 38px; border-radius: 50%; border: 2px solid #f5c542; background: #fff; object-fit: cover; }
        .gm-head .gm-name { color: #f5c542; font-weight: 900; font-size: 16px; }
        .gm-head .gm-sub { color: #9ca3af; font-size: 11px; }
        .gm-btn {
          appearance: none; border: 2px solid #fde047; cursor: pointer;
          background: linear-gradient(180deg,#f5c542,#e0a92a);
          color: #1a1208; font-weight: 900; font-size: 15px;
          padding: 12px; border-radius: 12px;
          box-shadow: 0 4px 0 #8a6510;
          display: flex; align-items: center; gap: 10px;
          text-transform: uppercase; letter-spacing: 0.5px;
        }
        .gm-btn:active { transform: translateY(2px); box-shadow: 0 2px 0 #8a6510; }
        .gm-btn.gm-blue { background: linear-gradient(180deg,#3b82f6,#1d4ed8); color: #fff; border-color: #60a5fa; box-shadow: 0 4px 0 #1e3a8a; }
        .gm-btn.gm-blue:active { box-shadow: 0 2px 0 #1e3a8a; }
        .gm-btn.gm-green { background: linear-gradient(180deg,#10b981,#059669); color: #fff; border-color: #34d399; box-shadow: 0 4px 0 #064e3b; }
        .gm-btn.gm-green:active { box-shadow: 0 2px 0 #064e3b; }
        .gm-btn.gm-gray { background: linear-gradient(180deg,#6b7280,#374151); color: #fff; border-color: #6b7280; box-shadow: 0 4px 0 #1f2937; }
        .gm-btn.gm-gray:active { box-shadow: 0 2px 0 #1f2937; }
        .gm-close {
          appearance: none; background: transparent; border: none;
          color: #9ca3af; font-size: 13px; cursor: pointer;
          padding: 6px; margin-top: 4px;
        }
      `}</style>

      <button className="gm-fab" aria-label="Menu" onClick={() => setOpen(true)}>☰</button>

      {open && (
        <div className="gm-overlay" onClick={close}>
          <div className="gm-card" onClick={(e) => e.stopPropagation()}>
            <div className="gm-head">
              {user && (
                <img src={resolveAvatarSrc(avatarKind, avatarUrl)} alt="avatar" />
              )}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span className="gm-name">{user ? `🔒 ${pseudo}` : "👤 Invité"}</span>
                {user && <span className="gm-sub">en ligne</span>}
              </div>
            </div>

            {user && (
              <button className="gm-btn gm-blue" onClick={() => { setShowProfile(true); close(); }}>
                🪪 Mon profil
              </button>
            )}
            <button className="gm-btn" onClick={() => { setShowLeaderboard(true); close(); }}>
              🏆 Classement
            </button>
            <button className="gm-btn" onClick={() => { resetTutorial(); setShowTutorial(true); close(); }}>
              📖 Tuto
            </button>
            <button className="gm-btn gm-gray" onClick={() => { close(); onHome(); }}>
              🏠 Menu d'accueil
            </button>
            {user ? (
              <button className="gm-btn gm-gray" onClick={() => { signOut(); close(); }}>
                🚪 Déconnexion
              </button>
            ) : (
              <button className="gm-btn gm-green" onClick={() => { close(); navigate({ to: "/auth" }); }}>
                🔐 Connexion
              </button>
            )}

            <button
              className="gm-close"
              onClick={() => { close(); navigate({ to: "/mentions-legales" }); }}
              style={{ textDecoration: "underline" }}
            >
              📜 Mentions légales &amp; confidentialité
            </button>
            <button className="gm-close" onClick={close}>Fermer</button>

          </div>
        </div>
      )}

      {showProfile && <ProfileCard onClose={() => setShowProfile(false)} />}
      {showLeaderboard && <LeaderboardPanel onClose={() => setShowLeaderboard(false)} />}
      {showTutorial && <TutorialDialog onClose={() => setShowTutorial(false)} />}
    </>
  );
}
