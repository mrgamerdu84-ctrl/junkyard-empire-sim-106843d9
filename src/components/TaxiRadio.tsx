import { useEffect, useRef, useState } from "react";
import { GAME_ASSETS } from "@/game/gameAssets";
import { RADIO_NEWS_EVENT, AMBIENT_NEWS, WELCOME_JINGLE, getHoroscopeNews, getTvProgramNews, type RadioNews } from "@/lib/radioNews";
import junkyCityEmpireAsset from "@/assets/junky_city_empire.mp3";
import ironToothAsset from "@/assets/iron_tooth.mp3";

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
  { id: "main", name: "Junky Empire Taxi", emoji: "🚖", url: GAME_ASSETS["audio.music"], loop: true, volume: 0.4 },
  { id: "jce", name: "Junky City Empire", emoji: "🎵", url: junkyCityEmpireAsset, loop: true, volume: 0.6 },
  { id: "iron", name: "Iron Tooth", emoji: "🦷", url: ironToothAsset, loop: true, volume: 0.6 },
  { id: "infos", name: "Junky Infos", emoji: "📰", tts: true },
  { id: "pop", name: "Radio Pop", emoji: "🎤", url: popMusic, volume: 0.5 },
  { id: "electro", name: "Radio Electro", emoji: "🎧", url: "https://ice1.somafm.com/groovesalad-128-mp3", volume: 0.5 },
{ id: "rock", name: "Radio Rock", emoji: "🎸", url: "https://ice6.somafm.com/thetrip-128-mp3", volume: 0.5 },
  { id: "emotions", name: "Radio Émotions", emoji: "💖", url: "https://ice1.somafm.com/lush-128-mp3", volume: 0.5 },
  { id: "kids", name: "Radio Kids", emoji: "🧸", url: "https://ice1.somafm.com/fluid-128-mp3", volume: 0.5 },
  { id: "pop", name: "Radio Pop", emoji: "🎤", url: "https://ice1.somafm.com/poptron-128-mp3", volume: 0.5 },
];
const STORAGE_KEY = "mttw.taxiRadio";
const LANG_KEY = "mttw.lang";
const DJ_FIRST_DELAY_MS = 1200;
// Référencé pour ne pas perdre l'utilitaire de duck/restore historique, mais
// la nouvelle séquence radio enchaîne DJ→musique au lieu de jouer en parallèle.
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
  // "Heure des infos" : à chaque xx:00, toutes les radios passent aux infos pendant 10 min
  const [newsHour, setNewsHour] = useState<boolean>(false);
  const newsHourRef = useRef<boolean>(false);
  useEffect(() => { newsHourRef.current = newsHour; }, [newsHour]);
  // Bascule alignée précisément sur l'horloge murale réelle :
  // tous les clients basculent au même moment (xx:00 → infos, xx:10 → musique),
  // y compris après rechargement de la page ou changement d'onglet.
  useEffect(() => {
    const apply = () => {
      const active = new Date().getMinutes() < 10;
      setNewsHour((prev) => (prev !== active ? active : prev));
    };
    let timer: number | null = null;
    const scheduleAligned = () => {
      apply();
      const now = new Date();
      // ms restants jusqu'à la prochaine minute pile + petite marge
      const msToNextMinute =
        60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
      timer = window.setTimeout(scheduleAligned, msToNextMinute + 50);
    };
    scheduleAligned();
    // Re-synchronise immédiatement quand l'onglet redevient visible / reprend le focus
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

  // Tick toutes les 30s pour rafraîchir l'horloge + fetch météo au montage et toutes les 30 min
  useEffect(() => {
    setNowTick(Date.now());
    const t = window.setInterval(() => setNowTick(Date.now()), 30 * 1000);
    return () => window.clearInterval(t);
  }, []);

  // Fetch météo initial + rafraîchissement toutes les 30 min
  useEffect(() => {
    fetchWeather();
    const t = window.setInterval(() => fetchWeather(), 30 * 60 * 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { langRef.current = lang; }, [lang]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // ====== Météo réelle (Open-Meteo, sans clé) ======
  const weatherCodeText = (code: number, l: "fr" | "en"): string => {
    const fr: Record<number, string> = {
      0: "ciel dégagé", 1: "plutôt ensoleillé", 2: "partiellement nuageux", 3: "couvert",
      45: "brouillard", 48: "brouillard givrant",
      51: "bruine légère", 53: "bruine", 55: "forte bruine",
      61: "pluie faible", 63: "pluie", 65: "forte pluie",
      71: "neige faible", 73: "neige", 75: "forte neige",
      80: "averses", 81: "averses", 82: "violentes averses",
      95: "orage", 96: "orage avec grêle", 99: "violent orage",
    };
    const en: Record<number, string> = {
      0: "clear sky", 1: "mostly sunny", 2: "partly cloudy", 3: "overcast",
      45: "foggy", 48: "freezing fog",
      51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
      61: "light rain", 63: "rain", 65: "heavy rain",
      71: "light snow", 73: "snow", 75: "heavy snow",
      80: "showers", 81: "showers", 82: "violent showers",
      95: "thunderstorm", 96: "thunderstorm with hail", 99: "violent thunderstorm",
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
    // Météo strictement locale : si la géoloc est refusée/indisponible, pas de fallback Paris.
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



  // Débloque la synthèse vocale au premier geste utilisateur (requis sur mobile)
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

  // Pioche la prochaine brève en mêlant brèves d'ambiance, horoscope (1x/5)
  // et programme TV (1x/7), pour varier davantage la radio infos.
  const pickNextBreve = (): RadioNews => {
    const i = ambientIdxRef.current;
    if (i > 0 && i % 5 === 0) return getHoroscopeNews();
    if (i > 0 && i % 7 === 0) return getTvProgramNews();
    return AMBIENT_NEWS[i % AMBIENT_NEWS.length];
  };


  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  // Jeton de session radio : incrémenté à chaque changement de station / pause.
  // Toute séquence DJ→musique en cours vérifie ce jeton avant de continuer,
  // pour ne pas démarrer la musique d'une station déjà quittée.
  const radioSessionRef = useRef<number>(0);

  // Lit une brève via le serveur (Lovable AI) → audio mp3 réel (marche partout, incl. WebView Android)
  // Si `onComplete` est fourni, il est appelé EXACTEMENT une fois quand la TTS se termine
  // (fin naturelle, erreur, ou indisponibilité). Garantit l'enchaînement séquentiel DJ→musique.
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
    // Fallback de sécurité : si rien ne se passe sous 20s, on libère la séquence
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
          // Re-pick voice lazily (voices may load after first render)
          const u = new SpeechSynthesisUtterance(text);
          u.lang = l === "en" ? "en-US" : "fr-FR";
          const v = pickVoice(l); if (v) u.voice = v;
          u.rate = 1.0; u.pitch = 1.0; u.volume = 1.0;
          u.onend = () => wrapDone();
          u.onerror = () => wrapDone();
        try { window.speechSynthesis.cancel(); } catch {}
try { window.speechSynthesis.resume(); } catch {}
ttsUnlockedRef.current = true;
window.speechSynthesis.speak(u);
        } catch { wrapDone(); }
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
      // Le route peut renvoyer 200 + JSON {fallback:true} si l'amont a échoué.
      const ctype = res.headers.get("content-type") || "";
      if (ctype.includes("application/json")) {
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
      catch (err) {
        console.warn("[Radio] play() bloqué, fallback navigateur:", err);
        try { URL.revokeObjectURL(url); } catch {}
        if (ttsAudioRef.current === a) ttsAudioRef.current = null;
        a.onended = null; a.onerror = null;
        speakBrowser();
      }
} catch (err) {
  console.warn("[Radio] speak error:", err);
  speakBrowser();
}
  };

// ====== Animateur radio (DJ) ======

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


  // Utilitaire historique conservé (legacy : DJ par-dessus la musique, plus utilisé
  // depuis le passage à la séquence DJ→musique). Référencé via `void` pour rester
  // exporté/sans warning d'unused.
  const playDjLine = (stationName: string) => {
    fetchWeather();
    speak(djLine(stationName));
  };
  void playDjLine;

  // Stations
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

    // Musique d'intermède (utilisée pour Junky Infos et pendant l'heure des infos sur les radios musicales)
    const defaultMusicUrl = STATIONS.find((s) => s.id === "main")?.url;

    if (st.tts) {
      a.pause();
      speak(WELCOME_JINGLE);
      let cycle = 0;
      // première brève rapidement (météo / événement / trafic)
      window.setTimeout(() => {
        ambientIdxRef.current++;
        speak(pickNextBreve());
      }, 6000);
      // puis enchaîne toutes les ~18s, avec un intermède musical tous les 3 brèves
      ambientTimerRef.current = window.setInterval(() => {
        cycle++;
        if (cycle % 3 === 0 && defaultMusicUrl) {
          playMusicInterlude(defaultMusicUrl, 15000);
          return;
        }
        ambientIdxRef.current++;
        speak(pickNextBreve());
      }, 18000);
      return;
    }

    if (st.url) {
      // Heure des infos : pendant les 10 premières minutes de chaque heure,
      // les radios musicales basculent sur les brèves (avec courts intermèdes musicaux).
      if (newsHour) {
        a.pause();
        speak(WELCOME_JINGLE);
        let cycle = 0;
        window.setTimeout(() => {
          ambientIdxRef.current++;
          speak(pickNextBreve());
        }, 4000);
        ambientTimerRef.current = window.setInterval(() => {
          cycle++;
          if (cycle % 4 === 0 && st.url) {
            playMusicInterlude(st.url, 12000);
            return;
          }
          ambientIdxRef.current++;
          speak(pickNextBreve());
        }, 18000);
        return;
      }

      // === Nouvelle séquence radio synchronisée ===
      // 1) Stop musique précédente. 2) DJ annonce. 3) onended → musique démarre.
      // On désactive le loop natif pour ré-enclencher la séquence à chaque "nouvelle chanson".
      radioSessionRef.current++;
      const session = radioSessionRef.current;
      a.pause();
      a.loop = false; // on gère la boucle manuellement pour réinsérer le DJ entre chaque passe
      if (st.url && a.src !== st.url) a.src = st.url;
      a.volume = st.volume ?? 0.5;

      const startSong = () => {
        // Abandonne si l'utilisateur a changé de station / mis en pause entre temps
        if (session !== radioSessionRef.current) return;
        if (pausedRef.current) return;
        a.play().catch(() => {
          const start = () => {
            if (session !== radioSessionRef.current) return;
            a.play().catch(() => {});
            window.removeEventListener("pointerdown", start);
            window.removeEventListener("keydown", start);
            window.removeEventListener("touchstart", start);
          };
          window.addEventListener("pointerdown", start, { once: true });
          window.addEventListener("keydown", start, { once: true });
          window.addEventListener("touchstart", start, { once: true });
        });
      };

      // Annonce l'animateur, PUIS démarre la chanson quand sa voix se termine.
      const runDjThenSong = () => {
        if (session !== radioSessionRef.current) return;
        if (pausedRef.current) { startSong(); return; }
        speak(djLine(st.name), () => {
          if (session !== radioSessionRef.current) return;
          startSong();
        });
      };

      // Petit délai pour que la transition soit nette (changement de station perceptible)
      djTimerRef.current = window.setTimeout(runDjThenSong, DJ_FIRST_DELAY_MS) as unknown as number;
    }
  }, [stationId, ready, newsHour]);


  useEffect(() => {
    const onNews = (e: Event) => {
      if (stationId !== "infos") return;
      const detail = (e as CustomEvent<RadioNews>).detail;
      if (!detail) return;
      speak(detail);
    };
    window.addEventListener(RADIO_NEWS_EVENT, onNews);
    return () => window.removeEventListener(RADIO_NEWS_EVENT, onNews);
  }, [stationId]);

  useEffect(() => {
    return () => {
      if (ambientTimerRef.current) window.clearInterval(ambientTimerRef.current);
      if (tickerTimerRef.current) window.clearTimeout(tickerTimerRef.current);
      if (djTimerRef.current) window.clearTimeout(djTimerRef.current);
      if (djRestoreRef.current) window.clearInterval(djRestoreRef.current);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try { window.speechSynthesis.cancel(); } catch {}
      }
    };
  }, []);


  const pick = (id: string) => {
    setStationId(id);
    setPaused(false);
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
    // déblocage TTS au clic (sur la bonne piste utilisateur)
    if (id === "infos" && typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        window.speechSynthesis.speak(u);
        ttsUnlockedRef.current = true;
      } catch {}
    }
  };

  const playableStations = STATIONS;
  const stepStation = (dir: 1 | -1) => {
    const idx = playableStations.findIndex((s) => s.id === stationId);
    const base = idx < 0 ? 0 : idx;
    const next = (base + dir + playableStations.length) % playableStations.length;
    pick(playableStations[next].id);
  };
  const togglePlay = () => {
    const a = audioRef.current;
    const st = STATIONS.find((s) => s.id === stationId);
    if (paused) {
      setPaused(false);
      if (st?.tts) {
        // relance le cycle des brèves
        setStationId((s) => s); // no-op; force user to re-pick
        pick("infos");
      } else if (a) {
        a.play().catch(() => {});
      }
    } else {
      setPaused(true);
      if (a) { try { a.pause(); } catch {} }
      if (ttsAudioRef.current) { try { ttsAudioRef.current.pause(); } catch {} }
      if (ambientTimerRef.current) { window.clearInterval(ambientTimerRef.current); ambientTimerRef.current = null; }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try { window.speechSynthesis.cancel(); } catch {}
      }
    }
  };


  const setLanguage = (l: "fr" | "en") => {
    setLang(l);
    langRef.current = l;
    try { localStorage.setItem(LANG_KEY, l); } catch {}
    try { window.dispatchEvent(new CustomEvent("jce:lang-changed", { detail: l })); } catch {}
  };

  const current = STATIONS.find((s) => s.id === stationId);
  const active = stationId !== "off";

  return (
    <>
      <audio
        ref={audioRef}
        preload="auto"
        onEnded={(e) => {
          const a = e.currentTarget;
          const st = STATIONS.find((s) => s.id === stationId);
          // Fin d'une "chanson" → on relance la séquence : DJ d'abord, PUIS la chanson.
          // (Ne s'applique qu'aux stations locales en loop ; les flux ne déclenchent pas onEnded.)
          if (!st?.loop || !st.url || pausedRef.current) return;
          radioSessionRef.current++;
          const session = radioSessionRef.current;
          const startSong = () => {
            if (session !== radioSessionRef.current || pausedRef.current) return;
            a.currentTime = 0;
            a.play().catch(() => {});
          };
          speak(djLine(st.name), () => {
            if (session !== radioSessionRef.current) return;
            startSong();
          });
        }}
      />

      {ticker && (
        <div
          style={{
            position: "fixed", top: 64, left: "50%", transform: "translateX(-50%)",
            zIndex: 9999, maxWidth: "92vw",
            background: "linear-gradient(180deg,#991b1b,#450a0a)",
            color: "#fff7d6", padding: "8px 14px", borderRadius: 999,
            border: "2px solid #fde047", fontWeight: 800, fontSize: 13,
            boxShadow: "0 6px 18px rgba(0,0,0,0.5)",
            fontFamily: "system-ui, sans-serif",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <span>📰</span>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "75vw" }}>
            {ticker}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Radio du taxi"
        aria-label="Radio du taxi"
        style={{
          position: "fixed", top: 12, right: 12, zIndex: 10000,
          width: 44, height: 44, borderRadius: "50%",
          border: "2px solid #fde047",
          background: active
            ? "linear-gradient(180deg, #ef4444 0%, #991b1b 100%)"
            : "linear-gradient(180deg, #4b5563 0%, #1f2937 100%)",
          color: "#fff7d6", fontSize: 20, fontWeight: 900, cursor: "pointer",
          boxShadow: "0 4px 0 rgba(0,0,0,0.35), 0 6px 16px rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 0, lineHeight: 1,
        }}
      >
        📻
      </button>

      {open && (
        <div
          style={{
            position: "fixed", top: 64, right: 12, zIndex: 10001,
            background: "linear-gradient(180deg,#1f2937,#0f172a)",
            border: "2px solid #fde047", borderRadius: 12, padding: 10,
            minWidth: 220, boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
            color: "#fff7d6", fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 8, textAlign: "center" }}>
            📻 Junky Empire Taxi
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {STATIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(s.id)}
                style={{
                  textAlign: "left", padding: "8px 10px", borderRadius: 8,
                  border: stationId === s.id ? "2px solid #f5c542" : "2px solid rgba(255,255,255,0.15)",
                  background: stationId === s.id ? "#3a2a10" : "rgba(255,255,255,0.04)",
                  color: "#fff7d6", fontWeight: 700, cursor: "pointer",
                }}
              >
                {s.emoji} {s.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => pick("off")}
              style={{
                textAlign: "left", padding: "8px 10px", borderRadius: 8,
                border: stationId === "off" ? "2px solid #f5c542" : "2px solid rgba(255,255,255,0.15)",
                background: stationId === "off" ? "#3a2a10" : "rgba(255,255,255,0.04)",
                color: "#fff7d6", fontWeight: 700, cursor: "pointer",
              }}
            >
              🔇 Éteindre
            </button>
          </div>

          <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed rgba(255,255,255,0.2)" }}>
            <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4, textAlign: "center" }}>
              Langue de la radio infos
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["fr","en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLanguage(l)}
                  style={{
                    flex: 1, padding: "6px 0", borderRadius: 6,
                    border: lang === l ? "2px solid #f5c542" : "2px solid rgba(255,255,255,0.15)",
                    background: lang === l ? "#3a2a10" : "rgba(255,255,255,0.04)",
                    color: "#fff7d6", fontWeight: 800, cursor: "pointer",
                  }}
                >
                  {l === "fr" ? "🇫🇷 FR" : "🇬🇧 EN"}
                </button>
              ))}
            </div>
          </div>

          {current && (
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 8, textAlign: "center" }}>
              En cours : {current.name}
            </div>
          )}
        </div>
      )}

      {/* Overlay heure + météo (ce que dit l'animateur radio) */}
      {nowTick !== null && (() => {
        const d = new Date(nowTick);
        const hh = d.getHours().toString().padStart(2, "0");
        const mm = d.getMinutes().toString().padStart(2, "0");
        const w = weatherState;
        const codeEmoji = (c: number): string => {
          if (c === 0) return "☀️";
          if (c === 1) return "🌤️";
          if (c === 2) return "⛅";
          if (c === 3) return "☁️";
          if (c === 45 || c === 48) return "🌫️";
          if (c >= 51 && c <= 55) return "🌦️";
          if (c >= 61 && c <= 65) return "🌧️";
          if (c >= 71 && c <= 75) return "🌨️";
          if (c >= 80 && c <= 82) return "🌧️";
          if (c >= 95) return "⛈️";
          return "🌡️";
        };
        return (
          <div
            title={w?.city ? `Météo : ${w.city}` : "Météo"}
            style={{
              position: "fixed", top: 12, right: 64, zIndex: 10000,
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 10px", borderRadius: 999,
              background: "rgba(15,23,42,0.78)",
              border: "1px solid rgba(253,224,71,0.55)",
              color: "#fff7d6", fontFamily: "system-ui, sans-serif",
              fontWeight: 800, fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.45)",
              backdropFilter: "blur(4px)",
              pointerEvents: "none",
            }}
          >
            <span>🕒 {hh}:{mm}</span>
            <span style={{ opacity: 0.55 }}>•</span>
            {w ? (
              <span>{codeEmoji(w.code)} {w.tempC}°C</span>
            ) : (
              <span style={{ opacity: 0.7 }}>météo…</span>
            )}
            {newsHour && (
              <>
                <span style={{ opacity: 0.55 }}>•</span>
                <span style={{ color: "#fde047" }}>📰 INFOS</span>
              </>
            )}
          </div>
        );
      })()}

      {/* Mini dock contrôles radio en bas de la carte */}
      <div
        style={{
          position: "fixed", bottom: 8, left: "50%", transform: "translateX(-50%)",
          zIndex: 9998, display: "flex", alignItems: "center", gap: 6,
          padding: "4px 8px", borderRadius: 999,
          background: "rgba(15,23,42,0.75)",
          border: "1px solid rgba(253,224,71,0.55)",
          color: "#fff7d6", fontFamily: "system-ui, sans-serif",
          boxShadow: "0 4px 12px rgba(0,0,0,0.45)",
          backdropFilter: "blur(4px)",
        }}
      >
        <button
          type="button"
          onClick={() => stepStation(-1)}
          title="Station précédente"
          aria-label="Station précédente"
          style={miniBtn}
        >⏮</button>
        <button
          type="button"
          onClick={togglePlay}
          title={paused ? "Lecture" : "Pause"}
          aria-label={paused ? "Lecture" : "Pause"}
          style={{ ...miniBtn, fontSize: 14 }}
        >{paused ? "▶" : "⏸"}</button>
        <button
          type="button"
          onClick={() => stepStation(1)}
          title="Station suivante"
          aria-label="Station suivante"
          style={miniBtn}
        >⏭</button>
        <span style={{
          fontSize: 10, fontWeight: 700, opacity: 0.9,
          maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis",
          whiteSpace: "nowrap", paddingRight: 4,
        }}>
          {current ? `${current.emoji} ${current.name}` : "🔇"}
        </span>
      </div>
    </>
  );
}

const miniBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: "50%",
  border: "1px solid rgba(253,224,71,0.6)",
  background: "linear-gradient(180deg,#ef4444,#991b1b)",
  color: "#fff7d6", fontSize: 12, fontWeight: 900, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 0, lineHeight: 1,
};
