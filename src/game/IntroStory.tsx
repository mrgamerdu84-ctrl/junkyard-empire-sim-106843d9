// =============================================================
// IntroStory — BD/roman-photo défilant.
// 5 panneaux qui racontent : un jeune homme arrive en ville pour
// reprendre l'entreprise de taxi de son père, découvre que la
// mafia l'a tué, et jure de la chasser de la ville.
// Joué une seule fois (flag localStorage), mais re-jouable depuis
// l'écran d'accueil ("Voir l'intro").
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
    caption: "Quand j'ai posé le pied dans cette ville, je n'avais qu'une valise et une promesse.",
    sub: "Reprendre l'affaire que mon père avait laissée.",
  },
  {
    img: panel2,
    caption: "Le vieux garage Taxi Co. était toujours là. Rouillé. Oublié. Mais debout.",
    sub: "Mon père l'avait fondé. Maintenant, c'était à mon tour.",
  },
  {
    img: panel3,
    caption: "Sauf qu'en fouillant les vieux dossiers, j'ai compris.",
    sub: "Mon père n'a pas eu un accident. La mafia l'a fait taire — il refusait de payer.",
  },
  {
    img: panel4,
    caption: "Ils lui ont tout pris. Sa flotte. Sa vie.",
    sub: "Aujourd'hui je reviens. Et je vais leur reprendre la rue, taxi par taxi.",
  },
  {
    img: panel5,
    caption: "Bienvenue dans MY TAXI WORLD — L'EMPIRE DES RUES.",
    sub: "La mafia te demandera ta dîme. À toi de choisir : payer… ou riposter.",
  },
];

export default function IntroStory({ onDone }: { onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");
  const panel = PANELS[idx];

  useEffect(() => {
    setPhase("in");
  }, [idx]);

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
    <div className="is-root" role="dialog" aria-label="Intro de l'histoire">
      <style>{`
        .is-root {
          position: fixed; inset: 0; z-index: 9999;
          background: #050505;
          display: flex; flex-direction: column;
          font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
          color: #f5e9c9;
          overflow: hidden;
        }
        .is-stage {
          position: relative; flex: 1; min-height: 0;
          display: flex; align-items: center; justify-content: center;
          background: #000;
        }
        .is-panel {
          position: absolute; inset: 0;
          background-size: cover; background-position: center;
          opacity: 0; transform: scale(1.04);
          transition: opacity 0.45s ease, transform 6s linear;
        }
        .is-panel.in { opacity: 1; transform: scale(1.10); }
        .is-panel.out { opacity: 0; transform: scale(1.12); transition: opacity 0.28s ease; }
        .is-vignette {
          position: absolute; inset: 0;
          background:
            linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.0) 35%),
            linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.0) 25%),
            radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 100%);
          pointer-events: none;
        }
        .is-caption {
          position: absolute; left: 0; right: 0; bottom: 0;
          padding: 24px 22px 30px;
          color: #fff8e6;
          text-shadow: 0 2px 8px rgba(0,0,0,0.8);
        }
        .is-caption h2 {
          margin: 0 0 6px;
          font-size: clamp(17px, 4.4vw, 24px);
          font-weight: 800; letter-spacing: 0.2px;
          line-height: 1.3;
        }
        .is-caption p {
          margin: 0;
          font-size: clamp(13px, 3.4vw, 16px);
          color: #f0d49a; opacity: 0.95;
          font-style: italic;
        }
        .is-bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 14px;
          background: linear-gradient(to bottom, #14110b, #0a0907);
          border-top: 1px solid #2a2218;
          gap: 10px;
        }
        .is-dots { display: flex; gap: 6px; }
        .is-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: rgba(245,233,201,0.25);
          transition: all 0.25s;
        }
        .is-dot.on { background: #c9a227; box-shadow: 0 0 8px #c9a227; }
        .is-skip, .is-next {
          padding: 10px 18px; border-radius: 8px;
          font-weight: 800; font-size: 14px; border: none; cursor: pointer;
          font-family: inherit;
        }
        .is-skip {
          background: transparent; color: rgba(245,233,201,0.55);
          border: 1px solid rgba(245,233,201,0.18);
        }
        .is-next {
          background: linear-gradient(to bottom, #f5c542, #c9a227);
          color: #2a1d05; border: 1px solid #5c0f0f;
          box-shadow: 0 2px 8px rgba(0,0,0,0.45);
          min-width: 110px;
        }
        .is-next:active { transform: scale(0.96); }
      `}</style>

      <div className="is-stage" onClick={next}>
        <div
          className={`is-panel ${phase}`}
          style={{ backgroundImage: `url(${panel.img})` }}
        />
        <div className="is-vignette" />
        <div className="is-caption">
          <h2>{panel.caption}</h2>
          {panel.sub && <p>{panel.sub}</p>}
        </div>
      </div>

      <div className="is-bar">
        <button className="is-skip" onClick={finish}>Passer ›</button>
        <div className="is-dots" aria-hidden="true">
          {PANELS.map((_, i) => (
            <span key={i} className={`is-dot ${i <= idx ? "on" : ""}`} />
          ))}
        </div>
        <button className="is-next" onClick={next}>
          {idx < PANELS.length - 1 ? "Suivant ▸" : "Commencer ▸"}
        </button>
      </div>
    </div>
  );
}
