// =============================================================
// Guerre de territoire — V3
// La ville est découpée en 8 quartiers (grille 4×2). Chaque
// quartier a sa propre couleur d'identité et son QG visible.
//
// Compétition hebdomadaire :
//   - Chaque course terminée dans un quartier crédite +1 au
//     score hebdo de sa compagnie (joueur OU compagnie rivale).
//   - À la fin de la semaine ISO (dimanche → lundi), le quartier
//     est attribué à la compagnie ayant fait le plus de courses
//     dedans pendant la semaine écoulée.
//   - Bonus passif (+60 $/min par quartier détenu par le joueur).
//   - Si le joueur perd des quartiers : modale « Recommencer /
//     Continuer la conquête ».
// =============================================================
import { useEffect, useRef, useState } from "react";
import { preserveAspectFor, useMapFit } from "./mapView";

type LiveComp = { id: string; color: string; name?: string };
function readLiveComps(): LiveComp[] {
  const w = window as unknown as { __jceCompetitors?: LiveComp[] };
  return Array.isArray(w.__jceCompetitors) ? w.__jceCompetitors : [];
}

export type District = {
  id: string;
  name: string;
  color: string;                 // couleur d'identité du quartier
  x: number; y: number; w: number; h: number; // viewBox 1920x1080
  hqX: number; hqY: number;
  weekCounts: Record<string, number>; // "player" | compId -> nb courses cette semaine
  owner: string | null;          // "player" | compId | null
  // champs hérités (lus par TerritoryPanel/CityRivalTaxis)
  count: number;
  owned: boolean;
};

const BONUS_PER_DISTRICT = 60;
const TICK_MS = 60_000;
const SAVE_KEY = "mtw-territory-v3";
const WEEK_KEY = "mtw-territory-week";

// 8 quartiers en grille 4×2 (chaque cellule : 480×540)
export const DEFAULT_DISTRICTS: District[] = [
  { id: "riverside",  name: "Riverside",   color: "#0ea5e9", x:    0, y:   0, w: 480, h: 540, hqX:  220, hqY: 240, weekCounts: {}, owner: null, count: 0, owned: false },
  { id: "centre",     name: "Centre",      color: "#f59e0b", x:  480, y:   0, w: 480, h: 540, hqX:  720, hqY: 200, weekCounts: {}, owner: null, count: 0, owned: false },
  { id: "affaires",   name: "Affaires",    color: "#8b5cf6", x:  960, y:   0, w: 480, h: 540, hqX: 1180, hqY: 220, weekCounts: {}, owner: null, count: 0, owned: false },
  { id: "marina",     name: "Marina",      color: "#06b6d4", x: 1440, y:   0, w: 480, h: 540, hqX: 1680, hqY: 240, weekCounts: {}, owner: null, count: 0, owned: false },
  { id: "vieuxport",  name: "Vieux Port",  color: "#10b981", x:    0, y: 540, w: 480, h: 540, hqX:  240, hqY: 820, weekCounts: {}, owner: null, count: 0, owned: false },
  { id: "bastide",    name: "Bastide",     color: "#ef4444", x:  480, y: 540, w: 480, h: 540, hqX:  760, hqY: 880, weekCounts: {}, owner: null, count: 0, owned: false },
  { id: "gare",       name: "Gare",        color: "#ec4899", x:  960, y: 540, w: 480, h: 540, hqX: 1200, hqY: 860, weekCounts: {}, owner: null, count: 0, owned: false },
  { id: "industriel", name: "Industriel",  color: "#84cc16", x: 1440, y: 540, w: 480, h: 540, hqX: 1680, hqY: 820, weekCounts: {}, owner: null, count: 0, owned: false },
];

export function findDistrictAt(arr: District[], x: number, y: number): District | undefined {
  return arr.find((d) => x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h);
}

// Palette compagnies rivales (sync avec CityCompetitors)
const COMPANY_COLORS: Record<string, string> = {
  player: "#fde047",
  yellow: "#facc15", blue: "#3b82f6", neon: "#22d3ee", shadow: "#a855f7",
  red: "#ef4444", green: "#10b981", orange: "#f97316", pink: "#ec4899",
  aqua: "#0ea5e9", lime: "#84cc16",
};
// Couleur live : on lit __jceCompetitors d'abord (admin peut éditer la couleur),
// puis on retombe sur la palette statique COMPANY_COLORS.
function colorFor(owner: string | null, live: LiveComp[]): string {
  if (!owner) return "#2a2f3d";
  if (owner !== "player") {
    const hit = live.find((c) => c.id === owner);
    if (hit?.color) return hit.color;
  }
  return COMPANY_COLORS[owner] ?? "#cbb98a";
}
function labelFor(owner: string | null, live: LiveComp[]): string {
  if (!owner) return "Neutre";
  if (owner === "player") return "Toi";
  const hit = live.find((c) => c.id === owner);
  if (hit?.name) return hit.name.split(" ")[0];
  return owner.charAt(0).toUpperCase() + owner.slice(1);
}
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function load(): District[] {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return DEFAULT_DISTRICTS.map((d) => ({ ...d, weekCounts: {} }));
    const arr = JSON.parse(raw) as District[];
    return DEFAULT_DISTRICTS.map((d) => {
      const prev = arr.find((x) => x.id === d.id);
      if (!prev) return { ...d, weekCounts: {} };
      const owner = prev.owner ?? (prev.owned ? "player" : null);
      return {
        ...d,
        weekCounts: prev.weekCounts ?? {},
        owner,
        count: owner === "player" ? 1 : 0,
        owned: owner === "player",
      };
    });
  } catch { return DEFAULT_DISTRICTS.map((d) => ({ ...d, weekCounts: {} })); }
}
function save(arr: District[]) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(arr)); } catch {}
}

function syncLegacy(d: District): District {
  return { ...d, owned: d.owner === "player", count: d.owner === "player" ? 1 : 0 };
}

export default function TerritoryWar() {
  const [districts, setDistricts] = useState<District[]>(() => load().map(syncLegacy));
  const [toast, setToast] = useState<string | null>(null);
  const [flashIds, setFlashIds] = useState<Record<string, number>>({});
  const [resetDialog, setResetDialog] = useState<{ lost: string[]; gained: string[] } | null>(null);
  const ownedCountRef = useRef(0);
  const prevOwnerRef = useRef<Record<string, string | null> | null>(null);

  // --- Persistance + détection de changement d'owner -> event + flash
  useEffect(() => {
    save(districts);
    ownedCountRef.current = districts.filter((d) => d.owner === "player").length;
    (window as unknown as { __mtwTerritory?: District[] }).__mtwTerritory = districts;

    if (prevOwnerRef.current === null) {
      prevOwnerRef.current = Object.fromEntries(districts.map((d) => [d.id, d.owner]));
    } else {
      const prev = prevOwnerRef.current;
      for (const d of districts) {
        const was = prev[d.id] ?? null;
        if (was !== d.owner) {
          window.dispatchEvent(new CustomEvent("mtw:district-owner-changed", {
            detail: { districtId: d.id, previousOwner: was, newOwner: d.owner },
          }));
          setFlashIds((m) => ({ ...m, [d.id]: Date.now() }));
          window.setTimeout(() => {
            setFlashIds((m) => { if (!(d.id in m)) return m; const n = { ...m }; delete n[d.id]; return n; });
          }, 1200);
        }
        prev[d.id] = d.owner;
      }
    }
  }, [districts]);

  // --- Crédite +1 dans le score hebdo selon la course terminée
  useEffect(() => {
    const credit = (owner: string) => (e: Event) => {
      const d = (e as CustomEvent<{ x: number; y: number }>).detail;
      if (!d) return;
      setDistricts((arr) => {
        const target = findDistrictAt(arr, d.x, d.y);
        if (!target) return arr;
        return arr.map((x) => x.id === target.id
          ? { ...x, weekCounts: { ...x.weekCounts, [owner]: (x.weekCounts[owner] ?? 0) + 1 } }
          : x);
      });
    };
    const onPlayer = credit("player");
    const onRival = (e: Event) => {
      const d = (e as CustomEvent<{ x: number; y: number; compId: string }>).detail;
      if (!d?.compId) return;
      credit(d.compId)(e);
    };
    window.addEventListener("mtw:course-completed", onPlayer as EventListener);
    window.addEventListener("mtw:rival-course-completed", onRival as EventListener);
    return () => {
      window.removeEventListener("mtw:course-completed", onPlayer as EventListener);
      window.removeEventListener("mtw:rival-course-completed", onRival as EventListener);
    };
  }, []);

  // --- Résolution hebdo : à chaque montage + chaque minute on vérifie la semaine ISO
  useEffect(() => {
    const resolve = () => {
      const current = isoWeekKey();
      const last = localStorage.getItem(WEEK_KEY);
      if (!last) { localStorage.setItem(WEEK_KEY, current); return; }
      if (last === current) return;
      // Nouvelle semaine : attribue chaque quartier au top
      setDistricts((arr) => {
        const lost: string[] = [];
        const gained: string[] = [];
        const next = arr.map((d) => {
          const entries = Object.entries(d.weekCounts);
          if (entries.length === 0) {
            return { ...d, weekCounts: {} };
          }
          entries.sort((a, b) => b[1] - a[1]);
          const [topOwner, topScore] = entries[0];
          if (topScore <= 0) return { ...d, weekCounts: {} };
          const previousOwner = d.owner;
          if (previousOwner === "player" && topOwner !== "player") lost.push(d.name);
          if (previousOwner !== "player" && topOwner === "player") gained.push(d.name);
          return syncLegacy({ ...d, owner: topOwner, weekCounts: {} });
        });
        if (lost.length > 0 || gained.length > 0) {
          window.setTimeout(() => setResetDialog({ lost, gained }), 600);
        }
        return next;
      });
      localStorage.setItem(WEEK_KEY, current);
    };
    resolve();
    const t = window.setInterval(resolve, 60_000);
    return () => window.clearInterval(t);
  }, []);

  // --- Bonus passif (quartiers du joueur uniquement)
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

  const onReset = () => {
    try {
      // Reset partie : territoires + scores + personnel + cash (event)
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(WEEK_KEY);
      localStorage.removeItem("tt-daily-scores");
      localStorage.removeItem("mtw-personnel");
    } catch {}
    window.location.reload();
  };

  return (
    <>
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 5 }}
      >
        {districts.map((d) => {
          const cx = d.x + d.w / 2;
          const ownerColor = colorFor(d.owner);
          const total = Object.values(d.weekCounts).reduce((a, b) => a + b, 0);
          const playerScore = d.weekCounts.player ?? 0;
          const leadOwner = Object.entries(d.weekCounts).sort((a, b) => b[1] - a[1])[0];
          return (
            <g key={d.id}>
              {/* Zone du quartier (couleur owner) */}
              <rect
                x={d.x + 2} y={d.y + 2}
                width={d.w - 4} height={d.h - 4}
                fill={d.owner ? `${ownerColor}22` : `${d.color}10`}
                stroke={d.owner ? ownerColor : `${d.color}55`}
                strokeWidth={d.owner ? 3 : 1.5}
                rx="14"
              />

              {/* Badge nom + leader courses */}
              <g transform={`translate(${cx},${d.y + 26})`}>
                <rect x="-92" y="-14" width="184" height="28" rx="14"
                  fill="rgba(12,14,22,0.86)" stroke={d.owner ? ownerColor : d.color} strokeWidth="1.5" />
                <text x="0" y="-1" textAnchor="middle" fontSize="10" fontWeight="900"
                  fill={d.owner ? ownerColor : "#fff7d6"}
                  fontFamily="system-ui, sans-serif" letterSpacing="1">
                  {d.owner === "player" ? `★ ${d.name.toUpperCase()} ★` : d.name.toUpperCase()}
                </text>
                <text x="0" y="10" textAnchor="middle" fontSize="8" fontWeight="700"
                  fill={d.owner ? "#fff7d6" : "#cbb98a"} fontFamily="system-ui, sans-serif">
                  {d.owner === "player"
                    ? `+${BONUS_PER_DISTRICT}$/min`
                    : d.owner
                      ? `Tenu par ${labelFor(d.owner)} · ${playerScore}/${total || 1} hebdo`
                      : leadOwner
                        ? `Leader ${labelFor(leadOwner[0])} (${leadOwner[1]})`
                        : "Aucun leader"}
                </text>
              </g>

              {/* QG du quartier */}
              <g transform={`translate(${d.hqX},${d.hqY})`}>
                {flashIds[d.id] && (
                  <circle r="14" fill="none" stroke={ownerColor} strokeWidth="3">
                    <animate attributeName="r" from="14" to="44" dur="1.1s" fill="freeze" />
                    <animate attributeName="opacity" from="1" to="0" dur="1.1s" fill="freeze" />
                  </circle>
                )}
                <circle r="14" fill="rgba(12,14,22,0.85)"
                  stroke={d.owner ? ownerColor : d.color} strokeWidth="2" />
                <text x="0" y="4" textAnchor="middle" fontSize="14" fontWeight="900"
                  fill={d.owner ? ownerColor : "#fff7d6"} fontFamily="system-ui, sans-serif">⌂</text>
              </g>
            </g>
          );
        })}
      </svg>

      {toast && (
        <div style={{
          position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)",
          zIndex: 10000, background: "linear-gradient(180deg,#7c5e10,#3b2a04)",
          color: "#fff7d6", padding: "10px 18px", borderRadius: 14,
          border: "2px solid #fde047", fontWeight: 900, fontSize: 14,
          fontFamily: "system-ui, sans-serif", boxShadow: "0 8px 24px rgba(0,0,0,0.65)",
        }}>{toast}</div>
      )}

      {resetDialog && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10001,
          background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{
            width: "min(420px,96vw)",
            background: "linear-gradient(180deg,#1a1306,#0c0a04)",
            border: "2px solid #fde047", borderRadius: 16, padding: 18,
            fontFamily: "system-ui, sans-serif", color: "#fff7d6",
            boxShadow: "0 18px 60px rgba(0,0,0,0.8)",
          }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#fde047", marginBottom: 10, letterSpacing: 1 }}>
              🏁 BILAN HEBDOMADAIRE
            </div>
            {resetDialog.gained.length > 0 && (
              <div style={{ marginBottom: 10, fontSize: 13 }}>
                <b style={{ color: "#84cc16" }}>+ Conquis :</b> {resetDialog.gained.join(", ")}
              </div>
            )}
            {resetDialog.lost.length > 0 && (
              <div style={{ marginBottom: 12, fontSize: 13 }}>
                <b style={{ color: "#ef4444" }}>− Perdus :</b> {resetDialog.lost.join(", ")}
                <div style={{ marginTop: 8, fontSize: 11, opacity: 0.85 }}>
                  Une compagnie rivale a fait plus de courses que toi dans ces quartiers cette semaine.
                  Tu peux recommencer la partie à zéro, ou continuer et tenter de les reconquérir.
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button type="button" onClick={() => setResetDialog(null)}
                style={{
                  flex: 1, padding: "10px 12px", borderRadius: 10,
                  background: "linear-gradient(180deg,#fde047,#a07c10)", color: "#1a1306",
                  border: "2px solid #fff7a0", fontWeight: 900, cursor: "pointer", fontSize: 13,
                }}>Continuer la conquête</button>
              {resetDialog.lost.length > 0 && (
                <button type="button" onClick={onReset}
                  style={{
                    padding: "10px 12px", borderRadius: 10,
                    background: "rgba(239,68,68,0.18)", color: "#fecaca",
                    border: "2px solid #ef4444", fontWeight: 900, cursor: "pointer", fontSize: 13,
                  }}>Recommencer</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
