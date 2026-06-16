import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
  unlock: number;
  top: string;
  left: string;
  coutAchat: number;
  clicsTotalRequis: number;
  gainParSeconde: number;
  scrapParSeconde?: number;
};

const ZONES: Zone[] = [
  { id: "casse", name: "VOTRE CASSE", unlock: 1, top: "62%", left: "16%", coutAchat: 0, clicsTotalRequis: 5, gainParSeconde: 25, scrapParSeconde: 1 },
  { id: "garage", name: "GARAGE EXPRESS", unlock: 5, top: "62%", left: "84%", coutAchat: 1500, clicsTotalRequis: 10, gainParSeconde: 60, scrapParSeconde: 1 },
  { id: "carwash", name: "CAR WASH", unlock: 10, top: "82%", left: "20%", coutAchat: 4000, clicsTotalRequis: 12, gainParSeconde: 120, scrapParSeconde: 2 },
  { id: "concession", name: "CONCESSION PREMIUM", unlock: 20, top: "30%", left: "68%", coutAchat: 12000, clicsTotalRequis: 15, gainParSeconde: 280, scrapParSeconde: 3 },
  { id: "casino", name: "CASINO", unlock: 30, top: "30%", left: "32%", coutAchat: 35000, clicsTotalRequis: 20, gainParSeconde: 650, scrapParSeconde: 4 },
  { id: "centre", name: "CENTRE COMMERCIAL", unlock: 40, top: "50%", left: "48%", coutAchat: 80000, clicsTotalRequis: 25, gainParSeconde: 1200, scrapParSeconde: 6 },
  { id: "ville", name: "VILLE ABANDONNÉE", unlock: 50, top: "58%", left: "84%", coutAchat: 180000, clicsTotalRequis: 30, gainParSeconde: 2400, scrapParSeconde: 10 },
  { id: "construction", name: "ZONE EN CONSTRUCTION", unlock: 55, top: "82%", left: "55%", coutAchat: 300000, clicsTotalRequis: 35, gainParSeconde: 4000, scrapParSeconde: 14 },
  { id: "international", name: "CASSE INTERNATIONALE", unlock: 60, top: "82%", left: "82%", coutAchat: 500000, clicsTotalRequis: 40, gainParSeconde: 7500, scrapParSeconde: 20 },
];


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

type ZoneState = {
  estAchete: boolean;
  estFini: boolean;
  clicsEnregistres: number;
};

function JunkyCityEmpire() {
  const [argent, setArgent] = useState(125750);
  const [ferraille, setFerraille] = useState(320);
  const [niveau, setNiveau] = useState(18);
  const [xp, setXp] = useState(45);
  const [flash, setFlash] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [popups, setPopups] = useState<{ id: number; zoneId: string; text: string }[]>([]);
  const popupId = useRef(0);

  const [states, setStates] = useState<Record<string, ZoneState>>(() => {
    const init: Record<string, ZoneState> = {};
    ZONES.forEach((z) => {
      init[z.id] = { estAchete: z.coutAchat === 0, estFini: false, clicsEnregistres: 0 };
    });
    return init;
  });

  const formatNum = (n: number) => n.toLocaleString("fr-FR");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  };

  const popCoin = (zoneId: string, text: string) => {
    const id = ++popupId.current;
    setPopups((p) => [...p, { id, zoneId, text }]);
    setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 900);
  };

  // Génération passive: chaque bâtiment fini produit gainParSeconde * tier chaque seconde
  useEffect(() => {
    const interval = setInterval(() => {
      let totalGain = 0;
      let totalScrap = 0;
      ZONES.forEach((z) => {
        const st = states[z.id];
        if (st?.estFini) {
          const tier = tierFor(niveau, z.unlock);
          totalGain += z.gainParSeconde * tier;
          totalScrap += (z.scrapParSeconde ?? 0) * tier;
        }
      });
      if (totalGain > 0) setArgent((m) => m + totalGain);
      if (totalScrap > 0) setFerraille((f) => f + totalScrap);
    }, 1000);
    return () => clearInterval(interval);
  }, [states, niveau]);

  // Clic sur un bâtiment — porte la logique de ConstructionNative.GestionClicBatiment
  const gestionClicBatiment = (z: Zone) => {
    if (z.unlock > niveau) {
      showToast(`🔒 Débloqué au niveau ${z.unlock}`);
      return;
    }
    const st = states[z.id];

    // 1. Achat
    if (!st.estAchete) {
      if (argent < z.coutAchat) {
        showToast(`💸 Il manque ${formatNum(z.coutAchat - argent)} $`);
        return;
      }
      setArgent((m) => m - z.coutAchat);
      setStates((s) => ({ ...s, [z.id]: { ...s[z.id], estAchete: true, clicsEnregistres: 0 } }));
      showToast(`🛒 ${z.name} acheté !`);
      setFlash(z.id);
      setTimeout(() => setFlash(null), 600);
      return;
    }

    // 3. Déjà fini → tap = bonus rapide
    if (st.estFini) {
      const tier = tierFor(niveau, z.unlock);
      const bonus = z.gainParSeconde * tier * 2;
      setArgent((m) => m + bonus);
      popCoin(z.id, `+${formatNum(bonus)}$`);
      setFlash(z.id);
      setTimeout(() => setFlash(null), 400);
      setXp((x) => {
        const nx = x + 2;
        if (nx >= 100) { setNiveau((n) => n + 1); return nx - 100; }
        return nx;
      });
      return;
    }

    // 2. Construction en cours : un clic = un brick
    setStates((s) => {
      const cur = s[z.id];
      const clics = cur.clicsEnregistres + 1;
      const fini = clics >= z.clicsTotalRequis;
      if (fini) {
        showToast(`🏗️ ${z.name} construit !`);
        setXp((x) => {
          const nx = x + 25;
          if (nx >= 100) { setNiveau((n) => n + 1); return nx - 100; }
          return nx;
        });
      }
      return { ...s, [z.id]: { ...cur, clicsEnregistres: clics, estFini: fini } };
    });
    popCoin(z.id, "🔨");
    setFlash(z.id);
    setTimeout(() => setFlash(null), 200);
  };

  return (
    <div className="jce-root">
      <style>{`
        * { box-sizing: border-box; }
        html, body, #root { margin: 0; padding: 0; background: #1a1d22; }
        .jce-root {
          position: relative; min-height: 100vh; width: 100%;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #fff; overflow: hidden; background: #0c0d10;
        }

        .jce-topbar {
          position: absolute; top: 0; left: 0; right: 0;
          display: flex; justify-content: space-between; align-items: flex-start;
          padding: 12px 14px; z-index: 20; pointer-events: none;
        }
        .jce-topbar > * { pointer-events: auto; }
        .jce-profile-block { display: flex; flex-direction: column; gap: 8px; }
        .jce-profile {
          display: flex; align-items: center; gap: 10px;
          background: linear-gradient(180deg, #2a2d34 0%, #181a1f 100%);
          border: 1px solid #000; border-radius: 10px;
          padding: 6px 14px 6px 6px;
          box-shadow: 0 3px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);
          min-width: 180px;
        }
        .jce-avatar {
          width: 46px; height: 46px;
          background: linear-gradient(135deg, #2196f3, #0d47a1);
          border-radius: 8px; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid #ffd633;
        }
        .jce-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .jce-profile-info { flex: 1; }
        .jce-name { font-size: 15px; font-weight: 900; letter-spacing: 1px; line-height: 1; }
        .jce-level { font-size: 11px; color: #b0b4ba; margin-top: 2px; line-height: 1; }
        .jce-xpbar {
          margin-top: 4px; height: 5px; background: #000;
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
          border: 1px solid #000; border-radius: 8px;
          padding: 4px 12px 4px 4px;
          box-shadow: 0 2px 0 rgba(0,0,0,0.5);
          min-width: 140px;
        }
        .jce-res-icon {
          width: 26px; height: 26px; border-radius: 6px;
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
          border: 1px solid #000; border-radius: 8px;
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
          border: 1px solid #000; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; cursor: pointer;
          box-shadow: 0 2px 0 rgba(0,0,0,0.5);
        }

        .jce-map { position: relative; width: 100%; height: 100vh; background: #0c0d10; }
        .jce-map-img { width: 100%; height: 100%; object-fit: cover; display: block; }

        .jce-zone {
          position: absolute;
          transform: translate(-50%, -50%);
          background: linear-gradient(180deg, #1a1d22 0%, #0a0c10 100%);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 8px;
          padding: 8px 12px;
          min-width: 160px;
          text-align: center;
          box-shadow: 0 4px 0 rgba(0,0,0,0.6), 0 6px 20px rgba(0,0,0,0.5);
          cursor: pointer; z-index: 5;
          transition: transform 0.1s ease;
          user-select: none;
        }
        .jce-zone:active, .jce-zone.flash {
          transform: translate(-50%, -50%) scale(0.95);
        }
        .jce-zone-title {
          font-size: 12px; font-weight: 900;
          letter-spacing: 0.5px; color: #fff; line-height: 1.1;
          display: flex; align-items: center; justify-content: center; gap: 5px;
        }
        .jce-zone-status {
          font-size: 10px; color: #ffd633;
          margin-top: 3px; line-height: 1.2;
        }
        .jce-zone-status.muted { color: #9aa0a8; }
        .jce-zone-status.cost { color: #66ff99; font-weight: 800; }

        .jce-progress-wrap {
          margin-top: 5px; height: 6px; background: rgba(0,0,0,0.6);
          border-radius: 3px; overflow: hidden;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .jce-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #ffd633, #ff9d00);
          transition: width 0.2s ease;
        }

        .jce-zone.fini {
          background: linear-gradient(180deg, #2a7a3a 0%, #1b4a25 100%);
          border-color: #4ade80;
          box-shadow: 0 4px 0 #0a3818, 0 6px 24px rgba(74,222,128,0.4);
          animation: jcePulseGlow 2.4s ease-in-out infinite;
        }
        .jce-zone.fini .jce-zone-status { color: #c8ffd0; }
        .jce-zone.tier-2.fini { border-color: #60d8ff; box-shadow: 0 4px 0 #08384d, 0 6px 28px rgba(96,216,255,0.55); }
        .jce-zone.tier-3.fini { border-color: #c084fc; box-shadow: 0 4px 0 #3b1a5e, 0 6px 32px rgba(192,132,252,0.6); background: linear-gradient(180deg, #5b2a8a 0%, #2a1242 100%); }
        .jce-zone.tier-4.fini { border-color: #ffb84d; box-shadow: 0 4px 0 #5c3000, 0 6px 36px rgba(255,184,77,0.7); background: linear-gradient(180deg, #8a5a1a 0%, #4a2d05 100%); }
        .jce-zone.tier-5.fini {
          border-color: #ffd633;
          box-shadow: 0 4px 0 #5c3000, 0 0 40px rgba(255,214,51,0.95), 0 0 60px rgba(255,100,200,0.4);
          background: linear-gradient(180deg, #ffd633 0%, #c79100 100%);
          color: #1a1d22;
        }
        .jce-zone.tier-5.fini .jce-zone-title,
        .jce-zone.tier-5.fini .jce-zone-status { color: #1a1d22; text-shadow: 0 1px 0 rgba(255,255,255,0.4); }
        .jce-tier-badge {
          position: absolute; top: -10px; right: -10px;
          background: linear-gradient(135deg, #ffd633, #ff9500);
          color: #1a1d22; font-size: 10px; font-weight: 900;
          border-radius: 10px; padding: 2px 7px;
          border: 2px solid #1a1d22;
          box-shadow: 0 2px 4px rgba(0,0,0,0.6);
          letter-spacing: 0.5px;
        }
        .jce-zone.chantier {
          background: linear-gradient(180deg, #8a5a1a 0%, #4a2d05 100%);
          border-color: #ffb84d;
          animation: jceChantier 1.2s ease-in-out infinite;
        }
        @keyframes jceChantier {
          0%, 100% { box-shadow: 0 4px 0 #5c3000, 0 0 12px rgba(255,184,77,0.4); }
          50% { box-shadow: 0 4px 0 #5c3000, 0 0 24px rgba(255,184,77,0.9); }
        }
        @keyframes jcePulseGlow {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.15); }
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
          white-space: nowrap;
        }
        @keyframes jceCoinUp {
          0% { transform: translate(-50%, 0); opacity: 1; }
          100% { transform: translate(-50%, -40px); opacity: 0; }
        }

        .jce-toast {
          position: fixed; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0,0,0,0.85); color: #fff;
          padding: 14px 24px; border-radius: 12px;
          font-weight: 700; font-size: 15px;
          border: 1px solid rgba(255,255,255,0.2);
          z-index: 100; pointer-events: none;
          animation: jceToast 1.6s ease-out forwards;
        }
        @keyframes jceToast {
          0% { opacity: 0; transform: translate(-50%, -40%) scale(0.9); }
          15%, 80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -60%) scale(0.95); }
        }

        .jce-toolbar {
          position: absolute; left: 0; right: 0; bottom: 0;
          display: flex; gap: 6px;
          padding: 8px 8px calc(8px + env(safe-area-inset-bottom));
          background: linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.4));
          z-index: 20; overflow-x: auto; scrollbar-width: none;
        }
        .jce-toolbar::-webkit-scrollbar { display: none; }
        .jce-tool {
          flex: 1; min-width: 90px;
          display: flex; align-items: center; gap: 6px;
          background: linear-gradient(180deg, #2a2d34, #14161a);
          border: 1px solid #000; border-radius: 10px;
          padding: 8px 10px; color: #fff;
          font-size: 11px; font-weight: 800; letter-spacing: 0.3px;
          cursor: pointer; position: relative;
          box-shadow: 0 2px 0 rgba(0,0,0,0.6);
          transition: transform 0.1s ease;
        }
        .jce-tool:active { transform: translateY(2px); box-shadow: 0 0 0 rgba(0,0,0,0.6); }
        .jce-tool-icon { font-size: 18px; width: 24px; text-align: center; }
        .jce-tool-label { white-space: nowrap; }
        .jce-tool-badge {
          position: absolute; top: -4px; right: -4px;
          background: #e53935; color: #fff;
          font-size: 10px; font-weight: 900;
          min-width: 18px; height: 18px; border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid #0c0d10;
        }

        @media (max-width: 600px) {
          .jce-profile { min-width: 150px; }
          .jce-resource { min-width: 110px; }
          .jce-zone { min-width: 120px; padding: 6px 8px; }
          .jce-zone-title { font-size: 10px; }
          .jce-zone-status { font-size: 9px; }
          .jce-tool-label { display: none; }
          .jce-tool { min-width: 0; padding: 10px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .jce-zone.fini, .jce-zone.chantier, .jce-coin-pop, .jce-toast { animation: none !important; }
        }
      `}</style>

      <div className="jce-map">
        <img src={citymap} alt="Vue aérienne de Junky City" className="jce-map-img" />


        <header className="jce-topbar">
          <div className="jce-profile-block">
            <div className="jce-profile">
              <div className="jce-avatar"><img src={sharky} alt="Sharky" /></div>
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
              <div className="jce-stat"><span className="jce-stat-icon">🔧</span><span>32/32</span></div>
              <div className="jce-stat"><span className="jce-stat-icon">🚛</span><span>8/12</span></div>
              <div className="jce-stat rating"><span className="jce-stars">★★★★</span><span>4.2</span></div>
              <div className="jce-settings" role="button" aria-label="Paramètres">⚙</div>
            </div>
          </div>
        </header>

        {ZONES.map((z) => {
          const st = states[z.id];
          const locked = z.unlock > niveau;
          const tier = st.estFini ? tierFor(niveau, z.unlock) : 0;
          const fillPct = !st.estAchete ? 0 : st.estFini ? 100 : (st.clicsEnregistres / z.clicsTotalRequis) * 100;

          let stateClass = "";
          if (st.estFini) stateClass = "fini";
          else if (st.estAchete) stateClass = "chantier";

          let statusContent;
          if (locked) {
            statusContent = <div className="jce-zone-status muted">🔒 Niveau {z.unlock}</div>;
          } else if (!st.estAchete) {
            statusContent = <div className="jce-zone-status cost">Débloquer : {formatNum(z.coutAchat)} $</div>;
          } else if (!st.estFini) {
            statusContent = <div className="jce-zone-status">Construction... {st.clicsEnregistres} / {z.clicsTotalRequis}</div>;
          } else {
            const tg = z.gainParSeconde * tier;
            statusContent = <div className="jce-zone-status">+ {formatNum(tg)} $/s</div>;
          }

          return (
            <button
              key={z.id}
              className={`jce-zone ${stateClass} ${tier ? `tier-${tier}` : ""} ${flash === z.id ? "flash" : ""}`}
              style={{ top: z.top, left: z.left }}
              onClick={() => gestionClicBatiment(z)}
            >
              {st.estFini && tier > 0 && (
                <div className="jce-tier-badge">{"★".repeat(tier)} N{tier}</div>
              )}
              <div className="jce-zone-title">{locked && <span>🔒</span>}{z.name}</div>
              {statusContent}
              {(st.estAchete && !st.estFini) && (
                <div className="jce-progress-wrap">
                  <div className="jce-progress-fill" style={{ width: `${fillPct}%` }} />
                </div>
              )}
              {popups.filter((p) => p.zoneId === z.id).map((p) => (
                <div key={p.id} className="jce-coin-pop">{p.text}</div>
              ))}
            </button>
          );
        })}

        {toast && <div className="jce-toast">{toast}</div>}

        <nav className="jce-toolbar">
          {TOOLBAR.map((t) => (
            <button
              key={t.id}
              className="jce-tool"
              onClick={() => showToast(`${t.label} — bientôt`)}
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
