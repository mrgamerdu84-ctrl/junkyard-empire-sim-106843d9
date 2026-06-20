import { useEffect, useRef, useState } from "react";
import { GAME_ASSETS } from "@/game/gameAssets";
import { AMBIENT_NEWS, WELCOME_JINGLE, type RadioNews } from "@/lib/radioNews";
import junkyCityEmpireAsset from "@/assets/junky_city_empire.mp3.asset.json";
import ironToothAsset from "@/assets/iron_tooth.mp3.asset.json";

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
  const ttsUnlockedRef = useRef<boolean>(false);

  const [stationId, setStationId] = useState<string>("main");
  const [open, setOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [ticker, setTicker] = useState<string>("");
  const [newsHour, setNewsHour] = useState<boolean>(false);

  useEffect(() => {
    const apply = () => setNewsHour(new Date().getMinutes() < 10);
    apply();
    const t = window.setInterval(apply, 30000);
    return () => window.clearInterval(t);
  }, []);

  // Déverrouillage de la voix sur mobile au premier clic
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const unlock = () => {
      if (ttsUnlockedRef.current) return;
      try {
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        window.speechSynthesis.speak(u);
        ttsUnlockedRef.current = true;
      } catch {}
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  const playMusicInterlude = (url: string, ms: number = 15000) => {
    try {
      if (interludeRef.current) interludeRef.current.pause();
      const a = new Audio(url); a.volume = 0.5; interludeRef.current = a;
      a.play().catch(() => {});
      window.setTimeout(() => { if (interludeRef.current === a) a.pause(); }, ms);
    } catch {}
  };

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
    if (interludeRef.current) interludeRef.current.pause();
    setTicker("");

    if (!st || st.id === "off") { if (audioRef.current) audioRef.current.pause(); return; }

    if (st.tts || newsHour) {
      if (audioRef.current) audioRef.current.pause();
      speak(WELCOME_JINGLE);
      ambientTimerRef.current = window.setInterval(() => {
        const idx = ambientIdxRef.current % AMBIENT_NEWS.length;
        ambientIdxRef.current++;
        speak(AMBIENT_NEWS[idx]);
      }, 16000);
    } else if (st.url && audioRef.current) {
      audioRef.current.src = st.url;
      audioRef.current.volume = st.volume || 0.5;
      if (!paused) audioRef.current.play().catch(() => {});
    }
  }, [stationId, newsHour, paused]);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <audio ref={audioRef} loop />
      <button 
        onClick={() => setOpen(!open)} 
        className="w-14 h-14 bg-yellow-500 rounded-full shadow-lg flex items-center justify-center text-2xl hover:scale-105 transition-transform"
      >
        {STATIONS.find(s => s.id === stationId)?.emoji || "📻"}
      </button>

      {open && (
        <div className="absolute bottom-16 right-0 w-64 bg-slate-900 border border-slate-700 text-white rounded-xl shadow-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2">
            <span className="font-bold text-yellow-500">Taxi Autoradio</span>
            <button onClick={() => setPaused(!paused)} className="text-sm bg-slate-800 px-2 py-1 rounded">
              {paused ? "▶️ Play" : "⏸️ Pause"}
            </button>
          </div>

          {ticker && (
            <div className="bg-slate-950 p-2 rounded text-xs text-green-400 border border-green-900 animate-pulse truncate">
              📢 {ticker}
            </div>
          )}

          <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto pr-1">
            {STATIONS.map((st) => (
              <button
                key={st.id}
                onClick={() => setStationId(st.id)}
                className={`w-full text-left p-2 rounded text-sm flex items-center gap-3 transition-colors ${stationId === st.id ? "bg-yellow-600 text-white" : "bg-slate-800 hover:bg-slate-700"}`}
              >
                <span>{st.emoji}</span>
                <span className="truncate">{st.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
