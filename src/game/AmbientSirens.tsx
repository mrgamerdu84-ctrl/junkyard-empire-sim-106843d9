// =============================================================
// Sirènes d'ambiance — sons lointains de police/pompiers générés
// via WebAudio (aucun asset). Joue 2 à 4 fois par minute, volume
// très faible. Désactivable via localStorage("jce.sirens") = "0".
// Démarre seulement après une interaction utilisateur (autoplay).
// =============================================================
import { useEffect, useRef } from "react";

const KEY = "jce.sirens";

function playDistantSiren(ctx: AudioContext, volume = 0.04) {
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(ctx.destination);

  // Filtre passe-bas pour "éloigner" le son.
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;
  lp.Q.value = 0.7;
  lp.connect(out);

  const osc = ctx.createOscillator();
  osc.type = "sine";
  // Wail : 600 → 900 Hz, plusieurs cycles.
  osc.frequency.setValueAtTime(620, now);
  const cycles = 4;
  for (let i = 0; i < cycles; i++) {
    const t0 = now + i * 0.9;
    osc.frequency.linearRampToValueAtTime(940, t0 + 0.45);
    osc.frequency.linearRampToValueAtTime(620, t0 + 0.9);
  }
  osc.connect(lp);

  const total = cycles * 0.9;
  // Fade in/out + atténuation distance.
  out.gain.linearRampToValueAtTime(volume, now + 0.4);
  out.gain.setValueAtTime(volume, now + total - 0.6);
  out.gain.linearRampToValueAtTime(0, now + total);

  osc.start(now);
  osc.stop(now + total + 0.05);
}

export default function AmbientSirens() {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let started = false;

    const schedule = () => {
      if (localStorage.getItem(KEY) === "0") {
        timerRef.current = window.setTimeout(schedule, 8000);
        return;
      }
      const ctx = ctxRef.current;
      if (ctx && ctx.state === "running") {
        try { playDistantSiren(ctx); } catch {}
      }
      // 15s à 45s entre 2 sirènes.
      const next = 15000 + Math.random() * 30000;
      timerRef.current = window.setTimeout(schedule, next);
    };

    const start = () => {
      if (started) return;
      started = true;
      try {
        const Ctor = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctor) return;
        ctxRef.current = new Ctor();
        ctxRef.current.resume().catch(() => {});
      } catch {}
      timerRef.current = window.setTimeout(schedule, 8000);
    };

    const onInteract = () => { start(); window.removeEventListener("pointerdown", onInteract); window.removeEventListener("keydown", onInteract); };
    window.addEventListener("pointerdown", onInteract, { once: true });
    window.addEventListener("keydown", onInteract, { once: true });

    return () => {
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      try { ctxRef.current?.close(); } catch {}
    };
  }, []);

  return null;
}
