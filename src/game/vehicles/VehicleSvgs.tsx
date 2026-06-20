// =============================================================
// Véhicules SVG — vue de dessus (top-down)
// CONVENTION D'AUTEUR : chaque véhicule est dessiné avec l'AVANT
// pointant vers le HAUT de l'écran (-y) dans le repère source.
// Le wrapper interne <Body> applique rotate(90) pour rester compatible
// avec le runtime CityTraffic / TaxiTycoon qui font rotate(angle) basé
// sur l'angle +x du sens de marche.
// =============================================================
import { useEffect, useState } from "react";

type Props = { color: string; accent: string; scale?: number };

function Body({
  children,
  scale = 1,
}: {
  children: React.ReactNode;
  scale?: number;
}) {
  // rotate(90) : le sprite "avant en haut" devient "avant à droite (+x)",
  // qui est l'orientation attendue par le parent (rotation = angle de la
  // tangente du chemin en degrés depuis +x).
  return <g transform={`rotate(90) scale(${scale})`}>{children}</g>;
}

/* ===== Gyrophare clignotant ===== */
function Beacon({
  x = 0,
  y = 0,
  color1 = "#1e90ff",
  color2 = "#ff2a2a",
}: {
  x?: number;
  y?: number;
  color1?: string;
  color2?: string;
}) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setOn((v) => !v), 320);
    return () => clearInterval(id);
  }, []);
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x="-2.6" y="-0.9" width="5.2" height="1.8" rx="0.5" fill="#1a1d22" />
      <circle cx="-1.3" cy="0" r="1.2" fill={on ? color1 : "#222"} opacity={on ? 1 : 0.5} />
      <circle cx="1.3" cy="0" r="1.2" fill={on ? "#222" : color2} opacity={on ? 0.5 : 1} />
      <circle cx={on ? -1.3 : 1.3} cy="0" r="3" fill={on ? color1 : color2} opacity="0.4" />
    </g>
  );
}

/* ===== Berline ===== */
export function SedanSvg({ color, accent, scale = 1 }: Props) {
  return (
    <Body scale={scale}>
      <ellipse cx="0" cy="3" rx="13" ry="6" fill="rgba(0,0,0,0.42)" />
      <rect x="-13" y="-7" width="26" height="14" rx="3.5" fill={accent} />
      <rect x="-12" y="-6" width="24" height="12" rx="3" fill={color} />
      <path d="M 4 -5.5 L 11 -3.5 L 11 3.5 L 4 5.5 Z" fill="#0b1626" opacity="0.92" />
      <path d="M -4 -5.5 L -11 -3.5 L -11 3.5 L -4 5.5 Z" fill="#0b1626" opacity="0.7" />
      <rect x="-4" y="-5.5" width="8" height="11" rx="1.2" fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth="0.3" />
      <rect x="-9" y="-9" width="5" height="2.4" rx="0.6" fill="#0a0c10" />
      <rect x="4" y="-9" width="5" height="2.4" rx="0.6" fill="#0a0c10" />
      <rect x="-9" y="6.6" width="5" height="2.4" rx="0.6" fill="#0a0c10" />
      <rect x="4" y="6.6" width="5" height="2.4" rx="0.6" fill="#0a0c10" />
      <circle cx="12" cy="-4" r="1.4" fill="#fff7c0" />
      <circle cx="12" cy="4" r="1.4" fill="#fff7c0" />
      <rect x="-12.5" y="-5" width="1.2" height="2.4" fill="#ff3028" />
      <rect x="-12.5" y="2.6" width="1.2" height="2.4" fill="#ff3028" />
    </Body>
  );
}

/* ===== Citadine ===== */
export function HatchSvg({ color, accent, scale = 1 }: Props) {
  return (
    <Body scale={scale}>
      <ellipse cx="0" cy="3" rx="11" ry="5" fill="rgba(0,0,0,0.42)" />
      <rect x="-11" y="-6.5" width="22" height="13" rx="3.5" fill={accent} />
      <rect x="-10" y="-5.5" width="20" height="11" rx="3" fill={color} />
      <path d="M 2 -5 L 9 -3 L 9 3 L 2 5 Z" fill="#0b1626" opacity="0.92" />
      <path d="M -3 -5 L -9 -3 L -9 3 L -3 5 Z" fill="#0b1626" opacity="0.7" />
      <rect x="-3" y="-5" width="6" height="10" rx="1" fill={color} />
      <rect x="-8" y="-8" width="4.5" height="2.2" rx="0.6" fill="#0a0c10" />
      <rect x="3.5" y="-8" width="4.5" height="2.2" rx="0.6" fill="#0a0c10" />
      <rect x="-8" y="5.8" width="4.5" height="2.2" rx="0.6" fill="#0a0c10" />
      <rect x="3.5" y="5.8" width="4.5" height="2.2" rx="0.6" fill="#0a0c10" />
      <circle cx="10" cy="-3.5" r="1.2" fill="#fff7c0" />
      <circle cx="10" cy="3.5" r="1.2" fill="#fff7c0" />
    </Body>
  );
}

/* ===== Van ===== */
export function VanSvg({ color, accent, scale = 1 }: Props) {
  return (
    <Body scale={scale}>
      <ellipse cx="0" cy="4" rx="15" ry="6" fill="rgba(0,0,0,0.42)" />
      <rect x="-15" y="-8" width="30" height="16" rx="2.5" fill={accent} />
      <rect x="-14" y="-7" width="28" height="14" rx="2.2" fill={color} />
      <rect x="6" y="-7" width="8" height="14" rx="1.6" fill={accent} opacity="0.9" />
      <path d="M 8 -5.5 L 13 -3 L 13 3 L 8 5.5 Z" fill="#0b1626" opacity="0.95" />
      <line x1="-6" y1="-7" x2="-6" y2="7" stroke="#0b0d10" strokeWidth="0.5" opacity="0.4" />
      <line x1="0" y1="-7" x2="0" y2="7" stroke="#0b0d10" strokeWidth="0.5" opacity="0.3" />
      <rect x="-11" y="-10" width="5" height="2.5" rx="0.6" fill="#0a0c10" />
      <rect x="6" y="-10" width="5" height="2.5" rx="0.6" fill="#0a0c10" />
      <rect x="-11" y="7.5" width="5" height="2.5" rx="0.6" fill="#0a0c10" />
      <rect x="6" y="7.5" width="5" height="2.5" rx="0.6" fill="#0a0c10" />
      <circle cx="14" cy="-4" r="1.3" fill="#fff7c0" />
      <circle cx="14" cy="4" r="1.3" fill="#fff7c0" />
    </Body>
  );
}

/* ===== Camion ===== */
export function TruckSvg({ color, accent, scale = 1 }: Props) {
  return (
    <Body scale={scale}>
      <ellipse cx="0" cy="5" rx="18" ry="7" fill="rgba(0,0,0,0.45)" />
      <rect x="-18" y="-8" width="22" height="16" rx="1.5" fill={accent} />
      <rect x="-17" y="-7" width="20" height="14" rx="1.2" fill={color} />
      <line x1="-10" y1="-7" x2="-10" y2="7" stroke="#0b0d10" strokeWidth="0.6" opacity="0.5" />
      <line x1="-3" y1="-7" x2="-3" y2="7" stroke="#0b0d10" strokeWidth="0.6" opacity="0.5" />
      <rect x="3" y="-1" width="2" height="2" fill="#1a1d22" />
      <rect x="5" y="-7" width="12" height="14" rx="2" fill={accent} />
      <rect x="6" y="-6" width="10" height="12" rx="1.8" fill={color} />
      <path d="M 9 -5 L 15 -3 L 15 3 L 9 5 Z" fill="#0b1626" opacity="0.95" />
      <rect x="-15" y="-10" width="5" height="2.5" rx="0.6" fill="#0a0c10" />
      <rect x="-6" y="-10" width="5" height="2.5" rx="0.6" fill="#0a0c10" />
      <rect x="6" y="-10" width="5" height="2.5" rx="0.6" fill="#0a0c10" />
      <rect x="-15" y="7.5" width="5" height="2.5" rx="0.6" fill="#0a0c10" />
      <rect x="-6" y="7.5" width="5" height="2.5" rx="0.6" fill="#0a0c10" />
      <rect x="6" y="7.5" width="5" height="2.5" rx="0.6" fill="#0a0c10" />
      <circle cx="17" cy="-4" r="1.4" fill="#fff7c0" />
      <circle cx="17" cy="4" r="1.4" fill="#fff7c0" />
    </Body>
  );
}

/* ===== Voiture de police ===== */
export function PoliceSvg({ scale = 1 }: { scale?: number }) {
  return (
    <Body scale={scale}>
      <ellipse cx="0" cy="3" rx="13" ry="6" fill="rgba(0,0,0,0.42)" />
      <rect x="-13" y="-7" width="26" height="14" rx="3.5" fill="#0b1d3a" />
      <rect x="-12" y="-6" width="24" height="12" rx="3" fill="#ffffff" />
      <rect x="-12" y="-2" width="24" height="4" fill="#0b3da0" opacity="0.95" />
      <text x="0" y="1.5" textAnchor="middle" fontSize="3.2" fontWeight="bold" fill="#fff">POLICE</text>
      <path d="M 4 -5.5 L 11 -3.5 L 11 3.5 L 4 5.5 Z" fill="#0b1626" opacity="0.92" />
      <path d="M -4 -5.5 L -11 -3.5 L -11 3.5 L -4 5.5 Z" fill="#0b1626" opacity="0.7" />
      <rect x="-4" y="-5.5" width="8" height="11" rx="1.2" fill="#ffffff" />
      <rect x="-9" y="-9" width="5" height="2.4" rx="0.6" fill="#0a0c10" />
      <rect x="4" y="-9" width="5" height="2.4" rx="0.6" fill="#0a0c10" />
      <rect x="-9" y="6.6" width="5" height="2.4" rx="0.6" fill="#0a0c10" />
      <rect x="4" y="6.6" width="5" height="2.4" rx="0.6" fill="#0a0c10" />
      <circle cx="12" cy="-4" r="1.4" fill="#fff7c0" />
      <circle cx="12" cy="4" r="1.4" fill="#fff7c0" />
      <Beacon x={0} y={-3} />
      <Beacon x={0} y={3} />
    </Body>
  );
}

/* ===== Fourgon blindé transport de fonds ===== */
export function MoneyTruckSvg({ scale = 1 }: { scale?: number }) {
  return (
    <Body scale={scale}>
      <ellipse cx="0" cy="4" rx="15" ry="6" fill="rgba(0,0,0,0.5)" />
      <rect x="-15" y="-8" width="30" height="16" rx="1.5" fill="#2a3340" />
      <rect x="-14" y="-7" width="28" height="14" rx="1.2" fill="#3a4756" />
      <rect x="-14" y="-7" width="28" height="1.6" fill="#facc15" />
      <rect x="-14" y="5.4" width="28" height="1.6" fill="#facc15" />
      <circle cx="-4" cy="0" r="3.6" fill="#facc15" />
      <text x="-4" y="1.6" textAnchor="middle" fontSize="5" fontWeight="bold" fill="#1a1a1a">€</text>
      <rect x="6" y="-7" width="8" height="14" rx="1.6" fill="#2a3340" />
      <path d="M 8 -5.5 L 13 -3 L 13 3 L 8 5.5 Z" fill="#0b1626" opacity="0.95" />
      <rect x="-11" y="-10" width="5" height="2.5" rx="0.6" fill="#0a0c10" />
      <rect x="6" y="-10" width="5" height="2.5" rx="0.6" fill="#0a0c10" />
      <rect x="-11" y="7.5" width="5" height="2.5" rx="0.6" fill="#0a0c10" />
      <rect x="6" y="7.5" width="5" height="2.5" rx="0.6" fill="#0a0c10" />
      <circle cx="14" cy="-4" r="1.3" fill="#fff7c0" />
      <circle cx="14" cy="4" r="1.3" fill="#fff7c0" />
    </Body>
  );
}

/* ===== Fourgon GIGN ===== */
export function GignTruckSvg({ scale = 1 }: { scale?: number }) {
  return (
    <Body scale={scale}>
      <ellipse cx="0" cy="4" rx="16" ry="7" fill="rgba(0,0,0,0.55)" />
      <rect x="-16" y="-8.5" width="32" height="17" rx="1.5" fill="#0a0c10" />
      <rect x="-15" y="-7.5" width="30" height="15" rx="1.2" fill="#1a1d22" />
      <rect x="-15" y="-1.2" width="30" height="2.4" fill="#2f3540" />
      <text x="-3" y="0.9" textAnchor="middle" fontSize="3" fontWeight="bold" fill="#facc15">GIGN</text>
      <rect x="7" y="-7.5" width="8" height="15" rx="1.6" fill="#0a0c10" />
      <path d="M 9 -5.5 L 14 -3 L 14 3 L 9 5.5 Z" fill="#0b1626" opacity="0.98" />
      <rect x="-12" y="-10.5" width="6" height="2.8" rx="0.6" fill="#000" />
      <rect x="6" y="-10.5" width="6" height="2.8" rx="0.6" fill="#000" />
      <rect x="-12" y="7.7" width="6" height="2.8" rx="0.6" fill="#000" />
      <rect x="6" y="7.7" width="6" height="2.8" rx="0.6" fill="#000" />
      <circle cx="15" cy="-4" r="1.3" fill="#fff7c0" />
      <circle cx="15" cy="4" r="1.3" fill="#fff7c0" />
      <Beacon x={-3} y={0} color1="#1e90ff" color2="#1e90ff" />
      <Beacon x={3} y={0} color1="#1e90ff" color2="#1e90ff" />
    </Body>
  );
}

/* ===== Ambulance ===== */
export function AmbulanceSvg({ scale = 1 }: { scale?: number }) {
  return (
    <Body scale={scale}>
      <ellipse cx="0" cy="4" rx="15" ry="6" fill="rgba(0,0,0,0.42)" />
      <rect x="-15" y="-8" width="30" height="16" rx="2" fill="#e53e3e" />
      <rect x="-14" y="-7" width="28" height="14" rx="1.8" fill="#ffffff" />
      <rect x="-5" y="-1.4" width="10" height="2.8" fill="#e53e3e" />
      <rect x="-1.4" y="-5" width="2.8" height="10" fill="#e53e3e" />
      <rect x="6" y="-7" width="8" height="14" rx="1.6" fill="#e53e3e" />
      <path d="M 8 -5.5 L 13 -3 L 13 3 L 8 5.5 Z" fill="#0b1626" opacity="0.95" />
      <rect x="-11" y="-10" width="5" height="2.5" rx="0.6" fill="#0a0c10" />
      <rect x="6" y="-10" width="5" height="2.5" rx="0.6" fill="#0a0c10" />
      <rect x="-11" y="7.5" width="5" height="2.5" rx="0.6" fill="#0a0c10" />
      <rect x="6" y="7.5" width="5" height="2.5" rx="0.6" fill="#0a0c10" />
      <Beacon x={0} y={0} color1="#e53e3e" color2="#1e90ff" />
    </Body>
  );
}

/* ===== Camion pompiers ===== */
export function FireTruckSvg({ scale = 1 }: { scale?: number }) {
  return (
    <Body scale={scale}>
      <ellipse cx="0" cy="5" rx="17" ry="7" fill="rgba(0,0,0,0.45)" />
      <rect x="-17" y="-8.5" width="32" height="17" rx="1.5" fill="#7a0a0a" />
      <rect x="-16" y="-7.5" width="30" height="15" rx="1.2" fill="#c81e1e" />
      <rect x="-16" y="-2" width="30" height="1.4" fill="#ffd400" />
      <rect x="-16" y="1.4" width="30" height="1.4" fill="#ffd400" />
      <rect x="6" y="-7.5" width="9" height="15" rx="1.6" fill="#7a0a0a" />
      <path d="M 9 -5.5 L 14 -3 L 14 3 L 9 5.5 Z" fill="#0b1626" opacity="0.95" />
      <rect x="-13" y="-10.5" width="5.5" height="2.7" rx="0.6" fill="#0a0c10" />
      <rect x="-4" y="-10.5" width="5.5" height="2.7" rx="0.6" fill="#0a0c10" />
      <rect x="6.5" y="-10.5" width="5.5" height="2.7" rx="0.6" fill="#0a0c10" />
      <rect x="-13" y="7.8" width="5.5" height="2.7" rx="0.6" fill="#0a0c10" />
      <rect x="-4" y="7.8" width="5.5" height="2.7" rx="0.6" fill="#0a0c10" />
      <rect x="6.5" y="7.8" width="5.5" height="2.7" rx="0.6" fill="#0a0c10" />
      <Beacon x={0} y={0} color1="#1e90ff" color2="#e53e3e" />
    </Body>
  );
}

/* ===== Dispatcher ===== */
export type VehicleSvgKind =
  | "sedan" | "van" | "truck" | "hatch"
  | "police" | "money" | "gign" | "ambulance" | "fire";

export function VehicleSvg({
  kind,
  color = "#888",
  accent = "#333",
  scale = 1,
}: {
  kind: VehicleSvgKind;
  color?: string;
  accent?: string;
  scale?: number;
}) {
  switch (kind) {
    case "police":    return <PoliceSvg scale={scale} />;
    case "money":     return <MoneyTruckSvg scale={scale} />;
    case "gign":      return <GignTruckSvg scale={scale} />;
    case "ambulance": return <AmbulanceSvg scale={scale} />;
    case "fire":      return <FireTruckSvg scale={scale} />;
    case "van":       return <VanSvg color={color} accent={accent} scale={scale} />;
    case "truck":     return <TruckSvg color={color} accent={accent} scale={scale} />;
    case "hatch":     return <HatchSvg color={color} accent={accent} scale={scale} />;
    default:          return <SedanSvg color={color} accent={accent} scale={scale} />;
  }
}

/* ===== Radar de vitesse (poteau au bord de route) ===== */
export function RadarSvg({ scale = 1 }: { scale?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <ellipse cx="0" cy="6" rx="6" ry="2" fill="rgba(0,0,0,0.45)" />
      <rect x="-1.2" y="-3" width="2.4" height="9" fill="#3a3f48" />
      <rect x="-5.5" y="-9" width="11" height="7" rx="1.6" fill="#1a1d22" stroke="#facc15" strokeWidth="0.5" />
      <circle cx="0" cy="-5.5" r="2.6" fill="#0b1018" />
      <circle cx="0" cy="-5.5" r="1.4" fill="#2a3550" />
      <circle cx="-0.6" cy="-6.1" r="0.6" fill="#e2e8f0" opacity="0.7" />
    </g>
  );
}
