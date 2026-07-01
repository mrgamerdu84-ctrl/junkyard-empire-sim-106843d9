import { useEffect, useMemo, useState } from "react";
import { ACTS, CHAPTERS, type CampaignChapter } from "./campaign/campaignData";
import {
  loadCampaign,
  startCampaign,
  completeMission,
  isChapterMissionsDone,
  recordChoice,
  completeChapter,
  resetCampaign,
  chapterProgress,
  type CampaignState,
} from "./campaign/campaignState";
import { resetFullGame } from "./resetGame";


export default function CampaignPanel({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<CampaignState>(() => startCampaign());
  const [openChapter, setOpenChapter] = useState<string | null>(null);

  useEffect(() => {
    const on = () => setState(loadCampaign());
    window.addEventListener("campaign.updated", on);
    return () => window.removeEventListener("campaign.updated", on);
  }, []);

  const activeChapter = useMemo<CampaignChapter | null>(() => {
    if (!openChapter) return null;
    return CHAPTERS.find((c) => c.id === openChapter) ?? null;
  }, [openChapter]);

  const unlockedIndex = state.currentChapterIndex;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <style>{css}</style>

        <div className="cp-head">
          <div>
            <div className="cp-eyebrow">Campagne narrative</div>
            <h2 className="cp-title">La Renaissance de Taxi Co.</h2>
          </div>
          <button className="cp-close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        {!activeChapter && (
          <div className="cp-body">
            {ACTS.map((act) => {
              const chapters = CHAPTERS.filter((c) => c.actId === act.id);
              return (
                <section key={act.id} className="cp-act">
                  <header className="cp-act-head">
                    <h3>{act.title}</h3>
                    <p>{act.tagline}</p>
                  </header>
                  <ul className="cp-chapters">
                    {chapters.map((ch) => {
                      const idx = CHAPTERS.findIndex((x) => x.id === ch.id);
                      const done = state.completedChapters.includes(ch.id);
                      const locked = idx > unlockedIndex;
                      return (
                        <li
                          key={ch.id}
                          className={`cp-chapter ${done ? "done" : ""} ${locked ? "locked" : ""}`}
                          onClick={() => !locked && setOpenChapter(ch.id)}
                        >
                          <span className="cp-chapter-num">{ch.number === 13 ? "★" : ch.number}</span>
                          <div className="cp-chapter-txt">
                            <div className="cp-chapter-title">{ch.title}</div>
                            {ch.subtitle && <div className="cp-chapter-sub">{ch.subtitle}</div>}
                            {!locked && !done && (() => {
                              const p = chapterProgress(ch.id);
                              return <div className="cp-chapter-sub">Progression : {p.done}/{p.total}{p.hasChoice ? (p.choiceDone ? " · choix ✓" : " · choix requis") : ""}</div>;
                            })()}
                          </div>
                          <span className="cp-chapter-state">
                            {locked ? "🔒" : done ? "✅" : "▶"}
                          </span>
                        </li>

                      );
                    })}
                  </ul>
                </section>
              );
            })}

            {state.empireUnlocked && (
              <div className="cp-empire">
                🏛️ <strong>Mode Empire déverrouillé</strong> — la campagne est terminée. Continue de bâtir ton empire.
              </div>
            )}

            <div className="cp-footer">
              {(state.choices.chap6 || state.choices.chap11) && (
                <div className="cp-choices-recap">
                  <strong>Tes choix :</strong>
                  {state.choices.chap6 && <span> Ch.6 → <em>{state.choices.chap6}</em></span>}
                  {state.choices.chap11 && <span> · Ch.11 → <em>{state.choices.chap11}</em></span>}
                </div>
              )}
              <button
                className="cp-reset"
                onClick={() => {
                  if (confirm("Recommencer une vraie nouvelle partie ? Toute la progression de jeu et de campagne sera remise au chapitre 1.")) {
                    resetFullGame().then(() => {
                      setState(resetCampaign());
                      window.location.reload();
                    });
                  }
                }}
              >
                Nouvelle partie
              </button>
            </div>
          </div>
        )}

        {activeChapter && (
          <ChapterView
            chapter={activeChapter}
            state={state}
            onBack={() => setOpenChapter(null)}
            onChoice={(cid, opt) => {
              const s = recordChoice(cid, opt);
              setState(s);
            }}
          />
        )}
      </div>
    </div>
  );
}

function ChapterView({
  chapter,
  state,
  onBack,
  onChoice,
}: {
  chapter: CampaignChapter;
  state: CampaignState;
  onBack: () => void;
  onChoice: (id: "chap6" | "chap11", opt: string) => void;
}) {
  const doneMissions = new Set(state.completedMissions[chapter.id] ?? []);
  const already = state.completedChapters.includes(chapter.id);

  return (
    <div className="cp-body">
      <button className="cp-back" onClick={onBack}>← Retour aux chapitres</button>

      <div className="cp-chapter-hero">
        <div className="cp-hero-num">Chapitre {chapter.number === 13 ? "★" : chapter.number}</div>
        <h3>{chapter.title}</h3>
        {chapter.subtitle && <div className="cp-hero-sub">{chapter.subtitle}</div>}
      </div>

      <div className="cp-narrative">
        {chapter.narrative.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <div className="cp-section-title">Objectifs (validés automatiquement)</div>
      <ul className="cp-missions cp-missions-readonly">
        {chapter.missions.map((m) => {
          const done = doneMissions.has(m.id);
          return (
            <li key={m.id} className={done ? "done" : ""}>
              <span className="cp-check">{done ? "☑" : "☐"}</span>
              <div>
                <div className="cp-m-title">{m.title}</div>
                {m.hint && <div className="cp-m-hint">{m.hint}</div>}
              </div>
            </li>
          );
        })}
      </ul>

      {chapter.choice && (
        <>
          <div className="cp-section-title">Ton choix</div>
          <div className="cp-choice-prompt">{chapter.choice.prompt}</div>
          <div className="cp-options">
            {chapter.choice.options.map((opt) => {
              const active = state.choices[chapter.choice!.id] === opt.id;
              return (
                <button
                  key={opt.id}
                  className={`cp-option ${active ? "active" : ""}`}
                  onClick={() => onChoice(chapter.choice!.id, opt.id)}
                >
                  <div className="cp-option-title">{opt.label}</div>
                  <div className="cp-option-desc">{opt.description}</div>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="cp-auto-note">
        {already
          ? "✅ Chapitre déjà terminé."
          : "Aucun bouton à cliquer : joue normalement (courses, argent, améliorations). Quand la barre atteint 100%, la cinématique se lance et le chapitre suivant se débloque automatiquement."}
      </div>
    </div>
  );
}

/* --- styles --- */

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.75)",
  zIndex: 12000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 12,
};

const cardStyle: React.CSSProperties = {
  width: "min(720px, 100%)",
  maxHeight: "92vh",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  background: "linear-gradient(180deg, #12161d 0%, #0a0c10 100%)",
  border: "2px solid #f5c542",
  borderRadius: 18,
  boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
  color: "#f3f4f6",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

const css = `
.cp-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid rgba(245,197,66,0.25);
  background: linear-gradient(180deg, rgba(245,197,66,0.08), transparent);
}
.cp-eyebrow { color: #f5c542; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; font-weight: 800; }
.cp-title { margin: 2px 0 0; font-size: 22px; color: #fde047; font-weight: 900; letter-spacing: 0.5px; }
.cp-close { background: transparent; border: none; color: #fde047; font-size: 22px; cursor: pointer; padding: 6px 10px; }
.cp-body { padding: 16px 20px 22px; overflow-y: auto; }
.cp-act { margin-bottom: 18px; }
.cp-act-head h3 { margin: 0; color: #f5c542; font-size: 15px; letter-spacing: 0.5px; }
.cp-act-head p { margin: 2px 0 8px; color: #9ca3af; font-size: 12px; font-style: italic; }
.cp-chapters { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.cp-chapter {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.cp-chapter:hover:not(.locked) { background: rgba(245,197,66,0.09); border-color: rgba(245,197,66,0.4); }
.cp-chapter.locked { opacity: 0.45; cursor: not-allowed; }
.cp-chapter.done { border-color: rgba(34,197,94,0.5); background: rgba(34,197,94,0.08); }
.cp-chapter-num {
  width: 30px; height: 30px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: #f5c542; color: #1a1208; font-weight: 900; flex-shrink: 0;
}
.cp-chapter-txt { flex: 1; min-width: 0; }
.cp-chapter-title { font-weight: 700; font-size: 14px; }
.cp-chapter-sub { font-size: 12px; color: #9ca3af; margin-top: 2px; }
.cp-chapter-state { font-size: 16px; }
.cp-empire {
  margin-top: 12px; padding: 12px 14px; border-radius: 10px;
  background: linear-gradient(90deg, rgba(245,197,66,0.15), rgba(34,197,94,0.15));
  border: 1px solid #f5c542; font-size: 14px;
}
.cp-footer { margin-top: 16px; display: flex; flex-direction: column; gap: 10px; }
.cp-choices-recap { font-size: 12px; color: #d1d5db; }
.cp-reset {
  align-self: flex-start;
  background: transparent; border: 1px solid #6b7280; color: #9ca3af;
  padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 12px;
}
.cp-reset:hover { border-color: #ef4444; color: #ef4444; }

.cp-back {
  background: transparent; border: none; color: #f5c542;
  cursor: pointer; padding: 4px 0; font-size: 13px; margin-bottom: 10px;
}
.cp-chapter-hero { text-align: center; margin: 4px 0 12px; }
.cp-hero-num { color: #f5c542; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; font-weight: 800; }
.cp-chapter-hero h3 { margin: 4px 0 0; font-size: 22px; color: #fde047; }
.cp-hero-sub { color: #9ca3af; font-size: 13px; margin-top: 4px; font-style: italic; }
.cp-narrative {
  background: rgba(255,255,255,0.03); border-left: 3px solid #f5c542;
  padding: 12px 14px; border-radius: 8px; margin-bottom: 14px;
}
.cp-narrative p { margin: 0 0 8px; font-size: 14px; line-height: 1.55; color: #e5e7eb; }
.cp-narrative p:last-child { margin-bottom: 0; }
.cp-section-title {
  color: #f5c542; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;
  font-weight: 800; margin: 14px 0 8px;
}
.cp-missions { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.cp-missions li {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 10px 12px; background: rgba(255,255,255,0.04);
  border-radius: 8px; cursor: pointer; border: 1px solid rgba(255,255,255,0.06);
}
.cp-missions li:hover { background: rgba(245,197,66,0.08); }
.cp-missions li.done { opacity: 0.65; text-decoration: line-through; }
.cp-check { font-size: 18px; color: #f5c542; }
.cp-m-title { font-size: 14px; font-weight: 600; }
.cp-m-hint { font-size: 12px; color: #9ca3af; margin-top: 2px; }
.cp-choice-prompt { font-size: 14px; margin-bottom: 8px; color: #fde047; font-weight: 600; }
.cp-options { display: flex; flex-direction: column; gap: 8px; }
.cp-option {
  text-align: left; padding: 10px 12px; border-radius: 10px;
  background: rgba(255,255,255,0.04); border: 1.5px solid rgba(255,255,255,0.08);
  color: #e5e7eb; cursor: pointer;
}
.cp-option:hover { border-color: rgba(245,197,66,0.5); }
.cp-option.active { border-color: #f5c542; background: rgba(245,197,66,0.15); }
.cp-option-title { font-weight: 800; font-size: 14px; color: #fde047; }
.cp-option-desc { font-size: 12px; color: #d1d5db; margin-top: 3px; }
.cp-auto-note {
  margin-top: 16px; padding: 12px 14px; border-radius: 10px;
  background: rgba(245,197,66,0.08); border: 1px solid rgba(245,197,66,0.35);
  color: #fde047; font-size: 13px; line-height: 1.4; text-align: center;
}
`;
