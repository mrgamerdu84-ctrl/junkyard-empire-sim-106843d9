// =============================================================
// Étape 4 — Réponses aux braquages / cambriolages / incidents
// Chaque incident (clic joueur OU AI qui rafle la mission) déclenche
// l'envoi d'un véhicule depuis le QG concerné (commissariat / caserne
// / hôpital) vers le lieu de l'incident, puis retour au QG après une
// pause sirène. Une zone de blocage (cônes + ruban) est dressée
// pendant l'intervention.
//
// Les sprites utilisés sont CEUX du jeu (GAME_ASSETS) — aucun modèle
// existant n'est modifié ni remplacé. Le composant reste en surimpression
// SVG et ne modifie pas le trafic civil.
// =============================================================
import { useEffect, useRef, useState } from "react";
import type { CustomVehicleCategory } from "./gameAssets";
import { GAME_ASSETS } from "./gameAssets";

type Category = "police" | "firetruck" | "ambulance";

type HQ = { category: Category; x: number; y: number; sprite: string };

const HQS: HQ[] = [
  { category: "police",    x: 250,  y: 950, sprite: GAME_ASSETS["police.car"] },
  { category: "firetruck", x: 1500, y: 180, sprite: GAME_ASSETS["emergency.firetruck"] },
  { category: "ambulance", x: 1670, y: 950, sprite: GAME_ASSETS["emergency.ambulance"] },
];

type Response = {
  id: number;
  category: Category;
  sprite: string;
  hqX: number; hqY: number;
  targetX: number; targetY: number;
  startedAt: number;
  goMs: number;    // QG -> incident
  stayMs: number;  // sur place sirènes
  backMs: number;  // incident -> QG
  label: string;
};

let respIdSeq = 1;

export default function CrimeResponses() {
  const [responses, setResponses] = useState<Response[]>([]);
  const groupRefs = useRef<Map<number, SVGGElement | null>>(new Map());

  // === Écoute les demandes d'intervention (player ou AI) ===
  useEffect(() => {
    const trigger = (detail: { id?: number; x?: number; y?: number; category?: CustomVehicleCategory; label?: string }) => {
      const cat = detail.category;
      if (cat !== "police" && cat !== "firetruck" && cat !== "ambulance") return;
      if (typeof detail.x !== "number" || typeof detail.y !== "number") return;
      const hq = HQS.find(h => h.category === cat);
      if (!hq) return;
      const dist = Math.hypot(detail.x - hq.x, detail.y - hq.y);
      // 380 px/s en mode urgence sirène
      const goMs = Math.max(1500, Math.min(5500, (dist / 380) * 1000));
      const r: Response = {
        id: respIdSeq++,
        category: cat,
        sprite: hq.sprite,
        hqX: hq.x, hqY: hq.y,
        targetX: detail.x, targetY: detail.y,
        startedAt: performance.now(),
        goMs,
        stayMs: cat === "firetruck" ? 6500 : cat === "ambulance" ? 5500 : 4500,
        backMs: goMs,
        label: detail.label ?? "Intervention",
      };
      setResponses(prev => [...prev, r]);
      // Notifie le HUD (toast vert + gyrophare au QG)
      window.dispatchEvent(new CustomEvent("jce.intervention.assigned", {
        detail: { id: detail.id ?? r.id, category: cat, label: r.label },
      }));
      // Nettoyage après le retour au QG
      window.setTimeout(() => {
        setResponses(prev => prev.filter(rr => rr.id !== r.id));
      }, r.goMs + r.stayMs + r.backMs + 400);
    };

    const onReq = (ev: Event) => {
      const d = (ev as CustomEvent<{ id?: number; x?: number; y?: number; category?: CustomVehicleCategory; label?: string }>).detail;
      if (d) trigger(d);
    };
    const onStolen = (ev: Event) => {
      // Quand l'AI rafle la mission, on envoie quand même les secours visuels.
      const d = (ev as CustomEvent<{ id?: number; category?: CustomVehicleCategory; label?: string }>).detail;
      if (!d || !d.category) return;
      // Position inconnue depuis cet event — on prend le centre approximatif.
      trigger({ id: d.id, category: d.category, label: d.label, x: 960, y: 540 });
    };
    window.addEventListener("jce.intervention.request", onReq as EventListener);
    window.addEventListener("jce.intervention.ai-stole", onStolen as EventListener);
    return () => {
      window.removeEventListener("jce.intervention.request", onReq as EventListener);
      window.removeEventListener("jce.intervention.ai-stole", onStolen as EventListener);
    };
  }, []);

  // === Animation : interpole HQ -> incident -> HQ ===
  useEffect(() => {
    if (responses.length === 0) return;
    let raf = 0;
    const step = () => {
      const now = performance.now();
      for (const r of responses) {
        const g = groupRefs.current.get(r.id);
        if (!g) continue;
        const elapsed = now - r.startedAt;
        let x = r.hqX, y = r.hqY, heading = 0;
        if (elapsed < r.goMs) {
          const t = elapsed / r.goMs;
          x = r.hqX + (r.targetX - r.hqX) * t;
          y = r.hqY + (r.targetY - r.hqY) * t;
          heading = Math.atan2(r.targetY - r.hqY, r.targetX - r.hqX);
        } else if (elapsed < r.goMs + r.stayMs) {
          x = r.targetX; y = r.targetY;
          heading = Math.atan2(r.hqY - r.targetY, r.hqX - r.targetX); // tourné vers retour
        } else {
          const t = Math.min(1, (elapsed - r.goMs - r.stayMs) / r.backMs);
          x = r.targetX + (r.hqX - r.targetX) * t;
          y = r.targetY + (r.hqY - r.targetY) * t;
          heading = Math.atan2(r.hqY - r.targetY, r.hqX - r.targetX);
        }
        const deg = (heading * 180) / Math.PI + 90;
        g.setAttribute("transform", `translate(${x} ${y}) rotate(${deg})`);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [responses]);

  // Zones de blocage visibles tant que le véhicule est sur place.
  const blocks = responses
    .map(r => {
      const elapsed = performance.now() - r.startedAt;
      const active = elapsed >= r.goMs && elapsed < r.goMs + r.stayMs;
      return active ? r : null;
    })
    .filter((r): r is Response => r !== null);

  return (
    <>
      <style>{`
        @keyframes jce-resp-gyro-blue {
          0%,100% { fill: #1e40af; }
          50%     { fill: #ef4444; }
        }
        @keyframes jce-resp-gyro-red {
          0%,100% { fill: #b91c1c; }
          50%     { fill: #1e40af; }
        }
        @keyframes jce-resp-tape {
          to { stroke-dashoffset: -24; }
        }
      `}</style>
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          zIndex: 6, pointerEvents: "none",
        }}
        aria-hidden
      >
        {/* Zones de blocage : ruban + 4 cônes */}
        {blocks.map(r => (
          <g key={`b-${r.id}`} transform={`translate(${r.targetX} ${r.targetY})`}>
            <circle r={42} fill="rgba(239,68,68,0.10)" stroke="#ef4444" strokeWidth={1.2} strokeDasharray="6 4" opacity={0.9} />
            {/* Ruban "POLICE" qui défile */}
            <circle
              r={34} fill="none"
              stroke={r.category === "firetruck" ? "#facc15" : "#fbbf24"}
              strokeWidth={3}
              strokeDasharray="10 6"
              style={{ animation: "jce-resp-tape 1.2s linear infinite" }}
              opacity={0.95}
            />
            {/* Cônes orange */}
            {[0, 90, 180, 270].map(a => {
              const rad = (a * Math.PI) / 180;
              const cx = Math.cos(rad) * 30;
              const cy = Math.sin(rad) * 30;
              return (
                <g key={a} transform={`translate(${cx} ${cy})`}>
                  <polygon points="-3.5,3 3.5,3 0,-4" fill="#f97316" stroke="#7c2d12" strokeWidth={0.6} />
                  <rect x={-3.5} y={3} width={7} height={1.4} fill="#1f2937" />
                </g>
              );
            })}
          </g>
        ))}

        {/* Véhicules de réponse */}
        {responses.map(r => (
          <g
            key={r.id}
            ref={el => {
              if (el) groupRefs.current.set(r.id, el);
              else groupRefs.current.delete(r.id);
            }}
          >
            <image
              href={r.sprite}
              x={-22} y={-14}
              width={44} height={28}
              preserveAspectRatio="xMidYMid meet"
            />
            <circle
              cx={0} cy={-2} r={3.4}
              style={{
                animation: `${r.category === "firetruck" ? "jce-resp-gyro-red" : "jce-resp-gyro-blue"} 0.4s linear infinite`,
              }}
            />
          </g>
        ))}
      </svg>
    </>
  );
}
