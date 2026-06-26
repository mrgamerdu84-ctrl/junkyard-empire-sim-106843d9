/**
 * CityMapRender.tsx — Fond top-down (style GTA 1/2).
 *
 * Rend :
 *   1. Les 12 fonds de quartier colorés selon leur type (ou la couleur
 *      du propriétaire si conquis).
 *   2. Le trottoir + l'asphalte de chaque edge du roadGraph.
 *   3. Le marquage central des routes (pointillés blancs).
 *   4. Les passages piétons.
 *   5. Le QG fixe de chaque district (rectangle coloré).
 *
 * Pensé pour être inséré comme première couche enfant de la <svg> principale
 * du TaxiTycoon (viewBox 0 0 1920 1080). Toutes les coordonnées sont en
 * unités viewBox.
 */

import { DISTRICTS, ZONE_COLORS, MAP_PALETTE, type District } from "./cityMap";
import {
  NODES, EDGES, CROSSWALKS, ROAD_WIDTH, SIDEWALK_WIDTH, CROSSWALK_LEN,
} from "./roadGraph";

export type DistrictOwnership = {
  /** Map districtId -> couleur de la compagnie propriétaire (ou null) */
  ownerColors?: Record<string, string | null | undefined>;
};

export default function CityMapRender({ ownerColors }: DistrictOwnership = {}) {
  return (
    <g aria-label="city-map-base" pointerEvents="none">
      {/* === 1. Fonds de quartier === */}
      {DISTRICTS.map((d) => (
        <DistrictBg key={d.id} d={d} ownerColor={ownerColors?.[d.id] ?? null} />
      ))}

      {/* === 2. Trottoirs (légèrement plus larges que la route) === */}
      {EDGES.map((e) => {
        const a = NODES[e.from], b = NODES[e.to];
        const isH = e.dir === "h";
        const sw = ROAD_WIDTH + SIDEWALK_WIDTH * 2;
        return (
          <rect
            key={`sw-${e.id}`}
            x={isH ? a.x : a.x - sw / 2}
            y={isH ? a.y - sw / 2 : a.y}
            width={isH ? (b.x - a.x) : sw}
            height={isH ? sw : (b.y - a.y)}
            fill={MAP_PALETTE.sidewalk}
          />
        );
      })}

      {/* === 3. Asphalte === */}
      {EDGES.map((e) => {
        const a = NODES[e.from], b = NODES[e.to];
        const isH = e.dir === "h";
        return (
          <rect
            key={`rd-${e.id}`}
            x={isH ? a.x : a.x - ROAD_WIDTH / 2}
            y={isH ? a.y - ROAD_WIDTH / 2 : a.y}
            width={isH ? (b.x - a.x) : ROAD_WIDTH}
            height={isH ? ROAD_WIDTH : (b.y - a.y)}
            fill={MAP_PALETTE.asphalt}
          />
        );
      })}

      {/* === 4. Marquage central pointillé === */}
      {EDGES.map((e) => {
        const a = NODES[e.from], b = NODES[e.to];
        return (
          <line
            key={`mk-${e.id}`}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={MAP_PALETTE.laneMark}
            strokeWidth="1.2"
            strokeDasharray="10 8"
            opacity="0.85"
          />
        );
      })}

      {/* === 5. Intersections (carré asphalte plein pour cacher les jonctions) === */}
      {NODES.map((n) => (
        <rect
          key={`int-${n.id}`}
          x={n.x - ROAD_WIDTH / 2}
          y={n.y - ROAD_WIDTH / 2}
          width={ROAD_WIDTH}
          height={ROAD_WIDTH}
          fill={MAP_PALETTE.asphalt}
        />
      ))}

      {/* === 6. Passages piétons === */}
      {CROSSWALKS.map((cw, i) => (
        <Crosswalk key={i} x={cw.x} y={cw.y} dir={cw.dir} />
      ))}

      {/* === 7. QG fixes (cubes top-down colorés) === */}
      {DISTRICTS.map((d) => (
        <HQMarker
          key={`hq-${d.id}`}
          d={d}
          color={ownerColors?.[d.id] ?? null}
        />
      ))}
    </g>
  );
}

function DistrictBg({ d, ownerColor }: { d: District; ownerColor: string | null }) {
  const base = ZONE_COLORS[d.type];
  return (
    <g>
      <rect x={d.x} y={d.y} width={d.w} height={d.h} fill={base} />
      {ownerColor && (
        <rect
          x={d.x} y={d.y} width={d.w} height={d.h}
          fill={ownerColor}
          opacity="0.28"
        />
      )}
      {/* Bordure douce du quartier */}
      <rect
        x={d.x + 0.5} y={d.y + 0.5}
        width={d.w - 1} height={d.h - 1}
        fill="none"
        stroke="rgba(0,0,0,0.08)"
        strokeWidth="1"
      />
      {/* Label discret du quartier */}
      <text
        x={d.x + 14}
        y={d.y + 22}
        fontSize="13"
        fontWeight="800"
        fill="rgba(20,24,30,0.55)"
        fontFamily="ui-sans-serif, system-ui"
        letterSpacing="0.5"
      >
        {d.id} · {d.name}
      </text>
    </g>
  );
}

function Crosswalk({ x, y, dir }: { x: number; y: number; dir: "h" | "v" }) {
  // 4 bandes blanches perpendiculaires à la route.
  const bands = 4;
  const bandW = 3;
  const gap = 2;
  const totalAcross = bands * bandW + (bands - 1) * gap;
  const startAcross = -totalAcross / 2;

  if (dir === "v") {
    // Passage qui traverse une route horizontale : bandes verticales.
    return (
      <g>
        {Array.from({ length: bands }).map((_, i) => (
          <rect
            key={i}
            x={x - CROSSWALK_LEN / 2}
            y={y + startAcross + i * (bandW + gap)}
            width={CROSSWALK_LEN}
            height={bandW}
            fill={MAP_PALETTE.crosswalk}
            opacity="0.95"
          />
        ))}
      </g>
    );
  }
  return (
    <g>
      {Array.from({ length: bands }).map((_, i) => (
        <rect
          key={i}
          x={x + startAcross + i * (bandW + gap)}
          y={y - CROSSWALK_LEN / 2}
          width={bandW}
          height={CROSSWALK_LEN}
          fill={MAP_PALETTE.crosswalk}
          opacity="0.95"
        />
      ))}
    </g>
  );
}

function HQMarker({ d, color }: { d: District; color: string | null }) {
  const c = color ?? "#6b7280";
  const W = 44, H = 32;
  return (
    <g transform={`translate(${d.hq.x},${d.hq.y})`}>
      {/* ombre */}
      <ellipse cx="0" cy={H / 2 + 3} rx={W / 2 + 2} ry="4" fill="rgba(0,0,0,0.35)" />
      {/* base */}
      <rect
        x={-W / 2} y={-H / 2}
        width={W} height={H}
        rx="3"
        fill={c}
        stroke={MAP_PALETTE.hqStroke}
        strokeWidth="1.5"
      />
      {/* toit blanc */}
      <rect
        x={-W / 2 + 4} y={-H / 2 + 4}
        width={W - 8} height="6"
        fill="rgba(255,255,255,0.85)"
      />
      {/* lettre HQ */}
      <text
        x="0" y="6"
        fontSize="11"
        fontWeight="900"
        textAnchor="middle"
        fill="#fff"
        stroke="#000"
        strokeWidth="0.4"
      >HQ</text>
    </g>
  );
}
