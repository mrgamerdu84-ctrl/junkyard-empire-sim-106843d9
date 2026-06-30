import { useAdminConfig } from "./adminConfig";

export default function AbandonedWarehouse() {
  const admin = useAdminConfig();
  const x = admin.hqX;
  const y = admin.hqY;
  const scale = Math.max(0.45, Math.min(2.8, admin.hqScale * 1.15));
  const rot = admin.hqRotation || 0;

  return (
    <svg
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 7, overflow: "visible" }}
      aria-hidden
    >
      <defs>
        <filter id="aw-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#000" floodOpacity="0.55" />
        </filter>
        <linearGradient id="aw-wall" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#3a3128" />
          <stop offset="1" stopColor="#17130f" />
        </linearGradient>
        <linearGradient id="aw-roof" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#46382b" />
          <stop offset="1" stopColor="#1f1711" />
        </linearGradient>
        <linearGradient id="aw-rust" x1="0" x2="1">
          <stop offset="0" stopColor="#5a2d15" />
          <stop offset="0.5" stopColor="#8a3f18" />
          <stop offset="1" stopColor="#2b170d" />
        </linearGradient>
      </defs>

      <g transform={`translate(${x},${y}) rotate(${rot}) scale(${scale})`} filter="url(#aw-shadow)">
        <ellipse cx="0" cy="48" rx="195" ry="72" fill="#12130f" opacity="0.78" />
        <path d="M -185 72 C -105 28, 110 28, 190 70 L 166 98 C 70 64,-74 70,-166 100 Z" fill="#242015" opacity="0.95" />

        {[-174, -148, -118, -88, 88, 118, 148, 176].map((gx, i) => (
          <g key={`grass-${i}`} transform={`translate(${gx},${66 + (i % 3) * 8})`} opacity="0.9">
            <path d="M 0 10 L -5 -8 M 0 10 L 2 -12 M 0 10 L 7 -5" stroke="#365f26" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M 7 12 L 3 -5 M 7 12 L 11 -2" stroke="#4b7a2b" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        ))}

        <g transform="translate(0,-24)">
          <polygon points="-154,-70 134,-88 162,-54 -138,-34" fill="url(#aw-roof)" stroke="#0d0b08" strokeWidth="4" />
          <polygon points="-28,-78 18,-82 4,-54 -42,-52" fill="#090807" opacity="0.85" />
          <polygon points="74,-84 112,-86 118,-58 86,-55" fill="#090807" opacity="0.7" />
          <path d="M -128 -62 L -90 -66 M -54 -70 L -8 -74 M 38 -78 L 64 -80" stroke="#7b4b24" strokeWidth="2" opacity="0.65" />

          <rect x="-138" y="-38" width="300" height="116" rx="4" fill="url(#aw-wall)" stroke="#0d0b08" strokeWidth="4" />
          <path d="M -120 -22 L -96 -4 L -118 18 M 92 -28 L 72 -8 L 104 12 M -20 8 L 2 28 L -18 50" stroke="#5a5147" strokeWidth="2" fill="none" opacity="0.8" />
          {[-118, -82, -46, 56, 92, 128].map((wx, i) => (
            <g key={`win-${i}`} transform={`translate(${wx},${-18 + (i % 2) * 8})`}>
              <rect x="-10" y="-10" width="20" height="18" rx="1" fill="#090b0d" stroke="#5b544c" strokeWidth="1.4" />
              <path d="M -9 7 L 8 -9 M -8 -8 L 8 7" stroke="#9ca3af" strokeWidth="1" opacity="0.6" />
              {(i === 1 || i === 4) && <rect x="-12" y="-2" width="24" height="5" fill="#5a351e" transform="rotate(-14)" />}
            </g>
          ))}

          <g transform="translate(0,30)">
            <rect x="-48" y="-36" width="96" height="82" rx="2" fill="#201915" stroke="#0b0907" strokeWidth="3" />
            <rect x="-40" y="-28" width="80" height="70" fill="url(#aw-rust)" opacity="0.85" />
            {[-28, -12, 4, 20, 36].map((lx) => <line key={lx} x1={lx} y1="-28" x2={lx} y2="42" stroke="#2d1a10" strokeWidth="2" opacity="0.65" />)}
            <path d="M -42 -20 L 34 34 M 36 -22 L -30 28" stroke="#120b07" strokeWidth="3" opacity="0.6" />
            <text x="0" y="-44" textAnchor="middle" fontSize="10" fontWeight="900" fill="#d6b15b" stroke="#000" strokeWidth="2" paintOrder="stroke">TAXI CO.</text>
          </g>

          <g transform="translate(108,26)">
            <rect x="-28" y="-28" width="56" height="70" rx="2" fill="#241d17" stroke="#0b0907" strokeWidth="3" />
            <rect x="-18" y="-18" width="18" height="18" fill="#08090a" stroke="#6b6259" strokeWidth="1" />
            <rect x="8" y="-18" width="14" height="18" fill="#08090a" stroke="#6b6259" strokeWidth="1" />
            <rect x="-12" y="10" width="24" height="32" fill="#111" stroke="#4a3322" strokeWidth="1.5" />
            <text x="0" y="54" textAnchor="middle" fontSize="7" fontWeight="800" fill="#b45309">BUREAU</text>
          </g>
        </g>

        <g transform="translate(-84,72) rotate(-8)">
          <ellipse cx="0" cy="18" rx="34" ry="7" fill="#000" opacity="0.35" />
          <rect x="-32" y="-10" width="64" height="24" rx="6" fill="#a87916" stroke="#1f1608" strokeWidth="2" opacity="0.96" />
          <path d="M -18 -10 Q 0 -24 18 -10" fill="#5b3d0f" stroke="#1f1608" strokeWidth="1.5" />
          <rect x="-14" y="-9" width="11" height="8" fill="#1e293b" opacity="0.7" />
          <rect x="5" y="-9" width="11" height="8" fill="#1e293b" opacity="0.7" />
          <circle cx="-20" cy="14" r="5" fill="#111" stroke="#555" strokeWidth="1" />
          <circle cx="20" cy="14" r="5" fill="#111" stroke="#555" strokeWidth="1" />
          <text x="0" y="4" textAnchor="middle" fontSize="9" fontWeight="900" fill="#2b1b05">TAXI</text>
          <path d="M -34 -16 C -18 -24, 16 -25, 34 -18" stroke="#d6d3d1" strokeWidth="2" opacity="0.45" strokeDasharray="5 5" />
        </g>

        <g transform="translate(118,86)">
          {[-24, -8, 8].map((px, i) => <circle key={i} cx={px} cy={i % 2 ? 5 : 0} r="11" fill="#111" stroke="#3f3f46" strokeWidth="3" />)}
          <rect x="18" y="-8" width="30" height="15" rx="2" fill="#5a351e" stroke="#1f130b" strokeWidth="1" />
          <rect x="48" y="-12" width="16" height="24" rx="2" fill="#4b2c17" stroke="#1f130b" strokeWidth="1" />
        </g>

        <g transform="translate(-140,98)">
          <rect x="-22" y="-8" width="44" height="16" rx="2" fill="#3f2d1f" stroke="#1f130b" strokeWidth="1.4" />
          <rect x="-18" y="-18" width="36" height="10" fill="#5a3a22" stroke="#1f130b" strokeWidth="1" />
          <line x1="-16" y1="-2" x2="18" y2="-14" stroke="#7c4a24" strokeWidth="2" />
        </g>

        <g transform="translate(0,120)">
          <rect x="-86" y="-16" width="172" height="26" rx="3" fill="url(#aw-rust)" stroke="#170d07" strokeWidth="3" />
          <path d="M -76 6 L -36 -14 M -20 8 L 22 -14 M 40 8 L 78 -13" stroke="#2b170d" strokeWidth="3" opacity="0.7" />
          <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight="900" fill="#fbbf24" stroke="#000" strokeWidth="2" paintOrder="stroke">PORTAIL ROUILLÉ</text>
        </g>

        <text x="0" y="164" textAnchor="middle" fontSize="13" fontWeight="900" fill="#facc15" stroke="#000" strokeWidth="3" paintOrder="stroke" style={{ letterSpacing: 1.2 }}>
          CHAPITRE 1 — ENTREPÔT ABANDONNÉ
        </text>
      </g>
    </svg>
  );
}
