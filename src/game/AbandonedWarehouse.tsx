import { useAdminConfig } from "./adminConfig";
import depotAsset from "@/assets/taxi-depot-iso.png.asset.json";

/**
 * Dépôt de taxis — entrepôt industriel réaliste (image PNG).
 * Remplace l'ancien dessin SVG. Conserve position/rotation/échelle
 * pilotées par l'admin (hqX / hqY / hqScale / hqRotation) pour ne
 * casser aucune fonctionnalité (spawn taxis, gestion, etc.).
 */
export default function AbandonedWarehouse() {
  const admin = useAdminConfig();
  const cx = admin.hqX;
  const cy = admin.hqY;
  const scale = Math.max(0.45, Math.min(2.8, admin.hqScale * 1.15));
  const rot = admin.hqRotation || 0;

  // Dimensions de rendu (viewBox 1920x1080) — l'image originale fait 1280x960,
  // on garde son ratio et on la centre sur (cx, cy).
  const baseW = 420;
  const baseH = baseW; // image isométrique carrée 1024x1024
  const w = baseW * scale;
  const h = baseH * scale;

  return (
    <svg
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 7,
        overflow: "visible",
      }}
      aria-hidden
    >
      <defs>
        <filter id="depot-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#3a2a10" floodOpacity="0.35" />
        </filter>
      </defs>

      <g transform={`translate(${cx},${cy}) rotate(${rot})`}>
        {/* Bâtiment isométrique — l'ombre est déjà intégrée à l'illustration */}
        <image
          href={depotAsset.url}
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          preserveAspectRatio="xMidYMid meet"
          filter="url(#depot-shadow)"
        />
      </g>
    </svg>
  );
}
