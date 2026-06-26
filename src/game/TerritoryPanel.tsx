// =============================================================
// Overlay "Quartiers" : affiche pour chaque quartier sa jauge de
// conquête, ton statut de contrôle et le passif total $/min.
// Lit l'état exposé par TerritoryWar via window.__mtwTerritory et
// se rafraîchit quand une course se termine ou périodiquement.
// =============================================================
import { useEffect, useRef, useState } from "react";

type District = {
  id: string; name: string;
  x: number; y: number; w: number; h: number;
  count: number; owned: boolean;
};

const THRESHOLD = 8;
const BONUS_PER_DISTRICT = 60;

function read(): District[] {
  const w = window as unknown as { __mtwTerritory?: District[] };
  if (w.__mtwTerritory) return w.__mtwTerritory;
  try {
    const raw = localStorage.getItem("mtw-territory-v1");
    if (raw) return JSON.parse(raw) as District[];
  } catch {}
  return [];
}

const MAP_W = 1920;
const MAP_H = 1080;
const MIN_ZOOM = 1;     // = vue complète
const MAX_ZOOM = 6;

export default function TerritoryPanel() {
  const [open, setOpen] = useState(false);
  const [districts, setDistricts] = useState<District[]>(read);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // viewBox de la mini-carte (pan + zoom)
  const [view, setView] = useState({ x: 0, y: 0, w: MAP_W, h: MAP_H });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; view: typeof view } | null>(null);
  const dragMoved = useRef(0);

  useEffect(() => {
    const refresh = () => setDistricts(read());
    const openEvt = () => { refresh(); setOpen(true); };
    const t = window.setInterval(refresh, 1500);
    window.addEventListener("mtw:course-completed", refresh as EventListener);
    window.addEventListener("mtw:open-territory", openEvt as EventListener);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("mtw:course-completed", refresh as EventListener);
      window.removeEventListener("mtw:open-territory", openEvt as EventListener);
    };
  }, []);

  const clampView = (v: typeof view) => {
    const w = Math.min(MAP_W, Math.max(MAP_W / MAX_ZOOM, v.w));
    const h = (w / MAP_W) * MAP_H;
    const x = Math.min(MAP_W - w, Math.max(0, v.x));
    const y = Math.min(MAP_H - h, Math.max(0, v.y));
    return { x, y, w, h };
  };

  const zoomAt = (factor: number, cx: number, cy: number) => {
    setView((v) => {
      const nw = v.w / factor;
      const nh = v.h / factor;
      const nx = cx - (cx - v.x) * (nw / v.w);
      const ny = cy - (cy - v.y) * (nh / v.h);
      return clampView({ x: nx, y: ny, w: nw, h: nh });
    });
  };

  const clientToSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return {
      x: view.x + ((clientX - r.left) / r.width) * view.w,
      y: view.y + ((clientY - r.top) / r.height) * view.h,
    };
  };

  const focusDistrict = (id: string) => {
    setOpen(true);
    setSelectedId(id);
    requestAnimationFrame(() => {
      cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    window.setTimeout(() => setSelectedId((cur) => (cur === id ? null : cur)), 2200);
  };

  const owned = districts.filter((d) => d.owned).length;
  const passive = owned * BONUS_PER_DISTRICT;
  const fmtMoney = (n: number) => n.toLocaleString("fr-FR");




  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed", right: 12, bottom: 166, zIndex: 9999,
          width: 46, height: 46, borderRadius: "50%",
          border: "2px solid #fde047",
          background: "rgba(12,14,22,0.92)", color: "#fde047",
          fontWeight: 900, fontSize: 10, fontFamily: "system-ui, sans-serif",
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", lineHeight: 1, gap: 1, padding: 0,
          boxShadow: "0 4px 14px rgba(0,0,0,0.6)", cursor: "pointer",
        }}
        aria-label="Quartiers contrôlés"
      >
        <span style={{ fontSize: 16 }}>🏁</span>
        <span style={{ fontSize: 9, opacity: 0.9 }}>{owned}/{districts.length || 6}</span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9998,
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(420px, 96vw)", maxHeight: "82vh", overflowY: "auto",
              background: "linear-gradient(180deg,#1a1306,#0c0a04)",
              border: "2px solid #fde047", borderRadius: 16,
              padding: "14px 14px 18px",
              fontFamily: "system-ui, sans-serif", color: "#fff7d6",
              boxShadow: "0 18px 50px rgba(0,0,0,0.7)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: 1, color: "#fde047" }}>
                🏁 GUERRE DE TERRITOIRE
              </div>
              <button
                type="button" onClick={() => setOpen(false)}
                style={{
                  background: "transparent", border: "1px solid #fde047",
                  color: "#fde047", borderRadius: 8, padding: "4px 10px",
                  fontWeight: 900, cursor: "pointer",
                }}
              >✕</button>
            </div>

            {/* Mini-carte des territoires (couleur taxi du joueur = jaune/or) */}
            <div style={{
              marginBottom: 10, borderRadius: 12, overflow: "hidden",
              border: "1.5px solid #5a5240",
              background: "linear-gradient(180deg,#0e1118,#070910)",
              position: "relative",
            }}>
              <svg
                ref={svgRef}
                viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
                style={{
                  display: "block", width: "100%", height: "auto",
                  touchAction: "none",
                  cursor: pointers.current.size === 1 ? "grabbing" : "grab",
                }}
                onWheel={(e) => {
                  e.preventDefault();
                  const p = clientToSvg(e.clientX, e.clientY);
                  zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, p.x, p.y);
                }}
                onPointerDown={(e) => {
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                  pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
                  dragMoved.current = 0;
                  if (pointers.current.size === 2) {
                    const pts = Array.from(pointers.current.values());
                    const dx = pts[0].x - pts[1].x;
                    const dy = pts[0].y - pts[1].y;
                    pinchStart.current = { dist: Math.hypot(dx, dy), view };
                  }
                }}
                onPointerMove={(e) => {
                  const prev = pointers.current.get(e.pointerId);
                  if (!prev) return;
                  pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
                  if (pointers.current.size === 1) {
                    const svg = svgRef.current;
                    if (!svg) return;
                    const r = svg.getBoundingClientRect();
                    const dx = ((e.clientX - prev.x) / r.width) * view.w;
                    const dy = ((e.clientY - prev.y) / r.height) * view.h;
                    dragMoved.current += Math.abs(dx) + Math.abs(dy);
                    setView((v) => clampView({ ...v, x: v.x - dx, y: v.y - dy }));
                  } else if (pointers.current.size === 2 && pinchStart.current) {
                    const pts = Array.from(pointers.current.values());
                    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                    const factor = dist / pinchStart.current.dist;
                    const cx = (pts[0].x + pts[1].x) / 2;
                    const cy = (pts[0].y + pts[1].y) / 2;
                    const p = clientToSvg(cx, cy);
                    setView(() => {
                      const start = pinchStart.current!.view;
                      const nw = start.w / factor;
                      const nh = start.h / factor;
                      const nx = p.x - (p.x - start.x) * (nw / start.w);
                      const ny = p.y - (p.y - start.y) * (nh / start.h);
                      return clampView({ x: nx, y: ny, w: nw, h: nh });
                    });
                    dragMoved.current += 999;
                  }
                }}
                onPointerUp={(e) => {
                  pointers.current.delete(e.pointerId);
                  if (pointers.current.size < 2) pinchStart.current = null;
                }}
                onPointerCancel={(e) => {
                  pointers.current.delete(e.pointerId);
                  pinchStart.current = null;
                }}
              >
                {/* trame routes */}
                <rect x="0" y="0" width="1920" height="1080" fill="#0b0d12" />
                {Array.from({ length: 6 }).map((_, i) => (
                  <line key={`h${i}`} x1="0" y1={180 * (i + 1)} x2="1920" y2={180 * (i + 1)}
                    stroke="#1d2230" strokeWidth="2" />
                ))}
                {Array.from({ length: 10 }).map((_, i) => (
                  <line key={`v${i}`} x1={192 * (i + 1)} y1="0" x2={192 * (i + 1)} y2="1080"
                    stroke="#1d2230" strokeWidth="2" />
                ))}
                {districts.map((d) => {
                  const fill = d.owned ? "#fde047" : "#2a2f3d";
                  const isSel = selectedId === d.id;
                  const stroke = isSel ? "#ffffff" : d.owned ? "#fff7a0" : "#4a5160";
                  return (
                    <g key={d.id} style={{ cursor: "pointer" }}
                      onClick={() => { if (dragMoved.current < 12) focusDistrict(d.id); }}>
                      <rect x={d.x + 10} y={d.y + 10} width={d.w - 20} height={d.h - 20}
                        rx="22" fill={fill} fillOpacity={d.owned ? 0.85 : 0.45}
                        stroke={stroke} strokeWidth={isSel ? 8 : 4} />
                      {d.owned && (
                        <text x={d.x + d.w / 2} y={d.y + d.h / 2 + 8} textAnchor="middle"
                          fontSize="40" fontWeight="900" fill="#1a1306"
                          fontFamily="system-ui, sans-serif" pointerEvents="none">🚕</text>
                      )}
                      <text x={d.x + d.w / 2} y={d.y + d.h - 30} textAnchor="middle"
                        fontSize="34" fontWeight="900"
                        fill={d.owned ? "#1a1306" : "#cbb98a"}
                        fontFamily="system-ui, sans-serif" letterSpacing="2"
                        pointerEvents="none">
                        {d.name.toUpperCase()}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Boutons zoom +/− / reset */}
              <div style={{
                position: "absolute", top: 8, right: 8, display: "flex",
                flexDirection: "column", gap: 4,
              }}>
                {[
                  { l: "+", a: () => zoomAt(1.4, view.x + view.w / 2, view.y + view.h / 2) },
                  { l: "−", a: () => zoomAt(1 / 1.4, view.x + view.w / 2, view.y + view.h / 2) },
                  { l: "⟲", a: () => setView({ x: 0, y: 0, w: MAP_W, h: MAP_H }) },
                ].map((b) => (
                  <button key={b.l} type="button" onClick={b.a}
                    style={{
                      width: 30, height: 30, borderRadius: 6,
                      border: "1.5px solid #fde047", background: "rgba(12,14,22,0.85)",
                      color: "#fde047", fontWeight: 900, fontSize: 16, cursor: "pointer",
                      lineHeight: 1, padding: 0,
                    }}>{b.l}</button>
                ))}
              </div>

              <div style={{
                display: "flex", justifyContent: "center", gap: 14, padding: "6px 0",
                fontSize: 10, background: "rgba(0,0,0,0.5)", borderTop: "1px solid #2a2f3d",
              }}>
                <LegendDot color="#fde047" label="Tes quartiers" />
                <LegendDot color="#2a2f3d" label="Neutre" border="#4a5160" />
              </div>
            </div>

            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12,
            }}>
              <Stat label="QUARTIERS" value={`${owned}/${districts.length || 6}`} />
              <Stat label="PASSIF" value={`+${fmtMoney(passive)}$/min`} highlight />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {districts.length === 0 && (
                <div style={{ opacity: 0.7, fontSize: 12, textAlign: "center", padding: 10 }}>
                  Aucune donnée. Termine une course pour démarrer la conquête.
                </div>
              )}
              {districts.map((d) => {
                const pct = d.owned ? 100 : Math.min(100, (d.count / THRESHOLD) * 100);
                const isSel = selectedId === d.id;
                return (
                  <div key={d.id}
                    ref={(el) => { cardRefs.current[d.id] = el; }}
                    style={{
                      border: `${isSel ? 2.5 : 1.5}px solid ${isSel ? "#ffffff" : d.owned ? "#fde047" : "#7c7361"}`,
                      background: d.owned ? "rgba(245,197,66,0.10)" : "rgba(255,255,255,0.03)",
                      borderRadius: 10, padding: "8px 10px",
                      boxShadow: isSel ? "0 0 0 3px rgba(255,255,255,0.18)" : "none",
                      transition: "border-color 0.2s, box-shadow 0.2s",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ fontWeight: 900, fontSize: 12, color: d.owned ? "#fde047" : "#fff7d6" }}>
                        {d.owned ? "★ " : ""}{d.name.toUpperCase()}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: d.owned ? "#fde047" : "#cbb98a" }}>
                        {d.owned ? `+${fmtMoney(BONUS_PER_DISTRICT)}$/min` : `${d.count}/${THRESHOLD}`}
                      </div>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
                      <div style={{
                        width: `${pct}%`, height: "100%",
                        background: d.owned ? "#fde047" : "linear-gradient(90deg,#a07c10,#fde047)",
                        transition: "width 0.3s",
                      }} />
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>
                      {d.owned
                        ? "Contrôlé — bonus passif actif"
                        : `Statut : neutre · ${THRESHOLD - d.count} course${THRESHOLD - d.count > 1 ? "s" : ""} restantes`}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ fontSize: 10, opacity: 0.6, marginTop: 12, textAlign: "center" }}>
              Termine une course dans un quartier pour faire monter sa jauge.
              À {THRESHOLD} courses, il devient à toi.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      border: `1.5px solid ${highlight ? "#fde047" : "#5a5240"}`,
      background: highlight ? "rgba(245,197,66,0.12)" : "rgba(0,0,0,0.4)",
      borderRadius: 10, padding: "6px 10px", textAlign: "center",
    }}>
      <div style={{ fontSize: 9, opacity: 0.7, letterSpacing: 1 }}>{label}</div>
      <div style={{ fontWeight: 900, fontSize: 14, color: highlight ? "#fde047" : "#fff7d6" }}>{value}</div>
    </div>
  );
}

function LegendDot({ color, label, border }: { color: string; label: string; border?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#cbb98a", fontWeight: 700 }}>
      <span style={{
        width: 12, height: 12, borderRadius: 3, background: color,
        border: `1px solid ${border ?? color}`,
      }} />
      {label}
    </div>
  );
}
