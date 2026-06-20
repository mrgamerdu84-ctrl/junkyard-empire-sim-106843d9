import { useState } from "react";

const STATIONS = [
  {id:"main",name:"Junky Empire Taxi",emoji:"🚖"},
  {id:"jce",name:"Junky City Empire",emoji:"🎵"},
  {id:"iron",name:"Iron Tooth",emoji:"🦷"},
  {id:"infos",name:"Junky Infos",emoji:"📰"},
  {id:"pop",name:"Radio Pop",emoji:"🎤"},
  {id:"electro",name:"Radio Electro",emoji:"🎧"},
  {id:"rock",name:"Radio Rock",emoji:"🎸"},
  {id:"emotions",name:"Radio Émotions",emoji:"💖"},
  {id:"kids",name:"Radio Kids",emoji:"🧸"},
];

export default function TaxiRadio() {
  const [open,setOpen]=useState(false);
  const [station,setStation]=useState("main");
  
  return (
    <div style={{position:"fixed",bottom:12,right:12,zIndex:9999}}>
      <button onClick={()=>setOpen(!open)} style={{padding:8,background:"#eab308",border:"none",borderRadius:20}}>
        {STATIONS.find(s=>s.id===station)?.emoji} Radio
      </button>
      {open && (
        <div style={{background:"#111",color:"#fff",padding:10,marginTop:6,borderRadius:8}}>
          {STATIONS.map(s=>(
            <button key={s.id} onClick={()=>setStation(s.id)} style={{display:"block",width:"100%",textAlign:"left",background:"none",color:"#fff",border:"none",padding:4}}>
              {s.emoji} {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
