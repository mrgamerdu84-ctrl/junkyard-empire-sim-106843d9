// Tracker global : écoute les événements de gameplay, met à jour les compteurs
// du chapitre courant, et auto-complète le chapitre quand la barre atteint 100%.
// Aucun rendu visuel (le HUD affiche la barre).

import { useEffect } from "react";
import { bumpCourse, refreshDerivedCounters, maybeAutoCompleteByProgress } from "./campaign/progression";

export default function CampaignProgressTracker() {
  useEffect(() => {
    const onCourse = () => {
      bumpCourse();
      refreshDerivedCounters();
      maybeAutoCompleteByProgress();
    };
    const onCampaign = () => {
      refreshDerivedCounters();
      maybeAutoCompleteByProgress();
    };
    window.addEventListener("mtw:course-completed", onCourse);
    window.addEventListener("campaign.updated", onCampaign);

    // Poll léger : argent / véhicules / dépôt évoluent hors événements dédiés.
    const iv = window.setInterval(() => {
      refreshDerivedCounters();
      maybeAutoCompleteByProgress();
    }, 4000);
    return () => {
      window.removeEventListener("mtw:course-completed", onCourse);
      window.removeEventListener("campaign.updated", onCampaign);
      window.clearInterval(iv);
    };
  }, []);
  return null;
}
