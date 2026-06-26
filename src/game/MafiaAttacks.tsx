import { useEffect, useRef, useState } from "react";
import { damageRandomTaxi, rewardMafiaTakedown } from "./companyV2";

// Carte 1920×1080. Dépôt clandestin (planque mafia) en bordure NE de la ville.
const DEPOT = { x: 1720, y: 110 };
const TARGETS: Array<{ x: number; y: number }> = [
  { x: 900,  y: 540 },
  { x: 600,  y: 760 },
  { x: 1180, y: 420 },
  { x: 1400, y: 820 },
  { x: 320,  y: 480 },
];

type Attack = {
  id: number;
  x: number; y: number;
  tx: number; ty: number;
  startedAt: number;
  durationMs: number;
  done?: boolean;
};

let UID = 1;

export default function MafiaAttacks() {
  const [attacks, setAttacks] = useState<Attack[]>([]);
  const [flash, setFlash] = useState<{ x: number; y: number; t: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  // Spawn sur événement — accepte un facteur de colère (0..1) qui accélère les voitures.
  useEffect(() => {
    function onSpawn(e: Event) {
      const anger = Math.max(0, Math.min(1, (e as CustomEvent<{ anger?: number }>).detail?.anger ?? 0));
      const target = TARGETS[Math.floor(Math.random() * TARGETS.length)];
      // 11s (calme) → 6s (en rage)
      const base = 11000 - anger * 5000;
      const a: Attack = {
        id: UID++,
        x: DEPOT.x, y: DEPOT.y,
        tx: target.x, ty: target.y,
        startedAt: performance.now(),
        durationMs: base + Math.random() * 2000,
      };
      setAttacks(prev => [...prev, a].slice(-10));
    }
    window.addEventListener("mtw:mafia-attack-spawn", onSpawn as EventListener);
    return () => window.removeEventListener("mtw:mafia-attack-spawn", onSpawn as EventListener);
  }, []);

  // Boucle d'animation
  useEffect(() => {
    let stop = false;
    function tick() {
      if (stop) return;
      const now = performance.now();
      setAttacks(prev => {
        const next: Attack[] = [];
        for (const a of prev) {
          if (a.done) continue;
          const p = Math.min(1, (now - a.startedAt) / a.durationMs);
          const x = a.x + (a.tx - a.x) * p;
          const y = a.y + (a.ty - a.y) * p;
          if (p >= 1) {
            // arrive à destination → sabotage un taxi
            damageRandomTaxi(22);
            continue;
          }
          next.push({ ...a, x, y, startedAt: a.startedAt, durationMs: a.durationMs });
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { stop = true; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  function neutralize(id: number, x: number, y: number) {
    setAttacks(prev => prev.filter(a => a.id !== id));
    setFlash({ x, y, t: performance.now() });
    rewardMafiaTakedown(100);
    setTimeout(() => setFlash(null), 600);
  }

  return (
    <g className="mafia-layer" pointerEvents="auto">
      {/* Dépôt clandestin */}
      <g transform={`translate(${DEPOT.x - 36},${DEPOT.y - 30})`} pointerEvents="none">
        <rect width="72" height="46" rx="3" fill="#0b0d10" stroke="#7f1d1d" strokeWidth="2.5" />
        <rect x="6" y="6" width="60" height="10" fill="#1a1d22" />
        <rect x="10" y="22" width="14" height="16" fill="#7f1d1d" />
        <rect x="48" y="22" width="14" height="16" fill="#7f1d1d" />
        <text x="36" y="58" textAnchor="middle" fontSize="11" fontWeight="900" fill="#fca5a5"
              stroke="#0b0d10" strokeWidth="0.4">DÉPÔT MAFIA</text>
      </g>

      {/* Voitures noires : sedan banalisé reprenant la silhouette des voitures du jeu */}
      {attacks.map(a => {
        const dx = a.tx - DEPOT.x;
        const dy = a.ty - DEPOT.y;
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return (
          <g
            key={a.id}
            className="mafia-vehicle"
            transform={`translate(${a.x},${a.y}) rotate(${angle})`}
            onClick={() => neutralize(a.id, a.x, a.y)}
            onTouchStart={() => neutralize(a.id, a.x, a.y)}
            style={{ cursor: "pointer" }}
          >
            {/* halo cliquable pulsé */}
            <circle r="28" fill="rgba(220,38,38,0.18)">
              <animate attributeName="r" values="22;30;22" dur="1.2s" repeatCount="indefinite" />
            </circle>
            {/* ombre */}
            <ellipse cx="0" cy="6" rx="18" ry="4" fill="rgba(0,0,0,0.55)" />
            {/* carrosserie sedan noire — même proportions que les voitures civiles */}
            <rect x="-19" y="-9" width="38" height="18" rx="4" fill="#0b0d10" stroke="#7f1d1d" strokeWidth="1.4" />
            {/* capot/coffre teintés */}
            <rect x="-19" y="-9" width="6"  height="18" fill="#16181c" />
            <rect x="13"  y="-9" width="6"  height="18" fill="#16181c" />
            {/* pare-brise teinté */}
            <path d="M -8 -7 L 8 -7 L 6 -2 L -6 -2 Z" fill="#1f2937" stroke="#0b0d10" strokeWidth="0.6" />
            <path d="M -8  7 L 8  7 L 6  2 L -6  2 Z" fill="#1f2937" stroke="#0b0d10" strokeWidth="0.6" />
            {/* roues */}
            <rect x="-14" y="-11" width="6" height="3" rx="1" fill="#0a0a0a" />
            <rect x="-14" y="8"   width="6" height="3" rx="1" fill="#0a0a0a" />
            <rect x="8"   y="-11" width="6" height="3" rx="1" fill="#0a0a0a" />
            <rect x="8"   y="8"   width="6" height="3" rx="1" fill="#0a0a0a" />
            {/* phares rouges menaçants */}
            <circle cx="17" cy="-5" r="1.6" fill="#dc2626" />
            <circle cx="17" cy="5"  r="1.6" fill="#dc2626" />
            <text x="0" y="-14" textAnchor="middle" fontSize="8" fontWeight="900" fill="#fca5a5"
                  stroke="#0b0d10" strokeWidth="0.4">MAFIA</text>
          </g>
        );
      })}

      {/* explosion */}
      {flash && (
        <g transform={`translate(${flash.x},${flash.y})`} pointerEvents="none">
          <circle r="6" fill="#fde047">
            <animate attributeName="r" from="6" to="40" dur="0.5s" fill="freeze" />
            <animate attributeName="opacity" from="1" to="0" dur="0.5s" fill="freeze" />
          </circle>
          <text y="4" textAnchor="middle" fontSize="22" fontWeight="900" fill="#f97316"
                stroke="#0b0d10" strokeWidth="0.6">💥</text>
        </g>
      )}
    </g>
  );
}
