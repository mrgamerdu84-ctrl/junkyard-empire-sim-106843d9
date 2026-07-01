// =============================================================
// IntroStory — Chapitre 1 : Le Retour.
// Rejouable depuis l'écran d'accueil.
// =============================================================
import { useEffect, useState } from "react";
import panel1 from "@/assets/story/panel1.jpg";
import panel2 from "@/assets/story/panel2.jpg";
import panel3 from "@/assets/story/panel3.jpg";
import panel4 from "@/assets/story/panel4.jpg";
import panel5 from "@/assets/story/panel5.jpg";

const INTRO_KEY = "mtw.intro.seen.v1";

export function hasSeenIntro(): boolean {
  try { return localStorage.getItem(INTRO_KEY) === "1"; } catch { return false; }
}
export function markIntroSeen() {
  try { localStorage.setItem(INTRO_KEY, "1"); } catch {}
}

type Panel = { img: string; caption: string; sub?: string };

const PANELS: Panel[] = [
  {
    img: panel1,
    caption: "CHAPITRE 1 — LE RETOUR",
    sub: "Après plusieurs années loin de ta ville natale, tu reviens là où tout a commencé.",
  },
  {
    img: panel2,
    caption: "Taxi Co. n'est plus qu'un vieil entrepôt abandonné.",
    sub: "Portail rouillé, vitres brisées, herbes hautes, pneus usés et ferraille partout.",
  },
  {
    img: panel3,
    caption: "Au fond du garage repose un unique taxi.",
    sub: "Un vieux modèle couvert de poussière. La peinture est écaillée. Le moteur ne démarre presque plus.",
  },
  {
    img: panel4,
    caption: "Dans le bureau de ton père, tu trouves un carnet usé.",
    sub: "« Quelqu'un a voulu détruire tout ce que nous avions construit. Ne fais confiance à personne. Reconstruis Taxi Co... et découvre la vérité. »",
  },
  {
    img: panel5,
    caption: "Tu n'es pas revenu seulement pour sauver une entreprise.",
    sub: "Tu es revenu pour reconstruire l'héritage de ton père et découvrir ce qui lui est réellement arrivé.",
  },
  {
    img: panel2,
    caption: "Objectifs : nettoyer la cour, remettre l'électricité, réparer le taxi et faire la première course.",
    sub: "Une seule lampe éclaire encore le garage. Au loin, une limousine noire traverse la ville sans s'arrêter.",
  },
];

export default function IntroStory({ onDone }: { onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");
  const panel = PANELS[idx];

  useEffect(() => { setPhase("in"); }, [idx]);

  const next = () => {
    setPhase("out");
    window.setTimeout(() => {
      if (idx < PANELS.length - 1) setIdx(idx + 1);
      else finish();
    }, 280);
  };

  const finish = () => {
    markIntroSeen();
    onDone();
  };

  return (
    <div className="is-root" role="dialog" aria-label="Chapitre 1 — Le Retour">
      <style>{`
        .is-root { position: fixed; inset: 0; z-index: 9999; background: #050505; display: flex; flex-direction: column; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; color: #f5e9c9; overflow: hidden; }
        .is-stage { position: relative; flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; background: #000; }
        .is-panel { position: absolute; inset: 0; background-size: cover; background-position: center; opacity: 0; transform: scale(1.04); transition: opacity 0.45s ease, transform 6s linear; }
        .is-panel.in { opacity: 1; transform: scale(1.10); }
        .is-panel.out { opacity: 0; transform: scale(1.12); transition: opacity 0.28s ease; }
        .is-vignette { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.0) 42%), linear-gradient(to bottom, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.0) 28%), radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.72) 100%); pointer-events: none; }
        .is-chapter { position: absolute; top: 18px; left: 18px; right: 18px; display: flex; justify-content: space-between; align-items: center; pointer-events: none; color: rgba(245,233,201,0.82); font-weight: 900; letter-spacing: 2px; font-size: clamp(10px, 2.5vw, 13px); text-shadow: 0 2px 8px rgba(0,0,0,0.8); }
        .is-caption { position: absolute; left: 0; right: 0; bottom: 0; padding: 26px 22px 32px; color: #fff8e6; text-shadow: 0 2px 8px rgba(0,0,0,0.86); }
        .is-caption h2 { margin: 0 0 7px; font-size: clamp(18px, 4.6vw, 27px); font-weight: 900; letter-spacing: 0.2px; line-height: 1.24; }
        .is-caption p { margin: 0; font-size: clamp(13px, 3.4vw, 17px); color: #f0d49a; opacity: 0.97; font-style: italic; line-height: 1.36; max-width: 920px; }
        .is-bar { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: linear-gradient(to bottom, #14110b, #0a0907); border-top: 1px solid #2a2218; gap: 10px; }
        .is-dots { display: flex; gap: 6px; }
        .is-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(245,233,201,0.25); transition: all 0.25s; }
        .is-dot.on { background: #c9a227; box-shadow: 0 0 8px #c9a227; }
        .is-skip, .is-next { padding: 10px 18px; border-radius: 8px; font-weight: 800; font-size: 14px; border: none; cursor: pointer; font-family: inherit; }
        .is-skip { background: transparent; color: rgba(245,233,201,0.55); border: 1px solid rgba(245,233,201,0.18); }
        .is-next { background: linear-gradient(to bottom, #f5c542, #c9a227); color: #2a1d05; border: 1px solid #5c0f0f; box-shadow: 0 2px 8px rgba(0,0,0,0.45); min-width: 110px; }
        .is-next:active { transform: scale(0.96); }
      `}</style>

      <div className="is-stage" onClick={next}>
        <div className={`is-panel ${phase}`} style={{ backgroundImage: `url(${panel.img})` }} />
        <div className="is-vignette" />
        <div className="is-chapter"><span>MY TAXI WORLD</span><span>CHAPITRE 1</span></div>
        <div className="is-caption">
          <h2>{panel.caption}</h2>
          {panel.sub && <p>{panel.sub}</p>}
        </div>
      </div>

      <div className="is-bar">
        <button className="is-skip" onClick={finish}>Passer ›</button>
        <div className="is-dots" aria-hidden="true">
          {PANELS.map((_, i) => <span key={i} className={`is-dot ${i <= idx ? "on" : ""}`} />)}
        </div>
        <button className="is-next" onClick={next}>{idx < PANELS.length - 1 ? "Suivant ▸" : "Commencer ▸"}</button>
      </div>
    </div>
  );
}
