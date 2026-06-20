import { useEffect, useRef, useState } from "react";
import { GAME_ASSETS } from "@/game/gameAssets";
import type { RadioNews } from "@/lib/radioNews";
import junkyCityEmpireAsset from "@/assets/junky_city_empire.mp3.asset.json";
import ironToothAsset from "@/assets/iron_tooth.mp3.asset.json";

const VOIE_DROITE = [{x:10,y:52},{x:85,y:52},{x:85,y:48},{x:10,y:48}];
const VOIE_GAUCHE = [{x:85,y:58},{x:10,y:58},{x:10,y:54},{x:85,y:54}];

type Voiture = {id:string;voie:"droite"|"gauche";indexEtape:number;x:number;y:number;vitesse:number};
type Station = {id:string;name:string;emoji:string;url?:string;loop?:boolean;volume?:number;tts?:boolean};

const STATIONS: Station[] = [
  {id:"main",name:"Junky Empire Taxi",emoji:"🚖",url:GAME_ASSETS["audio.music"],loop:true,volume:0.4},
  {id:"jce",name:"Junky City Empire",emoji:"🎵",url:junkyCityEmpireAsset.url,loop:true,volume:0.6},
  {id:"iron",name:"Iron Tooth",emoji:"🦷",url:ironToothAsset.url,loop:true,volume:0.6},
  {id:"infos",name:"Junky Infos",emoji:"📰",tts:true},
  {id:"pop",name:"Radio Pop",emoji:"🎤",url:"/audio/pop.mp3",loop:true,volume:0.5},
  {id:"electro",name:"Radio Electro",emoji:"🎧",url:"/audio/electro.mp3",loop:true,volume:0.5},
  {id:"rock",name:"Radio Rock",emoji:"🎸",url:"/audio/rock.mp3",loop:true,volume:0.5},
  {id:"emotions",name:"Radio Émotions",emoji:"💖",url:"/audio/chill.mp3",loop:true,volume:0.5},
  {id:"kids",name:"Radio Kids",emoji:"🧸",url:"/audio/kids.mp3",loop:true,volume:0.5},
];

const DJ_LINES: Record<string,RadioNews[]> = {
  main:[{fr:"Bienvenue à bord!",en:"Welcome aboard!"}],
  jce:[{fr:"Junky City Empire en direct",en:"Junky City live"}],
  iron:[{fr:"Iron Tooth, ça envoie",en:"Iron Tooth rocks"}],
  infos:[{fr:"Les infos trafic",en:"Traffic news"}],
  pop:[{fr:"Radio Pop!",en:"Pop Radio!"}],
  electro:[{fr:"Electro à fond",en:"Electro time"}],
  rock:[{fr:"Du rock!",en:"Rock on!"}],
  emotions:[{fr:"Douceur",en:"Smooth vibes"}],
  kids:[{fr:"Pour les enfants",en:"For kids"}],
};

export default function TaxiRadio(){
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const [stationId,setStationId]=useState("main");
  const [open,setOpen]=useState(false);
  const [paused,setPaused]=useState(false);
  const [lang,setLang]=useState<"fr"|"en">("fr");
  const [ticker,setTicker]=useState("");
  const [voitures,setVoitures]=useState<Voiture[]>([]);
  const langRef=useRef(lang);
  const djRef=useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(()=>{ langRef.current=lang; },[lang]);

  useEffect(()=>{
    setStationId(localStorage.getItem("mttw.taxiRadio")||"main");
    setLang((localStorage.getItem("mttw.lang") as any)||"fr");
  },[]);

  const speak=(news:RadioNews,cb?:()=>void)=>{
    const txt=langRef.current==="en"?news.en:news.fr;
    setTicker(txt); setTimeout(()=>setTicker(""),6000);
    if(!("speechSynthesis"in window)){cb?.();return;}
    const s=window.speechSynthesis; s.cancel();
    const u=new SpeechSynthesisUtterance(txt);
    u.lang=langRef.current==="en"?"en-US":"fr-FR";
    u.onend=()=>cb?.(); s.speak(u);
  };

  useEffect(()=>{
    const a=audioRef.current; const st=STATIONS.find(s=>s.id===stationId); if(!a||!st) return;
    if(djRef.current) clearInterval(djRef.current);
    if(st.tts){a.pause(); return;}
    if(st.url){
      a.src=st.url; a.loop=true; a.volume=st.volume||0.5;
      if(!paused) a.play().catch(()=>{});
      const dj=()=>{const l=DJ_LINES[st.id]?.[0]; if(l){const v=a.volume;a.volume=v*0.4;speak(l,()=>a.volume=v)}};
      setTimeout(dj,1200); djRef.current=setInterval(dj,45000);
    }
  },[stationId,paused]);

  useEffect(()=>{
    const id=setInterval(()=>{setVoitures(p=>p.length>=8?p:[...p,(()=>{const d=Math.random()>0.5;const pts=d?VOIE_DROITE:VOIE_GAUCHE;const s=Math.floor(Math.random()*pts.length);return{id:Math.random().toString(36).slice(2),voie:d?"droite":"gauche",indexEtape:s,x:pts[s].x,y:pts[s].y,vitesse:0.8+Math.random()*0.6}})()])},2000);return()=>clearInterval(id);
  },[]);
  useEffect(()=>{
    const id=setInterval(()=>{setVoitures(p=>p.map(v=>{const pts=v.voie==="droite"?VOIE_DROITE:VOIE_GAUCHE;let i=v.indexEtape;let c=pts[i];const d=Math.hypot(c.x-v.x,c.y-v.y);if(d<1.2){i=(i+1)%pts.length;c=pts[i]}const nd=Math.hypot(c.x-v.x,c.y-v.y)||1;return{...v,x:v.x+(c.x-v.x)/nd*v.vitesse,y:v.y+(c.y-v.y)/nd*v.vitesse,indexEtape:i}}))},45);return()=>clearInterval(id);
  },[]);

  return(<>
    <audio ref={audioRef}/>
    <div style={{position:"fixed",bottom:12,right:12,zIndex:9999}}>
      <button onClick={()=>setOpen(!open)} style={{padding:8,background:"#eab308",border:"none",borderRadius:20}}>{STATIONS.find(s=>s.id===stationId)?.emoji}</button>
      {open&&<div style={{background:"#111",color:"#fff",padding:10,marginTop:6,borderRadius:8,width:240}}>
        <div style={{display:"flex",gap:4}}><button onClick={()=>{const n=lang==="fr"?"en":"fr";setLang(n);localStorage.setItem("mttw.lang",n)}} style={{flex:1}}>{lang}</button><button onClick={()=>setPaused(p=>!p)} style={{flex:1}}>{paused?"▶":"⏸"}</button></div>
        {STATIONS.map(s=><button key={s.id} onClick={()=>{setStationId(s.id);localStorage.setItem("mttw.taxiRadio",s.id)}} style={{display:"block",width:"100%",textAlign:"left",background:"none",color:"#fff",border:"none",padding:4}}>{s.emoji} {s.name}</button>)}
        {ticker&&<div style={{marginTop:6,fontSize:11,color:"#ffc107"}}>{ticker}</div>}
        <div style={{marginTop:6,fontSize:10,opacity:0.7}}>🚗 {voitures.length} voitures</div>
      </div>}
    </div>
  </>);
    }
