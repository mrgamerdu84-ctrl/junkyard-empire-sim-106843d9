// HUD compact affichant le chapitre en cours et l'objectif prioritaire.
// Non-invasif : lit uniquement l'état de la campagne, ne modifie aucun autre système.
import { useEffect, useState, useMemo } from "react";
import { CHAPTERS } from "./campaign/campaignData";
import { loadCampaign, chapterProgress, type CampaignState } from "./campaign/campaignState";
import CampaignPanel from "./CampaignPanel";

export default function CampaignHud() {
  const [state, setState] = useState<CampaignState>(() => loadCampaign());
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    const on = () => setState(loadCampaign());
    window.addEventListener("campaign.updated", on);
    return () => window.removeEventListener("campaign.updated", on);
  }, []);

  const chapter = useMemo(() => CHAPTERS[state.currentChapterIndex] ?? null, [state.currentChapterIndex]);

  if (!state.started || !chapter) return null;

  const prog = chapterProgress(chapter.id);
  const doneSet = new Set(state.completedMissions[chapter.id] ?? []);
  const nextMission = chapter.missions.find((m) => !doneSet.has(m.id));
  const pct = prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;

  return (
    <>
      <div
        className="cphud"
        data-no-pan
        onClick={() => (minimized ? setMinimized(false) : setOpen(true))}
      >
        <style>{css}</style>
        <div className="cphud-row">
          <span className="cphud-badge">Ch. {chapter.number === 13 ? "★" : chapter.number}</span>
          <div className="cphud-info">
            <div className="cphud-title">{chapter.title}</div>
            {!minimized && (
              <div className="cphud-sub">
                {nextMission
                  ? `▶ ${nextMission.title}`
                  : prog.hasChoice && !prog.choiceDone
                    ? "▶ Fais ton choix"
                    : "✅ Chapitre terminé"}
              </div>
            )}
          </div>
          <div className="cphud-count">
            {prog.done}/{prog.total}
          </div>
          <button
            className="cphud-min"
            onClick={(e) => {
              e.stopPropagation();
              setMinimized((v) => !v);
            }}
            aria-label={minimized ? "Agrandir" : "Réduire"}
          >
            {minimized ? "▸" : "▾"}
          </button>
        </div>
        {!minimized && (
          <div className="cphud-bar">
            <div className="cphud-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      {open && <CampaignPanel onClose={() => setOpen(false)} />}
    </>
  );
}

const css = `
.cphud {
  position: fixed;
  top: 8px; left: 50%;
  transform: translateX(-50%);
  z-index: 9500;
  min-width: 240px; max-width: 92vw;
  padding: 8px 10px 9px;
  background: linear-gradient(180deg, rgba(12,14,22,0.94), rgba(6,8,14,0.94));
  border: 1.5px solid rgba(245,197,66,0.55);
  border-radius: 12px;
  color: #fde047;
  font-family: system-ui, sans-serif;
  box-shadow: 0 6px 22px rgba(0,0,0,0.55);
  cursor: pointer;
  user-select: none;
}
.cphud-row { display: flex; align-items: center; gap: 8px; }
.cphud-badge {
  flex-shrink: 0;
  background: #f5c542; color: #1a1208;
  font-weight: 900; font-size: 11px;
  padding: 3px 7px; border-radius: 6px;
  letter-spacing: 0.5px;
}
.cphud-info { flex: 1; min-width: 0; }
.cphud-title { font-size: 12px; font-weight: 800; color: #fde047; line-height: 1.1; }
.cphud-sub { font-size: 11px; color: #e5e7eb; margin-top: 2px; opacity: 0.92; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cphud-count {
  flex-shrink: 0; font-size: 11px; font-weight: 800; color: #9ca3af;
  background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 5px;
}
.cphud-min {
  background: transparent; border: none; color: #f5c542;
  font-size: 12px; cursor: pointer; padding: 2px 4px;
}
.cphud-bar { margin-top: 6px; height: 3px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; }
.cphud-bar-fill { height: 100%; background: linear-gradient(90deg, #f5c542, #22c55e); transition: width 0.3s; }
@media (orientation: landscape) and (max-height: 500px) {
  .cphud { top: 4px; padding: 5px 8px 6px; min-width: 200px; }
  .cphud-title { font-size: 11px; }
  .cphud-sub { font-size: 10px; }
}
`;
