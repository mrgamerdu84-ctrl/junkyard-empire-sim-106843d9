// État local du Concessionnaire : modèles possédés + affectations chauffeur↔taxi.
// Achat = écrit directement dans `taxi-tycoon-v4` pour rester compatible
// avec le système de flotte existant (setSave y ajoute déjà `{ colorId }`).

import { GAME_SAVE_KEY } from "../resetGame";
import { loadCampaign } from "../campaign/campaignState";
import { TAXI_MODELS, findModel, type TaxiModel } from "./taxiModels";
import { loadStaff, type StaffMember } from "../personnel";

const KEY = "mtw.dealership.v1";
const EVT = "mtw:dealership-changed";

export type DealershipState = {
  // Modèles achetés (le "heritage" est toujours implicite).
  ownedModelIds: string[];
  // Modèle utilisé pour chaque taxi de la flotte, indexé par position dans `save.taxis`.
  taxiModels: Record<number, string>;
  // Affectation : id de chauffeur → index du taxi qu'il utilise.
  assignments: Record<string, number>;
};

const DEFAULT: DealershipState = {
  ownedModelIds: ["heritage"],
  taxiModels: { 0: "heritage" },
  assignments: {},
};

export function loadDealership(): DealershipState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw);
    return {
      ownedModelIds: Array.from(new Set([...(parsed.ownedModelIds ?? []), "heritage"])),
      taxiModels: { 0: "heritage", ...(parsed.taxiModels ?? {}) },
      assignments: { ...(parsed.assignments ?? {}) },
    };
  } catch {
    return { ...DEFAULT };
  }
}

function saveDealership(s: DealershipState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {}
}

export function subscribeDealership(cb: () => void): () => void {
  const h = () => cb();
  window.addEventListener(EVT, h);
  window.addEventListener("storage", h);
  return () => {
    window.removeEventListener(EVT, h);
    window.removeEventListener("storage", h);
  };
}

/** Chapitre courant du joueur (1..13). */
export function currentChapterNumber(): number {
  const s = loadCampaign();
  if (s.empireUnlocked) return 13;
  return (s.currentChapterIndex ?? 0) + 1;
}

export function isModelUnlocked(m: TaxiModel): boolean {
  return currentChapterNumber() >= m.unlockChapter;
}

// ------------- Save (`taxi-tycoon-v4`) helpers -------------

type Save = {
  money: number;
  taxis: { colorId: string; modelId?: string }[];
  [k: string]: unknown;
};

function loadSave(): Save | null {
  try {
    const raw = localStorage.getItem(GAME_SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function writeSave(s: Save) {
  try {
    localStorage.setItem(GAME_SAVE_KEY, JSON.stringify(s));
    // TaxiTycoon écoute son propre useState — un évènement custom permet
    // à des composants annexes de se rafraîchir. TaxiTycoon rechargera au
    // prochain rendu / navigation depuis Home.
    window.dispatchEvent(new CustomEvent("mtw:save-updated"));
  } catch {}
}

export function getMoney(): number {
  return loadSave()?.money ?? 0;
}

export function getFleet(): { colorId: string; modelId?: string }[] {
  return loadSave()?.taxis ?? [];
}

// ------------- Achat -------------

export type BuyResult = { ok: boolean; reason?: string };

export function buyModel(id: string, campaignCap: number): BuyResult {
  const model = findModel(id);
  if (!model) return { ok: false, reason: "Modèle inconnu" };
  if (!isModelUnlocked(model)) return { ok: false, reason: `Débloqué au chapitre ${model.unlockChapter}` };

  const save = loadSave();
  if (!save) return { ok: false, reason: "Sauvegarde introuvable — lance une partie d'abord" };

  if (save.taxis.length >= campaignCap) {
    return { ok: false, reason: "Flotte au maximum autorisé par la campagne" };
  }
  if ((save.money ?? 0) < model.price) {
    return { ok: false, reason: `Il manque ${model.price - (save.money ?? 0)} $` };
  }

  save.money = (save.money ?? 0) - model.price;
  save.taxis = [...save.taxis, { colorId: model.assetKey, modelId: model.id }];
  writeSave(save);

  const d = loadDealership();
  if (!d.ownedModelIds.includes(model.id)) d.ownedModelIds.push(model.id);
  d.taxiModels[save.taxis.length - 1] = model.id;
  saveDealership(d);
  return { ok: true };
}

// ------------- Affectations -------------

export function assignDriver(driverId: string, taxiIndex: number) {
  const d = loadDealership();
  // libère l'ancien taxi de ce chauffeur
  delete d.assignments[driverId];
  // libère l'ancien chauffeur de ce taxi
  for (const [k, v] of Object.entries(d.assignments)) {
    if (v === taxiIndex) delete d.assignments[k];
  }
  d.assignments[driverId] = taxiIndex;
  saveDealership(d);
}

export function unassignDriver(driverId: string) {
  const d = loadDealership();
  delete d.assignments[driverId];
  saveDealership(d);
}

export function driverForTaxi(taxiIndex: number, staff: StaffMember[]): StaffMember | null {
  const d = loadDealership();
  const driverId = Object.entries(d.assignments).find(([, v]) => v === taxiIndex)?.[0];
  return driverId ? (staff.find((s) => s.id === driverId) ?? null) : null;
}

export function modelForTaxi(taxiIndex: number): TaxiModel {
  const d = loadDealership();
  const id = d.taxiModels[taxiIndex] ?? (taxiIndex === 0 ? "heritage" : "classic");
  return findModel(id) ?? TAXI_MODELS[0];
}
