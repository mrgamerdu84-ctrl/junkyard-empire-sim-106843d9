import { useState } from "react";

export default function TaxiRadio(){
  const [open,setOpen] = useState(false);
  
  return (
    <div style={{position:"fixed",bottom:14,right:14,zIndex:9999}}>
      <button 
        onClick={()=>setOpen(!open)}
        style={{padding:"10px 16px",background:"#eab308",border:"none",borderRadius:30,fontWeight:"bold"}}
      >
        🚖 Radio
      </button>
      {open && (
        <div style={{background:"#111",color:"#fff",padding:12,marginTop:8,borderRadius:8}}>
          <div>Radio désactivée temporairement</div>
          <div style={{fontSize:12,opacity:.7,marginTop:4}}>On répare le build</div>
        </div>
      )}
    </div>
  );
}
