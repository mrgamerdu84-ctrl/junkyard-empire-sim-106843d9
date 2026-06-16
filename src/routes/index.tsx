import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import skyline from "@/assets/skyline.jpg";
import garage from "@/assets/garage.jpg";
import carwash from "@/assets/carwash.jpg";
import shop from "@/assets/shop.jpg";
import warehouse from "@/assets/warehouse.jpg";
import parking from "@/assets/parking.jpg";
import car1 from "@/assets/car1.png";
import car2 from "@/assets/car2.png";
import car3 from "@/assets/car3.png";


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
      setTimeout(() => setWashing(false), 2200);
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
          background: #1a1d22;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: white;
          user-select: none;
          padding-bottom: 110px;
        }
        .jce-topbar {
          position: sticky;
          top: 0;
          z-index: 20;
          background: linear-gradient(to bottom, #0f1115, #1a1d22);
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
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
        .jce-skyline-wrap {
          position: relative;
          overflow: hidden;
        }
        .jce-skyline {
          width: 100%;
          display: block;
          aspect-ratio: 16 / 10;
          object-fit: cover;
        }
        /* Animated street under the skyline */
        .jce-street {
          position: relative;
          height: 56px;
          background:
            repeating-linear-gradient(90deg,
              rgba(255,255,255,0.85) 0 22px,
              transparent 22px 50px) center / auto 3px no-repeat,
            linear-gradient(to bottom, #2a2d33, #1a1c20);
          overflow: hidden;
          border-top: 1px solid rgba(0,0,0,0.5);
          border-bottom: 1px solid rgba(0,0,0,0.5);
        }
        .jce-street-car {
          position: absolute;
          bottom: 6px;
          height: 28px;
          width: auto;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.55));
          will-change: transform;
          animation: jceDriveRight linear infinite;
        }
        .jce-street-car.rev {
          top: 6px;
          bottom: auto;
          transform: scaleX(-1);
          animation-name: jceDriveLeft;
        }
        @keyframes jceDriveRight {
          0% { transform: translateX(-25%); }
          100% { transform: translateX(120vw); }
        }
        @keyframes jceDriveLeft {
          0% { transform: translateX(120vw) scaleX(-1); }
          100% { transform: translateX(-25%) scaleX(-1); }
        }
        /* Tiny car driving across each tile */
        .jce-tile-car {
          position: absolute;
          bottom: 6%;
          height: 22%;
          width: auto;
          filter: drop-shadow(0 3px 4px rgba(0,0,0,0.5));
          will-change: transform;
          animation: jceTileDrive linear infinite;
          pointer-events: none;
          z-index: 2;
        }
        @keyframes jceTileDrive {
          0% { transform: translateX(-30%); }
          100% { transform: translateX(420%); }
        }
        .jce-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2px;
          background: #0a0b0d;
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
        /* ===== Car Wash FX (realistic) ===== */
        .jce-wash-fx {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .jce-wash-fx.is-on { opacity: 1; }

        /* Wet, soapy color wash on the building */
        .jce-wash-tint {
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse at 30% 20%, rgba(180,230,255,0.45), transparent 55%),
            radial-gradient(ellipse at 70% 60%, rgba(255,200,235,0.35), transparent 60%),
            linear-gradient(to bottom, rgba(120,200,255,0.15), rgba(60,140,200,0.25));
          mix-blend-mode: screen;
          animation: jceFadeInOut 2.2s ease-out forwards;
        }
        /* Glossy wet shine sweeping across */
        .jce-wash-shine {
          position: absolute; inset: 0;
          background: linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.55) 50%, transparent 65%);
          mix-blend-mode: overlay;
          transform: translateX(-100%);
          animation: jceShine 1.6s ease-in-out 0.2s forwards;
        }
        /* Pressurized water jets falling from the top */
        .jce-jet {
          position: absolute;
          top: -10%;
          width: 2px;
          height: 30%;
          background: linear-gradient(to bottom, rgba(220,240,255,0) 0%, rgba(220,240,255,0.85) 40%, rgba(255,255,255,0.95));
          filter: blur(0.6px);
          transform-origin: top;
          animation: jceJet 0.9s linear infinite;
        }
        /* Misty spray cloud */
        .jce-mist {
          position: absolute; inset: -5% -5% 30% -5%;
          background:
            radial-gradient(circle at 25% 40%, rgba(255,255,255,0.55), transparent 35%),
            radial-gradient(circle at 65% 30%, rgba(255,255,255,0.45), transparent 40%),
            radial-gradient(circle at 50% 60%, rgba(255,255,255,0.35), transparent 45%);
          filter: blur(6px);
          animation: jceMist 2.2s ease-out forwards;
        }
        /* Colored foam pool at the bottom with rainbow soap sheen */
        .jce-wash-foam {
          position: absolute;
          left: 0; right: 0; bottom: 0;
          height: 42%;
          background:
            radial-gradient(circle at 15% 35%, rgba(255,255,255,0.95) 0 7px, transparent 8px),
            radial-gradient(circle at 32% 55%, rgba(255,220,245,0.9) 0 5px, transparent 6px),
            radial-gradient(circle at 50% 25%, rgba(220,255,250,0.95) 0 8px, transparent 9px),
            radial-gradient(circle at 70% 50%, rgba(255,255,255,0.95) 0 6px, transparent 7px),
            radial-gradient(circle at 88% 30%, rgba(220,240,255,0.9) 0 7px, transparent 8px),
            linear-gradient(120deg,
              rgba(255,180,220,0.35),
              rgba(180,230,255,0.45),
              rgba(200,255,220,0.35),
              rgba(255,230,180,0.35)),
            linear-gradient(to top, rgba(255,255,255,0.98), rgba(200,235,255,0.7) 50%, transparent);
          filter: blur(0.6px) saturate(1.2);
          will-change: transform;
          animation: jceFoam 2.2s ease-out forwards;
        }
        /* Iridescent bubbles */
        .jce-bubble {
          position: absolute;
          bottom: 12%;
          border-radius: 50%;
          background:
            radial-gradient(circle at 30% 28%,
              rgba(255,255,255,0.95) 0%,
              rgba(255,210,240,0.55) 28%,
              rgba(180,230,255,0.55) 55%,
              rgba(200,255,220,0.35) 75%,
              rgba(120,180,220,0.15) 100%);
          box-shadow:
            inset 0 -2px 4px rgba(255,255,255,0.6),
            inset 1px 2px 3px rgba(255,255,255,0.9),
            0 0 6px rgba(255,255,255,0.4);
          will-change: transform, opacity;
          animation: jceBubble 2s ease-out forwards;
        }
        .jce-bubble::after {
          content: "";
          position: absolute;
          top: 18%; left: 22%;
          width: 28%; height: 28%;
          background: rgba(255,255,255,0.85);
          border-radius: 50%;
          filter: blur(0.5px);
        }
        /* Falling water droplets */
        .jce-drop {
          position: absolute;
          width: 3px;
          height: 8px;
          background: linear-gradient(to bottom, rgba(220,240,255,0.2), rgba(255,255,255,0.9));
          border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
          filter: blur(0.3px);
          will-change: transform, opacity;
          animation: jceDrop 1.1s ease-in forwards;
        }
        @keyframes jceFoam {
          0% { transform: translateY(40%); opacity: 0; }
          15% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(-5%); opacity: 0; }
        }
        @keyframes jceBubble {
          0% { transform: translate(0, 0) scale(0.3); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translate(var(--dx, 0px), -220px) scale(1.1); opacity: 0; }
        }
        @keyframes jceJet {
          0% { transform: translateY(-20%) scaleY(0.7); opacity: 0.8; }
          100% { transform: translateY(120%) scaleY(1); opacity: 0; }
        }
        @keyframes jceMist {
          0% { opacity: 0; transform: scale(0.9); }
          30% { opacity: 0.9; }
          100% { opacity: 0; transform: scale(1.1); }
        }
        @keyframes jceShine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(120%); }
        }
        @keyframes jceFadeInOut {
          0%, 100% { opacity: 0; }
          15%, 80% { opacity: 1; }
        }
        @keyframes jceDrop {
          0% { transform: translateY(0) scaleY(0.6); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(180px) scaleY(1.4); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .jce-wash-fx *, .jce-bubble, .jce-wash-foam, .jce-jet, .jce-mist, .jce-wash-shine, .jce-wash-tint, .jce-drop,
          .jce-street-car, .jce-tile-car {
            animation: none !important;
          }
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

      <div className="jce-skyline-wrap">
        <img src={skyline} alt="Skyline de Junky City" className="jce-skyline" />
      </div>
      <div className="jce-street" aria-hidden="true">
        <img src={car1} className="jce-street-car" style={{ animationDuration: "9s", animationDelay: "0s" }} alt="" />
        <img src={car3} className="jce-street-car" style={{ animationDuration: "12s", animationDelay: "3s", bottom: "4px" }} alt="" />
        <img src={car2} className="jce-street-car rev" style={{ animationDuration: "7s", animationDelay: "1s" }} alt="" />
        <img src={car1} className="jce-street-car rev" style={{ animationDuration: "11s", animationDelay: "5s", top: "4px" }} alt="" />
      </div>


      <div className="jce-grid">
        <button
          className={`jce-tile jce-wide ${pulse === BUILDINGS[1].alt ? "jce-pulse" : ""}`}
          onClick={() => collect(BUILDINGS[1])}
        >
          <img src={carwash} alt="Car Wash" loading="lazy" />
          <div className={`jce-wash-fx ${washing ? "is-on" : ""}`} aria-hidden="true">
            {washing && (
              <>
                <div className="jce-wash-tint" />
                {Array.from({ length: 14 }).map((_, i) => (
                  <span
                    key={`jet-${i}`}
                    className="jce-jet"
                    style={{
                      left: `${5 + i * 6.5}%`,
                      animationDelay: `${(i % 5) * 0.07}s`,
                      opacity: 0.5 + (i % 3) * 0.15,
                    }}
                  />
                ))}
                <div className="jce-mist" />
                <div className="jce-wash-foam" />
                {Array.from({ length: 18 }).map((_, i) => {
                  const left = 4 + i * 5.3;
                  const size = 8 + ((i * 17) % 22);
                  const delay = (i % 8) * 0.09;
                  const dx = (i % 2 === 0 ? -1 : 1) * (8 + (i % 5) * 10);
                  return (
                    <span
                      key={`b-${i}`}
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
                {Array.from({ length: 10 }).map((_, i) => (
                  <span
                    key={`d-${i}`}
                    className="jce-drop"
                    style={{
                      left: `${10 + i * 8.5}%`,
                      top: `${20 + (i % 3) * 15}%`,
                      animationDelay: `${0.3 + (i % 4) * 0.18}s`,
                    }}
                  />
                ))}
                <div className="jce-wash-shine" />
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
          className={`jce-tile ${pulse === BUILDINGS[0].alt ? "jce-pulse" : ""}`}
          onClick={() => collect(BUILDINGS[0])}
        >
          <img src={garage} alt="Junky City Garage" loading="lazy" />
          <img src={car2} className="jce-tile-car" style={{ animationDuration: "5s" }} alt="" aria-hidden="true" />
        </button>
        <button
          className={`jce-tile ${pulse === BUILDINGS[3].alt ? "jce-pulse" : ""}`}
          onClick={() => collect(BUILDINGS[3])}
        >
          <img src={warehouse} alt="Junky City Warehouse" loading="lazy" />
          <img src={car1} className="jce-tile-car" style={{ animationDuration: "6s", animationDelay: "1s" }} alt="" aria-hidden="true" />
        </button>

        <button
          className={`jce-tile ${pulse === BUILDINGS[2].alt ? "jce-pulse" : ""}`}
          onClick={() => collect(BUILDINGS[2])}
        >
          <img src={shop} alt="Junky Shop" loading="lazy" />
          <img src={car3} className="jce-tile-car" style={{ animationDuration: "7s", animationDelay: "0.5s" }} alt="" aria-hidden="true" />
        </button>
        <button
          className={`jce-tile ${pulse === BUILDINGS[4].alt ? "jce-pulse" : ""}`}
          onClick={() => collect(BUILDINGS[4])}
        >
          <img src={parking} alt="Junky City Parking" loading="lazy" />
          <img src={car1} className="jce-tile-car" style={{ animationDuration: "5.5s", animationDelay: "2s" }} alt="" aria-hidden="true" />
        </button>
      </div>




      <div className="jce-play-wrap">
        <button className="jce-play-btn" onClick={play}>JOUER</button>
      </div>
    </div>
  );
}
