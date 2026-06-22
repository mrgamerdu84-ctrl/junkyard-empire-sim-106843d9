// =============================================================
// Radar automatique : flash blanc + toast d'amende.
// Écoute l'évènement window "jce.radar.flash" (détail optionnel
// { amount?: number; reason?: string }). Sans backend : juste
// déclenche un effet visuel + log. Le coût argent reste à câbler
// côté économie quand le joueur sera lui-même flashé.
// =============================================================
import { useEffect, useRef, useState } from "react";

type Flash = { id: number; amount: number; reason: string };

export default function RadarFlash() {
  const [flash, setFlash] = useState<Flash | null>(null);
  const lastRef = useRef(0);

  useEffect(() => {
    const on = (ev: Event) => {
      // anti-spam : 1 flash / 800ms maximum
      const now = performance.now();
      if (now - lastRef.current < 800) return;
      lastRef.current = now;
      const d = (ev as CustomEvent<{ amount?: number; reason?: string }>).detail || {};
      setFlash({
        id: Date.now(),
        amount: typeof d.amount === "number" ? d.amount : 50,
        reason: d.reason || "Excès de vitesse",
      });
    };
    window.addEventListener("jce.radar.flash", on as EventListener);
    return () => window.removeEventListener("jce.radar.flash", on as EventListener);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 1800);
    return () => window.clearTimeout(t);
  }, [flash]);

  if (!flash) return null;
  return (
    <>
      <style>{`
        @keyframes jce-radar-flash {
          0% { opacity: 0; }
          8% { opacity: 0.92; }
          25% { opacity: 0.35; }
          60% { opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes jce-radar-toast {
          0% { transform: translate(-50%, -8px); opacity: 0; }
          15% { transform: translate(-50%, 0); opacity: 1; }
          85% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0, zIndex: 60, pointerEvents: "none",
          background: "white",
          animation: "jce-radar-flash 700ms ease-out forwards",
        }}
      />
      <div
        role="status"
        style={{
          position: "absolute", top: 56, left: "50%", zIndex: 61, pointerEvents: "none",
          padding: "10px 14px", borderRadius: 10,
          background: "rgba(120,10,10,0.95)",
          border: "1px solid #ffb4b4", color: "#fff7f7",
          font: "800 13px/1.2 ui-sans-serif, system-ui",
          animation: "jce-radar-toast 1800ms ease-out forwards",
          boxShadow: "0 6px 20px rgba(255,30,30,0.45)",
        }}
      >
        📷 RADAR — {flash.reason} : -{flash.amount} $
      </div>
    </>
  );
}
