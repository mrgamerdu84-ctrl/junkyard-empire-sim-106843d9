import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { useAdminConfig, setAdmin, resetAdmin, type AdminConfig } from "./adminConfig";
import { useVersionCheck, formatBuildDate } from "@/lib/version-check";
import { GAME_ASSETS, setAssetOverride, listAssetKeys, type AssetKey, listCustomVehicles, addCustomVehicle, removeCustomVehicle, type CustomVehicle, type CustomVehicleCategory, VEHICLE_CATEGORY_LABELS, listCustomPedestrians, addCustomPedestrian, removeCustomPedestrian, type CustomPedestrian } from "./gameAssets";
import { useAuth } from "@/lib/useAuth";
import { useIsAdmin, useCloudAdminSync, getLocalCompetitors, setCompetitorsFromCloud, type CloudCompetitor } from "@/lib/adminState";

/* Floating gear button + slide-in admin panel.
 * Accès = rôle "admin" sur le compte connecté (table user_roles).
 * Plus aucun mot de passe local. */
export default function AdminPanel() {
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin(user);
  const { syncing, lastError, pullNow, pushNow } = useCloudAdminSync(user);

  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("mtw:open-admin", onOpen);
    return () => window.removeEventListener("mtw:open-admin", onOpen);
  }, []);
  const [tab, setTab] = useState<"trafic" | "hq" | "missions" | "spec" | "mafia" | "circuit" | "skins" | "export">("trafic");
  const [placeMode, setPlaceMode] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [resetGameOpen, setResetGameOpen] = useState(false);
  const [resetGamePhrase, setResetGamePhrase] = useState("");
  const [resetGameMsg, setResetGameMsg] = useState("");

  // État de la liste des concurrents (mis à jour via l'event publié par CityCompetitors).
  const [comps, setCompsLocal] = useState<CloudCompetitor[]>(() => getLocalCompetitors());
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<CloudCompetitor[]>).detail;
      if (Array.isArray(detail)) setCompsLocal(detail);
    };
    window.addEventListener("jce:competitors-changed", onChange as EventListener);
    return () => window.removeEventListener("jce:competitors-changed", onChange as EventListener);
  }, []);

  // Formulaire d'ajout concurrent
  const [newCompName, setNewCompName] = useState("");
  const [newCompColor, setNewCompColor] = useState("#ef4444");
  const [newCompTreasury, setNewCompTreasury] = useState(15000);
  const [newCompVehicleUrl, setNewCompVehicleUrl] = useState<string>("");
  const [newCompVehicleName, setNewCompVehicleName] = useState<string>("");
  const [newCompLogoUrl, setNewCompLogoUrl] = useState<string>("");
  const [newCompLogoName, setNewCompLogoName] = useState<string>("");

  const onPickCompVehicle = (file: File | null) => {
    if (!file) { setNewCompVehicleUrl(""); setNewCompVehicleName(""); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setNewCompVehicleUrl(String(reader.result || ""));
      setNewCompVehicleName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const onPickCompLogo = (file: File | null) => {
    if (!file) { setNewCompLogoUrl(""); setNewCompLogoName(""); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setNewCompLogoUrl(String(reader.result || ""));
      setNewCompLogoName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const addCompetitor = () => {
    if (!newCompName.trim()) return;
    if (comps.length >= 10) return;
    const next: CloudCompetitor = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: newCompName.trim(),
      color: newCompColor,
      x: 200 + Math.round(Math.random() * 1500),
      y: 200 + Math.round(Math.random() * 700),
      treasury: Math.max(500, newCompTreasury),
      taxiCount: 6,
      bankrupt: false,
      vehicleUrl: newCompVehicleUrl || undefined,
      logoUrl: newCompLogoUrl || undefined,
    };
    setCompetitorsFromCloud([...comps, next]);
    setNewCompName("");
    setNewCompVehicleUrl("");
    setNewCompVehicleName("");
    setNewCompLogoUrl("");
    setNewCompLogoName("");
  };

  const removeCompetitor = (id: string) => {
    setCompetitorsFromCloud(comps.filter((c) => c.id !== id));
  };

  const cfg = useAdminConfig();



  const doResetGame = () => {
    setResetGameMsg("");
    if (resetGamePhrase.trim() !== "RESET") {
      setResetGameMsg('Tape exactement "RESET" pour effacer toute la progression.');
      return;
    }
    try {
      localStorage.removeItem("taxi-tycoon-v4");
      setResetGameMsg("✅ Partie réinitialisée. Rechargement…");
      window.setTimeout(() => window.location.reload(), 800);
    } catch {
      setResetGameMsg("❌ Impossible d'effacer la sauvegarde.");
    }
  };


  // Mode "placer le QG" — clic sur la map = nouvelle position.
  // On ferme le panneau pendant le placement pour que le clic atteigne la map,
  // et on convertit n'importe quel clic en coordonnées SVG (le SVG du jeu a
  // === Mode placement : tap & drag pour déplacer le QG sur la carte ===
  // (pointer events plutôt qu'un click, pour qu'on puisse faire glisser
  //  le QG avec le doigt jusqu'à l'endroit parfait.)
  const placeDragRef = useRef(false);
  useEffect(() => {
    if (!placeMode) return;
    const svg = document.querySelector(".tt-root svg") as SVGSVGElement | null;
    if (!svg) return;
    const toSvg = (cx: number, cy: number) => {
      const pt = svg.createSVGPoint();
      pt.x = cx; pt.y = cy;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      return pt.matrixTransform(ctm.inverse());
    };
    const applyAt = (cx: number, cy: number) => {
      const p = toSvg(cx, cy);
      if (!p) return;
      const x = Math.max(0, Math.min(1920, p.x));
      const y = Math.max(0, Math.min(1080, p.y));
      setAdmin({ hqUseFreePos: true, hqX: x, hqY: y });
    };
    const isUiTarget = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!(el && (el.closest(".adm-place-controls") || el.closest(".adm-place-banner") || el.closest(".adm-hq-rotator")));
    };
    const onDown = (e: PointerEvent) => {
      if (isUiTarget(e.target)) return;
      placeDragRef.current = true;
      applyAt(e.clientX, e.clientY);
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (!placeDragRef.current) return;
      applyAt(e.clientX, e.clientY);
      e.preventDefault();
    };
    const onUp = () => { placeDragRef.current = false; };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
    };
  }, [placeMode]);

  // === Anneau de rotation flottant autour du QG (overlay HTML) ===
  // On recalcule sa position écran chaque frame depuis la matrice SVG.
  const rotatorRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!placeMode) return;
    let raf = 0;
    const tick = () => {
      const svg = document.querySelector(".tt-root svg") as SVGSVGElement | null;
      const el = rotatorRef.current;
      if (svg && el) {
        const pt = svg.createSVGPoint();
        pt.x = cfg.hqX; pt.y = cfg.hqY;
        const ctm = svg.getScreenCTM();
        if (ctm) {
          const p = pt.matrixTransform(ctm);
          // taille de l'anneau ~ proportionnelle au scale visible
          const sizePx = Math.max(140, 180 * Math.min(2, cfg.hqScale));
          el.style.left = `${p.x - sizePx / 2}px`;
          el.style.top = `${p.y - sizePx / 2}px`;
          el.style.width = `${sizePx}px`;
          el.style.height = `${sizePx}px`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [placeMode, cfg.hqX, cfg.hqY, cfg.hqScale]);

  // Drag du knob pour tourner le QG : l'angle suit le doigt par rapport au centre.
  const onRotatorPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const el = rotatorRef.current;
    if (!el) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const handler = (ev: PointerEvent) => {
      const dx = ev.clientX - cx;
      const dy = ev.clientY - cy;
      // 0° = vers la droite ; on garde la même convention que SVG rotate()
      let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      // arrondi doux par pas de 1°
      deg = Math.round(deg);
      setAdmin({ hqRotation: deg });
      ev.preventDefault();
    };
    const up = () => {
      window.removeEventListener("pointermove", handler, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
    };
    window.addEventListener("pointermove", handler, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
  };

  const startPlacement = () => {
    setPlaceMode(true);
    setOpen(false);
  };

  const bumpScale = (d: number) => setAdmin({ hqScale: Math.max(0.3, Math.min(8, cfg.hqScale + d)) });
  const bumpRot = (d: number) => setAdmin({ hqRotation: cfg.hqRotation + d });

  // === Dessin du circuit : clic point par point ===
  useEffect(() => {
    if (!drawMode) return;
    const svg = document.querySelector(".tt-root svg") as SVGSVGElement | null;
    if (!svg) return;
    const toSvg = (cx: number, cy: number) => {
      const pt = svg.createSVGPoint();
      pt.x = cx; pt.y = cy;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const p = pt.matrixTransform(ctm.inverse());
      return { x: Math.max(0, Math.min(1920, p.x)), y: Math.max(0, Math.min(1080, p.y)) };
    };
    const onClick = (e: MouseEvent) => {
      const tgt = e.target as HTMLElement;
      if (tgt.closest(".adm-place-controls") || tgt.closest(".adm-btn") || tgt.closest(".adm-place-banner")) return;
      const p = toSvg(e.clientX, e.clientY);
      if (!p) return;
      const current = (cfgRef.current.circuitPoints ?? []) as { x: number; y: number }[];
      setAdmin({ circuitPoints: [...current, p] });
      e.stopPropagation();
      e.preventDefault();
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [drawMode]);

  // Garde la config courante accessible dans le handler de clic
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  const startDraw = () => {
    setAdmin({ circuitPoints: [] }); // repart d'un circuit vide
    setDrawMode(true);
    setOpen(false);
  };
  const undoPoint = () => {
    const pts = cfg.circuitPoints ?? [];
    if (pts.length === 0) return;
    setAdmin({ circuitPoints: pts.slice(0, -1) });
  };
  const finishDraw = () => setDrawMode(false);
  const clearCircuit = () => setAdmin({ circuitPoints: [], circuitTaxiCount: 0 });






  return (
    <>
      <style>{`
        .adm-btn {
          position: fixed;
          top: max(8px, env(safe-area-inset-top, 0px));
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          width: 28px; height: 28px; border-radius: 50%; border: 1px solid rgba(245,197,66,0.6);
          background: rgba(20,22,28,0.6); color: rgba(245,197,66,0.7); font-size: 13px;
          cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(6px); opacity: 0.55;
        }
        .adm-btn:hover { opacity: 1; background: rgba(40,42,50,0.95); }

        .adm-overlay {
          position: fixed; inset: 0; z-index: 9998;
          background: rgba(0,0,0,0.5);
        }
        .adm-panel {
          position: fixed; top: 0; right: 0; bottom: 0; width: min(380px, 92vw);
          z-index: 9999; background: #14171c; color: #e8edf2;
          box-shadow: -8px 0 32px rgba(0,0,0,0.6);
          padding: 18px 18px 24px; overflow-y: auto;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .adm-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .adm-h h2 { margin: 0; font-size: 16px; color: #f5c542; letter-spacing: 0.5px; }
        .adm-close { background: transparent; border: none; color: #8a8e94; font-size: 24px; cursor: pointer; line-height: 1; }
        .adm-tabs { display: flex; gap: 4px; margin-bottom: 14px; border-bottom: 1px solid #2a2f38; padding-bottom: 8px; }
        .adm-tab {
          flex: 1; padding: 6px 8px; background: #1f242b; color: #c8ccd2;
          border: 1px solid #2a2f38; border-radius: 6px; cursor: pointer;
          font-size: 11px; font-weight: 700; letter-spacing: 0.3px;
        }
        .adm-tab.active { background: #f5c542; color: #14171c; border-color: #f5c542; }
        .adm-section { margin-bottom: 14px; }
        .adm-label { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; color: #c8ccd2; }
        .adm-val { color: #f5c542; font-weight: 600; font-variant-numeric: tabular-nums; }
        .adm-section input[type="range"] { width: 100%; }
        .adm-reset, .adm-place {
          width: 100%; padding: 10px; border: 1px solid #3a3f48; border-radius: 6px;
          background: #1f242b; color: #e8edf2; cursor: pointer; margin-top: 10px; font-size: 13px;
        }
        .adm-reset:hover, .adm-place:hover { background: #2a2f38; }
        .adm-place.active { background: #f5c542; color: #14171c; border-color: #f5c542; font-weight: 700; }
        .adm-hint { font-size: 11px; color: #6a6e74; margin-top: 2px; }
        .adm-toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; color: #c8ccd2; }
        .adm-toggle input { accent-color: #f5c542; }
        .adm-place-banner {
          position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 9999;
          background: #f5c542; color: #14171c; padding: 8px 14px; border-radius: 20px;
          font-size: 13px; font-weight: 700; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          pointer-events: none;
        }
        .adm-place-controls {
          position: fixed; top: 56px; left: 50%; transform: translateX(-50%); z-index: 9999;
          background: rgba(20,22,28,0.96); color: #e8edf2; padding: 10px 12px; border-radius: 14px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.6); backdrop-filter: blur(8px);
          display: flex; flex-direction: column; gap: 8px; align-items: stretch;
          font-family: system-ui, sans-serif; min-width: 240px;
        }
        .adm-place-row { display: flex; align-items: center; gap: 6px; justify-content: space-between; }
        .adm-place-row .lbl { font-size: 11px; color: #c8ccd2; flex: 1; }
        .adm-place-row .val { font-size: 12px; color: #f5c542; font-weight: 700; min-width: 44px; text-align: center; font-variant-numeric: tabular-nums; }
        .adm-place-row button {
          width: 34px; height: 34px; border-radius: 8px; border: 1px solid #3a3f48;
          background: #1f242b; color: #f5c542; font-size: 18px; font-weight: 700; cursor: pointer;
        }
        .adm-place-row button:active { background: #2a2f38; }
        .adm-place-done {
          padding: 10px; border-radius: 8px; border: none; background: #f5c542; color: #14171c;
          font-weight: 800; cursor: pointer; font-size: 14px; letter-spacing: 0.3px;
        }
        /* Anneau de rotation flottant autour du QG */
        .adm-hq-rotator {
          position: fixed; z-index: 9998; pointer-events: none;
          display: flex; align-items: center; justify-content: center;
        }
        .adm-hq-rotator .ring {
          position: absolute; inset: 0; border-radius: 50%;
          border: 3px dashed rgba(245,197,66,0.85);
          box-shadow: 0 0 0 2px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(0,0,0,0.35);
          background: radial-gradient(circle, rgba(245,197,66,0.0) 60%, rgba(245,197,66,0.10) 100%);
        }
        .adm-hq-knob {
          position: absolute; width: 44px; height: 44px; border-radius: 50%;
          background: #f5c542; color: #14171c; font-weight: 900; font-size: 18px;
          display: flex; align-items: center; justify-content: center;
          border: 3px solid #14171c; box-shadow: 0 4px 10px rgba(0,0,0,0.5);
          touch-action: none; cursor: grab; pointer-events: auto;
          transform-origin: 50% 50%;
        }
        .adm-hq-knob:active { cursor: grabbing; transform: scale(1.05); }
        .adm-hq-center {
          width: 14px; height: 14px; border-radius: 50%;
          background: rgba(245,197,66,0.9); border: 2px solid #14171c;
          box-shadow: 0 0 8px rgba(245,197,66,0.6);
        }
      `}</style>

      {placeMode && (
        <>
          <div className="adm-place-banner">📍 Glisse le QG avec le doigt — utilise l'anneau pour tourner</div>
          {/* Anneau de rotation positionné autour du QG */}
          <div ref={rotatorRef} className="adm-hq-rotator">
            <div className="ring" />
            <div className="adm-hq-center" />
            <div
              className="adm-hq-knob"
              onPointerDown={onRotatorPointerDown}
              style={{
                left: "50%",
                top: "50%",
                transform: `translate(-50%, -50%) rotate(${cfg.hqRotation}deg) translateX(calc(50% + 30px)) rotate(${-cfg.hqRotation}deg)`,
              }}
            >↻</div>
          </div>
          <div className="adm-place-controls">
            <div className="adm-place-row">
              <button onClick={() => bumpScale(-0.1)} aria-label="Réduire">−</button>
              <span className="lbl">Taille</span>
              <span className="val">×{cfg.hqScale.toFixed(2)}</span>
              <button onClick={() => bumpScale(0.1)} aria-label="Agrandir">+</button>
            </div>
            <div className="adm-place-row">
              <button onClick={() => bumpRot(-15)} aria-label="Rotation gauche">↺</button>
              <span className="lbl">Rotation</span>
              <span className="val">{cfg.hqRotation.toFixed(0)}°</span>
              <button onClick={() => bumpRot(15)} aria-label="Rotation droite">↻</button>
            </div>
            <button className="adm-place-done" onClick={() => setPlaceMode(false)}>✓ Valider l'emplacement</button>
          </div>
        </>
      )}

      {drawMode && (
        <>
          <div className="adm-place-banner" style={{ background: "#22c55e", color: "#0a1f10" }}>
            ✏️ Clique sur la carte pour ajouter des points ({cfg.circuitPoints.length})
          </div>
          <div className="adm-place-controls">
            <div className="adm-place-row">
              <button onClick={undoPoint} aria-label="Annuler dernier point" disabled={cfg.circuitPoints.length === 0}>↶</button>
              <span className="lbl">Points</span>
              <span className="val">{cfg.circuitPoints.length}</span>
              <button onClick={clearCircuit} aria-label="Effacer tout">🗑</button>
            </div>
            <button className="adm-place-done" onClick={finishDraw}>✓ Terminer le circuit</button>
          </div>
        </>
      )}

      {/* Bouton admin déplacé dans la topbar de TaxiTycoon */}

      {open && !isAdmin && (
        <>
          <div className="adm-overlay" onClick={() => setOpen(false)} />
          <div className="adm-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="adm-h">
              <h2>🔒 Accès admin</h2>
              <button className="adm-close" onClick={() => setOpen(false)} aria-label="Fermer">×</button>
            </div>
            <div style={{ padding: 16, fontSize: 13, opacity: 0.9 }}>
              {adminLoading
                ? "Vérification du compte…"
                : !user
                  ? "Connecte-toi avec ton compte admin pour accéder au panneau."
                  : "Ce compte n'a pas le rôle admin."}
            </div>
          </div>
        </>
      )}

      {open && isAdmin && (


        <>
          <div className="adm-overlay" onClick={() => setOpen(false)} />
          <div className="adm-panel" onClick={(e) => e.stopPropagation()}>
            <div className="adm-h">
              <h2>⚙ PANEL ADMIN</h2>
              <button className="adm-close" onClick={() => setOpen(false)} aria-label="Fermer">×</button>
            </div>

            <div className="adm-tabs">
              <button className={`adm-tab ${tab === "trafic" ? "active" : ""}`} onClick={() => setTab("trafic")}>Trafic</button>
              <button className={`adm-tab ${tab === "hq" ? "active" : ""}`} onClick={() => setTab("hq")}>QG</button>
             <button className={`adm-tab ${tab === "missions" ? "active" : ""}`} onClick={() => setTab("missions")}>Miss.</button>
             <button className={`adm-tab ${tab === "spec" ? "active" : ""}`} onClick={() => setTab("spec")}>💥 Spéc.</button>
              <button className={`adm-tab ${tab === "mafia" ? "active" : ""}`} onClick={() => setTab("mafia")}>🦹 Mafia</button>
              <button className={`adm-tab ${tab === "circuit" ? "active" : ""}`} onClick={() => setTab("circuit")}>Circuit</button>
             <button className={`adm-tab ${tab === "skins" ? "active" : ""}`} onClick={() => setTab("skins")}>Skins</button>
             <button className={`adm-tab ${tab === "export" ? "active" : ""}`} onClick={() => setTab("export")}>Export</button>
            </div>

            {tab === "trafic" && (
              <>
                <Slider label="Taxis actifs max" hint="Limite combien de taxis sortent en même temps"
                  value={cfg.maxActiveTaxis} min={1} max={20} step={1}
                  format={(v) => v.toFixed(0)} onChange={(v) => setAdmin({ maxActiveTaxis: v })} />
                <Slider label="Cooldown sortie QG" hint="Délai minimum entre deux sorties de taxi"
                  value={cfg.taxiSpawnCooldown} min={0} max={15} step={0.5}
                  format={(v) => v.toFixed(1) + " s"} onChange={(v) => setAdmin({ taxiSpawnCooldown: v })} />
                <Slider label="Vitesse des taxis"
                  value={cfg.taxiSpeedMult} min={0.5} max={3} step={0.05}
                  format={(v) => "×" + v.toFixed(2)} onChange={(v) => setAdmin({ taxiSpeedMult: v })} />
                <Slider label="Nombre de véhicules civils" hint="Voitures, vans et camions sur les routes"
                  value={cfg.civilVehicleCount} min={0} max={50} step={1}
                  format={(v) => v.toFixed(0)} onChange={(v) => setAdmin({ civilVehicleCount: v })} />
                <Slider label="🚓 Voitures de police" hint="0 = aucune patrouille, 6 = ville sous surveillance"
                  value={cfg.policeCarCount} min={0} max={6} step={1}
                  format={(v) => v.toFixed(0)} onChange={(v) => setAdmin({ policeCarCount: v })} />
              </>
            )}

            {tab === "hq" && (
              <>
                <button className={`adm-place ${placeMode ? "active" : ""}`} onClick={startPlacement}>
                  📍 Placer le QG sur la carte
                </button>
                <div className="adm-hint" style={{ marginTop: 4 }}>
                  Le panneau se ferme, cliquez où vous voulez placer le QG.
                </div>

                <Slider label="QG — X" value={cfg.hqX} min={0} max={1920} step={1}
                  format={(v) => v.toFixed(0)} onChange={(v) => setAdmin({ hqUseFreePos: true, hqX: v })} />
                <Slider label="QG — Y" value={cfg.hqY} min={0} max={1080} step={1}
                  format={(v) => v.toFixed(0)} onChange={(v) => setAdmin({ hqUseFreePos: true, hqY: v })} />

                <Slider label="Taille du QG"
                  value={cfg.hqScale} min={0.3} max={8} step={0.05}
                  format={(v) => "×" + v.toFixed(2)} onChange={(v) => setAdmin({ hqScale: v })} />

                <Slider label="Rotation"
                  value={cfg.hqRotation} min={-180} max={180} step={5}
                  format={(v) => v.toFixed(0) + "°"} onChange={(v) => setAdmin({ hqRotation: v })} />
              </>
            )}

            {tab === "missions" && (
              <>
                <Slider label="Délai nouvelle course" hint="Plus court = courses qui arrivent plus vite"
                  value={cfg.spawnRateMult} min={0.25} max={3} step={0.05}
                  format={(v) => "×" + v.toFixed(2)} onChange={(v) => setAdmin({ spawnRateMult: v })} />
                <Slider label="Courses en file (bonus)"
                  value={cfg.maxClientsBonus} min={0} max={6} step={1}
                  format={(v) => "+" + v.toFixed(0)} onChange={(v) => setAdmin({ maxClientsBonus: v })} />
                <Slider label="Multiplicateur de tarif"
                  value={cfg.clientFareMult} min={0.5} max={5} step={0.1}
                  format={(v) => "×" + v.toFixed(1)} onChange={(v) => setAdmin({ clientFareMult: v })} />
                <Slider label="Conso carburant" hint="Points de jauge perdus par seconde de roulage"
                  value={cfg.fuelConsumption} min={0.1} max={3} step={0.1}
                  format={(v) => v.toFixed(1) + "/s"} onChange={(v) => setAdmin({ fuelConsumption: v })} />
                <Slider label="Station — X" value={cfg.gasStationX} min={0} max={1920} step={1}
                  format={(v) => v.toFixed(0)} onChange={(v) => setAdmin({ gasStationX: v })} />
                <Slider label="Station — Y" value={cfg.gasStationY} min={0} max={1080} step={1}
                  format={(v) => v.toFixed(0)} onChange={(v) => setAdmin({ gasStationY: v })} />
              </>
            )}

            {tab === "mafia" && (
              <>
                <div className="adm-hint" style={{ marginBottom: 8 }}>
                  🦹 Configure les familles MAFIA : logo, couleur, voiture. Elles attaqueront tes taxis et escorteront leurs camions blindés.
                </div>

                <Slider label="Voitures mafia max" hint="Nombre de véhicules envoyés par les familles"
                  value={cfg.rivalTaxiCount} min={1} max={6} step={1}
                  format={(v) => v.toFixed(0)} onChange={(v) => setAdmin({ rivalTaxiCount: v })} />
                <Slider label="Agressivité (temps de réaction)" hint="Plus court = la mafia frappe plus vite"
                  value={cfg.rivalReactionTime} min={1} max={15} step={0.5}
                  format={(v) => v.toFixed(1) + " s"} onChange={(v) => setAdmin({ rivalReactionTime: v })} />
                <Slider label="Vitesse mafia" value={cfg.rivalSpeedMult} min={0.5} max={2.5} step={0.05}
                  format={(v) => "×" + v.toFixed(2)} onChange={(v) => setAdmin({ rivalSpeedMult: v })} />

                <div style={{ height: 12 }} />
                <div style={{ fontSize: 12, fontWeight: 800, color: "#f5c542", marginBottom: 6 }}>
                  Familles mafia ({comps.length}/10)
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                  {comps.length === 0 && (
                    <div className="adm-hint">Aucune famille. Ajoute-en ci-dessous.</div>
                  )}
                  {comps.map((c) => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "#1f242b", borderRadius: 6, border: "1px solid #2a2f38" }}>
                      <span style={{ width: 14, height: 14, borderRadius: "50%", background: c.color, border: "1px solid #0b0d10", flexShrink: 0 }} />
                      {c.logoUrl && (
                        <img src={c.logoUrl} alt="" style={{ width: 24, height: 24, objectFit: "contain", background: "#0b0d10", borderRadius: 4, flexShrink: 0 }} />
                      )}
                      {c.vehicleUrl && (
                        <img src={c.vehicleUrl} alt="" style={{ width: 24, height: 24, objectFit: "contain", background: "#0b0d10", borderRadius: 4, flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#e8edf2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                        <div style={{ fontSize: 10, color: "#8a8e94" }}>💰 {Math.round(c.treasury).toLocaleString()}$ · ({Math.round(c.x)},{Math.round(c.y)}){c.bankrupt ? " · 💀 démantelée" : ""}</div>
                      </div>
                      <button onClick={() => removeCompetitor(c.id)} aria-label="Supprimer"
                        style={{ background: "transparent", border: "1px solid #7f1d1d", color: "#fca5a5", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer" }}>🗑</button>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, background: "#0f1318", borderRadius: 8, border: "1px solid #2a2f38" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#f5c542" }}>➕ Nouvelle famille mafia</div>
                  <input
                    type="text"
                    value={newCompName}
                    onChange={(e) => setNewCompName(e.target.value)}
                    placeholder="Nom de la famille (ex. Corleone)"
                    style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 13 }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 11, color: "#c8ccd2" }}>Couleur</label>
                    <input
                      type="color"
                      value={newCompColor}
                      onChange={(e) => setNewCompColor(e.target.value)}
                      style={{ width: 40, height: 28, border: "none", background: "transparent", cursor: "pointer" }}
                    />
                    <span style={{ fontSize: 11, color: "#8a8e94", fontFamily: "monospace" }}>{newCompColor}</span>
                  </div>
                  <Slider label="Trésorerie de départ"
                    value={newCompTreasury} min={500} max={100000} step={500}
                    format={(v) => Math.round(v).toLocaleString() + "$"}
                    onChange={(v) => setNewCompTreasury(v)} />

                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 11, color: "#c8ccd2" }}>🦹 Logo / emblème (optionnel)</label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(e) => onPickCompLogo(e.target.files?.[0] ?? null)}
                      style={{ fontSize: 11, color: "#c8ccd2" }}
                    />
                    {newCompLogoUrl && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        <img src={newCompLogoUrl} alt="" style={{ width: 36, height: 36, objectFit: "contain", background: "#1f242b", borderRadius: 4, border: "1px solid #2a2f38" }} />
                        <span style={{ fontSize: 10, color: "#8a8e94", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{newCompLogoName}</span>
                        <button onClick={() => onPickCompLogo(null)} style={{ background: "transparent", border: "1px solid #7f1d1d", color: "#fca5a5", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>Retirer</button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 11, color: "#c8ccd2" }}>🚗 Voiture mafia (vue du ciel, optionnel)</label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(e) => onPickCompVehicle(e.target.files?.[0] ?? null)}
                      style={{ fontSize: 11, color: "#c8ccd2" }}
                    />
                    {newCompVehicleUrl && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        <img src={newCompVehicleUrl} alt="" style={{ width: 36, height: 36, objectFit: "contain", background: "#1f242b", borderRadius: 4, border: "1px solid #2a2f38" }} />
                        <span style={{ fontSize: 10, color: "#8a8e94", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{newCompVehicleName}</span>
                        <button onClick={() => onPickCompVehicle(null)} style={{ background: "transparent", border: "1px solid #7f1d1d", color: "#fca5a5", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>Retirer</button>
                      </div>
                    )}
                    <div className="adm-hint" style={{ fontSize: 10 }}>
                      PNG transparent recommandé, nez vers le haut. Sans sprite, voiture du jeu teintée en noir.
                    </div>
                  </div>

                  <button
                    onClick={addCompetitor}
                    disabled={!newCompName.trim() || comps.length >= 10}
                    style={{ padding: "9px 12px", borderRadius: 8, border: "none", background: comps.length >= 10 ? "#3a3f48" : "#22c55e", color: "#fff", fontWeight: 700, cursor: comps.length >= 10 ? "not-allowed" : "pointer", fontSize: 13 }}
                  >
                    {comps.length >= 10 ? "Cap atteint (10)" : "Ajouter cette famille"}
                  </button>
                </div>
              </>
            )}
            {tab === "circuit" && (
              <>
                <button className="adm-place" onClick={startDraw}>
                  📍 Dessiner un circuit (point par point)
                </button>
                <div className="adm-hint" style={{ marginTop: 4 }}>
                  Le panneau se ferme. Clique sur la carte pour placer chaque virage, puis "Terminer".
                </div>
                <button className="adm-place" onClick={clearCircuit} style={{ marginTop: 8 }}>
                  🗑 Effacer le circuit
                </button>
                <div className="adm-hint" style={{ marginTop: 4 }}>
                  Points actuels : {cfg.circuitPoints.length}
                </div>

                <Slider label="Taxis sur le circuit" hint="Taxis dédiés qui tournent en boucle"
                  value={cfg.circuitTaxiCount} min={0} max={8} step={1}
                  format={(v) => v.toFixed(0)} onChange={(v) => setAdmin({ circuitTaxiCount: v })} />
                <Slider label="Vitesse circuit"
                  value={cfg.circuitSpeedMult} min={0.3} max={3} step={0.05}
                  format={(v) => "×" + v.toFixed(2)} onChange={(v) => setAdmin({ circuitSpeedMult: v })} />
              </>
            )}

            {tab === "spec" && <SpecialMissionsTab cfg={cfg} goSkins={() => setTab("skins")} />}
            {tab === "skins" && <SkinsTab />}
            {tab === "export" && <ExportTab />}

            <div className="adm-section" style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #2a2f38" }}>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="adm-reset" type="button" onClick={() => void pushNow()} disabled={syncing} style={{ flex: 1 }}>
                  {syncing ? "⏳ Sync…" : "☁️↑ Pousser sur mon compte"}
                </button>
                <button className="adm-reset" type="button" onClick={() => void pullNow()} disabled={syncing} style={{ flex: 1 }}>
                  {syncing ? "⏳ Sync…" : "☁️↓ Tirer depuis mon compte"}
                </button>
              </div>
              {lastError && <div style={{ color: "#ff6b6b", fontSize: 12, marginTop: 6 }}>⚠️ {lastError}</div>}
              <div className="adm-hint" style={{ marginTop: 4 }}>
                Tout (concurrents, véhicules, config) est auto-synchronisé sur ton compte. Utilise ces boutons en cas de bug pour forcer une direction.
              </div>
            </div>


            <button className="adm-reset" onClick={resetAdmin}>↺ Réinitialiser les valeurs</button>

            <div className="adm-section" style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #2a2f38" }}>
              <button
                className="adm-reset"
                style={{ borderColor: "#7f1d1d", color: "#fca5a5" }}
                onClick={() => { setResetGameOpen((v) => !v); setResetGameMsg(""); }}
              >
                🗑 Réinitialiser la partie
              </button>
              {resetGameOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  <p style={{ margin: 0, fontSize: 12, color: "#fca5a5" }}>
                    Cela efface <b>toute la progression</b> (argent, taxis, améliorations). Tape <b>RESET</b> pour confirmer.
                  </p>
                  <input
                    type="text"
                    value={resetGamePhrase}
                    onChange={(e) => setResetGamePhrase(e.target.value)}
                    placeholder="Tape RESET"
                    style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 13 }}
                  />
                  {resetGameMsg && <div style={{ color: resetGameMsg.startsWith("✅") ? "#4ade80" : "#ff6b6b", fontSize: 12 }}>{resetGameMsg}</div>}
                  <button
                    style={{ padding: "10px 12px", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, cursor: "pointer" }}
                    onClick={doResetGame}
                  >
                    Effacer ma progression
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Slider({
  label, hint, value, min, max, step, format, onChange,
}: {
  label: string; hint?: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div className="adm-section">
      <div className="adm-label">
        <span>{label}</span>
        <span className="adm-val">{format(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <div className="adm-hint">{hint}</div>}
    </div>
  );
}

export type { AdminConfig };

function ExportTab() {
  const { local, remote, hasUpdate, loading, refresh } = useVersionCheck();
  const rowStyle = { display: "flex", justifyContent: "space-between", fontSize: 11, color: "#c8ccd2", padding: "4px 0" } as const;
  const valStyle = { color: "#f5c542", fontVariantNumeric: "tabular-nums" as const, fontWeight: 600 };
  return (
    <>
      <div style={{ fontSize: 12, color: "#c8ccd2", lineHeight: 1.5, marginBottom: 10 }}>
        📦 <strong style={{ color: "#f5c542" }}>Export du projet pour Android Studio</strong>
      </div>
      <div style={{ fontSize: 11, color: "#8a8e94", lineHeight: 1.6, marginBottom: 12 }}>
        Pour récupérer le ZIP à jour, écris simplement à Lovable :
        <div style={{ background: "#1f242b", padding: "8px 10px", borderRadius: 6, marginTop: 8, color: "#f5c542", fontFamily: "monospace", fontSize: 12 }}>
          fais-moi le zip
        </div>
      </div>

      <div style={{ background: "#1f242b", padding: "10px 12px", borderRadius: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#f5c542", marginBottom: 6, letterSpacing: 0.3 }}>
          📡 ÉTAT DE LA VERSION
        </div>
        <div style={rowStyle}>
          <span>Version installée</span>
          <span style={valStyle}>{formatBuildDate(local)}</span>
        </div>
        <div style={rowStyle}>
          <span>Dernière version en ligne</span>
          <span style={valStyle}>{loading ? "…" : formatBuildDate(remote)}</span>
        </div>
        <div style={{ ...rowStyle, borderTop: "1px solid #2a2f38", marginTop: 4, paddingTop: 6 }}>
          <span>Statut</span>
          <span style={{ ...valStyle, color: hasUpdate ? "#22c55e" : remote ? "#8a8e94" : "#ef4444" }}>
            {loading ? "Vérification…" : hasUpdate ? "🆕 Maj dispo" : remote ? "À jour" : "Hors ligne"}
          </span>
        </div>
        <button
          onClick={refresh}
          style={{
            width: "100%", marginTop: 8, padding: "6px 10px", borderRadius: 6,
            border: "1px solid #3a3f48", background: "#14171c", color: "#e8edf2",
            fontSize: 11, cursor: "pointer",
          }}
        >
          ↻ Vérifier maintenant
        </button>
      </div>

      <div style={{ fontSize: 11, color: "#6a6e74", padding: "8px 10px", background: "#1f242b", borderRadius: 6, marginBottom: 10 }}>
        💡 Une bannière apparaîtra automatiquement dans le jeu dès qu'une nouvelle version sera publiée sur Lovable.
      </div>

      <div style={{ background: "#1f242b", padding: "10px 12px", borderRadius: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#f5c542", marginBottom: 6, letterSpacing: 0.3 }}>
          📱 ROTATION ÉCRAN (Android)
        </div>
        <div style={{ fontSize: 11, color: "#c8ccd2", lineHeight: 1.5, marginBottom: 6 }}>
          Pour autoriser la rotation portrait ↔ paysage dans l'APK, ouvre dans Android Studio :
        </div>
        <div style={{ background: "#0a0c10", padding: "6px 8px", borderRadius: 4, color: "#f5c542", fontFamily: "monospace", fontSize: 10, marginBottom: 6 }}>
          android/app/src/main/AndroidManifest.xml
        </div>
        <div style={{ fontSize: 11, color: "#c8ccd2", lineHeight: 1.5, marginBottom: 6 }}>
          et dans la balise <code style={{ color: "#f5c542" }}>&lt;activity&gt;</code> de <code style={{ color: "#f5c542" }}>MainActivity</code>, remplace l'attribut par :
        </div>
        <div style={{ background: "#0a0c10", padding: "6px 8px", borderRadius: 4, color: "#22c55e", fontFamily: "monospace", fontSize: 10 }}>
          android:screenOrientation="fullSensor"
        </div>
      </div>
    </>
  );
}

// ---------- Onglet Skins : remplacer un véhicule sans toucher au code ----------
const SKIN_LABELS: Record<AssetKey, string> = {
  "taxi.yellow": "Taxi jaune",
  "taxi.black": "Taxi noir",
  "taxi.red": "Taxi rouge",
  "police.car": "Voiture police",
  "emergency.ambulance": "Ambulance",
  "emergency.firetruck": "Camion pompiers",

  "civil.car.1": "Civile #1 (bleue)",
  "civil.car.2": "Civile #2 (violette)",
  "civil.car.3": "Civile #3 (orange)",
  "civil.car.4": "Civile #4 (verte)",
  "pedestrian.man": "Piéton homme",
  "pedestrian.woman": "Piéton femme",
  "audio.music": "Musique",
};

function SkinsTab() {
  const [, force] = useState(0);
  const reload = () => { window.location.reload(); };
  const onFile = (key: AssetKey, f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setAssetOverride(key, String(reader.result));
      force(v => v + 1);
    };
    reader.readAsDataURL(f);
  };
  const onUrl = (key: AssetKey) => {
    const url = window.prompt(`URL du skin pour ${SKIN_LABELS[key]} :`, GAME_ASSETS[key]);
    if (url == null) return;
    setAssetOverride(key, url.trim() || null);
    force(v => v + 1);
  };
  const onReset = (key: AssetKey) => {
    setAssetOverride(key, null);
    force(v => v + 1);
  };
  return (
    <>
      <div style={{ fontSize: 12, color: "#c8ccd2", lineHeight: 1.5, marginBottom: 8 }}>
        🎨 <strong style={{ color: "#f5c542" }}>Skins remplaçables</strong>
      </div>
      <div style={{ fontSize: 11, color: "#8a8e94", lineHeight: 1.5, marginBottom: 10 }}>
        Remplace un visuel à chaud (sans rebuild). Recharge pour appliquer.
        Pour un remplacement permanent : édite <code style={{ color: "#f5c542" }}>src/game/gameAssets.ts</code>.
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {listAssetKeys().filter(k => k !== "audio.music").map((key) => {
          const url = GAME_ASSETS[key];
          return (
            <div key={key} style={{ background: "#1f242b", padding: 8, borderRadius: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <img src={url} alt="" style={{ width: 36, height: 36, objectFit: "contain", background: "#0a0c10", borderRadius: 4, flex: "0 0 auto" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "#e8edf2", fontWeight: 600 }}>{SKIN_LABELS[key]}</div>
                <div style={{ fontSize: 9, color: "#6a6e74", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url.slice(0, 60)}</div>
              </div>
              <label style={{ fontSize: 10, padding: "4px 6px", background: "#14171c", border: "1px solid #3a3f48", borderRadius: 4, cursor: "pointer", color: "#e8edf2" }}>
                📁
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(key, f); }}
                />
              </label>
              <button onClick={() => onUrl(key)} style={btnMini}>🔗</button>
              <button onClick={() => onReset(key)} style={btnMini} title="Réinitialiser">↺</button>
            </div>
          );
        })}
      </div>

      <CustomVehiclesSection />

      <CustomPedestriansSection />

      <ArmoredTruckSpriteSection />



      <button
        onClick={reload}
        style={{
          width: "100%", marginTop: 10, padding: "8px 10px", borderRadius: 6,
          border: "1px solid #f5c542", background: "#f5c542", color: "#14171c",
          fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}
      >
        ↻ Recharger pour appliquer
      </button>
    </>
  );
}

/** Charge une image (data URL ou URL distante) en HTMLImageElement. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

type VehicleRotation = 0 | 90 | 180 | 270;

function getOpaqueBounds(img: HTMLImageElement): { x: number; y: number; w: number; h: number } | null {
  const w = img.naturalWidth, h = img.naturalHeight;
  if (w <= 0 || h <= 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  let data: Uint8ClampedArray;
  try { data = ctx.getImageData(0, 0, w, h).data; } catch { return null; }

  // 1) S'il y a un vrai canal alpha (PNG/SVG/WebP), on tronque sur l'alpha.
  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 240) { hasAlpha = true; break; }
  }
  if (hasAlpha) {
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] <= 12) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX >= minX && maxY >= minY) {
      return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }
  }

  // 2) Sinon (JPEG, fond uni), détecte la couleur de fond depuis les 4 coins
  //    et tronque tous les pixels qui lui ressemblent (tolérance ~28).
  const sampleCorners = () => {
    const px = (x: number, y: number) => {
      const i = (y * w + x) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    };
    const corners = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)];
    const r = Math.round((corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) / 4);
    const g = Math.round((corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4);
    const b = Math.round((corners[0][2] + corners[1][2] + corners[2][2] + corners[3][2]) / 4);
    return [r, g, b];
  };
  const [br, bg, bb] = sampleCorners();
  const TOL = 28;
  const isBg = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return Math.abs(data[i] - br) <= TOL
      && Math.abs(data[i + 1] - bg) <= TOL
      && Math.abs(data[i + 2] - bb) <= TOL;
  };
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isBg(x, y)) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return null;
  // Petite marge (2 px) pour éviter de raboter un contour sombre du véhicule.
  const pad = 2;
  const x0 = Math.max(0, minX - pad);
  const y0 = Math.max(0, minY - pad);
  const x1 = Math.min(w - 1, maxX + pad);
  const y1 = Math.min(h - 1, maxY + pad);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}


/** Applique la rotation (0/90/180/270°), recentre le vrai véhicule et normalise en 256×256.
 *  Règle de jeu : l'image sauvegardée doit être en vue du ciel avec l'avant vers ↑.
 *  Ensuite le moteur la tourne automatiquement dans le sens de la route. */
async function rotateToDataUrl(src: string, deg: VehicleRotation): Promise<string> {
  const img = await loadImage(src);
  const bounds = getOpaqueBounds(img) ?? { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
  const swap = deg === 90 || deg === 270;
  const rotW = swap ? bounds.h : bounds.w;
  const rotH = swap ? bounds.w : bounds.h;

  const SIZE = 256;
  const FILL = 0.86;
  // On contient le véhicule entier dans le carré au lieu de remplir seulement
  // la largeur : plus aucun camion/ambulance ne se retrouve coupé ou énorme.
  const scale = (SIZE * FILL) / Math.max(rotW, rotH, 1);
  const drawW = bounds.w * scale;
  const drawH = bounds.h * scale;

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.imageSmoothingEnabled = true;
  ctx.translate(SIZE / 2, SIZE / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(img, bounds.x, bounds.y, bounds.w, bounds.h, -drawW / 2, -drawH / 2, drawW, drawH);
  return canvas.toDataURL("image/png");
}

async function guessVehicleRotation(src: string): Promise<VehicleRotation> {
  const img = await loadImage(src);
  const bounds = getOpaqueBounds(img) ?? { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
  const w = bounds.w, h = bounds.h;
  if (w <= 0 || h <= 0) return 0;

  // On extrait un masque alpha du véhicule réel (sans la transparence autour).
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return w > h * 1.15 ? 270 : 0;
  ctx.drawImage(img, bounds.x, bounds.y, w, h, 0, 0, w, h);
  let data: Uint8ClampedArray;
  try { data = ctx.getImageData(0, 0, w, h).data; } catch { return w > h * 1.15 ? 270 : 0; }
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = data[i * 4 + 3] > 32 ? 1 : 0;

  // Pour chaque rotation candidate, on évalue :
  //  - symétrie gauche/droite (un véhicule vu du ciel est miroir sur l'axe vertical)
  //  - bonus si le résultat est en portrait (plus haut que large)
  //  - bonus si le bas est plus dense que le haut (capot/pare-brise => le nez devrait être en haut)
  const rotations: VehicleRotation[] = [0, 90, 180, 270];
  const getRotated = (deg: VehicleRotation, x: number, y: number): number => {
    let sx = 0, sy = 0;
    if (deg === 0) { sx = x; sy = y; }
    else if (deg === 90) { sx = y; sy = w - 1 - x; }
    else if (deg === 180) { sx = w - 1 - x; sy = h - 1 - y; }
    else { sx = h - 1 - y; sy = x; }
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return 0;
    return mask[sy * w + sx];
  };

  let best: VehicleRotation = 0;
  let bestScore = -Infinity;
  for (const deg of rotations) {
    const swap = deg === 90 || deg === 270;
    const rw = swap ? h : w;
    const rh = swap ? w : h;

    let symMatch = 0, symTotal = 0;
    for (let y = 0; y < rh; y++) {
      for (let x = 0; x < Math.floor(rw / 2); x++) {
        const a = getRotated(deg, x, y);
        const b = getRotated(deg, rw - 1 - x, y);
        if (a === b) symMatch++;
        symTotal++;
      }
    }
    const symScore = symTotal > 0 ? symMatch / symTotal : 0;

    let topMass = 0, botMass = 0;
    for (let y = 0; y < rh; y++) {
      for (let x = 0; x < rw; x++) {
        if (!getRotated(deg, x, y)) continue;
        if (y < rh / 2) topMass++; else botMass++;
      }
    }
    const portraitBonus = rh > rw ? 0.12 : 0;
    const noseUpBonus = botMass > topMass * 1.05 ? 0.06 : 0;

    const score = symScore + portraitBonus + noseUpBonus;
    if (score > bestScore) { bestScore = score; best = deg; }
  }
  return best;
}


const TOPDOWN_PREF_KEY = "mttw.admin.alreadyTopDown";

function CustomVehiclesSection() {
  const [items, setItems] = useState<CustomVehicle[]>(() => listCustomVehicles());
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CustomVehicleCategory>("civil");
  const [pendingSrc, setPendingSrc] = useState<string | null>(null);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [alreadyTopDown, setAlreadyTopDown] = useState<boolean>(() => {
    try { return localStorage.getItem(TOPDOWN_PREF_KEY) === "1"; } catch { return false; }
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const batchRef = useRef<HTMLInputElement>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const readFileAsDataUrl = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(f);
    });

  const importBatch = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) return;
    setBatchBusy(true);
    setBatchProgress({ done: 0, total: imgs.length });
    for (let i = 0; i < imgs.length; i++) {
      const f = imgs[i];
      try {
        const src = await readFileAsDataUrl(f);
        let deg: 0 | 90 | 180 | 270 = 0;
        if (!alreadyTopDown) {
          try { deg = await guessVehicleRotation(src); } catch {}
        }
        const finalUrl = await rotateToDataUrl(src, deg);
        const baseName = f.name.replace(/\.[^.]+$/, "") || VEHICLE_CATEGORY_LABELS[category];
        addCustomVehicle({ name: baseName, url: finalUrl, category });
      } catch {}
      setBatchProgress({ done: i + 1, total: imgs.length });
    }
    setBatchBusy(false);
    setTimeout(() => setBatchProgress(null), 1500);
    if (batchRef.current) batchRef.current.value = "";
    refresh();
  };

  const refresh = () => setItems(listCustomVehicles());

  const setAlreadyTopDownPref = (v: boolean) => {
    setAlreadyTopDown(v);
    try { localStorage.setItem(TOPDOWN_PREF_KEY, v ? "1" : "0"); } catch {}
  };

  const onPickFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      setPendingSrc(src);
      setRotation(0);
      if (!alreadyTopDown) {
        void guessVehicleRotation(src).then(setRotation).catch(() => {});
      }
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsDataURL(f);
  };

  const onPickUrl = () => {
    const url = window.prompt("URL de l'image (PNG/JPG vue de dessus de préférence) :", "");
    if (!url) return;
    const src = url.trim();
    setPendingSrc(src);
    setRotation(0);
    if (!alreadyTopDown) {
      void guessVehicleRotation(src).then(setRotation).catch(() => {});
    }
  };


  const confirmAdd = async () => {
    if (!pendingSrc) return;
    try {
      const finalUrl = await rotateToDataUrl(pendingSrc, rotation);
      addCustomVehicle({
        name: name.trim() || VEHICLE_CATEGORY_LABELS[category].replace(/^\S+\s/, ""),
        url: finalUrl,
        category,
      });
      setName("");
      setPendingSrc(null);
      setRotation(0);
      refresh();
    } catch (e) {
      window.alert("Impossible de charger l'image (CORS ou URL invalide). Essaie de la télécharger puis utilise 📁 Fichier.");
    }
  };

  const cancelPending = () => { setPendingSrc(null); setRotation(0); };

  const onDel = (id: string) => {
    if (!window.confirm("Supprimer ce véhicule ?")) return;
    removeCustomVehicle(id);
    refresh();
  };

  const rotateSaved = async (item: CustomVehicle, deg: 0 | 90 | 180 | 270) => {
    try {
      const fixedUrl = await rotateToDataUrl(item.url, deg);
      removeCustomVehicle(item.id);
      addCustomVehicle({ ...item, url: fixedUrl, id: item.id });
      refresh();
    } catch {
      window.alert("Impossible de corriger ce véhicule. Réimporte le fichier d'origine si besoin.");
    }
  };

  return (
    <div style={{ marginTop: 14, padding: 10, background: "#1f242b", borderRadius: 8, border: "1px dashed #3a3f48" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#f5c542", marginBottom: 6 }}>
        ➕ Ajouter un nouveau véhicule
      </div>
      <div style={{ fontSize: 11, color: "#8a8e94", lineHeight: 1.5, marginBottom: 8 }}>
        Le véhicule est remis automatiquement au format taxi. Vérifie seulement que l'avant pointe <strong style={{ color: "#f5c542" }}>vers le haut ↑</strong> avant de valider.
      </div>

      <input
        type="text"
        placeholder="Nom (optionnel)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #3a3f48", background: "#14171c", color: "#e8edf2", fontSize: 12, marginBottom: 6 }}
      />

      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as CustomVehicleCategory)}
        style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #3a3f48", background: "#14171c", color: "#e8edf2", fontSize: 12, marginBottom: 8 }}
      >
        {(Object.keys(VEHICLE_CATEGORY_LABELS) as CustomVehicleCategory[]).map((k) => (
          <option key={k} value={k}>{VEHICLE_CATEGORY_LABELS[k]}</option>
        ))}
      </select>

      <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "#14171c", border: "1px solid #3a3f48", borderRadius: 4, marginBottom: 8, cursor: "pointer", fontSize: 11, color: "#e8edf2" }}>
        <input
          type="checkbox"
          checked={alreadyTopDown}
          onChange={(e) => setAlreadyTopDownPref(e.target.checked)}
          style={{ accentColor: "#f5c542" }}
        />
        <span>🛸 Image déjà en <strong style={{ color: "#f5c542" }}>vue du ciel</strong> (ne pas tourner)</span>
      </label>

      {/* === Zone d'import en LOT === */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const files = Array.from(e.dataTransfer.files || []);
          if (files.length) void importBatch(files);
        }}
        onClick={() => batchRef.current?.click()}
        style={{
          marginBottom: 8,
          padding: 14,
          background: dragOver ? "#1a2030" : "#14171c",
          border: `2px dashed ${dragOver ? "#22c55e" : "#f5c542"}`,
          borderRadius: 8,
          cursor: batchBusy ? "wait" : "pointer",
          textAlign: "center",
          color: "#e8edf2",
          opacity: batchBusy ? 0.7 : 1,
          transition: "background 0.15s, border-color 0.15s",
        }}
      >
        <div style={{ fontSize: 20, marginBottom: 4 }}>📦⬇️</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#f5c542", marginBottom: 2 }}>
          Importer plusieurs voitures d'un coup
        </div>
        <div style={{ fontSize: 10, color: "#8a8e94", lineHeight: 1.4 }}>
          Glisse-dépose ou clique — rotation auto, catégorie : <strong style={{ color: "#e8edf2" }}>{VEHICLE_CATEGORY_LABELS[category]}</strong>
        </div>
        {batchProgress && (
          <div style={{ fontSize: 11, color: "#22c55e", marginTop: 6, fontWeight: 700 }}>
            {batchBusy ? `Import… ${batchProgress.done}/${batchProgress.total}` : `✓ ${batchProgress.done} véhicule(s) ajouté(s)`}
          </div>
        )}
        <input
          ref={batchRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length) void importBatch(files);
          }}
        />
      </div>

      <div style={{ fontSize: 10, color: "#6a6e74", textAlign: "center", marginBottom: 6 }}>
        — ou ajoute une voiture une par une (avec aperçu et rotation manuelle) —
      </div>

      {!pendingSrc ? (
        <div style={{ display: "flex", gap: 6 }}>
          <label style={{ flex: 1, textAlign: "center", padding: "8px", background: "#14171c", border: "1px solid #f5c542", borderRadius: 4, cursor: "pointer", color: "#f5c542", fontSize: 11, fontWeight: 700 }}>
            📁 Fichier
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); }}
            />
          </label>
          <button onClick={onPickUrl} style={{ flex: 1, padding: "8px", background: "#14171c", border: "1px solid #3a3f48", borderRadius: 4, cursor: "pointer", color: "#e8edf2", fontSize: 11, fontWeight: 700 }}>
            🔗 URL
          </button>
        </div>
      ) : (
        <div style={{ background: "#14171c", border: "1px solid #3a3f48", borderRadius: 6, padding: 10 }}>
          <div style={{ fontSize: 10, color: "#8a8e94", marginBottom: 6, textAlign: "center" }}>
            Aperçu source (↑ = avant) <span style={{ color: "#6a6e74" }}>|</span> Aperçu jeu (vue du ciel)
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {/* Aperçu source */}
            <div style={{ position: "relative", width: 100, height: 100, background: "#0a0c10", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 2, left: "50%", transform: "translateX(-50%)", color: "#22c55e", fontSize: 16, fontWeight: 900, lineHeight: 1, zIndex: 2 }}>↑</div>
              <img
                src={pendingSrc}
                alt="aperçu source"
                style={{
                  position: "absolute", inset: 0, width: "100%", height: "100%",
                  objectFit: "contain", transform: `rotate(${rotation}deg)`, transition: "transform 0.15s",
                }}
              />
            </div>
            {/* Aperçu en jeu (simule rotate(90) du moteur de rendu) */}
            <div style={{ position: "relative", width: 100, height: 100, background: "#2a2f38", borderRadius: 6, overflow: "hidden", border: "1px dashed #f5c542" }}>
              <div style={{ position: "absolute", top: 2, left: 4, color: "#f5c542", fontSize: 9, fontWeight: 700, zIndex: 2 }}>EN JEU</div>
              <div style={{ position: "absolute", bottom: 2, right: 4, color: "#22c55e", fontSize: 12, fontWeight: 900, lineHeight: 1, zIndex: 2 }}>→</div>
              <img
                src={pendingSrc}
                alt="aperçu jeu"
                style={{
                  position: "absolute", inset: 0, width: "100%", height: "100%",
                  objectFit: "contain", transform: `rotate(${(rotation + 90) % 360}deg)`, transition: "transform 0.15s",
                }}
              />
            </div>
          </div>
          <div style={{ fontSize: 10, color: "#8a8e94", marginTop: 6, textAlign: "center", lineHeight: 1.4 }}>
            La flèche verte → est le sens de marche.<br />
            Tourne jusqu'à ce que le nez du véhicule pointe dans cette direction.
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 8, justifyContent: "center", alignItems: "center" }}>
            <button onClick={() => setRotation(((rotation + 270) % 360) as 0 | 90 | 180 | 270)} style={btnMini}>↺ -90°</button>
            <span style={{ fontSize: 11, color: "#f5c542", padding: "4px 8px", fontWeight: 700 }}>{rotation}°</span>
            <button onClick={() => setRotation(((rotation + 90) % 360) as 0 | 90 | 180 | 270)} style={btnMini}>↻ +90°</button>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button onClick={cancelPending} style={{ flex: 1, padding: "8px", background: "#14171c", border: "1px solid #3a3f48", borderRadius: 4, cursor: "pointer", color: "#e8edf2", fontSize: 11, fontWeight: 700 }}>
              Annuler
            </button>
            <button onClick={confirmAdd} style={{ flex: 2, padding: "8px", background: "#f5c542", border: "1px solid #f5c542", borderRadius: 4, cursor: "pointer", color: "#14171c", fontSize: 11, fontWeight: 800 }}>
              ✓ Valider et ajouter
            </button>
          </div>
        </div>
      )}


      {items.length > 0 && (
        <div style={{ marginTop: 10, display: "grid", gap: 4 }}>
          <div style={{ fontSize: 10, color: "#8a8e94", marginBottom: 2 }}>Mes véhicules ({items.length})</div>
          {items.map((v) => (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: 4, background: "#14171c", borderRadius: 4 }}>
              <img src={v.url} alt="" style={{ width: 28, height: 28, objectFit: "contain", background: "#0a0c10", borderRadius: 3 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "#e8edf2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</div>
                <div style={{ fontSize: 9, color: "#6a6e74" }}>{VEHICLE_CATEGORY_LABELS[v.category as CustomVehicleCategory] ?? v.category}</div>
              </div>
              <button onClick={() => rotateSaved(v, 270)} style={btnMini} title="Tourner à gauche">↺</button>
              <button onClick={() => rotateSaved(v, 180)} style={btnMini} title="Retourner (haut/bas)">↑</button>
              <button onClick={() => rotateSaved(v, 90)} style={btnMini} title="Tourner à droite">↻</button>
              <button onClick={() => onDel(v.id)} style={{ ...btnMini, color: "#ff6b6b", borderColor: "#5a2a2a" }}>🗑</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const btnMini: CSSProperties = {
  fontSize: 10, padding: "4px 6px", background: "#14171c",
  border: "1px solid #3a3f48", borderRadius: 4, cursor: "pointer", color: "#e8edf2",
};

// =============================================================
// Section piétons personnalisés — upload de sprites vue du ciel
// (PNG transparent, tête vers le nord). Stockés en localStorage
// et mergés dans le pool de piétons qui marchent sur les trottoirs.
// =============================================================
function CustomPedestriansSection() {
  const [items, setItems] = useState<CustomPedestrian[]>(() => listCustomPedestrians());
  const [pending, setPending] = useState<{ src: string; name: string } | null>(null);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => setItems(listCustomPedestrians());

  const onPick = (f: File | null) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      setPending({ src: String(r.result), name: f.name.replace(/\.[^.]+$/, "") });
      setRotation(0);
      if (fileRef.current) fileRef.current.value = "";
    };
    r.readAsDataURL(f);
  };

  const confirmAdd = async () => {
    if (!pending) return;
    try {
      const finalUrl = await rotateToDataUrl(pending.src, rotation);
      addCustomPedestrian({ name: pending.name || "Piéton", url: finalUrl });
      setPending(null);
      setRotation(0);
      refresh();
    } catch {
      window.alert("Impossible de charger l'image.");
    }
  };

  const onRemove = (id: string) => {
    if (!window.confirm("Supprimer ce piéton ?")) return;
    removeCustomPedestrian(id);
    refresh();
  };

  return (
    <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #2a2f38" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#f5c542", marginBottom: 6 }}>
        🚶 Piétons personnalisés
      </div>
      <div style={{ fontSize: 11, color: "#8a8e94", lineHeight: 1.4, marginBottom: 8 }}>
        Ajoute des piétons qui marchent sur les trottoirs. PNG transparent vu du ciel, tête vers le haut (↑).
      </div>

      <label style={{
        display: "inline-block", fontSize: 11, padding: "6px 10px", background: "#14171c",
        border: "1px solid #3a3f48", borderRadius: 6, cursor: "pointer", color: "#e8edf2",
      }}>
        📁 Choisir une image
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
      </label>

      {pending && (
        <div style={{
          marginTop: 8, padding: 10, background: "#0f1318",
          borderRadius: 8, border: "1px solid #2a2f38",
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src={pending.src}
              alt=""
              style={{
                width: 72, height: 72, objectFit: "contain",
                background: "#1f242b", borderRadius: 6, border: "1px solid #2a2f38",
                transform: `rotate(${rotation}deg)`,
              }}
            />
            <input
              type="text"
              value={pending.name}
              onChange={(e) => setPending({ ...pending, name: e.target.value })}
              placeholder="Nom du piéton"
              style={{
                flex: 1, padding: "6px 8px", borderRadius: 6,
                border: "1px solid #444", background: "#111", color: "#fff", fontSize: 12,
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setRotation((r) => ((r + 270) % 360) as 0 | 90 | 180 | 270)} style={btnMini}>↺ -90°</button>
            <button onClick={() => setRotation((r) => ((r + 90) % 360) as 0 | 90 | 180 | 270)} style={btnMini}>↻ +90°</button>
            <button onClick={() => setRotation((r) => ((r + 180) % 360) as 0 | 90 | 180 | 270)} style={btnMini}>↕ 180°</button>
            <span style={{ alignSelf: "center", fontSize: 10, color: "#8a8e94" }}>{rotation}°</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={confirmAdd}
              style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "none", background: "#22c55e", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}
            >
              ✓ Ajouter
            </button>
            <button
              onClick={() => { setPending(null); setRotation(0); }}
              style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #444", background: "transparent", color: "#c8ccd2", cursor: "pointer", fontSize: 12 }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
          {items.map((p) => (
            <div key={p.id} style={{
              background: "#1f242b", padding: 8, borderRadius: 6,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <img src={p.url} alt="" style={{ width: 36, height: 36, objectFit: "contain", background: "#0a0c10", borderRadius: 4 }} />
              <div style={{ flex: 1, fontSize: 11, color: "#e8edf2", fontWeight: 600 }}>{p.name}</div>
              <button onClick={() => onRemove(p.id)} style={{ ...btnMini, borderColor: "#7f1d1d", color: "#fca5a5" }}>🗑</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ARMORED_SPRITE_KEY = "jce.armored.sprite";
function ArmoredTruckSpriteSection() {
  const [url, setUrl] = useState<string | null>(() => {
    try { return localStorage.getItem(ARMORED_SPRITE_KEY); } catch { return null; }
  });
  const onFile = (f: File | null) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const dataUrl = String(r.result || "");
      try { localStorage.setItem(ARMORED_SPRITE_KEY, dataUrl); } catch { /* noop */ }
      setUrl(dataUrl);
      window.dispatchEvent(new CustomEvent("jce:armored-sprite-changed"));
    };
    r.readAsDataURL(f);
  };
  const clear = () => {
    try { localStorage.removeItem(ARMORED_SPRITE_KEY); } catch { /* noop */ }
    setUrl(null);
    window.dispatchEvent(new CustomEvent("jce:armored-sprite-changed"));
  };
  return (
    <div style={{ marginTop: 14, padding: 10, background: "#1a1f26", border: "1px solid #2a2f38", borderRadius: 8 }}>
      <div style={{ fontSize: 12, color: "#fde047", fontWeight: 800, marginBottom: 6 }}>
        🚛 Camion blindé (sprite)
      </div>
      <div style={{ fontSize: 10, color: "#8a8e94", marginBottom: 8, lineHeight: 1.4 }}>
        Sprite vu du dessus, nez vers le haut. Le camion apparaît toutes les 5-8 min ;
        clique dessus en jeu pour tenter un braquage.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {url ? (
          <img src={url} alt="Camion blindé" style={{ width: 44, height: 44, objectFit: "contain", background: "#0a0c10", borderRadius: 4 }} />
        ) : (
          <div style={{ width: 44, height: 44, background: "#0a0c10", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#52525b", fontSize: 18 }}>🚛</div>
        )}
        <label style={{ fontSize: 11, padding: "6px 10px", background: "#14171c", border: "1px solid #3a3f48", borderRadius: 4, cursor: "pointer", color: "#e8edf2" }}>
          📁 Choisir
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {url && (
          <button onClick={clear} style={{ ...btnMini, borderColor: "#7f1d1d", color: "#fca5a5" }}>🗑</button>
        )}
      </div>
    </div>
  );
}


// ---------- Onglet Missions spéciales : déclencher braquages & événements ----------
function SpecialMissionsTab({ cfg, goSkins }: { cfg: AdminConfig; goSkins: () => void }) {
  const [flash, setFlash] = useState<string | null>(null);
  const fire = (event: string, detail?: Record<string, unknown>, label?: string) => {
    window.dispatchEvent(new CustomEvent(event, { detail }));
    if (label) {
      setFlash(label);
      window.setTimeout(() => setFlash(null), 2200);
    }
  };
  return (
    <>
      <div style={{ fontSize: 12, color: "#c8ccd2", lineHeight: 1.5, marginBottom: 8 }}>
        💥 <strong style={{ color: "#f5c542" }}>Missions spéciales</strong>
      </div>
      <div style={{ fontSize: 11, color: "#8a8e94", lineHeight: 1.5, marginBottom: 10 }}>
        Déclenche un événement immédiatement. Le joueur ET les rivaux peuvent rafler la mission.
      </div>

      {/* Bannière vers Skins */}
      <button
        onClick={goSkins}
        style={{
          width: "100%", padding: "8px 10px", marginBottom: 12,
          background: "linear-gradient(90deg,#1e293b,#0f172a)",
          border: "1px solid #f5c542", borderRadius: 8,
          color: "#f5c542", font: "600 11px ui-sans-serif", textAlign: "left", cursor: "pointer",
        }}
      >
        🎨 Voitures de police / pompiers / ambulance pas belles ? → Onglet Skins pour remplacer les visuels
      </button>

      {/* Boutons d'action */}
      <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
        <button
          onClick={() => fire("jce:armored-spawn-now", undefined, "🚛 Camion blindé lancé !")}
          style={specBtn("#fde047", "#78350f")}
        >
          🚛 Lancer un camion blindé maintenant
          <div style={specHint}>Le camion traverse la ville, cliquable pour braquage. Rivaux peuvent intercepter.</div>
        </button>
        <button
          onClick={() => fire("jce:crime-spawn-now", { kind: "robbery" }, "🚨 Braquage en cours !")}
          style={specBtn("#ef4444", "#7f1d1d")}
        >
          🏦 Déclencher un braquage de banque
          <div style={specHint}>Marqueur rouge sur la carte. Envoie la police avant que l'IA rafle la mission.</div>
        </button>
        <button
          onClick={() => fire("jce:crime-spawn-now", { kind: "fire" }, "🔥 Incendie déclaré !")}
          style={specBtn("#f97316", "#7c2d12")}
        >
          🔥 Déclencher un incendie
        </button>
        <button
          onClick={() => fire("jce:crime-spawn-now", { kind: "accident" }, "🚑 Accident grave !")}
          style={specBtn("#fb923c", "#9a3412")}
        >
          🚑 Déclencher un accident
        </button>
        <button
          onClick={() => fire("jce:crime-spawn-now", { kind: "fight" }, "🥊 Rixe en cours !")}
          style={specBtn("#a855f7", "#581c87")}
        >
          🥊 Déclencher une rixe
        </button>
      </div>

      {flash && (
        <div style={{
          padding: "6px 10px", marginBottom: 12, borderRadius: 6,
          background: "#0f3d24", border: "1px solid #22c55e", color: "#bbf7d0",
          font: "600 11px ui-sans-serif",
        }}>{flash}</div>
      )}

      {/* Réglages camion blindé */}
      <div style={{ background: "#1f242b", padding: "10px 12px", borderRadius: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#f5c542", marginBottom: 8, letterSpacing: 0.3 }}>
          🚛 RÉGLAGES CAMION BLINDÉ
        </div>
        <label className="adm-toggle" style={{ marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={cfg.armoredAutoSpawn !== false}
            onChange={(e) => setAdmin({ armoredAutoSpawn: e.target.checked })}
          />
          Apparition automatique (toutes les 5–8 min)
        </label>
        <label className="adm-toggle" style={{ marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={cfg.rivalsCanHeist !== false}
            onChange={(e) => setAdmin({ rivalsCanHeist: e.target.checked })}
          />
          Les rivaux peuvent tenter le braquage
        </label>
        <Slider
          label="Fréquence d'apparition"
          hint="×0.25 = 4× plus souvent · ×3 = 3× plus rare"
          value={cfg.armoredFreqMult ?? 1}
          min={0.25} max={3} step={0.05}
          format={(v) => "×" + v.toFixed(2)}
          onChange={(v) => setAdmin({ armoredFreqMult: v })}
        />
      </div>
    </>
  );
}

const specBtn = (accent: string, bg: string): CSSProperties => ({
  padding: "10px 12px",
  background: bg,
  border: `1px solid ${accent}`,
  borderRadius: 8,
  color: "#fff8e7",
  font: "700 12px ui-sans-serif",
  textAlign: "left",
  cursor: "pointer",
  lineHeight: 1.3,
});
const specHint: CSSProperties = {
  marginTop: 4, fontSize: 10, fontWeight: 500, color: "#fde68a", opacity: 0.85,
};
