// =============================================================
// Camion blindé de la MAFIA
// Le camion appartient désormais à la mafia : il transporte son argent
// vers leur dépôt, escorté par 2-3 voitures mafia (vrais sprites du jeu
// teintés en noir, AUCUN nouveau véhicule ajouté).
// Le joueur peut cliquer sur le camion pour le détourner vers SON QG.
// Dès lors, l'escorte attaque + des renforts mafia spawn pour
// l'intercepter. Le joueur doit cliquer chaque voiture mafia pour
// l'exploser. Quand le camion arrive au QG :
//   - 0 mafia restante → joueur remporte le butin complet
//   - >=1 mafia restante → le camion est repris, perte de 50% du butin
// Events conservés : jce:armored-spawn / jce:armored-resolved
// =============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { ROADS, VILLAGE_PATHS } from "./CityTraffic";
import { useAdminConfig } from "./adminConfig";
import { getCivilCarUrls } from "./gameAssets";
import { isMafiaTruceActive } from "./MafiaGodfather";
import armoredTruckAsset from "@/assets/armored-truck.png.asset.json";
import { isUltraLite, reduceMotion, targetFps } from "@/lib/perf";

const DEFAULT_ARMORED_SPRITE = armoredTruckAsset.url;

const ARMORED_SPRITE_KEY = "jce.armored.sprite";

// Plage d'apparition (ms)
const SPAWN_MIN_MS = 5 * 60_000;
const SPAWN_MAX_MS = 8 * 60_000;
const FIRST_SPAWN_MIN_MS = 60_000;
const FIRST_SPAWN_MAX_MS = 120_000;

// Camion : durée de traversée vers le dépôt mafia (s)
const TRUCK_TRAVEL_S = 38;
// Après détournement : temps pour rejoindre le QG joueur (s)
const HIJACK_TRAVEL_S = 22;

// Escorte initiale (vrais sprites tintés noir)
const ESCORT_COUNT = 3;
// Renforts mafia pendant la fuite : un nouveau toutes les N secondes
const REINFORCE_EVERY_S = 5;
const MAX_MAFIA_ALIVE = 7;

// Récompense par mafieux explosé pendant la séquence
const MAFIA_KILL_REWARD = 60;

const TRUCK_ROAD_IDX = ROADS.map((_, i) => i).filter((i) => !VILLAGE_PATHS.has(i));

type Phase = "idle" | "rolling" | "hijacked" | "done";

type MafiaCar = {
  id: number;
  sprite: string;
  // Offset latéral/longitudinal autour du camion (px en repère monde)
  offX: number;
  offY: number;
  alive: boolean;
  explodedAt?: number;
};

function adjustPlayerMoney(delta: number, label = "Camion mafia") {
  window.dispatchEvent(new CustomEvent("jce.player.cashDelta", {
    detail: { amount: delta, reason: "armored", label },
  }));
}

function fmtMoney(n: number): string {
  return Math.round(n).toLocaleString("fr-FR");
}

const EXPLOSION_MS = 900;

export default function ArmoredTruck() {
  const ultraLite = isUltraLite();
  const reducedFx = reduceMotion();
  const cfg = useAdminConfig();
  const cfgRef = useRef(cfg);
  useEffect(() => { cfgRef.current = cfg; }, [cfg]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [pathIdx, setPathIdx] = useState(0);
  const [flip, setFlip] = useState(false);
  const [loot, setLoot] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [mafia, setMafia] = useState<MafiaCar[]>([]);
  const mafiaRef = useRef<MafiaCar[]>([]);
  useEffect(() => { mafiaRef.current = mafia; }, [mafia]);

  const [spriteUrl, setSpriteUrl] = useState<string | null>(() => {
    try { return localStorage.getItem(ARMORED_SPRITE_KEY) ?? DEFAULT_ARMORED_SPRITE; } catch { return DEFAULT_ARMORED_SPRITE; }
  });
  useEffect(() => {
    const onStorage = () => {
      try { setSpriteUrl(localStorage.getItem(ARMORED_SPRITE_KEY) ?? DEFAULT_ARMORED_SPRITE); } catch { /* noop */ }
    };
    window.addEventListener("jce:armored-sprite-changed", onStorage);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("jce:armored-sprite-changed", onStorage);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const truckRef = useRef<SVGGElement | null>(null);
  const truckPosRef = useRef<{ x: number; y: number; angle: number }>({ x: 0, y: 0, angle: 0 });

  const rolloutStartRef = useRef<number>(0);
  const hijackStartRef = useRef<number>(0);
  const interceptPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastReinforceRef = useRef<number>(0);
  const idCounterRef = useRef(0);

  const showToast = (txt: string, ms = 4500) => {
    setToast(txt);
    window.setTimeout(() => setToast((t) => (t === txt ? null : t)), ms);
  };

  const newId = () => ++idCounterRef.current;

  const buildEscort = (count: number): MafiaCar[] => {
    const urls = getCivilCarUrls();
    const list: MafiaCar[] = [];
    for (let i = 0; i < count; i++) {
      const sprite = urls.length ? urls[Math.floor(Math.random() * urls.length)] : "";
      // Disposition : 1 devant, 1 derrière, 1 sur le côté
      const ring = [
        { offX: 0, offY: -34 },
        { offX: 0, offY: 34 },
        { offX: 26, offY: 0 },
        { offX: -26, offY: 0 },
        { offX: 22, offY: 26 },
      ];
      const slot = ring[i % ring.length];
      list.push({
        id: newId(),
        sprite,
        offX: slot.offX,
        offY: slot.offY,
        alive: true,
      });
    }
    return list;
  };

  const scheduleNext = (first = false) => {
    const lo = first ? FIRST_SPAWN_MIN_MS : SPAWN_MIN_MS;
    const hi = first ? FIRST_SPAWN_MAX_MS : SPAWN_MAX_MS;
    const mult = Math.max(0.1, cfgRef.current.armoredFreqMult || 1);
    const ms = (lo + Math.random() * (hi - lo)) * mult;
    return window.setTimeout(() => {
      if (cfgRef.current.armoredAutoSpawn === false) {
        scheduleNext(false);
        return;
      }
      // Trêve mafia : le Parrain a rappelé ses convois.
      if (isMafiaTruceActive()) {
        scheduleNext(false);
        return;
      }
      spawn();
    }, ms);
  };

  const spawn = () => {
    const idx = TRUCK_ROAD_IDX[Math.floor(Math.random() * TRUCK_ROAD_IDX.length)] ?? 0;
    const fl = Math.random() < 0.5;
    const amount = Math.round(800 + Math.random() * 1500);
    setPathIdx(idx);
    setFlip(fl);
    setLoot(amount);
    setMafia(buildEscort(ultraLite ? 1 : ESCORT_COUNT));
    rolloutStartRef.current = performance.now();
    setPhase("rolling");
    showToast(`🚛 Camion de la MAFIA repéré ! Butin : ${fmtMoney(amount)} $ — Tape-le pour le détourner !`, 5500);
  };

  const onTruckClick = () => {
    if (phase !== "rolling") return;
    interceptPosRef.current = { ...truckPosRef.current };
    hijackStartRef.current = performance.now();
    lastReinforceRef.current = performance.now();
    setPhase("hijacked");
    showToast(`🎯 Camion détourné ! Ramène-le au QG — explose toutes les voitures mafia !`, 5000);
  };

  const explodeMafia = (id: number) => {
    const now = performance.now();
    let killed = false;
    mafiaRef.current = mafiaRef.current.map((m) => {
      if (m.id === id && m.alive) { killed = true; return { ...m, alive: false, explodedAt: now }; }
      return m;
    });
    setMafia([...mafiaRef.current]);
    if (killed) adjustPlayerMoney(MAFIA_KILL_REWARD, "Mafia neutralisée");
  };

  const resolveAtHQ = () => {
    // Une fois le camion à l'intérieur du QG, il est en sécurité :
    // la mafia ne peut PLUS le reprendre, même s'il reste des poursuivants.
    // Les voitures mafia encore vivantes décrochent (despawn) et le butin
    // est intégralement crédité au joueur.
    const survivors = mafiaRef.current.filter((m) => m.alive);
    if (survivors.length > 0) {
      // Décrochage : on les marque "explosées" silencieusement pour
      // les faire disparaître sans bonus (elles ont fui, pas été tuées).
      const now = performance.now();
      mafiaRef.current = mafiaRef.current.map((m) =>
        m.alive ? { ...m, alive: false, explodedAt: now - EXPLOSION_MS } : m
      );
      setMafia([...mafiaRef.current]);
    }
    adjustPlayerMoney(+loot, "Butin mafia sécurisé au QG");
    showToast(`💰 Camion à l'abri dans le QG ! Butin sécurisé : +${fmtMoney(loot)} $`, 5500);
    window.dispatchEvent(new CustomEvent("jce:armored-resolved", {
      detail: { winner: "player", amount: loot, success: true },
    }));
    setPhase("done");
  };

  useEffect(() => {
    const t = scheduleNext(true);
    const onManual = () => {
      setPhase((p) => {
        if (p !== "idle" && p !== "done") return p;
        spawn();
        return "rolling";
      });
    };
    window.addEventListener("jce:armored-spawn-now", onManual);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("jce:armored-spawn-now", onManual);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "done") return;
    const t = window.setTimeout(() => {
      setPhase("idle");
      setMafia([]);
      scheduleNext(false);
    }, 3000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ---------- Animation RAF ----------
  useEffect(() => {
    if (phase === "idle" || phase === "done") return;
    const path = pathRefs.current[pathIdx];
    if (!path) return;
    const len = path.getTotalLength();
    if (len <= 1) return;

    const hqX = cfgRef.current.hqX;
    const hqY = cfgRef.current.hqY;

    let raf = 0;
    let last = 0;
    const MIN_FRAME = 1000 / targetFps();
    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      if (now - last < MIN_FRAME) return;
      last = now;
      let tx = 0, ty = 0, ang = 0;


      if (phase === "rolling") {
        const u = Math.min(1, (now - rolloutStartRef.current) / (TRUCK_TRAVEL_S * 1000));
        if (u >= 1) {
          // Atteint le dépôt mafia sans détournement → cycle terminé
          showToast(`📦 Le camion mafia a rejoint son dépôt…`, 3500);
          setPhase("done");
          return;
        }
        const fwd = flip ? len * (1 - u) : len * u;
        const p = path.getPointAtLength(fwd);
        const p2 = path.getPointAtLength(Math.min(len, Math.max(0, fwd + (flip ? -1 : 1))));
        const tdx = p2.x - p.x, tdy = p2.y - p.y;
        const L = Math.hypot(tdx, tdy) || 1;
        ang = (Math.atan2(tdy, tdx) * 180) / Math.PI;
        const laneSign = flip ? -1 : 1;
        const ox = (-tdy / L) * 10 * laneSign;
        const oy = (tdx / L) * 10 * laneSign;
        tx = p.x + ox; ty = p.y + oy;
      } else {
        // hijacked : lerp depuis le point d'interception vers le QG
        const u = Math.min(1, (now - hijackStartRef.current) / (HIJACK_TRAVEL_S * 1000));
        const from = interceptPosRef.current;
        tx = from.x + (hqX - from.x) * u;
        ty = from.y + (hqY - from.y) * u;
        ang = (Math.atan2(hqY - from.y, hqX - from.x) * 180) / Math.PI;

        // Renforts mafia
        const aliveCount = mafiaRef.current.filter((m) => m.alive).length;
        if (
          aliveCount < (ultraLite ? 3 : MAX_MAFIA_ALIVE) &&
          (now - lastReinforceRef.current) > (ultraLite ? REINFORCE_EVERY_S * 2 : REINFORCE_EVERY_S) * 1000
        ) {
          lastReinforceRef.current = now;
          const newcomers = buildEscort(1);
          // Place le renfort sur un côté éloigné pour effet "arrivée"
          newcomers[0].offX = (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 24);
          newcomers[0].offY = (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 20);
          mafiaRef.current = [...mafiaRef.current, ...newcomers];
          setMafia(mafiaRef.current);
        }

        if (u >= 1) {
          resolveAtHQ();
          return;
        }
      }

      truckPosRef.current = { x: tx, y: ty, angle: ang };
      truckRef.current?.setAttribute("transform", `translate(${tx.toFixed(2)},${ty.toFixed(2)}) rotate(${ang.toFixed(2)})`);
    };
    raf = requestAnimationFrame(step);

    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pathIdx, flip]);

  const showTruck = phase === "rolling" || phase === "hijacked";
  const lootBadge = useMemo(() => fmtMoney(loot), [loot]);

  // Position calculée des voitures mafia (relative au camion, rotation incluse)
  const renderMafia = () => {
    if (!showTruck) return null;
    const { x: tx, y: ty, angle } = truckPosRef.current;
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    return mafia.map((m) => {
      // Si exploding : fade puis disparition
      if (!m.alive) {
        if (reducedFx) return null;
        const age = (performance.now() - (m.explodedAt ?? 0)) / EXPLOSION_MS;
        if (age >= 1) return null;
        const ex = tx + (m.offX * cos - m.offY * sin);
        const ey = ty + (m.offX * sin + m.offY * cos);
        const r = 18 + age * 70;
        const op = 1 - age;
        return (
          <g key={m.id} transform={`translate(${ex},${ey})`} pointerEvents="none">
            <circle r={r} fill="rgba(255,170,40,0.7)" opacity={op} />
            <circle r={r * 0.55} fill="rgba(255,90,30,0.9)" opacity={op} />
            <circle r={r * 0.25} fill="rgba(255,240,180,0.95)" opacity={op} />
            <text y={-r - 4} textAnchor="middle" fontSize={16} fontWeight={900}
              fill="#fde047" stroke="#1a1306" strokeWidth={1.2} opacity={op}>
              +{MAFIA_KILL_REWARD}$
            </text>
          </g>
        );
      }
      const ex = tx + (m.offX * cos - m.offY * sin);
      const ey = ty + (m.offX * sin + m.offY * cos);
      const W = 30, H = 50;
      return (
        <g
          key={m.id}
          transform={`translate(${ex},${ey}) rotate(${angle})`}
          style={{ pointerEvents: "auto", cursor: "pointer" }}
          onClick={(e) => { e.stopPropagation(); explodeMafia(m.id); }}
          onTouchStart={(e) => { e.preventDefault(); explodeMafia(m.id); }}
        >
          {/* hit area */}
          <rect x={-22} y={-30} width={44} height={60} fill="transparent" />
          <ellipse cx={0} cy={4} rx={14} ry={4} fill="rgba(0,0,0,0.55)" />
          <g transform="rotate(90)">
            {m.sprite ? (
              <image
                href={m.sprite}
                x={-W / 2}
                y={-H / 2}
                width={W}
                height={H}
                preserveAspectRatio="xMidYMid meet"
                filter="url(#armored-mafia-black)"
              />
            ) : (
              <rect x={-W / 2} y={-H / 2} width={W} height={H} rx={6} fill="#0a0a0a" />
            )}
          </g>
          <circle r={5} fill="rgba(0,0,0,0.75)" />
          <text y={2} textAnchor="middle" fontSize={7} fontWeight={900} fill="#b91c1c">M</text>
        </g>
      );
    });
  };

  const aliveMafiaCount = mafia.filter((m) => m.alive).length;

  return (
    <>
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          pointerEvents: "none", zIndex: 7,
        }}
      >
        <defs>
          <filter id="armored-mafia-black">
            <feColorMatrix
              type="matrix"
              values="0.10 0 0 0 0
                      0 0.10 0 0 0
                      0 0 0.12 0 0
                      0 0 0 1 0"
            />
          </filter>
          {ROADS.map((d, i) => (
            <path
              key={i}
              id={`jce-armored-road-${i}`}
              d={d}
              ref={(el) => { pathRefs.current[i] = el; }}
              fill="none"
              stroke="none"
            />
          ))}
        </defs>

        {showTruck && (
          <>
            {renderMafia()}

            {/* Camion blindé — cliquable pendant "rolling" pour détourner */}
            <g
              ref={truckRef}
              style={{ pointerEvents: "auto", cursor: phase === "rolling" ? "pointer" : "default" }}
              onClick={onTruckClick}
            >
              {phase === "rolling" && !reducedFx && (
                <circle cx="0" cy="0" r="22" fill="none" stroke="#fde047" strokeWidth="2" opacity="0.9">
                  <animate attributeName="r" values="18;30;18" dur="1.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0.2;0.9" dur="1.2s" repeatCount="indefinite" />
                </circle>
              )}
              {phase === "hijacked" && !reducedFx && (
                <circle cx="0" cy="0" r="24" fill="none" stroke="#22d3ee" strokeWidth="2" opacity="0.85">
                  <animate attributeName="r" values="20;32;20" dur="1.4s" repeatCount="indefinite" />
                </circle>
              )}
              <ellipse cx="0" cy="4" rx="16" ry="4" fill="rgba(0,0,0,0.5)" />
              {spriteUrl ? (
                <g transform="rotate(90)">
                  <image href={spriteUrl} x="-18" y="-22" width="36" height="44" preserveAspectRatio="xMidYMid meet" />
                </g>
              ) : (
                <g transform="rotate(90)">
                  <rect x="-10" y="-20" width="20" height="40" rx="2.5" fill="#3f3f46" stroke="#0b0d10" strokeWidth="1.6" />
                  <rect x="-9" y="-19" width="18" height="11" rx="1.5" fill="#1f2937" stroke="#0b0d10" strokeWidth="1" />
                  <rect x="-9" y="-5" width="18" height="22" rx="1.5" fill="#52525b" stroke="#0b0d10" strokeWidth="1" />
                  <text x="0" y="9" textAnchor="middle" fontSize="9" fontWeight="900" fill="#fde047" fontFamily="system-ui">$</text>
                </g>
              )}
              {/* Pastille butin + compteur mafia */}
              <g transform="translate(0,-30)" style={{ pointerEvents: "none" }}>
                <rect x="-34" y="-9" width="68" height="16" rx="8" fill="rgba(15,23,42,0.92)" stroke="#fde047" strokeWidth="1.2" />
                <text x="0" y="2" textAnchor="middle" fontSize="9" fontWeight="900" fill="#fde047" fontFamily="system-ui">
                  💰 {lootBadge}$ {phase === "hijacked" ? `· 🦹${aliveMafiaCount}` : ""}
                </text>
              </g>
            </g>
          </>
        )}
      </svg>

      {toast && (
        <div
          style={{
            position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)",
            zIndex: 10000, background: "linear-gradient(180deg,#1f2937,#0b1220)",
            color: "#fde047", padding: "10px 16px", borderRadius: 12,
            border: "2px solid #fde047", fontWeight: 900, fontSize: 13,
            fontFamily: "system-ui, sans-serif",
            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
            maxWidth: "92vw", textAlign: "center",
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
