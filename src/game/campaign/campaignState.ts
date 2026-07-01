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
  return s;
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
  return s;
}

export function completeChapter(chapterId: string): CampaignState {
  const s = loadCampaign();
  if (!s.completedChapters.includes(chapterId)) {
    s.completedChapters.push(chapterId);
  }
  // Avance au chapitre suivant
  const idx = CHAPTERS.findIndex((c) => c.id === chapterId);
  if (idx >= 0 && idx < CHAPTERS.length - 1) {
    s.currentChapterIndex = Math.max(s.currentChapterIndex, idx + 1);
  }
  // Épilogue = déblocage Mode Empire
  const ch = CHAPTERS[idx];
  if (ch && (ch.number === 12 || ch.id === "epilogue")) {
    s.empireUnlocked = true;
  }
  saveCampaign(s);
  return s;
}

export function isEmpireUnlocked(): boolean {
  return loadCampaign().empireUnlocked;
}
