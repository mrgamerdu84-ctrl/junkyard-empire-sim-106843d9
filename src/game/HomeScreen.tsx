import { useState } from "react";

export default function HomeScreen({ onPlay }: { onPlay: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div className="hs-root">
      <style>{`
        .hs-root {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          background: radial-gradient(ellipse at 50% 30%, #1a1f2e 0%, #0a0c10 70%);
          overflow: hidden;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .hs-bg {
          position: absolute; inset: 0; width: 100%; height: 100%;
          opacity: 0.18; pointer-events: none;
        }
        .hs-content {
          position: relative; z-index: 2;
          display: flex; flex-direction: column; align-items: center;
          padding: 24px; max-width: 480px; width: 100%;
        }
        .hs-logo {
          width: min(280px, 70vw); height: auto;
          filter: drop-shadow(0 8px 24px rgba(245, 197, 66, 0.4));
          margin-bottom: 8px;
        }
        .hs-title {
          font-size: clamp(28px, 7vw, 44px);
          font-weight: 900;
          letter-spacing: 3px;
          color: #f5c542;
          text-shadow: 0 2px 12px rgba(245, 197, 66, 0.5), 0 0 40px rgba(245, 197, 66, 0.2);
          margin: 0 0 4px 0;
          text-align: center;
        }
        .hs-sub {
          font-size: clamp(12px, 3vw, 15px);
          color: #9ca3af;
          letter-spacing: 1px;
          margin: 0 0 36px 0;
          text-align: center;
          text-transform: uppercase;
        }
        .hs-play {
          appearance: none; border: none; cursor: pointer;
          background: linear-gradient(180deg, #f5c542 0%, #e0a92a 100%);
          color: #1a1208;
          font-size: clamp(18px, 4.5vw, 22px);
          font-weight: 900;
          letter-spacing: 2px;
          padding: 16px 56px;
          border-radius: 12px;
          box-shadow: 0 6px 0 #8a6510, 0 12px 24px rgba(0,0,0,0.4);
          transition: transform 0.08s, box-shadow 0.08s;
          display: flex; align-items: center; gap: 10px;
        }
        .hs-play:hover { filter: brightness(1.05); }
        .hs-play.pressed, .hs-play:active {
          transform: translateY(4px);
          box-shadow: 0 2px 0 #8a6510, 0 4px 8px rgba(0,0,0,0.4);
        }
        .hs-footer {
          margin-top: 28px;
          color: #6b7280;
          font-size: 11px;
          letter-spacing: 1px;
        }
        .hs-blink { animation: hsBlink 1.6s infinite; }
        @keyframes hsBlink { 0%,60%,100%{opacity:1} 70%,85%{opacity:0.3} }
      `}</style>

      {/* Fond SVG : silhouette de ville + taxi */}
      <svg className="hs-bg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="hsSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0a0c10" />
          </linearGradient>
        </defs>
        <rect width="800" height="600" fill="url(#hsSky)" />
        {/* étoiles */}
        {Array.from({ length: 40 }).map((_, i) => (
          <circle key={i} cx={(i * 73) % 800} cy={(i * 37) % 250} r={Math.random() * 1.2 + 0.3} fill="#fde68a" opacity={0.6} />
        ))}
        {/* lune */}
        <circle cx="650" cy="110" r="42" fill="#f5c542" opacity="0.9" />
        <circle cx="640" cy="100" r="38" fill="#0a0c10" opacity="0.95" />
        {/* skyline */}
        <g fill="#0a0c10" stroke="#f5c542" strokeWidth="1" opacity="0.85">
          <rect x="40" y="320" width="60" height="220" />
          <rect x="110" y="280" width="80" height="260" />
          <rect x="200" y="350" width="50" height="190" />
          <rect x="260" y="240" width="100" height="300" />
          <rect x="370" y="310" width="70" height="230" />
          <rect x="450" y="270" width="90" height="270" />
          <rect x="550" y="330" width="60" height="210" />
          <rect x="620" y="290" width="80" height="250" />
          <rect x="710" y="360" width="60" height="180" />
        </g>
        {/* fenêtres allumées */}
        <g fill="#fde047" opacity="0.7">
          {Array.from({ length: 80 }).map((_, i) => {
            const x = 50 + (i * 31) % 700;
            const y = 300 + (i * 47) % 220;
            return <rect key={i} x={x} y={y} width="4" height="5" />;
          })}
        </g>
        {/* sol */}
        <rect x="0" y="540" width="800" height="60" fill="#1a1d22" />
        <path d="M 0 555 L 800 555" stroke="#f5c542" strokeWidth="2" strokeDasharray="20 14" opacity="0.6" />
      </svg>

      <div className="hs-content">
        {/* Logo SVG : taxi stylisé */}
        <svg className="hs-logo" viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="taxiGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffd84a" />
              <stop offset="100%" stopColor="#e0a92a" />
            </linearGradient>
          </defs>
          {/* ombre */}
          <ellipse cx="100" cy="100" rx="70" ry="6" fill="#000" opacity="0.5" />
          {/* corps */}
          <path d="M 30 80 L 30 60 Q 30 50 40 48 L 65 42 Q 75 28 90 26 L 130 26 Q 145 28 155 42 L 170 48 Q 180 50 180 60 L 180 80 Z"
                fill="url(#taxiGrad)" stroke="#1a1208" strokeWidth="2" strokeLinejoin="round" />
          {/* damier toit */}
          <g>
            {Array.from({ length: 8 }).map((_, i) => (
              <rect key={i} x={75 + i * 8} y="30" width="8" height="6" fill={i % 2 ? "#1a1208" : "#ffffff"} />
            ))}
          </g>
          {/* vitres */}
          <path d="M 72 44 L 85 32 L 128 32 L 142 44 Z" fill="#7dd3fc" stroke="#1a1208" strokeWidth="1.5" opacity="0.85" />
          <line x1="105" y1="32" x2="105" y2="44" stroke="#1a1208" strokeWidth="1.5" />
          {/* phares */}
          <circle cx="174" cy="68" r="4" fill="#fff7c0" stroke="#1a1208" strokeWidth="1" />
          <circle cx="36" cy="68" r="3" fill="#dc2626" stroke="#1a1208" strokeWidth="1" />
          {/* roues */}
          <circle cx="60" cy="84" r="12" fill="#0a0c10" stroke="#1a1208" strokeWidth="2" />
          <circle cx="60" cy="84" r="5" fill="#525252" />
          <circle cx="150" cy="84" r="12" fill="#0a0c10" stroke="#1a1208" strokeWidth="2" />
          <circle cx="150" cy="84" r="5" fill="#525252" />
          {/* TAXI label */}
          <rect x="85" y="58" width="30" height="10" fill="#1a1208" rx="1" />
          <text x="100" y="66" fontSize="8" fontWeight="900" textAnchor="middle" fill="#fde047" letterSpacing="1">TAXI</text>
        </svg>

        <h1 className="hs-title">TAXI TYCOON</h1>
        <p className="hs-sub">City Cab Empire</p>

        <button
          className={`hs-play${pressed ? " pressed" : ""}`}
          onMouseDown={() => setPressed(true)}
          onMouseUp={() => setPressed(false)}
          onMouseLeave={() => setPressed(false)}
          onClick={onPlay}
        >
          ▶ JOUER
        </button>

        <div className="hs-footer hs-blink">TAP TO START YOUR EMPIRE</div>
      </div>
    </div>
  );
}
