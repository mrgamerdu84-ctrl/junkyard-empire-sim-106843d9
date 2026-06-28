import { useEffect, useRef, useState } from "react";
import { loadStaff, countByRole } from "./personnel";

type Offer = { id: number; fare: number; ts: number };

// Liste de prénoms attribués aux chauffeurs embauchés (déterministe par index)
const DRIVER_NAMES = [
  "Karim", "Lucas", "Yanis", "Mehdi", "Tony", "Sofiane",
  "Diego", "Hassan", "Marco", "Léo", "Eddy", "Bryan",
];

function beep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
    setTimeout(() => ctx.close().catch(() => {}), 200);
  } catch {}
}


function pickFemaleFrVoice(): SpeechSynthesisVoice | null {
  try {
    const voices = window.speechSynthesis.getVoices();
    const fr = voices.filter((v) => /^fr/i.test(v.lang));
    return (
      fr.find((v) => /amelie|amélie|audrey|marie|julie|céline|celine|aurélie|aurelie|female|femme/i.test(v.name)) ||
      fr[0] || null
    );
  } catch { return null; }
}

function speakSecretary(fare: number, driver: string) {
  try {
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== "function") return;
    window.speechSynthesis.cancel();
    const u = new window.SpeechSynthesisUtterance(
      `Allô central, nouvelle course de ${fare} dollars. Chauffeur ${driver} disponible. Voulez-vous accepter ?`
    );
    u.lang = "fr-FR";
    u.rate = 1.02;
    u.pitch = 1.15;
    u.volume = 1;
    const v = pickFemaleFrVoice();
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch {}
}

function shutUp() { try { window.speechSynthesis?.cancel(); } catch {} }

export default function MissionOfferToast() {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [driverIdx, setDriverIdx] = useState(0);
  const [driverCount, setDriverCount] = useState(0);
  const expireRef = useRef<number | null>(null);

  useEffect(() => {
    const onOffer = (e: Event) => {
      const det = (e as CustomEvent<{ id: number; fare: number }>).detail;
      if (!det) return;
      const dc = countByRole(loadStaff(), "driver");
      setDriverCount(dc);
      const pick = dc > 0 ? Math.floor(Math.random() * dc) : 0;
      setDriverIdx(pick);
      const name = dc > 0 ? DRIVER_NAMES[pick % DRIVER_NAMES.length] : "Toi (en personne)";
      setOffer({ id: det.id, fare: det.fare, ts: Date.now() });
      beep();
      speakSecretary(det.fare, name);
      if (expireRef.current) window.clearTimeout(expireRef.current);
      expireRef.current = window.setTimeout(() => {
        setOffer(null);
        shutUp();
      }, 8000);
    };
    window.addEventListener("jce:mission-offered", onOffer);
    return () => {
      window.removeEventListener("jce:mission-offered", onOffer);
      if (expireRef.current) window.clearTimeout(expireRef.current);
      shutUp();
    };
  }, []);

  if (!offer) return null;

  const driverName = driverCount > 0 ? DRIVER_NAMES[driverIdx % DRIVER_NAMES.length] : "Toi (en personne)";

  const accept = () => {
    shutUp();
    window.dispatchEvent(new CustomEvent("jce:mission-accept", { detail: { id: offer.id, driver: driverName } }));
    setOffer(null);
  };
  const refuse = () => {
    shutUp();
    window.dispatchEvent(new CustomEvent("jce:mission-reject", { detail: { id: offer.id } }));
    setOffer(null);
  };
  const cycleDriver = () => setDriverIdx((i) => (i + 1) % Math.max(1, driverCount || 1));

  return (
    <div style={{
      position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)",
      zIndex: 12000, pointerEvents: "auto",
      background: "linear-gradient(180deg,#1f2937 0%,#0a0c10 100%)",
      border: "2px solid #f5c542", borderRadius: 14,
      padding: "12px 16px", minWidth: 280, maxWidth: "92vw",
      boxShadow: "0 12px 40px rgba(0,0,0,0.7), 0 0 0 4px rgba(245,197,66,0.15)",
      fontFamily: "system-ui, sans-serif", color: "#e5e7eb",
      animation: "mof-pop 0.25s ease-out",
    }}>
      <style>{`
        @keyframes mof-pop { from { transform: translate(-50%, -20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes mof-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 22, animation: "mof-blink 0.6s infinite" }}>📞</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#f5c542", fontWeight: 900, fontSize: 13, letterSpacing: 0.5 }}>
            COURSE ENTRANTE
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>
            🎙️ Sandra (secrétaire) — Radio Taxi
          </div>
        </div>
        <div style={{ color: "#34d399", fontSize: 16, fontWeight: 900 }}>+{offer.fare} $</div>
      </div>
      <div style={{ background: "#0a0c10", border: "1px solid #374151", borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>👨‍✈️ Chauffeur assigné</div>
        <button
          onClick={cycleDriver}
          disabled={driverCount === 0}
          style={{
            width: "100%", textAlign: "left", background: "transparent",
            border: "1px dashed #4b5563", borderRadius: 6, padding: "6px 8px",
            color: "#fde047", fontWeight: 800, fontSize: 14, cursor: driverCount > 0 ? "pointer" : "default",
          }}
          title={driverCount > 0 ? "Cliquer pour changer de chauffeur" : "Aucun chauffeur — embauche depuis ÉQUIPE"}
        >
          {driverName} {driverCount > 0 && <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600 }}>(tape pour changer)</span>}
        </button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={refuse}
          style={{
            flex: 1, padding: "10px", borderRadius: 8, border: "none",
            background: "#374151", color: "#d1d5db", fontWeight: 800, fontSize: 14, cursor: "pointer",
          }}
        >Refuser</button>
        <button
          onClick={accept}
          style={{
            flex: 2, padding: "10px", borderRadius: 8, border: "none",
            background: "linear-gradient(180deg,#10b981,#059669)", color: "#fff",
            fontWeight: 900, fontSize: 14, cursor: "pointer",
            boxShadow: "0 3px 0 #064e3b",
          }}
        >✅ Accepter</button>
      </div>
    </div>
  );
}
