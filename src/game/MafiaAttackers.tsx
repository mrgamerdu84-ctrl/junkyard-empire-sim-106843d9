// =============================================================
// Mafia : voitures noires qui sillonnent la ville pour saboter
// la flotte du joueur. On tape dessus pour les faire exploser
// → +100 $ versés via l'événement "jce.player.cashDelta".
// La pression augmente avec le temps (vagues de plus en plus
// fréquentes et plus de voitures simultanées).
// =============================================================
import { useEffect, useRef, useState } from "react";

type Lane = { x1: number; y1: number; x2: number; y2: number };

// Quelques axes de circulation simples, alignés sur la trame de la
// ville (viewBox 1920x1080). Suffisant pour donner l'illusion d'un
// trafic mafieux qui traverse les avenues.
const LANES: Lane[] = [
  { x1: -80, y1: 220, x2: 2000, y2: 240 },
  { x1: 2000, y1: 470, x2: -80, y2: 460 },
  { x1: -80, y1: 720, x2: 2000, y2: 740 },
  { x1: 2000, y1: 880, x2: -80, y2: 860 },
  { x1: 320, y1: -80, x2: 340, y2: 1160 },
  { x1: 760, y1: 1160, x2: 740, y2: -80 },
  { x1: 1280, y1: -80, x2: 1300, y2: 1160 },
  { x1: 1620, y1: 1160, x2: 1600, y2: -80 },
];

type Mafia = {
  id: number;
  lane: Lane;
  t: number;          // progression 0..1
  speed: number;      // par seconde
  exploding?: number; // timestamp ms si en explosion
};

const REWARD = 100;

export default function MafiaAttackers() {
  const [cars, setCars] = useState<Mafia[]>([]);
  const idRef = useRef(0);
  const lastSpawn = useRef(0);
  const startedAt = useRef(Date.now());

  // Spawn + déplacement
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // intensité qui monte doucement avec le temps de partie
      const minutes = (Date.now() - startedAt.current) / 60000;
      const wave = 1 + Math.min(4, minutes * 0.4);   // 1 → 5
      const maxCars = Math.min(6, 1 + Math.floor(wave));
      const spawnEvery = Math.max(3500, 9000 - minutes * 600); // ms

      setCars((prev) => {
        let next = prev
          .map((c) => {
            if (c.exploding) return c;
            const nt = c.t + (c.speed * dt) / 1;
            return { ...c, t: nt };
          })
          .filter((c) => {
            if (c.exploding) return now - c.exploding < 650;
            return c.t < 1.05;
          });

        if (now - lastSpawn.current > spawnEvery && next.length < maxCars) {
          lastSpawn.current = now;
          const lane = LANES[Math.floor(Math.random() * LANES.length)];
          next = [
            ...next,
            {
              id: ++idRef.current,
              lane,
              t: 0,
              speed: 0.08 + Math.random() * 0.05 + minutes * 0.005,
            },
          ];
        }
        return next;
      });

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const explode = (id: number) => {
    setCars((cs) =>
      cs.map((c) => (c.id === id && !c.exploding ? { ...c, exploding: performance.now() } : c)),
    );
    window.dispatchEvent(
      new CustomEvent("jce.player.cashDelta", { detail: { amount: REWARD } }),
    );
  };

  return (
    <svg
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 6 }}
    >
      {cars.map((c) => {
        const x = c.lane.x1 + (c.lane.x2 - c.lane.x1) * c.t;
        const y = c.lane.y1 + (c.lane.y2 - c.lane.y1) * c.t;
        const angle = (Math.atan2(c.lane.y2 - c.lane.y1, c.lane.x2 - c.lane.x1) * 180) / Math.PI;
        if (c.exploding) {
          const age = (performance.now() - c.exploding) / 650;
          const r = 18 + age * 80;
          return (
            <g key={c.id} transform={`translate(${x},${y})`} pointerEvents="none">
              <circle r={r} fill="rgba(255,170,40,0.6)" opacity={1 - age} />
              <circle r={r * 0.6} fill="rgba(255,80,30,0.85)" opacity={1 - age} />
              <text y="6" textAnchor="middle" fontSize="34" fontWeight="900"
                fill="#fde047" stroke="#1a1306" strokeWidth="1.4" opacity={1 - age}>
                +{REWARD}$
              </text>
            </g>
          );
        }
        return (
          <g
            key={c.id}
            transform={`translate(${x},${y}) rotate(${angle})`}
            style={{ pointerEvents: "auto", cursor: "pointer" }}
            onClick={() => explode(c.id)}
            onTouchStart={(e) => { e.preventDefault(); explode(c.id); }}
          >
            {/* zone de tap large pour mobile */}
            <rect x="-30" y="-22" width="60" height="44" fill="transparent" />
            {/* ombre */}
            <ellipse cx="0" cy="14" rx="22" ry="5" fill="rgba(0,0,0,0.55)" />
            {/* carrosserie noire */}
            <rect x="-22" y="-10" width="44" height="20" rx="4" fill="#0a0a0a" stroke="#1a1a1a" strokeWidth="1" />
            <rect x="-14" y="-7" width="14" height="14" rx="1.5" fill="#1f2937" opacity="0.95" />
            <rect x="2" y="-7" width="14" height="14" rx="1.5" fill="#1f2937" opacity="0.95" />
            {/* phares rouges (sinistres) */}
            <circle cx="20" cy="-6" r="1.6" fill="#ff2a2a" />
            <circle cx="20" cy="6" r="1.6" fill="#ff2a2a" />
            {/* logo mafia discret */}
            <text x="0" y="2" textAnchor="middle" fontSize="6.5" fontWeight="900"
              fill="#b91c1c" pointerEvents="none">M</text>
          </g>
        );
      })}
    </svg>
  );
}
