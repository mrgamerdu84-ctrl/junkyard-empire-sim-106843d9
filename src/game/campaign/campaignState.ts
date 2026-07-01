// Persistance locale de la campagne narrative.
// Isolée du reste : rien d'autre ne lit/écrit ces clés.

import { CHAPTERS } from "./campaignData";
import { CAMPAIGN_STATE_KEY } from "../resetGame";

const KEY = CAMPAIGN_STATE_KEY;

export type CampaignChoiceId = "chap6" | "chap11";

export type CampaignState = {
  currentChapterIndex: number; // 0..CHAPTERS.length-1
  completedChapters: string[];
  completedMissions: Record<string, string[]>; // chapterId -> mission ids
  choices: Partial<Record<CampaignChoiceId, string>>;
  empireUnlocked: boolean;
  started: boolean;
};

function makeDefault(): CampaignState {
  return {
    currentChapterIndex: 0,
    completedChapters: [],
    completedMissions: {},
    choices: {},
    empireUnlocked: false,
    started: false,
  };
}

const DEFAULT: CampaignState = makeDefault();

export function loadCampaign(): CampaignState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return makeDefault();
    const parsed = JSON.parse(raw);
    return { ...makeDefault(), ...parsed, completedChapters: Array.isArray(parsed.completedChapters) ? [...parsed.completedChapters] : [], completedMissions: { ...(parsed.completedMissions ?? {}) }, choices: { ...(parsed.choices ?? {}) } };
  } catch {
    return makeDefault();
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
  const s = makeDefault();
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

/** Nombre de taxis débloqués par la campagne (hard cap sur la flotte joueur).
 *  Règle : 1 taxi débloqué = 1 chapitre terminé ou 1 objectif spécifique validé.
 *  - Ch1 (Le Retour) : 1 seul vieux taxi.
 *  - Ch2 (La Reconstruction) : +1 après l'objectif "Acheter un deuxième taxi" (m2d).
 *  - Puis chaque chapitre terminé débloque un ou plusieurs taxis supplémentaires.
 */
export function unlockedTaxiCount(): number {
  const s = loadCampaign();
  if (s.empireUnlocked) return 99;
  const done = new Set(s.completedChapters);
  const m2d = (s.completedMissions["ch2"] ?? []).includes("m2d");
  let n = 1;
  if (m2d || done.has("ch2")) n = Math.max(n, 2);
  if (done.has("ch3")) n = Math.max(n, 3);
  if (done.has("ch4")) n = Math.max(n, 4);
  if (done.has("ch5")) n = Math.max(n, 5);
  if (done.has("ch6")) n = Math.max(n, 6);
  if (done.has("ch7")) n = Math.max(n, 8);
  if (done.has("ch8")) n = Math.max(n, 9);
  if (done.has("ch9")) n = Math.max(n, 10);
  if (done.has("ch10")) n = Math.max(n, 12);
  if (done.has("ch11")) n = Math.max(n, 15);
  if (done.has("ch12")) n = Math.max(n, 20);
  return n;
}

