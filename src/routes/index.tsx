import { createFileRoute } from "@tanstack/react-router";
import citymap from "@/assets/citymap2.jpg";
import TaxiTycoon from "@/game/TaxiTycoon";
import AdminPanel from "@/game/AdminPanel";
import RulesPanel from "@/game/RulesPanel";
import VersionBanner from "@/game/VersionBanner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Taxi Tycoon — City Cab Empire" },
      { name: "description", content: "Hérite d'un garage délabré et bâtis le plus grand empire de taxis de la ville." },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" },
      { property: "og:title", content: "Taxi Tycoon — City Cab Empire" },
      { property: "og:description", content: "Tycoon idle : tes taxis vont chercher les clients, tu agrandis l'entrepôt." },
    ],
  }),
  component: TaxiTycoonPage,
});

function TaxiTycoonPage() {
  return (
    <div className="tt-root">
      <style>{`
        * { box-sizing: border-box; }
        html, body, #root { margin: 0; padding: 0; background: #0c0d10; }
        .tt-root {
          position: relative; width: 100%; height: 100vh; overflow: hidden;
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
      `}</style>
      <img src={citymap} alt="Plan de la ville pour le jeu de taxi" className="tt-map" />
      <div className="tt-vignette" />
      <TaxiTycoon />
      <AdminPanel />
      <RulesPanel />
      <VersionBanner />
    </div>
  );
}
