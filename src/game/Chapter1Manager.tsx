// Chapitre 1 — Le Retour.
// Composant autonome qui :
//  1. Détecte la première partie et joue une courte intro narrative.
//  2. Affiche un HUD permanent avec les 4 objectifs.
//  3. Fournit les interactions manquantes (nettoyer la cour, réparer le vieux taxi).
//  4. Écoute les événements de gameplay pour valider automatiquement les objectifs.
//  5. Affiche un écran de fin de chapitre et débloque le chapitre 2.
//
// Aucune modification du gameplay libre existant : on ne fait qu'écouter des
// événements déjà émis (mtw:course-completed) et l'état de la campagne.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadCampaign,
  startCampaign,
  completeMission,
  chapterProgress,
  type CampaignState,
} from "./campaign/campaignState";
import { CHAPTERS } from "./campaign/campaignData";

const CH_ID = "ch1";
const NEXT_ID = "ch2";
const INTRO_KEY = "mtw.ch1.intro.seen";
const OUTRO_KEY = "mtw.ch1.outro.seen";
const YARD_KEY = "mtw.ch1.yard.cleaned";
const FIX_KEY = "mtw.ch1.taxi.repaired";

const MISSIONS = {
  arrive: "m1a",
  clean: "m1b",
  repair: "m1c",
  firstRide: "m1d",
} as const;

const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };

export default function Chapter1Manager() {
  const [state, setState] = useState<CampaignState>(() => loadCampaign());
  const [showIntro, setShowIntro] = useState(false);
  const [showOutro, setShowOutro] = useState(false);
  const [confirmClean, setConfirmClean] = useState(false);
  const [confirmRepair, setConfirmRepair] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const bootRef = useRef(false);

  // Sync état campagne
  useEffect(() => {
    const on = () => setState(loadCampaign());
    window.addEventListener("campaign.updated", on);
    return () => window.removeEventListener("campaign.updated", on);
  }, []);

  // Boot : démarrage automatique du chapitre 1 + intro nouvelle partie
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    const s = loadCampaign();
    // Chapitre 1 actif uniquement si pas déjà terminé
    if (s.completedChapters.includes(CH_ID)) return;
    // Démarrer la campagne silencieusement
    if (!s.started) startCampaign();
    // Objectif 1 : "Prendre possession du dépôt" — on considère
    // que le joueur interagit avec Taxi Co. dès qu'il lance la partie.
    const done = new Set(loadCampaign().completedMissions[CH_ID] ?? []);
    if (!done.has(MISSIONS.arrive)) {
      completeMission(CH_ID, MISSIONS.arrive);
    }
    // Intro première partie
    if (!lsGet(INTRO_KEY)) setShowIntro(true);
  }, []);

  // Auto-validation objectif 4 : première course terminée
  useEffect(() => {
    const on = () => {
      const s = loadCampaign();
      if (s.completedChapters.includes(CH_ID)) return;
      const done = new Set(s.completedMissions[CH_ID] ?? []);
      if (!done.has(MISSIONS.firstRide)) {
        completeMission(CH_ID, MISSIONS.firstRide);
      }
    };
    window.addEventListener("mtw:course-completed", on as EventListener);
    return () => window.removeEventListener("mtw:course-completed", on as EventListener);
  }, []);

  // Fin de chapitre : quand ch1 passe dans completedChapters
  useEffect(() => {
    if (state.completedChapters.includes(CH_ID) && !lsGet(OUTRO_KEY)) {
      setShowOutro(true);
    }
  }, [state.completedChapters]);

  const chapter = useMemo(() => CHAPTERS.find((c) => c.id === CH_ID)!, []);
  const nextChapter = useMemo(() => CHAPTERS.find((c) => c.id === NEXT_ID) ?? null, []);
  const progress = chapterProgress(CH_ID);
  const doneSet = new Set(state.completedMissions[CH_ID] ?? []);
  const chapterDone = state.completedChapters.includes(CH_ID);
  const yardCleaned = lsGet(YARD_KEY) === "1" || doneSet.has(MISSIONS.clean);
  const taxiRepaired = lsGet(FIX_KEY) === "1" || doneSet.has(MISSIONS.repair);

  // N'affiche le tracker que si le chapitre est en cours
  if (chapterDone && !showOutro) return null;

  const items: Array<{ id: string; label: string; done: boolean; action?: () => void; actionLabel?: string }> = [
    { id: MISSIONS.arrive, label: "Prendre possession du dépôt", done: doneSet.has(MISSIONS.arrive) },
    {
      id: MISSIONS.clean,
      label: "Nettoyer la cour",
      done: doneSet.has(MISSIONS.clean),
      action: () => setConfirmClean(true),
      actionLabel: "🧹 Nettoyer",
    },
    {
      id: MISSIONS.repair,
      label: "Réparer « Le Taxi du Père »",
      done: doneSet.has(MISSIONS.repair),
      action: () => setConfirmRepair(true),
      actionLabel: "🔧 Réparer",
    },
    { id: MISSIONS.firstRide, label: "Effectuer la première course", done: doneSet.has(MISSIONS.firstRide) },
  ];

  return (
    <>
      <style>{css}</style>

      {/* HUD permanent des objectifs */}
      {!chapterDone && (
        <div className="ch1-hud" data-no-pan>
          <div className="ch1-hud-head" onClick={() => setCollapsed((v) => !v)}>
            <span className="ch1-badge">📖 CH.1</span>
            <span className="ch1-hud-title">Le Retour</span>
            <span className="ch1-hud-count">{progress.done}/{progress.total}</span>
            <span className="ch1-hud-tog">{collapsed ? "▸" : "▾"}</span>
          </div>
          {!collapsed && (
            <ul className="ch1-hud-list">
              {items.map((it) => (
                <li key={it.id} className={it.done ? "done" : ""}>
                  <span className="ch1-check">{it.done ? "✅" : "⬜"}</span>
                  <span className="ch1-lab">{it.label}</span>
                  {!it.done && it.action && (
                    <button className="ch1-act" onClick={(e) => { e.stopPropagation(); it.action!(); }}>
                      {it.actionLabel}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Cinématique d'introduction (nouvelle partie) */}
      {showIntro && (
        <IntroModal
          onDone={() => {
            lsSet(INTRO_KEY, "1");
            setShowIntro(false);
          }}
        />
      )}

      {/* Confirmation : nettoyer la cour */}
      {confirmClean && (
        <ActionModal
          title="Nettoyer la cour"
          desc="Marcel te tend un balai. Vous dégagez les caisses éventrées, les palettes moisies et des années de poussière. La cour respire à nouveau."
          confirmLabel="🧹 Terminer le nettoyage"
          onConfirm={() => {
            lsSet(YARD_KEY, "1");
            completeMission(CH_ID, MISSIONS.clean);
            setConfirmClean(false);
          }}
          onCancel={() => setConfirmClean(false)}
        />
      )}

      {/* Confirmation : réparer le vieux taxi */}
      {confirmRepair && (
        <ActionModal
          title="Réparer « Le Taxi du Père »"
          desc={
            yardCleaned
              ? "Sous la bâche : « Le Taxi du Père », la vieille berline jaune héritée de ton père — dernier vestige de l'ancien Taxi Co. Marcel remonte le carbu, gonfle les pneus, tourne la clé… le moteur tousse, puis rugit. Il est prêt à reprendre la route."
              : "Avant de mettre les mains sous le capot du Taxi du Père, il faudrait dégager la cour. Marcel dit qu'il ne peut rien faire dans ce bazar."
          }
          confirmLabel={yardCleaned ? "🔧 Terminer la réparation" : "OK"}
          disabled={!yardCleaned}
          onConfirm={() => {
            if (!yardCleaned) { setConfirmRepair(false); return; }
            lsSet(FIX_KEY, "1");
            completeMission(CH_ID, MISSIONS.repair);
            setConfirmRepair(false);
          }}
          onCancel={() => setConfirmRepair(false)}
        />
      )}

      {/* Fin de chapitre */}
      {showOutro && (
        <OutroModal
          chapterTitle={chapter.title}
          nextTitle={nextChapter?.title ?? ""}
          nextTeaser={nextChapter?.subtitle ?? ""}
          onDone={() => {
            lsSet(OUTRO_KEY, "1");
            setShowOutro(false);
          }}
        />
      )}
    </>
  );
}

/* ============================================================
 * Sous-composants
 * ============================================================ */

function IntroModal({ onDone }: { onDone: () => void }) {
  const slides = [
    {
      title: "De retour au pays",
      body: "Après des années loin de la ville, le train ralentit dans un crissement métallique. Tu descends sur le quai. Rien n'a changé — et pourtant tout est différent.",
    },
    {
      title: "L'entrepôt familial",
      body: "Tu pousses les grilles rouillées de Taxi Co. La cour est jonchée de débris. Dans un coin, le dernier taxi jaune de ton père dort sous une bâche.",
    },
    {
      title: "Un carnet noir",
      body: "Sur le bureau, le carnet du père. Une écriture serrée, des noms barrés, un numéro entouré : « B-12 ». Il est temps de remettre l'entreprise sur pied.",
    },
  ];
  const [i, setI] = useState(0);
  const isLast = i === slides.length - 1;
  const s = slides[i];
  return (
    <div className="ch1-overlay" data-no-pan>
      <div className="ch1-card ch1-intro">
        <div className="ch1-eyebrow">📖 Chapitre 1 — Le Retour</div>
        <h2>{s.title}</h2>
        <p>{s.body}</p>
        <div className="ch1-dots">
          {slides.map((_, k) => <span key={k} className={k === i ? "on" : ""} />)}
        </div>
        <div className="ch1-actions">
          <button className="ch1-btn-ghost" onClick={onDone}>Passer</button>
          <button
            className="ch1-btn"
            onClick={() => (isLast ? onDone() : setI(i + 1))}
          >
            {isLast ? "Prendre le volant ▶" : "Suite ▶"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionModal({
  title,
  desc,
  confirmLabel,
  onConfirm,
  onCancel,
  disabled,
}: {
  title: string;
  desc: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="ch1-overlay" data-no-pan onClick={onCancel}>
      <div className="ch1-card" onClick={(e) => e.stopPropagation()}>
        <div className="ch1-eyebrow">📖 Chapitre 1 — Objectif</div>
        <h2>{title}</h2>
        <p>{desc}</p>
        <div className="ch1-actions">
          <button className="ch1-btn-ghost" onClick={onCancel}>Plus tard</button>
          <button className="ch1-btn" onClick={onConfirm} disabled={disabled}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function OutroModal({
  chapterTitle,
  nextTitle,
  nextTeaser,
  onDone,
}: {
  chapterTitle: string;
  nextTitle: string;
  nextTeaser: string;
  onDone: () => void;
}) {
  return (
    <div className="ch1-overlay" data-no-pan>
      <div className="ch1-card ch1-outro">
        <div className="ch1-eyebrow ch1-success">✅ Chapitre terminé</div>
        <h2>Chapitre 1 — {chapterTitle}</h2>
        <p>
          La cour est propre, « Le Taxi du Père » ronronne à nouveau et ton premier client vient de descendre en te glissant un pourboire.
          Taxi Co. est officiellement de retour dans la course.
        </p>
        <div className="ch1-next">
          <div className="ch1-next-lab">Prochain chapitre débloqué</div>
          <div className="ch1-next-title">Chapitre 2 — {nextTitle}</div>
          {nextTeaser && <div className="ch1-next-sub">{nextTeaser}</div>}
          <div className="ch1-next-teaser">
            Marcel pousse la porte du dépôt, sa boîte à outils sous le bras. « J'ai toujours su que tu reviendrais. »
          </div>
        </div>
        <div className="ch1-actions">
          <button className="ch1-btn" onClick={onDone}>Continuer l'aventure ▶</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Styles
 * ============================================================ */

const css = `
.ch1-hud {
  position: fixed;
  left: 8px;
  top: 60px;
  z-index: 9400;
  width: min(280px, 78vw);
  background: linear-gradient(180deg, rgba(12,14,22,0.95), rgba(6,8,14,0.95));
  border: 1.5px solid rgba(245,197,66,0.55);
  border-radius: 12px;
  color: #fde047;
  font-family: system-ui, sans-serif;
  box-shadow: 0 6px 22px rgba(0,0,0,0.55);
  user-select: none;
}
.ch1-hud-head {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 10px; cursor: pointer;
  border-bottom: 1px solid rgba(245,197,66,0.2);
}
.ch1-badge {
  background: #f5c542; color: #1a1208;
  font-weight: 900; font-size: 10px;
  padding: 2px 6px; border-radius: 5px;
  letter-spacing: 0.5px;
}
.ch1-hud-title { flex: 1; font-size: 12px; font-weight: 800; color: #fde047; }
.ch1-hud-count {
  font-size: 11px; font-weight: 800; color: #9ca3af;
  background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 5px;
}
.ch1-hud-tog { color: #f5c542; font-size: 11px; }
.ch1-hud-list { list-style: none; margin: 0; padding: 6px 8px 8px; display: flex; flex-direction: column; gap: 4px; }
.ch1-hud-list li {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: #e5e7eb;
  padding: 4px 6px; border-radius: 6px;
  background: rgba(255,255,255,0.03);
}
.ch1-hud-list li.done { opacity: 0.6; text-decoration: line-through; }
.ch1-check { font-size: 12px; }
.ch1-lab { flex: 1; }
.ch1-act {
  background: linear-gradient(180deg, #f5c542, #d49419);
  color: #1a1208; border: none; border-radius: 6px;
  font-size: 10px; font-weight: 800; padding: 3px 7px;
  cursor: pointer; white-space: nowrap;
}
.ch1-act:active { transform: scale(0.95); }

.ch1-overlay {
  position: fixed; inset: 0; z-index: 13000;
  background: rgba(0,0,0,0.82);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
  animation: ch1FadeIn 0.25s ease;
}
@keyframes ch1FadeIn { from { opacity: 0; } to { opacity: 1; } }
.ch1-card {
  width: min(500px, 100%);
  background: linear-gradient(180deg, #12161d 0%, #0a0c10 100%);
  border: 2px solid #f5c542;
  border-radius: 16px;
  padding: 20px 22px 18px;
  color: #f3f4f6;
  font-family: system-ui, sans-serif;
  box-shadow: 0 30px 80px rgba(0,0,0,0.7);
  animation: ch1SlideUp 0.3s ease;
}
@keyframes ch1SlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.ch1-eyebrow {
  color: #f5c542; font-size: 11px; letter-spacing: 2px;
  text-transform: uppercase; font-weight: 800;
}
.ch1-eyebrow.ch1-success { color: #22c55e; }
.ch1-card h2 { margin: 6px 0 10px; font-size: 22px; color: #fde047; font-weight: 900; }
.ch1-card p { font-size: 14px; line-height: 1.55; color: #e5e7eb; margin: 0 0 14px; }
.ch1-dots { display: flex; gap: 6px; justify-content: center; margin: 8px 0 14px; }
.ch1-dots span { width: 8px; height: 8px; border-radius: 50%; background: rgba(245,197,66,0.25); }
.ch1-dots span.on { background: #f5c542; }
.ch1-actions { display: flex; gap: 10px; justify-content: flex-end; }
.ch1-btn {
  background: linear-gradient(180deg, #f5c542, #d49419);
  color: #1a1208; border: none; padding: 10px 16px;
  border-radius: 10px; font-weight: 900; font-size: 13px;
  cursor: pointer; letter-spacing: 0.5px;
}
.ch1-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ch1-btn-ghost {
  background: transparent; color: #9ca3af;
  border: 1px solid #4b5563; padding: 10px 14px;
  border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer;
}
.ch1-btn-ghost:hover { border-color: #f5c542; color: #f5c542; }
.ch1-next {
  margin: 4px 0 16px;
  padding: 12px 14px;
  background: linear-gradient(90deg, rgba(245,197,66,0.12), rgba(34,197,94,0.10));
  border: 1px solid rgba(245,197,66,0.5);
  border-radius: 10px;
}
.ch1-next-lab { font-size: 10px; letter-spacing: 2px; color: #22c55e; font-weight: 800; text-transform: uppercase; }
.ch1-next-title { font-size: 15px; font-weight: 900; color: #fde047; margin-top: 3px; }
.ch1-next-sub { font-size: 12px; color: #9ca3af; font-style: italic; margin-top: 2px; }
.ch1-next-teaser { font-size: 13px; color: #e5e7eb; margin-top: 8px; line-height: 1.4; }

@media (orientation: landscape) and (max-height: 500px) {
  .ch1-hud { top: 46px; width: 240px; }
  .ch1-card { padding: 14px 16px; }
  .ch1-card h2 { font-size: 18px; }
  .ch1-card p { font-size: 13px; }
}
`;
