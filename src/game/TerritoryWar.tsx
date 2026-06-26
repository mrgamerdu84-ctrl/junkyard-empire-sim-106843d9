// =============================================================
// Guerre de territoire — la ville est découpée en 6 quartiers.
// Chaque course terminée dans un quartier compte vers sa conquête.
// Quand le seuil est atteint, le quartier devient au joueur :
//   - teinte dorée sur la map
//   - bonus passif : +60 $/min par quartier contrôlé
//   - bonus de tarif local +20 % (appliqué côté course via event)
// Persistance localStorage : "mtw-territory-v1".
// =============================================================
import { useEffect, useRef, useState } from "react";

type District = {
  id: string;
  name: string;
  x: number; y: number; w: number; h: number; // viewBox 1920x1080
  count: number;
  owned: boolean;
};

const THRESHOLD = 8;          // courses pour conquérir
const BONUS_PER_DISTRICT = 60; // $/min par quartier
const TICK_MS = 60_000;       // versement chaque minute
const SAVE_KEY = "mtw-territory-v1";

const DEFAULT_DISTRICTS: District[] = [
  { id: "downtown",  name: "Centre",      x:  640, y: 360, w: 640, h: 360, count: 0, owned: false },
  { id: "north_w",   name: "Nord-Ouest",  x:    0, y:   0, w: 640, h: 360, count: 0, owned: false },
  { id: "north_e",   name: "Nord-Est",    x: 1280, y:   0, w: 640, h: 360, count: 0, owned: false },
  { id: "south_w",   name: "Sud-Ouest",   x:    0, y: 720, w: 640, h: 360, count: 0, owned: false },
  { id: "south_e",   name: "Sud-Est",     x: 1280, y: 720, w: 640, h: 360, count: 0, owned: false },
  { id: "harbor",    name: "Port",        x:  640, y: 720, w: 640, h: 360, count: 0, owned: false },
];

function load(): District[] {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return DEFAULT_DISTRICTS;
    const arr = JSON.parse(raw) as District[];
    // merge defaults (au cas où on ajoute des quartiers plus tard)
    return DEFAULT_DISTRICTS.map((d) => arr.find((x) => x.id === d.id) ?? d);
  } catch { return DEFAULT_DISTRICTS; }
}
function save(arr: District[]) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(arr)); } catch {}
}

function findDistrict(arr: District[], x: number, y: number): District | undefined {
  return arr.find((d) => x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h);
}

export default function TerritoryWar() {
  const [districts, setDistricts] = useState<District[]>(load);
  const [toast, setToast] = useState<string | null>(null);
  const ownedCountRef = useRef(0);

  // Persiste à chaque changement.
  useEffect(() => {
    save(districts);
    ownedCountRef.current = districts.filter((d) => d.owned).length;
    // Expose pour d'autres systèmes (ex. bonus tarifaire local).
    (window as unknown as { __mtwTerritory?: District[] }).__mtwTerritory = districts;
  }, [districts]);

  // Course terminée → +1 dans le quartier concerné.
  useEffect(() => {
    const onDone = (e: Event) => {
      const d = (e as CustomEvent<{ x: number; y: number; fare: number }>).detail;
      if (!d) return;
      setDistricts((arr) => {
        const target = findDistrict(arr, d.x, d.y);
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

  // Versement passif des bonus de territoire.
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
          const cy = d.y + d.h / 2;
          const pct = Math.min(100, (d.count / THRESHOLD) * 100);
          return (
            <g key={d.id}>
              <rect
                x={d.x + 4} y={d.y + 4}
                width={d.w - 8} height={d.h - 8}
                fill={d.owned ? "rgba(245,197,66,0.16)" : "rgba(0,0,0,0)"}
                stroke={d.owned ? "#fde047" : "rgba(0,0,0,0)"}
                strokeWidth={d.owned ? 3 : 0}
                rx="14"
              />
              {/* Badge nom + progression */}
              <g transform={`translate(${cx},${d.y + 28})`}>
                <rect x="-72" y="-14" width="144" height="28" rx="14"
                  fill="rgba(12,14,22,0.78)"
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
                    <rect x="-60" y="14" width="120" height="3" rx="1.5" fill="rgba(255,255,255,0.15)" />
                    <rect x="-60" y="14" width={120 * (pct / 100)} height="3" rx="1.5" fill="#fde047" />
                  </>
                )}
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
