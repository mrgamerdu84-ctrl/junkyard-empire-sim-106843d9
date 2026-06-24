// =============================================================
// Helper partagé : convertit la polyligne de waypoints dessinée par
// le joueur dans le panel admin (admin.circuitPoints) en un path SVG
// fermé (boucle). Renvoie null s'il y a moins de 2 points.
//
// Toutes les voitures du jeu (trafic civil, taxis rivaux, camion
// blindé) suivent ce path unique. Pas de circuit dessiné = aucun
// véhicule sur la carte.
// =============================================================

export type CircuitPoint = { x: number; y: number };

export function circuitToSvgPath(points: CircuitPoint[] | undefined | null): string | null {
  if (!points || points.length < 2) return null;
  const parts: string[] = [];
  parts.push(`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`);
  for (let i = 1; i < points.length; i++) {
    parts.push(`L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`);
  }
  // Toujours fermer la boucle pour que les véhicules tournent en boucle.
  parts.push("Z");
  return parts.join(" ");
}
