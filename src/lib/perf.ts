// Détection grossière du niveau de l'appareil + helpers de throttling.
// Joueurs entrée de gamme (Xiaomi Redmi etc.) : on plafonne à 30 fps,
// 24 fps low-end, et un mode "ultra léger" 20 fps avec très peu de
// véhicules + animations coupées pour les téléphones vraiment faibles.

type Tier = "ultra" | "low" | "mid" | "high";

const LS_KEY = "mtwr.ultraLite"; // "1" force, "0" désactive, sinon auto

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

  const override = readOverride();
  if (override === "on") return "ultra";
  if (override === "off") {
    // garder un palier raisonnable même si l'user désactive
    if (mem <= 3 || cpu <= 4) return "low";
    if (mem <= 6 || cpu <= 6 || isMobile) return "mid";
    return "high";
  }

  // Auto : déclenche l'ultra-light sur vraies entrées de gamme.
  // Les Xiaomi/Redmi annoncent souvent 4 Go mais gardent peu de RAM libre
  // dans WebView : on les traite plus agressivement pour éviter les freezes.
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
  return perfTier() === "ultra";
}

export function setUltraLite(on: boolean | null) {
  try {
    if (on === null) localStorage.removeItem(LS_KEY);
    else localStorage.setItem(LS_KEY, on ? "1" : "0");
  } catch {}
  _tier = null; // re-détection
}

export function targetFps(): number {
  const t = perfTier();
  if (t === "ultra") return 18;
  if (t === "low") return 22;
  if (t === "mid") return 30;
  return 60;
}

// Multiplicateur sur les comptages (trafic, piétons, mafia, etc.).
export function densityMult(): number {
  const t = perfTier();
  if (t === "ultra") return 0.08;
  if (t === "low") return 0.25;
  if (t === "mid") return 0.6;
  return 1;
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
  if (t === "ultra") return Math.min(defaultCount, 5);
  if (t === "low") return Math.min(defaultCount, 9);
  if (t === "mid") return Math.min(defaultCount, 16);
  return defaultCount;
}

// True si on doit couper les animations purement décoratives
// (gyrophares clignotants, fumée, halos pulsés, ombres animées...).
export function reduceMotion(): boolean {
  if (perfTier() === "ultra") return true;
  try {
    return typeof matchMedia !== "undefined"
      && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// Rate-limiter pour boucles rAF.
export function makeFrameLimiter(fps = targetFps()) {
  const minDt = 1000 / fps;
  let last = 0;
  return (now: number) => {
    if (now - last < minDt) return false;
    last = now;
    return true;
  };
}
