import { useEffect, useRef, useState } from "react";
import { GAME_ASSETS } from "@/game/gameAssets";
import { RADIO_NEWS_EVENT, AMBIENT_NEWS, WELCOME_JINGLE, type RadioNews } from "@/lib/radioNews";
import junkyCityEmpireAsset from "@/assets/junky_city_empire.mp3.asset.json";
import ironToothAsset from "@/assets/iron_tooth.mp3.asset.json";

type Station = {
  id: string;
  name: string;
  emoji: string;
  url?: string;
  loop?: boolean;
  volume?: number;
  tts?: boolean;
};

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

const STORAGE_KEY = "mttw.taxiRadio";
const LANG_KEY = "mttw.lang";
const DJ_FIRST_DELAY_MS = 1200;
void undefined;

function readPref(): string {
  try { return localStorage.getItem(STORAGE_KEY) ?? "main"; } catch { return "main"; }
}
function readLang(): "fr" | "en" {
  try { const v = localStorage.getItem(LANG_KEY); return v === "en" ? "en" : "fr"; } catch { return "fr"; }
}
function pickVoice(lang: "fr" | "en"): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const want = lang === "fr" ? "fr" : "en";
  return (
    voices.find((v) => v.lang?.toLowerCase().startsWith(want + "-")) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith(want)) ||
    null
  );
}

export default function TaxiRadio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [stationId, setStationId] = useState<string>("main");
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [lang, setLang] = useState<"fr" | "en">("fr");
  const langRef = useRef<"fr" | "en">("fr");
  const [ticker, setTicker] = useState<string>("");
  const ambientTimerRef = useRef<number | null>(null);
  const ambientIdxRef = useRef<number>(0);
  const tickerTimerRef = useRef<number | null>(null);
  const ttsUnlockedRef = useRef<boolean>(false);
  const djTimerRef = useRef<number | null>(null);
  const djRestoreRef = useRef<number | null>(null);
  const pausedRef = useRef<boolean>(false);
  const weatherRef = useRef<{ tempC: number; code: number; city: string } | null>(null);
  const weatherFetchedAtRef = useRef<number>(0);
  const [weatherState, setWeatherState] = useState<{ tempC: number; code: number; city: string } | null>(null);
  const [nowTick, setNowTick] = useState<number | null>(null);
  const [newsHour, setNewsHour] = useState<boolean>(false);
  const newsHourRef = useRef<boolean>(false);
  
  useEffect(() => { newsHourRef.current = newsHour; }, [newsHour]);

  useEffect(() => {
    const apply = () => {
      const active = new Date().getMinutes() < 10;
      setNewsHour((prev) => (prev !== active ? active : prev));
    };
    let timer: number | null = null;
    const scheduleAligned = () => {
      apply();
      const now = new Date();
      const msToNextMinute = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
      timer = window.setTimeout(scheduleAligned, msToNextMinute + 50);
    };
    scheduleAligned();
    const onVis = () => {
      apply();
      if (timer) { window.clearTimeout(timer); timer = null; }
      scheduleAligned();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, []);

  const interludeRef = useRef<HTMLAudioElement | null>(null);
  const playMusicInterlude = (url: string, ms: number = 15000) => {
    try {
      if (interludeRef.current) { try { interludeRef.current.pause(); } catch {} }
      const a = new Audio(url);
      a.volume = 0.5;
      interludeRef.current = a;
      a.play().catch(() => {});
      window.setTimeout(() => {
        try { a.pause(); } catch {}
        if (interludeRef.current === a) interludeRef.current = null;
      }, ms);
    } catch {}
  };

  useEffect(() => {
    setNowTick(Date.now());
    const t = window.setInterval(() => setNowTick(Date.now()), 30 * 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    fetchWeather();
    const t = window.setInterval(() => fetchWeather(), 30 * 60 * 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => { langRef.current = lang; }, [lang]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const weatherCodeText = (code: number, l: "fr" | "en"): string => {
    const fr: Record<number, string> = {
      0: "ciel dégagé", 1: "plutôt ensoleillé", 2: "partiellement nuageux", 3: "couvert",
      45: "brouillard", 48: "brouillard givrant", 51: "bruine légère", 53: "bruine", 55: "forte bruine",
      61: "pluie faible", 63: "pluie", 65: "forte pluie", 71: "neige faible", 73: "neige", 75: "forte neige",
      80: "averses", 81: "averses", 82: "violentes averses", 95: "orage", 96: "orage avec grêle", 99: "violent orage",
    };
    const en: Record<number, string> = {
      0: "clear sky", 1: "mostly sunny", 2: "partly cloudy", 3: "overcast",
      45: "foggy", 48: "freezing fog", 51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
      61: "light rain", 63: "rain", 65: "heavy rain", 71: "light snow", 73: "snow", 75: "heavy snow",
      80: "showers", 81: "showers", 82: "violent showers", 95: "thunderstorm", 96: "thunderstorm with hail", 99: "violent thunderstorm",
    };
    return (l === "fr" ? fr : en)[code] ?? (l === "fr" ? "temps changeant" : "changing weather");
  };

  const fetchWeather = async () => {
    const now = Date.now();
    if (weatherRef.current && now - weatherFetchedAtRef.current < 30 * 60 * 1000) return;
    const tryFetch = async (lat: number, lon: number, city: string) => {
      try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`);
        const j = await r.json();
        const tempC = Math.round(j?.current?.temperature_2m ?? 0);
        const code = Number(j?.current?.weather_code ?? 0);
        weatherRef.current = { tempC, code, city };
        setWeatherState({ tempC, code, city });
        weatherFetchedAtRef.current = Date.now();
      } catch {}
    };
    const noGeo = () => {
      weatherRef.current = null;
      setWeatherState(null);
      weatherFetchedAtRef.current = Date.now();
    };
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude } = pos.coords;
            let city = "";
            try {
              const g = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=fr&count=1`);
              const gj = await g.json();
              city = gj?.results?.[0]?.name ?? "";
            } catch {}
            await tryFetch(latitude, longitude, city || (langRef.current === "fr" ? "votre région" : "your area"));
          } catch { noGeo(); }
        },
        () => { noGeo(); },
        { timeout: 4000, maximumAge: 30 * 60 * 1000 }
      );
    } else {
      noGeo();
    }
  };

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
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    setStationId(readPref());
    const l = readLang();
    setLang(l);
    langRef.current = l;
    setReady(true);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    const onLang = () => { const nl = readLang(); setLang(nl); langRef.current = nl; };
    window.addEventListener("jce:lang-changed", onLang);
    return () => window.removeEventListener("jce:lang-changed", onLang);
  }, []);

  const showTicker = (text: string) => {
    setTicker(text);
    if (tickerTimerRef.current) window.clearTimeout(tickerTimerRef.current);
    tickerTimerRef.current = window.setTimeout(() => setTicker(""), 9000);
  };

  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const radioSessionRef = useRef<number>(0);

  const speak = async (news: RadioNews, onComplete?: () => void) => {
    const l = langRef.current;
    const text = l === "en" ? news.en : news.fr;
    showTicker(text);
    let completed = false;
    const done = () => {
      if (completed) return;
      completed = true;
      if (onComplete) { try { onComplete(); } catch {} }
    };
    const failsafe = window.setTimeout(done, 20000);
    const wrapDone = () => { window.clearTimeout(failsafe); done(); };
    try {
      if (ttsAudioRef.current) {
        try { ttsAudioRef.current.pause(); } catch {}
        ttsAudioRef.current.src = "";
        ttsAudioRef.current = null;
      }
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      const speakBrowser = () => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) { wrapDone(); return; }
        try {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
          }
          const u = new SpeechSynthesisUtterance(text);
          u.lang = l === "en" ? "en-US" : "fr-FR";
          const v = pickVoice(l); if (v) u.voice = v;
          u.onend = () => wrapDone();
          u.onerror = () => wrapDone();
          window.speechSynthesis.speak(u);
        } catch (err) {
          console.warn("[Radio] speakBrowser error:", err);
          wrapDone();
        }
      };

      if (!accessToken) { speakBrowser(); return; }
      const res = await fetch("/api/public/radio-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ text, lang: l }),
      });
      if (!res.ok) {
        console.warn("[Radio] TTS HTTP", res.status);
        speakBrowser();
        return;
      }
      const ct = res.headers.get("Content-Type") || "";
      if (ct.includes("application/json")) {
        speakBrowser();
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      a.volume = 1.0;
      ttsAudioRef.current = a;
      a.onended = () => {
        URL.revokeObjectURL(url);
        if (ttsAudioRef.current === a) ttsAudioRef.current = null;
        wrapDone();
      };
      a.onerror = () => {
        URL.revokeObjectURL(url);
        console.warn("[Radio] audio playback error");
        if (ttsAudioRef.current === a) ttsAudioRef.current = null;
        wrapDone();
      };
      try { await a.play(); ttsUnlockedRef.current = true; }
      catch (err) { console.warn("[Radio] play() bloqué:", err); wrapDone(); }
    } catch (err) {
      console.warn("[Radio] speak error:", err);
      wrapDone();
    }
  };

  const djLine = (stationName: string): RadioNews => {
    const l = langRef.current;
    const now = new Date();
    const hh = now.getHours();
    const mm = now.getMinutes();
    const timeFr = `${hh} heure${hh > 1 ? "s" : ""}${mm ? " " + mm : ""}`;
    const timeEn = `${((hh + 11) % 12) + 1}:${mm.toString().padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`;
    const w = weatherRef.current;
    const weatherFr = w ? `${weatherCodeText(w.code, "fr")}, ${w.tempC}°C${w.city ? " à " + w.city : ""}` : "météo en cours de mise à jour";
    const weatherEn = w ? `${weatherCodeText(w.code, "en")}, ${w.tempC}°C${w.city ? " in " + w.city : ""}` : "weather updating";
    const intros: RadioNews[] = [
      { fr: `Il est ${timeFr} sur ${stationName} ! Côté météo : ${weatherFr}. On enchaîne avec un titre du tonnerre, restez branchés !`,
        en: `It's ${timeEn} on ${stationName}! Weather report: ${weatherEn}. Next track is fire — stay tuned!` },
      { fr: `Ici ${stationName}, ${timeFr} pile ! ${weatherFr.charAt(0).toUpperCase() + weatherFr.slice(1)} dehors, parfait pour rouler. Prochain morceau dans un instant !`,
        en: `This is ${stationName}, ${timeEn} sharp! ${weatherEn} outside, perfect driving weather. Next track coming up!` },
      { fr: `Salut les chauffeurs, ${stationName} vous accompagne. Il est ${timeFr}, ${weatherFr}. On continue avec une pépite, c'est cadeau !`,
        en: `Hey drivers, ${stationName} keeps you company. It's ${timeEn}, ${weatherEn}. Up next, a real gem — enjoy!` },
      { fr: `${stationName} ! ${timeFr}, et dehors c'est ${weatherFr}. Le prochain titre est encore meilleur. Roulez prudemment !`,
        en: `${stationName}! ${timeEn}, and outside it's ${weatherEn}. What's next is even better. Drive safe!` },
      { fr: `Bienvenue de retour sur ${stationName} ! Il est ${timeFr}, météo : ${weatherFr}. La musique qui envoie, c'est parti !`,
        en: `Welcome back to ${stationName}! It's ${timeEn}, weather: ${weatherEn}. Pumping music, here we go!` },
      { fr: `Vous êtes sur ${stationName} ! ${timeFr}, ${weatherFr} sur Junky City. Marathon musical, tenez bon !`,
        en: `You're on ${stationName}! ${timeEn}, ${weatherEn} over Junky City. Music marathon, hold tight!` },
      { fr: `${stationName} en direct ! ${timeFr} à l'horloge, ${weatherFr} au thermomètre. Le prochain titre, vous allez kiffer !`,
        en: `${stationName} live! ${timeEn} on the clock, ${weatherEn} on the thermometer. You're gonna love the next one!` },
    ];
    return intros[Math.floor(Math.random() * intros.length)];
  };

  const playDjLine = (stationName: string) => {
    fetchWeather();
    speak(djLine(stationName));
  };
  void playDjLine;

  useEffect(() => {
    if (!ready) return;
    const a = audioRef.current;
    const st = STATIONS.find((s) => s.id === stationId);

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    if (ambientTimerRef.current) { window.clearInterval(ambientTimerRef.current); ambientTimerRef.current = null; }
    if (djTimerRef.current) { window.clearInterval(djTimerRef.current); djTimerRef.current = null; }
    if (djRestoreRef.current) { window.clearInterval(djRestoreRef.current); djRestoreRef.current = null; }
    setTicker("");
    if (interludeRef.current) { try { interludeRef.current.pause(); } catch {} interludeRef.current = null; }

    if (!a) return;
    if (!st || st.id === "off") { a.pause(); return; }

    const defaultMusicUrl = STATIONS.find((s) => s.id === "main")?.url;

    if (st.tts) {
      a.pause();
      speak(WELCOME_JINGLE);
      let cycle = 0;
      window.setTimeout(() => {
        const idx = ambientIdxRef.current % AMBIENT_NEWS.length;
        ambientIdxRef.current++;
        speak(AMBIENT_NEWS[idx]);
      }, 6000);
      ambientTimerRef.current = window.setInterval(() => {
        cycle++;
        if (cycle % 3 === 0 && defaultMusicUrl) {
          playMusicInterlude(defaultMusicUrl, 15000);
          return;
        }
        const idx = ambientIdxRef.current % AMBIENT_NEWS.length;
        ambientIdxRef.current++;
        speak(AMBIENT_NEWS[idx]);
      }, 18000);
      return;
    }

    if (st.url) {
      if (newsHour) {
        a.pause();
        speak(WELCOME_JINGLE);
        let cycle = 0;
        window.setTimeout(() => {
          const idx = ambientIdxRef.current % AMBIENT_NEWS.length;
          ambientIdxRef.current++;
          speak(AMBIENT_NEWS[idx]);
        }, 4000);
        ambientTimerRef.current = window.setInterval(() => {
          cycle++;
          if (cycle % 4 === 0 && st.url) {
            playMusicInterlude(st.url, 12000);
            return;
          }
          const idx = ambientIdxRef.current % AMBIENT_NEWS.length;
          ambientIdxRef.current++;
          speak(AMBIENT_NEWS[idx]);
        }, 18000);
        return;
      }
    }
  }, [stationId, ready, newsHour]);

  // Si Lovable a généré le visuel juste en dessous, il va reprendre le relais ici.
  // Une fois publié, demande à Lovable de recréer son design de boutons exact.
}
