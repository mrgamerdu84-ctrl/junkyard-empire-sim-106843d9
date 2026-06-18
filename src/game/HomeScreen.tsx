import { useState, useEffect } from "react";
import bgAsset from "@/assets/home-bg.png.asset.json";

export default function HomeScreen({ onPlay }: { onPlay: () => void }) {
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
          display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
          padding-bottom: 6vh;
          font-family: system-ui, -apple-system, sans-serif;
          overflow: hidden;
        }
        .hs-tap {
          position: absolute; inset: 0;
          cursor: pointer;
        }
      `}</style>
      <button
        className="hs-tap"
        aria-label="Jouer"
        onClick={() => setLoading(true)}
      />
    </div>
  );
}
