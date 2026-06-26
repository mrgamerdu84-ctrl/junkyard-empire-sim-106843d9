// Petit mécano SVG animé qui tourne autour du taxi pendant l'opération.
// On garde tout en SVG/CSS pour rester léger et cohérent avec le reste du jeu.
import { useEffect, useState } from "react";

type Mode = "idle" | "wrench" | "paint" | "tires" | "weld";

export default function MechanicSprite({ mode = "idle" }: { mode?: Mode }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => (t + 1) % 4), 220);
    return () => clearInterval(id);
  }, []);

  // Positions autour d'un taxi centré en (200, 160)
  const orbit = [
    { x: 110, y: 180 },
    { x: 290, y: 170 },
    { x: 270, y: 110 },
    { x: 130, y: 120 },
  ][tick];

  const tool =
    mode === "paint"  ? "🎨" :
    mode === "tires"  ? "🛞" :
    mode === "weld"   ? "🔥" :
    mode === "wrench" ? "🔧" : "🧰";

  const bob = tick % 2 === 0 ? 0 : -3;

  return (
    <g
      style={{
        transform: `translate(${orbit.x}px, ${orbit.y + bob}px)`,
        transition: "transform .35s ease-in-out",
      }}
    >
      {/* ombre */}
      <ellipse cx="0" cy="30" rx="14" ry="3.5" fill="rgba(0,0,0,0.45)" />
      {/* corps : combinaison bleu mécano */}
      <rect x="-9" y="2" width="18" height="22" rx="4" fill="#1e40af" stroke="#0b0d10" strokeWidth="1.2" />
      <rect x="-9" y="14" width="18" height="2" fill="#0b0d10" opacity="0.4" />
      {/* tête */}
      <circle cx="0" cy="-6" r="7" fill="#f5d0a6" stroke="#0b0d10" strokeWidth="1" />
      {/* casquette */}
      <path d="M -7 -8 Q 0 -16 7 -8 L 7 -6 L -7 -6 Z" fill="#fde047" stroke="#0b0d10" strokeWidth="1" />
      <rect x="-1" y="-13" width="2" height="2" fill="#0b0d10" />
      {/* bras + outil */}
      <g style={{ transform: `rotate(${tick * 20 - 30}deg)`, transformOrigin: "0px 6px" }}>
        <rect x="6" y="4" width="10" height="3.5" rx="1.5" fill="#1e40af" stroke="#0b0d10" strokeWidth="1" />
        <text x="17" y="9" fontSize="11">{tool}</text>
      </g>
      {/* étincelles si mode wrench/weld */}
      {(mode === "weld" || mode === "wrench") && tick % 2 === 0 && (
        <g>
          <circle cx="20" cy="10" r="1.2" fill="#fde047" />
          <circle cx="24" cy="12" r="1" fill="#f97316" />
          <circle cx="22" cy="14" r="0.8" fill="#fff" />
        </g>
      )}
      {/* gouttes peinture */}
      {mode === "paint" && tick % 2 === 0 && (
        <g>
          <circle cx="22" cy="12" r="1.2" fill="#3b82f6" />
          <circle cx="25" cy="15" r="1" fill="#ef4444" />
        </g>
      )}
    </g>
  );
}
