// Toast discret qui apparaît quand une feature de campagne se débloque.
import { useEffect, useState } from "react";
import { FEATURE_MIN_CHAPTER } from "./campaign/unlocks";
import { CHAPTERS } from "./campaign/campaignData";

const LABELS: Record<string, string> = {
  "personnel.marcel": "Marcel, mécano de ton père",
  "taxi.buy_second": "Achat d'un deuxième taxi",
  "office.explore": "Exploration du bureau du père",
  "mail.system": "Courrier & lettres",
  "baron.hint": "Une ombre s'intéresse à Taxi Co.",
  "baron.active": "Le Baron entre en scène",
  "contracts.system": "Système de contrats",
  "reputation.system": "Réputation de Taxi Co.",
  "rivals.spawn": "Concurrents en ville",
  "security.system": "Sécurité du dépôt",
  "mafia.attackers": "Sabotages mafieux",
  "depot.b12": "Dépôt B-12 accessible",
  "investigation.system": "Enquête ouverte",
  "npc.journalist": "Un journaliste te contacte",
  "choice.three_paths": "Le choix final approche",
  "empire.mode": "🏆 MODE EMPIRE DÉVERROUILLÉ",
  "empire.arena": "Arène mondiale ouverte",
  "empire.defis": "Défis 1v1 débloqués",
};

type Item = { id: string; text: string; chapter: number };

export default function UnlockToast() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const on = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string; chapter: number } | undefined;
      if (!detail) return;
      const label = LABELS[detail.id];
      if (!label) return; // n'affiche que les features "notables"
      const ch = CHAPTERS.find((c) => c.number === detail.chapter);
      const text = ch ? `${label} — ${ch.title}` : label;
      const item: Item = { id: `${detail.id}-${Date.now()}`, text, chapter: detail.chapter };
      setItems((prev) => [...prev, item]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      }, 5200);
    };
    window.addEventListener("feature.unlocked", on);
    return () => window.removeEventListener("feature.unlocked", on);
  }, []);

  if (items.length === 0) return null;
  // Vérifie qu'on est bien dans le navigateur (pas SSR)
  return (
    <div
      style={{
        position: "fixed",
        top: 64,
        right: 12,
        zIndex: 9800,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
        maxWidth: 320,
      }}
      data-no-pan
    >
      {items.map((it) => (
        <div
          key={it.id}
          style={{
            background: "linear-gradient(180deg, rgba(24,18,8,0.96), rgba(10,7,3,0.96))",
            border: "2px solid #f5c542",
            borderRadius: 10,
            padding: "10px 12px",
            color: "#fde047",
            font: "800 12px system-ui, sans-serif",
            boxShadow: "0 6px 22px rgba(0,0,0,0.55), inset 0 0 12px rgba(245,197,66,0.15)",
            animation: "unlockToastIn 0.35s ease-out",
          }}
        >
          <div style={{ fontSize: 10, opacity: 0.75, marginBottom: 3 }}>
            🔓 Nouveauté débloquée
          </div>
          <div>{it.text}</div>
        </div>
      ))}
      <style>{`@keyframes unlockToastIn { from { transform: translateX(20px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
    </div>
  );
}
