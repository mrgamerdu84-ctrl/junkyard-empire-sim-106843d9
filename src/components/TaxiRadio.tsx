import { useEffect, useRef, useState } from "react";
import { GAME_ASSETS } from "@/game/gameAssets";
import { AMBIENT_NEWS, WELCOME_JINGLE, type RadioNews } from "@/lib/radioNews";
import junkyCityEmpireAsset from "@/assets/junky_city_empire.mp3.asset.json";
import ironToothAsset from "@/assets/iron_tooth.mp3.asset.json";

const VOIE_DROITE = [{ x:10,y:50 },{ x:50,y:50 },{ x:90,y:50 }];
const VOIE_GAUCHE = [{ x:90,y:56 },{ x:50,y:56 },{ x:10,y:56 }];

type Voiture = { id:string; voie:"droite"|"gauche"; indexEtape:number; x:number; y:number; vitesse:number; };
type Station = { id:string; name:string; emoji:string; url?:string; loop?:boolean; volume?:number; tts?:boolean; };

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

const readPref = () => { try { return localStorage.getItem(STORAGE_KEY)??"main"; } catch { return "main"; } };
const readLang = ():"fr"|"en" => { try { return localStorage.getItem(LANG_KEY)==="en"?"en":"fr"; } catch { return "fr"; } };

function pickVoice(lang:"fr"|"en") {
  if (typeof window==="undefined" ||!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices()||[];
  const want = lang==="fr"?"fr":"en";
  return voices.find(v=>v.lang?.toLowerCase().startsWith(want+"-"))||voices.find(v=>v.lang?.toLowerCase().startsWith(want))||null;
}

export default function TaxiRadio() {
  const audioRef = useRef<HTMLAudioElement|null>(null);
  const [stationId,setStationId]=useState("main");
  const [open,setOpen]=useState(false);
  const [ready,setReady]=useState(false);
  const [paused,setPaused]=useState(false);
  const [lang,setLang]=useState<"fr"|"en">("fr");
  const langRef=useRef<"fr"|"en">("fr");
  const [ticker,setTicker]=useState("");
  const [newsHour,setNewsHour]=useState(false);
  const [voitures,setVoitures]=useState<Voiture[]>([]);

  const ambientRef=useRef<number|null
