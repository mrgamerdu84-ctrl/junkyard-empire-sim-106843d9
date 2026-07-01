// =============================================================
// Verrouillage centralisé du gameplay par la progression campagne.
// Chaque "feature" est mappée au chapitre minimum requis pour être active.
// Aucun composant existant n'est supprimé — ils appellent simplement
// isUnlocked() / useUnlock() et se masquent tant que le chapitre requis
// n'est pas atteint.
// =============================================================
import { useEffect, useState } from "react";
import { loadCampaign } from "./campaignState";

// Numéro du chapitre à partir duquel la feature est disponible.
// 13 = épilogue / Mode Empire.
export const FEATURE_MIN_CHAPTER: Record<string, number> = {
  // Ch1 — Le Retour
  "depot.clean": 1,
  "depot.repair_taxi": 1,
  "courses.basic": 1,

  // Ch2 — La Reconstruction
  "personnel.marcel": 2,
  "personnel.mecanos": 2,
  "depot.gate": 2,
  "depot.power": 2,
  "depot.workshop2": 2,
  "taxi.buy_second": 2,
  "dealership": 2,

  // Ch3 — Les Premiers Indices
  "office.explore": 3,
  "item.cassette": 3,
  "item.keyB12": 3,
  "npc.dialogues": 3,

  // Ch4 — L'Invitation
  "mail.system": 4,
  "baron.hint": 4,

  // Ch5 — La Rencontre
  "baron.active": 5,
  "baron.dialogue": 5,
  "baron.negotiation": 5,

  // Ch6 — Les Contrats
  "contracts.system": 6,
  "reputation.system": 6,
  "missions.special": 6,
  "rivals.spawn": 6,

  // Ch7 — Les Premières Menaces
  "security.system": 7,
  "driver.morale": 7,
  "sabotage.repair": 7,
  "mafia.attackers": 7,
  "crime.events": 7,

  // Ch8 — Le dépôt B-12
  "depot.b12": 8,
  "evidence.docs": 8,
  "map.hidden_zone": 8,

  // Ch9 — Les Trahisons
  "investigation.system": 9,
  "choice.justice_pardon": 9,

  // Ch10 — Le Dossier du Père
  "npc.journalist": 10,
  "evidence.gather": 10,
  "evidence.protect": 10,

  // Ch11 — Le Choix
  "choice.three_paths": 11,

  // Ch12 — Le Baron
  "baron.final": 12,

  // Épilogue — Mode Empire
  "empire.mode": 13,
  "empire.depots": 13,
  "empire.vtc": 13,
  "empire.limos": 13,
  "empire.shuttles": 13,
  "empire.minibus": 13,
  "empire.arena": 13,
  "empire.defis": 13,
  "empire.armored_truck": 13,
  "empire.managers": 13,
};

/** Chapitre requis pour une feature (1..13). Retourne 1 si inconnue (par défaut ouvert). */
export function requiredChapter(id: string): number {
  return FEATURE_MIN_CHAPTER[id] ?? 1;
}

/** État "chapitre courant du joueur" (1-indexé) selon la campagne. */
function currentChapterNumber(): number {
  const s = loadCampaign();
  if (s.empireUnlocked) return 13;
  // currentChapterIndex est 0-indexé, chapitre 1 = index 0.
  return (s.currentChapterIndex ?? 0) + 1;
}

/** Feature disponible ? (le joueur a atteint le chapitre minimum). */
export function isUnlocked(id: string): boolean {
  return currentChapterNumber() >= requiredChapter(id);
}

/** Hook réactif : rafraîchit à chaque event campagne. */
export function useUnlock(id: string): boolean {
  const [ok, setOk] = useState<boolean>(() => isUnlocked(id));
  useEffect(() => {
    const refresh = () => setOk(isUnlocked(id));
    window.addEventListener("campaign.updated", refresh);
    window.addEventListener("campaign.chapter.completed", refresh);
    return () => {
      window.removeEventListener("campaign.updated", refresh);
      window.removeEventListener("campaign.chapter.completed", refresh);
    };
  }, [id]);
  return ok;
}

// -------- Toast "nouveauté débloquée" --------
// Émet un event par feature nouvellement disponible quand le chapitre courant change.

let lastChapterSeen: number | null = null;

function emitNewlyUnlocked() {
  const cur = currentChapterNumber();
  if (lastChapterSeen === null) {
    lastChapterSeen = cur;
    return;
  }
  if (cur > lastChapterSeen) {
    for (const [id, ch] of Object.entries(FEATURE_MIN_CHAPTER)) {
      if (ch > lastChapterSeen && ch <= cur) {
        try {
          window.dispatchEvent(new CustomEvent("feature.unlocked", { detail: { id, chapter: ch } }));
        } catch {}
      }
    }
    lastChapterSeen = cur;
  }
}

if (typeof window !== "undefined") {
  // Init une seule fois par onglet.
  queueMicrotask(() => {
    lastChapterSeen = currentChapterNumber();
  });
  window.addEventListener("campaign.updated", emitNewlyUnlocked);
  window.addEventListener("campaign.chapter.completed", emitNewlyUnlocked);
}

// -------- Migration douce (grandfather) --------
// Anciennes parties : si le joueur avait déjà >1 taxi ou beaucoup d'argent,
// on démarre sa campagne au bon chapitre pour ne rien lui retirer.
export function grandfatherIfNeeded() {
  try {
    const s = loadCampaign();
    if (s.started) return;
    const raw = window.localStorage.getItem("taxi-tycoon-v4");
    if (!raw) return;
    const save = JSON.parse(raw);
    const taxis: number = Array.isArray(save?.taxis) ? save.taxis.length : 0;
    if (taxis <= 1) return;
    // Reconstitue une progression cohérente : 1 taxi = 1 chapitre.
    const idx = Math.min(taxis - 1, 11);
    const completed: string[] = [];
    for (let i = 0; i < idx; i++) completed.push(`ch${i + 1}`);
    const migrated = {
      ...s,
      started: true,
      currentChapterIndex: idx,
      completedChapters: completed,
    };
    window.localStorage.setItem("campaign_state_v1", JSON.stringify(migrated));
    window.dispatchEvent(new CustomEvent("campaign.updated"));
  } catch {}
}

if (typeof window !== "undefined") {
  grandfatherIfNeeded();
}
