import { useEffect, useRef, useState } from "react";

type Station = {
  id: string;
  name: string;
  emoji: string;
  url: string;
};

const STATIONS: Station[] = [
  { id: "pop",    name: "Radio Pop",    emoji: "🎤", url: "https://ice1.somafm.com/poptron-128-mp3" },
  { id: "electro", name: "Radio Electro", emoji: "🎧", url: "https://ice1.somafm.com/groovesalad-128-mp3" },
  { id: "rock",   name: "Radio Rock",   emoji: "🎸", url: "https://ice6.somafm.com/thetrip-128-mp3" },
];

const STORAGE_KEY = "mttw.taxiRadio"; // stocke l'id de la station ou "off"

function readPref(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "off";
  } catch {
    return "off";
  }
}

export default function TaxiRadio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [stationId, setStationId] = useState<string>("off");
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStationId(readPref());
    setReady(true);
  }, []);

  // Applique l'état audio + notifie la musique principale
  useEffect(() => {
    if (!ready) return;
    const a = audioRef.current;
    const active = stationId !== "off";
    window.dispatchEvent(new CustomEvent("jce:taxi-radio", { detail: { active } }));
    if (!a) return;
    if (active) {
      const st = STATIONS.find((s) => s.id === stationId);
      if (st) {
        if (a.src !== st.url) a.src = st.url;
        a.volume = 0.5;
        a.play().catch(() => {
          const start = () => {
            a.play().catch(() => {});
            window.removeEventListener("pointerdown", start);
            window.removeEventListener("keydown", start);
            window.removeEventListener("touchstart", start);
          };
          window.addEventListener("pointerdown", start, { once: true });
          window.addEventListener("keydown", start, { once: true });
          window.addEventListener("touchstart", start, { once: true });
        });
      }
    } else {
      a.pause();
    }
  }, [stationId, ready]);

  const pick = (id: string) => {
    setStationId(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
  };

  const current = STATIONS.find((s) => s.id === stationId);
  const active = stationId !== "off";

  return (
    <>
      <audio ref={audioRef} preload="none" />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Radio du taxi"
        aria-label="Radio du taxi"
        style={{
          position: "fixed",
          top: 12,
          right: 64,
          zIndex: 10000,
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: "2px solid #fde047",
          background: active
            ? "linear-gradient(180deg, #ef4444 0%, #991b1b 100%)"
            : "linear-gradient(180deg, #4b5563 0%, #1f2937 100%)",
          color: "#fff7d6",
          fontSize: 20,
          fontWeight: 900,
          cursor: "pointer",
          boxShadow: "0 4px 0 rgba(0,0,0,0.35), 0 6px 16px rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          lineHeight: 1,
        }}
      >
        📻
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            top: 64,
            right: 12,
            zIndex: 10001,
            background: "linear-gradient(180deg,#1f2937,#0f172a)",
            border: "2px solid #fde047",
            borderRadius: 12,
            padding: 10,
            minWidth: 200,
            boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
            color: "#fff7d6",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 8, textAlign: "center" }}>
            📻 Radio Taxi
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {STATIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(s.id)}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: stationId === s.id ? "2px solid #f5c542" : "2px solid rgba(255,255,255,0.15)",
                  background: stationId === s.id ? "#3a2a10" : "rgba(255,255,255,0.04)",
                  color: "#fff7d6",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {s.emoji} {s.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => pick("off")}
              style={{
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: 8,
                border: stationId === "off" ? "2px solid #f5c542" : "2px solid rgba(255,255,255,0.15)",
                background: stationId === "off" ? "#3a2a10" : "rgba(255,255,255,0.04)",
                color: "#fff7d6",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              🔇 Éteindre
            </button>
          </div>
          {current && (
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 8, textAlign: "center" }}>
              En cours : {current.name}
            </div>
          )}
          <div style={{ fontSize: 10, opacity: 0.55, marginTop: 6, textAlign: "center" }}>
            La musique du jeu se coupe quand la radio joue.
          </div>
        </div>
      )}
    </>
  );
}
