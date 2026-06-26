// =============================================================
// MAFIA — Dépôt clandestin envoie des voitures noires saboter nos
// taxis pendant leurs courses. On utilise les vrais sprites de
// voitures civiles (déjà présents) teintés en noir via un filter
// SVG. Le joueur doit TAPER chaque voiture noire pour la stopper
// net / la faire exploser et protéger son taxi.
// Récompense : +100 $ par mafieux neutralisé (event jce.player.cashDelta).
// =============================================================
import { useEffect, useRef, useState } from "react";
import { getCivilCarUrls } from "./gameAssets";

type PlayerTaxi = { id: number; x: number; y: number; onMission: boolean };

type Mafia = {
  id: number;
  sprite: string;
  x: number;
  y: number;
  angle: number;
  speed: number;          // px/s
  targetTaxiId: number | null;
  state: "hunt" | "exploding";
  explodedAt?: number;
};

const REWARD = 100;
const MAP_W = 1920;
const MAP_H = 1080;
const SPAWN_INTERVAL_MS = 7000;   // base, réduit avec le temps
const MAX_CARS = 4;
const EXPLOSION_MS = 900;

function getPlayerTaxis(): PlayerTaxi[] {
  const w = window as unknown as { __jcePlayerTaxis?: PlayerTaxi[] };
  return w.__jcePlayerTaxis ?? [];
}

function pickEdgeSpawn(): { x: number; y: number } {
  const side = Math.floor(Math.random() * 4);
  if (side === 0) return { x: -60, y: Math.random() * MAP_H };
  if (side === 1) return { x: MAP_W + 60, y: Math.random() * MAP_H };
  if (side === 2) return { x: Math.random() * MAP_W, y: -60 };
  return { x: Math.random() * MAP_W, y: MAP_H + 60 };
}

export default function MafiaAttackers() {
  const [cars, setCars] = useState<Mafia[]>([]);
  const carsRef = useRef<Mafia[]>([]);
  const idRef = useRef(0);
  const lastSpawn = useRef(0);
  const startedAt = useRef(Date.now());

  useEffect(() => { carsRef.current = cars; }, [cars]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const taxis = getPlayerTaxis();
      const onMission = taxis.filter((t) => t.onMission);

      const minutes = (Date.now() - startedAt.current) / 60000;
      const spawnEvery = Math.max(3500, SPAWN_INTERVAL_MS - minutes * 500);

      // Spawn uniquement quand au moins un taxi joueur est en course.
      if (
        onMission.length > 0 &&
        carsRef.current.filter((c) => c.state === "hunt").length < MAX_CARS &&
        now - lastSpawn.current > spawnEvery
      ) {
        lastSpawn.current = now;
        const target = onMission[Math.floor(Math.random() * onMission.length)];
        const spawn = pickEdgeSpawn();
        const urls = getCivilCarUrls();
        const sprite = urls[Math.floor(Math.random() * urls.length)];
        const mafia: Mafia = {
          id: ++idRef.current,
          sprite,
          x: spawn.x,
          y: spawn.y,
          angle: 0,
          speed: 140 + Math.random() * 60 + minutes * 8,
          targetTaxiId: target.id,
          state: "hunt",
        };
        carsRef.current = [...carsRef.current, mafia];
      }

      // Avance chaque voiture vers la position courante de sa cible.
      let mutated = false;
      const next: Mafia[] = [];
      for (const c of carsRef.current) {
        if (c.state === "exploding") {
          if (now - (c.explodedAt ?? now) < EXPLOSION_MS) next.push(c);
          else mutated = true;
          continue;
        }
        const tgt = taxis.find((t) => t.id === c.targetTaxiId) ?? taxis[0];
        if (!tgt) {
          // plus de cible → continue tout droit puis sort
          if (c.x < -120 || c.x > MAP_W + 120 || c.y < -120 || c.y > MAP_H + 120) {
            mutated = true; continue;
          }
          next.push(c); continue;
        }
        const dx = tgt.x - c.x;
        const dy = tgt.y - c.y;
        const dist = Math.hypot(dx, dy) || 1;
        const vx = (dx / dist) * c.speed;
        const vy = (dy / dist) * c.speed;
        const nx = c.x + vx * dt;
        const ny = c.y + vy * dt;
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        next.push({ ...c, x: nx, y: ny, angle });
        mutated = true;
      }
      carsRef.current = next;
      if (mutated || next.length !== cars.length) setCars(next);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const explode = (id: number) => {
    const t = performance.now();
    carsRef.current = carsRef.current.map((c) =>
      c.id === id && c.state === "hunt" ? { ...c, state: "exploding", explodedAt: t } : c,
    );
    setCars([...carsRef.current]);
    window.dispatchEvent(
      new CustomEvent("jce.player.cashDelta", { detail: { amount: REWARD } }),
    );
  };

  return (
    <svg
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 6 }}
    >
      <defs>
        {/* Filtre : assombrit fortement le sprite (voiture noire) */}
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
          const r = 22 + age * 95;
          const op = 1 - age;
          return (
            <g key={c.id} transform={`translate(${c.x},${c.y})`} pointerEvents="none">
              {/* onde de choc */}
              <circle r={r * 1.2} fill="none" stroke="rgba(255,200,80,0.7)" strokeWidth={3} opacity={op} />
              {/* flammes */}
              <circle r={r} fill="rgba(255,170,40,0.7)" opacity={op} />
              <circle r={r * 0.7} fill="rgba(255,90,30,0.9)" opacity={op} />
              <circle r={r * 0.35} fill="rgba(255,240,180,0.95)" opacity={op} />
              {/* fumée */}
              <circle cx={-10} cy={-12 - age * 18} r={14 + age * 10} fill="rgba(30,30,30,0.55)" opacity={op * 0.7} />
              <circle cx={12} cy={-8 - age * 22} r={11 + age * 8} fill="rgba(50,50,50,0.5)" opacity={op * 0.7} />
              {/* éclats */}
              {[0, 60, 120, 180, 240, 300].map((a) => {
                const rad = (a * Math.PI) / 180;
                const d = age * 70;
                return (
                  <rect
                    key={a}
                    x={Math.cos(rad) * d - 2}
                    y={Math.sin(rad) * d - 2}
                    width={4}
                    height={4}
                    fill="#1a1a1a"
                    opacity={op}
                  />
                );
              })}
              <text y={-r - 6} textAnchor="middle" fontSize={30} fontWeight={900}
                fill="#fde047" stroke="#1a1306" strokeWidth={1.6} opacity={op}>
                +{REWARD}$
              </text>
            </g>
          );
        }
        // Les sprites civils sont top-down "tête au nord" : on compense par
        // un rotate(90) interne pour que l'avant suive le sens de marche.
        const W = 56, H = 92;
        return (
          <g
            key={c.id}
            transform={`translate(${c.x},${c.y}) rotate(${c.angle})`}
            style={{ pointerEvents: "auto", cursor: "pointer" }}
            onClick={(e) => { e.stopPropagation(); explode(c.id); }}
            onTouchStart={(e) => { e.preventDefault(); explode(c.id); }}
          >
            {/* zone de tap large */}
            <rect x={-40} y={-30} width={80} height={60} fill="transparent" />
            {/* ombre */}
            <ellipse cx={0} cy={6} rx={26} ry={6} fill="rgba(0,0,0,0.55)" />
            <g transform="rotate(90)">
              {/* sprite voiture (asset réel) teinté en noir */}
              <image
                href={c.sprite}
                x={-W / 2}
                y={-H / 2}
                width={W}
                height={H}
                preserveAspectRatio="xMidYMid meet"
                filter="url(#mafia-black)"
              />
            </g>
            {/* phares rouges à l'avant */}
            <circle cx={22} cy={-5} r={2} fill="#ff2a2a" />
            <circle cx={22} cy={5} r={2} fill="#ff2a2a" />
            {/* marqueur M discret */}
            <circle r={6} fill="rgba(0,0,0,0.7)" />
            <text y={2} textAnchor="middle" fontSize={8} fontWeight={900} fill="#b91c1c">M</text>
          </g>
        );
      })}
    </svg>
  );
}
