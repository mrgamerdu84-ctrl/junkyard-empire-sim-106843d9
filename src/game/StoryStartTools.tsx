import { useState } from "react";

const SAVE_KEY = "taxi-tycoon-v4";

const STORY_START_SAVE = {
  money: 250,
  customersServed: 0,
  totalEarned: 0,
  depotTier: 0,
  taxiSpeedLvl: 0,
  taxis: [{ colorId: "yellow" }],
  defaultColor: "yellow",
  jobsCompleted: 0,
  liveryId: "classic",
  hqCapacityLvl: 0,
  hqProductionLvl: 0,
  hqRevenueLvl: 0,
  cityFund: 0,
  playerTaxiColor: "blue",
  taxiWear: 35,
};

export default function StoryStartTools() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [done, setDone] = useState(false);

  const applyStoryStart = () => {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(STORY_START_SAVE));
      setDone(true);
      window.setTimeout(() => window.location.reload(), 700);
    } catch {
      setDone(false);
    }
  };

  return (
    <div
      data-no-pan
      style={{
        position: "fixed",
        left: 10,
        top: 54,
        zIndex: 9999,
        fontFamily: "system-ui, sans-serif",
        pointerEvents: "auto",
      }}
    >
      {!confirmOpen ? (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          title="Revenir au début histoire : 1 taxi, garage abandonné"
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid #7a5030",
            background: "rgba(20,16,12,0.9)",
            color: "#facc15",
            fontWeight: 900,
            fontSize: 12,
            boxShadow: "0 4px 12px rgba(0,0,0,0.45)",
            cursor: "pointer",
          }}
        >
          🏚️ Départ Histoire
        </button>
      ) : (
        <div
          style={{
            width: 240,
            padding: 10,
            borderRadius: 12,
            border: "1px solid #7a5030",
            background: "rgba(15,13,10,0.96)",
            color: "#f5e9c9",
            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
          }}
        >
          <div style={{ fontWeight: 900, color: "#facc15", marginBottom: 6 }}>🏚️ Départ Histoire</div>
          <div style={{ fontSize: 12, lineHeight: 1.35, color: "#e7d7b6" }}>
            Remet la partie au début : garage abandonné, 250$, un seul taxi jaune, usure élevée.
          </div>
          {done && <div style={{ marginTop: 6, color: "#4ade80", fontSize: 12 }}>✅ Sauvegarde réinitialisée…</div>}
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button
              type="button"
              onClick={applyStoryStart}
              style={{
                flex: 1,
                padding: "8px 9px",
                borderRadius: 8,
                border: "none",
                background: "#facc15",
                color: "#111827",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Valider
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              style={{
                padding: "8px 9px",
                borderRadius: 8,
                border: "1px solid #3a3f48",
                background: "#1f242b",
                color: "#e5e7eb",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
