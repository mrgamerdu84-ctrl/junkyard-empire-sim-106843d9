// =============================================================
// Le Parrain — pop-up haut-parleur qui réclame une rançon.
// Payer 1 500 $ → trêve mafia de 60 min (sabotage, camion blindé,
// vol de courses OFF). Refuser → raid sur le QG (90 s).
// État persistant dans localStorage, communication via window events.
// =============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import godfatherImg from "@/assets/godfather.png";

const KEY = "mtw.godfather.v1";
const RANSOM = 1500;
const TRUCE_MS = 60 * 60 * 1000;       // 1 h
const REFUSAL_COOLDOWN_MS = 8 * 60 * 1000; // 8 min
const FIRST_DELAY_MS = 3 * 60 * 1000;  // 3 min après 1re partie
const RAID_MS = 90 * 1000;             // 90 s raid QG
const DECISION_MS = 15_000;            // 15 s pour répondre

type State = { truceUntil: number; nextDemandAt: number; lastPaid: number };

function loadState(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {}
  return { truceUntil: 0, nextDemandAt: Date.now() + FIRST_DELAY_MS, lastPaid: 0 };
}
function saveState(s: State) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

/** Lu par MafiaAttackers, ArmoredTruck, TaxiTycoon pour neutraliser la mafia. */
export function isMafiaTruceActive(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const s = JSON.parse(raw) as State;
    return Date.now() < (s.truceUntil ?? 0);
  } catch { return false; }
}

const LINES = [
  "Alors, gamin… on m'a dit que ça roulait pour toi. Ce serait dommage qu'il arrive un malheur à ta belle flotte. 1 500 $ et on n'en parle plus pendant une heure.",
  "Tu sais comment ça marche : tu casques, mes gars regardent ailleurs. Sinon… mes voitures débarquent à ton QG. 1 500 $, qu'est-ce que t'en dis ?",
  "T'as une jolie petite affaire ici. Ce serait triste qu'elle prenne feu. 1 500 $ d'assurance, et la ville est à toi pour une heure.",
  "On va faire simple, fiston. 1 500 $ dans l'enveloppe, tu travailles tranquille jusqu'au prochain coup de fil. Pas de paiement ? Mes hommes savent où tu gares tes taxis…",
];

function pickLine(): string {
  return LINES[Math.floor(Math.random() * LINES.length)];
}

function beep() {
  try {
    type WAW = typeof window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const w = window as WAW;
    const Ctor = w.AudioContext || w.webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 620;
    osc.type = "square";
    gain.gain.value = 0.06;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
    setTimeout(() => ctx.close(), 200);
  } catch {}
}

function fmtTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function MafiaGodfather() {
  const [state, setState] = useState<State>(() => loadState());
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState("");
  const [typed, setTyped] = useState("");
  const [deadline, setDeadline] = useState(0);
  const [, force] = useState(0);
  const [cash, setCash] = useState(0);
  const lastCheckRef = useRef(0);

  // Cash (mirroré par TaxiTycoon sur window.__jcePlayerCash)
  useEffect(() => {
    const sync = () => {
      const w = window as unknown as { __jcePlayerCash?: number };
      setCash(typeof w.__jcePlayerCash === "number" ? w.__jcePlayerCash : 0);
    };
    sync();
    const id = window.setInterval(sync, 500);
    return () => window.clearInterval(id);
  }, []);

  // Tick global (ouvre le pop-up au bon moment + rafraîchit le badge)
  useEffect(() => {
    const id = window.setInterval(() => {
      force((v) => (v + 1) % 1e9);
      const now = Date.now();
      if (open) return;
      if (now < state.nextDemandAt) return;
      if (now < state.truceUntil) return;
      if (now - lastCheckRef.current < 1000) return;
      lastCheckRef.current = now;
      // Ouvre la demande de rançon
      setLine(pickLine());
      setTyped("");
      setDeadline(now + DECISION_MS);
      setOpen(true);
      beep();
    }, 500);
    return () => window.clearInterval(id);
  }, [open, state.nextDemandAt, state.truceUntil]);

  // Machine à écrire
  useEffect(() => {
    if (!open || !line) return;
    let i = 0;
    setTyped("");
    const id = window.setInterval(() => {
      i++;
      setTyped(line.slice(0, i));
      if (i >= line.length) window.clearInterval(id);
    }, 22);
    return () => window.clearInterval(id);
  }, [open, line]);

  // Écoute manuelle : badge cliquable peut rouvrir la demande
  useEffect(() => {
    const onOpen = () => {
      if (open) return;
      if (Date.now() < state.truceUntil) return; // trêve active : rien à faire
      setLine(pickLine());
      setTyped("");
      setDeadline(Date.now() + DECISION_MS);
      setOpen(true);
      beep();
    };
    window.addEventListener("jce.godfather.open", onOpen);
    return () => window.removeEventListener("jce.godfather.open", onOpen);
  }, [open, state.truceUntil]);

  const refuse = useCallback(() => {
    const now = Date.now();
    const ns: State = { ...state, nextDemandAt: now + REFUSAL_COOLDOWN_MS };
    saveState(ns); setState(ns);
    window.dispatchEvent(new CustomEvent("jce.mafia.raid", { detail: { until: now + RAID_MS } }));
    setOpen(false);
  }, [state]);

  const pay = useCallback(() => {
    if (cash < RANSOM) { refuse(); return; }
    const now = Date.now();
    const until = now + TRUCE_MS;
    window.dispatchEvent(new CustomEvent("jce.player.cashDelta", {
      detail: { amount: -RANSOM, reason: "ransom", label: "rançon du Parrain" },
    }));
    const ns: State = { truceUntil: until, nextDemandAt: until + 5000, lastPaid: now };
    saveState(ns); setState(ns);
    window.dispatchEvent(new CustomEvent("jce.mafia.truce", { detail: { active: true, until } }));
    setOpen(false);
  }, [cash, refuse]);

  // Timeout : pas de réponse → refus auto
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => {
      if (Date.now() > deadline) refuse();
    }, 250);
    return () => window.clearInterval(id);
  }, [open, deadline, refuse]);

  const now = Date.now();
  const truceLeft = Math.max(0, state.truceUntil - now);
  const truceActive = truceLeft > 0;

  const badge = (
    <>
      <style>{`
        .mg-badge {
          position: fixed; top: 8px; right: 60px; z-index: 9998;
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 8px; border-radius: 999px;
          background: rgba(12,14,22,0.92);
          border: 1px solid #dc2626;
          color: #fca5a5;
          font-size: 10px; font-weight: 900; letter-spacing: 0.5px;
          cursor: pointer;
          box-shadow: 0 4px 10px rgba(0,0,0,0.45);
          font-family: ui-sans-serif, system-ui, sans-serif;
        }
        .mg-badge.mg-truce { border-color: #16a34a; color: #86efac; cursor: default; }
        .mg-badge b { color: #fde047; margin-left: 2px; font-variant-numeric: tabular-nums; }
        @media (orientation: landscape) and (max-height: 500px) {
          .mg-badge { top: 6px; right: 110px; }
        }
      `}</style>
      <button
        className={`mg-badge ${truceActive ? "mg-truce" : ""}`}
        onClick={() => {
          if (!truceActive) window.dispatchEvent(new CustomEvent("jce.godfather.open"));
        }}
        title={truceActive ? "Trêve mafia en cours" : "Le Parrain rôde…"}
        aria-label="État Parrain"
      >
        {truceActive ? (
          <>🤝 <span>TRÊVE</span> <b>{fmtTime(truceLeft)}</b></>
        ) : (
          <>☠ <span>MENACE</span></>
        )}
      </button>
    </>
  );

  const dialog = open && createPortal((
    <div className="mg-overlay" role="dialog" aria-modal="true" aria-label="Le Parrain">
      <div className="mg-card">
        <div className="mg-speaker">
          <div className="mg-speaker-grill" />
          <span className="mg-speaker-label">📢 TRANSMISSION ANONYME</span>
          <div className="mg-pulse" />
        </div>
        <div className="mg-body">
          <img src={godfatherImg} alt="Le Parrain" className="mg-portrait" width={120} height={120} loading="lazy" />
          <div className="mg-bubble">
            <div className="mg-bubble-tail" />
            <p className="mg-text">{typed}<span className="mg-caret">▍</span></p>
          </div>
        </div>
        <div className="mg-meta">
          <span>⏳ Tu as <b>{fmtTime(Math.max(0, deadline - now))}</b> pour répondre.</span>
          <span>💵 Tes liquidités : <b>{cash} $</b></span>
        </div>
        <div className="mg-actions">
          <button
            className="mg-btn mg-pay"
            disabled={cash < RANSOM}
            onClick={pay}
          >
            🟢 PAYER {RANSOM} $
            <em>1 h de trêve</em>
          </button>
          <button className="mg-btn mg-refuse" onClick={refuse}>
            🔴 REFUSER
            <em>Raid mafia sur le QG (90 s)</em>
          </button>
        </div>
        {cash < RANSOM && (
          <p className="mg-warn">Tu n'as pas assez de liquidités… mauvaise idée de le faire patienter.</p>
        )}
      </div>
      <style>{`
        .mg-overlay {
          position: fixed; inset: 0; z-index: 99999;
          background: radial-gradient(ellipse at center, rgba(60,0,0,0.55), rgba(0,0,0,0.88));
          display: flex; align-items: center; justify-content: center;
          padding: 16px; backdrop-filter: blur(2px);
          animation: mg-in 0.25s ease-out;
        }
        @keyframes mg-in { from { opacity: 0 } to { opacity: 1 } }
        .mg-card {
          width: min(440px, 96vw);
          background: linear-gradient(180deg, #1a0a0a 0%, #0a0a0d 100%);
          border: 2px solid #b8860b;
          border-radius: 14px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.8), inset 0 0 30px rgba(184,134,11,0.12);
          padding: 14px 14px 16px;
          color: #fde7c2;
          font-family: ui-sans-serif, system-ui, sans-serif;
        }
        .mg-speaker {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 10px;
          background: #0b0c0e; border: 1px solid #2a2a30; border-radius: 8px;
          margin-bottom: 12px;
        }
        .mg-speaker-grill {
          width: 26px; height: 26px; flex: 0 0 auto;
          border-radius: 50%;
          background: repeating-radial-gradient(circle at center, #444 0 2px, #1a1a1f 2px 4px);
          border: 1px solid #555;
        }
        .mg-speaker-label { flex: 1; font-size: 11px; font-weight: 900; letter-spacing: 1px; color: #fde047; }
        .mg-pulse { width: 10px; height: 10px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 10px #ef4444; animation: mg-pulse 0.7s ease-in-out infinite; }
        @keyframes mg-pulse { 0%, 100% { transform: scale(1); opacity: 0.5 } 50% { transform: scale(1.4); opacity: 1 } }
        .mg-body { display: flex; gap: 12px; align-items: flex-start; }
        .mg-portrait {
          width: 110px; height: 110px; border-radius: 10px;
          object-fit: cover;
          border: 2px solid #b8860b;
          box-shadow: 0 6px 20px rgba(0,0,0,0.6);
          flex: 0 0 110px;
        }
        .mg-bubble {
          position: relative; flex: 1;
          background: #fef3c7; color: #1a0a0a;
          padding: 10px 12px; border-radius: 10px;
          border: 2px solid #1a0a0a;
          min-height: 110px;
          box-shadow: 3px 3px 0 #1a0a0a;
        }
        .mg-bubble-tail {
          position: absolute; left: -12px; top: 28px;
          width: 0; height: 0;
          border-top: 8px solid transparent;
          border-bottom: 8px solid transparent;
          border-right: 12px solid #1a0a0a;
        }
        .mg-bubble-tail::after {
          content: ""; position: absolute; left: 2px; top: -6px;
          border-top: 6px solid transparent;
          border-bottom: 6px solid transparent;
          border-right: 10px solid #fef3c7;
        }
        .mg-text { margin: 0; font-size: 13px; line-height: 1.45; font-weight: 600; font-style: italic; }
        .mg-caret { animation: mg-caret 0.7s steps(2) infinite; margin-left: 1px; }
        @keyframes mg-caret { 50% { opacity: 0 } }
        .mg-meta {
          display: flex; justify-content: space-between; gap: 8px;
          margin: 12px 2px 10px; font-size: 11px; color: #fcd34d;
        }
        .mg-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .mg-btn {
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          padding: 10px 8px; border-radius: 8px;
          font-weight: 900; font-size: 13px; cursor: pointer;
          border: 2px solid #0a0a0d;
          transition: transform 0.08s;
        }
        .mg-btn:active { transform: scale(0.96) }
        .mg-btn em { font-style: normal; font-size: 9.5px; font-weight: 600; opacity: 0.85; }
        .mg-pay { background: #16a34a; color: #f0fdf4; border-color: #052e16; }
        .mg-pay:disabled { background: #4b5563; color: #9ca3af; cursor: not-allowed; }
        .mg-refuse { background: #dc2626; color: #fff1f2; border-color: #450a0a; }
        .mg-warn { margin: 10px 0 0; font-size: 11px; color: #fca5a5; text-align: center; }
      `}</style>
    </div>
  ), document.body);

  return (
    <>
      {typeof document !== "undefined" && createPortal(badge, document.body)}
      {dialog}
      <GodfatherToast />
    </>
  );
}

// ---------------------------------------------------------------
// Petite bulle "toast" du Parrain (sans bouton). Écoute
// `jce.godfather.say` (ex : raid terminé : "La prochaine fois,
// ça sera plus cher.").
// ---------------------------------------------------------------
function GodfatherToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const onSay = (ev: Event) => {
      const d = (ev as CustomEvent<{ text: string }>).detail;
      if (!d || !d.text) return;
      setMsg(d.text);
      window.setTimeout(() => setMsg(null), 6000);
    };
    window.addEventListener("jce.godfather.say", onSay as EventListener);
    return () => window.removeEventListener("jce.godfather.say", onSay as EventListener);
  }, []);
  if (!msg || typeof document === "undefined") return null;
  return createPortal(
    <>
      <style>{`
        .gf-toast {
          position: fixed; left: 50%; top: 18%; transform: translateX(-50%);
          z-index: 99998; display: flex; gap: 10px; align-items: flex-start;
          background: linear-gradient(180deg,#1a0a0a,#0a0a0d);
          border: 2px solid #b8860b; border-radius: 12px;
          padding: 10px 12px; max-width: min(420px, 92vw);
          box-shadow: 0 14px 40px rgba(0,0,0,0.7);
          font-family: ui-sans-serif, system-ui, sans-serif;
          animation: gf-in 0.3s ease-out;
        }
        @keyframes gf-in { from { opacity: 0; transform: translate(-50%, -10px) } to { opacity: 1; transform: translate(-50%, 0) } }
        .gf-toast img { width: 56px; height: 56px; border-radius: 8px; object-fit: cover; border: 2px solid #b8860b; }
        .gf-toast .gf-bub {
          background: #fef3c7; color: #1a0a0a; border: 2px solid #1a0a0a;
          border-radius: 10px; padding: 8px 10px; font-style: italic; font-weight: 700;
          font-size: 13px; box-shadow: 3px 3px 0 #1a0a0a;
        }
      `}</style>
      <div className="gf-toast" role="status">
        <img src={godfatherImg} alt="Parrain" />
        <div className="gf-bub">« {msg} »</div>
      </div>
    </>,
    document.body,
  );
}

