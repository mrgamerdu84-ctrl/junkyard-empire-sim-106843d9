// =============================================================
// Overlay "Quartiers" : affiche pour chaque quartier sa jauge de
// conquête, ton statut de contrôle et le passif total $/min.
// Lit l'état exposé par TerritoryWar via window.__mtwTerritory et
// se rafraîchit quand une course se termine ou périodiquement.
// =============================================================
import { useEffect, useState } from "react";

type District = {
  id: string; name: string;
  x: number; y: number; w: number; h: number;
  count: number; owned: boolean;
};

const THRESHOLD = 8;
const BONUS_PER_DISTRICT = 60;

function read(): District[] {
  const w = window as unknown as { __mtwTerritory?: District[] };
  if (w.__mtwTerritory) return w.__mtwTerritory;
  try {
    const raw = localStorage.getItem("mtw-territory-v1");
    if (raw) return JSON.parse(raw) as District[];
  } catch {}
  return [];
}

export default function TerritoryPanel() {
  const [open, setOpen] = useState(false);
  const [districts, setDistricts] = useState<District[]>(read);

  useEffect(() => {
    const refresh = () => setDistricts(read());
    const t = window.setInterval(refresh, 1500);
    window.addEventListener("mtw:course-completed", refresh as EventListener);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("mtw:course-completed", refresh as EventListener);
    };
  }, []);

  const owned = districts.filter((d) => d.owned).length;
  const passive = owned * BONUS_PER_DISTRICT;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed", right: 12, bottom: 166, zIndex: 9999,
          width: 46, height: 46, borderRadius: "50%",
          border: "2px solid #fde047",
          background: "rgba(12,14,22,0.92)", color: "#fde047",
          fontWeight: 900, fontSize: 10, fontFamily: "system-ui, sans-serif",
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", lineHeight: 1, gap: 1, padding: 0,
          boxShadow: "0 4px 14px rgba(0,0,0,0.6)", cursor: "pointer",
        }}
        aria-label="Quartiers contrôlés"
      >
        <span style={{ fontSize: 16 }}>🏁</span>
        <span style={{ fontSize: 9, opacity: 0.9 }}>{owned}/{districts.length || 6}</span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9998,
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(420px, 96vw)", maxHeight: "82vh", overflowY: "auto",
              background: "linear-gradient(180deg,#1a1306,#0c0a04)",
              border: "2px solid #fde047", borderRadius: 16,
              padding: "14px 14px 18px",
              fontFamily: "system-ui, sans-serif", color: "#fff7d6",
              boxShadow: "0 18px 50px rgba(0,0,0,0.7)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: 1, color: "#fde047" }}>
                🏁 GUERRE DE TERRITOIRE
              </div>
              <button
                type="button" onClick={() => setOpen(false)}
                style={{
                  background: "transparent", border: "1px solid #fde047",
                  color: "#fde047", borderRadius: 8, padding: "4px 10px",
                  fontWeight: 900, cursor: "pointer",
                }}
              >✕</button>
            </div>

            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12,
            }}>
              <Stat label="QUARTIERS" value={`${owned}/${districts.length || 6}`} />
              <Stat label="PASSIF" value={`+${passive} $/min`} highlight />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {districts.length === 0 && (
                <div style={{ opacity: 0.7, fontSize: 12, textAlign: "center", padding: 10 }}>
                  Aucune donnée. Termine une course pour démarrer la conquête.
                </div>
              )}
              {districts.map((d) => {
                const pct = d.owned ? 100 : Math.min(100, (d.count / THRESHOLD) * 100);
                return (
                  <div key={d.id} style={{
                    border: `1.5px solid ${d.owned ? "#fde047" : "#7c7361"}`,
                    background: d.owned ? "rgba(245,197,66,0.10)" : "rgba(255,255,255,0.03)",
                    borderRadius: 10, padding: "8px 10px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ fontWeight: 900, fontSize: 12, color: d.owned ? "#fde047" : "#fff7d6" }}>
                        {d.owned ? "★ " : ""}{d.name.toUpperCase()}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: d.owned ? "#fde047" : "#cbb98a" }}>
                        {d.owned ? `+${BONUS_PER_DISTRICT} $/min` : `${d.count}/${THRESHOLD}`}
                      </div>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
                      <div style={{
                        width: `${pct}%`, height: "100%",
                        background: d.owned ? "#fde047" : "linear-gradient(90deg,#a07c10,#fde047)",
                        transition: "width 0.3s",
                      }} />
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>
                      {d.owned
                        ? "Contrôlé — bonus passif actif"
                        : `Statut : neutre · ${THRESHOLD - d.count} course${THRESHOLD - d.count > 1 ? "s" : ""} restantes`}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ fontSize: 10, opacity: 0.6, marginTop: 12, textAlign: "center" }}>
              Termine une course dans un quartier pour faire monter sa jauge.
              À {THRESHOLD} courses, il devient à toi.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      border: `1.5px solid ${highlight ? "#fde047" : "#5a5240"}`,
      background: highlight ? "rgba(245,197,66,0.12)" : "rgba(0,0,0,0.4)",
      borderRadius: 10, padding: "6px 10px", textAlign: "center",
    }}>
      <div style={{ fontSize: 9, opacity: 0.7, letterSpacing: 1 }}>{label}</div>
      <div style={{ fontWeight: 900, fontSize: 14, color: highlight ? "#fde047" : "#fff7d6" }}>{value}</div>
    </div>
  );
}
