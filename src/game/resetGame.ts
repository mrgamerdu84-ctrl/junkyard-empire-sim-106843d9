// Reset centralisé d'une vraie "Nouvelle partie".
// Conserve les préférences globales/admin, mais efface toute progression de jeu.

export const GAME_SAVE_KEY = "taxi-tycoon-v4";
export const CAMPAIGN_STATE_KEY = "campaign_state_v1";
export const CAMPAIGN_COUNTERS_KEY = "campaign_counters_v1";
export const RESET_MARKER_KEY = "mtw.newGameResetAt";

export const DEFAULT_NEW_GAME_SAVE = {
  money: 250,
  customersServed: 0,
  totalEarned: 0,
  depotTier: 0,
  taxiSpeedLvl: 0,
  taxis: [{ colorId: "yellow" }],
  defaultColor: "yellow",
  jobsCompleted: 0,
  liveryId: "classic",
  hqCapacityLvl: 0,
  hqProductionLvl: 0,
  hqRevenueLvl: 0,
  cityFund: 0,
  playerTaxiColor: "blue",
  taxiWear: 0,
};

const DEFAULT_CAMPAIGN_STATE = {
  currentChapterIndex: 0,
  completedChapters: [],
  completedMissions: {},
  choices: {},
  empireUnlocked: false,
  started: false,
};

const STORY_STATE_KEYS = [
  "mtw.dealership.v1",
  "mtw.godfather.v1",
  "mtw.personnel.v1",
  "mtw.intro.seen.v1",
  "mtw.ch1.intro.seen",
  "mtw.ch1.outro.seen",
  "mtw.ch1.yard.cleaned",
  "mtw.ch1.taxi.repaired",
  "tt-daily-scores",
  "tt-special-taxi-unlocked",
  "tt-last-week-processed",
  "tt-best-week-score",
  "tt-tutorial-seen",
];

function emitResetEvents() {
  try { window.dispatchEvent(new CustomEvent("mtw:new-game-reset")); } catch {}
  try { window.dispatchEvent(new CustomEvent("campaign.updated")); } catch {}
  try { window.dispatchEvent(new CustomEvent("mtw:personnel-changed")); } catch {}
  try { window.dispatchEvent(new CustomEvent("jce.mafia.truce", { detail: { active: false, until: 0 } })); } catch {}
  try { window.dispatchEvent(new CustomEvent("jce.mafia.raid", { detail: { until: 0 } })); } catch {}
}

export async function resetFullGame(): Promise<void> {
  if (typeof window === "undefined") return;
  const resetAt = Date.now();
  try {
    localStorage.setItem(RESET_MARKER_KEY, String(resetAt));
    localStorage.setItem(GAME_SAVE_KEY, JSON.stringify(DEFAULT_NEW_GAME_SAVE));
    localStorage.setItem(CAMPAIGN_STATE_KEY, JSON.stringify(DEFAULT_CAMPAIGN_STATE));
    localStorage.removeItem(CAMPAIGN_COUNTERS_KEY);
    for (const key of STORY_STATE_KEYS) localStorage.removeItem(key);
  } catch {
    // Le reset local doit rester non bloquant même si le stockage est plein.
  }

  emitResetEvents();

  try {
    const { pushCloudSave } = await import("@/lib/cloudSave");
    await pushCloudSave(DEFAULT_NEW_GAME_SAVE);
  } catch {
    // Hors-ligne / invité : la sauvegarde locale reste la source de vérité.
  }
}
