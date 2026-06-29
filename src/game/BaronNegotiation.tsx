import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

let lastVisitMs = 0;
const COOLDOWN_MS = 8 * 60 * 1000;

export default function BaronNegotiation({ playerMoney, onDeal }: { playerMoney: number; onDeal: (amount: number) => void }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"nego"|"wait"|"done"|"refused">("nego");
  const [offer, setOffer] = useState(0);
  const [waitMsg, setWaitMsg] = useState("");
  useEffect(() => {
    const onVisit = () => {
      const now = Date.now();
      const left = lastVisitMs + COOLDOWN_MS - now;
      if (left > 0) { setWaitMsg(`Le baron n'est pas disponible. Revenez dans ${Math.ceil(left/60000)} min.`); setPhase("wait"); setOpen(true); return; }
      const amount = Math.min(5000, Math.max(500, Math.round((playerMoney||2000) * (0.15 + Math.random()*0.10))));
      setOffer(amount); setPhase("nego"); setOpen(true);
    };
    window.addEventListener("jce.baron.playervisit", onVisit);
    return () => window.removeEventListener("jce.baron.playervisit", onVisit);
  }, [playerMoney]);
  if (!open) return null;
  const close = () => setOpen(false);
  const accept = () => { lastVisitMs = Date.now(); onDeal(offer); setPhase("done"); setTimeout(close, 3000); };
  const refuse = () => { lastVisitMs = Date.now(); window.dispatchEvent(new CustomEvent("jce.baron.retaliation")); setPhase("refused"); setTimeout(close, 3000); };
  return createPortal(
    <div style={{ position:"fixed",inset:0,zIndex:9100,background:"radial-gradient(ellipse at center,#1a0a0a,#000 75%)",display:"flex",alignItems:"center",justifyContent:"center" }} onClick={close}>
      <div style={{ width:340,borderRadius:14,background:"linear-gradient(155deg,#1c1008,#0d0804)",border:"2px solid #b8860b",boxShadow:"0 0 50px #b8860b44,inset 0 0 24px #00000099",padding:"26px 28px",color:"#e8d5a3",fontFamily:"serif",position:"relative" }} onClick={e=>e.stopPropagation()}>
        <div style={{position:"absolute",top:10,right:14,fontSize:38,opacity:0.07,userSelect:"none"}}>⚜</div>
        <div style={{textAlign:"center",marginBottom:14}}>
          <div style={{fontSize:30,marginBottom:4}}>🏛️</div>
          <div style={{fontSize:14,fontWeight:"bold",color:"#b8860b",letterSpacing:2}}>MANOIR DU BARON</div>
          <div style={{fontSize:10,color:"#6b5128",marginTop:2}}>— Salle de réception privée —</div>
        </div>
        <hr style={{border:"none",borderTop:"1px solid #3d2810",margin:"12px 0"}} />
        {phase==="nego" && (<>
          <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:14}}>
            <div style={{width:64,height:64,borderRadius:8,flexShrink:0,background:"#1a0f05",border:"2px solid #7a5c30",display:"flex",alignItems:"center",justifyContent:"center",fontSize:34}}>🎩</div>
            <div style={{background:"#0d0804",border:"1px solid #3d2810",borderRadius:8,padding:"10px 12px",flex:1,fontSize:11,lineHeight:1.65,color:"#d4b896",fontStyle:"italic"}}>
              « Mon ami... j'ai su que vos affaires prospèrent. La famille mérite sa part — {offer.toLocaleString()}$ par mois. C'est une offre... raisonnable. »
            </div>
          </div>
          <div style={{background:"#1a0f05",borderRadius:8,border:"1px solid #3d2810",padding:"10px 14px",marginBottom:14,fontSize:12,color:"#9a7a4a",textAlign:"center"}}>
            💰 Montant réclamé : <span style={{color:"#f59e0b",fontWeight:"bold",fontSize:16}}>{offer.toLocaleString()} $</span>
          </div>
          <div style={{display:"flex",gap:10,marginBottom:10}}>
            <button onClick={accept} style={{flex:1,padding:"10px 0",borderRadius:8,border:"2px solid #b8860b",background:"linear-gradient(180deg,#3d2810,#1a0f05)",color:"#f59e0b",fontWeight:"bold",fontSize:13,cursor:"pointer",fontFamily:"serif"}}>✅ Accepter</button>
            <button onClick={refuse} style={{flex:1,padding:"10px 0",borderRadius:8,border:"2px solid #5a1a1a",background:"linear-gradient(180deg,#2d0a0a,#1a0505)",color:"#ef4444",fontWeight:"bold",fontSize:13,cursor:"pointer",fontFamily:"serif"}}>❌ Refuser</button>
          </div>
          <div style={{fontSize:10,color:"#4a3520",textAlign:"center"}}>⚠ Refuser peut déclencher des représailles de la famille</div>
        </>)}
        {phase==="wait" && <div style={{textAlign:"center",padding:"20px 0",color:"#9a7a4a",fontSize:13}}>🚪 {waitMsg}<div style={{marginTop:16}}><button onClick={close} style={{padding:"8px 24px",borderRadius:8,border:"1px solid #3d2810",background:"#1a0f05",color:"#b8860b",cursor:"pointer"}}>Partir</button></div></div>}
        {phase==="done" && <div style={{textAlign:"center",padding:"20px 0",color:"#f59e0b",fontSize:14}}>🤝 Accord conclu. {offer.toLocaleString()}$ versés au baron.</div>}
        {phase==="refused" && <div style={{textAlign:"center",padding:"20px 0"}}><div style={{color:"#ef4444",fontSize:14,marginBottom:8}}>⚔️ Le baron n'apprécie pas votre refus...</div><div style={{color:"#9a4a4a",fontSize:11}}>Des représailles approchent.</div></div>}
      </div>
    </div>,
    document.body
  );
}
