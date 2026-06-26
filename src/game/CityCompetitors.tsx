// =============================================================
// Lot 3 — Concurrents IA + Économie
// Quatre compagnies rivales possèdent un QG fixe sur la carte.
// Leur trésorerie évolue de façon pseudo-aléatoire et leur fortune
// est comparée en temps réel à celle du joueur (lue dans localStorage).
// Dès que le joueur les dépasse largement (×3), elles font faillite :
// le QG vire au gris, un crâne apparaît, et la compagnie est éliminée.
// =============================================================
import { useEffect, useMemo, useState } from "react";
import { preserveAspectFor, useMapFit } from "./mapView";
import playerHqAsset from "@/assets/player-hq.png.asset.json";
import { DEFAULT_DISTRICTS } from "./TerritoryWar";

const PLAYER_HQ_IMG = playerHqAsset.url;
const SAVE_KEY = "taxi-tycoon-v4";

// Emplacements fixes des QG concurrents (viewBox 1920x1080).
// Strictement HORS routes : on réutilise les positions des QG de quartier
// définies dans TerritoryWar (déjà placées dans les zones libres de la carte),
// puis 2 spots additionnels en zone bâtie pour les concurrents niv. 9 et 10.
const DISTRICT_HQ_SLOTS = DEFAULT_DISTRICTS.map((d) => ({
  x: d.hqX,
  y: d.hqY,
  districtId: d.id,
  color: d.color,
}));
const EXTRA_OFFROAD_SLOTS = [
  { x:  340, y:  120, districtId: "riverside", color: "#0ea5e9" },
  { x: 1620, y:  120, districtId: "marina",    color: "#06b6d4" },
];
const FIXED_HQ_SLOTS = [...DISTRICT_HQ_SLOTS, ...EXTRA_OFFROAD_SLOTS];

// Hex (#rrggbb) -> [r,g,b] 0..1 pour feFlood en filtre SVG
function hexToRgb01(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [1, 1, 1];
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
}

type Competitor = {
  id: string;
  name: string;
  color: string;
  // Coordonnées dans le viewBox 1920x1080 de la carte
  x: number;
  y: number;
  treasury: number;
  taxiCount: number;
  bankrupt: boolean;
  vehicleUrl?: string;
};

const INITIAL: Competitor[] = [
  { id: "yellow",  name: "Yellow Cab Co.",      color: "#facc15", x: 380,  y: 240, treasury: 12_000, taxiCount: 8,  bankrupt: false },
  { id: "blue",    name: "Blue Wave Taxis",     color: "#3b82f6", x: 1480, y: 360, treasury: 18_000, taxiCount: 11, bankrupt: false },
  { id: "neon",    name: "Neon Rides",          color: "#22d3ee", x: 560,  y: 820, treasury:  9_500, taxiCount: 6,  bankrupt: false },
  { id: "shadow",  name: "Shadow Transports",   color: "#a855f7", x: 1620, y: 760, treasury: 22_000, taxiCount: 14, bankrupt: false },
];

// Emplacements de QG additionnels — chaque level-up choisit le suivant libre.
const EXTRA_HQ_SPOTS: { x: number; y: number; color: string; name: string }[] = [
  { x: 900,  y: 200, color: "#ef4444", name: "Crimson Cabs" },
  { x: 1280, y: 940, color: "#10b981", name: "Verde Voyages" },
  { x: 220,  y: 500, color: "#f97316", name: "Orange Pulse" },
  { x: 1750, y: 220, color: "#ec4899", name: "Pink Bullet" },
  { x: 760,  y: 1000, color: "#0ea5e9", name: "Aqua Streets" },
  { x: 1100, y: 560, color: "#84cc16", name: "Lime Limos" },
];
const MAX_COMPETITORS = INITIAL.length + EXTRA_HQ_SPOTS.length; // 10
const TAUNTS = [
  "On va t'écraser, bleu !",
  "Range-toi, amateur.",
  "Mes taxis vont plus vite que les tiens.",
  "Tu peux laisser tomber le permis.",
  "Bientôt, c'est nous qui aurons la ville.",
];

function readPlayerMoney(): number {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return 0;
    const j = JSON.parse(raw);
    return Number(j?.money ?? 0);
  } catch { return 0; }
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return Math.round(n).toString();
}

export default function CityCompetitors() {
  const [comps, setComps] = useState<Competitor[]>(INITIAL);
  const [playerMoney, setPlayerMoney] = useState<number>(0);
  const [bankruptToast, setBankruptToast] = useState<string | null>(null);
  const [taunt, setTaunt] = useState<{ id: number; from: string; color: string; text: string } | null>(null);
  const fit = useMapFit();

  // Position de QG fixe pour chaque concurrent (slot stable basé sur l'index).
  // La COULEUR du concurrent est verrouillée sur celle du territoire qu'il habite,
  // afin que ses taxis (qui héritent de comp.color) portent la teinte du quartier.
  const compsWithFixedHq = useMemo(() => comps.map((c, i) => {
    const slot = FIXED_HQ_SLOTS[i % FIXED_HQ_SLOTS.length];
    return { ...c, x: slot.x, y: slot.y, color: slot.color };
  }), [comps]);

  // Publie la liste (avec positions fixes) pour les taxis rivaux.
  useEffect(() => {
    (window as unknown as { __jceCompetitors?: Competitor[] }).__jceCompetitors = compsWithFixedHq;
    window.dispatchEvent(new CustomEvent("jce:competitors-changed", { detail: compsWithFixedHq }));
  }, [compsWithFixedHq]);

  // Hydratation depuis le cloud (admin sync) OU depuis le panel admin (ajout/suppression).
  useEffect(() => {
    const onSet = (e: Event) => {
      const detail = (e as CustomEvent<Competitor[]>).detail;
      if (Array.isArray(detail) && detail.length > 0) {
        setComps(detail);
      }
    };
    window.addEventListener("jce:competitors-set", onSet as EventListener);
    return () => window.removeEventListener("jce:competitors-set", onSet as EventListener);
  }, []);



  // Level-up joueur → nouveau concurrent agressif (cap 10).
  useEffect(() => {
    const onLevelUp = () => {
      setComps((arr) => {
        if (arr.length >= MAX_COMPETITORS) return arr;
        const spot = EXTRA_HQ_SPOTS[arr.length - INITIAL.length];
        if (!spot) return arr;
        const index = arr.length - INITIAL.length + 1;
        const aggression = 1 + index * 0.25;
        const newComp: Competitor = {
          id: `lvl-${arr.length}`,
          name: `${spot.name} (Niv ${index + 1})`,
          color: spot.color,
          x: spot.x, y: spot.y,
          treasury: Math.round(15_000 * aggression),
          taxiCount: Math.round(8 + index * 2),
          bankrupt: false,
        };
        setBankruptToast(`🏢 Nouveau concurrent : ${newComp.name} !`);
        window.setTimeout(() => setBankruptToast(null), 5000);
        return [...arr, newComp];
      });
    };
    window.addEventListener("jce:license-up", onLevelUp as EventListener);
    return () => window.removeEventListener("jce:license-up", onLevelUp as EventListener);
  }, []);

  // Narguage périodique
  useEffect(() => {
    const t = window.setInterval(() => {
      setComps((arr) => {
        // Un concurrent ne « parle » que s'il est ACTIF sur la map :
        // pas en faillite ET au moins un taxi qui circule.
        const alive = arr.filter((c) => !c.bankrupt && c.taxiCount > 0);
        if (alive.length === 0) return arr;
        const aggressive = alive.filter((c) => c.id.startsWith("lvl-"));
        const pool = aggressive.length > 0 && Math.random() < 0.7 ? aggressive : alive;
        const who = pool[Math.floor(Math.random() * pool.length)];
        const text = TAUNTS[Math.floor(Math.random() * TAUNTS.length)];
        setTaunt({ id: Date.now(), from: who.name, color: who.color, text });
        window.setTimeout(() => setTaunt(null), 4200);
        return arr;
      });
    }, 22000);
    return () => window.clearInterval(t);
  }, []);

  // Tick IA : trésorerie fluctue toutes les 5s ; concurrents agressifs (id "lvl-*") croissent plus vite.
  useEffect(() => {
    const t = window.setInterval(() => {
      setComps((arr) =>
        arr.map((c) => {
          if (c.bankrupt) return c;
          const isAggressive = c.id.startsWith("lvl-");
          const lo = isAggressive ? -0.04 : -0.08;
          const hi = isAggressive ? 0.28 : 0.20;
          const delta = c.treasury * (lo + Math.random() * (hi - lo));
          const nextT = Math.max(500, c.treasury + delta);
          const dT = Math.random() < (isAggressive ? 0.25 : 0.15) ? (Math.random() < 0.5 ? -1 : 1) : 0;
          return { ...c, treasury: nextT, taxiCount: Math.max(1, c.taxiCount + dT) };
        }),
      );
    }, 5000);
    return () => window.clearInterval(t);
  }, []);

  // Lit la trésorerie joueur toutes les 2s pour comparaison
  useEffect(() => {
    const tick = () => setPlayerMoney(readPlayerMoney());
    tick();
    const t = window.setInterval(tick, 2000);
    return () => window.clearInterval(t);
  }, []);

  // Faillites : si le joueur dépasse ×3 la trésorerie d'un concurrent
  useEffect(() => {
    setComps((arr) => {
      let changed = false;
      const next = arr.map((c) => {
        if (c.bankrupt) return c;
        if (playerMoney > c.treasury * 3 && playerMoney > 5000) {
          changed = true;
          setBankruptToast(`💀 ${c.name} a fait faillite !`);
          window.setTimeout(() => setBankruptToast(null), 6000);
          return { ...c, bankrupt: true, taxiCount: 0 };
        }
        return c;
      });
      return changed ? next : arr;
    });
  }, [playerMoney]);

  // === Camion blindé : résolution croisée sur les rivaux ===
  // - success + rival → +loot pour le rival vainqueur, -15% pour TOUS les autres rivaux (joueur géré côté ArmoredTruck)
  // - !success + rival → ce rival perd 50% du butin
  useEffect(() => {
    const onArmored = (e: Event) => {
      const d = (e as CustomEvent<{ winner: "player" | "rival" | "none"; rivalId?: string; amount: number; success: boolean }>).detail;
      if (!d) return;
      setComps((arr) => arr.map((c) => {
        if (c.bankrupt) return c;
        if (d.winner === "rival" && d.success) {
          if (c.id === d.rivalId) {
            return { ...c, treasury: c.treasury + d.amount };
          }
          // Autres rivaux : -15%
          return { ...c, treasury: Math.max(100, c.treasury * 0.85) };
        }
        if (d.winner === "none" && d.rivalId && c.id === d.rivalId) {
          // Rival raté : pénalité 50% du butin
          return { ...c, treasury: Math.max(100, c.treasury - d.amount * 0.5) };
        }
        return c;
      }));
      if (d.winner === "rival" && d.success) {
        const name = (window as unknown as { __jceCompetitors?: Competitor[] }).__jceCompetitors?.find((c) => c.id === d.rivalId)?.name;
        setBankruptToast(`💸 ${name ?? "Un rival"} a braqué le camion ! −15 % pour les autres`);
        window.setTimeout(() => setBankruptToast(null), 5500);
      }
    };
    window.addEventListener("jce:armored-resolved", onArmored as EventListener);
    return () => window.removeEventListener("jce:armored-resolved", onArmored as EventListener);
  }, []);

  return (
    <>
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio={preserveAspectFor(fit)}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 6 }}
      >
        <defs>
          {compsWithFixedHq.map((c) => {
            const [r, g, b] = hexToRgb01(c.bankrupt ? "#4b5563" : c.color);
            return (
              <filter
                key={`tint-${c.id}`}
                id={`mtw-tint-${c.id}`}
                x="0%" y="0%" width="100%" height="100%"
                colorInterpolationFilters="sRGB"
              >
                {/* Flood = couleur compagnie, masquée par l'alpha de l'image,
                    puis multipliée avec l'image originale pour préserver le shading. */}
                <feFlood floodColor={`rgb(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)})`} result="flood" />
                <feComposite in="flood" in2="SourceGraphic" operator="in" result="masked" />
                <feBlend in="masked" in2="SourceGraphic" mode="multiply" />
              </filter>
            );
          })}
        </defs>

        {compsWithFixedHq.map((c) => {
          const opacity = c.bankrupt ? 0.55 : 1;
          const HQ_W = 200;
          const HQ_H = 200;
          return (
            <g key={c.id} transform={`translate(${c.x},${c.y})`} opacity={opacity}>
              {/* ombre sous le bâtiment */}
              <ellipse cx="0" cy={HQ_H * 0.42} rx={HQ_W * 0.42} ry={HQ_H * 0.08} fill="rgba(0,0,0,0.5)" />
              {/* QG (image du joueur, teintée à la couleur de la compagnie) */}
              <image
                href={PLAYER_HQ_IMG}
                x={-HQ_W / 2}
                y={-HQ_H / 2}
                width={HQ_W}
                height={HQ_H}
                preserveAspectRatio="xMidYMid meet"
                filter={`url(#mtw-tint-${c.id})`}
                style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.55))" }}
              />
              {/* enseigne / nom compagnie */}
              <g transform={`translate(0,${HQ_H * 0.5 + 6})`}>
                <rect x="-60" y="-9" width="120" height="16" rx="8"
                  fill="rgba(12,14,22,0.88)" stroke={c.color} strokeWidth="1.5" />
                <text x="0" y="2" textAnchor="middle" fontSize="9" fontWeight="900"
                  fill={c.bankrupt ? "#9ca3af" : c.color}
                  fontFamily="system-ui, sans-serif" letterSpacing="0.5">
                  {c.name.split(" ")[0].toUpperCase()}
                </text>
              </g>
              {/* badge trésorerie au-dessus */}
              <g transform={`translate(0,${-HQ_H * 0.5 - 14})`}>
                <rect x="-44" y="-10" width="88" height="18" rx="9"
                  fill="rgba(15,23,42,0.88)" stroke={c.color} strokeWidth="1.2" />
                <text x="0" y="3" textAnchor="middle" fontSize="10" fontWeight="900"
                  fill="#fff7d6" fontFamily="system-ui, sans-serif">
                  {c.bankrupt ? "FAILLITE" : `💰 ${fmt(c.treasury)}$`}
                </text>
              </g>
              {/* taxis */}
              {!c.bankrupt && (
                <text x="0" y={HQ_H * 0.5 + 24} textAnchor="middle" fontSize="10" fontWeight="800"
                  fill="#fff7d6" stroke="#000" strokeWidth="2.5" paintOrder="stroke"
                  fontFamily="system-ui, sans-serif">
                  🚕 ×{c.taxiCount}
                </text>
              )}
              {/* crâne faillite */}
              {c.bankrupt && (
                <text x="0" y="6" textAnchor="middle" fontSize="42" opacity="0.85">💀</text>
              )}
            </g>
          );
        })}
      </svg>


      {bankruptToast && (
        <div
          style={{
            position: "fixed", top: 120, left: "50%", transform: "translateX(-50%)",
            zIndex: 10000, background: "linear-gradient(180deg,#991b1b,#450a0a)",
            color: "#fff7d6", padding: "10px 16px", borderRadius: 12,
            border: "2px solid #fde047", fontWeight: 900, fontSize: 14,
            fontFamily: "system-ui, sans-serif",
            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
          }}
        >
          {bankruptToast}
        </div>
      )}

      {taunt && (
        <div
          key={taunt.id}
          style={{
            position: "fixed", bottom: 160, right: 12,
            zIndex: 10000, maxWidth: 240,
            background: "rgba(12,14,22,0.92)",
            color: "#fff7d6", padding: "8px 12px", borderRadius: 12,
            border: `2px solid ${taunt.color}`,
            fontWeight: 700, fontSize: 12,
            fontFamily: "system-ui, sans-serif",
            boxShadow: "0 6px 18px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ fontSize: 10, color: taunt.color, fontWeight: 900, marginBottom: 2 }}>
            {taunt.from} dit :
          </div>
          « {taunt.text} »
        </div>
      )}
    </>

  );
}
