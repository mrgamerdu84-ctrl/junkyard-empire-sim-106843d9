import { useEffect, useState } from "react";

type Stats = {
  density: number;
  period: string;
  hour: number;
  total: number;
  active: number;
  ratio: number;
  lapsPerMin: number;
};

const STORAGE_KEY = "jce.debug.traffic.enabled";

function periodFr(p: string): string {
  switch (p) {
    case "night": return "Nuit";
    case "earlyMorning": return "Petit matin";
    case "rushAM": return "Pointe matin";
    case "day": return "Jour";
    case "lunch": return "Déjeuner";
    case "rushPM": return "Pointe soir";
    case "evening": return "Soirée";
    default: return p;
  }
}

export default function TrafficDebugPanel() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });
  const [stats, setStats] = useState<Stats | null>(null);

  // Raccourci clavier "D" pour basculer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "d" || e.key === "D") {
        if (e.target instanceof HTMLElement) {
          const tag = e.target.tagName;
          if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return;
        }
        setEnabled(v => {
          const next = !v;
          try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const tick = () => {
      const w = window as unknown as { __jceTrafficStats?: Stats };
      if (w.__jceTrafficStats) setStats({ ...w.__jceTrafficStats });
      raf = window.setTimeout(() => requestAnimationFrame(tick), 500) as unknown as number;
    };
    tick();
    return () => { clearTimeout(raf); };
  }, [enabled]);

  if (!enabled) {
    return (
      <button
        type="button"
        onClick={() => {
          setEnabled(true);
          try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
        }}
        style={{
          position: "fixed", top: 6, right: 6, zIndex: 9999,
          background: "rgba(15,23,42,0.65)", color: "#94a3b8",
          border: "1px solid rgba(148,163,184,0.25)", borderRadius: 6,
          padding: "2px 6px", fontSize: 10, cursor: "pointer",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
        }}
        aria-label="Activer le panneau debug trafic"
      >
        DBG
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed", top: 6, right: 6, zIndex: 9999,
        background: "rgba(2,6,23,0.85)", color: "#e2e8f0",
        border: "1px solid rgba(148,163,184,0.35)", borderRadius: 8,
        padding: "8px 10px", fontSize: 11, lineHeight: 1.35,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        minWidth: 168, boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        pointerEvents: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <strong style={{ color: "#fbbf24", fontSize: 11 }}>🚦 TRAFIC DEBUG</strong>
        <button
          type="button"
          onClick={() => {
            setEnabled(false);
            try { localStorage.setItem(STORAGE_KEY, "0"); } catch { /* ignore */ }
          }}
          style={{
            background: "transparent", color: "#94a3b8", border: "none",
            cursor: "pointer", fontSize: 14, padding: 0, marginLeft: 8, lineHeight: 1,
          }}
          aria-label="Fermer le panneau debug"
        >
          ×
        </button>
      </div>
      {stats ? (
        <>
          <Row label="Heure" value={`${String(Math.floor(stats.hour)).padStart(2,"0")}h${String(Math.round((stats.hour % 1) * 60)).padStart(2,"0")}`} />
          <Row label="Période" value={periodFr(stats.period)} />
          <Row label="Densité" value={stats.density.toFixed(2)} accent={stats.density >= 1 ? "#34d399" : stats.density >= 0.5 ? "#fbbf24" : "#60a5fa"} />
          <Row label="Actifs" value={`${stats.active} / ${stats.total}`} />
          <Row label="Ratio" value={`${Math.round(stats.ratio * 100)}%`} />
          <Row label="Spawn" value={`${stats.lapsPerMin.toFixed(0)} /min`} />
          <div style={{ marginTop: 6, fontSize: 9, color: "#64748b" }}>Touche D pour basculer</div>
        </>
      ) : (
        <div style={{ color: "#94a3b8" }}>En attente…</div>
      )}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "#94a3b8" }}>{label}</span>
      <span style={{ color: accent ?? "#e2e8f0", fontWeight: 600 }}>{value}</span>
    </div>
  );
}
