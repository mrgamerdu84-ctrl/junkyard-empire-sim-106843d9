// =============================================================
// Taxis rivaux — V2
// Comportement réel :
//   - ROAM : choisit une route au hasard et la parcourt bout à bout,
//            puis enchaîne sur une autre. Visite donc toutes les rues.
//   - TO_MISSION : quand une mission/incident est publié, le rival
//                  libre le plus proche s'y rend en ligne droite.
//   - ON_MISSION : courte pause "course raflée" au pickup.
//   - RETURN_HQ  : retourne au QG de son opérateur, se gare 2-4s,
//                  puis repart en ROAM.
// + Watchdog anti-stuck (si pas de mouvement >2s hors parking → reroute)
// + Plus de fade out lié à la densité jour/nuit : les rivaux restent
//   toujours visibles tant que leur opérateur n'est pas en faillite.
// =============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { ROADS, VILLAGE_PATHS } from "./CityTraffic";
import { DEFAULT_DISTRICTS, findDistrictAt, type District } from "./TerritoryWar";

const RIVAL_ROAD_IDX = ROADS.map((_, i) => i).filter((i) => !VILLAGE_PATHS.has(i));
const LANE_HALF = 9;
const MAX_RIVALS = 10;
const SECTOR_BIAS = 0.82; // 82% des fois le rival choisit une route de son quartier

type Competitor = {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  bankrupt: boolean;
  vehicleUrl?: string;
};

type RivalSpec = {
  compId: string;
  color: string;
  letter: string;
  vehicleUrl?: string;
  startPathIdx: number;
  homeDistrictId: string;
};

type Mode = "roam" | "to_mission" | "on_mission" | "to_dropoff" | "return_hq";

type RivalState = {
  mode: Mode;
  pathIdx: number;
  flip: boolean;
  duration: number;
  startedAt: number;
  x: number; y: number; ang: number;
  tgtX: number; tgtY: number; tgtSpeed: number;
  missionId?: number;
  dropX?: number; dropY?: number;
  parkUntil?: number;
  lastMoveAt: number;
  lastX: number; lastY: number;
};

type IncomingMission = { id: number; x: number; y: number };

function buildSpecs(comps: Competitor[]): RivalSpec[] {
  const alive = comps.filter((c) => !c.bankrupt);
  if (alive.length === 0) return [];
  const out: RivalSpec[] = [];
  const perComp = Math.max(1, Math.min(2, Math.floor(MAX_RIVALS / Math.max(1, alive.length))));
  let i = 0;
  for (const c of alive) {
    const home = findDistrictAt(DEFAULT_DISTRICTS, c.x, c.y);
    for (let k = 0; k < perComp && out.length < MAX_RIVALS; k++) {
      out.push({
        compId: c.id,
        color: c.color,
        letter: (c.name?.[0] ?? "?").toUpperCase(),
        vehicleUrl: c.vehicleUrl,
        startPathIdx: RIVAL_ROAD_IDX[i % RIVAL_ROAD_IDX.length] ?? 0,
        homeDistrictId: home?.id ?? DEFAULT_DISTRICTS[0].id,
      });
      i++;
    }
  }
  return out;
}

function pickPath(): number {
  return RIVAL_ROAD_IDX[Math.floor(Math.random() * RIVAL_ROAD_IDX.length)] ?? 0;
}

function pickSectorPath(homeId: string, roadsByDistrict: Record<string, number[]>): number {
  const list = roadsByDistrict[homeId];
  if (list && list.length > 0 && Math.random() < SECTOR_BIAS) {
    return list[Math.floor(Math.random() * list.length)];
  }
  return pickPath();
}

export default function CityRivalTaxis() {
  const [comps, setComps] = useState<Competitor[]>(() => {
    const w = window as unknown as { __jceCompetitors?: Competitor[] };
    return w.__jceCompetitors ?? [];
  });

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<Competitor[]>).detail;
      if (Array.isArray(detail)) setComps(detail);
    };
    window.addEventListener("jce:competitors-changed", onChange as EventListener);
    return () => window.removeEventListener("jce:competitors-changed", onChange as EventListener);
  }, []);

  // CityCompetitors met à jour la trésorerie toutes les 5s : ne surtout pas
  // reconstruire les taxis pour ces ticks, sinon ils téléportent/disparaissent.
  const fleetSignature = comps.map((c) => `${c.id}:${c.color}:${c.bankrupt}:${c.vehicleUrl ?? ""}`).join("|");
  const specs = useMemo(() => buildSpecs(comps), [fleetSignature]);
  const compsRef = useRef<Competitor[]>(comps);
  useEffect(() => { compsRef.current = comps; }, [comps]);

  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const carRefs = useRef<(SVGGElement | null)[]>([]);
  const stateRef = useRef<RivalState[]>([]);
  const missionsRef = useRef<IncomingMission[]>([]);
  const homeIdsRef = useRef<string[]>([]);
  const pendingHomeRef = useRef<(string | null)[]>([]);
  const roadsByDistrictRef = useRef<Record<string, number[]>>({});

  // Écoute des missions/incidents publiés par CrimeEvents → un rival va "rafler"
  useEffect(() => {
    const onReq = (e: Event) => {
      const d = (e as CustomEvent<{ id: number; x: number; y: number }>).detail;
      if (!d || typeof d.x !== "number" || typeof d.y !== "number") return;
      missionsRef.current.push({ id: d.id, x: d.x, y: d.y });
      // Cap pour éviter l'accumulation
      if (missionsRef.current.length > 8) missionsRef.current.shift();
    };
    const onResolved = (e: Event) => {
      const d = (e as CustomEvent<{ id: number }>).detail;
      if (!d) return;
      missionsRef.current = missionsRef.current.filter((m) => m.id !== d.id);
    };
    window.addEventListener("jce.intervention.request", onReq as EventListener);
    window.addEventListener("jce.intervention.resolved", onResolved as EventListener);
    window.addEventListener("jce.intervention.assigned", onResolved as EventListener);
    return () => {
      window.removeEventListener("jce.intervention.request", onReq as EventListener);
      window.removeEventListener("jce.intervention.resolved", onResolved as EventListener);
      window.removeEventListener("jce.intervention.assigned", onResolved as EventListener);
    };
  }, []);

  // Réassignation de secteur quand un quartier change de propriétaire.
  useEffect(() => {
    const onOwnerChanged = (e: Event) => {
      const d = (e as CustomEvent<{ districtId: string; newOwner: string }>).detail;
      if (!d) return;
      const territory = (window as unknown as { __mtwTerritory?: District[] }).__mtwTerritory ?? DEFAULT_DISTRICTS;
      for (let i = 0; i < homeIdsRef.current.length; i++) {
        if (homeIdsRef.current[i] !== d.districtId) continue;
        const sp = specs[i];
        const comp = compsRef.current.find((c) => c.id === sp.compId);
        const originX = comp?.x ?? 960;
        const originY = comp?.y ?? 540;
        // Cherche le quartier non détenu par le joueur le plus proche du QG de l'opérateur.
        let bestId: string | null = null;
        let bestDist = Infinity;
        for (const dist of territory) {
          if (dist.owned) continue; // quartier player → off-limits
          const cx = dist.x + dist.w / 2;
          const cy = dist.y + dist.h / 2;
          const dd = Math.hypot(cx - originX, cy - originY);
          if (dd < bestDist) { bestDist = dd; bestId = dist.id; }
        }
        const newHome = bestId ?? DEFAULT_DISTRICTS[0].id;
        const st = stateRef.current[i];
        // Si le rival est en pleine mission, on diffère ; sinon on bascule.
        if (st && (st.mode === "to_mission" || st.mode === "on_mission" || st.mode === "to_dropoff")) {
          pendingHomeRef.current[i] = newHome;
        } else {
          homeIdsRef.current[i] = newHome;
          // Reroute immédiat vers le nouveau secteur (mode return_hq pour transition douce).
          if (st && comp) {
            st.mode = "return_hq";
            st.tgtX = comp.x;
            st.tgtY = comp.y;
            st.tgtSpeed = 200;
          }
        }
      }
    };
    window.addEventListener("mtw:district-owner-changed", onOwnerChanged as EventListener);
    return () => window.removeEventListener("mtw:district-owner-changed", onOwnerChanged as EventListener);
  }, [specs]);

  useEffect(() => {
    // Mesure des paths : retry tant que pas prêt (évite le freeze "tout disparaît")
    let raf = 0;
    let lens: number[] = [];

    const ensureLens = () => {
      lens = pathRefs.current.map((p) => (p ? p.getTotalLength() : 0));
      if (!lens.every((l) => l > 1)) return false;
      // Une fois les paths mesurés, on classe chaque route dans son quartier
      // d'origine (selon le point milieu de la route).
      const by: Record<string, number[]> = {};
      for (const idx of RIVAL_ROAD_IDX) {
        const p = pathRefs.current[idx];
        const len = lens[idx];
        if (!p || !len) continue;
        const mid = p.getPointAtLength(len / 2);
        const d = findDistrictAt(DEFAULT_DISTRICTS, mid.x, mid.y);
        if (!d) continue;
        (by[d.id] ||= []).push(idx);
      }
      roadsByDistrictRef.current = by;
      return true;
    };

    // Init states + home districts mutables
    const now0 = performance.now();
    homeIdsRef.current = specs.map((sp) => sp.homeDistrictId);
    pendingHomeRef.current = specs.map(() => null);
    stateRef.current = specs.map((sp, i) => {
      const comp = compsRef.current.find((c) => c.id === sp.compId);
      return {
        mode: "roam",
        pathIdx: sp.startPathIdx,
        flip: (i % 2) === 1,
        duration: 14 + Math.random() * 10,
        startedAt: now0 - Math.random() * 8000,
        x: comp?.x ?? 960,
        y: comp?.y ?? 540,
        ang: 0,
        tgtX: 0, tgtY: 0, tgtSpeed: 0,
        lastMoveAt: now0,
        lastX: 0, lastY: 0,
      };
    });

    const step = (now: number) => {
      if (lens.length === 0 || lens.some((l) => l <= 1)) {
        if (!ensureLens()) {
          raf = requestAnimationFrame(step);
          return;
        }
      }

      for (let i = 0; i < specs.length; i++) {
        const sp = specs[i];
        const node = carRefs.current[i];
        const st = stateRef.current[i];
        if (!node || !st) continue;

        const comp = compsRef.current.find((c) => c.id === sp.compId);
        const bankrupt = !comp || comp.bankrupt;
        if (bankrupt) { node.setAttribute("opacity", "0.25"); continue; }
        node.setAttribute("opacity", "0.95");

        // ===== Mode dispatch =====
        if (st.mode === "roam") {
          // Si une mission est dispo et que ce rival est le plus proche libre → switch.
          if (missionsRef.current.length > 0) {
            // Trouver mission la plus proche
            let best = -1, bestD = Infinity;
            for (let m = 0; m < missionsRef.current.length; m++) {
              const M = missionsRef.current[m];
              const d = Math.hypot(M.x - st.x, M.y - st.y);
              if (d < bestD) { bestD = d; best = m; }
            }
            if (best >= 0) {
              const M = missionsRef.current[best];
              // Vérifier qu'aucun autre rival n'est déjà sur cette mission ET plus proche
              const claimed = stateRef.current.some((o, oi) => oi !== i && o.missionId === M.id);
              if (!claimed) {
                st.mode = "to_mission";
                st.missionId = M.id;
                st.tgtX = M.x;
                st.tgtY = M.y;
                st.tgtSpeed = 220; // px/s
                // dropoff aléatoire 200-400px
                const ang = Math.random() * Math.PI * 2;
                const dist = 220 + Math.random() * 200;
                st.dropX = Math.max(40, Math.min(1880, M.x + Math.cos(ang) * dist));
                st.dropY = Math.max(40, Math.min(1040, M.y + Math.sin(ang) * dist));
                missionsRef.current.splice(best, 1);
              }
            }
          }
        }

        if (st.mode === "roam") {
          const path = pathRefs.current[st.pathIdx];
          const len = lens[st.pathIdx];
          if (!path || !len) continue;
          let u = (now - st.startedAt) / (st.duration * 1000);
          if (u >= 1) {
            // Nouvelle route : enchaîner toutes les rues
            st.pathIdx = pickSectorPath(homeIdsRef.current[i] ?? sp.homeDistrictId, roadsByDistrictRef.current);
            st.flip = Math.random() < 0.5;
            st.duration = 14 + Math.random() * 10;
            st.startedAt = now;
            u = 0;
            // Petite chance de rentrer au QG pour varier
            if (comp && Math.random() < 0.12) {
              st.mode = "return_hq";
              st.tgtX = comp.x;
              st.tgtY = comp.y;
              st.tgtSpeed = 200;
              continue;
            }
          }
          const fwd = Math.max(0, Math.min(len, st.flip ? len * (1 - u) : len * u));
          const p = path.getPointAtLength(fwd);
          const p2 = path.getPointAtLength(Math.min(len, Math.max(0, fwd + (st.flip ? -1 : 1))));
          const tdx = p2.x - p.x, tdy = p2.y - p.y;
          const L = Math.hypot(tdx, tdy) || 1;
          const ang = (Math.atan2(tdy, tdx) * 180) / Math.PI;
          const laneSign = st.flip ? -1 : 1;
          const ox = (-tdy / L) * LANE_HALF * laneSign;
          const oy = (tdx / L) * LANE_HALF * laneSign;
          st.x = p.x + ox;
          st.y = p.y + oy;
          st.ang = ang;
        } else if (st.mode === "to_mission" || st.mode === "to_dropoff" || st.mode === "return_hq") {
          // Déplacement linéaire vers cible (à 60fps env. dt~16ms)
          const dt = 1 / 60;
          const dx = st.tgtX - st.x;
          const dy = st.tgtY - st.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 14) {
            // Arrivé
            if (st.mode === "to_mission") {
              // Mission "raflée"
              window.dispatchEvent(new CustomEvent("jce:mission-taken", {
                detail: { missionId: st.missionId, compId: sp.compId },
              }));
              st.mode = "on_mission";
              st.parkUntil = now + 1500;
            } else if (st.mode === "to_dropoff") {
              // Course rivale terminée → crédite la semaine du quartier de dépose
              window.dispatchEvent(new CustomEvent("mtw:rival-course-completed", {
                detail: { x: st.x, y: st.y, compId: sp.compId },
              }));
              st.mode = "return_hq";
              const c = compsRef.current.find((c) => c.id === sp.compId);
              st.tgtX = c?.x ?? 960;
              st.tgtY = c?.y ?? 540;
              st.tgtSpeed = 200;
            } else if (st.mode === "return_hq") {
              // Retour QG validé. Si une réassignation de secteur était en
              // attente (changement de propriétaire pendant la course), on
              // l'applique maintenant.
              const pend = pendingHomeRef.current[i];
              if (pend !== null) {
                homeIdsRef.current[i] = pend;
                pendingHomeRef.current[i] = null;
              }
              st.mode = "roam";
              st.pathIdx = pickSectorPath(homeIdsRef.current[i] ?? sp.homeDistrictId, roadsByDistrictRef.current);
              st.flip = Math.random() < 0.5;
              st.duration = 14 + Math.random() * 10;
              st.startedAt = now;
              st.missionId = undefined;
            }
          } else {
            const move = st.tgtSpeed * dt;
            const stepX = (dx / dist) * Math.min(move, dist);
            const stepY = (dy / dist) * Math.min(move, dist);
            st.x += stepX;
            st.y += stepY;
            st.ang = (Math.atan2(dy, dx) * 180) / Math.PI;
          }
        } else if (st.mode === "on_mission") {
          if (now >= (st.parkUntil ?? 0)) {
            st.mode = "to_dropoff";
            st.tgtX = st.dropX ?? st.x;
            st.tgtY = st.dropY ?? st.y;
            st.tgtSpeed = 220;
          }
        }

        // Watchdog anti-stuck (hors parking/on_mission)
        if (st.mode !== "on_mission") {
          const moved = Math.hypot(st.x - st.lastX, st.y - st.lastY);
          if (moved > 0.5) { st.lastMoveAt = now; st.lastX = st.x; st.lastY = st.y; }
          else if (now - st.lastMoveAt > 2000) {
            st.mode = "roam";
            st.pathIdx = pickSectorPath(homeIdsRef.current[i] ?? sp.homeDistrictId, roadsByDistrictRef.current);
            st.flip = Math.random() < 0.5;
            st.duration = 14 + Math.random() * 10;
            st.startedAt = now;
            st.lastMoveAt = now;
          }
        }

        node.setAttribute(
          "transform",
          `translate(${st.x.toFixed(2)},${st.y.toFixed(2)}) rotate(${st.ang.toFixed(2)}) scale(${getVehicleScale().toFixed(2)})`,
        );

      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [specs]);


  return (
    <svg
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 4 }}
    >
      <defs>
        {ROADS.map((d, i) => (
          <path
            key={i}
            id={`jce-rival-road-${i}`}
            d={d}
            ref={(el) => { pathRefs.current[i] = el; }}
            fill="none"
            stroke="none"
          />
        ))}
      </defs>
      {specs.map((sp, i) => (
        <g
          key={`${sp.compId}-${i}`}
          ref={(el) => { carRefs.current[i] = el; }}
          opacity="0.95"
        >
          <ellipse cx="0" cy="0" rx="9" ry="3" fill="rgba(0,0,0,0.35)" />
          {sp.vehicleUrl ? (
            <>
              <g transform="rotate(90)">
                <image href={sp.vehicleUrl} x="-14" y="-17" width="28" height="34" preserveAspectRatio="xMidYMid meet" />
              </g>
              <circle cx="10" cy="-7" r="2.8" fill={sp.color} stroke="#0b0d10" strokeWidth="0.8" />
            </>
          ) : (
            <g transform="rotate(90)">
              <rect x="-8" y="-14" width="16" height="28" rx="4" fill={sp.color} stroke="#0b0d10" strokeWidth="1.5" />
              <rect x="-7" y="-4" width="14" height="5" fill="#fff" />
              <rect x="-7" y="-4" width="2.5" height="2.5" fill="#0b0d10" />
              <rect x="-2" y="-4" width="2.5" height="2.5" fill="#0b0d10" />
              <rect x="3" y="-4" width="2.5" height="2.5" fill="#0b0d10" />
              <rect x="-4.5" y="-1.5" width="2.5" height="2.5" fill="#0b0d10" />
              <rect x="0.5" y="-1.5" width="2.5" height="2.5" fill="#0b0d10" />
              <rect x="-6" y="-12" width="12" height="5" rx="1.2" fill="rgba(15,23,42,0.7)" />
              <rect x="-6" y="7" width="12" height="5" rx="1.2" fill="rgba(15,23,42,0.7)" />
              <circle cx="-5.5" cy="-13" r="1.2" fill="#fde047" />
              <circle cx="5.5" cy="-13" r="1.2" fill="#fde047" />
              <circle cx="0" cy="3" r="3" fill={sp.color} stroke="#0b0d10" strokeWidth="0.8" />
              <text x="0" y="5.2" textAnchor="middle" fontSize="5" fontWeight="900"
                fill="#0b0d10" fontFamily="system-ui, sans-serif">
                {sp.letter}
              </text>
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}
