import { createFileRoute } from "@tanstack/react-router";
import TaxiTycoon from "@/game/TaxiTycoon";
import CityTraffic from "@/game/CityTraffic";
import AdminPanel from "@/game/AdminPanel";
import RulesPanel from "@/game/RulesPanel";

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
        .tt-vignette {
          position: absolute; inset: 0; z-index: 6; pointer-events: none;
          background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.55) 100%);
        }
      `}</style>
      <CityTraffic />
      <TaxiTycoon />
      <div className="tt-vignette" />
      <AdminPanel />
      <RulesPanel />
    </div>
  );
}
