import { useState, useEffect } from "react";
import loadingAsset from "@/assets/loading-screen.png.asset.json";

const TIPS = [
  "Astuce : klaxonne dans les embouteillages !",
  "Astuce : les missions urgences rapportent le plus",
  "Astuce : garde ton réservoir plein",
  "Astuce : respecte les feux rouges... ou pas",
  "Astuce : les gyrophares attirent l'attention",
  "Astuce : explore la ville pour découvrir des secrets",
  "Astuce : mets ta musique préférée à la radio",
  "Astuce : les courses longues paient mieux",
];

export default function LoadingScreen({ progress }: { progress: number }) {
  const [tip, setTip] = useState(TIPS[0]);
  const clamped = Math.min(100, Math.max(0, progress));

  useEffect(() => {
    setTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
  }, []);

  return (
    <div className="ld-root">
      <style>{`
        .ld-root {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
          background: #0a0413;
          overflow: hidden;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .ld-bg {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover;
          object-position: center;
          z-index: 1;
        }
        .ld-fade {
          position: absolute; inset: 0; z-index: 2;
          background: linear-gradient(180deg,
            rgba(10,4,19,0) 0%,
            rgba(10,4,19,0) 55%,
            rgba(10,4,19,0.55) 80%,
            rgba(10,4,19,0.95) 100%);
          pointer-events: none;
        }
        .ld-content {
          position: relative; z-index: 3;
          width: 100%;
          padding: 0 7vw 7vh;
          display: flex; flex-direction: column; align-items: center;
        }
        .ld-bar-wrap {
          width: min(420px, 86vw);
          height: 10px;
          background: rgba(0,0,0,0.55);
          border: 1px solid rgba(253,224,71,0.35);
          border-radius: 6px;
          overflow: hidden;
          box-shadow: 0 0 18px rgba(253,224,71,0.25), inset 0 1px 2px rgba(0,0,0,0.6);
        }
        .ld-bar-fill {
          height: 100%;
          width: ${clamped}%;
          background: linear-gradient(90deg, #eab308, #fde047, #facc15);
          box-shadow: 0 0 12px rgba(253,224,71,0.7);
          transition: width 0.25s ease;
          border-radius: 4px;
        }
        .ld-pct {
          margin-top: 8px;
          color: #fde047;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 4px;
          font-variant-numeric: tabular-nums;
          text-shadow: 0 0 8px rgba(253,224,71,0.5), 0 2px 4px rgba(0,0,0,0.8);
        }
        .ld-tip {
          margin-top: 14px;
          color: rgba(255,255,255,0.85);
          font-size: 13px;
          font-style: italic;
          text-align: center;
          max-width: min(360px, 86vw);
          text-shadow: 0 1px 4px rgba(0,0,0,0.9);
        }
      `}</style>

      <img src={loadingAsset.url} alt="My Taxi World : L'Empire des Rues - La Guerre des Taxis" className="ld-bg" />
      <div className="ld-fade" />

      <div className="ld-content">
        <div className="ld-bar-wrap">
          <div className="ld-bar-fill" />
        </div>
        <div className="ld-pct">{Math.round(clamped)}%</div>
        <div className="ld-tip">{tip}</div>
      </div>
    </div>
  );
}
