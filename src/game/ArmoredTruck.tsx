// =============================================================
// Camion blindé & braquages
// Apparaît toutes les 5-8 min, traverse la ville sur une ROAD, transporte
// 500-1500 $. Cliquable par le joueur → tentative de braquage : un taxi-
// braqueur (couleur joueur) intercepte le camion, la police arrive, et le
// taxi tente de rejoindre le QG. Issue probabiliste.
// Les rivaux peuvent aussi tenter leur chance (chance par compagnie active).
// - Succès joueur : +butin
// - Échec joueur : -50% du butin
// - Succès rival : -15% du cash à chaque autre compagnie (joueur inclus)
// - Échec rival  : sa trésorerie -50% du butin (géré par CityCompetitors)
// Évents : jce:armored-spawn / jce:armored-resolved
// =============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { ROADS, VILLAGE_PATHS } from "./CityTraffic";
import { useAdminConfig } from "./adminConfig";
import armoredTruckAsset from "@/assets/armored-truck.png.asset.json";

const DEFAULT_ARMORED_SPRITE = armoredTruckAsset.url;

const SAVE_KEY = "taxi-tycoon-v4";
const ARMORED_SPRITE_KEY = "jce.armored.sprite";

// Plage d'apparition (ms)
const SPAWN_MIN_MS = 5 * 60_000;
const SPAWN_MAX_MS = 8 * 60_000;
// Premier spawn (plus court, pour ne pas attendre 5min après chargement)
const FIRST_SPAWN_MIN_MS = 60_000;
const FIRST_SPAWN_MAX_MS = 120_000;

// Durée de traversée du camion (s)
const TRUCK_TRAVEL_S = 35;
// Durée de la séquence braquage (s) — interception + retour
const HEIST_DURATION_S = 14;

// Probabilités de succès
const PLAYER_SUCCESS = 0.6;
const RIVAL_SUCCESS = 0.5;
// Chance qu'un rival tente le braquage à chaque apparition
const RIVAL_ATTEMPT_CHANCE = 0.35;

const TRUCK_ROAD_IDX = ROADS.map((_, i) => i).filter((i) => !VILLAGE_PATHS.has(i));

type Phase = "idle" | "rolling" | "heist" | "done";
type Heister = { kind: "player" | "rival"; rivalId?: string; color: string } | null;

type Competitor = { id: string; name: string; color: string; bankrupt: boolean };

function readPlayerMoney(): number {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return 0;
    const j = JSON.parse(raw);
    return Number(j?.money ?? 0);
  } catch { return 0; }
}

function adjustPlayerMoney(delta: number) {
  // Passe par l'event canonique de TaxiTycoon (mise à jour + toast)
  window.dispatchEvent(new CustomEvent("jce.player.cashDelta", {
    detail: { amount: delta, reason: "armored", label: "Camion blindé" },
  }));
}

function fmtMoney(n: number): string {
  return Math.round(n).toLocaleString("fr-FR");
}

export default function ArmoredTruck() {
  const cfg = useAdminConfig();
  const cfgRef = useRef(cfg);
  useEffect(() => { cfgRef.current = cfg; }, [cfg]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [pathIdx, setPathIdx] = useState(0);
  const [flip, setFlip] = useState(false);
  const [loot, setLoot] = useState(0);
  const [heister, setHeister] = useState<Heister>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [spriteUrl, setSpriteUrl] = useState<string | null>(() => {
    try { return localStorage.getItem(ARMORED_SPRITE_KEY) ?? DEFAULT_ARMORED_SPRITE; } catch { return DEFAULT_ARMORED_SPRITE; }
  });

  // Re-charge le sprite si modifié depuis l'admin
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

  // Refs d'animation
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const truckRef = useRef<SVGGElement | null>(null);

  // Position courante du camion (en coords SVG) — pour clic & poursuite
  const truckPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // ---------- Cycle d'apparition ----------
  const rolloutStartRef = useRef<number>(0);
  const heistStartRef = useRef<number>(0);
  const heistOutcomeRef = useRef<{ winner: "player" | "rival" | "none"; rivalId?: string; success: boolean } | null>(null);

  const showToast = (txt: string, ms = 4500) => {
    setToast(txt);
    window.setTimeout(() => setToast((t) => (t === txt ? null : t)), ms);
  };

  const scheduleNext = (first = false) => {
    const lo = first ? FIRST_SPAWN_MIN_MS : SPAWN_MIN_MS;
    const hi = first ? FIRST_SPAWN_MAX_MS : SPAWN_MAX_MS;
    const mult = Math.max(0.1, cfgRef.current.armoredFreqMult || 1);
    const ms = (lo + Math.random() * (hi - lo)) * mult;
    return window.setTimeout(() => {
      if (cfgRef.current.armoredAutoSpawn === false) {
        // auto-spawn désactivé : on re-planifie plus tard
        scheduleNext(false);
        return;
      }
      spawn();
    }, ms);
  };

  const spawn = () => {
    const idx = TRUCK_ROAD_IDX[Math.floor(Math.random() * TRUCK_ROAD_IDX.length)] ?? 0;
    const fl = Math.random() < 0.5;
    const amount = Math.round(500 + Math.random() * 1000);
    setPathIdx(idx);
    setFlip(fl);
    setLoot(amount);
    setHeister(null);
    heistOutcomeRef.current = null;
    rolloutStartRef.current = performance.now();
    setPhase("rolling");
    showToast(`🚛 Camion blindé repéré ! Butin : ${fmtMoney(amount)} $`);

    // Tentative IA : un rival peut se lancer après un délai aléatoire
    const w = window as unknown as { __jceCompetitors?: Competitor[] };
    const alive = (w.__jceCompetitors ?? []).filter((c) => !c.bankrupt);
    if (cfgRef.current.rivalsCanHeist !== false && alive.length > 0 && Math.random() < RIVAL_ATTEMPT_CHANCE) {
      const r = alive[Math.floor(Math.random() * alive.length)];
      const delay = 2500 + Math.random() * (TRUCK_TRAVEL_S * 1000 - 5000);
      window.setTimeout(() => {
        setPhase((p) => {
          if (p !== "rolling") return p;
          startHeist({ kind: "rival", rivalId: r.id, color: r.color });
          return "heist";
        });
      }, delay);
    }
  };

  // Démarrer la séquence de braquage
  const startHeist = (h: NonNullable<Heister>) => {
    setHeister(h);
    heistStartRef.current = performance.now();
    const success = h.kind === "player"
      ? Math.random() < PLAYER_SUCCESS
      : Math.random() < RIVAL_SUCCESS;
    heistOutcomeRef.current = {
      winner: success ? (h.kind === "player" ? "player" : "rival") : "none",
      rivalId: h.rivalId,
      success,
    };
  };

  // Clic joueur sur le camion
  const onTruckClick = () => {
    if (phase !== "rolling") return;
    const playerColor = (window as unknown as { __jcePlayerColor?: string }).__jcePlayerColor ?? "#facc15";
    startHeist({ kind: "player", color: playerColor });
    setPhase("heist");
  };

  // Résolution
  const resolveHeist = () => {
    const out = heistOutcomeRef.current;
    if (!out) { setPhase("done"); return; }
    if (out.winner === "player") {
      adjustPlayerMoney(+loot);
      showToast(`💰 Braquage réussi ! +${fmtMoney(loot)} $`, 5000);
    } else if (out.winner === "rival") {
      // -15% à chaque AUTRE compagnie (joueur inclus)
      const pm = readPlayerMoney();
      const penalty = Math.round(pm * 0.15);
      if (penalty > 0) adjustPlayerMoney(-penalty);
      // Notifie CityCompetitors pour appliquer aux rivaux
      window.dispatchEvent(new CustomEvent("jce:armored-resolved", {
        detail: { winner: "rival", rivalId: out.rivalId, amount: loot, success: true },
      }));
      showToast(`💸 Un rival a braqué le camion ! −${fmtMoney(penalty)} $ (−15 %)`, 5500);
    } else {
      // Échec
      if (heister?.kind === "player") {
        const fine = Math.round(loot * 0.5);
        adjustPlayerMoney(-fine);
        showToast(`🚨 Braquage raté — la police t'a chopé ! −${fmtMoney(fine)} $`, 5500);
      } else {
        // Rival raté → pénalité gérée par CityCompetitors
        window.dispatchEvent(new CustomEvent("jce:armored-resolved", {
          detail: { winner: "none", rivalId: heister?.rivalId, amount: loot, success: false },
        }));
        showToast(`🚨 Un rival a tenté le braquage et a échoué !`, 4500);
      }
    }
    setPhase("done");
  };

  // ---------- Boucle de planification ----------
  useEffect(() => {
    const t = scheduleNext(true);
    const onManual = () => {
      setPhase((p) => {
        if (p !== "idle" && p !== "done") return p; // déjà en cours
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

  // Quand on passe à "done", on relance un cycle
  useEffect(() => {
    if (phase !== "done") return;
    const t = window.setTimeout(() => {
      setPhase("idle");
      scheduleNext(false);
    }, 2500);
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

    let raf = 0;
    const step = (now: number) => {
      // Position camion sur le path
      let u: number;
      if (phase === "rolling") {
        u = Math.min(1, (now - rolloutStartRef.current) / (TRUCK_TRAVEL_S * 1000));
        if (u >= 1) {
          // Atteint la banque sans braquage → cycle terminé
          setPhase("done");
          return;
        }
      } else {
        // Heist : le camion est intercepté au point d'interception puis "immobilisé"
        const tHeist = (now - heistStartRef.current) / 1000;
        const fracRolling = Math.min(1, (heistStartRef.current - rolloutStartRef.current) / (TRUCK_TRAVEL_S * 1000));
        u = Math.min(1, fracRolling + Math.min(0.05, tHeist * 0.003));
        // Résolution
        if (tHeist >= HEIST_DURATION_S) {
          resolveHeist();
          return;
        }
      }

      const fwd = flip ? len * (1 - u) : len * u;
      const p = path.getPointAtLength(fwd);
      const p2 = path.getPointAtLength(Math.min(len, Math.max(0, fwd + (flip ? -1 : 1))));
      const tdx = p2.x - p.x, tdy = p2.y - p.y;
      const L = Math.hypot(tdx, tdy) || 1;
      const ang = (Math.atan2(tdy, tdx) * 180) / Math.PI;
      // Léger lane offset pour rester sur la chaussée
      const laneSign = flip ? -1 : 1;
      const ox = (-tdy / L) * 10 * laneSign;
      const oy = (tdx / L) * 10 * laneSign;
      const tx = p.x + ox, ty = p.y + oy;
      truckPosRef.current = { x: tx, y: ty };
      truckRef.current?.setAttribute("transform", `translate(${tx.toFixed(2)},${ty.toFixed(2)}) rotate(${ang.toFixed(2)})`);

      // NB : plus aucun véhicule dessiné en dur (braqueur / flics).
      // Le visuel de poursuite est porté par les taxis du joueur et des rivaux
      // ainsi que les voitures de police importées via l'admin.

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pathIdx, flip]);

  const showTruck = phase === "rolling" || phase === "heist";
  void heister;

  const lootBadge = useMemo(() => fmtMoney(loot), [loot]);

  return (
    <>
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid meet"
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          pointerEvents: "none", zIndex: 7,
        }}
      >
        <defs>
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

            {/* Camion blindé — cliquable */}
            <g
              ref={truckRef}
              style={{ pointerEvents: "auto", cursor: phase === "rolling" ? "pointer" : "default" }}
              onClick={onTruckClick}
            >
              {/* Halo pulsant doré (cliquable) */}
              {phase === "rolling" && (
                <circle cx="0" cy="0" r="22" fill="none" stroke="#fde047" strokeWidth="2" opacity="0.9">
                  <animate attributeName="r" values="18;28;18" dur="1.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0.2;0.9" dur="1.2s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Ombre */}
              <ellipse cx="0" cy="4" rx="16" ry="4" fill="rgba(0,0,0,0.5)" />
              {spriteUrl ? (
                <g transform="rotate(90)">
                  <image href={spriteUrl} x="-18" y="-22" width="36" height="44" preserveAspectRatio="xMidYMid meet" />
                </g>
              ) : (
                <g transform="rotate(90)">
                  {/* Châssis */}
                  <rect x="-10" y="-20" width="20" height="40" rx="2.5" fill="#3f3f46" stroke="#0b0d10" strokeWidth="1.6" />
                  {/* Cabine */}
                  <rect x="-9" y="-19" width="18" height="11" rx="1.5" fill="#1f2937" stroke="#0b0d10" strokeWidth="1" />
                  <rect x="-7" y="-17" width="14" height="5" rx="0.8" fill="rgba(15,23,42,0.85)" />
                  {/* Coffre */}
                  <rect x="-9" y="-5" width="18" height="22" rx="1.5" fill="#52525b" stroke="#0b0d10" strokeWidth="1" />
                  <rect x="-7" y="-2" width="14" height="16" rx="1" fill="#3f3f46" />
                  {/* Rivets */}
                  {[-5, 0, 5].map((rx) => (
                    <circle key={`r1-${rx}`} cx={rx} cy="1" r="0.9" fill="#a1a1aa" />
                  ))}
                  {[-5, 0, 5].map((rx) => (
                    <circle key={`r2-${rx}`} cx={rx} cy="11" r="0.9" fill="#a1a1aa" />
                  ))}
                  {/* Gyrophare */}
                  <rect x="-3" y="-21" width="6" height="2" rx="0.6" fill="#fde047">
                    <animate attributeName="fill" values="#fde047;#ef4444;#fde047" dur="0.8s" repeatCount="indefinite" />
                  </rect>
                  {/* Roues */}
                  <rect x="-11" y="-14" width="2" height="6" fill="#0b0d10" />
                  <rect x="9" y="-14" width="2" height="6" fill="#0b0d10" />
                  <rect x="-11" y="10" width="2" height="6" fill="#0b0d10" />
                  <rect x="9" y="10" width="2" height="6" fill="#0b0d10" />
                  {/* $ */}
                  <text x="0" y="9" textAnchor="middle" fontSize="9" fontWeight="900" fill="#fde047" fontFamily="system-ui">$</text>
                </g>
              )}
              {/* Pastille butin */}
              <g transform="translate(0,-28)" style={{ pointerEvents: "none" }}>
                <rect x="-26" y="-8" width="52" height="14" rx="7" fill="rgba(15,23,42,0.92)" stroke="#fde047" strokeWidth="1.2" />
                <text x="0" y="2" textAnchor="middle" fontSize="9" fontWeight="900" fill="#fde047" fontFamily="system-ui">
                  💰 {lootBadge}$
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
