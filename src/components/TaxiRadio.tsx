import { useEffect, useRef, useState } from "react";
import { GAME_ASSETS } from "@/game/gameAssets";
import { AMBIENT_NEWS, WELCOME_JINGLE, type RadioNews } from "@/lib/radioNews";
import junkyCityEmpireAsset from "@/assets/junky_city_empire.mp3.asset.json";
import ironToothAsset from "@/assets/iron_tooth.mp3.asset.json";

// CONFIGURATION DES VOIES DE TRAFIC (WAYPOINTS)
const VOIE_DROITE = [
  { x: 10, y: 50 },
  { x: 50, y: 50 },
  { x: 90, y: 50 }
];

const VOIE_GAUCHE = [
  { x: 90, y: 56 },
  { x: 50, y: 56 },
  { x: 10, y: 56 }
];

type Voiture = {
  id: string;
  voie: "droite" | "gauche";
  indexEtape: number;
  x: number;
  y: number;
  vitesse: number;
};

type Station = { id: string; name: string; emoji: string; url?: string; loop?: boolean; volume?: number; tts?: boolean; };

const STATIONS: Station[] = [
  { id: "main",     name: "Junky Empire Taxi",  emoji: "🚖", url: GAME_ASSETS["audio.music"], loop: true, volume: 0.4 },
  { id: "jce",      name: "Junky City Empire",  emoji: "🎵", url: junkyCityEmpireAsset.url, loop: true, volume: 0.6 },
  { id: "iron",     name: "Iron Tooth",         emoji: "🦷", url: ironToothAsset.url, loop: true, volume: 0.6 },
  { id: "infos",    name: "Junky Infos",        emoji: "📰", tts: true },
  { id: "pop",      name: "Radio Pop",          emoji: "🎤", url: "https://ice1.somafm.com/poptron-128-mp3", volume: 0.5 },
  { id: "electro",  name: "Radio Electro",      emoji: "🎧", url: "https://ice1.somafm.com/groovesalad-128-mp3", volume: 0.5 },
  { id: "rock",     name: "Radio Rock",         emoji: "🎸", url: "https://ice6.somafm.com/thetrip-128-mp3", volume: 0.5 },
  { id: "emotions", name: "Radio Émotions",     emoji: "💖", url: "https://ice1.somafm.com/lush-128-mp3", volume: 0.5 },
  { id: "kids",     name: "Radio Kids",         emoji: "🧸", url: "https://ice1.somafm.com/fluid-128-mp3", volume: 0.5 },
];

export default function TaxiRadio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const interludeRef = useRef<HTMLAudioElement | null>(null);
  const ambientTimerRef = useRef<number | null>(null);
  const ambientIdxRef = useRef<number>(0);

  const [stationId, setStationId] = useState<string>("main");
  const [open, setOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [ticker, setTicker] = useState<string>("");
  const [newsHour, setNewsHour] = useState<boolean>(false);

  // --- ÉTAT DU TRAFIC FLUIDE ---
  const [voitures, setVoitures] = useState<Voiture[]>([]);

  useEffect(() => {
    const apply = () => setNewsHour(new Date().getMinutes() < 10);
    apply();
    const t = window.setInterval(apply, 30000);
    return () => window.clearInterval(t);
  }, []);

  const speak = async (news: RadioNews, onComplete?: () => void) => {
    const text = news.fr; setTicker(text);
    let doneCalled = false;
    const done = () => { if (!doneCalled) { doneCalled = true; onComplete?.(); } };
    const failsafe = window.setTimeout(done, 15000);

    try {
      if (ttsAudioRef.current) ttsAudioRef.current.pause();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text); u.lang = "fr-FR";
        u.onend = () => { window.clearTimeout(failsafe); done(); };
        u.onerror = () => { window.clearTimeout(failsafe); done(); };
        window.speechSynthesis.speak(u);
      } else { done(); }
    } catch { done(); }
  };

  useEffect(() => {
    const st = STATIONS.find((s) => s.id === stationId);
    if (ambientTimerRef.current) window.clearInterval(ambientTimerRef.current);
    if (inter
