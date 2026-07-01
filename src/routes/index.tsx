import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import citymap from "@/assets/citymap2.jpg";
import citymapLiteAsset from "@/assets/citymap2-lite.jpg.asset.json";
import TaxiTycoon from "@/game/TaxiTycoon";
import CityTraffic from "@/game/CityTraffic";
import MafiaAttackers from "@/game/MafiaAttackers";
import BaronConvoy from "@/game/BaronConvoy";
import BaronManor from "@/game/BaronManor";
import BaronNegotiation from "@/game/BaronNegotiation";
import ArmoredTruck from "@/game/ArmoredTruck";
import CrimeEvents from "@/game/CrimeEvents";
import InterventionDispatcher from "@/game/InterventionDispatcher";
import EmergencyStations from "@/game/EmergencyStations";
import RadarFlash from "@/game/RadarFlash";
// AmbientSirens retiré : plus de bruits d'ambulance/pompiers/police en fond.
import AdminPanel from "@/game/AdminPanel";
import MafiaGodfather from "@/game/MafiaGodfather";
import MafiaLimo from "@/game/MafiaLimo";
import VersionBanner from "@/game/VersionBanner";
import HomeScreen from "@/game/HomeScreen";
import SplashScreen from "@/game/SplashScreen";
import IntroStory, { hasSeenIntro } from "@/game/IntroStory";
import UltraFluidPanel from "@/game/UltraFluidPanel";
import CampaignHud from "@/game/CampaignHud";
import Chapter1Manager from "@/game/Chapter1Manager";
import DepotEvolution from "@/game/DepotEvolution";
import UnlockToast from "@/game/UnlockToast";
import { useUnlock } from "@/game/campaign/unlocks";
import { preferLiteAssets } from "@/lib/perf";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "My Taxi World : L'Empire des Rues" },
      { name: "description", content: "Hérite d'un garage délabré et bâtis le plus grand empire de taxis de la ville." },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { property: "og:title", content: "My Taxi World : L'Empire des Rues" },
      { property: "og:description", content: "Tycoon idle : tes taxis vont chercher les clients, tu agrandis l'entrepôt." },
    ],
  }),
  component: TaxiTycoonPage,
});

const ZOOM_LEVELS = [1, 1.5, 2, 2.75] as const;

function TaxiTycoonPage() {
  const [phase, setPhase] = useState<"splash" | "intro" | "home" | "game">("splash");
  const [zoomIdx, setZoomIdx] = useState(0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);

  const zoom = ZOOM_LEVELS[zoomIdx];
  const mapSrc = preferLiteAssets() ? citymapLiteAsset.url : citymap;

  // Clamp pan : on n'a pas le droit de tirer la carte hors-écran.
  useEffect(() => {
    const el = worldRef.current;
    if (!el) return;
    const maxX = (zoom - 1) * el.clientWidth / 2;
    const maxY = (zoom - 1) * el.clientHeight / 2;
    setPan((p) => ({
      x: Math.max(-maxX, Math.min(maxX, p.x)),
      y: Math.max(-maxY, Math.min(maxY, p.y)),
    }));
  }, [zoom]);

  const cycleZoom = () => {
    const next = (zoomIdx + 1) % ZOOM_LEVELS.length;
    setZoomIdx(next);
    if (next === 0) setPan({ x: 0, y: 0 });
  };

  // Drag pour panoramique (uniquement quand zoom > 1).
  const onPointerDown = (e: React.PointerEvent) => {
    if (zoom <= 1) return;
    // Ne pas voler les clics sur boutons / SVG interactifs.
    const t = e.target as HTMLElement;
    if (t.closest("button, input, [data-no-pan], .tt-hud, .adm-panel, .adm-btn")) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: pan.x, baseY: pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const el = worldRef.current;
    if (!el) return;
    const maxX = (zoom - 1) * el.clientWidth / 2;
    const maxY = (zoom - 1) * el.clientHeight / 2;
    const nx = dragRef.current.baseX + (e.clientX - dragRef.current.startX);
    const ny = dragRef.current.baseY + (e.clientY - dragRef.current.startY);
    setPan({
      x: Math.max(-maxX, Math.min(maxX, nx)),
      y: Math.max(-maxY, Math.min(maxY, ny)),
    });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  if (phase === "splash") {
    return <SplashScreen onDone={() => setPhase(hasSeenIntro() ? "home" : "intro")} />;
  }

  if (phase === "intro") {
    return <IntroStory onDone={() => setPhase("home")} />;
  }

  if (phase === "home") {
    return <HomeScreen onPlay={() => setPhase("game")} onReplayIntro={() => setPhase("intro")} />;
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
        .tt-world {
          position: absolute; inset: 0;
          transform-origin: center center;
          transition: transform 0.12s ease-out;
          will-change: transform;
          touch-action: none;
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
        .tt-zoom-btn {
          position: fixed;
          right: 12px;
          bottom: 110px;
          z-index: 9999;
          width: 46px; height: 46px;
          border-radius: 50%;
          border: 2px solid #f5c542;
          background: rgba(12, 14, 22, 0.92);
          color: #fde047;
          font-size: 11px; font-weight: 900;
          font-family: system-ui, sans-serif;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(0,0,0,0.6);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          line-height: 1;
          gap: 1px;
          padding: 0;
        }
        .tt-zoom-btn:active { transform: scale(0.94); }
        .tt-zoom-btn .ico { font-size: 16px; }
        .tt-zoom-btn .lbl { font-size: 9px; opacity: 0.9; }
        @media (orientation: landscape) and (max-height: 500px) {
          .adm-panel { width: min(360px, 60vw) !important; padding: 10px 12px 14px !important; }
          .adm-btn { top: 8px !important; right: 8px !important; width: 38px !important; height: 38px !important; }
          .tt-zoom-btn { bottom: 12px; right: 60px; }
        }
        @media (max-width: 900px), (pointer: coarse) {
          .tt-map { filter: brightness(0.95); }
          .tt-vignette { display: none; }
        }
      `}</style>

      <div
        ref={worldRef}
        className="tt-world"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, cursor: zoom > 1 ? (dragRef.current ? "grabbing" : "grab") : "default" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img src={mapSrc} alt="Plan de la ville pour le jeu de taxi" className="tt-map" />
        <div className="tt-vignette" />
        <CityTraffic />
        <BaronConvoy />
        <BaronManor />
        <MafiaAttackers />
        <EmergencyStations />
        <CrimeEvents />
        <InterventionDispatcher />
        <TaxiTycoon />
        <DepotEvolution />
        <ArmoredTruck />
        <MafiaLimo />
      </div>

      {/* HUD et panneaux hors zoom (toujours nets) */}
      <RadarFlash />
      
      {/* <AmbientSirens /> — désactivé sur demande joueur */}
      <AdminPanel />
      <MafiaGodfather />
      <BaronNegotiation playerMoney={0} onDeal={(a) => console.log("baron deal", a)} />
      <VersionBanner />
      <UltraFluidPanel />
      <CampaignHud />
      <Chapter1Manager />




    </div>
  );
}
