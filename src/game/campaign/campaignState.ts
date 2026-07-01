// Persistance locale de la campagne narrative.
// Isolée du reste : rien d'autre ne lit/écrit ces clés.

import { CHAPTERS } from "./campaignData";

const KEY = "campaign_state_v1";

export type CampaignChoiceId = "chap6" | "chap11";

export type CampaignState = {
  currentChapterIndex: number; // 0..CHAPTERS.length-1
  completedChapters: string[];
  completedMissions: Record<string, string[]>; // chapterId -> mission ids
  choices: Partial<Record<CampaignChoiceId, string>>;
  empireUnlocked: boolean;
  started: boolean;
};

const DEFAULT: CampaignState = {
  currentChapterIndex: 0,
  completedChapters: [],
  completedMissions: {},
  choices: {},
  empireUnlocked: false,
  started: false,
};

export function loadCampaign(): CampaignState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT, ...parsed, completedMissions: { ...(parsed.completedMissions ?? {}) }, choices: { ...(parsed.choices ?? {}) } };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveCampaign(s: CampaignState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent("campaign.updated"));
  } catch {}
}

export function startCampaign(): CampaignState {
  const s = loadCampaign();
  if (!s.started) {
    s.started = true;
    saveCampaign(s);
  }
  return s;
}

export function resetCampaign(): CampaignState {
  const s = { ...DEFAULT };
  saveCampaign(s);
  return s;
}

export function toggleMission(chapterId: string, missionId: string): CampaignState {
  const s = loadCampaign();
  const list = new Set(s.completedMissions[chapterId] ?? []);
  if (list.has(missionId)) list.delete(missionId);
  else list.add(missionId);
  s.completedMissions[chapterId] = Array.from(list);
  saveCampaign(s);
  maybeAutoComplete(chapterId);
  return loadCampaign();
}

export function completeMission(chapterId: string, missionId: string): CampaignState {
  const s = loadCampaign();
  const list = new Set(s.completedMissions[chapterId] ?? []);
  if (!list.has(missionId)) {
    list.add(missionId);
    s.completedMissions[chapterId] = Array.from(list);
    saveCampaign(s);
  }
  maybeAutoComplete(chapterId);
  return loadCampaign();
}

export function isChapterMissionsDone(chapterId: string): boolean {
  const ch = CHAPTERS.find((c) => c.id === chapterId);
  if (!ch) return false;
  const done = new Set((loadCampaign().completedMissions[chapterId] ?? []));
  return ch.missions.every((m) => done.has(m.id));
}

export function recordChoice(id: CampaignChoiceId, optionId: string): CampaignState {
  const s = loadCampaign();
  s.choices[id] = optionId;
  saveCampaign(s);
  // Un choix peut suffire à finaliser un chapitre
  const chapter = CHAPTERS.find((c) => c.choice?.id === id);
  if (chapter) maybeAutoComplete(chapter.id);
  return loadCampaign();
}

export function completeChapter(chapterId: string): CampaignState {
  const s = loadCampaign();
  if (!s.completedChapters.includes(chapterId)) {
    s.completedChapters.push(chapterId);
  }
  const idx = CHAPTERS.findIndex((c) => c.id === chapterId);
  if (idx >= 0 && idx < CHAPTERS.length - 1) {
    s.currentChapterIndex = Math.max(s.currentChapterIndex, idx + 1);
  }
  const ch = CHAPTERS[idx];
  if (ch && (ch.number === 12 || ch.id === "epilogue")) {
    s.empireUnlocked = true;
  }
  saveCampaign(s);
  try {
    window.dispatchEvent(new CustomEvent("campaign.chapter.completed", { detail: { chapterId } }));
  } catch {}
  return loadCampaign();
}

/** Auto-avance si le chapitre est intégralement rempli (missions + choix éventuel). */
function maybeAutoComplete(chapterId: string) {
  const s = loadCampaign();
  if (s.completedChapters.includes(chapterId)) return;
  const ch = CHAPTERS.find((c) => c.id === chapterId);
  if (!ch) return;
  const done = new Set(s.completedMissions[chapterId] ?? []);
  const missionsDone = ch.missions.every((m) => done.has(m.id));
  const choiceDone = ch.choice ? Boolean(s.choices[ch.choice.id]) : true;
  if (missionsDone && choiceDone) {
    completeChapter(chapterId);
  }
}

export function chapterProgress(chapterId: string): { done: number; total: number; hasChoice: boolean; choiceDone: boolean } {
  const ch = CHAPTERS.find((c) => c.id === chapterId);
  if (!ch) return { done: 0, total: 0, hasChoice: false, choiceDone: false };
  const s = loadCampaign();
  const done = new Set(s.completedMissions[chapterId] ?? []);
  return {
    done: ch.missions.filter((m) => done.has(m.id)).length,
    total: ch.missions.length,
    hasChoice: Boolean(ch.choice),
    choiceDone: ch.choice ? Boolean(s.choices[ch.choice.id]) : true,
  };
}

export function isEmpireUnlocked(): boolean {
  return loadCampaign().empireUnlocked;
}

/** Niveau visuel du dépôt (1..5) selon la progression narrative. */
export function depotLevel(): 1 | 2 | 3 | 4 | 5 {
  const s = loadCampaign();
  const idx = s.currentChapterIndex; // 0 = ch1
  if (s.empireUnlocked || idx >= 11) return 5;
  if (idx >= 8) return 4;
  if (idx >= 5) return 3;
  if (idx >= 2) return 2;
  return 1;
}

/** Nombre de taxis débloqués par la campagne (soft cap indicatif). */
export function unlockedTaxiCount(): number {
  const s = loadCampaign();
  const idx = s.currentChapterIndex;
  if (s.empireUnlocked) return 99;
  if (idx >= 10) return 12;
  if (idx >= 7) return 8;
  if (idx >= 5) return 5;
  if (idx >= 2) return 3;
  if (idx >= 1) return 2;
  return 1;
}

