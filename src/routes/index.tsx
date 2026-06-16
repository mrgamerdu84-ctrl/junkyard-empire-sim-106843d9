import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import sharky from "@/assets/sharky.png";
import citymap from "@/assets/citymap.jpg";
import City3D from "@/game/City3D";



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

        .jce-map { position: relative; width: 100%; height: 100vh; background: #0c0d10; overflow: hidden; }
        .jce-map-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; z-index: 1; }
        .jce-night-tint { position: absolute; inset: 0; z-index: 2; pointer-events: none; mix-blend-mode: multiply; transition: background 1s ease; }


        /* === ENSEIGNES (Premium Glass Tycoon) === */
        .jce-zone {
          position: absolute;
          transform: translate(-50%, -50%);
          background: rgba(15, 17, 22, 0.72);
          backdrop-filter: blur(10px) saturate(140%);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 12px;
          padding: 9px 14px;
          min-width: 160px;
          text-align: center;
          box-shadow: 0 12px 28px -10px rgba(0,0,0,0.7), 0 2px 0 rgba(0,0,0,0.5);
          cursor: pointer; z-index: 5;
          transition: transform 0.12s ease, box-shadow 0.2s ease;
          user-select: none;
          color: #fff;
        }
        .jce-zone::before {
          content: "";
          position: absolute; inset: -2px;
          border-radius: 14px;
          background: rgba(255,255,255,0.04);
          filter: blur(6px);
          z-index: -1;
          transition: background 0.25s ease;
        }
        .jce-zone:active, .jce-zone.flash {
          transform: translate(-50%, -50%) scale(0.95);
        }
        .jce-zone-title {
          font-size: 12px; font-weight: 900;
          letter-spacing: -0.2px; color: #fff; line-height: 1.1;
          text-transform: uppercase;
          display: flex; align-items: center; justify-content: center; gap: 5px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.6);
        }
        .jce-zone-status {
          font-size: 10px; color: #cbd0d8;
          margin-top: 4px; line-height: 1.2;
          font-weight: 600;
        }

        /* — Verrouillé — */
        .jce-zone.locked { background: rgba(0,0,0,0.55); }
        .jce-zone.locked .jce-zone-title { color: rgba(255,255,255,0.40); }
        .jce-zone.locked .jce-zone-status { color: rgba(255,255,255,0.45); }
        .jce-lock-tag {
          display: inline-flex; align-items: center; justify-content: center; gap: 4px;
          font-size: 9px; font-weight: 800; letter-spacing: 1.5px;
          color: rgba(255,255,255,0.55); text-transform: uppercase;
          margin-bottom: 3px; opacity: 0.75;
        }

        /* — Achetable (pill verte) — */
        .jce-zone.buyable { border-color: rgba(16,185,129,0.35); }
        .jce-zone.buyable::before { background: rgba(16,185,129,0.20); }
        .jce-cost-pill {
          display: inline-block;
          margin-top: 6px;
          padding: 3px 10px;
          background: rgba(16,185,129,0.12);
          border: 1px solid rgba(16,185,129,0.32);
          border-radius: 999px;
          font-size: 10px; font-weight: 900;
          color: #34d399; letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        /* — Chantier — */
        .jce-zone.chantier { border-color: rgba(245,158,11,0.35); }
        .jce-zone.chantier::before {
          background: rgba(245,158,11,0.22);
          animation: jceChantierHalo 1.6s ease-in-out infinite;
        }
        .jce-zone.chantier .jce-zone-status {
          color: #fbbf24; font-style: italic; font-weight: 800;
          letter-spacing: 0.4px; text-transform: uppercase; font-size: 9px;
        }
        @keyframes jceChantierHalo {
          0%,100% { filter: blur(6px); opacity: 0.7; }
          50% { filter: blur(10px); opacity: 1; }
        }

        /* Barre de progression — fine, intégrée */
        .jce-progress-wrap {
          margin-top: 7px; height: 5px;
          background: rgba(255,255,255,0.10);
          border-radius: 999px; overflow: hidden;
          border: none;
        }
        .jce-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #d97706, #fbbf24);
          box-shadow: 0 0 8px rgba(251,191,36,0.55);
          transition: width 0.2s ease;
        }

        /* — Fini : socle premium noir + liseré or — */
        .jce-zone.fini {
          background: linear-gradient(180deg, #27272a 0%, #000 100%);
          border: 1px solid rgba(180,130,40,0.35);
          border-top-color: rgba(253,224,150,0.55);
          border-bottom-color: rgba(80,50,10,0.9);
          box-shadow: 0 14px 34px -10px rgba(0,0,0,0.85), 0 2px 0 rgba(0,0,0,0.6);
          padding: 10px 18px;
        }
        .jce-zone.fini::before {
          background: linear-gradient(180deg, rgba(253,224,150,0.40) 0%, rgba(180,130,40,0.18) 50%, transparent 100%);
          filter: blur(10px);
          inset: -4px;
        }
        .jce-zone.fini::after {
          content: "";
          position: absolute; top: 0; left: 50%; transform: translateX(-50%);
          width: 50px; height: 1px;
          background: linear-gradient(90deg, transparent, #fde68a, transparent);
        }
        .jce-zone.fini .jce-zone-title {
          font-size: 13px; letter-spacing: -0.3px;
          gap: 6px;
        }
        .jce-zone.fini .jce-zone-status {
          color: rgba(251,191,36,0.85);
          font-size: 9px; font-weight: 800;
          letter-spacing: 1.5px; text-transform: uppercase;
          display: inline-flex; align-items: center; gap: 5px;
        }
        .jce-zone.fini .jce-zone-status::before {
          content: ""; width: 5px; height: 5px; border-radius: 50%;
          background: #34d399; box-shadow: 0 0 6px #34d399;
          animation: jceDotPulse 1.8s ease-in-out infinite;
        }
        @keyframes jceDotPulse {
          0%,100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        .jce-fini-star {
          color: #fbbf24; font-size: 12px;
          filter: drop-shadow(0 0 4px rgba(251,191,36,0.6));
        }

        /* Tier supérieurs : intensifient le halo */
        .jce-zone.tier-2.fini::before { background: linear-gradient(180deg, rgba(96,216,255,0.45), rgba(96,216,255,0.10) 60%, transparent); }
        .jce-zone.tier-2.fini { border-top-color: rgba(186,230,253,0.6); }
        .jce-zone.tier-3.fini::before { background: linear-gradient(180deg, rgba(192,132,252,0.5), rgba(192,132,252,0.15) 60%, transparent); }
        .jce-zone.tier-3.fini { border-top-color: rgba(216,180,254,0.6); }
        .jce-zone.tier-4.fini::before { background: linear-gradient(180deg, rgba(255,184,77,0.55), rgba(255,184,77,0.18) 60%, transparent); }
        .jce-zone.tier-5.fini::before {
          background: radial-gradient(ellipse at top, rgba(253,224,150,0.7), rgba(180,130,40,0.25) 50%, transparent 80%);
          animation: jceGoldGlow 2.6s ease-in-out infinite;
        }
        @keyframes jceGoldGlow {
          0%,100% { filter: blur(10px); opacity: 0.85; }
          50% { filter: blur(16px); opacity: 1; }
        }

        .jce-tier-badge {
          position: absolute; top: -10px; right: -10px;
          background: linear-gradient(135deg, #fde68a, #d97706);
          color: #1a1d22; font-size: 9px; font-weight: 900;
          border-radius: 999px; padding: 2px 8px;
          border: 2px solid #0a0c10;
          box-shadow: 0 4px 10px rgba(0,0,0,0.7), 0 0 12px rgba(251,191,36,0.5);
          letter-spacing: 0.5px;
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
        <img className="jce-map-img" src={citymap} alt="Carte Junky City Empire" />
        <City3D />
        {/* Enseignes Premium Glass posées sur la map */}
        {ZONES.map((z) => {
          const st = states[z.id];
          const locked = z.unlock > niveau;
          const tier = st.estFini ? tierFor(niveau, z.unlock) : 0;
          const fillPct = !st.estAchete ? 0 : st.estFini ? 100 : (st.clicsEnregistres / z.clicsTotalRequis) * 100;
          let stateClass = "";
          if (locked) stateClass = "locked";
          else if (st.estFini) stateClass = "fini";
          else if (st.estAchete) stateClass = "chantier";
          else stateClass = "buyable";
          return (
            <div
              key={z.id}
              className={`jce-zone ${stateClass} ${tier ? `tier-${tier}` : ""} ${flash === z.id ? "flash" : ""}`}
              style={{ top: z.top, left: z.left, zIndex: 6 }}
              onClick={() => gestionClicBatiment(z)}
            >
              {st.estFini && tier > 0 && (
                <div className="jce-tier-badge">{"★".repeat(tier)} N{tier}</div>
              )}
              {locked && <div className="jce-lock-tag">🔒 Verrouillé</div>}
              <div className="jce-zone-title">
                {st.estFini && <span className="jce-fini-star">★</span>}
                {z.name}
              </div>
              {locked && <div className="jce-zone-status">Niveau requis : {z.unlock}</div>}
              {!locked && !st.estAchete && (
                <div className="jce-cost-pill">Débloquer : {formatNum(z.coutAchat)} $</div>
              )}
              {!locked && st.estAchete && !st.estFini && (
                <>
                  <div className="jce-progress-wrap">
                    <div className="jce-progress-fill" style={{ width: `${fillPct}%` }} />
                  </div>
                  <div className="jce-zone-status">Construction... {st.clicsEnregistres} / {z.clicsTotalRequis}</div>
                </>
              )}
              {!locked && st.estFini && (
                <div className="jce-zone-status">Opérationnel · +{formatNum(z.gainParSeconde * tier)} $/s</div>
              )}
              {popups.filter((p) => p.zoneId === z.id).map((p) => (
                <div key={p.id} className="jce-coin-pop">{p.text}</div>
              ))}
            </div>
          );
        })}


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
