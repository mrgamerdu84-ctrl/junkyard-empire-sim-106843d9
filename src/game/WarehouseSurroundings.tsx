import { useAdminConfig } from "./adminConfig";

/**
 * Intègre visuellement le dépôt (AbandonedWarehouse) dans son quartier :
 *  - parcelle avec clôture grillagée et portail coulissant
 *  - cour bitumée + marquage parking
 *  - allée d'entrée raccordée à la route
 *  - arbres et mobilier urbain (lampadaires, poubelle, panneau "TAXI CO.")
 *
 * Purement décoratif — aucun impact sur le gameplay ni sur les routes existantes.
 * Rendu sous l'entrepôt (zIndex inférieur) pour rester derrière le bâtiment.
 */
export default function WarehouseSurroundings() {
  const admin = useAdminConfig();
  const cx = admin.hqX;
  const cy = admin.hqY;
  const scale = Math.max(0.45, Math.min(2.8, admin.hqScale * 1.15));

  // Emprise de la parcelle (parcelle rectangulaire autour du bâtiment)
  const w = 560 * scale;
  const h = 360 * scale;
  const x = -w / 2;
  const y = -h / 2;

  // Cour bitumée intérieure
  const yardPad = 24 * scale;

  // Portail : ouverture côté sud (bas), largeur ~90px scaled
  const gateW = 110 * scale;
  const gateY = y + h; // bord bas de la parcelle

  return (
    <svg
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 6, // sous AbandonedWarehouse (7)
        overflow: "visible",
      }}
      aria-hidden
    >
      <defs>
        <pattern id="wh-fence" width={14} height={14} patternUnits="userSpaceOnUse">
          <path d="M0,0 L14,14 M14,0 L0,14" stroke="#8a8f96" strokeWidth="1" opacity="0.55" />
        </pattern>
        <linearGradient id="wh-yard" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3d3f44" />
          <stop offset="100%" stopColor="#2a2c30" />
        </linearGradient>
        <radialGradient id="wh-lamp" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffe08a" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffe08a" stopOpacity="0" />
        </radialGradient>
        <filter id="wh-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>

      <g transform={`translate(${cx},${cy})`}>
        {/* Trottoir extérieur */}
        <rect
          x={x - 12 * scale}
          y={y - 12 * scale}
          width={w + 24 * scale}
          height={h + 24 * scale}
          rx={10 * scale}
          fill="#6b6e73"
          opacity="0.85"
        />

        {/* Cour bitumée */}
        <rect
          x={x + yardPad}
          y={y + yardPad}
          width={w - yardPad * 2}
          height={h - yardPad * 2}
          rx={8 * scale}
          fill="url(#wh-yard)"
          filter="url(#wh-soft)"
        />

        {/* Marquage parking (5 places à gauche du bâtiment) */}
        {Array.from({ length: 5 }).map((_, i) => {
          const bx = x + yardPad + 10 * scale;
          const by = y + yardPad + 18 * scale + i * 26 * scale;
          return (
            <g key={`p-${i}`} opacity="0.85">
              <rect x={bx} y={by} width={70 * scale} height={22 * scale} fill="none" stroke="#f1c94a" strokeWidth={1.5} strokeDasharray="4 2" />
            </g>
          );
        })}

        {/* Marquage parking (5 places à droite) */}
        {Array.from({ length: 5 }).map((_, i) => {
          const bx = x + w - yardPad - 10 * scale - 70 * scale;
          const by = y + yardPad + 18 * scale + i * 26 * scale;
          return (
            <g key={`p2-${i}`} opacity="0.85">
              <rect x={bx} y={by} width={70 * scale} height={22 * scale} fill="none" stroke="#f1c94a" strokeWidth={1.5} strokeDasharray="4 2" />
            </g>
          );
        })}

        {/* Allée d'entrée bitume raccordée à la route (sortie sud) */}
        <rect
          x={-gateW / 2 - 6 * scale}
          y={y + h - 4 * scale}
          width={gateW + 12 * scale}
          height={90 * scale}
          fill="#2f3134"
        />
        {/* Bandes blanches allée */}
        <line
          x1={0}
          y1={y + h + 4 * scale}
          x2={0}
          y2={y + h + 82 * scale}
          stroke="#f5f5f5"
          strokeWidth={2}
          strokeDasharray="8 6"
          opacity="0.8"
        />

        {/* Clôture grillagée — 4 côtés avec ouverture pour portail au sud */}
        {/* Haut */}
        <rect x={x} y={y} width={w} height={6 * scale} fill="url(#wh-fence)" stroke="#5a5f66" strokeWidth={1} />
        {/* Gauche */}
        <rect x={x} y={y} width={6 * scale} height={h} fill="url(#wh-fence)" stroke="#5a5f66" strokeWidth={1} />
        {/* Droite */}
        <rect x={x + w - 6 * scale} y={y} width={6 * scale} height={h} fill="url(#wh-fence)" stroke="#5a5f66" strokeWidth={1} />
        {/* Bas gauche (jusqu'au portail) */}
        <rect
          x={x}
          y={gateY - 6 * scale}
          width={(w - gateW) / 2}
          height={6 * scale}
          fill="url(#wh-fence)"
          stroke="#5a5f66"
          strokeWidth={1}
        />
        {/* Bas droite */}
        <rect
          x={x + (w + gateW) / 2}
          y={gateY - 6 * scale}
          width={(w - gateW) / 2}
          height={6 * scale}
          fill="url(#wh-fence)"
          stroke="#5a5f66"
          strokeWidth={1}
        />

        {/* Piliers de portail */}
        {[-1, 1].map((s) => (
          <g key={`pillar-${s}`}>
            <rect
              x={s * (gateW / 2) - 5 * scale}
              y={gateY - 22 * scale}
              width={10 * scale}
              height={26 * scale}
              fill="#c9b27a"
              stroke="#7a6a3f"
              strokeWidth={1}
            />
            <circle cx={s * (gateW / 2)} cy={gateY - 26 * scale} r={4 * scale} fill="#e94b3c" />
          </g>
        ))}

        {/* Vantail de portail entrouvert */}
        <g stroke="#b0b4ba" strokeWidth={1.2}>
          <line x1={-gateW / 2 + 6 * scale} y1={gateY - 4 * scale} x2={-6 * scale} y2={gateY - 4 * scale} />
          <line x1={-gateW / 2 + 6 * scale} y1={gateY - 4 * scale} x2={-gateW / 2 + 6 * scale} y2={gateY - 12 * scale} />
          <line x1={gateW / 2 - 6 * scale} y1={gateY - 4 * scale} x2={6 * scale} y2={gateY - 4 * scale} />
          <line x1={gateW / 2 - 6 * scale} y1={gateY - 4 * scale} x2={gateW / 2 - 6 * scale} y2={gateY - 12 * scale} />
        </g>

        {/* Panneau "TAXI CO." au-dessus du portail */}
        <g transform={`translate(0, ${gateY - 40 * scale})`}>
          <rect x={-46 * scale} y={-12 * scale} width={92 * scale} height={20 * scale} rx={3} fill="#111318" stroke="#f5c542" strokeWidth={1.5} />
          <text
            x={0}
            y={2 * scale}
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
            fontWeight={900}
            fontSize={12 * scale}
            fill="#f5c542"
            letterSpacing={1}
          >
            TAXI CO.
          </text>
        </g>

        {/* Lampadaires (4 coins) — halo lumineux */}
        {[
          [x + 14 * scale, y + 14 * scale],
          [x + w - 14 * scale, y + 14 * scale],
          [x + 14 * scale, y + h - 14 * scale],
          [x + w - 14 * scale, y + h - 14 * scale],
        ].map(([lx, ly], i) => (
          <g key={`lamp-${i}`}>
            <circle cx={lx} cy={ly} r={30 * scale} fill="url(#wh-lamp)" />
            <circle cx={lx} cy={ly} r={2.5} fill="#ffd76b" />
            <rect x={lx - 0.8} y={ly} width={1.6} height={10 * scale} fill="#444" />
          </g>
        ))}

        {/* Arbres autour de la parcelle */}
        {[
          [x - 26 * scale, y - 24 * scale],
          [x + w * 0.25, y - 30 * scale],
          [x + w * 0.75, y - 30 * scale],
          [x + w + 26 * scale, y - 24 * scale],
          [x - 26 * scale, y + h + 24 * scale],
          [x + w + 26 * scale, y + h + 24 * scale],
        ].map(([tx, ty], i) => (
          <g key={`tree-${i}`}>
            <ellipse cx={tx} cy={ty + 4} rx={10} ry={3} fill="#000" opacity="0.35" />
            <circle cx={tx} cy={ty} r={12} fill="#2f5d34" />
            <circle cx={tx - 4} cy={ty - 3} r={7} fill="#3d7a44" />
            <circle cx={tx + 5} cy={ty + 2} r={6} fill="#4a8f52" opacity="0.9" />
          </g>
        ))}

        {/* Poubelle + banc près du portail */}
        <g transform={`translate(${-gateW / 2 - 22 * scale}, ${gateY + 18 * scale})`}>
          <rect x={-4} y={-6} width={8} height={10} fill="#2d7a3a" stroke="#1b4a24" />
        </g>
        <g transform={`translate(${gateW / 2 + 22 * scale}, ${gateY + 20 * scale})`}>
          <rect x={-14} y={-2} width={28} height={4} fill="#7a5a2a" stroke="#3d2a10" />
          <rect x={-13} y={2} width={3} height={5} fill="#3d2a10" />
          <rect x={10} y={2} width={3} height={5} fill="#3d2a10" />
        </g>
      </g>
    </svg>
  );
}
