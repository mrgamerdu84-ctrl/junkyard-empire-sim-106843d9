import { useEffect, useState } from "react";

const MAP_W = 1920;
const MAP_H = 1080;
const MX = 200, MY = 150;

function ManorGroup() {
  const [gateOpen, setGateOpen] = useState(false);
  const [limoInside, setLimoInside] = useState(false);
  useEffect(() => {
    const onArrive = () => { setGateOpen(true); setTimeout(() => setLimoInside(true), 2000); setTimeout(() => setGateOpen(false), 4500); };
    const onLeave = () => { setGateOpen(true); setTimeout(() => setLimoInside(false), 1000); setTimeout(() => setGateOpen(false), 3500); };
    const onVisit = () => { setGateOpen(true); setTimeout(() => setGateOpen(false), 5000); };
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
    <g transform={`translate(${MX},${MY})`}>
      <rect x={-160} y={-60} width={320} height={230} rx={5} fill="none" stroke="#5a3e28" strokeWidth={12} />
      <rect x={-154} y={-54} width={308} height={218} rx={3} fill="#1a1208" opacity={0.88} />
      <rect x={-108} y={-38} width={216} height={128} rx={3} fill="#2d1f0e" stroke="#7a5c30" strokeWidth={2.5} />
      {[-100,-80,-60,-40,-20,0,20,40,60,80].map((x,i) => (
        <rect key={i} x={x} y={-38+((i%2)*10)} width={18} height={9} fill="none" stroke="#4a3018" strokeWidth={0.6} />
      ))}
      <polygon points="0,-72 -114,-38 114,-38" fill="#1a0f05" stroke="#7a5c30" strokeWidth={2} />
      <circle cx={0} cy={-52} r={8} fill="#f59e0b" opacity={0.85} stroke="#7a5c30" strokeWidth={1.5} />
      <rect x={-132} y={-52} width={28} height={142} rx={2} fill="#231508" stroke="#6b5128" strokeWidth={2} />
      <polygon points="-118,-78 -132,-52 -104,-52" fill="#150d04" stroke="#6b5128" strokeWidth={1.5} />
      <rect x={-122} y={-8} width={12} height={16} rx={1} fill="#f59e0b" opacity={0.65} />
      <rect x={104} y={-52} width={28} height={142} rx={2} fill="#231508" stroke="#6b5128" strokeWidth={2} />
      <polygon points="118,-78 104,-52 132,-52" fill="#150d04" stroke="#6b5128" strokeWidth={1.5} />
      <rect x={108} y={-8} width={12} height={16} rx={1} fill="#f59e0b" opacity={0.65} />
      {[-65,-30,5,40].map((wx,i) => (
        <g key={i}>
          <rect x={wx} y={-18} width={20} height={26} rx={2} fill="#f59e0b" opacity={0.75} />
          <line x1={wx+10} y1={-18} x2={wx+10} y2={8} stroke="#b8860b" strokeWidth={1} />
          <line x1={wx} y1={-5} x2={wx+20} y2={-5} stroke="#b8860b" strokeWidth={0.8} />
        </g>
      ))}
      <rect x={-16} y={52} width={32} height={38} rx={3} fill="#0f0a05" stroke="#b8860b" strokeWidth={1.5} />
      <path d="M -16 52 A 16 16 0 0 1 16 52" fill="#1a0f05" stroke="#b8860b" strokeWidth={1.5} />
      <circle cx={8} cy={70} r={2.5} fill="#f59e0b" />
      <rect x={-10} y={90} width={20} height={75} fill="#2a1a08" />
      {[0,1,2,3,4,5,6].map(i => <rect key={i} x={-9} y={92+i*10} width={18} height={1.5} fill="#3d2e18" opacity={0.6} />)}
      <rect x={-28} y={85} width={3} height={18} fill="#5a3e28" />
      <rect x={-32} y={75} width={11} height={12} rx={1} fill="#f59e0b" opacity={0.9} />
      <rect x={25} y={85} width={3} height={18} fill="#5a3e28" />
      <rect x={20} y={75} width={11} height={12} rx={1} fill="#f59e0b" opacity={0.9} />
      <rect x={-32} y={143} width={14} height={28} rx={1} fill="#5a3e28" stroke="#7a5c30" strokeWidth={1.5} />
      <circle cx={-25} cy={141} r={5.5} fill="#7a5c30" />
      <rect x={18} y={143} width={14} height={28} rx={1} fill="#5a3e28" stroke="#7a5c30" strokeWidth={1.5} />
      <circle cx={25} cy={141} r={5.5} fill="#7a5c30" />
      <g style={{ transformOrigin: "-18px 155px", transform: `rotate(${gateOpen ? -75 : 0}deg)`, transition: "transform 0.8s ease" }}>
        <rect x={-18} y={143} width={18} height={28} rx={1} fill="#3d2810" stroke="#b8860b" strokeWidth={1.5} />
        {[0,1,2].map(i => <line key={i} x1={-15} y1={148+i*8} x2={-3} y2={148+i*8} stroke="#b8860b" strokeWidth={0.8} />)}
      </g>
      <g style={{ transformOrigin: "18px 155px", transform: `rotate(${gateOpen ? 75 : 0}deg)`, transition: "transform 0.8s ease" }}>
        <rect x={0} y={143} width={18} height={28} rx={1} fill="#3d2810" stroke="#b8860b" strokeWidth={1.5} />
        {[0,1,2].map(i => <line key={i} x1={3} y1={148+i*8} x2={15} y2={148+i*8} stroke="#b8860b" strokeWidth={0.8} />)}
      </g>
      {limoInside && (
        <g transform="translate(55,20)">
          <rect x={-26} y={-10} width={52} height={20} rx={4} fill="#1a0a0a" stroke="#8b0000" strokeWidth={1.5} />
          <rect x={-18} y={-8} width={14} height={10} rx={1} fill="#1e3a5f" opacity={0.7} />
          <rect x={4} y={-8} width={14} height={10} rx={1} fill="#1e3a5f" opacity={0.7} />
          <circle cx={-14} cy={10} r={4} fill="#222" stroke="#555" strokeWidth={1} />
          <circle cx={14} cy={10} r={4} fill="#222" stroke="#555" strokeWidth={1} />
        </g>
      )}
      <g onClick={() => window.dispatchEvent(new CustomEvent("jce.baron.playervisit"))} style={{ cursor: "pointer", pointerEvents: "auto" }}>
        <rect x={-46} y={162} width={92} height={24} rx={5} fill="#7f1d1d" stroke="#b8860b" strokeWidth={1.5} opacity={0.95} />
        <text x={0} y={178} textAnchor="middle" fontSize={9} fill="#fbbf24" fontWeight="bold" style={{ fontFamily: "sans-serif" }}>🤝 RENDRE VISITE</text>
      </g>
      <text x={0} y={198} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#b8860b" style={{ fontFamily: "serif", letterSpacing: 2 }}>MANOIR DU BARON</text>
    </g>
  );
}

export default function BaronManor() {
  return (
    <svg
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 6 }}
    >
      <ManorGroup />
    </svg>
  );
}
