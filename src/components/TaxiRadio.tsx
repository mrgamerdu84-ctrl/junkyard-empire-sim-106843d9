import { useEffect, useRef, useState } from "react";
import { GAME_ASSETS } from "@/game/gameAssets";
import { AMBIENT_NEWS, WELCOME_JINGLE, type RadioNews } from "@/lib/radioNews";
import junkyCityEmpireAsset from "@/assets/junky_city_empire.mp3.asset.json";
import ironToothAsset from "@/assets/iron_tooth.mp3.asset.json";

type Station = {
  id: string; name: string; emoji: string;
  url?: string; loop?: boolean; volume?: number; tts?: boolean;
};

const STATIONS: Station[] = [
  { id:"main", name:"Junky Empire Taxi", emoji:"🚖", url:GAME_ASSETS["audio.music"], loop:true, volume:0.4 },
  { id:"jce", name:"Junky City Empire", emoji:"🎵", url:junkyCityEmpireAsset.url, loop:true, volume:0.6 },
  { id:"iron", name:"Iron Tooth", emoji:"🦷", url:ironToothAsset.url, loop:true, volume:0.6 },
  { id:"infos", name:"Junky Infos", emoji:"📰", tts:true },
  { id:"pop", name:"Radio Pop", emoji:"🎤", url:"https://ice1.somafm.com/poptron-128-mp3", volume:0.5 },
  { id:"electro", name:"Radio Electro", emoji:"🎧", url:"https://ice1.somafm.com/groovesalad-128-mp3", volume:0.5 },
  { id:"rock", name:"Radio Rock", emoji:"🎸", url:"https://ice6.somafm.com/thetrip-128-mp3", volume:0.5 },
  { id:"emotions", name:"Radio Émotions", emoji:"💖", url:"https://ice1.somafm.com/lush-128-mp3", volume:0.5 },
  { id:"kids", name:"Radio Kids", emoji:"🧸", url:"https://ice1.somafm.com/fluid-128-mp3", volume:0.5 },
];

const STORAGE_KEY = "mttw.taxiRadio";
const LANG_KEY = "mttw.lang";
const DJ_FIRST_DELAY_MS = 1200;

const readPref = () => { try { return localStorage.getItem(STORAGE_KEY)?? "main"; } catch { return "main"; } };
const readLang = ():"fr"|"en" => { try { return localStorage.getItem(LANG_KEY)==="en"?"en":"fr"; } catch { return "fr"; } };

function pickVoice(lang:"fr"|"en") {
  if (typeof window==="undefined" ||!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const want = lang==="fr"?"fr":"en";
  return voices.find(v=>v.lang?.toLowerCase().startsWith(want+"-")) || voices.find(v=>v.lang?.toLowerCase().startsWith(want)) || null;
}

export default function TaxiRadio() {
  const audioRef = useRef<HTMLAudioElement|null>(null);
  const [stationId, setStationId] = useState("main");
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [lang, setLang] = useState<"fr"|"en">("fr");
  const langRef = useRef<"fr"|"en">("fr");
  const [ticker, setTicker] = useState("");
  const [newsHour, setNewsHour] = useState(false);
  const [weather, setWeather] = useState<{tempC:number;city:string}|null>(null);

  const ambientRef = useRef<number|null>(null);
  const djRef = useRef<number|null>(null);
  const ttsRef = useRef<HTMLAudioElement|null>(null);
  const sessionRef = useRef(0);
  const idxRef = useRef(0);

  useEffect(()=>{ langRef.current = lang; }, [lang]);

  // init
  useEffect(()=>{
    setStationId(readPref());
    const l = readLang(); setLang(l); langRef.current=l; setReady(true);
    if (typeof window!=="undefined" && "speechSynthesis" in window) {
      try { window.speechSynthesis.getVoices(); } catch {}
    }
  },[]);

  // news hour
  useEffect(()=>{
    const tick = ()=> setNewsHour(new Date().getMinutes()<10);
    tick(); const id = setInterval(tick, 30000); return ()=>clearInterval(id);
  },[]);

  const showTicker = (t:string)=>{ setTicker(t); setTimeout(()=>setTicker(""),8000); };

  const speak = async (news:RadioNews, done?:()=>void) => {
    const l = langRef.current; const text = l==="en"?news.en:news.fr; showTicker(text);
    const finish = ()=>{ done?.(); };
    const speakBrowser = ()=>{
      if (typeof window==="undefined" ||!("speechSynthesis" in window)) { finish(); return; }
      const s = window.speechSynthesis; try { s.cancel(); } catch {}
      const u = new SpeechSynthesisUtterance(text); u.lang = l==="en"?"en-US":"fr-FR"; const v = pickVoice(l); if(v) u.voice=v;
      u.onend = finish; u.onerror = finish;
      const go = ()=> setTimeout(()=>{ try{s.speak(u);}catch{finish();} },70);
      const vs = s.getVoices?.()||[]; if(!vs.length){ s.onvoiceschanged=()=>{s.onvoiceschanged=null; go();}; } else go();
    };
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.auth.getSession(); const token = data?.session?.access_token;
      if(!token){ speakBrowser(); return; }
      const r = await fetch("/api/public/radio-tts",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({text,lang:l})});
      if(!r.ok){ speakBrowser(); return; }
      const b = await r.blob(); const url = URL.createObjectURL(b); const a = new Audio(url); ttsRef.current=a;
      a.onended=()=>{ URL.revokeObjectURL(url); finish(); }; a.onerror=finish; await a.play();
    } catch { speakBrowser(); }
  };

  const djLine = (name:string):RadioNews => {
    const d=new Date(); const t=`${d.getHours()}h${String(d.getMinutes()).padStart(2,"0")}`;
    return { fr:`Il est ${t} sur ${name}!`, en:`It's ${t} on ${name}!` };
  };

  // stations
  useEffect(()=>{
    if(!ready) return; const a = audioRef.current; const st = STATIONS.find(s=>s.id===stationId); if(!a||!st) return;
    if (ambientRef.current) { clearInterval(ambientRef.current); ambientRef.current=null; }
    if (djRef.current) { clearTimeout(djRef.current); djRef.current=null; }
    if (typeof window!=="undefined" && "speechSynthesis" in window) { try{ speechSynthesis.cancel(); }catch{} }

    if (st.tts || newsHour) {
      a.pause();
      speak(WELCOME_JINGLE);
      ambientRef.current = window.setInterval(()=>{ const n = AMBIENT_NEWS[idxRef.current++ % AMBIENT_NEWS.length]; speak(n); }, 18000);
      return;
    }

    if (st.url) {
      sessionRef.current++; const sess = sessionRef.current;
      a.src = st.url; a.loop = st.loop??true; a.volume = st.volume??0.5;
      if (!paused) {
        a.play().catch(()=>{});
        djRef.current = window.setTimeout(()=>{
          if (sessionRef.current!==sess) return;
          const prev = a.volume; a.volume = prev*0.4;
          speak(djLine(st.name), ()=>{ a.volume = prev; });
        }, DJ_FIRST_DELAY_MS);
      }
    }
  }, [stationId, ready, newsHour, paused]);

  return (
    <>
      <audio ref={audioRef} />
      <div style={{position:"fixed",bottom:12,right:12,zIndex:9999}}>
        <button onClick={()=>setOpen(o=>!o)}>{STATIONS.find(s=>s.id===stationId)?.emoji} Radio</button>
        {open && (
          <div style={{background:"#111",color:"#fff",padding:10,marginTop:6,borderRadius:8,width:240}}>
            <div style={{display:"flex",gap:6,marginBottom:6}}>
              <button onClick={()=>{const n=lang==="fr"?"en":"fr"; setLang(n); localStorage.setItem(LANG_KEY,n);}} style={{flex:1}}>{lang.toUpperCase()}</button>
              <button onClick={()=>setPaused(p=>!p)} style={{flex:1}}>{paused?"▶️":"⏸️"}</button>
            </div>
            {STATIONS.map(s=>(
              <button key={s.id} onClick={()=>{ setStationId(s.id); localStorage.setItem(STORAGE_KEY,s.id); }} style={{display:"block",width:"100%",textAlign:"left",background:"none",color:"#fff",opacity:s.id===stationId?1:0.6,border:"none",padding:"4px 0"}}>
                {s.emoji} {s.name}
              </button>
            ))}
            {ticker && <div style={{marginTop:6,fontSize:12,opacity:0.8}}>{ticker}</div>}
          </div>
        )}
      </div>
    </>
  );
                                         }
