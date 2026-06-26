// Panneau unifié de gestion de la compagnie (refonte gameplay v2).
// Affiche en onglets : Flotte / RH / Contrats / Finances / Expansion / Bilan.
// Lit l'état via subscribe(), modifie via les actions du module.

import { useEffect, useState } from "react";
import {
  subscribe,
  getCompany,
  hireDriver, fireDriver, assignDriver,
  buyTaxi, sellTaxi, refuelTaxi, repairTaxi,
  signContract, cancelContract,
  buyStation,
  setTariff,
  takeLoan, repayLoan,
  type CompanyState, type DailyReport,
} from "./companyV2";

type Tab = "fleet" | "hr" | "contracts" | "finance" | "expansion" | "events";

export default function CompanyPanel({ onClose, onOpenGarage }: { onClose: () => void; onOpenGarage?: () => void }) {
  const [s, setS] = useState<CompanyState>(getCompany());
  const [tab, setTab] = useState<Tab>("fleet");
  const [report, setReport] = useState<DailyReport | null>(null);

  useEffect(() => subscribe(setS), []);
  useEffect(() => {
    const onR = (e: Event) => setReport((e as CustomEvent<DailyReport>).detail);
    window.addEventListener("mtw:daily-report", onR as EventListener);
    return () => window.removeEventListener("mtw:daily-report", onR as EventListener);
  }, []);

  const activeContracts = s.contracts.filter(c => c.signed).length;
  const activeTaxis = s.fleet.filter(t => t.driverId && t.status !== "broken" && t.status !== "garage").length;

  return (
    <div className="cpv2-backdrop" onClick={onClose}>
      <div className="cpv2-modal" onClick={e => e.stopPropagation()}>
        <header className="cpv2-head">
          <div>
            <div className="cpv2-title">🏢 MA COMPAGNIE</div>
            <div className="cpv2-sub">Jour {s.dayOfSim} · Réputation {Math.round(s.reputation)}/100 · Part de marché {Math.round(s.marketShare*100)}%</div>
          </div>
          <div className="cpv2-kpis">
            <div><b>{s.fleet.length}</b><span>taxis</span></div>
            <div><b>{activeTaxis}</b><span>en service</span></div>
            <div><b>{s.drivers.length}</b><span>chauffeurs</span></div>
            <div><b>{activeContracts}</b><span>contrats</span></div>
          </div>
          <button className="cpv2-x" onClick={onClose}>✕</button>
        </header>

        <nav className="cpv2-tabs">
          {([
            ["fleet", "🚖 Flotte"],
            ["hr", "👥 RH"],
            ["contracts", "📑 Contrats"],
            ["finance", "💰 Finances"],
            ["expansion", "🗺 Expansion"],
            ["events", "📰 Journal"],
          ] as [Tab, string][]).map(([k, lbl]) => (
            <button key={k} className={`cpv2-tab ${tab === k ? "is-active" : ""}`} onClick={() => setTab(k)}>{lbl}</button>
          ))}
        </nav>

        <section className="cpv2-body">
          {tab === "fleet" && <FleetTab s={s} />}
          {tab === "hr" && <HrTab s={s} />}
          {tab === "contracts" && <ContractsTab s={s} />}
          {tab === "finance" && <FinanceTab s={s} />}
          {tab === "expansion" && <ExpansionTab s={s} />}
          {tab === "events" && <EventsTab s={s} />}
        </section>

        {report && (
          <div className="cpv2-report" onClick={() => setReport(null)}>
            <div className="cpv2-report-card" onClick={e => e.stopPropagation()}>
              <h3>📊 Bilan Jour {report.day}</h3>
              <ul>
                <li>Recettes brutes <b>+{report.revenue} $</b></li>
                <li>Carburant <b>-{report.fuelCost} $</b></li>
                <li>Salaires <b>-{report.wages} $</b></li>
                <li>Maintenance <b>-{report.maintenance} $</b></li>
                <li>Taxes <b>-{report.taxes} $</b></li>
                <li>Courses : <b>{report.rides}</b></li>
              </ul>
              <div className={`cpv2-net ${report.net >= 0 ? "pos" : "neg"}`}>
                Net : {report.net >= 0 ? "+" : ""}{report.net} $
              </div>
              <button onClick={() => setReport(null)}>OK</button>
            </div>
          </div>
        )}
      </div>
      <style>{CSS}</style>
    </div>
  );
}

function FleetTab({ s }: { s: CompanyState }) {
  return (
    <div>
      <div className="cpv2-row-head">
        <h4>Flotte ({s.fleet.length})</h4>
        <button className="cpv2-act primary" onClick={() => buyTaxi()}>+ Acheter taxi (3 500 $)</button>
      </div>
      <div className="cpv2-grid">
        {s.fleet.map(t => {
          const drv = t.driverId ? s.drivers.find(d => d.id === t.driverId) : null;
          return (
            <div key={t.id} className="cpv2-card">
              <div className="cpv2-card-head">
                <span className="cpv2-emo">🚖</span>
                <div>
                  <div className="cpv2-card-title">{t.livery}</div>
                  <div className="cpv2-card-sub">{t.km.toLocaleString()} km · {Math.round(t.earnedToday)} $/jour</div>
                </div>
                <span className={`cpv2-pill st-${t.status}`}>{statusLabel(t.status)}</span>
              </div>
              <Bar label="État" value={t.condition} color={t.condition > 50 ? "#34d399" : t.condition > 25 ? "#fbbf24" : "#ef4444"} />
              <Bar label="Carburant" value={t.fuel} color="#60a5fa" />
              <div className="cpv2-driver-line">
                {drv ? <>👤 <b>{drv.name}</b> · {drv.shift === "day" ? "☀️ jour" : "🌙 nuit"} · moral {drv.morale}%</> : <em>Aucun chauffeur</em>}
              </div>
              <div className="cpv2-actions-row">
                <button onClick={() => refuelTaxi(t.id)} disabled={t.fuel >= 100}>⛽ Plein</button>
                <button onClick={() => repairTaxi(t.id)} disabled={t.condition >= 100}>🔧 Réparer</button>
                <button onClick={() => sellTaxi(t.id)} className="danger">Vendre</button>
              </div>
            </div>
          );
        })}
        {s.fleet.length === 0 && <div className="cpv2-empty">Aucun taxi. Achète-en un pour démarrer la simulation.</div>}
      </div>
    </div>
  );
}

function HrTab({ s }: { s: CompanyState }) {
  return (
    <div>
      <div className="cpv2-row-head">
        <h4>Chauffeurs ({s.drivers.length})</h4>
        <button className="cpv2-act primary" onClick={() => hireDriver()}>+ Embaucher (600 $)</button>
      </div>
      <div className="cpv2-grid">
        {s.drivers.map(d => (
          <div key={d.id} className="cpv2-card">
            <div className="cpv2-card-head">
              <img src={d.avatar} alt="" className="cpv2-avatar" />
              <div>
                <div className="cpv2-card-title">{d.name}</div>
                <div className="cpv2-card-sub">{d.shift === "day" ? "☀️ Shift jour" : "🌙 Shift nuit"} · {d.wage} $/jour</div>
              </div>
            </div>
            <div className="cpv2-stats">
              <span>🚗 Conduite {d.stats.driving}</span>
              <span>🤝 Service {d.stats.service}</span>
              <span>💪 Endurance {d.stats.stamina}</span>
            </div>
            <Bar label="Moral" value={d.morale} color={d.morale > 50 ? "#34d399" : "#ef4444"} />
            <Bar label="Fatigue" value={d.fatigue} color="#f59e0b" />
            <div className="cpv2-driver-line">
              Assigné à :{" "}
              <select
                value={d.assignedTaxiId || ""}
                onChange={e => assignDriver(d.id, e.target.value || null)}
              >
                <option value="">— Aucun —</option>
                {s.fleet.map(t => (
                  <option key={t.id} value={t.id} disabled={!!t.driverId && t.driverId !== d.id}>
                    {t.livery} {t.driverId && t.driverId !== d.id ? "(occupé)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="cpv2-actions-row">
              <button className="danger" onClick={() => fireDriver(d.id)}>Licencier</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContractsTab({ s }: { s: CompanyState }) {
  return (
    <div>
      <h4>Contrats B2B</h4>
      <p className="cpv2-help">Signe un contrat pour garantir un volume de courses. Tiens l'objectif chaque semaine sinon pénalité.</p>
      <div className="cpv2-grid">
        {s.contracts.map(c => {
          const canSign = s.fleet.length >= c.reqTaxis;
          const progress = c.weeklyTarget > 0 ? Math.min(100, (c.weeklyDone / c.weeklyTarget) * 100) : 0;
          return (
            <div key={c.key} className={`cpv2-card ${c.signed ? "is-signed" : ""}`}>
              <div className="cpv2-card-head">
                <span className="cpv2-emo">{c.icon}</span>
                <div>
                  <div className="cpv2-card-title">{c.label}</div>
                  <div className="cpv2-card-sub">x{c.fareMult.toFixed(2)} tarif · min {c.reqTaxis} taxis</div>
                </div>
              </div>
              <p className="cpv2-desc">{c.desc}</p>
              {c.signed && <Bar label={`Hebdo ${c.weeklyDone}/${c.weeklyTarget}`} value={progress} color="#fde047" />}
              <div className="cpv2-card-meta">
                <span>✅ +{c.reward} $ si tenu</span>
                <span>⚠️ -{c.penalty} $ sinon</span>
              </div>
              <div className="cpv2-actions-row">
                {c.signed
                  ? <button className="danger" onClick={() => cancelContract(c.key)}>Rompre</button>
                  : <button className="primary" disabled={!canSign} onClick={() => signContract(c.key)}>
                      {canSign ? "Signer" : `Besoin ${c.reqTaxis} taxis`}
                    </button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FinanceTab({ s }: { s: CompanyState }) {
  const [base, setBase] = useState(s.baseFare);
  const [night, setNight] = useState(s.nightSurcharge);
  const [rain, setRain] = useState(s.rainSurcharge);
  const [loan, setLoan] = useState(5000);
  return (
    <div className="cpv2-finance">
      <div className="cpv2-card">
        <h4>💵 Tarifs</h4>
        <label>Tarif de base : <b>{base} $</b>
          <input type="range" min={5} max={45} value={base} onChange={e => setBase(+e.target.value)} />
        </label>
        <label>Surcharge nuit : <b>{night}%</b>
          <input type="range" min={0} max={80} value={night} onChange={e => setNight(+e.target.value)} />
        </label>
        <label>Surcharge pluie : <b>{rain}%</b>
          <input type="range" min={0} max={80} value={rain} onChange={e => setRain(+e.target.value)} />
        </label>
        <button className="primary" onClick={() => setTariff(base, night, rain)}>Appliquer</button>
        <p className="cpv2-help">⚠️ Trop cher = clients vont chez les rivaux.</p>
      </div>
      <div className="cpv2-card">
        <h4>⛽ Carburant</h4>
        <div>Prix actuel : <b>{s.fuelPrice.toFixed(2)} $/u</b></div>
        <p className="cpv2-help">Le prix fluctue. Une station-essence (extension future) le bloquera.</p>
      </div>
      <div className="cpv2-card">
        <h4>🏦 Crédit bancaire</h4>
        <div>Dette actuelle : <b>{s.debt} $</b></div>
        <label>Emprunter : <b>{loan} $</b>
          <input type="range" min={1000} max={50000} step={500} value={loan} onChange={e => setLoan(+e.target.value)} />
        </label>
        <div className="cpv2-actions-row">
          <button onClick={() => takeLoan(loan)}>Emprunter +{Math.round(loan*1.2)} dette</button>
          <button disabled={s.debt <= 0} onClick={() => repayLoan(Math.min(s.debt, 2000))}>Rembourser 2 000 $</button>
        </div>
      </div>
      {s.lastReport && (
        <div className="cpv2-card">
          <h4>📊 Dernier bilan (J{s.lastReport.day})</h4>
          <ul>
            <li>Recettes <b>+{s.lastReport.revenue} $</b></li>
            <li>Carburant -{s.lastReport.fuelCost} $</li>
            <li>Salaires -{s.lastReport.wages} $</li>
            <li>Maintenance -{s.lastReport.maintenance} $</li>
            <li>Taxes -{s.lastReport.taxes} $</li>
          </ul>
          <div className={`cpv2-net ${s.lastReport.net >= 0 ? "pos" : "neg"}`}>
            Net : {s.lastReport.net >= 0 ? "+" : ""}{s.lastReport.net} $
          </div>
        </div>
      )}
    </div>
  );
}

function ExpansionTab({ s }: { s: CompanyState }) {
  return (
    <div>
      <h4>Stations-relais par quartier</h4>
      <p className="cpv2-help">Chaque station augmente ta part de marché et tes courses captées dans le quartier.</p>
      <div className="cpv2-grid">
        {s.stations.map(st => (
          <div key={st.district} className={`cpv2-card ${st.owned ? "is-signed" : ""}`}>
            <div className="cpv2-card-head">
              <span className="cpv2-emo">{st.owned ? "🏁" : "📍"}</span>
              <div>
                <div className="cpv2-card-title">{st.district}</div>
                <div className="cpv2-card-sub">{st.owned ? "Possédée" : `Achat : ${st.cost} $`}</div>
              </div>
            </div>
            {!st.owned && (
              <div className="cpv2-actions-row">
                <button className="primary" onClick={() => buyStation(st.district)}>Acquérir (+8% part marché)</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EventsTab({ s }: { s: CompanyState }) {
  return (
    <div>
      <h4>Journal de bord</h4>
      <ul className="cpv2-log">
        {s.eventsLog.map(e => (
          <li key={e.id} className={`type-${e.type}`}>
            <span>{new Date(e.ts).toLocaleTimeString()}</span>
            <span>{e.message}</span>
          </li>
        ))}
        {s.eventsLog.length === 0 && <li className="cpv2-empty">Aucun événement pour le moment.</li>}
      </ul>
    </div>
  );
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="cpv2-bar">
      <span>{label}</span>
      <div className="cpv2-bar-track"><div className="cpv2-bar-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} /></div>
      <span>{Math.round(value)}%</span>
    </div>
  );
}

function statusLabel(s: string) {
  switch (s) {
    case "garage": return "🅿️ Garage";
    case "cruising": return "🚦 En maraude";
    case "onRide": return "👤 Course";
    case "returning": return "↩ Retour";
    case "broken": return "🛑 Panne";
    default: return s;
  }
}

const CSS = `
.cpv2-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 12000; display: flex; align-items: center; justify-content: center; padding: 12px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
.cpv2-modal { width: 100%; max-width: 980px; max-height: 92vh; background: #0f1419; color: #e7eaf0; border-radius: 18px; border: 2px solid #1f2937; display: flex; flex-direction: column; box-shadow: 0 30px 80px rgba(0,0,0,0.6); overflow: hidden; }
.cpv2-head { display: flex; align-items: center; gap: 16px; padding: 14px 18px; border-bottom: 1px solid #1f2937; background: linear-gradient(180deg, #131a23, #0f1419); }
.cpv2-title { font-weight: 900; font-size: 18px; letter-spacing: 0.5px; }
.cpv2-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
.cpv2-kpis { display: flex; gap: 12px; margin-left: auto; }
.cpv2-kpis > div { background: #111827; border: 1px solid #1f2937; border-radius: 10px; padding: 6px 12px; text-align: center; min-width: 60px; }
.cpv2-kpis b { display: block; font-size: 16px; color: #fde047; }
.cpv2-kpis span { font-size: 9px; color: #94a3b8; text-transform: uppercase; }
.cpv2-x { background: #1f2937; border: none; color: #fff; border-radius: 50%; width: 34px; height: 34px; font-size: 16px; cursor: pointer; }
.cpv2-tabs { display: flex; gap: 4px; padding: 8px 12px; background: #0a0e13; border-bottom: 1px solid #1f2937; overflow-x: auto; }
.cpv2-tab { background: transparent; border: 1px solid transparent; color: #94a3b8; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 12px; white-space: nowrap; }
.cpv2-tab.is-active { background: #1f2937; color: #fde047; border-color: #374151; }
.cpv2-body { padding: 16px 18px; overflow-y: auto; flex: 1; }
.cpv2-row-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.cpv2-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.cpv2-card { background: #131a23; border: 1px solid #1f2937; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.cpv2-card.is-signed { border-color: #fde047; box-shadow: 0 0 0 1px rgba(253,224,71,0.2) inset; }
.cpv2-card h4 { margin: 0 0 6px 0; font-size: 13px; }
.cpv2-card-head { display: flex; align-items: center; gap: 10px; }
.cpv2-emo { font-size: 22px; }
.cpv2-card-title { font-weight: 800; font-size: 13px; }
.cpv2-card-sub { font-size: 10px; color: #94a3b8; }
.cpv2-pill { margin-left: auto; font-size: 10px; padding: 3px 8px; border-radius: 999px; background: #1f2937; }
.cpv2-pill.st-cruising { background: #064e3b; color: #6ee7b7; }
.cpv2-pill.st-broken { background: #7f1d1d; color: #fca5a5; }
.cpv2-bar { display: grid; grid-template-columns: 60px 1fr 36px; align-items: center; gap: 6px; font-size: 10px; color: #94a3b8; }
.cpv2-bar-track { height: 6px; background: #1f2937; border-radius: 3px; overflow: hidden; }
.cpv2-bar-fill { height: 100%; transition: width 0.3s; }
.cpv2-driver-line { font-size: 11px; color: #cbd5e1; }
.cpv2-driver-line select { background: #0a0e13; color: #fff; border: 1px solid #374151; border-radius: 6px; padding: 3px 6px; margin-left: 4px; }
.cpv2-avatar { width: 36px; height: 36px; border-radius: 50%; background: #1f2937; }
.cpv2-stats { display: flex; flex-wrap: wrap; gap: 6px; font-size: 10px; color: #cbd5e1; }
.cpv2-stats span { background: #1f2937; padding: 2px 6px; border-radius: 4px; }
.cpv2-actions-row { display: flex; gap: 6px; flex-wrap: wrap; }
.cpv2-actions-row button, .cpv2-act { background: #1f2937; color: #fff; border: 1px solid #374151; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 11px; }
.cpv2-actions-row button:disabled { opacity: 0.4; cursor: not-allowed; }
.cpv2-actions-row button.primary, .cpv2-act.primary { background: #fde047; color: #0f1419; border-color: #fde047; }
.cpv2-actions-row button.danger { background: #7f1d1d; border-color: #b91c1c; }
.cpv2-card-meta { display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
.cpv2-desc { font-size: 11px; color: #cbd5e1; margin: 0; }
.cpv2-help { font-size: 11px; color: #94a3b8; margin: 4px 0 8px 0; }
.cpv2-empty { color: #6b7280; font-size: 12px; padding: 20px; text-align: center; }
.cpv2-finance { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.cpv2-finance label { display: block; font-size: 11px; color: #cbd5e1; margin-bottom: 8px; }
.cpv2-finance input[type=range] { width: 100%; }
.cpv2-net { text-align: center; font-weight: 900; font-size: 18px; padding: 10px; border-radius: 8px; margin-top: 6px; }
.cpv2-net.pos { background: #064e3b; color: #6ee7b7; }
.cpv2-net.neg { background: #7f1d1d; color: #fca5a5; }
.cpv2-log { list-style: none; padding: 0; margin: 0; max-height: 50vh; overflow-y: auto; }
.cpv2-log li { display: grid; grid-template-columns: 80px 1fr; gap: 10px; padding: 8px 10px; border-bottom: 1px solid #1f2937; font-size: 12px; }
.cpv2-log li span:first-child { color: #6b7280; font-size: 10px; }
.cpv2-report { position: absolute; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 13000; padding: 20px; }
.cpv2-report-card { background: #131a23; border: 2px solid #fde047; border-radius: 14px; padding: 20px; max-width: 360px; color: #fff; }
.cpv2-report-card h3 { margin: 0 0 12px 0; color: #fde047; }
.cpv2-report-card ul { list-style: none; padding: 0; margin: 0 0 12px 0; }
.cpv2-report-card li { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; border-bottom: 1px solid #1f2937; }
.cpv2-report-card button { width: 100%; background: #fde047; color: #0f1419; border: none; padding: 10px; border-radius: 8px; font-weight: 800; cursor: pointer; margin-top: 12px; }
`;
