import { useState, useEffect, useRef } from "react";

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
  const [tipVisible, setTipVisible] = useState(false);
  const clamped = Math.min(100, Math.max(0, progress));
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
    const t = setTimeout(() => setTipVisible(true), 600);
    return () => clearTimeout(t);
  }, []);

  // Canvas starfield + speed lines
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    interface Star {
      x: number;
      y: number;
      z: number;
      pz: number;
    }
    const stars: Star[] = Array.from({ length: 300 }, () => ({
      x: (Math.random() - 0.5) * 2000,
      y: (Math.random() - 0.5) * 2000,
      z: Math.random() * 2000,
      pz: 0,
    }));

    const speedLines: { x: number; y: number; len: number; speed: number; alpha: number }[] =
      Array.from({ length: 40 }, () => ({
        x: Math.random(),
        y: Math.random(),
        len: Math.random() * 80 + 20,
        speed: Math.random() * 8 + 4,
        alpha: Math.random() * 0.4 + 0.1,
      }));

    const draw = () => {
      if (!ctx || !canvas) return;
      ctx.fillStyle = "rgba(6,7,14,0.35)";
      ctx.fillRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;

      // Warp stars
      for (const s of stars) {
        s.z -= 8;
        if (s.z <= 0) {
          s.x = (Math.random() - 0.5) * 2000;
          s.y = (Math.random() - 0.5) * 2000;
          s.z = 2000;
          s.pz = 2000;
        }
        const sx = (s.x / s.z) * 800 + cx;
        const sy = (s.y / s.z) * 800 + cy;
        const r = Math.max(0.3, (1 - s.z / 2000) * 2.5);

        const px = (s.x / s.pz) * 800 + cx;
        const py = (s.y / s.pz) * 800 + cy;
        s.pz = s.z;

        const grad = ctx.createLinearGradient(px, py, sx, sy);
        grad.addColorStop(0, "rgba(253,224,71,0)");
        grad.addColorStop(1, `rgba(253,224,71,${0.3 + r * 0.15})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = r;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();

        ctx.fillStyle = `rgba(255,255,255,${0.5 + r * 0.2})`;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Speed lines
      for (const sl of speedLines) {
        sl.y += sl.speed / h;
        if (sl.y > 1.1) {
          sl.y = -0.1;
          sl.x = Math.random();
          sl.alpha = Math.random() * 0.4 + 0.1;
        }
        const ly = sl.y * h;
        const lx = sl.x * w;
        const grad = ctx.createLinearGradient(lx, ly, lx, ly - sl.len);
        grad.addColorStop(0, `rgba(253,224,71,0)`);
        grad.addColorStop(0.5, `rgba(253,224,71,${sl.alpha * 0.5})`);
        grad.addColorStop(1, `rgba(255,255,255,${sl.alpha})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, ly - sl.len);
        ctx.stroke();
      }

      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Segmented bar: 12 segments
  const SEGMENTS = 12;
  const filledSegments = Math.floor((clamped / 100) * SEGMENTS);

  return (
    <div className="ld-root">
      <style>{`
        .ld-root {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          background: #06070e;
          overflow: hidden;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .ld-canvas {
          position: absolute; inset: 0; z-index: 1;
          width: 100%; height: 100%;
        }
        /* Vignette + gradient overlay */
        .ld-overlay {
          position: absolute; inset: 0; z-index: 2; pointer-events: none;
          background:
            radial-gradient(ellipse at center, transparent 40%, rgba(6,7,14,0.7) 100%),
            linear-gradient(180deg, rgba(6,7,14,0.2) 0%, rgba(6,7,14,0) 40%, rgba(6,7,14,0.85) 100%);
        }
        /* Scanlines */
        .ld-scanlines {
          position: absolute; inset: 0; z-index: 10; pointer-events: none;
          background: repeating-linear-gradient(
            0deg,
            rgba(0,0,0,0) 0px,
            rgba(0,0,0,0) 2px,
            rgba(0,0,0,0.08) 2px,
            rgba(0,0,0,0.08) 4px
          );
          mix-blend-mode: multiply;
        }
        /* Perspective grid floor */
        .ld-grid {
          position: absolute; bottom: 0; left: 0; right: 0; z-index: 3;
          height: 45vh;
          background:
            linear-gradient(180deg, rgba(6,7,14,0) 0%, rgba(6,7,14,0.3) 40%, rgba(6,7,14,0.95) 100%),
            linear-gradient(90deg, rgba(253,224,71,0.06) 1px, transparent 1px),
            linear-gradient(0deg, rgba(253,224,71,0.06) 1px, transparent 1px);
          background-size: 100% 100%, 60px 100%, 100% 40px;
          transform: perspective(300px) rotateX(55deg) translateY(20px);
          transform-origin: bottom center;
          mask-image: linear-gradient(180deg, transparent 0%, black 30%);
          -webkit-mask-image: linear-gradient(180deg, transparent 0%, black 30%);
          animation: ldGridMove 2s linear infinite;
        }
        @keyframes ldGridMove {
          from { background-position: 0 0, 0 0, 0 0; }
          to   { background-position: 0 0, 0 0, 0 40px; }
        }
        /* City skyline silhouettes */
        .ld-skyline {
          position: absolute; bottom: 28vh; left: 0; right: 0; z-index: 4;
          height: 14vh;
          background-repeat: repeat-x;
          background-size: auto 100%;
          opacity: 0.9;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 180'%3E%3Cpath fill='%230a0c16' d='M0,180 L0,120 L20,120 L20,70 L40,70 L40,130 L60,130 L60,50 L90,50 L90,140 L110,140 L110,80 L140,80 L140,150 L170,150 L170,60 L200,60 L200,110 L230,110 L230,40 L270,40 L270,160 L300,160 L300,90 L340,90 L340,140 L380,140 L380,55 L420,55 L420,170 L460,170 L460,100 L500,100 L500,130 L540,130 L540,45 L580,45 L580,155 L620,155 L620,75 L660,75 L660,145 L700,145 L700,65 L740,65 L740,135 L780,135 L780,85 L820,85 L820,165 L860,165 L860,95 L900,95 L900,150 L940,150 L940,70 L980,70 L980,140 L1000,140 L1000,180 Z'/%3E%3C/svg%3E");
        }
        .ld-skyline-glow {
          position: absolute; bottom: 28vh; left: 0; right: 0; z-index: 4;
          height: 14vh;
          background-repeat: repeat-x;
          background-size: auto 100%;
          opacity: 0.15;
          filter: blur(6px);
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 180'%3E%3Cpath fill='%23fde047' d='M0,180 L0,120 L20,120 L20,70 L40,70 L40,130 L60,130 L60,50 L90,50 L90,140 L110,140 L110,80 L140,80 L140,150 L170,150 L170,60 L200,60 L200,110 L230,110 L230,40 L270,40 L270,160 L300,160 L300,90 L340,90 L340,140 L380,140 L380,55 L420,55 L420,170 L460,170 L460,100 L500,100 L500,130 L540,130 L540,45 L580,45 L580,155 L620,155 L620,75 L660,75 L660,145 L700,145 L700,65 L740,65 L740,135 L780,135 L780,85 L820,85 L820,165 L860,165 L860,95 L900,95 L900,150 L940,150 L940,70 L980,70 L980,140 L1000,140 L1000,180 Z'/%3E%3C/svg%3E");
        }
        /* Neon city windows */
        .ld-windows {
          position: absolute; bottom: 30vh; left: 0; right: 0; z-index: 5;
          height: 10vh;
          pointer-events: none;
          display: flex;
          justify-content: space-around;
          align-items: flex-end;
          padding: 0 5vw;
          gap: 3vw;
        }
        .ld-window-col {
          display: flex; flex-direction: column; gap: 6px;
          align-items: center;
        }
        .ld-window {
          width: 3px; height: 5px;
          border-radius: 1px;
          opacity: 0.6;
          animation: ldWindowPulse 3s ease-in-out infinite alternate;
        }
        .ld-window.w1 { background: #fde047; animation-delay: 0s; }
        .ld-window.w2 { background: #f472b6; animation-delay: 0.7s; }
        .ld-window.w3 { background: #60a5fa; animation-delay: 1.4s; }
        .ld-window.w4 { background: #34d399; animation-delay: 2.1s; }
        @keyframes ldWindowPulse {
          from { opacity: 0.2; }
          to   { opacity: 0.85; }
        }
        /* Road */
        .ld-road {
          position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); z-index: 6;
          width: 100%; height: 32vh;
          background: linear-gradient(180deg,
            transparent 0%,
            rgba(30,32,45,0.7) 15%,
            rgba(15,16,25,0.98) 100%
          );
          clip-path: polygon(38% 0%, 62% 0%, 82% 100%, 18% 100%);
        }
        .ld-road-lines {
          position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); z-index: 7;
          width: 5px; height: 32vh;
          background: repeating-linear-gradient(
            0deg,
            rgba(253,224,71,0.25) 0px,
            rgba(253,224,71,0.25) 16px,
            transparent 16px,
            transparent 38px
          );
          animation: ldRoadMove 0.6s linear infinite;
          clip-path: polygon(0% 0%, 100% 0%, 60% 100%, 40% 100%);
        }
        @keyframes ldRoadMove {
          from { background-position: 0 0; }
          to   { background-position: 0 54px; }
        }
        .ld-road-edge-l, .ld-road-edge-r {
          position: absolute; bottom: 0; z-index: 7;
          width: 3px; height: 32vh;
          animation: ldRoadMove 0.6s linear infinite;
          opacity: 0.6;
        }
        .ld-road-edge-l {
          left: 17.8%;
          background: repeating-linear-gradient(
            0deg,
            #ef4444 0px, #ef4444 14px,
            #fff 14px, #fff 28px
          );
          transform: skewX(7deg);
        }
        .ld-road-edge-r {
          right: 17.8%;
          background: repeating-linear-gradient(
            0deg,
            #ef4444 0px, #ef4444 14px,
            #fff 14px, #fff 28px
          );
          transform: skewX(-7deg);
        }
        /* Car */
        .ld-car-wrap {
          position: relative; z-index: 10;
          margin-bottom: 10vh;
          animation: ldCarBounce 0.5s infinite alternate ease-in-out;
        }
        @keyframes ldCarBounce {
          from { transform: translateY(0) rotate(0deg); }
          to   { transform: translateY(-5px) rotate(0.3deg); }
        }
        .ld-car-vibrate {
          animation: ldVibrate 0.1s infinite linear;
        }
        @keyframes ldVibrate {
          0%   { transform: translate(0, 0); }
          25%  { transform: translate(0.3px, -0.3px); }
          50%  { transform: translate(-0.3px, 0.3px); }
          75%  { transform: translate(0.3px, 0.3px); }
          100% { transform: translate(0, 0); }
        }
        /* Headlight beams */
        .ld-beam {
          position: absolute; top: 56px; z-index: 0;
          width: 0; height: 0;
          opacity: 0;
          animation: ldBeam 1.8s ease-in-out infinite alternate;
        }
        .ld-beam-l {
          left: -36px;
          border-right: 70px solid rgba(253,224,71,0.12);
          border-top: 12px solid transparent;
          border-bottom: 12px solid transparent;
          filter: blur(5px);
        }
        .ld-beam-r {
          right: -36px;
          border-left: 70px solid rgba(253,224,71,0.12);
          border-top: 12px solid transparent;
          border-bottom: 12px solid transparent;
          filter: blur(5px);
        }
        @keyframes ldBeam {
          from { opacity: 0.3; }
          to   { opacity: 0.75; }
        }
        /* Exhaust */
        .ld-smoke {
          position: absolute; left: -18px; top: 62px;
          display: flex; gap: 3px;
        }
        .ld-smoke-p {
          width: 5px; height: 5px; border-radius: 50%; background: rgba(255,255,255,0.2);
          animation: ldSmokeP 0.9s ease-out infinite;
        }
        .ld-smoke-p:nth-child(2) { animation-delay: 0.25s; }
        .ld-smoke-p:nth-child(3) { animation-delay: 0.5s; }
        @keyframes ldSmokeP {
          from { transform: scale(1); opacity: 0.35; }
          to   { transform: scale(2.2) translateX(-12px) translateY(-6px); opacity: 0; }
        }
        /* Title */
        .ld-title-wrap {
          position: relative; z-index: 10;
          display: flex; flex-direction: column; align-items: center;
          margin-bottom: 2vh;
        }
        .ld-title {
          color: #fde047;
          font-size: clamp(22px, 5vw, 38px);
          font-weight: 900;
          letter-spacing: 6px;
          text-transform: uppercase;
          text-shadow:
            0 0 10px rgba(253,224,71,0.4),
            0 0 40px rgba(253,224,71,0.15),
            0 2px 6px rgba(0,0,0,0.7);
          animation: ldTitlePulse 2.5s ease-in-out infinite;
        }
        @keyframes ldTitlePulse {
          0%, 100% { opacity: 1; text-shadow: 0 0 10px rgba(253,224,71,0.4), 0 0 40px rgba(253,224,71,0.15), 0 2px 6px rgba(0,0,0,0.7); }
          50% { opacity: 0.85; text-shadow: 0 0 20px rgba(253,224,71,0.6), 0 0 60px rgba(253,224,71,0.25), 0 2px 6px rgba(0,0,0,0.7); }
        }
        .ld-subtitle {
          color: rgba(253,224,71,0.5);
          font-size: clamp(10px, 2vw, 13px);
          font-weight: 700;
          letter-spacing: 8px;
          text-transform: uppercase;
          margin-top: 4px;
          text-shadow: 0 1px 4px rgba(0,0,0,0.6);
        }
        /* Segmented progress bar */
        .ld-bar-wrap {
          position: relative; z-index: 10;
          display: flex; gap: 4px;
          width: min(380px, 78vw);
          margin-bottom: 8px;
        }
        .ld-seg {
          flex: 1;
          height: 5px;
          border-radius: 2px;
          background: rgba(255,255,255,0.06);
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.4);
          position: relative;
          overflow: hidden;
        }
        .ld-seg-fill {
          position: absolute; inset: 0;
          border-radius: 2px;
          background: linear-gradient(90deg, #eab308, #fde047, #facc15);
          box-shadow: 0 0 8px rgba(253,224,71,0.35);
          animation: ldSegGlow 1.5s ease-in-out infinite alternate;
        }
        @keyframes ldSegGlow {
          from { box-shadow: 0 0 4px rgba(253,224,71,0.2); }
          to   { box-shadow: 0 0 14px rgba(253,224,71,0.55); }
        }
        .ld-pct {
          color: rgba(253,224,71,0.55);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 3px;
          z-index: 10; position: relative;
          font-variant-numeric: tabular-nums;
        }
        .ld-tip {
          margin-top: 10px;
          color: rgba(255,255,255,0.45);
          font-size: 12px;
          font-style: italic;
          text-align: center;
          z-index: 10; position: relative;
          max-width: min(340px, 82vw);
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .ld-tip.visible {
          opacity: 1;
          transform: translateY(0);
        }
        /* Decorative corner brackets */
        .ld-corner {
          position: absolute; z-index: 10;
          width: 24px; height: 24px;
          border-color: rgba(253,224,71,0.25);
          border-style: solid;
        }
        .ld-corner-tl { top: 24px; left: 24px; border-width: 2px 0 0 2px; }
        .ld-corner-tr { top: 24px; right: 24px; border-width: 2px 2px 0 0; }
        .ld-corner-bl { bottom: 24px; left: 24px; border-width: 0 0 2px 2px; }
        .ld-corner-br { bottom: 24px; right: 24px; border-width: 0 2px 2px 0; }
        /* Version badge */
        .ld-ver {
          position: absolute; bottom: 12px; right: 16px; z-index: 10;
          color: rgba(255,255,255,0.15);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
      `}</style>

      {/* Canvas background */}
      <canvas ref={canvasRef} className="ld-canvas" />

      {/* Overlays */}
      <div className="ld-overlay" />
      <div className="ld-scanlines" />

      {/* Perspective grid */}
      <div className="ld-grid" />

      {/* Skyline */}
      <div className="ld-skyline-glow" />
      <div className="ld-skyline" />

      {/* Neon windows */}
      <div className="ld-windows">
        {Array.from({ length: 20 }).map((_, ci) => (
          <div key={ci} className="ld-window-col">
            {Array.from({ length: Math.floor(Math.random() * 4) + 2 }).map((_, ri) => {
              const w = ["w1","w2","w3","w4"][Math.floor(Math.random()*4)];
              return <div key={ri} className={`ld-window ${w}`} style={{ animationDelay: `${Math.random()*3}s` }} />;
            })}
          </div>
        ))}
      </div>

      {/* Road */}
      <div className="ld-road" />
      <div className="ld-road-lines" />
      <div className="ld-road-edge-l" />
      <div className="ld-road-edge-r" />

      {/* Title */}
      <div className="ld-title-wrap">
        <div className="ld-title">City Cab Empire</div>
        <div className="ld-subtitle">Chargement en cours</div>
      </div>

      {/* Car */}
      <div className="ld-car-wrap">
        <div className="ld-car-vibrate" style={{ position: "relative" }}>
          <div className="ld-beam ld-beam-l" />
          <div className="ld-beam ld-beam-r" />
          <div className="ld-smoke">
            <div className="ld-smoke-p" />
            <div className="ld-smoke-p" />
            <div className="ld-smoke-p" />
          </div>
          <svg width="168" height="96" viewBox="0 0 168 96" xmlns="http://www.w3.org/2000/svg">
            {/* Shadow */}
            <ellipse cx="84" cy="90" rx="68" ry="6" fill="#000" opacity="0.55" />
            {/* Body rear */}
            <path d="M16,62 L16,44 Q16,36 24,34 L50,30 L62,18 Q66,14 72,14 L118,14 Q126,14 132,18 L142,26 L150,32 Q158,36 158,44 L158,62 Z"
                  fill="#b45309" stroke="#3f2006" strokeWidth="2" strokeLinejoin="round" />
            {/* Body front */}
            <path d="M18,62 L18,46 Q18,38 26,36 L52,32 L64,20 Q68,16 74,16 L116,16 Q124,16 130,20 L140,28 L148,34 Q156,38 156,46 L156,62 Z"
                  fill="#facc15" stroke="#a16207" strokeWidth="1.5" strokeLinejoin="round" />
            {/* Roof */}
            <path d="M60,30 L68,18 L122,18 L132,30 Z" fill="#1e293b" stroke="#0f172a" strokeWidth="1.5" />
            {/* Windows */}
            <path d="M64,28 L70,20 L108,20 L114,28 Z" fill="#38bdf8" opacity="0.65" />
            <path d="M116,28 L124,20 L132,30 Z" fill="#38bdf8" opacity="0.45" />
            {/* Door line */}
            <path d="M84,20 L84,60" stroke="#a16207" strokeWidth="1" opacity="0.5" />
            {/* Handle */}
            <rect x="88" y="36" width="11" height="3.5" rx="1.5" fill="#713f12" />
            {/* Bumpers */}
            <rect x="12" y="56" width="10" height="9" rx="3" fill="#475569" />
            <rect x="146" y="56" width="10" height="9" rx="3" fill="#475569" />
            {/* Headlights */}
            <ellipse cx="18" cy="50" rx="6" ry="5" fill="#fefce8" />
            <ellipse cx="154" cy="50" rx="6" ry="5" fill="#fefce8" />
            {/* Taillights */}
            <ellipse cx="18" cy="58" rx="5" ry="4" fill="#ef4444" />
            <ellipse cx="154" cy="58" rx="5" ry="4" fill="#ef4444" />
            {/* License plate */}
            <rect x="66" y="62" width="40" height="12" rx="3" fill="#f8fafc" stroke="#334155" strokeWidth="1" />
            <text x="86" y="70.5" fontSize="7" fontWeight="900" textAnchor="middle" fill="#0f172a">TAXI-01</text>
            {/* Wheels */}
            <g>
              <circle cx="40" cy="66" r="12" fill="#0f172a" stroke="#1e293b" strokeWidth="3" />
              <circle cx="40" cy="66" r="6" fill="#94a3b8" />
              <line x1="40" y1="60" x2="40" y2="72" stroke="#475569" strokeWidth="2" />
              <line x1="34" y1="66" x2="46" y2="66" stroke="#475569" strokeWidth="2" />
            </g>
            <g>
              <circle cx="130" cy="66" r="12" fill="#0f172a" stroke="#1e293b" strokeWidth="3" />
              <circle cx="130" cy="66" r="6" fill="#94a3b8" />
              <line x1="130" y1="60" x2="130" y2="72" stroke="#475569" strokeWidth="2" />
              <line x1="124" y1="66" x2="136" y2="66" stroke="#475569" strokeWidth="2" />
            </g>
            {/* Roof light */}
            <rect x="76" y="8" width="18" height="7" rx="2" fill="#475569" />
            <rect x="78" y="5" width="14" height="5" rx="1.5" fill="#3b82f6" opacity="0.9" />
            <ellipse cx="85" cy="3" rx="7" ry="3.5" fill="#60a5fa" opacity="0.8" />
            {/* Glow on roof light */}
            <ellipse cx="85" cy="3" rx="14" ry="8" fill="url(#glow)" opacity="0.25" />
            <defs>
              <radialGradient id="glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Segmented progress bar */}
      <div className="ld-bar-wrap">
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <div key={i} className="ld-seg">
            {i < filledSegments && <div className="ld-seg-fill" />}
          </div>
        ))}
      </div>

      <div className="ld-pct">{Math.floor(clamped)}%</div>

      <div className={`ld-tip ${tipVisible ? "visible" : ""}`}>{tip}</div>

      {/* Corner brackets */}
      <div className="ld-corner ld-corner-tl" />
      <div className="ld-corner ld-corner-tr" />
      <div className="ld-corner ld-corner-bl" />
      <div className="ld-corner ld-corner-br" />

      <div className="ld-ver">v1.14.0</div>
    </div>
  );
}
