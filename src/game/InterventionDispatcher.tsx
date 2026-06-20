// =============================================================
// Lot 6 — Toasts d'intervention.
// Affiche un message quand le joueur clique un incident :
//   - "voiture dépêchée" si CityTraffic a trouvé un véhicule libre
//   - "aucun véhicule X" si aucun n'est dispo ou importé
// Les véhicules eux-mêmes sont gérés dans CityTraffic (ce sont
// les voitures déjà sur la map qui se détournent vers l'incident).
// =============================================================
import { useEffect, useState } from "react";
import type { CustomVehicleCategory } from "./gameAssets";

const ICON: Record<CustomVehicleCategory, string> = {
  civil: "🚗", taxi: "🚕", police: "🚓", ambulance: "🚑", firetruck: "🚒", service: "🚛",
};

type Toast = { id: number; text: string; tone: "ok" | "warn" };

export default function InterventionDispatcher() {
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    const onAssigned = (ev: Event) => {
      const d = (ev as CustomEvent<{ category: CustomVehicleCategory; label: string }>).detail;
      if (!d) return;
      setToast({
        id: Date.now(),
        tone: "ok",
        text: `${ICON[d.category]} ${d.label} — véhicule en route`,
      });
    };
    const onNoMatch = (ev: Event) => {
      const d = (ev as CustomEvent<{ category: CustomVehicleCategory; label: string }>).detail;
      if (!d) return;
      setToast({
        id: Date.now(),
        tone: "warn",
        text: `❗ Aucun véhicule ${ICON[d.category]} disponible sur la carte`,
      });
    };
    const onAIStole = (ev: Event) => {
      const d = (ev as CustomEvent<{ category: CustomVehicleCategory; label: string }>).detail;
      if (!d) return;
      setToast({
        id: Date.now(),
        tone: "warn",
        text: `🤖 Trop lent ! L'AI a pris la mission ${ICON[d.category]} ${d.label}`,
      });
    };
    window.addEventListener("jce.intervention.assigned", onAssigned as EventListener);
    window.addEventListener("jce.intervention.nomatch", onNoMatch as EventListener);
    window.addEventListener("jce.intervention.ai-stole", onAIStole as EventListener);
    return () => {
      window.removeEventListener("jce.intervention.assigned", onAssigned as EventListener);
      window.removeEventListener("jce.intervention.nomatch", onNoMatch as EventListener);
      window.removeEventListener("jce.intervention.ai-stole", onAIStole as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  if (!toast) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 40,
        padding: "8px 14px",
        borderRadius: 10,
        background: "rgba(12,14,22,0.92)",
        border: `1px solid ${toast.tone === "ok" ? "#22e36a88" : "#f59e0b88"}`,
        color: "#e8edf5",
        font: "600 12px/1.3 ui-sans-serif, system-ui",
        backdropFilter: "blur(8px)",
        pointerEvents: "none",
        maxWidth: "84vw",
        textAlign: "center",
      }}
      role="status"
    >
      {toast.text}
    </div>
  );
}
