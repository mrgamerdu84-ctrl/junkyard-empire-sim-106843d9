import { useState } from "react";
import tutorAsset from "@/assets/tutor-driver.png.asset.json";
import { markTutorialSeen } from "@/lib/leaderboard";

const STEPS = [
  {
    title: "Salut, chauffeur !",
    text: "Bienvenue dans Junky City Empire ! Je suis Léo, vétéran du volant. Je vais te montrer les ficelles du métier en deux minutes.",
  },
  {
    title: "Prendre un client",
    text: "Les clients t'attendent sur les trottoirs (icône 🧍). Conduis ton taxi jusqu'à eux pour les charger automatiquement.",
  },
  {
    title: "Déposer & encaisser",
    text: "Une fois chargé, file vers la destination indiquée par la flèche. Plus tu vas vite, plus tu gagnes !",
  },
  {
    title: "Carburant",
    text: "Garde un œil sur ta jauge ⛽. Repasse à la station-service avant la panne sèche, sinon ton taxi s'arrête.",
  },
  {
    title: "La concurrence",
    text: "Attention : une compagnie rivale (taxis sombres) tente de te piquer les courses. Sois plus rapide qu'eux !",
  },
  {
    title: "Récompense hebdomadaire",
    text: "Chaque dimanche soir, le meilleur jour de la semaine débloque le TAXI D'OR 🏆 — bonus tarif +50% et conso -30%. À toi de jouer !",
  },
];

export default function TutorialDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  const next = () => {
    if (last) {
      markTutorialSeen();
      onClose();
    } else {
      setStep(step + 1);
    }
  };

  const skip = () => {
    markTutorialSeen();
    onClose();
  };

  return (
    <div className="td-root">
      <style>{`
        .td-root { position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; padding: 20px; font-family: system-ui, sans-serif; }
        .td-card { background: linear-gradient(180deg, #1f2937 0%, #111827 100%); border: 2px solid #f5c542; border-radius: 16px; max-width: 480px; width: 100%; padding: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.7); }
        .td-head { display: flex; gap: 14px; align-items: center; margin-bottom: 14px; }
        .td-avatar { width: 80px; height: 80px; border-radius: 50%; border: 3px solid #f5c542; background: #fff; flex-shrink: 0; object-fit: cover; }
        .td-title { color: #f5c542; font-size: 20px; font-weight: 900; margin: 0; }
        .td-step { color: #9ca3af; font-size: 12px; }
        .td-text { color: #e5e7eb; font-size: 15px; line-height: 1.5; min-height: 90px; }
        .td-dots { display: flex; gap: 6px; justify-content: center; margin: 16px 0 14px; }
        .td-dot { width: 8px; height: 8px; border-radius: 50%; background: #374151; }
        .td-dot.active { background: #f5c542; }
        .td-btns { display: flex; gap: 10px; }
        .td-btn { flex: 1; padding: 12px; border-radius: 10px; border: none; font-weight: 700; cursor: pointer; font-size: 15px; }
        .td-btn.skip { background: #374151; color: #d1d5db; }
        .td-btn.next { background: linear-gradient(180deg, #f5c542, #e0a92a); color: #1a1208; box-shadow: 0 3px 0 #8a6510; }
        .td-btn.next:active { transform: translateY(2px); box-shadow: 0 1px 0 #8a6510; }
      `}</style>
      <div className="td-card">
        <div className="td-head">
          <img src={tutorAsset.url} alt="Léo" className="td-avatar" />
          <div>
            <h2 className="td-title">{s.title}</h2>
            <div className="td-step">Étape {step + 1} / {STEPS.length}</div>
          </div>
        </div>
        <div className="td-text">{s.text}</div>
        <div className="td-dots">
          {STEPS.map((_, i) => (
            <div key={i} className={`td-dot ${i === step ? "active" : ""}`} />
          ))}
        </div>
        <div className="td-btns">
          {!last && <button className="td-btn skip" onClick={skip}>Passer</button>}
          <button className="td-btn next" onClick={next}>{last ? "Commencer ▶" : "Suivant →"}</button>
        </div>
      </div>
    </div>
  );
}
