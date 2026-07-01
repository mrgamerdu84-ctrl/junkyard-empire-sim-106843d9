/**
 * Test de non-régression :
 *   Les véhicules ajoutés depuis le panel Admin doivent apparaître dans le
 *   trafic ET continuer d'y apparaître quel que soit l'état de la campagne
 *   narrative (chapitre 1, chapitre courant avancé, Mode Empire, campagne
 *   réinitialisée). La circulation Admin est indépendante de la campagne.
 *
 *   Ce test protège contre la régression qui, lors d'une refonte antérieure
 *   de la campagne, avait accidentellement coupé le trafic civil / Admin
 *   au chapitre 1.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addCustomVehicle,
  getCustomTrafficUrls,
  listCustomVehicles,
  removeCustomVehicle,
  TRAFFIC_CATEGORIES,
  type CustomVehicleCategory,
} from "../gameAssets";
import {
  completeChapter,
  loadCampaign,
  resetCampaign,
  saveCampaign,
} from "../campaign/campaignState";
import { CHAPTERS } from "../campaign/campaignData";

const ADMIN_FIXTURE: Array<{ name: string; url: string; category: CustomVehicleCategory }> = [
  { name: "Berline Admin",   url: "https://cdn.test/admin-civil.png",     category: "civil" },
  { name: "Police Admin",    url: "https://cdn.test/admin-police.png",    category: "police" },
  { name: "Ambulance Admin", url: "https://cdn.test/admin-ambulance.png", category: "ambulance" },
  { name: "Camion blindé",   url: "https://cdn.test/admin-armored.png",   category: "armored" },
  { name: "Limousine",       url: "https://cdn.test/admin-limo.png",      category: "limo" },
];

function seedAdminVehicles() {
  for (const v of ADMIN_FIXTURE) addCustomVehicle(v);
}

function urlsInPool(): string[] {
  return getCustomTrafficUrls();
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  // Nettoyage explicite (au cas où d'autres tests partageraient l'env).
  for (const v of listCustomVehicles()) removeCustomVehicle(v.id);
  window.localStorage.clear();
});

describe("Panel Admin — persistance du trafic à travers la campagne", () => {
  it("les véhicules Admin sont visibles dès le chapitre 1 (campagne non démarrée)", () => {
    resetCampaign();
    seedAdminVehicles();

    const pool = urlsInPool();
    for (const v of ADMIN_FIXTURE) {
      expect(pool, `${v.name} doit rouler dès le chapitre 1`).toContain(v.url);
    }
    // Le premier chapitre est bien l'état par défaut.
    expect(loadCampaign().currentChapterIndex).toBe(0);
  });

  it("les véhicules Admin restent dans le trafic après avoir complété plusieurs chapitres", () => {
    seedAdminVehicles();
    const before = urlsInPool().sort();

    // Simule l'avancée narrative : on complète les 5 premiers chapitres.
    for (const ch of CHAPTERS.slice(0, 5)) completeChapter(ch.id);
    expect(loadCampaign().completedChapters.length).toBeGreaterThanOrEqual(5);

    const after = urlsInPool().sort();
    expect(after).toEqual(before);
  });

  it("les véhicules Admin restent dans le trafic une fois le Mode Empire débloqué", () => {
    seedAdminVehicles();

    for (const ch of CHAPTERS) completeChapter(ch.id);
    expect(loadCampaign().empireUnlocked).toBe(true);

    const pool = urlsInPool();
    for (const v of ADMIN_FIXTURE) expect(pool).toContain(v.url);
  });

  it("les véhicules Admin réapparaissent après un reset de campagne", () => {
    seedAdminVehicles();
    for (const ch of CHAPTERS) completeChapter(ch.id);

    resetCampaign();
    expect(loadCampaign().completedChapters).toEqual([]);
    expect(loadCampaign().empireUnlocked).toBe(false);

    const pool = urlsInPool();
    for (const v of ADMIN_FIXTURE) expect(pool).toContain(v.url);
  });

  it("désactiver puis réactiver la logique de campagne ne retire aucun véhicule Admin", () => {
    seedAdminVehicles();
    const baseline = urlsInPool().sort();

    // "Activation" : on avance dans la campagne.
    for (const ch of CHAPTERS.slice(0, 3)) completeChapter(ch.id);
    expect(urlsInPool().sort()).toEqual(baseline);

    // "Désactivation" : on force un état de campagne factice puis on reset.
    saveCampaign({
      currentChapterIndex: 7,
      completedChapters: CHAPTERS.slice(0, 7).map((c) => c.id),
      completedMissions: {},
      choices: {},
      empireUnlocked: false,
      started: true,
    });
    expect(urlsInPool().sort()).toEqual(baseline);

    resetCampaign();
    expect(urlsInPool().sort()).toEqual(baseline);
  });

  it("toutes les catégories importées par l'admin sont autorisées à circuler", () => {
    // Un véhicule par catégorie autorisée : aucun ne doit être filtré.
    const perCategory = TRAFFIC_CATEGORIES.map((cat, i) => ({
      name: `Admin ${cat}`,
      url: `https://cdn.test/admin-${cat}-${i}.png`,
      category: cat,
    }));
    for (const v of perCategory) addCustomVehicle(v);

    const pool = new Set(urlsInPool());
    for (const v of perCategory) {
      expect(pool.has(v.url), `${v.category} doit être autorisé dans le trafic`).toBe(true);
    }
  });
});
