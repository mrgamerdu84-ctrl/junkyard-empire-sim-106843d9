import { useEffect, useMemo, useRef, useState } from "react";
import { ROADS } from "./CityTraffic";

/* ============================================================
 * TAXI TYCOON — entreprise de taxis idle
 * Le neveu hérite d'un entrepôt délabré. Les taxis sortent du dépôt,
 * vont chercher les clients qui spawnent sur la map, les déposent,
 * encaissent. Le joueur achète des taxis, améliore le dépôt, repeint.
 * ============================================================ */

export type DepotTier = {
  name: string;
  cost: number;
  maxTaxis: number;
  fareMult: number;
  spawnEvery: number; // secondes
  badge: string;
  ring: string;
  core: string;
  flag: string;
};

const DEPOT_TIERS: DepotTier[] = [
  { name: "GARAGE ABANDONNÉ", cost: 0,     maxTaxis: 1,  fareMult: 1.0, spawnEvery: 8.0, badge: "🏚️", ring: "#5a4030", core: "#3a2a1f", flag: "#7a5030" },
  { name: "ATELIER ROUILLÉ",  cost: 1500,  maxTaxis: 2,  fareMult: 1.3, spawnEvery: 6.5, badge: "🔧", ring: "#7a5a35", core: "#4a3a25", flag: "#c08a3a" },
  { name: "GARAGE RÉNOVÉ",    cost: 7500,  maxTaxis: 4,  fareMult: 1.7, spawnEvery: 5.0, badge: "🏢", ring: "#a07a4a", core: "#604832", flag: "#e8b850" },
  { name: "STATION MODERNE",  cost: 35000, maxTaxis: 7,  fareMult: 2.2, spawnEvery: 3.8, badge: "🏬", ring: "#3a8ad0", core: "#1f4a7a", flag: "#5cb8ff" },
  { name: "QG TAXICORP",      cost: 150000,maxTaxis: 12, fareMult: 3.2, spawnEvery: 2.6, badge: "🏛️", ring: "#f5c542", core: "#7a5a10", flag: "#fde68a" },
];

export const TAXI_COLORS = [
  { id: "yellow", name: "Jaune", body: "#f5c542", trim: "#9c7a1c" },
  { id: "red",    name: "Rouge", body: "#d83a2a", trim: "#7c1c10" },
  { id: "blue",   name: "Bleu",  body: "#2b6ed8", trim: "#143f7c" },
  { id: "green",  name: "Vert",  body: "#3a8a48", trim: "#1c4a22" },
  { id: "white",  name: "Blanc", body: "#e8edf2", trim: "#8a8e94" },
  { id: "black",  name: "Noir",  body: "#1a1d22", trim: "#050607" },
  { id: "orange", name: "Orange",body: "#ff6b35", trim: "#8f2d10" },
  { id: "purple", name: "Violet",body: "#a855f7", trim: "#5b1aa0" },
];

type TaxiMode = "idle" | "to_pickup" | "to_dest" | "returning";
type Taxi = {
  id: number;
  pos: number;        // longueur le long du path
  target: number;
  mode: TaxiMode;
  speed: number;
  colorId: string;
  clientId: number | null;
};

type Client = {
  id: number;
  pickup: number;
  dropoff: number;
  fare: number;
  assigned: number | null;
  spawnedAt: number;
};

const DEPOT_POS_NORM = 0.78; // 78% le long de la route (zone basse-gauche, route bien dégagée)
const SAVE_KEY = "taxi-tycoon-v1";
const BASE_SPEED = 60; // px (sur viewBox 1920) par seconde
const SPEED_UPGRADE_COST_BASE = 800;
const TAXI_COST_BASE = 600;

type SaveData = {
  money: number;
  customersServed: number;
  totalEarned: number;
  depotTier: number;
  taxiSpeedLvl: number;
  taxis: { colorId: string }[];
  defaultColor: string;
};

const DEFAULT_SAVE: SaveData = {
  money: 250,
  customersServed: 0,
  totalEarned: 0,
  depotTier: 0,
  taxiSpeedLvl: 0,
  taxis: [{ colorId: "yellow" }],
  defaultColor: "yellow",
};

function loadSave(): SaveData {
  if (typeof window === "undefined") return DEFAULT_SAVE;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return DEFAULT_SAVE;
    return { ...DEFAULT_SAVE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SAVE;
  }
}

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 10_000) return Math.round(n / 1000) + "k";
  return Math.round(n).toLocaleString("fr-FR");
}

function TaxiSprite({ body, trim, withClient }: { body: string; trim: string; withClient: boolean }) {
  return (
    <g transform="scale(0.55)">
      <ellipse cx="0" cy="9" rx="32" ry="14" fill="rgba(0,0,0,0.45)" />
      <path d="M -30 -10 C -24 -18 18 -18 28 -8 L 34 0 L 27 10 C 12 18 -20 17 -31 9 L -36 0 Z" fill={trim} opacity="0.95" />
      <path d="M -28 -12 C -18 -19 16 -18 28 -8 L 33 0 L 26 9 C 11 15 -18 15 -30 8 L -35 0 Z" fill={body} />
      {/* damier taxi */}
      <g>
        {[-22, -16, -10, -4, 2, 8, 14, 20].map((x, i) => (
          <rect key={i} x={x} y={i % 2 ? -14 : -12} width="6" height="2.5" fill={i % 2 ? "#111" : "#fff"} />
        ))}
        {[-22, -16, -10, -4, 2, 8, 14, 20].map((x, i) => (
          <rect key={"b" + i} x={x} y={i % 2 ? 11.5 : 13} width="6" height="2.5" fill={i % 2 ? "#fff" : "#111"} />
        ))}
      </g>
      {/* vitres */}
      <path d="M -10 -10 L 13 -9 C 19 -6 22 -2 23 2 C 20 6 16 8 10 9 L -12 9 C -18 6 -20 3 -21 -1 C -20 -5 -17 -8 -10 -10 Z" fill="#101b2b" opacity="0.94" />
      {withClient && (
        <circle cx="2" cy="0" r="3.5" fill="#ffd9b0" stroke="#1a1d22" strokeWidth="0.6" />
      )}
      {/* TAXI sign */}
      <rect x="-5" y="-22" width="10" height="5" rx="1" fill="#ffd633" stroke="#1a1d22" strokeWidth="0.5" />
      <text x="0" y="-18.3" fontSize="3.5" fontWeight="900" textAnchor="middle" fill="#1a1d22">TAXI</text>
      {/* roues */}
      <rect x="10" y="-18" width="12" height="5" rx="2" fill="#08090b" />
      <rect x="10" y="13" width="12" height="5" rx="2" fill="#08090b" />
      <rect x="-24" y="-17" width="12" height="5" rx="2" fill="#08090b" />
      <rect x="-24" y="12" width="12" height="5" rx="2" fill="#08090b" />
      {/* phares */}
      <circle cx="33" cy="-5" r="2.2" fill="#fff7c0" />
      <circle cx="33" cy="5" r="2.2" fill="#fff7c0" />
    </g>
  );
}

function Depot({ tier, x, y }: { tier: DepotTier; x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx="0" cy="36" rx="60" ry="14" fill="rgba(0,0,0,0.55)" />
      {/* base */}
      <rect x="-50" y="-12" width="100" height="48" rx="4" fill={tier.core} stroke="#111" strokeWidth="2" />
      {/* toit */}
      <path d={`M -54 -12 L 0 -38 L 54 -12 Z`} fill={tier.ring} stroke="#111" strokeWidth="2" />
      {/* portes garage */}
      <rect x="-40" y="-2" width="22" height="34" fill="#1a1d22" stroke="#000" strokeWidth="1.5" />
      <rect x="18" y="-2" width="22" height="34" fill="#1a1d22" stroke="#000" strokeWidth="1.5" />
      {/* enseigne */}
      <rect x="-44" y="-30" width="88" height="14" rx="2" fill={tier.flag} stroke="#111" strokeWidth="1.5" />
      <text x="0" y="-20" fontSize="9" fontWeight="900" textAnchor="middle" fill="#1a1d22" letterSpacing="0.5">TAXI CORP</text>
      <text x="0" y="22" fontSize="20" textAnchor="middle">{tier.badge}</text>
    </g>
  );
}

export default function TaxiTycoon() {
  const measureRef = useRef<SVGPathElement | null>(null);
  const containerRef = useRef<SVGSVGElement | null>(null);
  const [pathLen, setPathLen] = useState(0);

  // === Persistent state ===
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const saveRef = useRef(save);
  saveRef.current = save;

  // === Dynamic state (not persisted) ===
  const taxisRef = useRef<Taxi[]>([]);
  const clientsRef = useRef<Client[]>([]);
  const nextIdRef = useRef(1);
  const lastSpawnRef = useRef(0);
  const [, forceRender] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [popups, setPopups] = useState<{ id: number; text: string; x: number; y: number }[]>([]);
  const popIdRef = useRef(0);

  // Mesure de la longueur du path principal au montage
  useEffect(() => {
    if (measureRef.current) {
      const l = measureRef.current.getTotalLength();
      setPathLen(l);
    }
  }, []);

  // Init taxis from save
  useEffect(() => {
    if (pathLen === 0) return;
    if (taxisRef.current.length === 0) {
      const depotPos = pathLen * DEPOT_POS_NORM;
      taxisRef.current = save.taxis.map((t, i) => ({
        id: nextIdRef.current++,
        pos: depotPos,
        target: depotPos,
        mode: "idle" as TaxiMode,
        speed: BASE_SPEED + save.taxiSpeedLvl * 18,
        colorId: t.colorId,
        clientId: null,
      }));
      forceRender((n) => n + 1);
    }
    // Sync taxi speed when upgrade happens
    const newSpeed = BASE_SPEED + save.taxiSpeedLvl * 18;
    taxisRef.current.forEach((t) => (t.speed = newSpeed));
  }, [pathLen, save.taxis.length, save.taxiSpeedLvl]);

  // Save persistence (debounced)
  useEffect(() => {
    const id = setTimeout(() => {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {}
    }, 400);
    return () => clearTimeout(id);
  }, [save]);

  const tier = DEPOT_TIERS[save.depotTier];
  const nextTier = DEPOT_TIERS[save.depotTier + 1];

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1600);
  };

  const popFloat = (text: string, x: number, y: number) => {
    const id = ++popIdRef.current;
    setPopups((p) => [...p, { id, text, x, y }]);
    window.setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 1100);
  };

  // === Boucle de jeu ===
  useEffect(() => {
    if (pathLen === 0) return;
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      const depotPos = pathLen * DEPOT_POS_NORM;
      const cur = saveRef.current;
      const curTier = DEPOT_TIERS[cur.depotTier];

      // Spawn client
      const maxClients = curTier.maxTaxis + 1;
      if (now - lastSpawnRef.current > curTier.spawnEvery * 1000 && clientsRef.current.length < maxClients) {
        lastSpawnRef.current = now;
        const pickup = Math.random() * pathLen;
        const dropoff = Math.random() * pathLen;
        const dist = Math.abs(dropoff - pickup);
        const fare = Math.round((20 + (dist / pathLen) * 180) * curTier.fareMult);
        clientsRef.current.push({
          id: nextIdRef.current++,
          pickup, dropoff, fare,
          assigned: null,
          spawnedAt: now,
        });
      }

      // Despawn old waiting clients (impatience: 35s)
      clientsRef.current = clientsRef.current.filter(
        (c) => c.assigned !== null || now - c.spawnedAt < 35000
      );

      // Assigner clients aux taxis idle
      for (const taxi of taxisRef.current) {
        if (taxi.mode !== "idle") continue;
        let best: Client | null = null;
        let bestDist = Infinity;
        for (const c of clientsRef.current) {
          if (c.assigned !== null) continue;
          const d = Math.abs(c.pickup - taxi.pos);
          if (d < bestDist) { bestDist = d; best = c; }
        }
        if (best) {
          best.assigned = taxi.id;
          taxi.clientId = best.id;
          taxi.mode = "to_pickup";
          taxi.target = best.pickup;
        }
      }

      // Mouvement des taxis
      for (const taxi of taxisRef.current) {
        if (taxi.mode === "idle") continue;
        const diff = taxi.target - taxi.pos;
        const step = taxi.speed * dt;
        if (Math.abs(diff) <= step) {
          taxi.pos = taxi.target;
          if (taxi.mode === "to_pickup") {
            const c = clientsRef.current.find((x) => x.id === taxi.clientId);
            if (c) {
              taxi.mode = "to_dest";
              taxi.target = c.dropoff;
            } else {
              taxi.mode = "returning";
              taxi.target = depotPos;
              taxi.clientId = null;
            }
          } else if (taxi.mode === "to_dest") {
            const c = clientsRef.current.find((x) => x.id === taxi.clientId);
            if (c && measureRef.current) {
              const p = measureRef.current.getPointAtLength(c.dropoff);
              popFloat(`+${fmt(c.fare)}$`, p.x, p.y);
              setSave((s) => ({
                ...s,
                money: s.money + c.fare,
                totalEarned: s.totalEarned + c.fare,
                customersServed: s.customersServed + 1,
              }));
              clientsRef.current = clientsRef.current.filter((x) => x.id !== c.id);
            }
            taxi.clientId = null;
            taxi.mode = "returning";
            taxi.target = depotPos;
          } else if (taxi.mode === "returning") {
            taxi.mode = "idle";
          }
        } else {
          taxi.pos += Math.sign(diff) * step;
        }
      }

      forceRender((n) => (n + 1) % 1_000_000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pathLen]);

  // === Helpers de rendu position ===
  const getXY = (len: number): { x: number; y: number; angle: number } => {
    if (!measureRef.current) return { x: 0, y: 0, angle: 0 };
    const safe = ((len % pathLen) + pathLen) % pathLen;
    const p = measureRef.current.getPointAtLength(safe);
    const p2 = measureRef.current.getPointAtLength(Math.min(pathLen - 0.1, safe + 2));
    const angle = (Math.atan2(p2.y - p.y, p2.x - p.x) * 180) / Math.PI;
    return { x: p.x, y: p.y, angle };
  };

  const depotXY = useMemo(() => getXY(pathLen * DEPOT_POS_NORM), [pathLen]);

  // === Actions UI ===
  const taxiCount = save.taxis.length;
  const taxiBuyCost = Math.round(TAXI_COST_BASE * Math.pow(1.65, taxiCount));
  const speedCost = Math.round(SPEED_UPGRADE_COST_BASE * Math.pow(2.1, save.taxiSpeedLvl));

  const buyTaxi = () => {
    if (taxiCount >= tier.maxTaxis) {
      showToast(`Capacité max : améliore le dépôt`);
      return;
    }
    if (save.money < taxiBuyCost) {
      showToast(`Il manque ${fmt(taxiBuyCost - save.money)} $`);
      return;
    }
    setSave((s) => ({
      ...s,
      money: s.money - taxiBuyCost,
      taxis: [...s.taxis, { colorId: s.defaultColor }],
    }));
    showToast("🚕 Nouveau taxi acheté !");
  };

  const upgradeDepot = () => {
    if (!nextTier) { showToast("Dépôt déjà au max"); return; }
    if (save.money < nextTier.cost) {
      showToast(`Il manque ${fmt(nextTier.cost - save.money)} $`);
      return;
    }
    setSave((s) => ({ ...s, money: s.money - nextTier.cost, depotTier: s.depotTier + 1 }));
    showToast(`🏗️ Dépôt amélioré : ${nextTier.name}`);
  };

  const upgradeSpeed = () => {
    if (save.money < speedCost) {
      showToast(`Il manque ${fmt(speedCost - save.money)} $`);
      return;
    }
    setSave((s) => ({ ...s, money: s.money - speedCost, taxiSpeedLvl: s.taxiSpeedLvl + 1 }));
    showToast(`⚡ Taxis plus rapides !`);
  };

  const setColor = (id: string) => {
    setSave((s) => ({ ...s, defaultColor: id, taxis: s.taxis.map((t) => ({ colorId: id })) }));
  };

  return (
    <>
      {/* === Calque SVG du jeu === */}
      <svg
        ref={containerRef}
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 4 }}
      >
        <defs>
          <path ref={measureRef} id="taxi-road" d={ROADS[0]} />
          <filter id="taxi-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#000" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Asphalte visualisé légèrement (assombri sous les taxis) */}
        <g opacity="0.18">
          {ROADS.map((d, i) => (
            <path key={i} d={d} stroke="#0a0c10" strokeWidth={28} fill="none" strokeLinecap="round" />
          ))}
        </g>

        {/* Clients en attente */}
        {clientsRef.current.map((c) => {
          if (c.assigned !== null) return null;
          const p = getXY(c.pickup);
          const age = (performance.now() - c.spawnedAt) / 1000;
          const pulse = 1 + Math.sin(age * 4) * 0.15;
          return (
            <g key={c.id} transform={`translate(${p.x},${p.y})`} filter="url(#taxi-shadow)">
              <circle r={14 * pulse} fill="#10b981" opacity="0.35" />
              <circle r="11" fill="#0f172a" stroke="#34d399" strokeWidth="2.5" />
              <text y="4.5" fontSize="13" textAnchor="middle">🙋</text>
              <g transform="translate(0,-22)">
                <rect x="-22" y="-9" width="44" height="14" rx="3" fill="#0f172a" stroke="#34d399" strokeWidth="1" />
                <text y="1.5" fontSize="9" fontWeight="900" textAnchor="middle" fill="#34d399">{fmt(c.fare)}$</text>
              </g>
            </g>
          );
        })}

        {/* Dropoffs (clients en cours dans taxi) */}
        {clientsRef.current.map((c) => {
          if (c.assigned === null) return null;
          const p = getXY(c.dropoff);
          return (
            <g key={"d" + c.id} transform={`translate(${p.x},${p.y})`}>
              <circle r="9" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="4 3" opacity="0.85">
                <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite" />
              </circle>
              <text y="3.5" fontSize="10" textAnchor="middle">📍</text>
            </g>
          );
        })}

        {/* Dépôt */}
        {pathLen > 0 && <Depot tier={tier} x={depotXY.x} y={depotXY.y - 18} />}

        {/* Taxis */}
        {taxisRef.current.map((taxi) => {
          const p = getXY(taxi.pos);
          const color = TAXI_COLORS.find((c) => c.id === taxi.colorId) ?? TAXI_COLORS[0];
          // Sens du déplacement
          const movingForward = taxi.target >= taxi.pos;
          const angle = movingForward ? p.angle : p.angle + 180;
          return (
            <g key={taxi.id} transform={`translate(${p.x},${p.y}) rotate(${angle})`} filter="url(#taxi-shadow)">
              <TaxiSprite body={color.body} trim={color.trim} withClient={taxi.mode === "to_dest"} />
            </g>
          );
        })}

        {/* Popups gains */}
        {popups.map((p) => (
          <g key={p.id} transform={`translate(${p.x},${p.y})`}>
            <text fontSize="22" fontWeight="900" textAnchor="middle" fill="#34d399" stroke="#0a0c10" strokeWidth="3" paintOrder="stroke">
              {p.text}
              <animate attributeName="y" from="0" to="-40" dur="1.1s" fill="freeze" />
              <animate attributeName="opacity" from="1" to="0" dur="1.1s" fill="freeze" />
            </text>
          </g>
        ))}
      </svg>

      {/* === HUD HTML === */}
      <div className="tt-hud">
        <div className="tt-top">
          <div className="tt-stat money">
            <span className="tt-stat-icon">💰</span>
            <span className="tt-stat-val">{fmt(save.money)}$</span>
          </div>
          <div className="tt-stat">
            <span className="tt-stat-icon">👥</span>
            <span className="tt-stat-val">{save.customersServed}</span>
          </div>
          <div className="tt-stat">
            <span className="tt-stat-icon">🚕</span>
            <span className="tt-stat-val">{taxiCount}/{tier.maxTaxis}</span>
          </div>
        </div>

        <div className="tt-depot-card">
          <div className="tt-depot-name">{tier.badge} {tier.name}</div>
          <div className="tt-depot-stats">
            Tarifs ×{tier.fareMult.toFixed(1)} • Capa {tier.maxTaxis} taxis
          </div>
        </div>

        <div className="tt-actions">
          <button className="tt-btn primary" onClick={buyTaxi} disabled={save.money < taxiBuyCost || taxiCount >= tier.maxTaxis}>
            <span className="tt-btn-ico">🚕</span>
            <span className="tt-btn-lbl">Acheter taxi</span>
            <span className="tt-btn-cost">{fmt(taxiBuyCost)}$</span>
          </button>
          <button className="tt-btn" onClick={upgradeSpeed} disabled={save.money < speedCost}>
            <span className="tt-btn-ico">⚡</span>
            <span className="tt-btn-lbl">Vitesse +{save.taxiSpeedLvl + 1}</span>
            <span className="tt-btn-cost">{fmt(speedCost)}$</span>
          </button>
          <button className="tt-btn upgrade" onClick={upgradeDepot} disabled={!nextTier || save.money < (nextTier?.cost ?? 0)}>
            <span className="tt-btn-ico">🏗️</span>
            <span className="tt-btn-lbl">{nextTier ? `Améliorer dépôt` : `Dépôt max`}</span>
            <span className="tt-btn-cost">{nextTier ? `${fmt(nextTier.cost)}$` : "—"}</span>
          </button>
        </div>

        <div className="tt-colors">
          {TAXI_COLORS.map((c) => (
            <button
              key={c.id}
              className={`tt-color ${save.defaultColor === c.id ? "selected" : ""}`}
              onClick={() => setColor(c.id)}
              style={{ background: c.body, borderColor: c.trim }}
              title={`Repeindre tous en ${c.name}`}
            />
          ))}
        </div>

        {toast && <div className="tt-toast">{toast}</div>}
      </div>

      <style>{`
        .tt-hud {
          position: absolute; inset: 0; z-index: 30;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #fff; pointer-events: none;
        }
        .tt-top {
          position: absolute; top: 10px; left: 10px; right: 10px;
          display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;
        }
        .tt-stat {
          display: flex; align-items: center; gap: 6px;
          background: linear-gradient(180deg, #1f2127 0%, #0d0e12 100%);
          border: 1px solid #000; border-radius: 10px;
          padding: 6px 12px;
          box-shadow: 0 3px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);
          font-size: 14px; font-weight: 800;
          pointer-events: auto;
        }
        .tt-stat.money { color: #34d399; }
        .tt-stat-icon { font-size: 16px; }

        .tt-depot-card {
          position: absolute; top: 56px; left: 50%; transform: translateX(-50%);
          background: linear-gradient(180deg, rgba(15,17,22,0.85), rgba(8,9,12,0.92));
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          padding: 7px 14px;
          text-align: center;
          box-shadow: 0 6px 18px rgba(0,0,0,0.55);
          pointer-events: auto;
        }
        .tt-depot-name { font-size: 12px; font-weight: 900; letter-spacing: 0.5px; }
        .tt-depot-stats { font-size: 10px; color: #b0b4ba; margin-top: 2px; font-weight: 700; }

        .tt-actions {
          position: absolute; bottom: 70px; left: 8px; right: 8px;
          display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;
          pointer-events: auto;
        }
        .tt-btn {
          display: flex; flex-direction: column; align-items: center; gap: 1px;
          background: linear-gradient(180deg, #2a2d34, #14161b);
          border: 1px solid #000; border-radius: 12px;
          padding: 8px 12px;
          color: #fff; font-family: inherit; cursor: pointer;
          box-shadow: 0 3px 0 rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08);
          min-width: 95px;
          transition: transform 0.08s ease;
        }
        .tt-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(0,0,0,0.6); }
        .tt-btn:disabled { opacity: 0.42; cursor: not-allowed; }
        .tt-btn.primary { background: linear-gradient(180deg, #d4a017, #8b6914); border-color: #5a4400; }
        .tt-btn.upgrade { background: linear-gradient(180deg, #16a34a, #064e29); border-color: #022c17; }
        .tt-btn-ico { font-size: 20px; line-height: 1; }
        .tt-btn-lbl { font-size: 11px; font-weight: 800; letter-spacing: 0.3px; }
        .tt-btn-cost { font-size: 11px; font-weight: 900; color: #fde68a; }
        .tt-btn.upgrade .tt-btn-cost { color: #d1fae5; }

        .tt-colors {
          position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
          display: flex; gap: 6px; padding: 6px 8px;
          background: rgba(10,12,16,0.75); border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.08);
          pointer-events: auto;
        }
        .tt-color {
          width: 28px; height: 28px; border-radius: 50%;
          border: 2px solid; cursor: pointer; padding: 0;
          transition: transform 0.12s ease;
        }
        .tt-color:hover { transform: scale(1.15); }
        .tt-color.selected { outline: 2px solid #fde68a; outline-offset: 2px; transform: scale(1.18); }

        .tt-toast {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(10,12,16,0.92);
          border: 1px solid #fde68a;
          color: #fff; font-weight: 800; font-size: 14px;
          padding: 10px 18px; border-radius: 10px;
          box-shadow: 0 12px 30px rgba(0,0,0,0.7);
          pointer-events: none;
          animation: ttToast 1.6s ease;
        }
        @keyframes ttToast {
          0% { opacity: 0; transform: translate(-50%, -40%); }
          15%, 80% { opacity: 1; transform: translate(-50%, -50%); }
          100% { opacity: 0; transform: translate(-50%, -60%); }
        }
      `}</style>
    </>
  );
}
