// Détection appareil + helpers de throttling + réglages utilisateur "ultra-fluide".

type Tier = "ultra" | "low" | "mid" | "high";

const LS_KEY = "mtwr.ultraLite"; // legacy : "1"/"0"/null
const LS_SETTINGS = "mtwr.perfSettings.v1";

export type PerfSettings = {
  ultraFluid: boolean;   // master toggle utilisateur
  entityScale: number;   // 0.1 → 1 (multiplicateur sur le nombre d'entités)
  fpsCap: number;        // 15 → 60
  fxOff: boolean;        // coupe halos, ombres, animations décoratives
};

const DEFAULT_SETTINGS: PerfSettings = {
  ultraFluid: false,
  entityScale: 1,
  fpsCap: 60,
  fxOff: false,
};

let _settings: PerfSettings | null = null;

function clampSettings(s: PerfSettings): PerfSettings {
  return {
    ultraFluid: !!s.ultraFluid,
    entityScale: Math.max(0.45, Math.min(1, Number.isFinite(s.entityScale) ? s.entityScale : 1)),
    fpsCap: Math.max(24, Math.min(60, Number.isFinite(s.fpsCap) ? s.fpsCap : 60)),
    fxOff: !!s.fxOff,
  };
}

function readSettings(): PerfSettings {
  if (_settings) return _settings;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(LS_SETTINGS) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      _settings = clampSettings({ ...DEFAULT_SETTINGS, ...parsed });
      return _settings!;
    }
  } catch {}
  _settings = { ...DEFAULT_SETTINGS };
  return _settings;
}

export function perfSettings(): PerfSettings {
  return readSettings();
}

export function setPerfSettings(patch: Partial<PerfSettings>) {
  const next = clampSettings({ ...readSettings(), ...patch });
  // Ultra-fluide garde le gameplay vivant : on coupe surtout les effets,
  // mais on ne descend plus à 8% d'entités ni à 18 FPS.
  if (patch.ultraFluid === true) {
    next.entityScale = Math.max(next.entityScale, 0.55);
    next.fpsCap = Math.max(next.fpsCap, 30);
    next.fxOff = true;
  }
  _settings = next;
  try { localStorage.setItem(LS_SETTINGS, JSON.stringify(next)); } catch {}
  _tier = null;
  try { window.dispatchEvent(new CustomEvent("mtwr.perf.changed")); } catch {}
}

function readOverride(): "on" | "off" | null {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    if (v === "1") return "on";
    if (v === "0") return "off";
  } catch {}
  return null;
}

function detectTier(): Tier {
  if (typeof navigator === "undefined") return "mid";
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 4;
  const cpu = nav.hardwareConcurrency ?? 4;
  const ua = navigator.userAgent || "";
  const isMobile = /Android|iPhone|iPad|Mobile/i.test(ua);

  const override = readOverride();
  if (override === "on") return "low";
  if (override === "off") return isMobile ? "mid" : "high";

  // Avant, beaucoup d'Android/Xiaomi étaient forcés en ultra : ça vidait la
  // ville et pouvait figer le moteur. Maintenant, ultra est réservé aux cas
  // vraiment très faibles, et mobile standard reste au minimum en low/mid.
  if (mem <= 1 || cpu <= 1) return "ultra";
  if (mem <= 2 || cpu <= 2) return "low";
  if (isMobile || mem <= 4 || cpu <= 4) return "mid";
  if (mem <= 6 || cpu <= 6) return "mid";
  return "high";
}

let _tier: Tier | null = null;
export function perfTier(): Tier {
  if (_tier === null) _tier = detectTier();
  return _tier;
}

export function isUltraLite(): boolean {
  return perfTier() === "ultra";
}

export function setUltraLite(on: boolean | null) {
  try {
    if (on === null) localStorage.removeItem(LS_KEY);
    else localStorage.setItem(LS_KEY, on ? "1" : "0");
  } catch {}
  _tier = null;
}

function tierFps(t: Tier): number {
  if (t === "ultra") return 24;
  if (t === "low") return 30;
  if (t === "mid") return 40;
  return 60;
}

export function targetFps(): number {
  const t = perfTier();
  const cap = readSettings().fpsCap;
  return Math.min(tierFps(t), cap);
}

function tierDensity(t: Tier): number {
  if (t === "ultra") return 0.45;
  if (t === "low") return 0.55;
  if (t === "mid") return 0.75;
  return 1;
}

export function densityMult(): number {
  return tierDensity(perfTier()) * readSettings().entityScale;
}

export function isMobileLike(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || "");
}

export function preferLiteAssets(): boolean {
  const t = perfTier();
  return t === "ultra" || t === "low" || isMobileLike();
}

export function trafficBudget(defaultCount: number): number {
  const t = perfTier();
  const scale = readSettings().entityScale;
  const tierCap = t === "ultra" ? Math.max(4, Math.min(defaultCount, 8)) : t === "low" ? Math.min(defaultCount, 12) : t === "mid" ? Math.min(defaultCount, 18) : defaultCount;
  return Math.max(3, Math.floor(Math.min(defaultCount, tierCap) * scale));
}

export function reduceMotion(): boolean {
  if (readSettings().fxOff) return true;
  if (perfTier() === "ultra") return true;
  try {
    return typeof matchMedia !== "undefined"
      && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function makeFrameLimiter(fps = targetFps()) {
  const minDt = 1000 / fps;
  let last = 0;
  return (now: number) => {
    if (now - last < minDt) return false;
    last = now;
    return true;
  };
}
