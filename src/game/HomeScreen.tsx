import { useState, useEffect } from "react";

export default function HomeScreen({ onPlay }: { onPlay: () => void }) {
  const [pressedPlay, setPressedPlay] = useState(false);
  const [pressedApk, setPressedApk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

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
          .hs-load-car {
            width: 120px; height: auto;
            animation: hsBounce 0.6s infinite alternate ease-in-out;
          }
          .hs-load-track {
            width: 200px; height: 4px;
            background: #2a2d35;
            border-radius: 2px;
            margin-top: 32px;
            overflow: hidden;
          }
          .hs-load-fill {
            height: 100%;
            background: linear-gradient(90deg, #f5c542, #fde047);
            border-radius: 2px;
            transition: width 0.2s ease;
          }
          .hs-load-text {
            margin-top: 16px;
            color: #9ca3af;
            font-size: 13px;
            letter-spacing: 2px;
            text-transform: uppercase;
          }
          .hs-load-dots::after {
            content: '';
            animation: hsDots 1.5s infinite;
          }
          @keyframes hsBounce { from { transform: translateY(0); } to { transform: translateY(-10px); } }
          @keyframes hsDots { 0%{content:''} 33%{content:'.'} 66%{content:'..'} 100%{content:'...'} }
        `}</style>

        {/* Petit taxi animé */}
        <svg className="hs-load-car" viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="lcGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffd84a" />
              <stop offset="100%" stopColor="#e0a92a" />
            </linearGradient>
          </defs>
          {/* ombre */}
          <ellipse cx="60" cy="64" rx="44" ry="4" fill="#000" opacity="0.4" />
          {/* corps */}
          <path d="M 18 55 L 18 40 Q 18 32 26 30 L 42 26 Q 50 15 62 14 L 88 14 Q 100 15 108 26 L 114 30 Q 120 32 120 40 L 120 55 Z"
                fill="url(#lcGrad)" stroke="#1a1208" strokeWidth="2" strokeLinejoin="round" />
          {/* damier toit */}
          <g>
            {Array.from({ length: 6 }).map((_, i) => (
              <rect key={i} x={52 + i * 7} y="18" width="7" height="5" fill={i % 2 ? "#1a1208" : "#ffffff"} />
            ))}
          </g>
          {/* vitres */}
          <path d="M 48 28 L 58 18 L 82 18 L 92 28 Z" fill="#7dd3fc" stroke="#1a1208" strokeWidth="1.5" opacity="0.85" />
          <line x1="70" y1="18" x2="70" y2="28" stroke="#1a1208" strokeWidth="1.5" />
          {/* phares */}
          <circle cx="116" cy="42" r="3.5" fill="#fff7c0" stroke="#1a1208" strokeWidth="1" />
          <circle cx="22" cy="42" r="2.5" fill="#dc2626" stroke="#1a1208" strokeWidth="1" />
          {/* roues */}
          <circle cx="38" cy="56" r="9" fill="#0a0c10" stroke="#1a1208" strokeWidth="2" />
          <circle cx="38" cy="56" r="4" fill="#525252" />
          <circle cx="92" cy="56" r="9" fill="#0a0c10" stroke="#1a1208" strokeWidth="2" />
          <circle cx="92" cy="56" r="4" fill="#525252" />
          {/* TAXI label */}
          <rect x="52" y="38" width="18" height="7" fill="#1a1208" rx="1" />
          <text x="61" y="43.5" fontSize="5" fontWeight="900" textAnchor="middle" fill="#fde047" letterSpacing="0.5">TAXI</text>
        </svg>

        <div className="hs-load-track">
          <div className="hs-load-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="hs-load-text">Chargement<span className="hs-load-dots" /></div>
      </div>
    );
  }

  return (
    <div className="hs-root">
      <style>{`
        .hs-root {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          background: linear-gradient(180deg, #1a1f2e 0%, #0a0c10 60%, #050508 100%);
          overflow: hidden;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .hs-bg {
          position: absolute; inset: 0; width: 100%; height: 100%;
          opacity: 0.9; pointer-events: none;
        }
        .hs-content {
          position: relative; z-index: 2;
          display: flex; flex-direction: column; align-items: center;
          padding: 24px; max-width: 480px; width: 100%;
          margin-top: auto;
          margin-bottom: auto;
        }
        .hs-title {
          font-size: clamp(32px, 8vw, 52px);
          font-weight: 900;
          letter-spacing: 1px;
          color: #f5c542;
          text-shadow:
            0 2px 0 #b8860b,
            0 4px 0 #8a6510,
            0 6px 12px rgba(0,0,0,0.6);
          margin: 0 0 6px 0;
          text-align: center;
          line-height: 1.1;
        }
        .hs-sub {
          font-size: clamp(14px, 3.5vw, 18px);
          color: #fde047;
          font-weight: 700;
          letter-spacing: 2px;
          margin: 0 0 40px 0;
          text-align: center;
          text-transform: uppercase;
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }
        .hs-btn {
          appearance: none; border: none; cursor: pointer;
          background: linear-gradient(180deg, #f5c542 0%, #e0a92a 100%);
          color: #1a1208;
          font-size: clamp(18px, 4.5vw, 24px);
          font-weight: 900;
          letter-spacing: 1px;
          padding: 16px 0;
          width: min(280px, 75vw);
          border-radius: 14px;
          box-shadow: 0 6px 0 #8a6510, 0 12px 24px rgba(0,0,0,0.4);
          transition: transform 0.08s, box-shadow 0.08s, filter 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          margin-bottom: 16px;
          text-transform: uppercase;
        }
        .hs-btn:hover { filter: brightness(1.08); }
        .hs-btn.pressed, .hs-btn:active {
          transform: translateY(4px);
          box-shadow: 0 2px 0 #8a6510, 0 4px 8px rgba(0,0,0,0.4);
        }
        .hs-footer {
          margin-top: 20px;
          color: #6b7280;
          font-size: 11px;
          letter-spacing: 1px;
        }
        .hs-blink { animation: hsBlink 1.6s infinite; }
        @keyframes hsBlink { 0%,60%,100%{opacity:1} 70%,85%{opacity:0.3} }
        .hs-apk-icon {
          width: 24px; height: 24px;
          fill: #1a1208;
        }
      `}</style>

      {/* Fond SVG : garage isométrique style */}
      <svg className="hs-bg" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#050508" />
          </linearGradient>
          <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a2d35" />
            <stop offset="100%" stopColor="#1a1d22" />
          </linearGradient>
        </defs>
        <rect width="400" height="800" fill="url(#bgGrad)" />

        {/* Sol garage */}
        <rect x="0" y="500" width="400" height="300" fill="url(#floorGrad)" />
        <line x1="0" y1="500" x2="400" y2="500" stroke="#f5c542" strokeWidth="2" opacity="0.4" />

        {/* Lignes sol parking */}
        <line x1="60" y1="540" x2="340" y2="540" stroke="#f5c542" strokeWidth="1.5" strokeDasharray="8 6" opacity="0.5" />
        <line x1="60" y1="620" x2="340" y2="620" stroke="#f5c542" strokeWidth="1.5" strokeDasharray="8 6" opacity="0.5" />
        <line x1="60" y1="700" x2="340" y2="700" stroke="#f5c542" strokeWidth="1.5" strokeDasharray="8 6" opacity="0.5" />

        {/* Étagères / racks à gauche */}
        <g opacity="0.7">
          <rect x="20" y="350" width="80" height="12" fill="#3a3f4a" stroke="#525252" strokeWidth="1" />
          <rect x="20" y="420" width="80" height="12" fill="#3a3f4a" stroke="#525252" strokeWidth="1" />
          <rect x="20" y="490" width="80" height="12" fill="#3a3f4a" stroke="#525252" strokeWidth="1" />
          <line x1="30" y1="350" x2="30" y2="502" stroke="#525252" strokeWidth="2" />
          <line x1="90" y1="350" x2="90" y2="502" stroke="#525252" strokeWidth="2" />
          {/* Pneus sur étagères */}
          <circle cx="45" cy="356" r="8" fill="#1a1d22" stroke="#525252" strokeWidth="1" />
          <circle cx="65" cy="356" r="8" fill="#1a1d22" stroke="#525252" strokeWidth="1" />
          <circle cx="45" cy="426" r="8" fill="#1a1d22" stroke="#525252" strokeWidth="1" />
          <circle cx="65" cy="426" r="8" fill="#1a1d22" stroke="#525252" strokeWidth="1" />
        </g>

        {/* Taxi jaune au centre (gros) */}
        <g transform="translate(200, 420) scale(1.4)">
          <ellipse cx="0" cy="35" rx="55" ry="5" fill="#000" opacity="0.4" />
          <path d="M -50 25 L -50 8 Q -50 0 -42 -2 L -25 -6 Q -18 -16 -8 -18 L 18 -18 Q 28 -16 35 -6 L 48 -2 Q 55 0 55 8 L 55 25 Z"
                fill="#f5c542" stroke="#1a1208" strokeWidth="2" strokeLinejoin="round" />
          {/* damier */}
          {Array.from({ length: 5 }).map((_, i) => (
            <rect key={i} x={-12 + i * 7} y="-15" width="7" height="5" fill={i % 2 ? "#1a1208" : "#ffffff"} />
          ))}
          {/* vitre */}
          <path d="M -18 -4 L -8 -14 L 14 -14 L 22 -4 Z" fill="#7dd3fc" stroke="#1a1208" strokeWidth="1.5" opacity="0.85" />
          <line x1="2" y1="-14" x2="2" y2="-4" stroke="#1a1208" strokeWidth="1.5" />
          {/* phares */}
          <circle cx="50" cy="8" r="3" fill="#fff7c0" stroke="#1a1208" strokeWidth="1" />
          <circle cx="-46" cy="8" r="2" fill="#dc2626" stroke="#1a1208" strokeWidth="1" />
          {/* roues */}
          <circle cx="-25" cy="22" r="10" fill="#0a0c10" stroke="#1a1208" strokeWidth="2" />
          <circle cx="-25" cy="22" r="4" fill="#525252" />
          <circle cx="25" cy="22" r="10" fill="#0a0c10" stroke="#1a1208" strokeWidth="2" />
          <circle cx="25" cy="22" r="4" fill="#525252" />
          {/* label */}
          <rect x="-8" y="5" width="16" height="6" fill="#1a1208" rx="1" />
          <text x="0" y="9.5" fontSize="4" fontWeight="900" textAnchor="middle" fill="#fde047">TAXI</text>
        </g>

        {/* Petit taxi à droite en haut */}
        <g transform="translate(320, 300) scale(0.7)">
          <ellipse cx="0" cy="25" rx="35" ry="3" fill="#000" opacity="0.3" />
          <path d="M -30 18 L -30 5 Q -30 -2 -24 -4 L -12 -7 Q -6 -14 2 -16 L 20 -16 Q 28 -14 32 -7 L 40 -4 Q 45 -2 45 5 L 45 18 Z"
                fill="#f5c542" stroke="#1a1208" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="38" cy="4" r="2.5" fill="#fff7c0" stroke="#1a1208" strokeWidth="1" />
          <circle cx="-28" cy="4" r="2" fill="#dc2626" stroke="#1a1208" strokeWidth="1" />
          <circle cx="-15" cy="18" r="7" fill="#0a0c10" stroke="#1a1208" strokeWidth="2" />
          <circle cx="-15" cy="18" r="3" fill="#525252" />
          <circle cx="18" cy="18" r="7" fill="#0a0c10" stroke="#1a1208" strokeWidth="2" />
          <circle cx="18" cy="18" r="3" fill="#525252" />
        </g>

        {/* Mécanicien stylisé à gauche */}
        <g transform="translate(70, 480)">
          {/* corps */}
          <rect x="-12" y="0" width="24" height="30" rx="4" fill="#1e3a5f" stroke="#0f172a" strokeWidth="1" />
          {/* tête */}
          <circle cx="0" cy="-8" r="10" fill="#fcd3a1" stroke="#0f172a" strokeWidth="1" />
          {/* casquette */}
          <path d="M -12 -12 Q 0 -18 12 -12 L 14 -10 L -14 -10 Z" fill="#dc2626" stroke="#0f172a" strokeWidth="1" />
          {/* bras */}
          <line x1="-12" y1="5" x2="-22" y2="-5" stroke="#fcd3a1" strokeWidth="4" strokeLinecap="round" />
          <line x1="12" y1="5" x2="22" y2="-5" stroke="#fcd3a1" strokeWidth="4" strokeLinecap="round" />
          {/* clé anglaise */}
          <rect x="-28" y="-10" width="14" height="4" fill="#94a3b8" rx="1" transform="rotate(-30 -21 -8)" />
        </g>

        {/* Mécanicien 2 à droite */}
        <g transform="translate(330, 520)">
          <rect x="-12" y="0" width="24" height="30" rx="4" fill="#166534" stroke="#0f172a" strokeWidth="1" />
          <circle cx="0" cy="-8" r="10" fill="#fcd3a1" stroke="#0f172a" strokeWidth="1" />
          <path d="M -12 -12 Q 0 -18 12 -12 L 14 -10 L -14 -10 Z" fill="#f5c542" stroke="#0f172a" strokeWidth="1" />
          <line x1="-12" y1="5" x2="-20" y2="20" stroke="#fcd3a1" strokeWidth="4" strokeLinecap="round" />
          <line x1="12" y1="5" x2="20" y2="20" stroke="#fcd3a1" strokeWidth="4" strokeLinecap="round" />
        </g>

        {/* Lampes plafond */}
        <g>
          <rect x="100" y="200" width="40" height="6" fill="#3a3f4a" rx="3" />
          <ellipse cx="120" cy="220" rx="30" ry="8" fill="#f5c542" opacity="0.08" />
          <rect x="260" y="200" width="40" height="6" fill="#3a3f4a" rx="3" />
          <ellipse cx="280" cy="220" rx="30" ry="8" fill="#f5c542" opacity="0.08" />
        </g>

        {/* Étoiles / particules */}
        <g fill="#f5c542" opacity="0.3">
          {Array.from({ length: 20 }).map((_, i) => (
            <circle key={i} cx={(i * 47) % 400} cy={(i * 31) % 400} r={Math.random() * 1.5 + 0.5} />
          ))}
        </g>

        {/* Outils au sol */}
        <g opacity="0.5">
          <rect x="120" y="580" width="20" height="3" fill="#94a3b8" rx="1" transform="rotate(15 130 582)" />
          <rect x="280" y="650" width="18" height="3" fill="#94a3b8" rx="1" transform="rotate(-20 289 652)" />
          <circle cx="150" cy="660" r="5" fill="#dc2626" opacity="0.6" />
        </g>
      </svg>

      <div className="hs-content">
        <h1 className="hs-title">My Taxi<br/>World Tycoon</h1>
        <p className="hs-sub">City Cab Empire</p>

        <button
          className={`hs-btn${pressedPlay ? " pressed" : ""}`}
          onMouseDown={() => setPressedPlay(true)}
          onMouseUp={() => setPressedPlay(false)}
          onMouseLeave={() => setPressedPlay(false)}
          onClick={() => setLoading(true)}
        >
          Jouer ▶
        </button>

        <button
          className={`hs-btn${pressedApk ? " pressed" : ""}`}
          onMouseDown={() => setPressedApk(true)}
          onMouseUp={() => setPressedApk(false)}
          onMouseLeave={() => setPressedApk(false)}
          onClick={() => {
            window.open("https://github.com/", "_blank");
          }}
        >
          <svg className="hs-apk-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.6 9.48l1.84-3.2c.16-.27.07-.62-.2-.78-.27-.16-.62-.07-.78.2l-1.87 3.24c-1.52-.68-3.22-1.06-5.02-1.06-1.8 0-3.5.38-5.02 1.06L4.84 5.7c-.16-.27-.51-.36-.78-.2-.27.16-.36.51-.2.78l1.84 3.2C2.8 11.36 1 14.44 1 18h22c0-3.56-1.8-6.64-4.4-8.52zM7 15.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25zm10 0c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z"/>
          </svg>
          APK
        </button>

        <div className="hs-footer hs-blink">TAP TO START YOUR EMPIRE</div>
      </div>
    </div>
  );
}
