// =============================================================
// Horloge de la ville — basée sur l'heure RÉELLE locale du joueur.
// La densité de trafic est dérivée de l'heure + jour + jours fériés FR
// et modulée par la taille de la vraie ville du joueur (population).
// =============================================================

export type Period =
  | "night"        // 22h-6h
  | "earlyMorning" // 6h-7h30
  | "rushAM"       // 7h30-9h
  | "day"          // 9h-12h, 14h-16h30
  | "lunch"        // 12h-14h
  | "rushPM"       // 16h30-18h30
  | "evening";     // 18h30-22h

export type GameTime = {
  hour: number;          // 0-23.999
  minute: number;        // 0-59
  dayOfWeek: number;     // 0 dim ... 6 sam (vrai jour local)
  isWeekend: boolean;
  isHoliday: boolean;    // jours fériés français (fixes + Pâques/Ascension/Pentecôte)
  period: Period;
  density: number;       // 0-2+, coefficient pour le trafic et la criminalité
  label: string;         // "Lundi 22 juin · 08:42"
};

const DAYS_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function detectPeriod(h: number, isWeekend: boolean): Period {
  if (h < 6 || h >= 22) return "night";
  if (h < 7.5) return "earlyMorning";
  if (!isWeekend && h < 9) return "rushAM";
  if (h < 12) return "day";
  if (h < 14) return "lunch";
  if (h < 16.5) return "day";
  if (!isWeekend && h < 18.5) return "rushPM";
  return "evening";
}

function densityFor(period: Period, isWeekend: boolean, isHoliday: boolean): number {
  let base = 0;
  switch (period) {
    case "night":        base = 0.15; break;
    case "earlyMorning": base = 0.45; break;
    case "rushAM":       base = 1.55; break;
    case "day":          base = 0.85; break;
    case "lunch":        base = 1.05; break;
    case "rushPM":       base = 1.50; break;
    case "evening":      base = 0.70; break;
  }
  if (isWeekend) base *= 0.55;
  if (isHoliday) base *= 0.5;
  return Math.max(0.05, base);
}

// Multiplicateur de densité selon la taille réelle de la ville du joueur.
export function getCityDensityMultiplier(population: number | null | undefined): number {
  if (!population || population <= 0) return 1.0;
  if (population < 10_000) return 0.55;
  if (population < 100_000) return 0.85;
  if (population < 500_000) return 1.10;
  if (population < 2_000_000) return 1.35;
  return 1.6;
}

// Calcul du dimanche de Pâques (algorithme de Butcher/Meeus).
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const L = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * L) / 451);
  const month = Math.floor((h + L - 7 * m + 114) / 31); // 3 = mars, 4 = avril
  const day = ((h + L - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isFrenchHoliday(d: Date): boolean {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  // Jours fériés fixes
  if ((m === 1 && day === 1) ||   // Jour de l'an
      (m === 5 && day === 1) ||   // Fête du Travail
      (m === 5 && day === 8) ||   // Victoire 1945
      (m === 7 && day === 14) ||  // Fête nationale
      (m === 8 && day === 15) ||  // Assomption
      (m === 11 && day === 1) ||  // Toussaint
      (m === 11 && day === 11) || // Armistice 1918
      (m === 12 && day === 25)    // Noël
  ) return true;
  // Mobiles : Lundi de Pâques (+1), Ascension (+39), Lundi de Pentecôte (+50)
  const easter = easterSunday(d.getFullYear());
  const targetMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  for (const offset of [1, 39, 50]) {
    const t = addDays(easter, offset);
    if (t.getTime() === targetMs) return true;
  }
  return false;
}

export function getGameTime(_legacyNow?: number, cityPopulation?: number | null): GameTime {
  // _legacyNow est ignoré (anciennement performance.now()) — on utilise l'heure réelle.
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const hourF = hour + minute / 60;
  const dayOfWeek = now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isHoliday = isFrenchHoliday(now);
  const period = detectPeriod(hourF, isWeekend);
  const cityMult = getCityDensityMultiplier(cityPopulation);
  const density = densityFor(period, isWeekend, isHoliday) * cityMult;
  const label = `${DAYS_FR[dayOfWeek]} ${now.getDate()} ${MONTHS_FR[now.getMonth()]} · ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return { hour: hourF, minute, dayOfWeek, isWeekend, isHoliday, period, density, label };
}

export function periodLabel(p: Period): string {
  switch (p) {
    case "night": return "Nuit";
    case "earlyMorning": return "Petit matin";
    case "rushAM": return "Pointe matin";
    case "day": return "Journée";
    case "lunch": return "Déjeuner";
    case "rushPM": return "Pointe soir";
    case "evening": return "Soirée";
  }
}
