// Boutique de taxis + gestion garage.
// Débloqué au Chapitre 2 via la feature "dealership".
// Achats écrits dans `taxi-tycoon-v4` — respect strict du cap campagne.

import { useEffect, useState, type CSSProperties } from "react";
import { TAXI_MODELS, type TaxiModel } from "./dealership/taxiModels";
import {
  loadDealership, subscribeDealership, isModelUnlocked,
  buyModel, assignDriver, unassignDriver, getMoney, getFleet, currentChapterNumber,
} from "./dealership/dealershipState";
import { loadStaff, subscribeStaff, type StaffMember } from "./personnel";
import { unlockedTaxiCount } from "./campaign/campaignState";
import { GAME_ASSETS } from "./gameAssets";

type Tab = "shop" | "garage";

export default function DealershipPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("shop");
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);

  useEffect(() => {
    const u1 = subscribeDealership(refresh);
    const u2 = subscribeStaff(refresh);
    const onSave = () => refresh();
    window.addEventListener("mtw:save-updated", onSave);
    return () => { u1(); u2(); window.removeEventListener("mtw:save-updated", onSave); };
  }, []);

  const money = getMoney();
  const fleet = getFleet();
  const staff = loadStaff();
  const drivers = staff.filter((s) => s.role === "driver");
  const cap = unlockedTaxiCount();
  const chapter = currentChapterNumber();

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={header}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#f5c542", letterSpacing: 1 }}>🏪 Concessionnaire Taxi Co.</div>
            <div style={{ fontSize: 12, color: "#fde047", opacity: 0.75 }}>
              Chapitre {chapter} · Flotte {fleet.length}/{cap} · 💰 {money.toLocaleString()} $
            </div>
          </div>
          <button style={btnClose} onClick={onClose}>✕</button>
        </div>

        <div style={tabs}>
          <button style={{ ...tabBtn, ...(tab === "shop" ? tabActive : {}) }} onClick={() => setTab("shop")}>Concessionnaire</button>
          <button style={{ ...tabBtn, ...(tab === "garage" ? tabActive : {}) }} onClick={() => setTab("garage")}>Mon Garage ({fleet.length})</button>
        </div>

        <div style={body}>
          {tab === "shop" ? (
            <ShopTab money={money} cap={cap} onBuy={(id) => {
              const r = buyModel(id, cap);
              if (!r.ok) alert(r.reason ?? "Achat refusé");
              refresh();
            }} />
          ) : (
            <GarageTab fleet={fleet} drivers={drivers} onAssign={(driverId, taxiIndex) => { assignDriver(driverId, taxiIndex); refresh(); }} onUnassign={(driverId) => { unassignDriver(driverId); refresh(); }} />
          )}
        </div>
      </div>
    </div>
  );
}

// -------- Shop --------

function ShopTab({ money, cap, onBuy }: { money: number; cap: number; onBuy: (id: string) => void }) {
  const fleet = getFleet();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
      {TAXI_MODELS.map((m) => {
        const unlocked = isModelUnlocked(m);
        const canAfford = money >= m.price;
        const fleetFull = fleet.length >= cap;
        const owned = m.id === "heritage"; // toujours possédé
        const disabled = !unlocked || !canAfford || fleetFull;
        return (
          <div key={m.id} style={{ ...modelCard, opacity: unlocked ? 1 : 0.55 }}>
            <div style={modelImgWrap}>
              <img src={GAME_ASSETS[m.assetKey]} alt={m.name} style={modelImg} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
              <div style={{ fontWeight: 900, color: "#f5c542", fontSize: 15 }}>{m.emoji} {m.name}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: canAfford ? "#22c55e" : "#f87171" }}>
                {m.price === 0 ? "Offert" : `${m.price.toLocaleString()} $`}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#cbd5e1", margin: "4px 0 8px" }}>{m.desc}</div>
            <Stats m={m} />
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 8 }}>
              Entretien : {m.maintenance} $/mois · Prestige {m.prestige}/10
            </div>
            {!unlocked ? (
              <button style={btnLocked} disabled>🔒 Disponible chapitre {m.unlockChapter}</button>
            ) : owned ? (
              <button style={btnOwned} disabled>✔ Modèle offert</button>
            ) : (
              <button style={{ ...btnBuy, ...(disabled ? btnBuyDisabled : {}) }} disabled={disabled} onClick={() => onBuy(m.id)}>
                {fleetFull ? "🔒 Flotte pleine" : !canAfford ? `Manque ${(m.price - money).toLocaleString()} $` : "🛒 Acheter"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Stats({ m }: { m: TaxiModel }) {
  const rows: Array<[string, number]> = [
    ["Vitesse", m.speed],
    ["Fiabilité", m.reliability],
    ["Confort", m.comfort],
    ["Conso", 11 - m.fuel], // affichage inversé : moins = plus économe
  ];
  return (
    <div style={{ display: "grid", gap: 4 }}>
      {rows.map(([label, v]) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
          <div style={{ width: 62, color: "#cbd5e1" }}>{label}</div>
          <div style={gaugeBg}>
            <div style={{ ...gaugeFill, width: `${v * 10}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// -------- Garage --------

function GarageTab({
  fleet, drivers, onAssign, onUnassign,
}: {
  fleet: { colorId: string; modelId?: string }[];
  drivers: StaffMember[];
  onAssign: (driverId: string, taxiIndex: number) => void;
  onUnassign: (driverId: string) => void;
}) {
  const d = loadDealership();
  const unassignedDrivers = drivers.filter((dr) => d.assignments[dr.id] === undefined);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {unassignedDrivers.length > 0 && (
        <div style={{ background: "#78350f", border: "1px solid #f59e0b", borderRadius: 8, padding: 8, fontSize: 12, color: "#fde047" }}>
          ⚠️ {unassignedDrivers.length} chauffeur{unassignedDrivers.length > 1 ? "s" : ""} sans taxi assigné : ils ne travaillent pas.
        </div>
      )}
      {fleet.length === 0 && (
        <div style={{ padding: 16, textAlign: "center", color: "#94a3b8" }}>Aucun taxi. Passe voir le Concessionnaire.</div>
      )}
      {fleet.map((t, i) => {
        const modelId = t.modelId ?? (i === 0 ? "heritage" : "classic");
        const model = TAXI_MODELS.find((m) => m.id === modelId) ?? TAXI_MODELS[0];
        const driverId = Object.entries(d.assignments).find(([, v]) => v === i)?.[0];
        const driver = drivers.find((dr) => dr.id === driverId);
        return (
          <div key={i} style={garageRow}>
            <img src={GAME_ASSETS[model.assetKey]} alt="" style={{ width: 56, height: 40, objectFit: "contain" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, color: "#f5c542", fontSize: 13 }}>{model.emoji} {model.name} <span style={{ opacity: 0.5, fontWeight: 500 }}>#{i + 1}</span></div>
              <div style={{ fontSize: 11, color: "#cbd5e1" }}>
                {driver ? <>👤 {driver.name}</> : <span style={{ color: "#f87171" }}>Inactif — aucun chauffeur</span>}
                {i === 0 && !driver && <span style={{ color: "#94a3b8" }}> (conduit par le joueur)</span>}
              </div>
            </div>
            <select
              value={driverId ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") { if (driverId) onUnassign(driverId); }
                else onAssign(v, i);
              }}
              style={select}
            >
              <option value="">— {i === 0 ? "joueur" : "personne"} —</option>
              {drivers.map((dr) => {
                const busyAt = d.assignments[dr.id];
                const busy = busyAt !== undefined && busyAt !== i;
                return <option key={dr.id} value={dr.id} disabled={busy}>{dr.name}{busy ? ` (taxi #${busyAt + 1})` : ""}</option>;
              })}
            </select>
          </div>
        );
      })}
    </div>
  );
}

// -------- styles --------

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 15000,
  display: "flex", alignItems: "center", justifyContent: "center", padding: 12,
};
const card: React.CSSProperties = {
  width: "min(920px, 100%)", maxHeight: "94vh",
  background: "linear-gradient(180deg,#0f172a,#111827)", border: "2px solid #f5c542",
  borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
  display: "flex", flexDirection: "column", overflow: "hidden",
};
const header: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid #1f2937" };
const btnClose: React.CSSProperties = { background: "#1f2937", color: "#fde047", border: "1px solid #374151", borderRadius: 8, padding: "6px 10px", fontWeight: 800, cursor: "pointer" };
const tabs: React.CSSProperties = { display: "flex", gap: 6, padding: "8px 12px 0" };
const tabBtn: React.CSSProperties = { flex: 1, padding: "9px 12px", background: "#1f2937", color: "#cbd5e1", border: "1px solid #374151", borderRadius: 8, fontWeight: 800, cursor: "pointer" };
const tabActive: React.CSSProperties = { background: "#f5c542", color: "#1a1208", borderColor: "#fde047" };
const body: React.CSSProperties = { padding: 12, overflowY: "auto", flex: 1 };
const modelCard: React.CSSProperties = { background: "#111827", border: "1px solid #374151", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column" };
const modelImgWrap: React.CSSProperties = { background: "linear-gradient(180deg,#1f2937,#0b1220)", borderRadius: 8, height: 88, display: "flex", alignItems: "center", justifyContent: "center", padding: 6 };
const modelImg: React.CSSProperties = { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" };
const gaugeBg: React.CSSProperties = { flex: 1, height: 6, background: "#1f2937", borderRadius: 4, overflow: "hidden" };
const gaugeFill: React.CSSProperties = { height: "100%", background: "linear-gradient(90deg,#f5c542,#fde047)" };
const btnBuy: React.CSSProperties = { marginTop: 8, background: "linear-gradient(180deg,#22c55e,#15803d)", color: "#052e16", fontWeight: 900, border: "none", borderRadius: 8, padding: "9px 10px", cursor: "pointer" };
const btnBuyDisabled: React.CSSProperties = { background: "#374151", color: "#94a3b8", cursor: "not-allowed" };
const btnLocked: React.CSSProperties = { marginTop: 8, background: "#1f2937", color: "#94a3b8", border: "1px dashed #4b5563", borderRadius: 8, padding: "9px 10px", cursor: "not-allowed" };
const btnOwned: React.CSSProperties = { marginTop: 8, background: "#1e293b", color: "#22c55e", border: "1px solid #14532d", borderRadius: 8, padding: "9px 10px", cursor: "default" };
const garageRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, background: "#111827", border: "1px solid #374151", borderRadius: 8, padding: 8 };
const select: React.CSSProperties = { background: "#0f172a", color: "#fde047", border: "1px solid #374151", borderRadius: 6, padding: "6px 8px", fontWeight: 700 };
