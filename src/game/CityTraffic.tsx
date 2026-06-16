import { useEffect, useRef, useState } from "react";
import { useAdminConfig } from "./adminConfig";
import npcTopdown from "@/assets/car-npc-topdown.png";
import npcRedTopdown from "@/assets/car-npc-red-topdown.png";
import citymap from "@/assets/citymap.jpg";

/* eslint-disable prettier/prettier */

/* ============================================================
 * JUNKY CITY EMPIRE — Image-based map (citymap.jpg)
 * Routes invisibles pour le trafic (les taxis suivent ces paths).
 * ============================================================ */

export const ROADS = [
  // 0 — Anneau périphérique (grand rectangle arrondi)
  "M 200 120 L 1720 120 Q 1800 120 1800 200 L 1800 880 Q 1800 960 1720 960 L 200 960 Q 120 960 120 880 L 120 200 Q 120 120 200 120 Z",
  // 1 — Avenue haute (boucle large entre y=300 et y=540)
  "M 360 300 L 1560 300 Q 1620 300 1620 360 L 1620 480 Q 1620 540 1560 540 L 360 540 Q 300 540 300 480 L 300 360 Q 300 300 360 300 Z",
  // 2 — Avenue basse (boucle large entre y=600 et y=840)
  "M 360 600 L 1560 600 Q 1620 600 1620 660 L 1620 780 Q 1620 840 1560 840 L 360 840 Q 300 840 300 780 L 300 660 Q 300 600 360 600 Z",
  // 3 — Avenue verticale gauche
  "M 220 220 L 380 220 Q 440 220 440 280 L 440 860 Q 440 920 380 920 L 220 920 Q 160 920 160 860 L 160 280 Q 160 220 220 220 Z",
  // 4 — Avenue verticale droite
  "M 1540 220 L 1700 220 Q 1760 220 1760 280 L 1760 860 Q 1760 920 1700 920 L 1540 920 Q 1480 920 1480 860 L 1480 280 Q 1480 220 1540 220 Z",
  // 5 — Rond-point central (cercle r=120 autour de 960,540)
  "M 1080 540 A 120 120 0 1 1 840 540 A 120 120 0 1 1 1080 540 Z",
];

type VehicleKind = "sedan" | "van" | "truck" | "hatch" | "moto";
type VehicleVariant = "black" | "red";

type CarSpec = {
  color: string;
  accent: string;
  duration: number;
  delay: number;
  pathIdx: number;
  flip?: boolean;
  scale?: number;
  kind: VehicleKind;
  variant?: VehicleVariant;
};

// Trafic réparti sur les 6 boucles, dans les 2 sens.
const CARS: CarSpec[] = [
  // Path 0 — anneau (longues durées)
  { kind: "sedan", color: "#d83a2a", accent: "#7c1c10", duration: 78, delay:   0, pathIdx: 0, scale: 0.62, variant: "red" },
  { kind: "van",   color: "#2f7a4a", accent: "#163b22", duration: 86, delay: -20, pathIdx: 0, scale: 0.68 },
  { kind: "truck", color: "#1f2937", accent: "#0b0f17", duration: 96, delay: -42, pathIdx: 0, scale: 0.72 },
  { kind: "sedan", color: "#e8edf2", accent: "#8a8e94", duration: 76, delay: -58, pathIdx: 0, scale: 0.6 },
  { kind: "moto",  color: "#f97316", accent: "#7a3a08", duration: 60, delay:  -8, pathIdx: 0, scale: 0.55 },
  { kind: "sedan", color: "#2b6ed8", accent: "#143f7c", duration: 80, delay:   0, pathIdx: 0, flip: true, scale: 0.62 },
  { kind: "truck", color: "#b8410f", accent: "#5a1f06", duration: 92, delay: -30, pathIdx: 0, flip: true, scale: 0.72 },
  { kind: "moto",  color: "#22c55e", accent: "#0f5132", duration: 58, delay: -48, pathIdx: 0, flip: true, scale: 0.55 },

  // Path 1 — avenue haute
  { kind: "sedan", color: "#facc15", accent: "#7a5a08", duration: 48, delay:   0, pathIdx: 1, scale: 0.6, variant: "red" },
  { kind: "van",   color: "#d97a2a", accent: "#7a3a10", duration: 52, delay: -16, pathIdx: 1, scale: 0.66 },
  { kind: "hatch", color: "#12151a", accent: "#050607", duration: 44, delay: -30, pathIdx: 1, scale: 0.56 },
  { kind: "moto",  color: "#a855f7", accent: "#4a1f6b", duration: 38, delay: -12, pathIdx: 1, scale: 0.55 },
  { kind: "sedan", color: "#3a8a48", accent: "#1c4a22", duration: 48, delay:   0, pathIdx: 1, flip: true, scale: 0.6 },
  { kind: "truck", color: "#0891b2", accent: "#0a4453", duration: 56, delay: -22, pathIdx: 1, flip: true, scale: 0.72 },

  // Path 2 — avenue basse
  { kind: "sedan", color: "#b81c4a", accent: "#5c0a20", duration: 50, delay:   0, pathIdx: 2, scale: 0.6, variant: "red" },
  { kind: "van",   color: "#16a34a", accent: "#0a4a22", duration: 54, delay: -18, pathIdx: 2, scale: 0.66 },
  { kind: "hatch", color: "#4ed6c5", accent: "#187266", duration: 46, delay: -32, pathIdx: 2, scale: 0.56 },
  { kind: "sedan", color: "#1a3a6a", accent: "#0a1c40", duration: 50, delay:   0, pathIdx: 2, flip: true, scale: 0.6 },
  { kind: "moto",  color: "#ec4899", accent: "#6b0f3a", duration: 40, delay: -15, pathIdx: 2, flip: true, scale: 0.55 },

  // Path 3 — avenue verticale gauche
  { kind: "sedan", color: "#ea580c", accent: "#7a2a06", duration: 38, delay:   0, pathIdx: 3, scale: 0.6 },
  { kind: "van",   color: "#0ea5e9", accent: "#075985", duration: 42, delay: -14, pathIdx: 3, flip: true, scale: 0.66 },

  // Path 4 — avenue verticale droite
  { kind: "sedan", color: "#7c3aed", accent: "#3b1d72", duration: 38, delay:   0, pathIdx: 4, scale: 0.6 },
  { kind: "truck", color: "#3b4a5c", accent: "#1a232f", duration: 46, delay: -16, pathIdx: 4, flip: true, scale: 0.72 },

  // Path 5 — rond-point (cercle court)
  { kind: "hatch", color: "#e11d48", accent: "#6b0f25", duration: 14, delay:   0, pathIdx: 5, scale: 0.52, variant: "red" },
  { kind: "moto",  color: "#facc15", accent: "#7a5a08", duration: 12, delay:  -4, pathIdx: 5, scale: 0.5 },
];

/* ===== Sprites ===== */

function MotorbikeSVG({ color, accent, scale = 1 }: { color: string; accent: string; scale?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <ellipse cx="0" cy="4" rx="18" ry="5" fill="rgba(0,0,0,0.45)" />
      {/* roues */}
      <circle cx="-14" cy="0" r="5.5" fill="#0a0a0a" />
      <circle cx="-14" cy="0" r="2.6" fill="#5a5e62" />
      <circle cx="14" cy="0" r="5.5" fill="#0a0a0a" />
      <circle cx="14" cy="0" r="2.6" fill="#5a5e62" />
      {/* châssis */}
      <path d="M -10 -2 L 10 -2 L 12 2 L -12 2 Z" fill={color} stroke={accent} strokeWidth="0.8" />
      {/* réservoir */}
      <ellipse cx="2" cy="-3" rx="6" ry="3" fill={accent} />
      {/* guidon */}
      <rect x="7" y="-7" width="6" height="2" rx="0.8" fill="#1a1d22" />
      {/* pilote */}
      <ellipse cx="-1" cy="-5" rx="3.2" ry="3.6" fill="#1f2937" />
      <circle cx="-1" cy="-7.5" r="2" fill="#111827" />
      {/* phare */}
      <circle cx="17" cy="0" r="1.4" fill="#fff7c0" />
    </g>
  );
}

function Vehicle({
  kind,
  color,
  accent,
  scale = 1,
  variant = "black",
}: {
  kind: VehicleKind;
  color: string;
  accent: string;
  scale?: number;
  variant?: VehicleVariant;
}) {
  if (kind === "moto") return <MotorbikeSVG color={color} accent={accent} scale={scale} />;
  const baseLen = kind === "truck" ? 96 : kind === "van" ? 80 : kind === "hatch" ? 60 : 70;
  const baseWid = kind === "truck" ? 38 : kind === "van" ? 36 : 32;
  const W = baseLen;
  const H = baseWid;
  const isRed = variant === "red";
  const href = isRed ? npcRedTopdown : npcTopdown;
  const innerRotate = isRed ? -90 : 90;
  const lc = color.toLowerCase();
  let tintOpacity = 0.5;
  if (lc === "#000" || lc === "#000000") tintOpacity = 0;
  if (isRed && (lc === "#d83a2a" || lc === "#b81c4a" || lc === "#e11d48")) tintOpacity = 0;
  return (
    <g transform={`scale(${scale})`}>
      <ellipse cx="0" cy="3" rx={W / 2 + 2} ry={H / 2 - 1} fill="rgba(0,0,0,0.4)" />
      <g transform={`rotate(${innerRotate})`}>
        <image href={href} x={-H / 2} y={-W / 2} width={H} height={W} preserveAspectRatio="xMidYMid meet" />
        <rect x={-H / 2} y={-W / 2} width={H} height={W} fill={color} opacity={tintOpacity} style={{ mixBlendMode: "multiply" }} />
      </g>
      <circle cx={W / 2 - 2} cy={-H / 4} r="1.4" fill="#fff7c0" opacity="0.85" />
      <circle cx={W / 2 - 2} cy={H / 4} r="1.4" fill="#fff7c0" opacity="0.85" />
    </g>
  );
}

/* ===== Trafic ===== */

const SAFE_GAP = 55;
const BRAKE_GAP = 110;
const ACCEL = 0.6;
const BRAKE = 1.8;
const MIN_SPEED_RATIO = 0.35;

type CarState = {
  spec: CarSpec;
  pathLen: number;
  baseSpeed: number;
  s: number;
  speed: number;
  laneKey: string;
  node: SVGGElement | null;
};

export default function CityTraffic() {
  const [nightLevel, setNightLevel] = useState(0.25);
  const admin = useAdminConfig();
  const activeCars = CARS.slice(0, Math.max(0, Math.min(CARS.length, admin.civilVehicleCount)));
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const carNodes = useRef<(SVGGElement | null)[]>([]);

  // Cycle jour/nuit subtil
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = (performance.now() % 180000) / 180000;
      const daylight = Math.max(0, Math.sin(t * Math.PI * 2));
      const n = 0.18 + (1 - daylight) * 0.72;
      setNightLevel((prev) => (Math.abs(prev - n) > 0.04 ? n : prev));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const lens = pathRefs.current.map((p) => (p ? p.getTotalLength() : 1));
    if (lens.some((l) => l <= 1)) return;

    const states: CarState[] = activeCars.map((spec, i) => {
      const pathLen = lens[spec.pathIdx];
      const baseSpeed = pathLen / spec.duration;
      const startS = ((-spec.delay) * baseSpeed) % pathLen;
      return {
        spec,
        pathLen,
        baseSpeed,
        s: (startS + pathLen) % pathLen,
        speed: baseSpeed,
        laneKey: `${spec.pathIdx}:${spec.flip ? "r" : "f"}`,
        node: carNodes.current[i],
      };
    });

    const lanes = new Map<string, CarState[]>();
    for (const st of states) {
      if (!lanes.has(st.laneKey)) lanes.set(st.laneKey, []);
      lanes.get(st.laneKey)!.push(st);
    }

    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      for (const lane of lanes.values()) {
        const sorted = [...lane].sort((a, b) => b.s - a.s);
        for (let i = 0; i < sorted.length; i++) {
          const me = sorted[i];
          const ahead = sorted[(i - 1 + sorted.length) % sorted.length];
          let gap = ahead.s - me.s;
          if (gap <= 0) gap += me.pathLen;
          const myLen = me.spec.kind === "truck" ? 60 : me.spec.kind === "van" ? 50 : me.spec.kind === "moto" ? 22 : 38;
          const safe = SAFE_GAP + myLen * 0.2;
          const brake = BRAKE_GAP + myLen * 0.2;
          let target = me.baseSpeed;
          if (gap < brake) {
            const k = Math.max(0, (gap - safe) / (brake - safe));
            const leaderEff = Math.max(ahead.speed, ahead.baseSpeed * MIN_SPEED_RATIO);
            target = leaderEff * (1 - k) + me.baseSpeed * k;
            if (gap < safe) target = Math.min(target, leaderEff * (gap / safe));
          }
          const diff = target - me.speed;
          const rate = diff < 0 ? BRAKE : ACCEL;
          const maxStep = rate * me.baseSpeed * dt;
          me.speed += Math.max(-maxStep, Math.min(maxStep, diff));
          const floor = me.baseSpeed * MIN_SPEED_RATIO;
          if (me.speed < floor) me.speed = floor;
        }
      }

      for (const st of states) {
        st.s = (st.s + st.speed * dt) % st.pathLen;
        const node = st.node;
        if (!node) continue;
        const path = pathRefs.current[st.spec.pathIdx];
        if (!path) continue;
        const lenForward = st.spec.flip ? st.pathLen - st.s : st.s;
        const p = path.getPointAtLength(lenForward);
        const p2 = path.getPointAtLength(Math.min(st.pathLen, lenForward + (st.spec.flip ? -1 : 1)));
        const ang = (Math.atan2(p2.y - p.y, p2.x - p.x) * 180) / Math.PI;
        node.setAttribute("transform", `translate(${p.x.toFixed(2)},${p.y.toFixed(2)}) rotate(${ang.toFixed(2)})`);
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [activeCars.length]);

  return (
    <svg
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 2 }}
    >
      <defs>
        {ROADS.map((d, i) => (
          <path key={i} id={`jce-road-${i}`} d={d} ref={(el) => { pathRefs.current[i] = el; }} />
        ))}
        <filter id="jce-soft-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Fond image citymap.jpg */}
      <image href={citymap} width="1920" height="1080" preserveAspectRatio="xMidYMid slice" />

      {/* Overlay nuit */}
      <rect width="1920" height="1080" fill="#0a1530" opacity={nightLevel * 0.25} pointerEvents="none" />

      {activeCars.map((car, i) => (
        <g key={i} filter="url(#jce-soft-shadow)" ref={(el) => { carNodes.current[i] = el; }}>
          <Vehicle kind={car.kind} color={car.color} accent={car.accent} scale={car.scale} variant={car.variant} />
        </g>
      ))}
    </svg>
  );
}
