// =============================================================
// Lot 6 — Dispatcher d'intervention.
// Écoute "jce.intervention.request" émis par CrimeEvents quand le
// joueur clique sur un marqueur. Sélectionne un véhicule custom de
// la catégorie demandée (police / ambulance / firetruck), le fait
// arriver depuis le bord de la carte vers le point d'incident,
// stationner ~3 s, puis repartir. Émet "jce.intervention.resolved"
// à l'arrivée pour que CrimeEvents enlève le marqueur.
// =============================================================
import { useEffect, useRef, useState } from "react";
import { listCustomVehicles, type CustomVehicleCategory } from "./gameAssets";

type InterventionReq = {
  id: number;
  kind: string;
  x: number;
  y: number;
  category: CustomVehicleCategory;
  label: string;
};

type Mission = {
  id: number;
  category: CustomVehicleCategory;
  spriteUrl: string | null;
  fallbackEmoji: string;
  // trajectoire : arrivée → stationnement → départ
  fromX: number; fromY: number;
  toX: number; toY: number;
  awayX: number; awayY: number;
  startedAt: number;
  arriveAt: number;     // ms
  leaveAt: number;      // ms (après stationnement)
  endAt: number;        // ms (sortie complète)
  resolvedFired: boolean;
};

const TRAVEL_MS = 3200;
const STAY_MS   = 2800;
const EXIT_MS   = 2600;

const FALLBACK_EMOJI: Record<CustomVehicleCategory, string> = {
  civil: "🚗", taxi: "🚕", police: "🚓", ambulance: "🚑", firetruck: "🚒", service: "🚛",
};

function pickEdgePoint(target: { x: number; y: number }) {
  // Choisit le bord le plus proche pour minimiser la traversée visuelle.
  const W = 1920, H = 1080;
  const choices = [
    { x: -80, y: target.y },           // gauche
    { x: W + 80, y: target.y },        // droite
    { x: target.x, y: -80 },           // haut
    { x: target.x, y: H + 80 },        // bas
  ];
  // ordre par distance
  choices.sort((a, b) => {
    const da = Math.hypot(a.x - target.x, a.y - target.y);
    const db = Math.hypot(b.x - target.x, b.y - target.y);
    return da - db;
  });
  // Prend un des deux plus proches au hasard pour varier
  return choices[Math.random() < 0.5 ? 0 : 1];
}

export default function InterventionDispatcher() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [toast, setToast] = useState<{ id: number; text: string; tone: "ok" | "warn" } | null>(null);
  const nextMid = useRef(1);

  useEffect(() => {
    const onReq = (ev: Event) => {
      const d = (ev as CustomEvent<InterventionReq>).detail;
      if (!d) return;
      const customs = listCustomVehicles().filter(v => v.category === d.category);
      const spriteUrl = customs.length > 0
        ? customs[Math.floor(Math.random() * customs.length)].url
        : null;
      if (!spriteUrl) {
        setToast({
          id: Date.now(),
          tone: "warn",
          text: `❗ Aucun véhicule "${d.category}" : importe-en un dans le panel admin`,
        });
      } else {
        setToast({
          id: Date.now(),
          tone: "ok",
          text: `${FALLBACK_EMOJI[d.category]} ${d.label} — intervention dépêchée`,
        });
      }
      const from = pickEdgePoint({ x: d.x, y: d.y });
      const away = pickEdgePoint({ x: d.x, y: d.y });
      const now = performance.now();
      const m: Mission = {
        id: nextMid.current++,
        category: d.category,
        spriteUrl,
        fallbackEmoji: FALLBACK_EMOJI[d.category],
        fromX: from.x, fromY: from.y,
        toX: d.x, toY: d.y,
        awayX: away.x, awayY: away.y,
        startedAt: now,
        arriveAt: now + TRAVEL_MS,
        leaveAt: now + TRAVEL_MS + STAY_MS,
        endAt: now + TRAVEL_MS + STAY_MS + EXIT_MS,
        resolvedFired: false,
      };
      // Émet la résolution à l'arrivée du véhicule
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("jce.intervention.resolved", { detail: { id: d.id } }));
      }, TRAVEL_MS);
      setMissions(ms => [...ms, m]);
    };
    window.addEventListener("jce.intervention.request", onReq as EventListener);
    return () => window.removeEventListener("jce.intervention.request", onReq as EventListener);
  }, []);

  // Boucle d'animation : rerender à 30 fps, nettoie les missions terminées
  const [, setTick] = useState(0);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const step = (now: number) => {
      if (now - last > 33) {
        setTick(t => (t + 1) & 0xffff);
        setMissions(ms => ms.filter(m => now < m.endAt + 200));
        last = now;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const now = performance.now();

  return (
    <>
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          zIndex: 7, pointerEvents: "none",
        }}
        aria-hidden
      >
        {missions.map(m => {
          // 3 phases : arrivée → stationnement → départ
          let x = m.toX, y = m.toY, ang = 0, alpha = 1;
          if (now < m.arriveAt) {
            const k = (now - m.startedAt) / TRAVEL_MS;
            x = m.fromX + (m.toX - m.fromX) * k;
            y = m.fromY + (m.toY - m.fromY) * k;
            ang = (Math.atan2(m.toY - m.fromY, m.toX - m.fromX) * 180) / Math.PI;
          } else if (now < m.leaveAt) {
            x = m.toX; y = m.toY;
            ang = (Math.atan2(m.toY - m.fromY, m.toX - m.fromX) * 180) / Math.PI;
          } else if (now < m.endAt) {
            const k = (now - m.leaveAt) / EXIT_MS;
            x = m.toX + (m.awayX - m.toX) * k;
            y = m.toY + (m.awayY - m.toY) * k;
            ang = (Math.atan2(m.awayY - m.toY, m.awayX - m.toX) * 180) / Math.PI;
            alpha = 1 - k * 0.4;
          } else {
            alpha = 0;
          }

          const SPRITE = 64;
          return (
            <g key={m.id} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang.toFixed(1)})`} opacity={alpha}>
              {/* gyrophare clignotant pendant tout le trajet */}
              <circle r={28} fill={m.category === "firetruck" ? "#dc2626" : m.category === "ambulance" ? "#f97316" : "#3b82f6"} opacity={0.28 + 0.2 * Math.sin(now / 90)} />
              {m.spriteUrl ? (
                // L'image est top-down (nez ↑). On compense de +90° comme dans CityTraffic.
                <g transform="rotate(90)">
                  <image
                    href={m.spriteUrl}
                    x={-SPRITE / 2}
                    y={-SPRITE / 2}
                    width={SPRITE}
                    height={SPRITE}
                    preserveAspectRatio="xMidYMid meet"
                  />
                </g>
              ) : (
                <text textAnchor="middle" dominantBaseline="central" fontSize={32} transform={`rotate(${(-ang).toFixed(1)})`}>
                  {m.fallbackEmoji}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {toast && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 40,
            padding: "8px 14px",
            borderRadius: 10,
            background: "rgba(12,14,22,0.92)",
            border: `1px solid ${toast.tone === "ok" ? "#22e36a88" : "#f59e0b88"}`,
            color: "#e8edf5",
            font: "600 12px/1.3 ui-sans-serif, system-ui",
            backdropFilter: "blur(8px)",
            pointerEvents: "none",
            maxWidth: "84vw",
            textAlign: "center",
          }}
          role="status"
        >
          {toast.text}
        </div>
      )}
    </>
  );
}
