import { useEffect, useState } from "react";

/* eslint-disable prettier/prettier */

/* ============================================================
 * JUNKY CITY EMPIRE — overlay aligné sur citymap.jpg
 * IMPORTANT : le SVG utilise le même ratio que l'image 1920x1080.
 * Avec preserveAspectRatio="xMidYMid slice", les voitures restent
 * calées sur les routes même en mobile recadré.
 * ============================================================ */

const ROADS = [
  // Rocade basse — calée sur la grande route diagonale visible au premier plan mobile.
  "M 10 965 C 220 900 470 840 690 812 C 870 790 1030 808 1195 842 C 1395 884 1605 835 1910 720",
  // Voie opposée de la rocade, décalée dans le même boulevard.
  "M 1910 785 C 1605 900 1390 948 1180 904 C 1010 868 860 838 690 862 C 470 890 225 950 10 1010",
  // Avenue centrale — suit la route au milieu de la casse et rejoint la ville abandonnée.
  "M 5 650 C 220 610 455 590 675 610 C 890 632 1045 630 1215 575 C 1425 506 1610 510 1910 595",
  // Voie opposée centrale, même tracé mais un peu plus bas pour éviter le hors-route.
  "M 1910 655 C 1620 565 1425 560 1225 628 C 1040 690 875 682 670 658 C 445 635 220 660 5 710",
  // Route de service verticale à gauche, visible près de la casse et des clôtures.
  "M 555 1075 C 585 945 620 845 655 735 C 700 595 742 455 785 320",
  // Bretelle garage/ville abandonnée à droite.
  "M 1300 1070 C 1265 930 1248 815 1275 690 C 1305 552 1372 455 1482 350",
  // Route chantier haute, discrète mais utilisable pour les véhicules en arrière-plan.
  "M 250 545 C 500 508 760 500 960 525 C 1165 552 1325 525 1585 485",
];

type CarSpec = {
  color: string;
  accent: string;
  duration: number;
  delay: number;
  pathIdx: number;
  flip?: boolean;
  scale?: number;
};

const CARS: CarSpec[] = [
  { color: "#d83a2a", accent: "#7c1c10", duration: 24, delay: -2, pathIdx: 0, scale: 1.04 },
  { color: "#f5c542", accent: "#9c7a1c", duration: 27, delay: -11, pathIdx: 0, scale: 1.06 },
  { color: "#2b6ed8", accent: "#143f7c", duration: 23, delay: -8, pathIdx: 0, scale: 1.05 },
  { color: "#e8edf2", accent: "#8a8e94", duration: 25, delay: -17, pathIdx: 1, flip: true, scale: 1.0 },
  { color: "#12151a", accent: "#050607", duration: 28, delay: -6, pathIdx: 1, flip: true, scale: 1.0 },
  { color: "#3a8a48", accent: "#1c4a22", duration: 31, delay: -21, pathIdx: 2, scale: 0.96 },
  { color: "#d97a2a", accent: "#7a3a10", duration: 29, delay: -14, pathIdx: 2, scale: 0.98 },
  { color: "#b81c4a", accent: "#5c0a20", duration: 32, delay: -4, pathIdx: 3, flip: true, scale: 0.96 },
  { color: "#1a3a6a", accent: "#0a1c40", duration: 35, delay: -18, pathIdx: 3, flip: true, scale: 0.96 },
  { color: "#8f969e", accent: "#3a3e44", duration: 34, delay: -25, pathIdx: 4, scale: 0.9 },
  { color: "#ff6b35", accent: "#8f2d10", duration: 36, delay: -13, pathIdx: 5, flip: true, scale: 0.92 },
  { color: "#4ed6c5", accent: "#187266", duration: 30, delay: -22, pathIdx: 6, scale: 0.9 },
];

const LAMPS: [number, number][] = [
  [420, 655], [600, 650], [805, 675], [1015, 680], [1240, 625], [1460, 560],
  [280, 855], [485, 805], [700, 790], [930, 795], [1160, 825], [1410, 860], [1645, 825],
  [645, 880], [682, 690], [1280, 880], [1275, 690],
];

function CarSVG({ color, accent, scale = 1 }: { color: string; accent: string; scale?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <ellipse cx="0" cy="8" rx="31" ry="14" fill="rgba(0,0,0,0.42)" />
      <path d="M -30 -10 C -24 -18 18 -18 28 -8 L 34 0 L 27 10 C 12 18 -20 17 -31 9 L -36 0 Z" fill={accent} opacity="0.95" />
      <path d="M -28 -12 C -18 -19 16 -18 28 -8 L 33 0 L 26 9 C 11 15 -18 15 -30 8 L -35 0 Z" fill={color} />
      <path d="M -10 -12 L 13 -11 C 19 -8 22 -4 23 0 C 20 5 16 8 10 10 L -12 10 C -18 7 -20 4 -21 0 C -20 -5 -17 -9 -10 -12 Z" fill="#101b2b" opacity="0.94" />
      <path d="M 12 -10 C 20 -8 25 -4 27 0 C 24 3 20 6 12 8 L 8 2 L 8 -6 Z" fill="#d8f2ff" opacity="0.34" />
      <path d="M -13 -10 C -20 -8 -24 -4 -25 0 C -23 4 -19 7 -13 8 L -9 3 L -9 -6 Z" fill="#d8f2ff" opacity="0.22" />
      <rect x="10" y="-18" width="12" height="5" rx="2" fill="#08090b" />
      <rect x="10" y="13" width="12" height="5" rx="2" fill="#08090b" />
      <rect x="-24" y="-17" width="12" height="5" rx="2" fill="#08090b" />
      <rect x="-24" y="12" width="12" height="5" rx="2" fill="#08090b" />
      <circle cx="33" cy="-5" r="2.2" fill="#fff7c0" />
      <circle cx="33" cy="5" r="2.2" fill="#fff7c0" />
      <circle cx="-32" cy="-5" r="2" fill="#ff3028" />
      <circle cx="-32" cy="5" r="2" fill="#ff3028" />
      <path d="M -3 -9 C 7 -10 17 -7 23 -2" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.22" />
    </g>
  );
}

function TowTruckSVG({ color, accent }: { color: string; accent: string }) {
  return (
    <g>
      <ellipse cx="0" cy="9" rx="44" ry="17" fill="rgba(0,0,0,0.46)" />
      <path d="M -45 -13 L 5 -17 L 12 15 L -42 16 Z" fill="#262b30" />
      <path d="M -38 -9 L -3 -11 L 1 10 L -35 11 Z" fill="#6b4a35" />
      <path d="M 8 -16 L 42 -12 L 46 11 L 12 16 Z" fill={color} />
      <path d="M 19 -12 L 39 -9 L 40 7 L 20 10 Z" fill="#0c1a2e" opacity="0.95" />
      <path d="M -2 -17 L -20 -30" stroke="#ffb22e" strokeWidth="5" strokeLinecap="round" />
      <circle cx="24" cy="-18" r="5" fill="#ffae00">
        <animate attributeName="opacity" values="1;0.25;1" dur="0.42s" repeatCount="indefinite" />
      </circle>
      <rect x="-31" y="-22" width="13" height="6" rx="2" fill="#07080a" />
      <rect x="-31" y="15" width="13" height="6" rx="2" fill="#07080a" />
      <rect x="18" y="-22" width="13" height="6" rx="2" fill="#07080a" />
      <rect x="18" y="15" width="13" height="6" rx="2" fill="#07080a" />
      <circle cx="46" cy="-5" r="2.8" fill="#fff7c0" />
      <circle cx="46" cy="6" r="2.8" fill="#fff7c0" />
      <line x1="13" y1="0" x2="42" y2="0" stroke={accent} strokeWidth="1.2" opacity="0.7" />
    </g>
  );
}

function Lamp({ x, y, night }: { x: number; y: number; night: number }) {
  const lit = night > 0.32;
  return (
    <g transform={`translate(${x},${y})`}>
      {lit && (
        <circle r="46" fill="#ffd66a" opacity={night * 0.28}>
          <animate attributeName="opacity" values={`${night * 0.2};${night * 0.36};${night * 0.2}`} dur="3s" repeatCount="indefinite" />
        </circle>
      )}
      <path d="M 0 30 L 0 0 L -18 -7" stroke="#191b1f" strokeWidth="5" strokeLinecap="round" fill="none" />
      <circle cx="-20" cy="-7" r="6" fill={lit ? "#fff5b0" : "#4f5148"} />
      {lit && <circle cx="-20" cy="-7" r="12" fill="#ffd66a" opacity="0.35" />}
    </g>
  );
}

export default function CityTraffic() {
  const [night, setNight] = useState(0.25);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = (performance.now() % 180000) / 180000;
      const daylight = Math.max(0, Math.sin(t * Math.PI * 2));
      setNight(0.18 + (1 - daylight) * 0.72);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 3 }}
    >
      <defs>
        {ROADS.map((d, i) => (
          <path key={i} id={`jce-road-${i}`} d={d} />
        ))}
        <filter id="jce-soft-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>

      <g opacity="0.26">
        {ROADS.map((d, i) => (
          <path key={i} d={d} stroke="#0b0d10" strokeWidth={i >= 4 ? 34 : 46} fill="none" strokeLinecap="round" />
        ))}
        {ROADS.slice(0, 4).map((d, i) => (
          <path key={`dash-${i}`} d={d} stroke="#f6d56a" strokeWidth="2.4" strokeDasharray="18 18" fill="none" opacity="0.72" />
        ))}
      </g>

      <g filter="url(#jce-soft-shadow)">
        {LAMPS.map(([x, y], i) => (
          <Lamp key={i} x={x} y={y} night={night} />
        ))}
      </g>

      {CARS.map((car, i) => (
        <g key={i} filter="url(#jce-soft-shadow)">
          <CarSVG color={car.color} accent={car.accent} scale={car.scale} />
          <animateMotion
            dur={`${car.duration}s`}
            begin={`${car.delay}s`}
            repeatCount="indefinite"
            rotate="auto"
            keyPoints={car.flip ? "1;0" : "0;1"}
            keyTimes="0;1"
          >
            <mpath href={`#jce-road-${car.pathIdx}`} />
          </animateMotion>
        </g>
      ))}

      <g filter="url(#jce-soft-shadow)">
        <TowTruckSVG color="#ff8800" accent="#7a3a00" />
        <animateMotion dur="34s" begin="-4s" repeatCount="indefinite" rotate="auto">
          <mpath href="#jce-road-1" />
        </animateMotion>
      </g>
      <g filter="url(#jce-soft-shadow)">
        <TowTruckSVG color="#f5c542" accent="#7a5a10" />
        <animateMotion dur="38s" begin="-19s" repeatCount="indefinite" rotate="auto" keyPoints="1;0" keyTimes="0;1">
          <mpath href="#jce-road-3" />
        </animateMotion>
      </g>

      <rect width="1920" height="1080" fill="#0a1530" opacity={night * 0.25} pointerEvents="none" />
    </svg>
  );
}