// =============================================================
// Guerre de territoire — V2.
// La ville est découpée en 8 quartiers (grille 4×2). Chaque
// quartier a son propre QG (icône sur la carte). Les taxis rivaux
// sont assignés à un quartier en fonction du QG de leur opérateur,
// et restent en priorité dans leur secteur (cf. CityRivalTaxis).
//
// Mécanique de conquête :
//   - Course terminée dans un quartier → +1 dans sa jauge.
//   - À 8 courses : quartier conquis (contour doré + halo).
//   - Bonus passif : +60 $/min par quartier contrôlé.
// =============================================================
import { useEffect, useRef, useState } from "react";

export type District = {
  id: string;
  name: string;
  x: number; y: number; w: number; h: number; // viewBox 1920x1080
  hqX: number; hqY: number;                    // position du QG du quartier
  count: number;
  owned: boolean;
};

const THRESHOLD = 8;
const BONUS_PER_DISTRICT = 60;
const TICK_MS = 60_000;
const SAVE_KEY = "mtw-territory-v2";

// 8 quartiers en grille 4×2 (chaque cellule : 480×540)
export const DEFAULT_DISTRICTS: District[] = [
  { id: "riverside",  name: "Riverside",   x:    0, y:   0, w: 480, h: 540, hqX:  220, hqY: 240, count: 0, owned: false },
  { id: "centre",     name: "Centre",      x:  480, y:   0, w: 480, h: 540, hqX:  720, hqY: 200, count: 0, owned: false },
  { id: "affaires",   name: "Affaires",    x:  960, y:   0, w: 480, h: 540, hqX: 1180, hqY: 220, count: 0, owned: false },
  { id: "marina",     name: "Marina",      x: 1440, y:   0, w: 480, h: 540, hqX: 1680, hqY: 240, count: 0, owned: false },
  { id: "vieuxport",  name: "Vieux Port",  x:    0, y: 540, w: 480, h: 540, hqX:  240, hqY: 820, count: 0, owned: false },
  { id: "bastide",    name: "Bastide",     x:  480, y: 540, w: 480, h: 540, hqX:  760, hqY: 880, count: 0, owned: false },
  { id: "gare",       name: "Gare",        x:  960, y: 540, w: 480, h: 540, hqX: 1200, hqY: 860, count: 0, owned: false },
  { id: "industriel", name: "Industriel",  x: 1440, y: 540, w: 480, h: 540, hqX: 1680, hqY: 820, count: 0, owned: false },
];

export function findDistrictAt(arr: District[], x: number, y: number): District | undefined {
  return arr.find((d) => x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h);
}

function load(): District[] {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return DEFAULT_DISTRICTS;
    const arr = JSON.parse(raw) as District[];
    return DEFAULT_DISTRICTS.map((d) => {
      const prev = arr.find((x) => x.id === d.id);
      return prev ? { ...d, count: prev.count, owned: prev.owned } : d;
    });
  } catch { return DEFAULT_DISTRICTS; }
}
function save(arr: District[]) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(arr)); } catch {}
}

export default function TerritoryWar() {
  const [districts, setDistricts] = useState<District[]>(load);
  const [toast, setToast] = useState<string | null>(null);
  const ownedCountRef = useRef(0);

  useEffect(() => {
    save(districts);
    ownedCountRef.current = districts.filter((d) => d.owned).length;
    (window as unknown as { __mtwTerritory?: District[] }).__mtwTerritory = districts;
  }, [districts]);

  useEffect(() => {
    const onDone = (e: Event) => {
      const d = (e as CustomEvent<{ x: number; y: number; fare: number }>).detail;
      if (!d) return;
      setDistricts((arr) => {
        const target = findDistrictAt(arr, d.x, d.y);
        if (!target || target.owned) return arr;
        const nextCount = target.count + 1;
        if (nextCount >= THRESHOLD) {
          setToast(`🏁 Quartier conquis : ${target.name} ! +${BONUS_PER_DISTRICT} $/min`);
          window.setTimeout(() => setToast(null), 4500);
        }
        return arr.map((x) =>
          x.id === target.id
            ? { ...x, count: nextCount, owned: nextCount >= THRESHOLD }
            : x,
        );
      });
    };
    window.addEventListener("mtw:course-completed", onDone as EventListener);
    return () => window.removeEventListener("mtw:course-completed", onDone as EventListener);
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => {
      const owned = ownedCountRef.current;
      if (owned <= 0) return;
      const amount = owned * BONUS_PER_DISTRICT;
      window.dispatchEvent(new CustomEvent("jce.player.cashDelta", {
        detail: { amount, reason: "territory", label: `quartiers ×${owned}` },
      }));
    }, TICK_MS);
    return () => window.clearInterval(t);
  }, []);

  return (
    <>
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 5 }}
      >
        {districts.map((d) => {
          const cx = d.x + d.w / 2;
          const pct = Math.min(100, (d.count / THRESHOLD) * 100);
          return (
            <g key={d.id}>
              {/* Bordure subtile pour délimiter chaque quartier */}
              <rect
                x={d.x + 2} y={d.y + 2}
                width={d.w - 4} height={d.h - 4}
                fill={d.owned ? "rgba(245,197,66,0.14)" : "rgba(0,0,0,0)"}
                stroke={d.owned ? "#fde047" : "rgba(253,224,71,0.18)"}
                strokeWidth={d.owned ? 3 : 1}
                strokeDasharray={d.owned ? "" : "6 8"}
                rx="14"
              />

              {/* Badge nom + progression en haut du quartier */}
              <g transform={`translate(${cx},${d.y + 26})`}>
                <rect x="-78" y="-14" width="156" height="28" rx="14"
                  fill="rgba(12,14,22,0.82)"
                  stroke={d.owned ? "#fde047" : "#7c7361"} strokeWidth="1.5" />
                <text x="0" y="-1" textAnchor="middle" fontSize="10" fontWeight="900"
                  fill={d.owned ? "#fde047" : "#fff7d6"}
                  fontFamily="system-ui, sans-serif" letterSpacing="1">
                  {d.owned ? `★ ${d.name.toUpperCase()} ★` : d.name.toUpperCase()}
                </text>
                <text x="0" y="10" textAnchor="middle" fontSize="8" fontWeight="700"
                  fill={d.owned ? "#fff7d6" : "#cbb98a"}
                  fontFamily="system-ui, sans-serif">
                  {d.owned ? `+${BONUS_PER_DISTRICT}$/min` : `${d.count}/${THRESHOLD} courses`}
                </text>
                {!d.owned && (
                  <>
                    <rect x="-66" y="14" width="132" height="3" rx="1.5" fill="rgba(255,255,255,0.15)" />
                    <rect x="-66" y="14" width={132 * (pct / 100)} height="3" rx="1.5" fill="#fde047" />
                  </>
                )}
              </g>

              {/* QG du quartier */}
              <g transform={`translate(${d.hqX},${d.hqY})`}>
                <circle r="14" fill="rgba(12,14,22,0.85)"
                  stroke={d.owned ? "#fde047" : "#cbb98a"} strokeWidth="2" />
                <text x="0" y="4" textAnchor="middle" fontSize="14" fontWeight="900"
                  fill={d.owned ? "#fde047" : "#fff7d6"}
                  fontFamily="system-ui, sans-serif">⌂</text>
              </g>
            </g>
          );
        })}
      </svg>

      {toast && (
        <div style={{
          position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)",
          zIndex: 10000,
          background: "linear-gradient(180deg,#7c5e10,#3b2a04)",
          color: "#fff7d6", padding: "10px 18px", borderRadius: 14,
          border: "2px solid #fde047", fontWeight: 900, fontSize: 14,
          fontFamily: "system-ui, sans-serif",
          boxShadow: "0 8px 24px rgba(0,0,0,0.65)",
        }}>
          {toast}
        </div>
      )}
    </>
  );
}
