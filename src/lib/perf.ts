// Détection appareil + helpers de throttling + réglages utilisateur "ultra-fluide".

type Tier = "ultra" | "low" | "mid" | "high";

const LS_KEY = "mtwr.ultraLite"; // legacy : "1"/"0"/null
const LS_SETTINGS = "mtwr.perfSettings.v1";

export type PerfSettings = {
  ultraFluid: boolean;   // master toggle (préréglage agressif)
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

function readSettings(): PerfSettings {
  if (_settings) return _settings;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(LS_SETTINGS) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      _settings = { ...DEFAULT_SETTINGS, ...parsed };
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
  const next = { ...readSettings(), ...patch };
  // Si ultraFluid est activé, on applique un préréglage agressif.
  if (patch.ultraFluid === true) {
    next.entityScale = Math.min(next.entityScale, 0.3);
    next.fpsCap = Math.min(next.fpsCap, 20);
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
  const ua = nav.userAgent || "";
  const isMobile = /Android|iPhone|iPad|Mobile/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isXiaomiLike = /Xiaomi|Redmi|Miui|M210|M200|M190|POCO/i.test(ua);

  // L'option utilisateur "ultra-fluide" l'emporte sur tout.
  if (readSettings().ultraFluid) return "ultra";

  const override = readOverride();
  if (override === "on") return "ultra";
  if (override === "off") {
    if (mem <= 3 || cpu <= 4) return "low";
    if (mem <= 6 || cpu <= 6 || isMobile) return "mid";
    return "high";
  }

  if (mem <= 2 || cpu <= 2) return "ultra";
  if (isAndroid && isXiaomiLike) return "ultra";
  if (isAndroid && isMobile && mem <= 4 && cpu <= 4) return "ultra";
  if (isMobile && mem <= 3 && cpu <= 4) return "ultra";
  if (mem <= 3 || cpu <= 4 || (isMobile && mem <= 4)) return "low";
  if (mem <= 6 || cpu <= 6 || isMobile) return "mid";
  return "high";
}

let _tier: Tier | null = null;
export function perfTier(): Tier {
  if (_tier === null) _tier = detectTier();
  return _tier;
}

export function isUltraLite(): boolean {
  return perfTier() === "ultra" || readSettings().ultraFluid;
}

export function setUltraLite(on: boolean | null) {
  try {
    if (on === null) localStorage.removeItem(LS_KEY);
    else localStorage.setItem(LS_KEY, on ? "1" : "0");
  } catch {}
  _tier = null;
}

function tierFps(t: Tier): number {
  if (t === "ultra") return 18;
  if (t === "low") return 22;
  if (t === "mid") return 30;
  return 60;
}

export function targetFps(): number {
  const t = perfTier();
  const cap = readSettings().fpsCap;
  return Math.min(tierFps(t), cap);
}

function tierDensity(t: Tier): number {
  if (t === "ultra") return 0.08;
  if (t === "low") return 0.25;
  if (t === "mid") return 0.6;
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
  // Plafonds par tier — plancher volontaire à 6 pour garder la ville vivante
  // même sur bas de gamme (le trafic civil n'est jamais coupé par la campagne).
  const tierCap = t === "ultra" ? 6 : t === "low" ? 10 : t === "mid" ? 18 : defaultCount;
  const scaled = Math.floor(Math.min(defaultCount, tierCap) * scale);
  return Math.max(6, scaled);
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
