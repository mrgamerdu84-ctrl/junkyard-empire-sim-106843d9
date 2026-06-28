// =============================================================
// MAFIA — Les familles mafia (configurées dans le panel admin)
// envoient des voitures saboter les taxis du joueur pendant leurs
// courses. Les mafieux suivent strictement le réseau routier
// (mêmes paths SVG que le trafic civil).
//
// Perf : on évite tout setState par frame. Les positions sont
// mises à jour en direct sur les <g> via refs DOM (transform).
// React ne re-render que quand une voiture apparaît / disparaît
// ou explose.
// =============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { getCivilCarUrls } from "./gameAssets";
import { ROADS, VILLAGE_PATHS } from "./CityTraffic";
import { VEHICLE_SIZE } from "./TaxiTycoon";
import { isMafiaTruceActive } from "./MafiaGodfather";
import { getAdmin } from "./adminConfig";
import { isUltraLite, reduceMotion, targetFps } from "@/lib/perf";

type PlayerTaxi = { id: number; x: number; y: number; onMission: boolean };
type CompetitorLite = {
  id: string;
  name?: string;
  vehicleUrl?: string;
  color?: string;
};

type Mafia = {
  id: number;
  sprite: string;
  tinted: boolean;
  pathIdx: number;
  pathLen: number;
  t: number;
  dir: 1 | -1;
  speed: number;
  x: number;
  y: number;
  angle: number;
  targetTaxiId: number | null;
  state: "hunt" | "exploding";
  explodedAt?: number;
};

const REWARD = 100;
const MAP_W = 1920;
const MAP_H = 1080;
const SPAWN_INTERVAL_MS = 9000;
const MAX_CARS_HI = 3; // FPS >= 55
const MAX_CARS_MID = 2; // FPS >= 40
const MAX_CARS_LO = 1; // FPS < 40
const EXPLOSION_MS = 900;

function getPlayerTaxis(): PlayerTaxi[] {
  const w = window as unknown as { __jcePlayerTaxis?: PlayerTaxi[] };
  return Array.isArray(w.__jcePlayerTaxis) ? w.__jcePlayerTaxis : [];
}

function getMafiaFamilies(): CompetitorLite[] {
  const w = window as unknown as { __jceCompetitors?: CompetitorLite[] };
  return Array.isArray(w.__jceCompetitors) ? w.__jceCompetitors : [];
}

function buildPathEls(): SVGPathElement[] {
  const ns = "http://www.w3.org/2000/svg";
  const out: SVGPathElement[] = [];
  for (let i = 0; i < ROADS.length; i++) {
    if (VILLAGE_PATHS.has(i)) continue;
    try {
      const p = document.createElementNS(ns, "path");
      p.setAttribute("d", ROADS[i]);
      if (p.getTotalLength() > 0) out.push(p);
    } catch { /* ignore */ }
  }
  return out;
}

// Échantillonnage léger : 12 pts/path, suffisant pour trouver une route.
function nearestOnPath(
  paths: SVGPathElement[],
  lens: number[],
  tx: number,
  ty: number,
): { idx: number; t: number } {
  let bestIdx = 0;
  let bestT = 0;
  let bestD = Infinity;
  const STEPS = 12;
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    const len = lens[i];
    for (let s = 0; s <= STEPS; s++) {
      const t = (s / STEPS) * len;
      const pt = p.getPointAtLength(t);
      const dx = pt.x - tx;
      const dy = pt.y - ty;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; bestIdx = i; bestT = t; }
    }
  }
  return { idx: bestIdx, t: bestT };
}

export default function MafiaAttackers() {
  // version sert uniquement à re-render quand la liste change
  // (spawn / despawn / explosion start/end).
  const [version, setVersion] = useState(0);
  const carsRef = useRef<Mafia[]>([]);
  const idRef = useRef(0);
  const lastSpawn = useRef(0);
  const startedAt = useRef(Date.now());
  const fpsRef = useRef(60);
  const maxCarsRef = useRef(isUltraLite() ? MAX_CARS_LO : MAX_CARS_MID);
  const pathEls = useMemo(() => buildPathEls(), []);
  const pathLens = useMemo(() => pathEls.map((p) => p.getTotalLength()), [pathEls]);
  // refs DOM par voiture -> mise à jour directe du transform sans re-render
  const groupRefs = useRef<Map<number, SVGGElement>>(new Map());
  const raidUntilRef = useRef(0);
  // Suivi du raid : objectif = détruire les 10 voitures du Parrain.
  const raidSessionRef = useRef<{ active: boolean; spawned: number; destroyed: number }>({
    active: false, spawned: 0, destroyed: 0,
  });
  const RAID_TARGET = isUltraLite() ? 6 : 10;

  useEffect(() => {
    const onRaid = (ev: Event) => {
      const d = (ev as CustomEvent<{ until: number }>).detail;
      if (d && typeof d.until === "number") raidUntilRef.current = d.until;
      // Démarre une nouvelle session de raid : compteurs RAZ.
      raidSessionRef.current = { active: true, spawned: 0, destroyed: 0 };
    };
    window.addEventListener("jce.mafia.raid", onRaid as EventListener);
    return () => window.removeEventListener("jce.mafia.raid", onRaid as EventListener);
  }, []);

  useEffect(() => {
    if (pathEls.length === 0) return;
    let raf = 0;
    let last = performance.now();
    let structuralChange = false;
    const MIN_FRAME = 1000 / targetFps();
    const ultra = isUltraLite();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dtMs = now - last;
      if (dtMs < MIN_FRAME) return;
      const dt = Math.min(0.05, dtMs / 1000);
      last = now;
      structuralChange = false;


      // Lissage exponentiel du FPS (alpha ~0.05).
      const inst = dtMs > 0 ? 1000 / dtMs : 60;
      fpsRef.current = fpsRef.current * 0.95 + inst * 0.05;
      const fps = fpsRef.current;
      // Hystérésis pour éviter le yo-yo.
      const cur = maxCarsRef.current;
      let next = cur;
      if (ultra) next = MAX_CARS_LO;
      else if (fps < 38 && cur > MAX_CARS_LO) next = MAX_CARS_LO;
      else if (fps >= 42 && fps < 55 && cur !== MAX_CARS_MID) next = MAX_CARS_MID;
      else if (fps >= 58 && cur < MAX_CARS_HI) next = MAX_CARS_HI;
      maxCarsRef.current = next;

      const taxis = getPlayerTaxis();
      const onMission = taxis.filter((t) => t.onMission);
      const minutes = (Date.now() - startedAt.current) / 60000;
      const truceOn = isMafiaTruceActive();
      const raidOn = now < raidUntilRef.current;
      const raidSession = raidSessionRef.current;
      // Pendant un raid : on essaie d'avoir en permanence des voitures
      // jusqu'à atteindre 10 spawn cumulés. Pas de spawn passé ce quota.
      const raidQuotaLeft = raidOn ? Math.max(0, RAID_TARGET - raidSession.spawned) : 0;
      const spawnEvery = raidOn
        ? 900
        : Math.max(3500, SPAWN_INTERVAL_MS - minutes * 500);
      const wantSpawn = raidOn ? raidQuotaLeft > 0 : onMission.length > 0;
      // Plafond simultané : pendant le raid, on peut avoir jusqu'à 5 chasseurs en vol.
      const maxConcurrent = raidOn
        ? (ultra ? 2 : Math.min(4, maxCarsRef.current + 2))
        : maxCarsRef.current;

      if (
        !truceOn &&
        wantSpawn &&
        carsRef.current.filter((c) => c.state === "hunt").length < maxConcurrent &&
        now - lastSpawn.current > spawnEvery
      ) {
        lastSpawn.current = now;
        // Cible : pendant un raid, on prend un taxi quelconque (le QG est
        // assiégé). Sinon, uniquement les taxis en course.
        const pool = raidOn && taxis.length ? taxis : onMission;
        const target = pool[Math.floor(Math.random() * pool.length)];
        // Pendant le raid : on apparaît AU QG mafia (admin.rivalHQX/Y) sur
        // la route la plus proche, et on roule vers le taxi cible.
        const adm = getAdmin();
        const spawnAnchor = raidOn
          ? nearestOnPath(pathEls, pathLens, adm.rivalHQX, adm.rivalHQY)
          : (() => {
              // Hors raid : spawn à mi-chemin entre mafia HQ et taxi cible.
              const near = nearestOnPath(pathEls, pathLens, target.x, target.y);
              const len = pathLens[near.idx];
              const offset = (300 + Math.random() * 300) * (Math.random() < 0.5 ? -1 : 1);
              let st = near.t + offset;
              if (st < 0) st += len;
              if (st > len) st -= len;
              return { idx: near.idx, t: Math.max(0, Math.min(len, st)) };
            })();
        const pathIdx = spawnAnchor.idx;
        const len = pathLens[pathIdx];
        const startT = Math.max(0, Math.min(len, spawnAnchor.t));
        const dir: 1 | -1 = startT < len / 2 ? 1 : -1;

        const families = getMafiaFamilies();
        const withSprite = families.filter(
          (f) => f && typeof f.vehicleUrl === "string" && f.vehicleUrl.length > 0,
        );
        let sprite = "";
        let tinted = true;
        if (withSprite.length > 0) {
          sprite = withSprite[Math.floor(Math.random() * withSprite.length)].vehicleUrl!;
          tinted = false;
        } else {
          // Pas de modèle mafia uploadé → on réutilise les voitures civiles
          // existantes (assets du jeu), teintées en noir.
          const urls = getCivilCarUrls();
          sprite = urls.length ? urls[Math.floor(Math.random() * urls.length)] : "";
          tinted = true;
        }

        try {
          const pt = pathEls[pathIdx].getPointAtLength(startT);
          carsRef.current = [
            ...carsRef.current,
            {
              id: ++idRef.current,
              sprite,
              tinted,
              pathIdx,
              pathLen: len,
              t: startT,
              dir,
              speed: 130 + Math.random() * 60 + minutes * 8,
              x: pt.x,
              y: pt.y,
              angle: 0,
              targetTaxiId: target.id,
              state: "hunt",
            },
          ];
          if (raidOn) raidSession.spawned++;
          structuralChange = true;
        } catch { /* ignore */ }
      }


      // Avance + mutation in-place + transform DOM direct.
      const survivors: Mafia[] = [];
      for (const c of carsRef.current) {
        if (c.state === "exploding") {
          if (now - (c.explodedAt ?? now) < EXPLOSION_MS) {
            survivors.push(c);
          } else {
            groupRefs.current.delete(c.id);
            structuralChange = true;
          }
          continue;
        }
        const p = pathEls[c.pathIdx];
        if (!p) {
          groupRefs.current.delete(c.id);
          structuralChange = true;
          continue;
        }
        const len = c.pathLen;
        let nt = c.t + c.dir * c.speed * dt;

        if (nt < 0 || nt > len) {
          const tgt = taxis.find((t) => t.id === c.targetTaxiId) ?? taxis[0];
          if (!tgt) {
            groupRefs.current.delete(c.id);
            structuralChange = true;
            continue;
          }
          const near = nearestOnPath(pathEls, pathLens, tgt.x, tgt.y);
          const newPath = near.idx;
          const newLen = pathLens[newPath];
          const startT = Math.max(0, Math.min(newLen, near.t));
          const newDir: 1 | -1 = startT < newLen / 2 ? 1 : -1;
          try {
            const pt = pathEls[newPath].getPointAtLength(startT);
            const a0 = pathEls[newPath].getPointAtLength(
              Math.max(0, Math.min(newLen, startT + newDir * 4)),
            );
            const angle = (Math.atan2(a0.y - pt.y, a0.x - pt.x) * 180) / Math.PI;
            c.pathIdx = newPath;
            c.pathLen = newLen;
            c.t = startT;
            c.dir = newDir;
            c.x = pt.x;
            c.y = pt.y;
            c.angle = angle;
            nt = startT;
          } catch {
            groupRefs.current.delete(c.id);
            structuralChange = true;
            continue;
          }
        } else {
          try {
            const pt = p.getPointAtLength(nt);
            const ahead = p.getPointAtLength(
              Math.max(0, Math.min(len, nt + c.dir * 4)),
            );
            const angle = (Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180) / Math.PI;
            c.t = nt;
            c.x = pt.x;
            c.y = pt.y;
            c.angle = angle;
          } catch {
            groupRefs.current.delete(c.id);
            structuralChange = true;
            continue;
          }
        }

        // Mise à jour directe DOM (pas de re-render React).
        const g = groupRefs.current.get(c.id);
        if (g) {
          g.setAttribute("transform", `translate(${c.x.toFixed(2)},${c.y.toFixed(2)}) rotate(${c.angle.toFixed(1)})`);
        }
        survivors.push(c);
      }
      carsRef.current = survivors;
      if (structuralChange) setVersion((v) => (v + 1) & 0xffff);
    };

    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [pathEls, pathLens]);

  const explode = (id: number) => {
    const t = performance.now();
    const c = carsRef.current.find((x) => x.id === id);
    if (!c || c.state !== "hunt") return;
    c.state = "exploding";
    c.explodedAt = t;
    setVersion((v) => (v + 1) & 0xffff);
    window.dispatchEvent(
      new CustomEvent("jce.player.cashDelta", { detail: { amount: REWARD } }),
    );
    // Comptage des kills pendant un raid : le Parrain envoie un message
    // dès que les 10 voitures du raid sont détruites.
    const session = raidSessionRef.current;
    if (session.active) {
      session.destroyed++;
      if (session.destroyed >= RAID_TARGET) {
        session.active = false;
        raidUntilRef.current = 0;
        window.dispatchEvent(
          new CustomEvent("jce.godfather.say", {
            detail: { text: "La prochaine fois, ça sera plus cher." },
          }),
        );
      }
    }
  };


  const cars = carsRef.current;
  const S = VEHICLE_SIZE;
  const simpleFx = reduceMotion();
  // version est utilisé pour forcer un re-render structurel.
  void version;

  return (
    <svg
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 6 }}
    >
      <defs>
        <filter id="mafia-black">
          <feColorMatrix
            type="matrix"
            values="0.10 0 0 0 0
                    0 0.10 0 0 0
                    0 0 0.12 0 0
                    0 0 0 1 0"
          />
        </filter>
      </defs>

      {cars.map((c) => {
        if (c.state === "exploding") {
          const age = (performance.now() - (c.explodedAt ?? 0)) / EXPLOSION_MS;
          const r = simpleFx ? 36 : 22 + age * 95;
          const op = 1 - age;
          return (
            <g key={c.id} transform={`translate(${c.x},${c.y})`} pointerEvents="none">
              {!simpleFx && <circle r={r * 1.2} fill="none" stroke="rgba(255,200,80,0.7)" strokeWidth={3} opacity={op} />}
              <circle r={r} fill="rgba(255,170,40,0.7)" opacity={op} />
              {!simpleFx && <circle r={r * 0.7} fill="rgba(255,90,30,0.9)" opacity={op} />}
              {!simpleFx && <circle r={r * 0.35} fill="rgba(255,240,180,0.95)" opacity={op} />}
              <text y={-r - 6} textAnchor="middle" fontSize={30} fontWeight={900}
                fill="#fde047" stroke="#1a1306" strokeWidth={1.6} opacity={op}>
                +{REWARD}$
              </text>
            </g>
          );
        }
        return (
          <g
            key={c.id}
            ref={(el) => {
              if (el) groupRefs.current.set(c.id, el);
              else groupRefs.current.delete(c.id);
            }}
            transform={`translate(${c.x},${c.y}) rotate(${c.angle})`}
            style={{ pointerEvents: "auto", cursor: "pointer", willChange: "transform" }}
            onClick={(e) => { e.stopPropagation(); explode(c.id); }}
            onTouchStart={(e) => { e.preventDefault(); explode(c.id); }}
          >
            <rect x={-S * 0.7} y={-S * 0.7} width={S * 1.4} height={S * 1.4} fill="transparent" />
            <ellipse cx={0} cy={S * 0.04} rx={S * 0.34} ry={S * 0.07} fill="rgba(0,0,0,0.5)" />
            <g transform="rotate(90)">
              {c.sprite ? (
                <image
                  href={c.sprite}
                  x={-S / 2}
                  y={-S / 2}
                  width={S}
                  height={S}
                  preserveAspectRatio="xMidYMid meet"
                  filter={c.tinted ? "url(#mafia-black)" : undefined}
                />
              ) : (
                <rect x={-S / 2} y={-S / 2} width={S} height={S} rx={6} fill="#0a0a0a" />
              )}
            </g>
            <circle r={5} fill="rgba(0,0,0,0.75)" />
            <text y={2} textAnchor="middle" fontSize={7} fontWeight={900} fill="#dc2626">M</text>
          </g>
        );
      })}
    </svg>
  );
}
