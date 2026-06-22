import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import citymap from "@/assets/citymap2.jpg";
import TaxiTycoon from "@/game/TaxiTycoon";
import CityTraffic from "@/game/CityTraffic";
import CityCompetitors from "@/game/CityCompetitors";
import CityHud from "@/game/CityHud";
import CrimeEvents from "@/game/CrimeEvents";
import InterventionDispatcher from "@/game/InterventionDispatcher";
import RadarFlash from "@/game/RadarFlash";
import AmbientSirens from "@/game/AmbientSirens";
import AdminPanel from "@/game/AdminPanel";
import RulesPanel from "@/game/RulesPanel";
import VersionBanner from "@/game/VersionBanner";
import HomeScreen from "@/game/HomeScreen";
import SplashScreen from "@/game/SplashScreen";
import GameMenu from "@/game/GameMenu";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Taxi Tycoon — City Cab Empire" },
      { name: "description", content: "Hérite d'un garage délabré et bâtis le plus grand empire de taxis de la ville." },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { property: "og:title", content: "Taxi Tycoon — City Cab Empire" },
      { property: "og:description", content: "Tycoon idle : tes taxis vont chercher les clients, tu agrandis l'entrepôt." },
    ],
  }),
  component: TaxiTycoonPage,
});

function TaxiTycoonPage() {
  const [phase, setPhase] = useState<"splash" | "home" | "game">("splash");

  if (phase === "splash") {
    return <SplashScreen onDone={() => setPhase("home")} />;
  }

  if (phase === "home") {
    return <HomeScreen onPlay={() => setPhase("game")} />;
  }

  return (
    <div className="tt-root">
      <style>{`
        * { box-sizing: border-box; }
        html, body, #root { margin: 0; padding: 0; background: #0c0d10; }
        .tt-root {
          position: relative;
          width: 100vw;
          height: 100dvh;
          min-height: 100vh;
          overflow: hidden;
          background: #0c0d10;
        }
        .tt-map {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: cover; display: block; z-index: 1;
          filter: saturate(1.05) brightness(0.95);
        }
        .tt-vignette {
          position: absolute; inset: 0; z-index: 2; pointer-events: none;
          background: radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%);
        }
        @media (orientation: landscape) and (max-height: 500px) {
          .adm-panel { width: min(360px, 60vw) !important; padding: 10px 12px 14px !important; }
          .adm-btn { top: 8px !important; right: 8px !important; width: 38px !important; height: 38px !important; }
        }
      `}</style>
      <img src={citymap} alt="Plan de la ville pour le jeu de taxi" className="tt-map" />
      <div className="tt-vignette" />
      <CityTraffic />
      <CityCompetitors />
      <CrimeEvents />
      <InterventionDispatcher />
      <TaxiTycoon />
      <CityHud />
      <RadarFlash />
      <AmbientSirens />
      <AdminPanel />
      <RulesPanel />
      <VersionBanner />
      <GameMenu onHome={() => setPhase("home")} />
    </div>
  );
}

