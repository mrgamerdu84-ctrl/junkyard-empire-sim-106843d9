import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import skyline from "@/assets/skyline.jpg";
import garage from "@/assets/garage.jpg";
import carwash from "@/assets/carwash.jpg";
import shop from "@/assets/shop.jpg";
import warehouse from "@/assets/warehouse.jpg";
import parking from "@/assets/parking.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Junky City Empire" },
      { name: "description", content: "Construis ton empire de casses automobiles, garages et stations de lavage." },
      { property: "og:title", content: "Junky City Empire" },
      { property: "og:description", content: "Construis ton empire de casses automobiles, garages et stations de lavage." },
    ],
  }),
  component: JunkyCityEmpire,
});

type Building = { src: string; alt: string; reward: number; xp: number };

const BUILDINGS: Building[] = [
  { src: garage, alt: "Junky City Garage", reward: 30, xp: 5 },
  { src: carwash, alt: "Car Wash", reward: 50, xp: 8 },
  { src: shop, alt: "Junky Shop", reward: 40, xp: 6 },
  { src: warehouse, alt: "Junky City Warehouse", reward: 60, xp: 10 },
  { src: parking, alt: "Junky City Parking", reward: 20, xp: 3 },
];

function JunkyCityEmpire() {
  const [money, setMoney] = useState(260);
  const [xp, setXp] = useState(150);
  const [level, setLevel] = useState(1);
  const [pulse, setPulse] = useState<string | null>(null);
  const [washing, setWashing] = useState(false);

  const playWaterSound = () => {
    try {
      const AC = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AC) return;
      const ctx = new AC();
      const now = ctx.currentTime;
      const duration = 2.2;

      // 1) Pressurized spray: bright filtered white noise
      const sprayBuf = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = sprayBuf.getChannelData(ch);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const spray = ctx.createBufferSource();
      spray.buffer = sprayBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = 1200;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 3500; bp.Q.value = 0.6;
      const sprayGain = ctx.createGain();
      sprayGain.gain.setValueAtTime(0.0001, now);
      sprayGain.gain.exponentialRampToValueAtTime(0.35, now + 0.08);
      sprayGain.gain.exponentialRampToValueAtTime(0.18, now + 1.2);
      sprayGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      spray.connect(hp).connect(bp).connect(sprayGain).connect(ctx.destination);

      // 2) Low rumble of running water
      const rumbleBuf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
      const r = rumbleBuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < r.length; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) * 0.96; // brownian-ish
        r[i] = last * 3;
      }
      const rumble = ctx.createBufferSource();
      rumble.buffer = rumbleBuf;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 400;
      const rumbleGain = ctx.createGain();
      rumbleGain.gain.setValueAtTime(0.0001, now);
      rumbleGain.gain.exponentialRampToValueAtTime(0.25, now + 0.1);
      rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      rumble.connect(lp).connect(rumbleGain).connect(ctx.destination);

      // 3) Bubble pops: short pitched blips
      for (let i = 0; i < 8; i++) {
        const t = now + 0.15 + Math.random() * 1.4;
        const osc = ctx.createOscillator();
        osc.type = "sine";
        const f0 = 600 + Math.random() * 1200;
        osc.frequency.setValueAtTime(f0, t);
        osc.frequency.exponentialRampToValueAtTime(f0 * 2.4, t + 0.06);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        osc.connect(g).connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.1);
      }

      spray.start(now);
      rumble.start(now);
      spray.stop(now + duration);
      rumble.stop(now + duration);
      spray.onended = () => ctx.close();
    } catch {
      /* silent fail — perf safe */
    }
  };


  const collect = (b: Building) => {
    setMoney((m) => m + b.reward);
    setXp((x) => {
      const nx = x + b.xp;
      if (nx >= 200) {
        setLevel((l) => l + 1);
        return nx - 200;
      }
      return nx;
    });
    setPulse(b.alt);
    setTimeout(() => setPulse(null), 300);
    if (b.alt === "Car Wash") {
      playWaterSound();
      setWashing(true);
      setTimeout(() => setWashing(false), 1400);
    }
  };


  const play = () => {
    let total = 0;
    BUILDINGS.forEach((b) => (total += b.reward));
    setMoney((m) => m + total + 200);
    setXp((x) => {
      const nx = x + 30;
      if (nx >= 200) {
        setLevel((l) => l + 1);
        return nx - 200;
      }
      return nx;
    });
  };

  return (
    <div className="jce-root">
      <style>{`
        .jce-root {
          min-height: 100vh;
          background-color: #8a5a3b;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: white;
          user-select: none;
          padding-bottom: 110px;
        }
        .jce-topbar {
          position: sticky;
          top: 0;
          z-index: 20;
          background: #8a5a3b;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-bottom: 2px solid rgba(0,0,0,0.15);
        }
        .jce-money {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .jce-money-icon {
          width: 26px;
          height: 26px;
          background: #d4a017;
          border-radius: 4px;
          box-shadow: inset 0 -3px 0 rgba(0,0,0,0.25);
        }
        .jce-money-value {
          font-size: 22px;
          font-weight: 700;
          color: #ffffff;
        }
        .jce-center {
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .jce-lvl {
          font-size: 22px;
          font-weight: 700;
          color: #ffffff;
        }
        .jce-xp {
          font-size: 14px;
          color: rgba(255,255,255,0.7);
        }
        .jce-avatar {
          width: 32px;
          height: 32px;
          background: #d9d9d9;
          border-radius: 4px;
        }
        .jce-skyline {
          width: 100%;
          display: block;
          aspect-ratio: 16 / 10;
          object-fit: cover;
        }
        .jce-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2px;
          background: #6b4429;
        }
        .jce-tile {
          position: relative;
          padding: 0;
          border: 0;
          background: transparent;
          cursor: pointer;
          overflow: hidden;
          aspect-ratio: 1 / 1;
          transition: transform 0.15s ease;
        }
        .jce-tile:active { transform: scale(0.97); }
        .jce-tile img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .jce-tile.jce-wide {
          grid-column: span 2;
          aspect-ratio: 2 / 1;
        }
        .jce-tile.jce-center-tile {
          grid-column: span 2;
          aspect-ratio: 2 / 1;
        }
        .jce-tile.jce-pulse::after {
          content: "+€";
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          font-weight: 900;
          color: #ffd633;
          text-shadow: 0 3px 0 #000, 0 0 18px rgba(255,214,51,0.7);
          animation: jcePop 0.3s ease-out;
        }
        @keyframes jcePop {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .jce-play-wrap {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          padding: 16px 20px calc(20px + env(safe-area-inset-bottom));
          background: linear-gradient(to top, rgba(0,0,0,0.4), transparent);
          display: flex;
          justify-content: center;
          z-index: 30;
          pointer-events: none;
        }
        .jce-play-btn {
          pointer-events: auto;
          padding: 18px 80px;
          background: #d9b53d;
          border: none;
          border-radius: 14px;
          color: #1a1a1a;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 2px;
          cursor: pointer;
          box-shadow: 0 6px 0 #8a6f1f, 0 10px 20px rgba(0,0,0,0.35);
          transition: transform 0.1s, box-shadow 0.1s;
        }
        .jce-play-btn:active {
          transform: translateY(3px);
          box-shadow: 0 3px 0 #8a6f1f, 0 6px 12px rgba(0,0,0,0.35);
        }
        /* ===== Car Wash FX ===== */
        .jce-wash-fx {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .jce-wash-fx.is-on { opacity: 1; }
        .jce-wash-foam {
          position: absolute;
          left: 0; right: 0; bottom: 0;
          height: 38%;
          background:
            radial-gradient(circle at 20% 30%, #fff 0 6px, transparent 7px),
            radial-gradient(circle at 60% 20%, #ffd6f0 0 5px, transparent 6px),
            radial-gradient(circle at 80% 50%, #fff 0 7px, transparent 8px),
            linear-gradient(to top, rgba(255,255,255,0.95), rgba(180,230,255,0.6) 50%, transparent);
          filter: blur(0.5px);
          will-change: transform;
          animation: jceFoam 1.4s ease-out forwards;
        }
        .jce-bubble {
          position: absolute;
          bottom: 10%;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), rgba(180,230,255,0.7) 60%, rgba(120,200,255,0.3));
          box-shadow: inset 0 -2px 4px rgba(255,255,255,0.6);
          will-change: transform, opacity;
          animation: jceBubble 1.4s ease-out forwards;
        }
        @keyframes jceFoam {
          0% { transform: translateY(40%); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translateY(-10%); opacity: 0; }
        }
        @keyframes jceBubble {
          0% { transform: translate(0, 0) scale(0.4); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translate(var(--dx, 0px), -180px) scale(1); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .jce-wash-fx, .jce-bubble, .jce-wash-foam { animation: none !important; }
        }

        @media (min-width: 640px) {
          .jce-root { max-width: 480px; margin: 0 auto; box-shadow: 0 0 60px rgba(0,0,0,0.4); }
          .jce-play-wrap { max-width: 480px; margin: 0 auto; }
        }
      `}</style>


      <header className="jce-topbar">
        <div className="jce-money">
          <div className="jce-money-icon" />
          <div className="jce-money-value">{money}</div>
        </div>
        <div className="jce-center">
          <span className="jce-lvl">LVL {level}</span>
          <span className="jce-xp">XP: {xp}</span>
        </div>
        <div className="jce-avatar" />
      </header>

      <img src={skyline} alt="Skyline de Junky City" className="jce-skyline" />

      <div className="jce-grid">
        <button
          className={`jce-tile jce-wide ${pulse === BUILDINGS[1].alt ? "jce-pulse" : ""}`}
          onClick={() => collect(BUILDINGS[1])}
        >
          <img src={carwash} alt="Car Wash" loading="lazy" />
          <div className={`jce-wash-fx ${washing ? "is-on" : ""}`} aria-hidden="true">
            {washing && (
              <>
                <div className="jce-wash-foam" />
                {Array.from({ length: 12 }).map((_, i) => {
                  const left = 8 + i * 7.5;
                  const size = 10 + ((i * 13) % 18);
                  const delay = (i % 6) * 0.08;
                  const dx = (i % 2 === 0 ? -1 : 1) * (10 + (i % 4) * 8);
                  return (
                    <span
                      key={i}
                      className="jce-bubble"
                      style={{
                        left: `${left}%`,
                        width: `${size}px`,
                        height: `${size}px`,
                        animationDelay: `${delay}s`,
                        ["--dx" as any]: `${dx}px`,
                      }}
                    />
                  );
                })}
              </>
            )}
          </div>
        </button>


        <button
          className={`jce-tile ${pulse === BUILDINGS[0].alt ? "jce-pulse" : ""}`}
          onClick={() => collect(BUILDINGS[0])}
        >
          <img src={garage} alt="Junky City Garage" loading="lazy" />
        </button>
        <button
          className={`jce-tile ${pulse === BUILDINGS[3].alt ? "jce-pulse" : ""}`}
          onClick={() => collect(BUILDINGS[3])}
        >
          <img src={warehouse} alt="Junky City Warehouse" loading="lazy" />
        </button>

        <button
          className={`jce-tile ${pulse === BUILDINGS[2].alt ? "jce-pulse" : ""}`}
          onClick={() => collect(BUILDINGS[2])}
        >
          <img src={shop} alt="Junky Shop" loading="lazy" />
        </button>
        <button
          className={`jce-tile ${pulse === BUILDINGS[4].alt ? "jce-pulse" : ""}`}
          onClick={() => collect(BUILDINGS[4])}
        >
          <img src={parking} alt="Junky City Parking" loading="lazy" />
        </button>
      </div>

      <div className="jce-play-wrap">
        <button className="jce-play-btn" onClick={play}>JOUER</button>
      </div>
    </div>
  );
}
