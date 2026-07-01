// Système de progression 0-100% par chapitre.
// La barre se remplit via missions + courses + argent + véhicules + upgrades dépôt.
// Quand la barre atteint 100% → auto-complétion du chapitre (aucun clic joueur).
//
// Les compteurs sont incrémentaux par chapitre (remis à zéro à l'entrée du chapitre).
// Ne modifie AUCUN autre système : lit `taxi-tycoon-v4` en snapshot pour dériver
// argent gagné / véhicules achetés / niveau de dépôt atteint pendant le chapitre.

import { CHAPTERS } from "./campaignData";
import { loadCampaign, saveCampaign, completeChapter, chapterProgress } from "./campaignState";
import { CAMPAIGN_COUNTERS_KEY, GAME_SAVE_KEY } from "../resetGame";

export type ChapterGoals = {
  courses: number;
  moneyEarned: number;
  vehiclesBought: number;
  depotUpgrades: number;
  // Poids relatifs (somme libre — normalisée à 100%).
  weights: { missions: number; courses: number; money: number; vehicles: number; upgrades: number };
};

// Objectifs par chapitre : volontairement exigeants pour étirer chaque chapitre
// sur plusieurs sessions. Les premiers chapitres restent accessibles ; les
// suivants demandent une flotte + trésorerie plus solide.
export const CHAPTER_GOALS: Record<string, ChapterGoals> = {
  ch1:  { courses:   8, moneyEarned:    600, vehiclesBought: 0, depotUpgrades: 0, weights: { missions: 55, courses: 25, money: 15, vehicles:  0, upgrades:  5 } },
  ch2:  { courses:  25, moneyEarned:   3000, vehiclesBought: 1, depotUpgrades: 1, weights: { missions: 40, courses: 25, money: 15, vehicles: 10, upgrades: 10 } },
  ch3:  { courses:  40, moneyEarned:   6500, vehiclesBought: 1, depotUpgrades: 1, weights: { missions: 40, courses: 25, money: 15, vehicles: 10, upgrades: 10 } },
  ch4:  { courses:  55, moneyEarned:  10000, vehiclesBought: 1, depotUpgrades: 1, weights: { missions: 40, courses: 25, money: 15, vehicles: 10, upgrades: 10 } },
  ch5:  { courses:  75, moneyEarned:  16000, vehiclesBought: 2, depotUpgrades: 1, weights: { missions: 35, courses: 25, money: 15, vehicles: 15, upgrades: 10 } },
  ch6:  { courses: 100, moneyEarned:  24000, vehiclesBought: 2, depotUpgrades: 1, weights: { missions: 35, courses: 25, money: 15, vehicles: 15, upgrades: 10 } },
  ch7:  { courses: 130, moneyEarned:  35000, vehiclesBought: 2, depotUpgrades: 1, weights: { missions: 35, courses: 25, money: 15, vehicles: 15, upgrades: 10 } },
  ch8:  { courses: 160, moneyEarned:  50000, vehiclesBought: 3, depotUpgrades: 1, weights: { missions: 35, courses: 25, money: 15, vehicles: 15, upgrades: 10 } },
  ch9:  { courses: 200, moneyEarned:  75000, vehiclesBought: 3, depotUpgrades: 1, weights: { missions: 35, courses: 25, money: 15, vehicles: 15, upgrades: 10 } },
  ch10: { courses: 240, moneyEarned: 110000, vehiclesBought: 3, depotUpgrades: 1, weights: { missions: 35, courses: 25, money: 15, vehicles: 15, upgrades: 10 } },
  ch11: { courses: 280, moneyEarned: 160000, vehiclesBought: 4, depotUpgrades: 1, weights: { missions: 40, courses: 20, money: 15, vehicles: 15, upgrades: 10 } },
  ch12: { courses: 350, moneyEarned: 240000, vehiclesBought: 4, depotUpgrades: 1, weights: { missions: 45, courses: 20, money: 15, vehicles: 10, upgrades: 10 } },
  epilogue: { courses: 400, moneyEarned: 320000, vehiclesBought: 5, depotUpgrades: 1, weights: { missions: 60, courses: 15, money: 10, vehicles: 10, upgrades: 5 } },
};

export type ChapterCounters = {
  courses: number;
  moneyEarned: number;
  vehiclesBought: number;
  depotUpgrades: number;
  // Snapshots pris à l'entrée du chapitre pour calculer les deltas.
  baseline: { money: number; taxis: number; depotTier: number };
};

const CKEY = CAMPAIGN_COUNTERS_KEY;
const SAVE_KEY = GAME_SAVE_KEY;

function readSnapshot(): { money: number; taxis: number; depotTier: number } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { money: 0, taxis: 0, depotTier: 0 };
    const s = JSON.parse(raw);
    return {
      money: Number(s?.money ?? 0),
      taxis: Array.isArray(s?.taxis) ? s.taxis.length : 0,
      depotTier: Number(s?.depotTier ?? 0),
    };
  } catch {
    return { money: 0, taxis: 0, depotTier: 0 };
  }
}

function loadAll(): Record<string, ChapterCounters> {
  try {
    const raw = localStorage.getItem(CKEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveAll(m: Record<string, ChapterCounters>) {
  try { localStorage.setItem(CKEY, JSON.stringify(m)); } catch {}
}

export function getCounters(chapterId: string): ChapterCounters {
  const all = loadAll();
  if (!all[chapterId]) {
    all[chapterId] = {
      courses: 0, moneyEarned: 0, vehiclesBought: 0, depotUpgrades: 0,
      baseline: readSnapshot(),
    };
    saveAll(all);
  }
  return all[chapterId];
}

export function bumpCourse() {
  const s = loadCampaign();
  const ch = CHAPTERS[s.currentChapterIndex];
  if (!ch || s.completedChapters.includes(ch.id)) return;
  const all = loadAll();
  const c = all[ch.id] ?? getCounters(ch.id);
  c.courses += 1;
  all[ch.id] = c;
  saveAll(all);
  try { window.dispatchEvent(new CustomEvent("campaign.progress.tick")); } catch {}
}

/** Recalcule les compteurs dérivés (argent / véhicules / dépôt) depuis la sauvegarde. */
export function refreshDerivedCounters() {
  const s = loadCampaign();
  const ch = CHAPTERS[s.currentChapterIndex];
  if (!ch || s.completedChapters.includes(ch.id)) return;
  const snap = readSnapshot();
  const all = loadAll();
  const c = all[ch.id] ?? getCounters(ch.id);
  c.moneyEarned = Math.max(c.moneyEarned, Math.max(0, snap.money - c.baseline.money));
  c.vehiclesBought = Math.max(c.vehiclesBought, Math.max(0, snap.taxis - c.baseline.taxis));
  c.depotUpgrades = Math.max(c.depotUpgrades, Math.max(0, snap.depotTier - c.baseline.depotTier));
  all[ch.id] = c;
  saveAll(all);
}

/** Progression 0..100 pondérée. */
export function chapterProgressPercent(chapterId: string): number {
  const goals = CHAPTER_GOALS[chapterId];
  if (!goals) return 0;
  const c = getCounters(chapterId);
  const m = chapterProgress(chapterId);
  const missionsFrac = m.total > 0 ? m.done / m.total : 1;
  const choiceOk = m.hasChoice ? (m.choiceDone ? 1 : 0.5) : 1;
  const missions = Math.min(1, missionsFrac) * choiceOk;
  const courses = goals.courses > 0 ? Math.min(1, c.courses / goals.courses) : 1;
  const money = goals.moneyEarned > 0 ? Math.min(1, c.moneyEarned / goals.moneyEarned) : 1;
  const vehicles = goals.vehiclesBought > 0 ? Math.min(1, c.vehiclesBought / goals.vehiclesBought) : 1;
  const upgrades = goals.depotUpgrades > 0 ? Math.min(1, c.depotUpgrades / goals.depotUpgrades) : 1;
  const w = goals.weights;
  const totalW = w.missions + w.courses + w.money + w.vehicles + w.upgrades;
  const pct = ((missions * w.missions) + (courses * w.courses) + (money * w.money) + (vehicles * w.vehicles) + (upgrades * w.upgrades)) / totalW;
  return Math.round(pct * 100);
}

/** Détail de progression pour l'UI. */
export function chapterProgressDetail(chapterId: string) {
  const goals = CHAPTER_GOALS[chapterId];
  const c = getCounters(chapterId);
  const m = chapterProgress(chapterId);
  return {
    percent: chapterProgressPercent(chapterId),
    missions: { done: m.done, total: m.total, choice: m.hasChoice ? m.choiceDone : true },
    courses: { done: c.courses, goal: goals?.courses ?? 0 },
    money: { done: c.moneyEarned, goal: goals?.moneyEarned ?? 0 },
    vehicles: { done: c.vehiclesBought, goal: goals?.vehiclesBought ?? 0 },
    upgrades: { done: c.depotUpgrades, goal: goals?.depotUpgrades ?? 0 },
  };
}

/** Auto-complétion : si 100% atteint, on marque le chapitre terminé. */
export function maybeAutoCompleteByProgress() {
  const s = loadCampaign();
  const ch = CHAPTERS[s.currentChapterIndex];
  if (!ch) return;
  if (s.completedChapters.includes(ch.id)) return;
  // Un chapitre avec choix obligatoire ne peut pas se conclure sans le choix.
  const m = chapterProgress(ch.id);
  if (m.hasChoice && !m.choiceDone) return;
  const pct = chapterProgressPercent(ch.id);
  if (pct >= 100) {
    completeChapter(ch.id);
  }
}

/** Reset volontaire (rejouer la campagne). */
export function resetProgression() {
  try { localStorage.removeItem(CKEY); } catch {}
  // Force re-baseline
  saveCampaign(loadCampaign());
}
