// =============================================================
// MafiaLimo — La limousine du bras droit du Parrain.
// Avant chaque demande de rançon, la limo entre en ville par
// l'est, roule jusqu'à un parking situé à côté du QG joueur,
// reste 6 s (le temps qu'apparaisse la pop-up du Parrain),
// puis repart. Le sprite peut être customisé via le panel admin
// (catégorie "limo") — sinon fallback sur l'image bordeaux par
// défaut.
// =============================================================
import { useEffect, useRef, useState } from "react";
import { getAdmin } from "./adminConfig";
import { listCustomVehiclesByCategory } from "./gameAssets";
import defaultLimoImg from "@/assets/mafia-limo.png";
import { reduceMotion, targetFps } from "@/lib/perf";
import { useUnlock } from "./campaign/unlocks";

const MAP_W = 1920;
const MAP_H = 1080;
const LIMO_W = 110;
const LIMO_H = 48;
const APPROACH_SPEED = 320; // px/s
const PARK_OFFSET = { x: 90, y: 70 }; // décalage par rapport au QG (côté droit)
const PARK_DURATION_MS = 6500;

type Phase = "off" | "arriving" | "parked" | "leaving";

function pickLimoSprite(): string {
  try {
    const custom = listCustomVehiclesByCategory("limo");
    if (custom.length > 0) return custom[0].url;
  } catch {}
  return defaultLimoImg;
}

export default function MafiaLimo() {
  const reducedFx = reduceMotion();
  const [phase, setPhase] = useState<Phase>("off");
  const [pos, setPos] = useState({ x: MAP_W + 200, y: MAP_H / 2, angle: 180 });
  const [sprite, setSprite] = useState<string>(pickLimoSprite());
  const rafRef = useRef<number | undefined>(undefined);
  const parkTimerRef = useRef<number | undefined>(undefined);
  const adm = getAdmin();
  const target = {
    x: Math.min(MAP_W - 80, adm.hqX + PARK_OFFSET.x),
    y: Math.min(MAP_H - 60, adm.hqY + PARK_OFFSET.y),
  };

  // Démarre une arrivée
  useEffect(() => {
    const start = () => {
      if (phase !== "off") return;
      // Marque comme "actif" pour que le Parrain attende
      (window as unknown as { __mafiaLimoActive?: boolean }).__mafiaLimoActive = true;
      setSprite(pickLimoSprite());
      setPos({ x: MAP_W - 20, y: target.y, angle: 180 });
      setPhase("arriving");
    };
    window.addEventListener("jce.limo.start", start);
    return () => window.removeEventListener("jce.limo.start", start);
  }, [phase, target.y]);

  // Signal "prêt" pour MafiaGodfather
  useEffect(() => {
    (window as unknown as { __mafiaLimoReady?: boolean }).__mafiaLimoReady = true;
    return () => {
      (window as unknown as { __mafiaLimoReady?: boolean }).__mafiaLimoReady = false;
    };
  }, []);

  // Boucle d'animation
  useEffect(() => {
    if (phase === "off" || phase === "parked") return;
    let prev = performance.now();
    let lastFrame = prev;
    const MIN_FRAME = 1000 / targetFps();
    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (now - lastFrame < MIN_FRAME) return;
      lastFrame = now;
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      setPos((p) => {
        const dx = (phase === "leaving" ? 10 : target.x) - p.x;
        const dy = (phase === "leaving" ? p.y : target.y) - p.y;
        const dist = Math.hypot(dx, dy);
        if (phase === "arriving" && dist < 4) {
          // Arrivée
          window.setTimeout(() => {
            setPhase("parked");
            // Déclenche la pop-up du Parrain
            window.dispatchEvent(new CustomEvent("jce.godfather.open"));
            parkTimerRef.current = window.setTimeout(() => setPhase("leaving"), PARK_DURATION_MS);
          }, 0);
          return p;
        }
        if (phase === "leaving" && p.x < 20) {
          window.setTimeout(() => {
            setPhase("off");
            (window as unknown as { __mafiaLimoActive?: boolean }).__mafiaLimoActive = false;
          }, 0);
          return p;
        }
        const step = APPROACH_SPEED * dt;
        const k = Math.min(1, step / Math.max(1, dist));
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return { x: p.x + dx * k, y: p.y + dy * k, angle };
      });
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, target.x, target.y]);

  useEffect(() => () => {
    if (parkTimerRef.current) window.clearTimeout(parkTimerRef.current);
  }, []);

  if (phase === "off") return null;

  return (
    <svg
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 7 }}
    >
      {!reducedFx && (
        <defs>
          <filter id="limo-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
      )}
      <g transform={`translate(${pos.x},${pos.y})`}>
        {/* ombre sous la limo */}
        <ellipse cx={4} cy={LIMO_H * 0.35} rx={LIMO_W * 0.52} ry={LIMO_H * 0.32} fill="rgba(0,0,0,0.45)" filter={reducedFx ? undefined : "url(#limo-shadow)"} />
        <g transform={`rotate(${pos.angle})`}>
          <g transform={`scale(1, ${Math.cos((pos.angle * Math.PI) / 180) < 0 ? -1 : 1})`}>
            <image
              href={sprite}
              x={-LIMO_W / 2}
              y={-LIMO_H / 2}
              width={LIMO_W}
              height={LIMO_H}
              preserveAspectRatio="xMidYMid meet"
            />
          </g>
        </g>
        {phase === "parked" && (
          <g transform="translate(0,-44)">
            <rect x={-58} y={-14} width={116} height={22} rx={4} fill="rgba(20,8,8,0.92)" stroke="#c9a227" strokeWidth={1.2} />
            <text textAnchor="middle" y={1} fontSize={11} fontWeight={900} fill="#fde047" fontFamily="ui-sans-serif, system-ui, sans-serif">
              🥂 BRAS DROIT
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}
