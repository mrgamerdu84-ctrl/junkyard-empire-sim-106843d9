// =============================================================
// BARON CONVOY — Le baron de la mafia sort en balade toutes les
// 3-5 minutes avec 2 escortes devant et 2 derrière. Le cortège
// suit un path du réseau routier et s'arrête aux feux rouges.
// =============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { ROADS, VILLAGE_PATHS } from "./CityTraffic";
import { VehicleSvg, type VehicleSvgKind } from "./vehicles/VehicleSvgs";
import { listCustomVehiclesByCategory } from "./gameAssets";
import { getTrafficLights, getLightState, nowSeconds } from "./trafficLights";
import { isUltraLite, targetFps } from "@/lib/perf";

const MAP_W = 1920;
const MAP_H = 1080;
const SPACING = 80; // px entre véhicules
const CONVOY_SPEED = 60; // px/s
const MIN_INTERVAL_MS = 3 * 60 * 1000;
const MAX_INTERVAL_MS = 5 * 60 * 1000;
const RED_LIGHT_RADIUS = 80;

type PathCache = {
  length: number;
  points: { x: number; y: number; angle: number }[];
};

function buildPathCache(d: string, samples = 360): PathCache | null {
  const ns = "http://www.w3.org/2000/svg";
  try {
    const p = document.createElementNS(ns, "path");
    p.setAttribute("d", d);
    const len = p.getTotalLength();
    if (!Number.isFinite(len) || len <= 1) return null;
    const points: PathCache["points"] = [];
    for (let i = 0; i <= samples; i++) {
      const s = (i / samples) * len;
      const a = p.getPointAtLength(s);
      const b = p.getPointAtLength(Math.min(len, s + 2));
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      points.push({
        x: a.x,
        y: a.y,
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
      });
    }
    return { length: len, points };
  } catch {
    return null;
  }
}

function sampleCache(cache: PathCache, s: number) {
  const frac = Math.max(0, Math.min(1, s / cache.length));
  const idx = Math.min(
    cache.points.length - 1,
    Math.floor(frac * (cache.points.length - 1)),
  );
  return cache.points[idx];
}

type ConvoyVehicle = {
  kind: VehicleSvgKind;
  color: string;
  accent: string;
  scale: number;
  imageUrl?: string;
};

function buildConvoy(): ConvoyVehicle[] {
  const customLimos = listCustomVehiclesByCategory("limo");
  const baronImage = customLimos[0]?.url;
  const baron: ConvoyVehicle = baronImage
    ? { kind: "money", color: "#2c1810", accent: "#f39c12", scale: 0.85, imageUrl: baronImage }
    : { kind: "money", color: "#2c1810", accent: "#f39c12", scale: 0.85 };
  return [
    { kind: "sedan", color: "#1a1a2e", accent: "#c0392b", scale: 0.65 },
    { kind: "van",   color: "#1a1a2e", accent: "#c0392b", scale: 0.65 },
    baron,
    { kind: "van",   color: "#1a1a2e", accent: "#c0392b", scale: 0.65 },
    { kind: "sedan", color: "#1a1a2e", accent: "#c0392b", scale: 0.65 },
  ];
}

export default function BaronConvoy() {
  const [active, setActive] = useState(false);
  const [tick, setTick] = useState(0); // force ré-évaluation du convoi (custom limo)
  const convoy = useMemo(() => buildConvoy(), [tick]);

  const nodeRefs = useRef<(SVGGElement | null)[]>([]);
  const arrivedDispatched = useRef(false);
  const stateRef = useRef<{
    pathIdx: number;
    cache: PathCache | null;
    flip: boolean;
    leadS: number; // distance parcourue par le véhicule de tête
  } | null>(null);

  // Planifie le prochain départ (3-5 min) puis active le convoi.
  useEffect(() => {
    if (isUltraLite()) return; // pas de cortège en mode ultra-lite
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      const delay = MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
      timer = setTimeout(() => {
        // choisir un path autorisé
        // Utilise uniquement les 4 grands axes (index 0-3) qui suivent les routes principales
        const allowed = [0, 1, 2, 3].filter(i => i < ROADS.length);
        if (allowed.length === 0) {
          schedule();
          return;
        }
        const pathIdx = allowed[Math.floor(Math.random() * allowed.length)];
        const cache = buildPathCache(ROADS[pathIdx]);
        if (!cache) {
          schedule();
          return;
        }
        stateRef.current = {
          pathIdx,
          cache,
          flip: Math.random() < 0.5,
          leadS: 0,
        };
        setTick((t) => t + 1);
        setActive(true);
      }, delay);
    };
    // premier départ après un délai initial plus court (45-90s) pour la démo
    timer = setTimeout(() => {
      // Utilise uniquement les 4 grands axes (index 0-3) qui suivent les routes principales
      const allowed = [0, 1, 2, 3].filter(i => i < ROADS.length);
      if (allowed.length) {
        const pathIdx = allowed[Math.floor(Math.random() * allowed.length)];
        const cache = buildPathCache(ROADS[pathIdx]);
        if (cache) {
          stateRef.current = {
            pathIdx,
            cache,
            flip: Math.random() < 0.5,
            leadS: 0,
          };
          setTick((t) => t + 1);
          setActive(true);
        } else {
          schedule();
        }
      } else {
        schedule();
      }
    }, 45000 + Math.random() * 45000);

    return () => {
      if (timer) clearTimeout(timer);
    };
    // une seule planification au mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Boucle RAF qui anime le cortège quand il est actif.
  useEffect(() => {
    if (!active) return;
    const st = stateRef.current;
    if (!st || !st.cache) return;

    const fpsCap = Math.max(15, targetFps());
    const frameMs = 1000 / fpsCap;
    let last = performance.now();
    let acc = 0;
    let raf = 0;
    let stopped = false;

    const step = (now: number) => {
      if (stopped) return;
      const dt = Math.min(100, now - last);
      last = now;
      acc += dt;
      if (acc < frameMs) {
        raf = requestAnimationFrame(step);
        return;
      }
      const stepMs = acc;
      acc = 0;

      const cur = stateRef.current;
      if (!cur || !cur.cache) {
        raf = requestAnimationFrame(step);
        return;
      }
      const cache = cur.cache;

      // Le véhicule de tête (index 0 dans le sens de marche) regarde s'il
      // doit s'arrêter devant un feu rouge proche.
      const leadS = cur.leadS;
      const leadPosForward = cur.flip ? cache.length - leadS : leadS;
      let blocked = false;
      const lights = getTrafficLights();
      const t = nowSeconds();
      for (const l of lights) {
        for (const stop of l.stops) {
          if (stop.pathIdx !== cur.pathIdx) continue;
          if (Math.abs(leadPosForward - stop.s) < RED_LIGHT_RADIUS) {
            if (getLightState(l, t) === "red") {
              blocked = true;
              break;
            }
          }
        }
        if (blocked) break;
      }

      if (!blocked) {
        cur.leadS += (CONVOY_SPEED * stepMs) / 1000;
      }

      // Disparition quand le véhicule de tête a parcouru tout le path.
      if (cur.leadS >= cache.length) {
        // cacher tout
        for (const n of nodeRefs.current) {
          if (n) n.setAttribute("opacity", "0");
        }
        stopped = true;
        setActive(false);
        // planifier le prochain départ
        setTimeout(() => {
          const allowed: number[] = [];
          for (let i = 0; i < ROADS.length; i++) {
            if (!VILLAGE_PATHS.has(i)) allowed.push(i);
          }
          if (!allowed.length) return;
          const pathIdx = allowed[Math.floor(Math.random() * allowed.length)];
          const c = buildPathCache(ROADS[pathIdx]);
          if (!c) return;
          stateRef.current = {
            pathIdx,
            cache: c,
            flip: Math.random() < 0.5,
            leadS: 0,
          };
          setTick((v) => v + 1);
          setActive(true);
        }, MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS));
        return;
      }

      // Positionner chaque véhicule (espacés de SPACING px derrière le lead)
      for (let i = 0; i < convoy.length; i++) {
        const node = nodeRefs.current[i];
        if (!node) continue;
        const s = cur.leadS - i * SPACING;
        if (s < 0 || s > cache.length) {
          node.setAttribute("opacity", "0");
          continue;
        }
        const fwd = cur.flip ? cache.length - s : s;
        const pt = sampleCache(cache, fwd);
        const ang = cur.flip ? pt.angle + 180 : pt.angle;
        node.setAttribute(
          "transform",
          `translate(${pt.x.toFixed(1)},${pt.y.toFixed(1)}) rotate(${ang.toFixed(1)})`,
        );
        node.setAttribute("opacity", "1");
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [active, convoy]);

  if (!active) return null;

  return (
    <svg
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 28,
      }}
    >
      {convoy.map((v, i) => (
        <g
          key={i}
          ref={(el) => {
            nodeRefs.current[i] = el;
          }}
          opacity="0"
          pointerEvents="none"
        >
          {/* sprites top-down: on aligne le nez vers la droite (rotation 90) */}
          <g transform="rotate(90)">
            {v.imageUrl ? (
              <image
                href={v.imageUrl}
                x={-30}
                y={-30}
                width={60}
                height={60}
                preserveAspectRatio="xMidYMid meet"
              />
            ) : (
              <VehicleSvg
                kind={v.kind}
                color={v.color}
                accent={v.accent}
                scale={v.scale * 1.5}
              />
            )}
          </g>
        </g>
      ))}
    </svg>
  );
}
