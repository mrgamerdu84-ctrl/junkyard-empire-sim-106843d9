import { useMemo } from "react";
import { getLast7Days, isSpecialTaxiUnlocked, getBestWeekScore, getTodayScore } from "@/lib/leaderboard";
import goldTaxi from "@/assets/taxi-gold.png.asset.json";

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");

export default function LeaderboardPanel({ onClose }: { onClose: () => void }) {
  const days = useMemo(() => getLast7Days(), []);
  const unlocked = isSpecialTaxiUnlocked();
  const best = getBestWeekScore();
  const todayScore = getTodayScore();

  // Tri par score décroissant pour le classement
  const ranked = [...days].sort((a, b) => b.score - a.score);

  return (
    <div className="lb-root">
      <style>{`
        .lb-root { position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; padding: 16px; font-family: system-ui, sans-serif; }
        .lb-card { background: linear-gradient(180deg, #1f2937 0%, #111827 100%); border: 2px solid #f5c542; border-radius: 16px; max-width: 460px; width: 100%; padding: 20px; max-height: 90vh; overflow-y: auto; }
        .lb-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .lb-title { color: #f5c542; font-size: 22px; font-weight: 900; margin: 0; }
        .lb-close { background: #374151; color: #fff; border: none; width: 32px; height: 32px; border-radius: 50%; font-size: 18px; cursor: pointer; }
        .lb-today { background: #064e3b; border: 1px solid #10b981; border-radius: 10px; padding: 12px; margin-bottom: 14px; text-align: center; }
        .lb-today-label { color: #6ee7b7; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
        .lb-today-val { color: #fff; font-size: 28px; font-weight: 900; margin-top: 4px; }
        .lb-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
        .lb-row { display: flex; align-items: center; gap: 10px; background: #1f2937; border: 1px solid #374151; padding: 10px 12px; border-radius: 8px; }
        .lb-row.gold { border-color: #f5c542; background: linear-gradient(90deg, #1f2937 0%, #3b2f0a 100%); }
        .lb-rank { font-size: 18px; font-weight: 900; color: #6b7280; width: 28px; text-align: center; }
        .lb-row.gold .lb-rank { color: #f5c542; }
        .lb-day { flex: 1; color: #e5e7eb; font-weight: 700; }
        .lb-date { color: #6b7280; font-size: 11px; margin-left: 6px; }
        .lb-score { color: #34d399; font-weight: 900; font-size: 16px; }
        .lb-trophy { background: linear-gradient(180deg, #f5c542, #b8860b); border-radius: 12px; padding: 16px; display: flex; gap: 14px; align-items: center; }
        .lb-trophy.locked { background: #1f2937; border: 2px dashed #4b5563; }
        .lb-trophy img { width: 90px; height: 90px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5)); }
        .lb-trophy.locked img { opacity: 0.25; filter: grayscale(1); }
        .lb-trophy-info h3 { margin: 0 0 4px; color: #1a1208; font-size: 16px; font-weight: 900; }
        .lb-trophy.locked .lb-trophy-info h3 { color: #d1d5db; }
        .lb-trophy-info p { margin: 0; color: #3b2f05; font-size: 12px; line-height: 1.4; }
        .lb-trophy.locked .lb-trophy-info p { color: #9ca3af; }
      `}</style>
      <div className="lb-card">
        <div className="lb-head">
          <h2 className="lb-title">🏆 Classement</h2>
          <button className="lb-close" onClick={onClose}>×</button>
        </div>

        <div className="lb-today">
          <div className="lb-today-label">Score du jour</div>
          <div className="lb-today-val">{fmt(todayScore)} $</div>
        </div>

        <div className="lb-list">
          {ranked.map((d, i) => (
            <div key={d.date} className={`lb-row ${i === 0 && d.score > 0 ? "gold" : ""}`}>
              <div className="lb-rank">{i + 1}</div>
              <div className="lb-day">{d.label}<span className="lb-date">{d.date.slice(5)}</span></div>
              <div className="lb-score">{fmt(d.score)} $</div>
            </div>
          ))}
        </div>

        <div className={`lb-trophy ${unlocked ? "" : "locked"}`}>
          <img src={goldTaxi.url} alt="Taxi d'Or" />
          <div className="lb-trophy-info">
            <h3>{unlocked ? "🏆 TAXI D'OR débloqué !" : "Taxi d'Or — verrouillé"}</h3>
            <p>{unlocked
              ? `Bravo ! Meilleur score : ${fmt(best)} $. Bonus actif : tarif +50%, conso -30%.`
              : "Termine premier de la semaine pour le débloquer. Bonus : tarif +50%, conso -30%."}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
