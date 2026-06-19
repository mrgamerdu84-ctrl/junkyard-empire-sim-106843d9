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
const DJ_REPEAT_MIN_MS = 45000;
const DJ_REPEAT_SPREAD_MS = 25000;

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

  useEffect(() => { langRef.current = lang; }, [lang]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);


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

  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  // Lit une brève via le serveur (Lovable AI) → audio mp3 réel (marche partout, incl. WebView Android)
  const speak = async (news: RadioNews) => {
    const l = langRef.current;
    const text = l === "en" ? news.en : news.fr;
    showTicker(text);
    try {
      // coupe l'audio précédent
      if (ttsAudioRef.current) {
        try { ttsAudioRef.current.pause(); } catch {}
        ttsAudioRef.current.src = "";
        ttsAudioRef.current = null;
      }
      // Récupère le token Supabase pour authentifier la requête TTS
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        // Pas connecté → fallback navigateur uniquement
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          try {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = l === "en" ? "en-US" : "fr-FR";
            const v = pickVoice(l); if (v) u.voice = v;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(u);
          } catch {}
        }
        return;
      }
      const res = await fetch("/api/public/radio-tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ text, lang: l }),
      });
      if (!res.ok) {
        console.warn("[Radio] TTS HTTP", res.status, await res.text().catch(() => ""));
        // fallback navigateur
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          try {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = l === "en" ? "en-US" : "fr-FR";
            const v = pickVoice(l); if (v) u.voice = v;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(u);
          } catch {}
        }
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      a.volume = 1.0;
      ttsAudioRef.current = a;
      a.onended = () => { URL.revokeObjectURL(url); if (ttsAudioRef.current === a) ttsAudioRef.current = null; };
      a.onerror = () => { URL.revokeObjectURL(url); console.warn("[Radio] audio playback error"); };
      try { await a.play(); ttsUnlockedRef.current = true; }
      catch (err) { console.warn("[Radio] play() bloqué:", err); }
    } catch (err) {
      console.warn("[Radio] speak error:", err);
    }
  };

  // ====== Animateur radio (DJ) ======
  const djLine = (stationName: string): RadioNews => {
    const intros = [
      { fr: `Vous écoutez ${stationName} sur Junky Empire ! Ça va chauffer, on enchaîne avec un titre du tonnerre, restez branchés !`,
        en: `You're listening to ${stationName} on Junky Empire! Buckle up, the next track is fire — stay tuned!` },
      { fr: `Ici ${stationName}, la radio préférée des taxis ! Prochain morceau dans un instant, gardez le volume à fond !`,
        en: `This is ${stationName}, the taxi drivers' favorite station! Next track coming up, keep the volume loud!` },
      { fr: `Salut à tous les chauffeurs ! ${stationName} vous accompagne sur la route. On continue avec une pépite, c'est cadeau !`,
        en: `Hey drivers! ${stationName} keeps you company on the road. Up next, a real gem — enjoy!` },
      { fr: `${stationName} ! On vient de passer un classique, et croyez-moi, le prochain titre est encore meilleur. Roulez prudemment !`,
        en: `${stationName}! That was a classic, and trust me, what's next is even better. Drive safe!` },
      { fr: `Bienvenue de retour sur ${stationName} ! Météo au beau fixe, trafic fluide, et la musique qui envoie. Prochain morceau, c'est parti !`,
        en: `Welcome back to ${stationName}! Weather's great, traffic's smooth, and the music's pumping. Next track, here we go!` },
      { fr: `Vous êtes sur ${stationName}, la station qui fait vibrer Junky City ! On continue le marathon musical, tenez bon !`,
        en: `You're on ${stationName}, the station that makes Junky City vibrate! The music marathon continues, hold on tight!` },
      { fr: `${stationName} en direct ! Un grand merci aux taxis qui nous écoutent. Le prochain titre, vous allez kiffer, promis !`,
        en: `${stationName} live! Big shout-out to all the taxis tuned in. You're gonna love the next one, I promise!` },
    ];
    return intros[Math.floor(Math.random() * intros.length)];
  };

  const playDjLine = (stationName: string) => {
    const a = audioRef.current;
    const originalVol = a ? a.volume : 0.5;
    // duck la musique
    if (a) { try { a.volume = Math.max(0.05, originalVol * 0.18); } catch {} }
    speak(djLine(stationName));
    // surveille la fin de la TTS pour restaurer le volume
    if (djRestoreRef.current) window.clearInterval(djRestoreRef.current);
    djRestoreRef.current = window.setInterval(() => {
      if (!ttsAudioRef.current) {
        if (a) { try { a.volume = originalVol; } catch {} }
        if (djRestoreRef.current) { window.clearInterval(djRestoreRef.current); djRestoreRef.current = null; }
      }
    }, 300);
    // fail-safe : restaure dans 20s max
    window.setTimeout(() => {
      if (a) { try { a.volume = originalVol; } catch {} }
      if (djRestoreRef.current) { window.clearInterval(djRestoreRef.current); djRestoreRef.current = null; }
    }, 20000);
  };

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

    if (!a) return;
    if (!st || st.id === "off") { a.pause(); return; }

    if (st.tts) {
      a.pause();
      speak(WELCOME_JINGLE);
      // première brève rapidement (météo / événement / trafic)
      window.setTimeout(() => {
        const idx = ambientIdxRef.current % AMBIENT_NEWS.length;
        ambientIdxRef.current++;
        speak(AMBIENT_NEWS[idx]);
      }, 6000);
      // puis enchaîne toutes les ~18s
      ambientTimerRef.current = window.setInterval(() => {
        const idx = ambientIdxRef.current % AMBIENT_NEWS.length;
        ambientIdxRef.current++;
        speak(AMBIENT_NEWS[idx]);
      }, 18000);
      return;
    }

    if (st.url) {
      if (a.src !== st.url) a.src = st.url;
      a.loop = !!st.loop;
      a.volume = st.volume ?? 0.5;
      a.play().catch(() => {
        const start = () => {
          a.play().catch(() => {});
          window.removeEventListener("pointerdown", start);
          window.removeEventListener("keydown", start);
          window.removeEventListener("touchstart", start);
        };
        window.addEventListener("pointerdown", start, { once: true });
        window.addEventListener("keydown", start, { once: true });
        window.addEventListener("touchstart", start, { once: true });
      });

      // Animateur radio : annonce tout de suite la station, puis revient régulièrement
      const scheduleDj = () => {
        const delay = DJ_REPEAT_MIN_MS + Math.random() * DJ_REPEAT_SPREAD_MS;
        djTimerRef.current = window.setTimeout(() => {
          if (!pausedRef.current) playDjLine(st.name);
          scheduleDj();
        }, delay) as unknown as number;
      };
      djTimerRef.current = window.setTimeout(() => {
        if (!pausedRef.current) playDjLine(st.name);
        scheduleDj();
      }, DJ_FIRST_DELAY_MS) as unknown as number;
    }
  }, [stationId, ready]);


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
          if (st?.loop) { a.currentTime = 0; a.play().catch(() => {}); }
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
