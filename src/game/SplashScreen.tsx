import { useState, useEffect } from "react";
import splashAsset from "@/assets/taxi-tycoon-splash.png.asset.json";

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 600);
    const t2 = setTimeout(() => setPhase("out"), 2600);
    const t3 = setTimeout(() => onDone(), 3400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div className="sp-root">
      <style>{`
        .sp-root {
          position: fixed; inset: 0; z-index: 20000;
          display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
          background: #0a0c10;
          overflow: hidden;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .sp-img {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: cover; object-position: center 40%;
          opacity: 0; transform: scale(1.06);
          transition: opacity 0.8s ease, transform 6s ease;
        }
        .sp-img.sp-in  { opacity: 1; transform: scale(1); }
        .sp-img.sp-out { opacity: 0; transform: scale(1.03); }

        .sp-vignette {
          position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(0deg, rgba(10,12,16,0.85) 0%, rgba(10,12,16,0.25) 40%, rgba(10,12,16,0.1) 60%, rgba(10,12,16,0.45) 100%);
        }

        .sp-content {
          position: relative; z-index: 2;
          display: flex; flex-direction: column; align-items: center;
          padding-bottom: 10vh;
          opacity: 0; transform: translateY(18px);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }
        .sp-content.sp-in  { opacity: 1; transform: translateY(0); }
        .sp-content.sp-out { opacity: 0; transform: translateY(-12px); transition-duration: 0.6s; }

        .sp-sub {
          color: #c9b896;
          font-size: clamp(12px, 3vw, 16px);
          font-weight: 600;
          letter-spacing: 6px;
          text-transform: uppercase;
          margin-top: 8px;
          opacity: 0.85;
        }
        .sp-bar-wrap {
          width: min(200px, 50vw); height: 3px;
          background: rgba(255,255,255,0.12);
          border-radius: 2px;
          margin-top: 20px;
          overflow: hidden;
        }
        .sp-bar-fill {
          height: 100%; width: 0%;
          background: linear-gradient(90deg, #f5c542, #fde047);
          border-radius: 2px;
          animation: spBar 2.2s ease-in-out forwards;
        }
        @keyframes spBar {
          0%   { width: 0%; }
          40%  { width: 55%; }
          70%  { width: 85%; }
          100% { width: 100%; }
        }
      `}</style>

      <img
        src={splashAsset.url}
        alt="Garage Taxi Tycoon"
        className={`sp-img sp-${phase}`}
      />
      <div className="sp-vignette" />

      <div className={`sp-content sp-${phase}`}>
        <div className="sp-sub">My Taxi World Rivalité</div>
        <div className="sp-bar-wrap">
          <div className="sp-bar-fill" />
        </div>
      </div>
    </div>
  );
}
