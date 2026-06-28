import { useEffect, useRef } from "react";

function playCallBeep() {
  try {
    const Ctx = window.AudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    window.setTimeout(() => {
      try { osc.stop(); ctx.close(); } catch {}
    }, 180);
  } catch {}
}

function sayCall() {
  try {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance("Nouvelle course disponible.");
    u.lang = "fr-FR";
    u.rate = 1;
    u.volume = 0.9;
    window.speechSynthesis.speak(u);
  } catch {}
}

export default function TaxiCallAudio() {
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    const scan = () => {
      const nodes = Array.from(document.querySelectorAll<SVGGElement>("svg g[style*='cursor']"));
      for (const node of nodes) {
        const txt = (node.textContent || "").replace(/\s+/g, " ").trim();
        if (!txt.includes("$")) continue;
        if (txt.includes("MISSION")) continue;
        const sig = `${txt}|${node.getAttribute("transform") || ""}`;
        if (seen.current.has(sig)) continue;
        seen.current.add(sig);
        playCallBeep();
        sayCall();
      }
    };
    const id = window.setInterval(scan, 1200);
    scan();
    return () => window.clearInterval(id);
  }, []);

  return null;
}
