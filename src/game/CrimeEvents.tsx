// =============================================================
// Lot 4 — Événements scriptés : criminalité, accidents, contrôles.
// Lot 6 — Les marqueurs sont CLIQUABLES : selon le type d'incident,
// un véhicule d'intervention adapté (police / ambulance / pompiers)
// est dépêché sur place. Voir InterventionDispatcher.tsx.
// =============================================================
import { useEffect, useState } from "react";
import { getGameTime } from "./cityClock";
import { getAdmin } from "./adminConfig";
import type { CustomVehicleCategory } from "./gameAssets";
import { isUltraLite, reduceMotion } from "@/lib/perf";

type CrimeKind = "robbery" | "accident" | "control" | "fight" | "fire";

type CrimeEvent = {
  id: number;
  kind: CrimeKind;
  x: number;          // viewBox 1920x1080
  y: number;
  startedAt: number;  // performance.now
  ttl: number;        // ms restant avant disparition
  label: string;
  dispatched?: boolean;
  aiClaimAt: number;  // performance.now ms — au-delà, l'AI prend la mission
  stolenByAI?: boolean;
};

// Lit le niveau de QG du joueur depuis la sauvegarde locale.
// Plus le niveau monte, plus l'AI réagit vite aux missions.
function readDepotTier(): number {
  try {
    const raw = window.localStorage.getItem("taxi-tycoon-v4");
    if (!raw) return 0;
    const s = JSON.parse(raw);
    return typeof s?.depotTier === "number" ? s.depotTier : 0;
  } catch { return 0; }
}

const KIND_META: Record<CrimeKind, { icon: string; color: string; label: string; category: CustomVehicleCategory }> = {
  robbery:  { icon: "🚨", color: "#ef4444", label: "Braquage",       category: "police" },
  accident: { icon: "🚑", color: "#f97316", label: "Accident",       category: "ambulance" },
  control:  { icon: "🚔", color: "#3b82f6", label: "Contrôle",       category: "police" },
  fight:    { icon: "🥊", color: "#a855f7", label: "Rixe",           category: "police" },
  fire:     { icon: "🔥", color: "#dc2626", label: "Incendie",       category: "firetruck" },
};

// Zones plausibles pour faire apparaître des incidents (évite l'eau / vide).
const HOTSPOTS: { x: number; y: number; isolated?: boolean }[] = [
  { x: 420,  y: 340 },
  { x: 780,  y: 520, isolated: true },
  { x: 1140, y: 280 },
  { x: 1520, y: 620 },
  { x: 940,  y: 760, isolated: true },
  { x: 620,  y: 880 },
  { x: 1350, y: 880 },
  { x: 320,  y: 700, isolated: true },
];

let nextId = 1;

// Mémoire jour-en-cours pour cap braquage : 5% max d'apparition par jour de jeu.
let lastDayKey = "";
let robberyRolledToday = false;
let robberyAllowedToday = false;

function rollRobberyForDay(now: number) {
  const dayIdx = Math.floor(now / 300_000);
  const key = `d${dayIdx}`;
  if (key !== lastDayKey) {
    lastDayKey = key;
    robberyRolledToday = true;
    robberyAllowedToday = Math.random() < 0.05; // 5% par jour
  }
  return robberyAllowedToday;
}

function pickKind(isNight: boolean, robberyOk: boolean): CrimeKind {
  const r = Math.random();
  if (isNight) {
    if (robberyOk && r < 0.20) return "robbery";
    if (r < 0.40) return "fight";
    if (r < 0.62) return "control";
    if (r < 0.85) return "accident";
    return "fire";
  }
  if (r < 0.40) return "accident";
  if (r < 0.65) return "control";
  if (r < 0.85) return "fight";
  if (robberyOk && r < 0.93) return "robbery";
  return "fire";
}
void robberyRolledToday;

export default function CrimeEvents() {
  const ultraLite = isUltraLite();
  const reducedFx = reduceMotion();
  const [events, setEvents] = useState<CrimeEvent[]>([]);

  // Génération
  useEffect(() => {
    // Generation polled every second — pas besoin de rAF.
    const id = window.setInterval(() => {
      const now = performance.now();
      const t = getGameTime(now);
      const isNight = t.period === "night";
      let p = 0.05;
      if (t.period === "night") p = 0.35;
      else if (t.period === "evening") p = 0.18;
      else if (t.period === "rushAM" || t.period === "rushPM") p = 0.12;
      else if (t.period === "lunch") p = 0.08;
      if (t.isWeekend) p *= 0.7;
      if (t.isHoliday) p *= 0.5;

      if (ultraLite) p *= 0.35;

      if (Math.random() < p) {
        const isolatedPool = HOTSPOTS.filter(h => h.isolated);
        const pool = isNight && Math.random() < 0.6 && isolatedPool.length > 0
          ? isolatedPool
          : HOTSPOTS;
        const spot = pool[Math.floor(Math.random() * pool.length)];
        const robberyOk = rollRobberyForDay(now);
        const kind = pickKind(isNight, robberyOk);
        const ttl = kind === "control" ? 9000 : kind === "accident" ? 14000 : kind === "fire" ? 16000 : 11000;
        const meta = KIND_META[kind];
        const tier = readDepotTier();
        const diff = getAdmin().aiDifficulty;
        const diffMult = diff === "easy" ? 1.8 : diff === "hard" ? 0.65 : 1;
        const aiDelay = Math.max(2200, (7500 - tier * 950) * diffMult);
        const ev: CrimeEvent = {
          id: nextId++,
          kind,
          x: spot.x + (Math.random() - 0.5) * 60,
          y: spot.y + (Math.random() - 0.5) * 60,
          startedAt: now,
          ttl,
          label: `${meta.label} · ${t.label.split(" ")[1]}`,
          aiClaimAt: now + aiDelay,
        };
        setEvents(es => [...es, ev].slice(ultraLite ? -2 : -5));
      }
    }, ultraLite ? 5000 : 2000);
    return () => window.clearInterval(id);
  }, []);


  // Expiration + résolution + AI qui rafle les missions trop lentes
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = performance.now();
      setEvents(es => {
        // (Plus de concurrence IA : gameplay 100% Mafia. Les missions ne sont
        // plus volées par une "AI rivale" — elles expirent simplement si on
        // ne les attrape pas à temps.)
        const next: CrimeEvent[] = [];
        for (const e of es) {
          if (now - e.startedAt >= e.ttl) continue; // expiré
          next.push(e);
        }
        return next;
      });
    }, ultraLite ? 1000 : 300);
    const onResolved = (ev: Event) => {
      const detail = (ev as CustomEvent<{ id: number }>).detail;
      if (!detail) return;
      setEvents(es => {
        const found = es.find(e => e.id === detail.id);
        if (found && found.dispatched && !found.stolenByAI) {
          window.dispatchEvent(new CustomEvent("jce.player.cashDelta", {
            detail: { amount: 500, reason: "player-resolved", label: KIND_META[found.kind].label },
          }));
        }
        return es.filter(e => e.id !== detail.id);
      });
    };
    window.addEventListener("jce.intervention.resolved", onResolved as EventListener);

    const onManual = (ev: Event) => {
      const detail = (ev as CustomEvent<{ kind?: CrimeKind }>).detail ?? {};
      const kind: CrimeKind = detail.kind ?? "robbery";
      const meta = KIND_META[kind];
      const spot = HOTSPOTS[Math.floor(Math.random() * HOTSPOTS.length)];
      const ttl = kind === "control" ? 9000 : kind === "accident" ? 14000 : kind === "fire" ? 16000 : 11000;
      const tier = readDepotTier();
      const diff = getAdmin().aiDifficulty;
      const diffMult = diff === "easy" ? 1.8 : diff === "hard" ? 0.65 : 1;
      const aiDelay = Math.max(2200, (7500 - tier * 950) * diffMult);
      const now = performance.now();
      const ev2: CrimeEvent = {
        id: nextId++,
        kind,
        x: spot.x + (Math.random() - 0.5) * 60,
        y: spot.y + (Math.random() - 0.5) * 60,
        startedAt: now,
        ttl,
        label: `${meta.label} · admin`,
        aiClaimAt: now + aiDelay,
      };
      setEvents(es => [...es, ev2].slice(ultraLite ? -2 : -5));
    };
    window.addEventListener("jce:crime-spawn-now", onManual as EventListener);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("jce.intervention.resolved", onResolved as EventListener);
      window.removeEventListener("jce:crime-spawn-now", onManual as EventListener);
    };
  }, []);

  const handleClick = (e: CrimeEvent) => {
    if (e.dispatched || e.stolenByAI) return;
    const meta = KIND_META[e.kind];
    setEvents(es => es.map(x => x.id === e.id ? { ...x, dispatched: true, ttl: Math.max(x.ttl, 20000) } : x));
    window.dispatchEvent(new CustomEvent("jce.intervention.request", {
      detail: { id: e.id, kind: e.kind, x: e.x, y: e.y, category: meta.category, label: meta.label },
    }));
  };

  const recent = events.slice(-4).reverse();

  return (
    <>
      {/* Marqueurs sur la carte — CLIQUABLES */}
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          zIndex: 6, pointerEvents: "none",
        }}
        aria-hidden
      >
        {events.map(e => {
          const meta = KIND_META[e.kind];
          const age = (performance.now() - e.startedAt) / e.ttl;
          const pulse = reducedFx ? 1 : 1 + Math.sin(performance.now() / 180 + e.id) * 0.15;
          // Compte à rebours avant que l'AI rafle la mission
          const aiRemain = Math.max(0, e.aiClaimAt - performance.now());
          const aiPct = e.dispatched || e.stolenByAI ? 0 : Math.max(0, Math.min(1, aiRemain / (e.aiClaimAt - e.startedAt)));
          const urgent = !e.dispatched && !e.stolenByAI && aiRemain < 1800;
          return (
            <g
              key={e.id}
              transform={`translate(${e.x} ${e.y})`}
              opacity={Math.max(0.2, 1 - age * 0.6)}
              onClick={() => handleClick(e)}
              style={{ pointerEvents: e.stolenByAI ? "none" : "auto", cursor: e.dispatched ? "wait" : e.stolenByAI ? "default" : "pointer" }}
              role="button"
              aria-label={`Envoyer ${meta.category} sur ${meta.label}`}
            >
              {/* zone cliquable élargie */}
              <circle r={34} fill="transparent" />
              <circle r={26 * pulse} fill={meta.color} opacity={urgent ? 0.32 : 0.18} />
              <circle r={16} fill={e.stolenByAI ? "#6b7280" : meta.color} opacity={0.85} stroke="#0a0c12" strokeWidth={2} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={18} pointerEvents="none">{e.stolenByAI ? "❌" : meta.icon}</text>
              {/* Arc de compte à rebours AI */}
              {!e.dispatched && !e.stolenByAI && aiPct > 0 && (
                <circle r={20} fill="none" stroke={urgent ? "#ef4444" : "#fbbf24"} strokeWidth={2.5}
                  strokeDasharray={`${aiPct * 125.6} 125.6`} transform="rotate(-90)" opacity={0.9} />
              )}
              {e.dispatched && !reducedFx && (
                <circle r={22} fill="none" stroke="#22e36a" strokeWidth={2.5} strokeDasharray="6 4">
                  <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
            </g>
          );
        })}
      </svg>

      {/* Log d'événements */}
      <div
        style={{
          position: "absolute",
          top: 54,
          right: 10,
          zIndex: 30,
          width: 168,
          display: "flex", flexDirection: "column", gap: 4,
          pointerEvents: "none",
        }}
        aria-label="Journal des incidents"
      >
        {recent.map(e => {
          const meta = KIND_META[e.kind];
          return (
            <div key={e.id} style={{
              padding: "5px 8px",
              borderRadius: 8,
              background: "rgba(12,14,22,0.82)",
              border: `1px solid ${meta.color}66`,
              color: "#e8edf5",
              font: "600 10.5px/1.25 ui-sans-serif, system-ui",
              display: "flex", alignItems: "center", gap: 6,
              backdropFilter: reducedFx ? undefined : "blur(6px)",
            }}>
              <span style={{ fontSize: 13 }}>{meta.icon}</span>
              <span style={{ flex: 1 }}>{e.label}{e.dispatched ? " · en route" : ""}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
