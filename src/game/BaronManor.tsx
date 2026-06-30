import { useEffect, useRef, useState } from "react";

const MAP_W = 1920;
const MAP_H = 1080;
const STORAGE_KEY = "jce.baronManor.position.v1";
const DEFAULT_POS = { x: 520, y: 135 };

type ManorPos = { x: number; y: number };

function clampPos(pos: ManorPos): ManorPos {
  return {
    x: Math.max(0, Math.min(MAP_W, pos.x)),
    y: Math.max(0, Math.min(MAP_H, pos.y)),
  };
}

function loadPos(): ManorPos {
  if (typeof window === "undefined") return DEFAULT_POS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_POS;
    const parsed = JSON.parse(raw) as Partial<ManorPos>;
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return DEFAULT_POS;
    return clampPos({ x: parsed.x, y: parsed.y });
  } catch {
    return DEFAULT_POS;
  }
}

function savePos(pos: ManorPos) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clampPos(pos))); } catch {}
}

function ManorGroup({
  pos,
  editMode,
  onPointerDown,
}: {
  pos: ManorPos;
  editMode: boolean;
  onPointerDown: (e: React.PointerEvent<SVGGElement>) => void;
}) {
  const [gateOpen, setGateOpen] = useState(false);
  const [limoInside, setLimoInside] = useState(false);

  useEffect(() => {
    const onArrive = () => {
      setGateOpen(true);
      window.setTimeout(() => setLimoInside(true), 2000);
      window.setTimeout(() => setGateOpen(false), 4500);
    };
    const onLeave = () => {
      setGateOpen(true);
      window.setTimeout(() => setLimoInside(false), 1000);
      window.setTimeout(() => setGateOpen(false), 3500);
    };
    const onVisit = () => {
      setGateOpen(true);
      window.setTimeout(() => setGateOpen(false), 5000);
    };
    window.addEventListener("jce.baron.arrives", onArrive);
    window.addEventListener("jce.baron.leaves", onLeave);
    window.addEventListener("jce.baron.playervisit", onVisit);
    return () => {
      window.removeEventListener("jce.baron.arrives", onArrive);
      window.removeEventListener("jce.baron.leaves", onLeave);
      window.removeEventListener("jce.baron.playervisit", onVisit);
    };
  }, []);

  return (
    <g
      transform={`translate(${pos.x},${pos.y})`}
      onPointerDown={editMode ? onPointerDown : undefined}
      style={{ cursor: editMode ? "grab" : "default", pointerEvents: editMode ? "auto" : "none" }}
    >
      {editMode && (
        <g pointerEvents="none">
          <circle r={138} fill="rgba(250,204,21,0.08)" stroke="#facc15" strokeWidth={3} strokeDasharray="10 8" />
          <text x={0} y={-134} textAnchor="middle" fontSize={18} fontWeight="900" fill="#facc15" stroke="#111827" strokeWidth={0.8}>DÉPLACE LE MANOIR</text>
        </g>
      )}

      <ellipse cx={6} cy={112} rx={108} ry={14} fill="#000" opacity={0.3} />
      <rect x={-110} y={-58} width={220} height={170} rx={4} fill="#181009" stroke="#4a3018" strokeWidth={9} />
      {Array.from({ length: 14 }).map((_, i) => (
        <rect key={`cren-${i}`} x={-108 + i * 16} y={-63} width={9} height={6} fill="#4a3018" />
      ))}
      <rect x={-104} y={-52} width={208} height={158} rx={3} fill="#100b05" />

      {[[-92, -44], [-92, 96], [92, -44], [92, 96]].map(([bx, by], i) => (
        <g key={`bush-${i}`} transform={`translate(${bx},${by})`}>
          <ellipse rx={9} ry={7} fill="#2d4a1e" stroke="#1c3013" strokeWidth={1} />
          <ellipse cx={-2} cy={-2} rx={4} ry={3} fill="#3d5e2a" opacity={0.7} />
        </g>
      ))}

      <g transform="translate(-88,-20)">
        <rect x={-1.5} y={0} width={3} height={10} fill="#3d2a18" />
        <circle cy={-6} r={8} fill="#2d4a1e" stroke="#1c3013" strokeWidth={1} />
        <circle cx={-3} cy={-9} r={5} fill="#3a5a28" opacity={0.7} />
      </g>
      <g transform="translate(88,-20)">
        <rect x={-1.5} y={0} width={3} height={10} fill="#3d2a18" />
        <circle cy={-6} r={8} fill="#2d4a1e" stroke="#1c3013" strokeWidth={1} />
        <circle cx={3} cy={-9} r={5} fill="#3a5a28" opacity={0.7} />
      </g>

      <g transform="translate(0,80)">
        <ellipse cx={0} cy={3} rx={16} ry={6} fill="#1a2e3a" stroke="#3a5a6a" strokeWidth={1.5} />
        <ellipse cx={0} cy={1} rx={12} ry={4} fill="#2a4a5a" opacity={0.8} />
        <circle cx={0} cy={-3} r={3} fill="#5a7a8a" stroke="#3a5a6a" strokeWidth={1} />
        <line x1={0} y1={-3} x2={0} y2={-9} stroke="#6a9aaa" strokeWidth={1.2} opacity={0.85} />
      </g>

      <rect x={-78} y={-42} width={156} height={100} rx={3} fill="#2d1f0e" stroke="#8a6c3a" strokeWidth={2.4} />
      <rect x={-80} y={-44} width={160} height={5} rx={1} fill="#9a7a3a" opacity={0.85} />
      {[-72, -54, -36, -18, 0, 18, 36, 54, 68].map((x, i) => (
        <rect key={i} x={x} y={-38 + (i % 2) * 9} width={16} height={8} fill="none" stroke="#4a3018" strokeWidth={0.5} />
      ))}
      <rect x={-78} y={36} width={156} height={20} fill="#1a1006" opacity={0.6} />

      <polygon points="0,-62 -82,-42 82,-42" fill="#1a0f05" stroke="#8a6c3a" strokeWidth={1.8} />
      <circle cx={0} cy={-48} r={7} fill="#f0a830" opacity={0.9} stroke="#8a6c3a" strokeWidth={1.2} />
      <circle cx={0} cy={-48} r={3} fill="#fff3c4" opacity={0.6} />
      <line x1={0} y1={-62} x2={0} y2={-86} stroke="#5a3e1c" strokeWidth={1.5} />
      <path d="M 0 -84 L 20 -80 L 0 -74 Z" fill="#7f1d1d" stroke="#b8860b" strokeWidth={1} />
      <circle cx={0} cy={-86} r={2} fill="#d4a838" />

      {[-94, 94].map((tx, ti) => (
        <g key={ti}>
          <rect x={tx - 11} y={-46} width={22} height={104} rx={2} fill="#241608" stroke="#8a6c3a" strokeWidth={1.6} />
          {[0, 1, 2, 3].map(i => <rect key={i} x={tx - 10 + i * 6} y={-50} width={3.5} height={5} fill="#8a6c3a" />)}
          <polygon points={`${tx},-66 ${tx - 11},-46 ${tx + 11},-46`} fill="#160d04" stroke="#8a6c3a" strokeWidth={1.2} />
          <rect x={tx - 5} y={-10} width={10} height={14} rx={1} fill="#f0a830" opacity={0.7} />
        </g>
      ))}

      {[-48, -22, 4, 30].map((wx, i) => (
        <g key={i}>
          <rect x={wx - 2.5} y={-21} width={2.5} height={22} fill="#5a3e1c" opacity={0.7} />
          <rect x={wx + 15} y={-21} width={2.5} height={22} fill="#5a3e1c" opacity={0.7} />
          <rect x={wx} y={-20} width={15} height={20} rx={2} fill="#f0a830" opacity={0.8} />
          <line x1={wx + 7.5} y1={-20} x2={wx + 7.5} y2={0} stroke="#8a6c3a" strokeWidth={0.9} />
          <line x1={wx} y1={-10} x2={wx + 15} y2={-10} stroke="#8a6c3a" strokeWidth={0.7} />
        </g>
      ))}

      <rect x={-12} y={36} width={24} height={30} rx={2} fill="#0f0a05" stroke="#d4a838" strokeWidth={1.4} />
      <path d="M -12 36 A 12 12 0 0 1 12 36" fill="#1a0f05" stroke="#d4a838" strokeWidth={1.4} />
      <circle cx={7} cy={51} r={2.2} fill="#f0a830" />
      <rect x={-16} y={64} width={32} height={3} fill="#3a2a14" opacity={0.7} />
      <rect x={-14} y={67} width={28} height={3} fill="#2a1d0e" opacity={0.7} />

      <rect x={-8} y={70} width={16} height={48} fill="#2a1a08" />
      {Array.from({ length: 5 }).map((_, i) => <rect key={i} x={-7} y={72 + i * 9.5} width={14} height={1.3} fill="#4a3018" opacity={0.6} />)}

      {[-24, 24].map((lx, i) => (
        <g key={i}>
          <rect x={lx - 1.5} y={66} width={3} height={16} fill="#5a3e1c" />
          <rect x={lx - 4.5} y={57} width={9} height={11} rx={1} fill="#f0a830" opacity={0.92} />
          <circle cx={lx} cy={62} r={6} fill="#f0a830" opacity={0.18} />
        </g>
      ))}

      <rect x={-26} y={108} width={11} height={22} rx={1} fill="#5a3e1c" stroke="#8a6c3a" strokeWidth={1.1} />
      <circle cx={-20.5} cy={106} r={4.5} fill="#8a6c3a" />
      <rect x={15} y={108} width={11} height={22} rx={1} fill="#5a3e1c" stroke="#8a6c3a" strokeWidth={1.1} />
      <circle cx={20.5} cy={106} r={4.5} fill="#8a6c3a" />
      <g style={{ transformOrigin: "-14px 119px", transform: `rotate(${gateOpen ? -72 : 0}deg)`, transition: "transform 0.85s ease" }}>
        <rect x={-14} y={108} width={14} height={22} rx={1} fill="#3d2810" stroke="#d4a838" strokeWidth={1.1} />
        {[0, 1].map(i => <line key={i} x1={-11} y1={112 + i * 7.5} x2={-3} y2={112 + i * 7.5} stroke="#d4a838" strokeWidth={0.7} />)}
      </g>
      <g style={{ transformOrigin: "14px 119px", transform: `rotate(${gateOpen ? 72 : 0}deg)`, transition: "transform 0.85s ease" }}>
        <rect x={0} y={108} width={14} height={22} rx={1} fill="#3d2810" stroke="#d4a838" strokeWidth={1.1} />
        {[0, 1].map(i => <line key={i} x1={3} y1={112 + i * 7.5} x2={11} y2={112 + i * 7.5} stroke="#d4a838" strokeWidth={0.7} />)}
      </g>

      {limoInside && (
        <g transform="translate(42, 8)">
          <ellipse cx={0} cy={11} rx={24} ry={5} fill="#000" opacity={0.3} />
          <rect x={-22} y={-9} width={44} height={18} rx={4} fill="#150707" stroke="#8b0000" strokeWidth={1.3} />
          <rect x={-15} y={-7} width={11} height={9} rx={1} fill="#1e3a5f" opacity={0.75} />
          <rect x={4} y={-7} width={11} height={9} rx={1} fill="#1e3a5f" opacity={0.75} />
          <circle cx={-12} cy={9} r={3.5} fill="#1a1a1a" stroke="#555" strokeWidth={0.8} />
          <circle cx={12} cy={9} r={3.5} fill="#1a1a1a" stroke="#555" strokeWidth={0.8} />
        </g>
      )}

      {!editMode && (
        <g onClick={() => window.dispatchEvent(new CustomEvent("jce.baron.playervisit"))} style={{ cursor: "pointer", pointerEvents: "auto" }}>
          <rect x={-42} y={134} width={84} height={21} rx={5} fill="#7f1d1d" stroke="#d4a838" strokeWidth={1.3} opacity={0.96} />
          <text x={0} y={148.5} textAnchor="middle" fontSize={8.5} fill="#fbbf24" fontWeight="bold" style={{ fontFamily: "sans-serif" }}>🤝 RENDRE VISITE</text>
        </g>
      )}

      <text x={0} y={165} textAnchor="middle" fontSize={9.5} fontWeight="bold" fill="#d4a838" style={{ fontFamily: "serif", letterSpacing: 1.8 }}>MANOIR DU BARON</text>
    </g>
  );
}

export default function BaronManor() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef(false);
  const [pos, setPos] = useState<ManorPos>(() => loadPos());
  const [savedPos, setSavedPos] = useState<ManorPos>(() => loadPos());
  const [editMode, setEditMode] = useState(false);

  const toSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = pt.matrixTransform(ctm.inverse());
    return clampPos({ x: p.x, y: p.y });
  };

  const applyPointer = (clientX: number, clientY: number) => {
    const next = toSvg(clientX, clientY);
    if (next) setPos(next);
  };

  const startDrag = (e: React.PointerEvent<SVGGElement>) => {
    if (!editMode) return;
    dragRef.current = true;
    applyPointer(e.clientX, e.clientY);
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      applyPointer(e.clientX, e.clientY);
      e.preventDefault();
    };
    const onUp = () => { dragRef.current = false; };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    return () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
    };
  }, []);

  const validate = () => {
    const next = clampPos(pos);
    setPos(next);
    setSavedPos(next);
    savePos(next);
    setEditMode(false);
  };

  const cancel = () => {
    setPos(savedPos);
    setEditMode(false);
  };

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: editMode ? "auto" : "none", zIndex: 6 }}
      >
        <ManorGroup pos={pos} editMode={editMode} onPointerDown={startDrag} />
      </svg>

      <div
        style={{
          position: "absolute",
          left: 10,
          bottom: 10,
          zIndex: 80,
          display: "flex",
          gap: 6,
          pointerEvents: "auto",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {!editMode ? (
          <button
            type="button"
            onClick={() => setEditMode(true)}
            style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid #d4a838", background: "rgba(20,22,28,0.88)", color: "#facc15", fontWeight: 800, fontSize: 12 }}
          >
            🏰 Déplacer manoir
          </button>
        ) : (
          <>
            <button type="button" onClick={validate} style={{ padding: "7px 10px", borderRadius: 10, border: "none", background: "#facc15", color: "#111827", fontWeight: 900, fontSize: 12 }}>
              ✓ Valider position
            </button>
            <button type="button" onClick={cancel} style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid #555", background: "rgba(20,22,28,0.9)", color: "#e5e7eb", fontWeight: 800, fontSize: 12 }}>
              Annuler
            </button>
          </>
        )}
      </div>
    </>
  );
}
