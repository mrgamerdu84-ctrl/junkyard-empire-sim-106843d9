import { useEffect, useRef, useState } from "react";
import { GAME_ASSETS } from "@/game/gameAssets";
import junkyCityEmpireAsset from "@/assets/junky_city_empire.mp3.asset.json";
import ironToothAsset from "@/assets/iron_tooth.mp3.asset.json";

type Station = { id:string; name:string; emoji:string; url:string };

const STATIONS: Station[] = [
  {id:"main",name:"Junky Empire Taxi",emoji:"🚖",url:GAME_ASSETS["audio.music"]},
  {id:"jce",name:"Junky City Empire",emoji:"🎵",url:junkyCityEmpireAsset.url},
  {id:"iron",name:"Iron Tooth",emoji:"🦷",url:ironToothAsset.url},
  // Musiques 100% libres de droits (Pixabay)
  {id:"pop",name:"Radio Pop",emoji:"🎤",url:"https://cdn.pixabay.com/download/audio/2022/03/15/audio_c3b4a6e3d8.mp3"},
  {id:"electro",name:"Radio Electro",emoji:"🎧",url:"https://cdn.pixabay.com/download/audio/2022/03/24/audio_8cb9636a3f.mp3"},
  {id:"rock",name:"Radio Rock",emoji:"🎸",url:"https://cdn.pixabay.com/download/audio/2022/05/27/audio_3e6a3e1a6a.mp3"},
];

export default function TaxiRadio(){
  const audioRef = useRef<HTMLAudioElement>(null);
  const [id,setId] = useState("main");
  const [open,setOpen] = useState(false);

  useEffect(()=>{
    const a = audioRef.current;
    const s = STATIONS.find(x=>x.id===id);
    if(a && s){ a.src=s.url; a.loop=true; a.volume=0.5; a.play().catch(()=>{}); }
    localStorage.setItem("taxi.station",id);
  },[id]);

  useEffect(()=>{ const saved=localStorage.getItem("taxi.station"); if(saved) setId(saved); },[]);

  return (
    <>
      <audio ref={audioRef} preload="none" />
      <div style={{position:"fixed",bottom:14,right:14,zIndex:9999}}>
        <button onClick={()=>setOpen(o=>!o)} style={{padding:"10px 14px",background:"#eab308",border:"none",borderRadius:30,fontWeight:700}}>
          {STATIONS.find(s=>s.id===id)?.emoji} {STATIONS.find(s=>s.id===id)?.name}
        </button>
        {open && (
          <div style={{background:"#0f172a",color:"#fff",padding:12,marginTop:8,borderRadius:12,width:240,boxShadow:"0 8px 24px rgba(0,0,0,.4)"}}>
            {STATIONS.map(s=>(
              <button key={s.id} onClick={()=>setId(s.id)} style={{display:"flex",width:"100%",gap:8,alignItems:"center",background:s.id===id?"#eab308":"transparent",color:s.id===id?"#000":"#fff",border:"none",padding:"8px",borderRadius:8,marginBottom:4,cursor:"pointer"}}>
                <span>{s.emoji}</span><span>{s.name}</span>
              </button>
            ))}
            <div style={{fontSize:11,opacity:.6,marginTop:8,textAlign:"center"}}>musiques libres Pixabay</div>
          </div>
        )}
      </div>
    </>
  );
}
