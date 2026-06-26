import { useEffect, useState } from "react";
import {
  STAFF_CATALOG,
  loadStaff,
  hire,
  fire,
  countByRole,
  subscribeStaff,
  type StaffMember,
  type StaffRole,
} from "./personnel";

type Props = {
  open: boolean;
  onClose: () => void;
  money: number;
  onHireCharge: (cost: number) => void;
};

export default function PersonnelPanel({ open, onClose, money, onHireCharge }: Props) {
  const [list, setList] = useState<StaffMember[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setList(loadStaff());
    const unsub = subscribeStaff(() => setList(loadStaff()));
    return unsub;
  }, [open]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1500);
  };

  if (!open) return null;

  const handleHire = (role: StaffRole, cost: number) => {
    if (money < cost) {
      showToast(`Il manque ${cost - money} $`);
      return;
    }
    const res = hire(role);
    if (!res.ok) {
      showToast(res.reason || "Impossible d'embaucher");
      return;
    }
    onHireCharge(cost);
    showToast(`✅ Embauche réussie (−${cost} $)`);
  };

  return (
    <div className="pp-overlay" onClick={onClose}>
      <div className="pp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="pp-head">
          <h3>👥 Personnel & Équipe</h3>
          <button className="pp-x" onClick={onClose}>×</button>
        </div>

        <div className="pp-body">
          <p className="pp-intro">
            Embauche des chauffeurs, des mécanos et des managers pour faire tourner ta flotte
            même quand tu n'es pas au volant. Salaires prélevés automatiquement.
          </p>

          <div className="pp-section-title">Catalogue d'embauche</div>
          <div className="pp-grid">
            {STAFF_CATALOG.map((def) => {
              const count = countByRole(list, def.role);
              const full = count >= def.max;
              const broke = money < def.cost;
              return (
                <div key={def.role} className="pp-card">
                  <div className="pp-card-head">
                    <span className="pp-ico">{def.icon}</span>
                    <div>
                      <b>{def.label}</b>
                      <em>{count}/{def.max}</em>
                    </div>
                  </div>
                  <p className="pp-desc">{def.desc}</p>
                  <div className="pp-stats">
                    {def.income > 0 && <span>💰 +{def.income} $/min</span>}
                    {def.wage > 0 && <span>📉 −{def.wage} $/min</span>}
                    {def.discount > 0 && <span>🔧 −{Math.round(def.discount * 100)}% entretien</span>}
                    {def.tipBonus > 0 && <span>💎 +{Math.round(def.tipBonus * 100)}% pourboires</span>}
                  </div>
                  <button
                    className="pp-hire-btn"
                    disabled={full || broke}
                    onClick={() => handleHire(def.role, def.cost)}
                  >
                    {full ? "COMPLET" : `EMBAUCHER · ${def.cost} $`}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="pp-section-title">Mon équipe ({list.length})</div>
          {list.length === 0 ? (
            <div className="pp-empty">Aucun employé pour le moment.</div>
          ) : (
            <ul className="pp-list">
              {list.map((m) => {
                const def = STAFF_CATALOG.find((d) => d.role === m.role)!;
                return (
                  <li key={m.id} className="pp-row">
                    <span className="pp-row-ico">{def.icon}</span>
                    <div className="pp-row-info">
                      <b>{m.name}</b>
                      <em>{def.label}</em>
                    </div>
                    <button className="pp-fire-btn" onClick={() => fire(m.id)}>
                      Renvoyer
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {toast && <div className="pp-toast">{toast}</div>}
      </div>

      <style>{`
        .pp-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.72);
          z-index: 1200; display: flex; align-items: center; justify-content: center;
          padding: 12px; backdrop-filter: blur(4px);
        }
        .pp-panel {
          background: linear-gradient(180deg, #1d1610 0%, #120c08 100%);
          border: 2px solid #a07840; border-radius: 14px;
          width: min(640px, 100%); max-height: 88vh; display: flex; flex-direction: column;
          color: #f5e9d6; box-shadow: 0 18px 44px rgba(0,0,0,0.6);
        }
        .pp-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; border-bottom: 1px solid #6a4a26;
          background: linear-gradient(180deg, #2a1d10, #1a1208);
          border-radius: 12px 12px 0 0;
        }
        .pp-head h3 { margin: 0; font-size: 18px; color: #ffd07a; }
        .pp-x {
          background: none; border: none; color: #f5e9d6; font-size: 26px;
          cursor: pointer; line-height: 1; padding: 0 6px;
        }
        .pp-body { padding: 14px 16px; overflow-y: auto; flex: 1; }
        .pp-intro { font-size: 13px; opacity: 0.85; margin: 0 0 12px; line-height: 1.4; }
        .pp-section-title {
          font-size: 12px; letter-spacing: 1px; text-transform: uppercase;
          color: #ffd07a; margin: 14px 0 8px; border-bottom: 1px dashed #6a4a26; padding-bottom: 4px;
        }
        .pp-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
        @media (min-width: 520px) { .pp-grid { grid-template-columns: 1fr 1fr; } }
        .pp-card {
          background: #2a1d10; border: 1px solid #6a4a26; border-radius: 10px;
          padding: 12px; display: flex; flex-direction: column; gap: 8px;
        }
        .pp-card-head { display: flex; align-items: center; gap: 10px; }
        .pp-ico { font-size: 28px; }
        .pp-card-head b { display: block; font-size: 15px; color: #ffd07a; }
        .pp-card-head em { font-style: normal; font-size: 11px; opacity: 0.7; }
        .pp-desc { font-size: 12px; opacity: 0.85; margin: 0; line-height: 1.35; }
        .pp-stats { display: flex; flex-wrap: wrap; gap: 6px; font-size: 11px; }
        .pp-stats span { background: #1a1208; border: 1px solid #5a3a1f; padding: 2px 6px; border-radius: 4px; }
        .pp-hire-btn {
          background: linear-gradient(180deg, #e0a040, #a06820);
          border: 1px solid #6a4015; border-radius: 6px; color: #fff;
          padding: 8px; font-weight: 700; cursor: pointer; font-size: 12px;
        }
        .pp-hire-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .pp-empty {
          text-align: center; padding: 20px; opacity: 0.5; font-style: italic; font-size: 13px;
        }
        .pp-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
        .pp-row {
          display: flex; align-items: center; gap: 10px;
          background: #2a1d10; border: 1px solid #6a4a26; border-radius: 8px; padding: 8px 10px;
        }
        .pp-row-ico { font-size: 22px; }
        .pp-row-info { flex: 1; }
        .pp-row-info b { display: block; font-size: 13px; color: #ffd07a; }
        .pp-row-info em { font-style: normal; font-size: 11px; opacity: 0.7; }
        .pp-fire-btn {
          background: #4a1818; border: 1px solid #8a3030; color: #ffb0b0;
          padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px;
        }
        .pp-toast {
          position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%);
          background: #1a1208; border: 1px solid #ffd07a; color: #ffd07a;
          padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;
        }
      `}</style>
    </div>
  );
}
