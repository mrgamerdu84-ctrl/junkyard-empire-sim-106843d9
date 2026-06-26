// =============================================================
// Map view mode — partagé entre tous les calques SVG de la carte
// "fill" = preserveAspectRatio="xMidYMid slice"  (immersif, par défaut)
// "fit"  = preserveAspectRatio="xMidYMid meet"   (toute la carte visible)
// =============================================================
import { useEffect, useState } from "react";

export type MapFit = "fill" | "fit";
const KEY = "mtw-map-fit";
const EVT = "mtw:map-fit-changed";

export function getMapFit(): MapFit {
  try {
    const v = localStorage.getItem(KEY);
    return v === "fit" ? "fit" : "fill";
  } catch { return "fill"; }
}

export function setMapFit(next: MapFit) {
  try { localStorage.setItem(KEY, next); } catch {}
  window.dispatchEvent(new CustomEvent<MapFit>(EVT, { detail: next }));
}

export function toggleMapFit(): MapFit {
  const next: MapFit = getMapFit() === "fit" ? "fill" : "fit";
  setMapFit(next);
  return next;
}

export function preserveAspectFor(fit: MapFit): string {
  return fit === "fit" ? "xMidYMid meet" : "xMidYMid slice";
}

export function useMapFit(): MapFit {
  const [fit, setFit] = useState<MapFit>(() => getMapFit());
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<MapFit>).detail;
      if (detail === "fit" || detail === "fill") setFit(detail);
    };
    window.addEventListener(EVT, onChange as EventListener);
    return () => window.removeEventListener(EVT, onChange as EventListener);
  }, []);
  return fit;
}
