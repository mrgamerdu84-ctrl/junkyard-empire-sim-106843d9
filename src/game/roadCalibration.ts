// Auto-calibration des waypoints ROADS sur l'image actuelle de la ville.
// Charge le bitmap de la map, détecte les pixels « asphalte » (gris désaturé),
// puis snappe chaque coordonnée numérique des paths sur le pixel route le plus
// proche dans un rayon de recherche. Le résultat est persisté en localStorage
// et applique une mutation in-place sur le tableau ROADS exporté par
// CityTraffic (les composants relisent ROADS à chaque rendu).
import mapAsset from "@/assets/citymap3.jpg.asset.json";
const mapUrl = mapAsset.url;
import { ROADS } from "./CityTraffic";

const STORAGE_KEY = "jce.roads.calibrated.v2";
const MAP_W = 1920;
const MAP_H = 1080;
const SAMPLE_W = 480;
const SAMPLE_H = 270;
const SEARCH_RADIUS_PX = 28; // rayon de snap en coords map 1920x1080

let maskCache: Uint8Array | null = null;

async function buildMask(): Promise<Uint8Array> {
  if (maskCache) return maskCache;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = mapUrl;
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("map load failed"));
  });
  const cvs = document.createElement("canvas");
  cvs.width = SAMPLE_W;
  cvs.height = SAMPLE_H;
  const ctx = cvs.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, SAMPLE_W, SAMPLE_H);
  const data = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;
  const mask = new Uint8Array(SAMPLE_W * SAMPLE_H);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max - min;
    // asphalte ≈ gris désaturé, luminance moyenne
    if (max >= 55 && max <= 185 && sat <= 30) mask[p] = 1;
  }
  maskCache = mask;
  return mask;
}

function snapToRoad(mask: Uint8Array, x: number, y: number): { x: number; y: number } {
  const sx = (x / MAP_W) * SAMPLE_W;
  const sy = (y / MAP_H) * SAMPLE_H;
  const ix = Math.round(sx);
  const iy = Math.round(sy);
  const idx = iy * SAMPLE_W + ix;
  if (ix >= 0 && ix < SAMPLE_W && iy >= 0 && iy < SAMPLE_H && mask[idx]) {
    return { x, y };
  }
  const rSample = Math.max(2, Math.round((SEARCH_RADIUS_PX / MAP_W) * SAMPLE_W));
  let bestD = Infinity;
  let bestX = x, bestY = y;
  for (let dy = -rSample; dy <= rSample; dy++) {
    const yy = iy + dy;
    if (yy < 0 || yy >= SAMPLE_H) continue;
    for (let dx = -rSample; dx <= rSample; dx++) {
      const xx = ix + dx;
      if (xx < 0 || xx >= SAMPLE_W) continue;
      if (!mask[yy * SAMPLE_W + xx]) continue;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        bestX = (xx / SAMPLE_W) * MAP_W;
        bestY = (yy / SAMPLE_H) * MAP_H;
      }
    }
  }
  return { x: bestX, y: bestY };
}

// Parcourt un path "M x y C x y x y x y …" en snappant chaque paire (x,y)
// — préserve toutes les commandes (lettres).
function calibratePath(d: string, mask: Uint8Array): string {
  const tokens = d.match(/[a-zA-Z]|-?\d+(?:\.\d+)?/g);
  if (!tokens) return d;
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[a-zA-Z]/.test(t)) {
      out.push(t);
      i++;
      continue;
    }
    const x = parseFloat(t);
    const y = parseFloat(tokens[i + 1] ?? "0");
    const snapped = snapToRoad(mask, x, y);
    out.push(snapped.x.toFixed(1), snapped.y.toFixed(1));
    i += 2;
  }
  // recompose : lettre seule, sinon "x y x y …"
  let s = "";
  for (let k = 0; k < out.length; k++) {
    const tok = out[k];
    if (/[a-zA-Z]/.test(tok)) s += (s ? " " : "") + tok;
    else s += " " + tok;
  }
  return s.trim();
}

export async function calibrateRoadsFromMap(): Promise<{ count: number; snapped: number }> {
  const mask = await buildMask();
  const before = ROADS.slice();
  const after = before.map(d => calibratePath(d, mask));
  ROADS.length = 0;
  for (const d of after) ROADS.push(d);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(after)); } catch { /* quota */ }
  window.dispatchEvent(new CustomEvent("jce.roads.calibrated"));
  return { count: after.length, snapped: after.filter((d, i) => d !== before[i]).length };
}

export function applyStoredCalibration(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length !== ROADS.length) return false;
    ROADS.length = 0;
    for (const d of arr) ROADS.push(d);
    return true;
  } catch { return false; }
}

export function clearCalibration() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}
