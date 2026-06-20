import { useEffect, useRef, useState } from "react";
import { GAME_ASSETS } from "@/game/gameAssets";
import { type RadioNews } from "@/lib/radioNews";
import junkyCityEmpireAsset from "@/assets/junky_city_empire.mp3.asset.json";
import ironToothAsset from "@/assets/iron_tooth.mp3.asset.json";

// --- CIRCULATION FRANÇAISE ---
const VOIE_DROITE = [{x:10,y:52},{x:85,y:52},{x:85,y:48},{x:10,y:48}];
const VOIE_GAUCHE = [{x:85,y:58},{x:10,y:58},{x:10,y:54},{x:85,y:54}];

type Voiture = {id:string;voie:"droite"|"gauche";indexEtape:number;x:number;y:number;vitesse:number};
type Station = {id:string;name:string;emoji:string;url?:string;loop?:boolean;volume?:number;tts?:boolean};

const STATIONS: Station[] = [
  {id:"main",name:"Junky Empire Taxi",emoji:"🚖",url:GAME_ASSETS["audio.music"],loop:true,volume:0.4},
  {id:"jce",name:"Junky City Empire",emoji:"🎵",url:junkyCityEmpireAsset.url,loop:true,volume:0.6},
  {id:"iron",name:"Iron Tooth",emoji:"🦷",url:ironToothAsset.url,loop:true,volume:0.6},
  {id:"infos",name:"Junky Infos",emoji:"📰",tts:true},
  {id:"pop",name:"Radio Pop",emoji:"🎤",url:"/audio/royalty-free-pop.mp3",loop:true,volume:0.5},
  {id:"electro",name:"Radio Electro",emoji:"🎧",url:"/audio/royalty-free-electro.mp3",loop:true,volume:0.5},
  {id:"rock",name:"Radio Rock",emoji:"🎸",url:"/audio/royalty-free-rock.mp3",loop:true,volume:0.5},
  {id:"emotions",name:"Radio Émotions",emoji:"💖",url:"/audio/royalty-free-chill.mp3",loop:true,volume:0.5},
  {id:"kids",name:"Radio Kids",emoji:"🧸",url:"/audio/royalty-free-kids.mp3",loop:true,volume:0.5},
];

const DJ_LINES: Record<string,RadioNews[]> = {
  main:[{fr:"Bienvenue à bord du Junky Empire Taxi !",en:"Welcome aboard Junky Empire Taxi!"},{fr:"On roule, on groove !",en:"We're rolling and grooving!"}],
  jce:[{fr:"Junky City Empire, la ville ne dort jamais.",en:"Junky City Empire, the city never sleeps."}],
  iron:[{fr:"Iron Tooth, ça va mordre !",en:"Iron Tooth, it's gonna bite!"}],
  infos:[{fr:"Junky Infos, l'heure et le trafic.",en:"Junky News, time and traffic."}],
  pop:[{fr:"Radio Pop, le plein de bonne humeur !",en:"Radio Pop, full of good vibes!"}],
  electro:[{fr:"Radio Electro, branchez les basses.",en:"Radio Electro, turn up the bass."}],
  rock:[{fr:"Radio Rock, sortez les guitares !",en:"Radio Rock, grab your guitars!"}],
  emotions:[{fr:"Radio Émotions, tout en douceur.",en:"Radio Emotions, all smooth."}],
  kids:[{fr:"Radio Kids, on joue et on chante !",en:"Radio Kids, let's play and sing!"}],
};

const STORAGE_KEY="mttw.taxiRadio
