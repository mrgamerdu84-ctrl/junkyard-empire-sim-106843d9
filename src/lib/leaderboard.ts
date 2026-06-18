/* ============================================================
 * LEADERBOARD — Classement quotidien local + récompense hebdo.
 * ============================================================
 * Stocke les gains par jour (YYYY-MM-DD) dans localStorage.
 * Tous les lundis, le meilleur jour de la semaine écoulée
 * débloque le "Taxi d'Or" pour la semaine suivante.
 * ============================================================ */

const SCORES_KEY = "tt-daily-scores";
const UNLOCK_KEY = "tt-special-taxi-unlocked";
const LAST_WEEK_KEY = "tt-last-week-processed";
const BEST_WEEK_KEY = "tt-best-week-score";

export type DailyScores = Record<string, number>; // "YYYY-MM-DD" -> total $ gagnés ce jour

function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Renvoie le numéro de semaine ISO (année-semaine). */
function weekKey(d: Date = new Date()): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function loadScores(): DailyScores {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(SCORES_KEY) || "{}"); } catch { return {}; }
}

function saveScores(s: DailyScores) {
  try { localStorage.setItem(SCORES_KEY, JSON.stringify(s)); } catch {}
}

/** Ajoute des gains au score du jour. */
export function recordEarning(amount: number) {
  if (typeof window === "undefined" || amount <= 0) return;
  const s = loadScores();
  const k = today();
  s[k] = (s[k] || 0) + amount;
  saveScores(s);
  checkWeeklyReward();
}

/** Liste les 7 derniers jours triés par score décroissant. */
export function getLast7Days(): Array<{ date: string; score: number; label: string }> {
  const s = loadScores();
  const out: Array<{ date: string; score: number; label: string }> = [];
  const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${day}`;
    out.push({ date: key, score: s[key] || 0, label: days[d.getDay()] });
  }
  return out;
}

export function getTodayScore(): number {
  return loadScores()[today()] || 0;
}

export function isSpecialTaxiUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(UNLOCK_KEY) === "1"; } catch { return false; }
}

export function setSpecialTaxiUnlocked(v: boolean) {
  try { localStorage.setItem(UNLOCK_KEY, v ? "1" : "0"); } catch {}
}

export function getBestWeekScore(): number {
  if (typeof window === "undefined") return 0;
  try { return Number(localStorage.getItem(BEST_WEEK_KEY) || "0"); } catch { return 0; }
}

/** Vérifie si une nouvelle semaine a commencé et calcule le gagnant de la précédente. */
function checkWeeklyReward() {
  const now = new Date();
  const currentWeek = weekKey(now);
  const lastProcessed = localStorage.getItem(LAST_WEEK_KEY);

  // Première fois : enregistre simplement la semaine
  if (!lastProcessed) {
    localStorage.setItem(LAST_WEEK_KEY, currentWeek);
    return;
  }

  if (lastProcessed === currentWeek) return; // même semaine, rien à faire

  // Nouvelle semaine : calcule le meilleur jour de la semaine précédente
  const scores = loadScores();
  const lastWeekStart = new Date(now);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  let best = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(lastWeekStart);
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const k = `${y}-${m}-${day}`;
    if ((scores[k] || 0) > best) best = scores[k] || 0;
  }

  if (best > 0) {
    setSpecialTaxiUnlocked(true);
    localStorage.setItem(BEST_WEEK_KEY, String(best));
  }
  localStorage.setItem(LAST_WEEK_KEY, currentWeek);
}

const TUTORIAL_KEY = "tt-tutorial-seen";

export function hasSeenTutorial(): boolean {
  if (typeof window === "undefined") return true;
  try { return localStorage.getItem(TUTORIAL_KEY) === "1"; } catch { return true; }
}

export function markTutorialSeen() {
  try { localStorage.setItem(TUTORIAL_KEY, "1"); } catch {}
}

export function resetTutorial() {
  try { localStorage.removeItem(TUTORIAL_KEY); } catch {}
}
