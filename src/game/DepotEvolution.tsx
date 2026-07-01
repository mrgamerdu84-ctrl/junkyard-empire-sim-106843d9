// Overlay visuel de l'évolution du dépôt Taxi Co. selon la campagne.
// N'affecte PAS le dépôt existant : c'est un calque décoratif superposé
// aux coordonnées du QG (admin.hqX/hqY) — 5 étapes narratives.
import { useEffect, useState } from "react";
import { useAdminConfig } from "./adminConfig";
import { depotLevel } from "./campaign/campaignState";

export default function DepotEvolution() {
  const admin = useAdminConfig();
  const [level, setLevel] = useState<1 | 2 | 3 | 4 | 5>(() => depotLevel());

  useEffect(() => {
    const on = () => setLevel(depotLevel());
    window.addEventListener("campaign.updated", on);
    return () => window.removeEventListener("campaign.updated", on);
  }, []);

  const x = admin.hqX;
  const y = admin.hqY;

  return (
    <svg
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid meet"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      {/* Niveau 1 : traces de délabrement (cour sale, tas de gravats) */}
      {level === 1 && (
        <g opacity="0.75">
          <ellipse cx={x - 55} cy={y + 45} rx="18" ry="6" fill="#4a3a2a" />
          <ellipse cx={x + 40} cy={y + 50} rx="14" ry="5" fill="#3f3226" />
          <rect x={x - 65} y={y - 60} width="12" height="18" fill="#6b5a3a" transform={`rotate(-14 ${x - 59} ${y - 51})`} />
          <text x={x} y={y - 80} textAnchor="middle" fontSize="12" fontWeight="900" fill="#f87171" opacity="0.85">
            ⚠ DÉLABRÉ
          </text>
        </g>
      )}

      {/* Niveau 2 : premières réparations (lumières allumées, portail réparé) */}
      {level === 2 && (
        <g>
          <circle cx={x - 42} cy={y - 34} r="3" fill="#fde047">
            <animate attributeName="opacity" values="0.6;1;0.6" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <circle cx={x + 42} cy={y - 34} r="3" fill="#fde047">
            <animate attributeName="opacity" values="1;0.6;1" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <rect x={x - 30} y={y + 30} width="60" height="4" fill="#78716c" />
          <text x={x} y={y - 78} textAnchor="middle" fontSize="11" fontWeight="800" fill="#fde047">
            🔧 EN RÉNOVATION
          </text>
        </g>
      )}

      {/* Niveau 3 : atelier fonctionnel (outillage, enseigne provisoire) */}
      {level === 3 && (
        <g>
          <circle cx={x - 42} cy={y - 34} r="3.5" fill="#fde047" opacity="0.95" />
          <circle cx={x + 42} cy={y - 34} r="3.5" fill="#fde047" opacity="0.95" />
          <circle cx={x} cy={y - 44} r="4" fill="#fef3c7" opacity="0.95" />
          <rect x={x - 28} y={y - 92} width="56" height="14" rx="2" fill="#1e293b" stroke="#f5c542" strokeWidth="1" />
          <text x={x} y={y - 81} textAnchor="middle" fontSize="9" fontWeight="900" fill="#fde047">TAXI CO.</text>
          <rect x={x - 55} y={y + 40} width="10" height="10" fill="#dc2626" />
          <rect x={x + 45} y={y + 40} width="10" height="10" fill="#0ea5e9" />
        </g>
      )}

      {/* Niveau 4 : dépôt moderne (parking organisé, enseigne néon) */}
      {level === 4 && (
        <g>
          <rect x={x - 38} y={y - 100} width="76" height="18" rx="3" fill="#0f172a" stroke="#f5c542" strokeWidth="1.5" />
          <text x={x} y={y - 87} textAnchor="middle" fontSize="11" fontWeight="900" fill="#fde047" style={{ filter: "drop-shadow(0 0 3px #fbbf24)" }}>
            TAXI CO.
          </text>
          {[-60, -30, 0, 30, 60].map((dx) => (
            <line key={dx} x1={x + dx} y1={y + 38} x2={x + dx} y2={y + 58} stroke="#fef08a" strokeWidth="1" strokeDasharray="3 2" opacity="0.7" />
          ))}
          <circle cx={x - 42} cy={y - 34} r="3.5" fill="#fde047" />
          <circle cx={x + 42} cy={y - 34} r="3.5" fill="#fde047" />
        </g>
      )}

      {/* Niveau 5 : siège officiel (enseigne dorée, drapeau, éclairage) */}
      {level === 5 && (
        <g>
          <rect x={x - 46} y={y - 108} width="92" height="22" rx="4" fill="#1a1208" stroke="#fbbf24" strokeWidth="2" />
          <text x={x} y={y - 92} textAnchor="middle" fontSize="13" fontWeight="900" fill="#fde047" style={{ filter: "drop-shadow(0 0 5px #fbbf24)" }}>
            ★ TAXI CO. ★
          </text>
          <line x1={x + 50} y1={y - 60} x2={x + 50} y2={y - 100} stroke="#78716c" strokeWidth="1.5" />
          <polygon points={`${x + 50},${y - 100} ${x + 72},${y - 94} ${x + 50},${y - 88}`} fill="#f5c542">
            <animateTransform attributeName="transform" type="rotate" from={`0 ${x + 50} ${y - 94}`} to={`4 ${x + 50} ${y - 94}`} dur="1.4s" repeatCount="indefinite" additive="sum" />
          </polygon>
          {[-70, -35, 0, 35, 70].map((dx) => (
            <g key={dx}>
              <line x1={x + dx} y1={y + 38} x2={x + dx} y2={y + 62} stroke="#fde047" strokeWidth="1.2" strokeDasharray="4 2" opacity="0.85" />
            </g>
          ))}
          <circle cx={x - 55} cy={y - 40} r="4.5" fill="#fef3c7">
            <animate attributeName="opacity" values="0.7;1;0.7" dur="2.6s" repeatCount="indefinite" />
          </circle>
          <circle cx={x + 55} cy={y - 40} r="4.5" fill="#fef3c7">
            <animate attributeName="opacity" values="1;0.7;1" dur="2.6s" repeatCount="indefinite" />
          </circle>
        </g>
      )}
    </svg>
  );
}
