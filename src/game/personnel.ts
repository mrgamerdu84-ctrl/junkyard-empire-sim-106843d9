// Système d'embauche de personnel pour les taxis.
// Stocké en local (localStorage), partagé via évènements window.
// Les chauffeurs autonomes versent un revenu passif (jce.player.cashDelta).
// Les mécanos donnent une réduction sur l'entretien (lue par TaxiTycoon).
// Les managers boostent les pourboires (multiplicateur lu via getTipsBonus).

export type StaffRole = "driver" | "mechanic" | "manager" | "secretary";

export type StaffDef = {
  role: StaffRole;
  label: string;
  icon: string;
  desc: string;
  cost: number;
  wage: number;
  income: number;
  discount: number;
  tipBonus: number;
  missionBonus: number;
  max: number;
};

export const STAFF_CATALOG: StaffDef[] = [
  {
    role: "driver",
    label: "Chauffeur",
    icon: "🧑‍✈️",
    desc: "Conduit un taxi en autonome et rapporte des courses passives.",
    cost: 1200,
    wage: 30,
    income: 95,
    discount: 0,
    tipBonus: 0,
    missionBonus: 0,
    max: 8,
  },
  {
    role: "mechanic",
    label: "Mécano",
    icon: "🧰",
    desc: "Réduit le coût d'entretien de la flotte (-15 % par mécano).",
    cost: 1800,
    wage: 18,
    income: 0,
    discount: 0.15,
    tipBonus: 0,
    missionBonus: 0,
    max: 3,
  },
  {
    role: "manager",
    label: "Manager",
    icon: "🧑‍💼",
    desc: "Forme l'équipe : +10 % de pourboires sur toutes les courses.",
    cost: 2600,
    wage: 25,
    income: 0,
    discount: 0,
    tipBonus: 0.10,
    missionBonus: 0,
    max: 2,
  },
  {
    role: "secretary",
    label: "Secrétaire",
    icon: "🗂️",
    desc: "Négocie les contrats : +8 % sur le prix des missions, gère l'agenda.",
    cost: 2200,
    wage: 22,
    income: 0,
    discount: 0,
    tipBonus: 0,
    missionBonus: 0.08,
    max: 2,
  },
];

export type StaffMember = {
  id: string;
  role: StaffRole;
  name: string;
  hiredAt: number;
};

const KEY = "mtw.personnel.v1";
const EVT = "mtw:personnel-changed";

const FIRST_NAMES = ["Léo", "Sam", "Inès", "Karim", "Maya", "Yann", "Zoé", "Théo", "Naïma", "Hugo", "Lila", "Otis", "Anaé", "Rayan", "Sofia", "Eli"];
const LAST_NAMES  = ["Diaz", "Bernard", "Kouadio", "Petit", "Nguyen", "Rossi", "Haddad", "Martins", "Silva", "Okafor", "Costa", "Marek"];

export function randomName(): string {
  const f = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const l = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${f} ${l}`;
}

export function loadStaff(): StaffMember[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveStaff(list: StaffMember[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {}
}

export function defFor(role: StaffRole): StaffDef {
  return STAFF_CATALOG.find((d) => d.role === role)!;
}

export function countByRole(list: StaffMember[], role: StaffRole): number {
  const hired = list.filter((s) => s.role === role).length;
  // Correctif gameplay : le joueur est toujours le premier chauffeur.
  // Sans ça, une sauvegarde neuve avec 1 taxi / 0 personnel reste bloquée au QG.
  if (role === "driver") return Math.max(1, hired);
  return hired;
}

export function hire(role: StaffRole): { ok: boolean; cost: number; reason?: string } {
  const list = loadStaff();
  const def = defFor(role);
  const hiredCount = list.filter((s) => s.role === role).length;
  if (hiredCount >= def.max) {
    return { ok: false, cost: def.cost, reason: "Capacité maximale atteinte" };
  }
  const member: StaffMember = {
    id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    role,
    name: randomName(),
    hiredAt: Date.now(),
  };
  saveStaff([...list, member]);
  return { ok: true, cost: def.cost };
}

export function fire(id: string) {
  saveStaff(loadStaff().filter((s) => s.id !== id));
}

export function subscribeStaff(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener(EVT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function getMaintenanceDiscount(): number {
  const list = loadStaff();
  const n = countByRole(list, "mechanic");
  return Math.min(0.6, n * defFor("mechanic").discount);
}

export function getTipsBonus(): number {
  const list = loadStaff();
  const n = countByRole(list, "manager");
  return Math.min(0.3, n * defFor("manager").tipBonus);
}

export function getMissionBonus(): number {
  const list = loadStaff();
  const n = countByRole(list, "secretary");
  return Math.min(0.24, n * defFor("secretary").missionBonus);
}

let tickHandle: number | null = null;
let lastTick = Date.now();

export function startPersonnelTick() {
  if (tickHandle !== null) return;
  lastTick = Date.now();
  tickHandle = window.setInterval(() => {
    const now = Date.now();
    const dtMin = (now - lastTick) / 60000;
    lastTick = now;
    const list = loadStaff();
    if (list.length === 0) return;
    let net = 0;
    for (const m of list) {
      const def = defFor(m.role);
      net += (def.income - def.wage) * dtMin;
    }
    const rounded = Math.round(net);
    if (rounded === 0) return;
    window.dispatchEvent(
      new CustomEvent("jce.player.cashDelta", {
        detail: {
          amount: rounded,
          reason: "personnel",
          label: rounded >= 0 ? "équipe" : "salaires équipe",
        },
      }),
    );
  }, 30000);
}

export function stopPersonnelTick() {
  if (tickHandle !== null) {
    window.clearInterval(tickHandle);
    tickHandle = null;
  }
}
