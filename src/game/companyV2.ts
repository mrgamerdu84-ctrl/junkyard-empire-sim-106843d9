// =============================================================
// My Taxi World Rivalité — Moteur Tycoon v2
// =============================================================
// Ce module est le NOUVEAU coeur de jeu (refonte gameplay).
// Il tourne en arrière-plan : la flotte génère des courses
// automatiquement, paie des salaires, consomme du carburant, etc.
// Les revenus nets sont reversés au joueur via l'évènement
// `jce.player.cashDelta` (déjà câblé dans TaxiTycoon).
// L'état persistant est stocké dans localStorage sous une seule clé.
// Toute l'UI (CompanyPanel) lit et modifie cet état via les
// fonctions exportées + un listener `subscribe`.
// =============================================================

const STORAGE_KEY = "mtw.company.v2";
const TICK_MS = 5000;        // 1 tick simulation = 5s réelles
const MINUTES_PER_TICK = 5;  // 1 tick = 5 min de temps jeu
const DAY_LENGTH_TICKS = (24 * 60) / MINUTES_PER_TICK; // 288 ticks = 1 jour jeu

// ----------- Types -----------
export type DriverStats = { driving: number; service: number; stamina: number };
export type Driver = {
  id: string;
  name: string;
  avatar: string;
  stats: DriverStats;
  wage: number;         // $/jour jeu
  morale: number;       // 0-100
  shift: "day" | "night";
  assignedTaxiId: string | null;
  fatigue: number;      // 0-100
};

export type TaxiUpgrades = {
  tires: 0 | 1 | 2;
  engine: 0 | 1 | 2;
  armor: 0 | 1 | 2;
  sticker: null | "roof";
};
export type TaxiPaint = { color: string; accent: string };

export type Taxi = {
  id: string;
  livery: string;       // nom skin
  km: number;
  condition: number;    // 0-100
  fuel: number;         // 0-100
  status: "garage" | "cruising" | "onRide" | "returning" | "broken";
  driverId: string | null;
  ridesToday: number;
  earnedToday: number;
  upgrades: TaxiUpgrades;
  paint: TaxiPaint;
  mafiaShieldUsed?: boolean; // remis à false chaque jour
};

export type ContractKey = "hotel" | "airport" | "nightclub" | "hospital";
export type Contract = {
  key: ContractKey;
  label: string;
  icon: string;
  signed: boolean;
  weeklyTarget: number;  // courses requises / semaine
  weeklyDone: number;
  fareMult: number;      // multiplicateur tarif
  reqTaxis: number;      // taxis dispo min
  penalty: number;       // pénalité si raté
  reward: number;        // bonus si atteint
  desc: string;
};

export type Station = {
  district: string;
  cost: number;
  owned: boolean;
};

export type SimEvent = {
  id: string;
  ts: number;
  type: "weather" | "rush" | "strike" | "panne" | "control" | "inspection" | "bilan";
  message: string;
  amount?: number;
};

export type DailyReport = {
  day: number;
  revenue: number;
  fuelCost: number;
  wages: number;
  maintenance: number;
  taxes: number;
  net: number;
  rides: number;
};

export type CompanyState = {
  // identité
  founded: number;
  reputation: number;       // 0-100
  marketShare: number;      // 0-1 part de courses captées
  // finances
  fuelPrice: number;        // $/unité
  baseFare: number;         // $ par course de base
  nightSurcharge: number;   // %
  rainSurcharge: number;    // %
  debt: number;
  // ressources
  fleet: Taxi[];
  drivers: Driver[];
  contracts: Contract[];
  stations: Station[];
  // sim
  tick: number;
  dayOfSim: number;
  lastReport: DailyReport | null;
  eventsLog: SimEvent[];
  // accumulateurs intra-jour
  todayRevenue: number;
  todayFuel: number;
  todayWages: number;
  todayMaintenance: number;
  todayRides: number;
};

// ----------- Defaults -----------
const DEFAULT_CONTRACTS: Contract[] = [
  { key: "hotel",     label: "Hôtel 4★ Le Grand",    icon: "🏨", signed: false, weeklyTarget: 120, weeklyDone: 0, fareMult: 0.9,  reqTaxis: 2, penalty: 800,  reward: 2400, desc: "Courses régulières clients VIP. Tarif -10%, volume garanti." },
  { key: "airport",   label: "Aéroport International", icon: "✈️", signed: false, weeklyTarget: 80,  weeklyDone: 0, fareMult: 1.6,  reqTaxis: 5, penalty: 2000, reward: 5000, desc: "Grosses courses longue distance. Exige 5 taxis dispo." },
  { key: "nightclub", label: "Club Néon",             icon: "🌃", signed: false, weeklyTarget: 60,  weeklyDone: 0, fareMult: 1.3,  reqTaxis: 2, penalty: 600,  reward: 1800, desc: "Uniquement nuit. Gros pourboires, clients pénibles." },
  { key: "hospital",  label: "Hôpital St-Marc",       icon: "🏥", signed: false, weeklyTarget: 100, weeklyDone: 0, fareMult: 1.1,  reqTaxis: 3, penalty: 1500, reward: 3000, desc: "Priorité absolue, pénalité si retard. Stable et noble." },
];

const DISTRICT_NAMES = ["Centre", "Nord", "Sud", "Est", "Ouest", "Port", "Industriel", "Résidentiel"];
const DEFAULT_STATIONS: Station[] = DISTRICT_NAMES.map((d, i) => ({
  district: d, cost: 4000 + i * 800, owned: i === 0,
}));

const FIRST_NAMES = ["Karim", "Léo", "Maya", "Sofia", "Diego", "Nina", "Jules", "Anaïs", "Marco", "Lila", "Yanis", "Zoé", "Sam", "Inès", "Théo", "Léa"];
const LAST_NAMES = ["Dupont", "Marchand", "Bernard", "Lemoine", "Rossi", "Mendes", "Okafor", "Tanaka", "Kowalski", "Petit"];
function randomName() {
  return `${FIRST_NAMES[Math.floor(Math.random()*FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random()*LAST_NAMES.length)]}`;
}
function randomAvatar() {
  const seeds = ["happy", "cool", "smile", "pro", "ace", "city", "road", "miles"];
  const s = seeds[Math.floor(Math.random()*seeds.length)] + Math.floor(Math.random()*999);
  return `https://api.dicebear.com/7.x/personas/svg?seed=${s}`;
}
export function makeDriver(): Driver {
  return {
    id: `drv-${Date.now()}-${Math.floor(Math.random()*9999)}`,
    name: randomName(),
    avatar: randomAvatar(),
    stats: {
      driving: 40 + Math.floor(Math.random()*50),
      service: 40 + Math.floor(Math.random()*50),
      stamina: 40 + Math.floor(Math.random()*50),
    },
    wage: 80 + Math.floor(Math.random()*60),
    morale: 70 + Math.floor(Math.random()*20),
    shift: Math.random() > 0.4 ? "day" : "night",
    assignedTaxiId: null,
    fatigue: 0,
  };
}
function makeTaxi(livery = "Standard"): Taxi {
  return {
    id: `txi-${Date.now()}-${Math.floor(Math.random()*9999)}`,
    livery, km: 0, condition: 100, fuel: 100,
    status: "garage", driverId: null, ridesToday: 0, earnedToday: 0,
    upgrades: { tires: 0, engine: 0, armor: 0, sticker: null },
    paint: { color: "#fde047", accent: "#a16207" },
    mafiaShieldUsed: false,
  };
}

// Migration des taxis chargés avant l'ajout des upgrades.
function ensureTaxiShape(t: Taxi): Taxi {
  if (!t.upgrades) t.upgrades = { tires: 0, engine: 0, armor: 0, sticker: null };
  if (!t.paint)    t.paint    = { color: "#fde047", accent: "#a16207" };
  if (t.mafiaShieldUsed === undefined) t.mafiaShieldUsed = false;
  return t;
}

function defaultState(): CompanyState {
  return {
    founded: Date.now(),
    reputation: 50,
    marketShare: 0.1,
    fuelPrice: 1.6,
    baseFare: 14,
    nightSurcharge: 25,
    rainSurcharge: 15,
    debt: 0,
    fleet: [makeTaxi("Jaune Classique"), makeTaxi("Jaune Classique")],
    drivers: [makeDriver(), makeDriver()],
    contracts: DEFAULT_CONTRACTS,
    stations: DEFAULT_STATIONS,
    tick: 0,
    dayOfSim: 1,
    lastReport: null,
    eventsLog: [],
    todayRevenue: 0,
    todayFuel: 0,
    todayWages: 0,
    todayMaintenance: 0,
    todayRides: 0,
  };
}

// ----------- Persistance -----------
let state: CompanyState = defaultState();
let hydrated = false;

function loadState(): CompanyState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const merged = { ...defaultState(), ...parsed } as CompanyState;
    merged.fleet = (merged.fleet || []).map(ensureTaxiShape);
    return merged;
  } catch { return defaultState(); }
}
function saveState() {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* noop */ }
}

const listeners = new Set<(s: CompanyState) => void>();
export function subscribe(fn: (s: CompanyState) => void): () => void {
  listeners.add(fn);
  fn(state);
  return () => { listeners.delete(fn); };
}
function notify() { for (const l of listeners) l(state); }

export function getCompany(): CompanyState { return state; }

function mutate(fn: (s: CompanyState) => void) {
  fn(state);
  saveState();
  notify();
}

// ----------- Cash bridge -----------
function pushCashToPlayer(amount: number, reason?: string) {
  if (typeof window === "undefined" || amount === 0) return;
  window.dispatchEvent(new CustomEvent("jce.player.cashDelta", { detail: { amount, reason } }));
}

// ----------- Actions joueur -----------
export function assignDriver(driverId: string, taxiId: string | null) {
  mutate(s => {
    const drv = s.drivers.find(d => d.id === driverId);
    if (!drv) return;
    // libère l'ancien
    if (drv.assignedTaxiId) {
      const old = s.fleet.find(t => t.id === drv.assignedTaxiId);
      if (old) old.driverId = null;
    }
    drv.assignedTaxiId = taxiId;
    if (taxiId) {
      // libère un éventuel autre chauffeur sur ce taxi
      for (const d of s.drivers) if (d.id !== driverId && d.assignedTaxiId === taxiId) d.assignedTaxiId = null;
      const t = s.fleet.find(tx => tx.id === taxiId);
      if (t) t.driverId = driverId;
    }
  });
}

export function hireDriver(): { ok: boolean; msg: string } {
  const cost = 600;
  if (typeof window !== "undefined") {
    // demande au joueur de payer (synchro via cashDelta négatif)
    pushCashToPlayer(-cost, "Embauche chauffeur");
  }
  mutate(s => { s.drivers.push(makeDriver()); });
  return { ok: true, msg: `Nouveau chauffeur embauché (-${cost} $)` };
}

export function fireDriver(driverId: string) {
  mutate(s => {
    const drv = s.drivers.find(d => d.id === driverId);
    if (drv?.assignedTaxiId) {
      const t = s.fleet.find(tx => tx.id === drv.assignedTaxiId);
      if (t) t.driverId = null;
    }
    s.drivers = s.drivers.filter(d => d.id !== driverId);
  });
}

export function buyTaxi(): { ok: boolean; msg: string } {
  const cost = 3500;
  pushCashToPlayer(-cost, "Achat taxi");
  mutate(s => { s.fleet.push(makeTaxi()); });
  return { ok: true, msg: `Taxi acheté (-${cost} $)` };
}
export function sellTaxi(taxiId: string) {
  mutate(s => {
    const t = s.fleet.find(tx => tx.id === taxiId);
    if (!t) return;
    const value = Math.round(800 + t.condition * 15);
    pushCashToPlayer(value, "Revente taxi");
    for (const d of s.drivers) if (d.assignedTaxiId === taxiId) d.assignedTaxiId = null;
    s.fleet = s.fleet.filter(tx => tx.id !== taxiId);
  });
}

export function refuelTaxi(taxiId: string) {
  mutate(s => {
    const t = s.fleet.find(tx => tx.id === taxiId);
    if (!t) return;
    const units = 100 - t.fuel;
    const cost = Math.round(units * s.fuelPrice);
    if (cost <= 0) return;
    pushCashToPlayer(-cost, "Carburant");
    t.fuel = 100;
  });
}
export function repairTaxi(taxiId: string) {
  mutate(s => {
    const t = s.fleet.find(tx => tx.id === taxiId);
    if (!t) return;
    const cost = Math.round((100 - t.condition) * 8);
    if (cost <= 0) return;
    pushCashToPlayer(-cost, "Réparation");
    t.condition = 100;
    if (t.status === "broken") t.status = "garage";
  });
}

export function signContract(key: ContractKey) {
  mutate(s => {
    const c = s.contracts.find(x => x.key === key);
    if (!c || c.signed) return;
    if (s.fleet.length < c.reqTaxis) return;
    c.signed = true;
    c.weeklyDone = 0;
  });
}
export function cancelContract(key: ContractKey) {
  mutate(s => {
    const c = s.contracts.find(x => x.key === key);
    if (!c) return;
    c.signed = false; c.weeklyDone = 0;
  });
}

export function buyStation(district: string) {
  mutate(s => {
    const st = s.stations.find(x => x.district === district);
    if (!st || st.owned) return;
    pushCashToPlayer(-st.cost, `Station ${district}`);
    st.owned = true;
    s.marketShare = Math.min(0.95, s.marketShare + 0.08);
  });
}

export function setTariff(base: number, night: number, rain: number) {
  mutate(s => {
    s.baseFare = Math.max(5, Math.min(60, base));
    s.nightSurcharge = Math.max(0, Math.min(80, night));
    s.rainSurcharge = Math.max(0, Math.min(80, rain));
  });
}

export function takeLoan(amount: number) {
  if (amount <= 0) return;
  mutate(s => {
    s.debt += Math.round(amount * 1.2);  // 20% intérêts plats
    pushCashToPlayer(amount, "Prêt bancaire");
  });
}
export function repayLoan(amount: number) {
  if (amount <= 0) return;
  pushCashToPlayer(-amount, "Remboursement prêt");
  mutate(s => { s.debt = Math.max(0, s.debt - amount); });
}

// ----------- Simulation tick -----------
function logEvent(type: SimEvent["type"], message: string, amount?: number) {
  state.eventsLog.unshift({ id: `${Date.now()}`, ts: Date.now(), type, message, amount });
  if (state.eventsLog.length > 40) state.eventsLog.length = 40;
}

function hourFromTick(tick: number): number {
  return Math.floor((tick * MINUTES_PER_TICK / 60) % 24);
}

function simTick() {
  const s = state;
  s.tick += 1;
  const hour = hourFromTick(s.tick);
  const isNight = hour < 6 || hour >= 22;
  const isRush = (hour >= 7 && hour < 10) || (hour >= 17 && hour < 20);

  // ---- demande de courses générée pour chaque taxi ----
  let revenueTick = 0, fuelTick = 0, ridesTick = 0;
  const activeContracts = s.contracts.filter(c => c.signed);

  for (const taxi of s.fleet) {
    const drv = taxi.driverId ? s.drivers.find(d => d.id === taxi.driverId) : null;
    if (!drv) { taxi.status = "garage"; continue; }
    if (taxi.status === "broken") continue;
    const onShift = (drv.shift === "day" && !isNight) || (drv.shift === "night" && isNight);
    if (!onShift) { taxi.status = "garage"; continue; }
    if (taxi.fuel < 5 || taxi.condition < 15) { taxi.status = "garage"; continue; }

    taxi.status = "cruising";
    // probabilité de course par tick = base * marketShare * réputation * facteurs
    let pRide = 0.55 * (0.4 + s.marketShare * 0.9) * (0.5 + s.reputation / 200);
    if (isRush) pRide *= 1.8;
    if (isNight && drv.shift === "night") pRide *= 1.15;
    pRide *= 0.7 + drv.stats.driving / 200;
    if (drv.morale < 30) pRide *= 0.6;

    // tarif vs concurrents : trop cher = perd clients
    const fareRatio = s.baseFare / 14;
    pRide *= Math.max(0.3, 1.3 - fareRatio * 0.4);

    if (Math.random() < pRide) {
      // contrat-driven boost
      let mult = 1;
      if (activeContracts.length && Math.random() < 0.5) {
        const c = activeContracts[Math.floor(Math.random() * activeContracts.length)];
        mult = c.fareMult;
        c.weeklyDone += 1;
      }
      let fare = s.baseFare * mult * (0.85 + Math.random() * 0.5);
      if (isNight) fare *= 1 + s.nightSurcharge / 100;
      // bonus prestige (qualité moyenne flotte) → clients VIP
      const prestige = getFleetPrestige();
      fare *= 1 + prestige * 0.15;
      // bonus moteur taxi
      fare *= 1 + 0.1 * taxi.upgrades.engine;
      // pourboire selon service + bonus prestige
      const tip = fare * (drv.stats.service / 500) * (1 + prestige * 0.3);
      fare += tip;
      const earned = Math.round(fare);
      taxi.earnedToday += earned;
      taxi.ridesToday += 1;
      revenueTick += earned;
      ridesTick += 1;
      // usure
      taxi.fuel = Math.max(0, taxi.fuel - 2);
      taxi.condition = Math.max(0, taxi.condition - 0.4);
      taxi.km += 6 + Math.floor(Math.random() * 8);
      drv.fatigue = Math.min(100, drv.fatigue + 3);
      // carburant coûté
      fuelTick += 2 * s.fuelPrice;
      // panne random si état bas
      if (taxi.condition < 20 && Math.random() < 0.05) {
        taxi.status = "broken";
        logEvent("panne", `🔧 ${taxi.livery} en panne (état ${Math.round(taxi.condition)}%)`);
      }
    } else {
      taxi.fuel = Math.max(0, taxi.fuel - 0.3);
    }

    // chauffeur fatigué → rentre au QG
    if (drv.fatigue > 85) {
      drv.fatigue = Math.max(0, drv.fatigue - 8);
      drv.morale = Math.max(0, drv.morale - 1);
      taxi.status = "returning";
    }
  }

  // ---- coûts continus ----
  // salaires (au prorata du tick : wage est /jour jeu)
  let wagesTick = 0;
  for (const d of s.drivers) wagesTick += d.wage / DAY_LENGTH_TICKS;
  s.todayWages += wagesTick;

  // maintenance passive
  const maintTick = s.fleet.length * 0.6;
  s.todayMaintenance += maintTick;

  s.todayRevenue += revenueTick;
  s.todayFuel += fuelTick;
  s.todayRides += ridesTick;

  // pousser le net au joueur
  const net = revenueTick - fuelTick - wagesTick - maintTick;
  if (Math.abs(net) > 0.5) pushCashToPlayer(Math.round(net));

  // ---- événements aléatoires ----
  if (Math.random() < 0.02) {
    const r = Math.random();
    if (r < 0.25) logEvent("weather", "🌧 Pluie : demande +50% mais accidents en hausse.");
    else if (r < 0.4) logEvent("strike", "🚇 Grève des transports en commun ! Jackpot de la journée.");
    else if (r < 0.55) logEvent("rush", "⚡ Pic de demande inattendu dans le quartier centre.");
    else if (r < 0.7 && s.fleet.length > 0) {
      const t = s.fleet[Math.floor(Math.random() * s.fleet.length)];
      const fine = 80 + Math.floor(Math.random() * 200);
      pushCashToPlayer(-fine, "Amende contrôle");
      logEvent("control", `🚓 Contrôle police sur ${t.livery} : amende -${fine} $`, -fine);
    } else if (r < 0.85) {
      const insp = 300 + Math.floor(Math.random() * 400);
      pushCashToPlayer(-insp, "Inspection mairie");
      logEvent("inspection", `🏛 Inspection mairie : mise aux normes -${insp} $`, -insp);
    }
  }

  // ---- fin de jour jeu ----
  if (s.tick % DAY_LENGTH_TICKS === 0) {
    closeDay();
  }

  // ---- fin de semaine jeu (7 jours) ----
  if (s.dayOfSim > 1 && (s.dayOfSim - 1) % 7 === 0 && s.tick % DAY_LENGTH_TICKS === 1) {
    resolveContractsWeekly();
  }

  saveState();
  notify();
}

function closeDay() {
  const s = state;
  // taxes journalières
  const taxes = Math.round(s.todayRevenue * 0.12);
  if (taxes > 0) pushCashToPlayer(-taxes, "Taxes du jour");
  // intérêts dette
  if (s.debt > 0) {
    const interest = Math.round(s.debt * 0.005);
    pushCashToPlayer(-interest, "Intérêts");
  }
  const report: DailyReport = {
    day: s.dayOfSim,
    revenue: Math.round(s.todayRevenue),
    fuelCost: Math.round(s.todayFuel),
    wages: Math.round(s.todayWages),
    maintenance: Math.round(s.todayMaintenance),
    taxes,
    net: Math.round(s.todayRevenue - s.todayFuel - s.todayWages - s.todayMaintenance - taxes),
    rides: s.todayRides,
  };
  s.lastReport = report;
  logEvent("bilan", `📊 Bilan jour ${s.dayOfSim} : net ${report.net >= 0 ? "+" : ""}${report.net} $ sur ${report.rides} courses.`, report.net);
  // reset compteurs
  s.todayRevenue = 0; s.todayFuel = 0; s.todayWages = 0; s.todayMaintenance = 0; s.todayRides = 0;
  for (const t of s.fleet) { t.ridesToday = 0; t.earnedToday = 0; }
  // remonte un peu de moral si payé
  for (const d of s.drivers) d.morale = Math.min(100, d.morale + 3);
  // démissions si moral très bas
  state.drivers = s.drivers.filter(d => {
    if (d.morale < 15 && Math.random() < 0.3) {
      logEvent("inspection", `😤 ${d.name} démissionne (moral ${d.morale}).`);
      if (d.assignedTaxiId) {
        const t = s.fleet.find(tx => tx.id === d.assignedTaxiId);
        if (t) t.driverId = null;
      }
      return false;
    }
    return true;
  });
  s.dayOfSim += 1;
  // réputation glisse vers marketShare
  s.reputation = Math.max(5, Math.min(100, s.reputation + (report.net > 0 ? 1 : -1)));
  // notifier UI pour modale bilan
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("mtw:daily-report", { detail: report }));
  }
}

function resolveContractsWeekly() {
  const s = state;
  for (const c of s.contracts) {
    if (!c.signed) continue;
    if (c.weeklyDone >= c.weeklyTarget) {
      pushCashToPlayer(c.reward, `Bonus contrat ${c.label}`);
      s.reputation = Math.min(100, s.reputation + 4);
      logEvent("bilan", `✅ Contrat ${c.label} tenu : +${c.reward} $`, c.reward);
    } else {
      pushCashToPlayer(-c.penalty, `Pénalité contrat ${c.label}`);
      s.reputation = Math.max(0, s.reputation - 6);
      logEvent("bilan", `❌ Contrat ${c.label} raté (${c.weeklyDone}/${c.weeklyTarget}) : -${c.penalty} $`, -c.penalty);
      // rupture si vraiment loin
      if (c.weeklyDone < c.weeklyTarget * 0.4) c.signed = false;
    }
    c.weeklyDone = 0;
  }
}

// ----------- Boot -----------
let timer: ReturnType<typeof setInterval> | null = null;
export function startCompanySim() {
  if (typeof window === "undefined") return;
  if (!hydrated) { state = loadState(); hydrated = true; }
  if (timer) return;
  timer = setInterval(simTick, TICK_MS);
}
export function stopCompanySim() {
  if (timer) { clearInterval(timer); timer = null; }
}

export function resetCompany() {
  state = defaultState();
  saveState(); notify();
}

// ----------- Atelier : application d'améliorations -----------
export function applyRepair(taxiId: string, discount = 0): { ok: boolean; cost: number; msg: string } {
  const t = state.fleet.find(x => x.id === taxiId);
  if (!t) return { ok: false, cost: 0, msg: "Taxi introuvable" };
  const missing = Math.max(0, 100 - t.condition);
  if (missing <= 0) return { ok: false, cost: 0, msg: "Déjà à 100%" };
  const cost = Math.max(0, Math.round(missing * 50 * (1 - discount)));
  pushCashToPlayer(-cost, "Réparation atelier");
  mutate(s => {
    const tt = s.fleet.find(x => x.id === taxiId);
    if (tt) { tt.condition = 100; if (tt.status === "broken") tt.status = "garage"; }
  });
  return { ok: true, cost, msg: `Réparé pour ${cost} $` };
}

export function applyUpgrade(
  taxiId: string,
  category: "tires" | "engine" | "armor",
  level: 1 | 2,
  cost: number,
): { ok: boolean; msg: string } {
  const t = state.fleet.find(x => x.id === taxiId);
  if (!t) return { ok: false, msg: "Taxi introuvable" };
  if (t.upgrades[category] >= level) return { ok: false, msg: "Niveau déjà installé" };
  pushCashToPlayer(-cost, `Upgrade ${category}`);
  mutate(s => {
    const tt = s.fleet.find(x => x.id === taxiId);
    if (tt) tt.upgrades[category] = level;
  });
  emitFleetUpgraded();
  return { ok: true, msg: "Installé !" };
}

export function applyPaint(taxiId: string, color: string, accent: string, cost: number): { ok: boolean } {
  const t = state.fleet.find(x => x.id === taxiId);
  if (!t) return { ok: false };
  pushCashToPlayer(-cost, "Peinture taxi");
  mutate(s => {
    const tt = s.fleet.find(x => x.id === taxiId);
    if (tt) tt.paint = { color, accent };
  });
  emitFleetUpgraded();
  return { ok: true };
}

export function applySticker(taxiId: string, cost: number): { ok: boolean } {
  const t = state.fleet.find(x => x.id === taxiId);
  if (!t) return { ok: false };
  if (t.upgrades.sticker === "roof") return { ok: false };
  pushCashToPlayer(-cost, "Sticker toit");
  mutate(s => {
    const tt = s.fleet.find(x => x.id === taxiId);
    if (tt) tt.upgrades.sticker = "roof";
  });
  emitFleetUpgraded();
  return { ok: true };
}

function emitFleetUpgraded() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("mtw:fleet-upgraded"));
  }
}

// Score "Prestige flotte" 0..1 utilisé pour bonus tycoon.
export function getFleetPrestige(): number {
  if (state.fleet.length === 0) return 0;
  let total = 0;
  for (const t of state.fleet) {
    total += (t.upgrades.tires + t.upgrades.engine + t.upgrades.armor) / 6;
  }
  return total / state.fleet.length;
}

// Appliquer dégât mafia à un taxi (utilisable par CrimeEvents).
export function applyMafiaHit(taxiId?: string): { taxiId: string; damage: number; broken: boolean } | null {
  if (state.fleet.length === 0) return null;
  const t = taxiId
    ? state.fleet.find(x => x.id === taxiId)
    : state.fleet[Math.floor(Math.random() * state.fleet.length)];
  if (!t) return null;
  // blindage lourd → bouclier journalier
  if (t.upgrades.armor >= 2 && !t.mafiaShieldUsed) {
    mutate(s => { const tt = s.fleet.find(x => x.id === t.id); if (tt) tt.mafiaShieldUsed = true; });
    return { taxiId: t.id, damage: 0, broken: false };
  }
  let dmg = 20 + Math.floor(Math.random() * 20);
  if (t.upgrades.armor === 1) dmg = Math.round(dmg * 0.6);
  mutate(s => {
    const tt = s.fleet.find(x => x.id === t.id);
    if (!tt) return;
    tt.condition = Math.max(0, tt.condition - dmg);
    if (tt.condition <= 0) tt.status = "broken";
  });
  return { taxiId: t.id, damage: dmg, broken: t.condition - dmg <= 0 };
}
