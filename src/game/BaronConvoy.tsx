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
import { useAdminConfig, type BaronVehicleType } from "./adminConfig";

const MAP_W = 1920;
const MAP_H = 1080;
const SPACING = 115; // cortège plus lisible
const CONVOY_SPEED = 60; // px/s
const MIN_INTERVAL_MS = 3 * 60 * 1000;
const MAX_INTERVAL_MS = 5 * 60 * 1000;
const RED_LIGHT_RADIUS = 80;
const CONVOY_VISUAL_SCALE = 2.35;
const CUSTOM_VEHICLE_SIZE = 92;

type PathCache = {
  length: number;
  points: { x: number; y: number; angle: number }[];
};

function buildPathCache(d: string, samples = 420): PathCache | null {
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
      points.push({ x: a.x, y: a.y, angle: (Math.atan2(dy, dx) * 180) / Math.PI });
    }
    return { length: len, points };
  } catch {
    return null;
  }
}

function sampleCache(cache: PathCache, s: number) {
  const frac = Math.max(0, Math.min(1, s / cache.length));
  const idx = Math.min(cache.points.length - 1, Math.floor(frac * (cache.points.length - 1)));
  return cache.points[idx];
}

type ConvoyVehicle = {
  kind: VehicleSvgKind;
  color: string;
  accent: string;
  scale: number;
  imageUrl?: string;
  role: "escort" | "baron";
};

function baronVehicleFromType(type: BaronVehicleType): ConvoyVehicle {
  if (type === "game") {
    const taxis = listCustomVehiclesByCategory("taxi");
    const civils = listCustomVehiclesByCategory("civil");
    const picked = taxis[0]?.url || civils[0]?.url;
    return picked
      ? { kind: "sedan", color: "#facc15", accent: "#111827", scale: 1.2, imageUrl: picked, role: "baron" }
      : { kind: "sedan", color: "#facc15", accent: "#111827", scale: 1.2, role: "baron" };
  }
  if (type === "suv") return { kind: "van", color: "#0f172a", accent: "#ef4444", scale: 1.2, role: "baron" };
  if (type === "sedan") return { kind: "sedan", color: "#111827", accent: "#d4a838", scale: 1.25, role: "baron" };

  const customLimos = listCustomVehiclesByCategory("limo");
  const baronImage = customLimos[0]?.url;
  return baronImage
    ? { kind: "money", color: "#150707", accent: "#f39c12", scale: 1.35, imageUrl: baronImage, role: "baron" }
    : { kind: "money", color: "#150707", accent: "#f39c12", scale: 1.35, role: "baron" };
}

function buildConvoy(type: BaronVehicleType): ConvoyVehicle[] {
  const baron = baronVehicleFromType(type);
  return [
    { kind: "police", color: "#0f172a", accent: "#ef4444", scale: 1.08, role: "escort" },
    { kind: "sedan", color: "#111827", accent: "#ef4444", scale: 1.05, role: "escort" },
    baron,
    { kind: "sedan", color: "#111827", accent: "#ef4444", scale: 1.05, role: "escort" },
    { kind: "police", color: "#0f172a", accent: "#ef4444", scale: 1.08, role: "escort" },
  ];
}

export default function BaronConvoy() {
  const cfg = useAdminConfig();
  const [active, setActive] = useState(false);
  const [tick, setTick] = useState(0);
  const convoy = useMemo(() => buildConvoy(cfg.baronVehicleType), [tick, cfg.baronVehicleType]);

  const nodeRefs = useRef<(SVGGElement | null)[]>([]);
  const arrivedDispatched = useRef(false);
  const stateRef = useRef<{ pathIdx: number; cache: PathCache | null; flip: boolean; leadS: number } | null>(null);

  useEffect(() => {
    if (isUltraLite()) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Le Baron n'apparaît qu'à partir du chapitre 4 (invitation) — scénarisé.
    const baronUnlocked = () => {
      try {
        const raw = localStorage.getItem("campaign_state_v1");
        if (!raw) return false;
        const s = JSON.parse(raw);
        return (s?.currentChapterIndex ?? 0) >= 3; // idx 3 = ch4
      } catch { return false; }
    };
    const startConvoy = () => {
      if (!baronUnlocked()) return false;
      const allowed = [0, 1, 2, 3].filter((i) => i < ROADS.length);
      if (!allowed.length) return false;
      const pathIdx = allowed[Math.floor(Math.random() * allowed.length)];
      const cache = buildPathCache(ROADS[pathIdx]);
      if (!cache) return false;
      stateRef.current = { pathIdx, cache, flip: Math.random() < 0.5, leadS: 0 };
      setTick((t) => t + 1);
      setActive(true);
      return true;
    };
    const schedule = () => {
      const delay = MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
      timer = setTimeout(() => { if (!startConvoy()) schedule(); }, delay);
    };
    timer = setTimeout(() => { if (!startConvoy()) schedule(); }, 45000 + Math.random() * 45000);
    return () => { if (timer) clearTimeout(timer); };
  }, []);


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
      if (acc < frameMs) { raf = requestAnimationFrame(step); return; }
      const stepMs = acc;
      acc = 0;

      const cur = stateRef.current;
      if (!cur || !cur.cache) { raf = requestAnimationFrame(step); return; }
      const cache = cur.cache;
      const leadS = cur.leadS;
      const leadPosForward = cur.flip ? cache.length - leadS : leadS;
      let blocked = false;
      const lights = getTrafficLights();
      const t = nowSeconds();
      for (const l of lights) {
        for (const stop of l.stops) {
          if (stop.pathIdx !== cur.pathIdx) continue;
          if (Math.abs(leadPosForward - stop.s) < RED_LIGHT_RADIUS && getLightState(l, t, stop.axis) === "red") {
            blocked = true;
            break;
          }
        }
        if (blocked) break;
      }

      if (!blocked) cur.leadS += (CONVOY_SPEED * stepMs) / 1000;

      if (!arrivedDispatched.current && cur.leadS >= cache.length * 0.75) {
        arrivedDispatched.current = true;
        window.dispatchEvent(new CustomEvent("jce.baron.arrives"));
      }

      if (cur.leadS >= cache.length) {
        for (const n of nodeRefs.current) if (n) n.setAttribute("opacity", "0");
        stopped = true;
        arrivedDispatched.current = false;
        window.dispatchEvent(new CustomEvent("jce.baron.leaves"));
        setActive(false);
        setTimeout(() => {
          const allowed: number[] = [];
          for (let i = 0; i < ROADS.length; i++) if (!VILLAGE_PATHS.has(i)) allowed.push(i);
          if (!allowed.length) return;
          const pathIdx = allowed[Math.floor(Math.random() * allowed.length)];
          const c = buildPathCache(ROADS[pathIdx]);
          if (!c) return;
          stateRef.current = { pathIdx, cache: c, flip: Math.random() < 0.5, leadS: 0 };
          setTick((v) => v + 1);
          setActive(true);
        }, MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS));
        return;
      }

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
        node.setAttribute("transform", `translate(${pt.x.toFixed(1)},${pt.y.toFixed(1)}) rotate(${ang.toFixed(1)})`);
        node.setAttribute("opacity", "1");
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { stopped = true; if (raf) cancelAnimationFrame(raf); };
  }, [active, convoy]);

  if (!active) return null;

  return (
    <svg
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 28, overflow: "visible" }}
    >
      {convoy.map((v, i) => (
        <g key={i} ref={(el) => { nodeRefs.current[i] = el; }} opacity="0" pointerEvents="none">
          <g transform="rotate(90)">
            {v.imageUrl ? (
              <image
                href={v.imageUrl}
                x={-CUSTOM_VEHICLE_SIZE / 2}
                y={-CUSTOM_VEHICLE_SIZE / 2}
                width={CUSTOM_VEHICLE_SIZE}
                height={CUSTOM_VEHICLE_SIZE}
                preserveAspectRatio="xMidYMid meet"
              />
            ) : (
              <VehicleSvg kind={v.kind} color={v.color} accent={v.accent} scale={v.scale * CONVOY_VISUAL_SCALE} />
            )}
          </g>
          {v.role === "baron" && <circle r={34} fill="none" stroke="#facc15" strokeWidth={2} strokeDasharray="5 4" opacity={0.85} />}
        </g>
      ))}
    </svg>
  );
}
