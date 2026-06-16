import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import citymap from "@/assets/citymap.jpg";
import sharky from "@/assets/sharky.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Junky City Empire" },
      { name: "description", content: "Construis ton empire de casses automobiles, garages et stations de lavage." },
      { property: "og:title", content: "Junky City Empire" },
      { property: "og:description", content: "Construis ton empire de casses automobiles, garages et stations de lavage." },
    ],
  }),
  component: JunkyCityEmpire,
});

type Zone = {
  id: string;
  name: string;
  unlock?: number;
  status?: string;
  // % positioning on the map image
  top: string;
  left: string;
  reward?: number;
  scrap?: number;
};

const ZONES: Zone[] = [
  { id: "casse", name: "VOTRE CASSE", top: "62%", left: "16%", reward: 250, scrap: 5 },
  { id: "garage", name: "GARAGE EXPRESS", unlock: 5, status: "Débloqué au niveau 5", top: "62%", left: "84%", reward: 180, scrap: 3 },
  { id: "carwash", name: "CAR WASH", unlock: 10, status: "Débloqué au niveau 10", top: "82%", left: "20%", reward: 320, scrap: 6 },
  { id: "concession", name: "CONCESSION PREMIUM", unlock: 20, status: "Bientôt disponible", top: "30%", left: "68%", reward: 600, scrap: 10 },
  { id: "casino", name: "CASINO", unlock: 30, status: "Bientôt disponible", top: "30%", left: "32%", reward: 1200, scrap: 15 },
  { id: "centre", name: "CENTRE COMMERCIAL", unlock: 40, status: "Bientôt disponible", top: "50%", left: "48%" },
  { id: "ville", name: "VILLE ABANDONNÉE", unlock: 50, status: "Prochaine expansion", top: "58%", left: "84%" },
  { id: "construction", name: "ZONE EN CONSTRUCTION", status: "Plus de bâtiments à venir !", top: "82%", left: "55%" },
  { id: "international", name: "CASSE INTERNATIONALE", unlock: 60, status: "En développement", top: "82%", left: "82%" },
];

// Road paths in 0-100 SVG viewBox coords, matching the citymap roads
const ROADS = [
  // main horizontal road across the middle
  { d: "M 0 70 L 100 70", dur: 14 },
  // upper horizontal road
  { d: "M 0 40 L 100 40", dur: 18 },
  // vertical road left-center
  { d: "M 38 100 L 38 0", dur: 16 },
  // vertical road right
  { d: "M 75 0 L 75 100", dur: 20 },
  // diagonal loop around the casse
  { d: "M 0 88 L 50 88 L 50 70", dur: 12 },
];

// Tier system: visual + reward upgrades based on player level
const tierFor = (niveau: number, unlock = 1) =>
  Math.min(5, 1 + Math.floor(Math.max(0, niveau - unlock) / 5));

const TOOLBAR = [
  { id: "boutique", label: "BOUTIQUE", icon: "🛒" },
  { id: "construction", label: "CONSTRUCTION", icon: "🔨" },
  { id: "depanneuses", label: "DÉPANNEUSES", icon: "🚛" },
  { id: "vehicules", label: "VÉHICULES", icon: "🚗" },
  { id: "atelier", label: "ATELIER", icon: "🔧" },
  { id: "pieces", label: "PIÈCES", icon: "📦" },
  { id: "decorations", label: "DÉCORATIONS", icon: "🌿" },
  { id: "objectifs", label: "OBJECTIFS", icon: "⭐", badge: 3 },
];

function JunkyCityEmpire() {
  const [argent, setArgent] = useState(125750);
  const [ferraille, setFerraille] = useState(320);
  const [niveau, setNiveau] = useState(18);
  const [xp, setXp] = useState(45);
  const [flash, setFlash] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const formatNum = (n: number) => n.toLocaleString("fr-FR");

  const accepter = (z: Zone) => {
    if (z.unlock && z.unlock > niveau) {
      setToast(`🔒 Débloqué au niveau ${z.unlock}`);
      setTimeout(() => setToast(null), 1600);
      return;
    }
    if (!z.reward) {
      setToast(`🚧 ${z.status ?? "Indisponible"}`);
      setTimeout(() => setToast(null), 1600);
      return;
    }
    const tier = tierFor(niveau, z.unlock ?? 1);
    const gain = z.reward * tier;
    const scrapGain = (z.scrap ?? 0) * tier;
    setArgent((m) => m + gain);
    setFerraille((f) => f + scrapGain);
    setXp((x) => {
      const nx = x + 5;
      if (nx >= 100) {
        setNiveau((n) => n + 1);
        return nx - 100;
      }
      return nx;
    });
    setFlash(z.id);
    setTimeout(() => setFlash(null), 600);
  };

  return (
    <div className="jce-root">
      <style>{`
        * { box-sizing: border-box; }
        html, body, #root { margin: 0; padding: 0; background: #1a1d22; }
        .jce-root {
          position: relative;
          min-height: 100vh;
          width: 100%;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #fff;
          overflow: hidden;
          background: #0c0d10;
        }

        /* ===== TOP BAR ===== */
        .jce-topbar {
          position: absolute; top: 0; left: 0; right: 0;
          display: flex; justify-content: space-between; align-items: flex-start;
          padding: 12px 14px;
          z-index: 20;
          pointer-events: none;
        }
        .jce-topbar > * { pointer-events: auto; }

        .jce-profile-block { display: flex; flex-direction: column; gap: 8px; }
        .jce-profile {
          display: flex; align-items: center; gap: 10px;
          background: linear-gradient(180deg, #2a2d34 0%, #181a1f 100%);
          border: 1px solid #000;
          border-radius: 10px;
          padding: 6px 14px 6px 6px;
          box-shadow: 0 3px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);
          min-width: 180px;
        }
        .jce-avatar {
          width: 46px; height: 46px;
          background: linear-gradient(135deg, #2196f3, #0d47a1);
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          border: 2px solid #ffd633;
        }
        .jce-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .jce-profile-info { flex: 1; }
        .jce-name { font-size: 15px; font-weight: 900; letter-spacing: 1px; line-height: 1; }
        .jce-level { font-size: 11px; color: #b0b4ba; margin-top: 2px; line-height: 1; }
        .jce-xpbar {
          margin-top: 4px;
          height: 5px; background: #000;
          border-radius: 3px; overflow: hidden;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.8);
        }
        .jce-xpbar-fill {
          height: 100%;
          background: linear-gradient(90deg, #ffd633, #ff9d00);
          transition: width 0.4s ease;
        }

        .jce-resources { display: flex; flex-direction: column; gap: 6px; }
        .jce-resource {
          display: flex; align-items: center; gap: 8px;
          background: linear-gradient(180deg, #1f2127 0%, #0d0e12 100%);
          border: 1px solid #000;
          border-radius: 8px;
          padding: 4px 12px 4px 4px;
          box-shadow: 0 2px 0 rgba(0,0,0,0.5);
          min-width: 140px;
        }
        .jce-res-icon {
          width: 26px; height: 26px;
          border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px;
        }
        .jce-res-icon.money { background: linear-gradient(135deg, #66bb6a, #2e7d32); }
        .jce-res-icon.scrap { background: linear-gradient(135deg, #ffb74d, #e65100); }
        .jce-res-value { font-weight: 800; font-size: 14px; }

        .jce-topright { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
        .jce-stats-row { display: flex; gap: 8px; }
        .jce-stat {
          display: flex; align-items: center; gap: 6px;
          background: linear-gradient(180deg, #1f2127, #0d0e12);
          border: 1px solid #000;
          border-radius: 8px;
          padding: 6px 12px;
          box-shadow: 0 2px 0 rgba(0,0,0,0.5);
          font-size: 13px; font-weight: 700;
        }
        .jce-stat-icon { font-size: 15px; }
        .jce-stat.rating { color: #ffd633; }
        .jce-stars { letter-spacing: -1px; }
        .jce-settings {
          width: 38px; height: 38px;
          background: linear-gradient(180deg, #2a2d34, #181a1f);
          border: 1px solid #000;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px;
          cursor: pointer;
          box-shadow: 0 2px 0 rgba(0,0,0,0.5);
        }

        /* ===== MAP ===== */
        .jce-map {
          position: relative;
          width: 100%;
          height: 100vh;
          background: #0c0d10;
        }
        .jce-map-img {
          width: 100%; height: 100%;
          object-fit: cover;
          display: block;
        }

        /* ===== ZONE SIGNS ===== */
        .jce-zone {
          position: absolute;
          transform: translate(-50%, -50%);
          background: linear-gradient(180deg, #1a1d22 0%, #0a0c10 100%);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 8px;
          padding: 8px 12px;
          min-width: 150px;
          text-align: center;
          box-shadow: 0 4px 0 rgba(0,0,0,0.6), 0 6px 20px rgba(0,0,0,0.5);
          cursor: pointer;
          z-index: 5;
          transition: transform 0.12s ease;
        }
        .jce-zone:active { transform: translate(-50%, -50%) scale(0.95); }
        .jce-zone-title {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.5px;
          color: #fff;
          line-height: 1.1;
          display: flex; align-items: center; justify-content: center; gap: 5px;
        }
        .jce-zone-status {
          font-size: 10px;
          color: #ffd633;
          margin-top: 3px;
          line-height: 1.1;
        }
        .jce-zone-status.muted { color: #9aa0a8; }
        .jce-zone.unlocked {
          background: linear-gradient(180deg, #2a7a3a 0%, #1b4a25 100%);
          border-color: #4ade80;
          box-shadow: 0 4px 0 #0a3818, 0 6px 24px rgba(74,222,128,0.4);
          animation: jcePulseGlow 2.4s ease-in-out infinite;
        }
        .jce-zone.unlocked .jce-zone-status { color: #c8ffd0; }
        /* Tier upgrades: stronger glow + gold/diamond accents */
        .jce-zone.tier-2 { border-color: #60d8ff; box-shadow: 0 4px 0 #08384d, 0 6px 28px rgba(96,216,255,0.55); }
        .jce-zone.tier-3 { border-color: #c084fc; box-shadow: 0 4px 0 #3b1a5e, 0 6px 32px rgba(192,132,252,0.6); background: linear-gradient(180deg, #5b2a8a 0%, #2a1242 100%); }
        .jce-zone.tier-4 { border-color: #ffb84d; box-shadow: 0 4px 0 #5c3000, 0 6px 36px rgba(255,184,77,0.7); background: linear-gradient(180deg, #8a5a1a 0%, #4a2d05 100%); }
        .jce-zone.tier-5 {
          border-color: #ffd633;
          box-shadow: 0 4px 0 #5c3000, 0 0 40px rgba(255,214,51,0.95), 0 0 60px rgba(255,100,200,0.4);
          background: linear-gradient(180deg, #ffd633 0%, #c79100 100%);
          color: #1a1d22;
        }
        .jce-zone.tier-5 .jce-zone-title, .jce-zone.tier-5 .jce-zone-status { color: #1a1d22; text-shadow: 0 1px 0 rgba(255,255,255,0.4); }
        .jce-tier-badge {
          position: absolute;
          top: -10px; right: -10px;
          background: linear-gradient(135deg, #ffd633, #ff9500);
          color: #1a1d22;
          font-size: 10px; font-weight: 900;
          border-radius: 10px;
          padding: 2px 7px;
          border: 2px solid #1a1d22;
          box-shadow: 0 2px 4px rgba(0,0,0,0.6);
          letter-spacing: 0.5px;
        }
        .jce-zone.flash {
          animation: jceFlash 0.6s ease-out;
        }
        @keyframes jcePulseGlow {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.15); }
        }
        @keyframes jceFlash {
          0% { transform: translate(-50%, -50%) scale(1); }
          30% { transform: translate(-50%, -50%) scale(1.15); filter: brightness(1.6); }
          100% { transform: translate(-50%, -50%) scale(1); filter: brightness(1); }
        }
        /* ===== TRAFFIC ===== */
        .jce-traffic {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          pointer-events: none;
          z-index: 3;
        }
        .jce-traffic .car {
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.7));
        }
        .jce-coin-pop {
          position: absolute;
          left: 50%; top: -10px;
          transform: translateX(-50%);
          font-size: 18px; font-weight: 900;
          color: #ffd633;
          text-shadow: 0 2px 0 #000, 0 0 12px rgba(255,214,51,0.8);
          animation: jceCoinUp 0.9s ease-out forwards;
          pointer-events: none;
        }
        @keyframes jceCoinUp {
          0% { transform: translate(-50%, 0); opacity: 1; }
          100% { transform: translate(-50%, -40px); opacity: 0; }
        }

        /* ===== TOAST ===== */
        .jce-toast {
          position: fixed;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0,0,0,0.85);
          color: #fff;
          padding: 14px 24px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 15px;
          border: 1px solid rgba(255,255,255,0.2);
          z-index: 100;
          animation: jceToast 1.6s ease-out forwards;
          pointer-events: none;
        }
        @keyframes jceToast {
          0% { opacity: 0; transform: translate(-50%, -40%) scale(0.9); }
          15%, 80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -60%) scale(0.95); }
        }

        /* ===== BOTTOM TOOLBAR ===== */
        .jce-toolbar {
          position: absolute;
          left: 0; right: 0; bottom: 0;
          display: flex;
          gap: 6px;
          padding: 8px 8px calc(8px + env(safe-area-inset-bottom));
          background: linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.4));
          z-index: 20;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .jce-toolbar::-webkit-scrollbar { display: none; }
        .jce-tool {
          flex: 1;
          min-width: 90px;
          display: flex; align-items: center; gap: 6px;
          background: linear-gradient(180deg, #2a2d34, #14161a);
          border: 1px solid #000;
          border-radius: 10px;
          padding: 8px 10px;
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.3px;
          cursor: pointer;
          position: relative;
          box-shadow: 0 2px 0 rgba(0,0,0,0.6);
          transition: transform 0.1s ease;
        }
        .jce-tool:active { transform: translateY(2px); box-shadow: 0 0 0 rgba(0,0,0,0.6); }
        .jce-tool-icon {
          font-size: 18px;
          width: 24px;
          text-align: center;
        }
        .jce-tool-label { white-space: nowrap; }
        .jce-tool-badge {
          position: absolute;
          top: -4px; right: -4px;
          background: #e53935;
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          min-width: 18px; height: 18px;
          border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid #0c0d10;
        }

        @media (max-width: 600px) {
          .jce-profile { min-width: 150px; }
          .jce-resource { min-width: 110px; }
          .jce-zone { min-width: 110px; padding: 6px 8px; }
          .jce-zone-title { font-size: 10px; }
          .jce-zone-status { font-size: 9px; }
          .jce-tool-label { display: none; }
          .jce-tool { min-width: 0; padding: 10px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .jce-zone.unlocked, .jce-coin-pop, .jce-toast { animation: none !important; }
        }
      `}</style>

      <div className="jce-map">
        <img src={citymap} alt="Vue aérienne de Junky City" className="jce-map-img" />

        {/* Animated traffic following roads */}
        <svg
          className="jce-traffic"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            {ROADS.map((r, i) => (
              <path key={`road-${i}`} id={`road-${i}`} d={r.d} />
            ))}
          </defs>
          {ROADS.flatMap((r, i) => {
            const colors = ["#e53935", "#1e88e5", "#fdd835", "#43a047", "#fff", "#212121"];
            const count = 3;
            return Array.from({ length: count }).map((_, k) => {
              const color = colors[(i * count + k) % colors.length];
              const begin = `${(k / count) * r.dur}s`;
              return (
                <g key={`car-${i}-${k}`} className="car">
                  {/* car body */}
                  <rect x="-1.6" y="-0.8" width="3.2" height="1.6" rx="0.35" fill={color} />
                  <rect x="-0.6" y="-0.55" width="1.6" height="1.1" rx="0.2" fill="rgba(180,220,255,0.85)" />
                  <animateMotion
                    dur={`${r.dur}s`}
                    begin={begin}
                    repeatCount="indefinite"
                    rotate="auto"
                  >
                    <mpath href={`#road-${i}`} />
                  </animateMotion>
                </g>
              );
            });
          })}
        </svg>


        <header className="jce-topbar">
          <div className="jce-profile-block">
            <div className="jce-profile">
              <div className="jce-avatar">
                <img src={sharky} alt="Sharky" />
              </div>
              <div className="jce-profile-info">
                <div className="jce-name">SHARKY</div>
                <div className="jce-level">Niveau {niveau}</div>
                <div className="jce-xpbar">
                  <div className="jce-xpbar-fill" style={{ width: `${xp}%` }} />
                </div>
              </div>
            </div>
            <div className="jce-resources">
              <div className="jce-resource">
                <div className="jce-res-icon money">💵</div>
                <div className="jce-res-value">{formatNum(argent)} $</div>
              </div>
              <div className="jce-resource">
                <div className="jce-res-icon scrap">📦</div>
                <div className="jce-res-value">{formatNum(ferraille)}</div>
              </div>
            </div>
          </div>

          <div className="jce-topright">
            <div className="jce-stats-row">
              <div className="jce-stat">
                <span className="jce-stat-icon">🔧</span>
                <span>32/32</span>
              </div>
              <div className="jce-stat">
                <span className="jce-stat-icon">🚛</span>
                <span>8/12</span>
              </div>
              <div className="jce-stat rating">
                <span className="jce-stars">★★★★</span>
                <span>4.2</span>
              </div>
              <div className="jce-settings" role="button" aria-label="Paramètres">⚙</div>
            </div>
          </div>
        </header>

        {ZONES.map((z) => {
          const locked = !!z.unlock && z.unlock > niveau;
          const unlocked = !!z.reward && !locked;
          const tier = unlocked ? tierFor(niveau, z.unlock ?? 1) : 0;
          const gain = unlocked && z.reward ? z.reward * tier : 0;
          const scrapGain = unlocked && z.scrap ? z.scrap * tier : 0;
          return (
            <button
              key={z.id}
              className={`jce-zone ${unlocked ? "unlocked" : ""} ${tier ? `tier-${tier}` : ""} ${flash === z.id ? "flash" : ""}`}
              style={{ top: z.top, left: z.left }}
              onClick={() => accepter(z)}
            >
              {unlocked && tier > 0 && (
                <div className="jce-tier-badge">
                  {"★".repeat(tier)} N{tier}
                </div>
              )}
              <div className="jce-zone-title">
                {locked && <span>🔒</span>}
                {z.name}
              </div>
              <div className={`jce-zone-status ${unlocked ? "" : "muted"}`}>
                {unlocked
                  ? `+${gain.toLocaleString("fr-FR")} $ • +${scrapGain}`
                  : z.unlock
                  ? `Débloqué au niveau ${z.unlock}`
                  : z.status}
              </div>
              {flash === z.id && unlocked && (
                <div className="jce-coin-pop">+{gain.toLocaleString("fr-FR")}$</div>
              )}
            </button>
          );
        })}


        {toast && <div className="jce-toast">{toast}</div>}

        <nav className="jce-toolbar">
          {TOOLBAR.map((t) => (
            <button
              key={t.id}
              className="jce-tool"
              onClick={() => {
                setToast(`${t.label} — bientôt`);
                setTimeout(() => setToast(null), 1200);
              }}
            >
              <span className="jce-tool-icon">{t.icon}</span>
              <span className="jce-tool-label">{t.label}</span>
              {t.badge && <span className="jce-tool-badge">{t.badge}</span>}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
