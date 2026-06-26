import { useState, useRef, useEffect, useCallback } from "react";
import { RADIO_STATIONS } from "./radioStations";

const LS_KEY = "mttw.radio";

function loadRadioState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as {
      stationId: string;
      trackIndex: number;
      volume: number;
      playing: boolean;
    };
  } catch {
    return null;
  }
}

function saveRadioState(state: { stationId: string; trackIndex: number; volume: number; playing: boolean }) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {}
}

export default function RadioPlayer(props: { open?: boolean; onOpenChange?: (o: boolean) => void; hideToggle?: boolean } = {}) {
  const saved = loadRadioState();
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = props.open !== undefined;
  const open = controlled ? !!props.open : internalOpen;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => {
    const next = typeof v === "function" ? v(open) : v;
    if (controlled) props.onOpenChange?.(next);
    else setInternalOpen(next);
  };
  const [stationId, setStationId] = useState(saved?.stationId ?? RADIO_STATIONS[0].id);
  const [trackIndex, setTrackIndex] = useState(saved?.trackIndex ?? 0);
  const [volume, setVolume] = useState(saved?.volume ?? 0.5);
  const [playing, setPlaying] = useState(saved?.playing ?? false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const station = RADIO_STATIONS.find((s) => s.id === stationId) ?? RADIO_STATIONS[0];
  const track = station.tracks[trackIndex] ?? station.tracks[0];

  const playTrack = useCallback((idx: number) => {
    setTrackIndex(idx);
    setCurrentTime(0);
    setDuration(0);
    setTimeout(() => {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    }, 50);
  }, []);

  const nextTrack = useCallback(() => {
    const next = (trackIndex + 1) % station.tracks.length;
    playTrack(next);
  }, [trackIndex, station.tracks.length, playTrack]);

  const prevTrack = useCallback(() => {
    const prev = (trackIndex - 1 + station.tracks.length) % station.tracks.length;
    playTrack(prev);
  }, [trackIndex, station.tracks.length, playTrack]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(() => {});
      setPlaying(true);
    }
  }, [playing]);

  const switchStation = useCallback((id: string) => {
    setStationId(id);
    const newStation = RADIO_STATIONS.find((s) => s.id === id);
    if (newStation) {
      playTrack(0);
    }
  }, [playTrack]);

  useEffect(() => {
    saveRadioState({ stationId, trackIndex, volume, playing });
  }, [stationId, trackIndex, volume, playing]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => nextTrack();
    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onError = () => {
      console.warn("[radio] piste illisible, passage à la suivante", track?.url);
      nextTrack();
    };
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("error", onError);
    };
  }, [track?.url, nextTrack]);

  // Recharge explicitement la source quand l'URL change (sinon certains
  // navigateurs mobiles gardent la piste précédente bloquée).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    if (playing) {
      audio.play().catch(() => {});
    }
  }, [track?.url, playing]);

  const formatTime = (t: number) => {
    if (!isFinite(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <>
      <style>{`
        .rp-root {
          position: fixed;
          bottom: max(12px, env(safe-area-inset-bottom));
          left: 12px;
          z-index: 8000;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .rp-toggle {
          width: 46px; height: 46px; border-radius: 50%;
          background: linear-gradient(180deg, #f5c542, #e0a92a);
          border: 2px solid #fde047;
          box-shadow: 0 4px 0 #8a6510, 0 8px 16px rgba(0,0,0,0.5);
          color: #1a1208; font-size: 20px; font-weight: 900;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; z-index: 8001;
          padding: 0; appearance: none;
          transition: transform 0.08s;
        }
        .rp-toggle:active { transform: translateY(2px); box-shadow: 0 2px 0 #8a6510, 0 4px 8px rgba(0,0,0,0.4); }
        .rp-panel {
          position: absolute;
          bottom: 56px;
          left: 0;
          width: min(320px, 80vw);
          background: linear-gradient(180deg, #1f2937, #111827);
          border: 2px solid #f5c542;
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.6);
          display: flex; flex-direction: column; gap: 10px;
          animation: rpSlideIn 0.25s ease-out;
        }
        @keyframes rpSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .rp-stations {
          display: flex; gap: 6px;
        }
        .rp-station {
          flex: 1;
          appearance: none; border: none; cursor: pointer;
          padding: 8px 6px; border-radius: 10px;
          font-weight: 800; font-size: 12px;
          text-align: center;
          background: #0a0c10;
          color: #9ca3af;
          border: 2px solid #374151;
          transition: all 0.15s;
        }
        .rp-station.active {
          background: linear-gradient(180deg, #f5c542, #e0a92a);
          color: #1a1208;
          border-color: #fde047;
        }
        .rp-track {
          text-align: center;
          color: #e5e7eb;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.3;
        }
        .rp-track small {
          color: #9ca3af;
          font-weight: 600;
          font-size: 11px;
          display: block;
          margin-top: 2px;
        }
        .rp-controls {
          display: flex; align-items: center; justify-content: center; gap: 14px;
        }
        .rp-btn {
          appearance: none; border: none; cursor: pointer;
          background: transparent; color: #f5c542;
          font-size: 22px; padding: 4px; line-height: 1;
        }
        .rp-btn.big { font-size: 32px; }
        .rp-progress-wrap {
          display: flex; align-items: center; gap: 6px;
          color: #9ca3af; font-size: 10px; font-family: monospace;
        }
        .rp-progress {
          flex: 1; height: 4px; border-radius: 2px;
          background: #374151; overflow: hidden;
          cursor: pointer;
        }
        .rp-progress-fill {
          height: 100%; background: #f5c542; border-radius: 2px;
          transition: width 0.3s;
        }
        .rp-volume {
          display: flex; align-items: center; gap: 6px;
          color: #9ca3af; font-size: 11px;
        }
        .rp-volume input[type="range"] {
          flex: 1; accent-color: #f5c542; height: 4px;
        }
        .rp-close {
          position: absolute; top: 6px; right: 8px;
          background: transparent; border: none; color: #9ca3af;
          font-size: 18px; cursor: pointer; padding: 2px 6px;
        }
        .rp-live {
          display: inline-flex; align-items: center; gap: 4px;
          background: #dc2626; color: #fff; font-size: 9px;
          font-weight: 900; text-transform: uppercase;
          padding: 2px 6px; border-radius: 4px;
          letter-spacing: 0.5px;
          animation: rpPulse 1.2s infinite;
        }
        @keyframes rpPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>

      <div className="rp-root">
        <button
          className="rp-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Fermer la radio" : "Ouvrir la radio"}
          title="Radio"
        >
          {playing ? "📻" : "🔇"}
        </button>

        {open && (
          <div className="rp-panel">
            <button className="rp-close" onClick={() => setOpen(false)} aria-label="Fermer">
              ×
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span className="rp-live">● LIVE</span>
              <span style={{ color: "#f5c542", fontWeight: 900, fontSize: 14 }}>
                {station.emoji} {station.name}
              </span>
            </div>

            <div className="rp-stations">
              {RADIO_STATIONS.map((s) => (
                <button
                  key={s.id}
                  className={`rp-station ${stationId === s.id ? "active" : ""}`}
                  onClick={() => switchStation(s.id)}
                >
                  {s.emoji} {s.name}
                </button>
              ))}
            </div>

            <div className="rp-track">
              {track.title}
              <small>{track.artist} — {station.name}</small>
            </div>

            <div className="rp-progress-wrap">
              <span>{formatTime(currentTime)}</span>
              <div
                className="rp-progress"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  const audio = audioRef.current;
                  if (audio && duration) {
                    audio.currentTime = pct * duration;
                  }
                }}
              >
                <div
                  className="rp-progress-fill"
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
              <span>{formatTime(duration)}</span>
            </div>

            <div className="rp-controls">
              <button className="rp-btn" onClick={prevTrack} aria-label="Précédent">
                ⏮️
              </button>
              <button className="rp-btn big" onClick={togglePlay} aria-label={playing ? "Pause" : "Lecture"}>
                {playing ? "⏸️" : "▶️"}
              </button>
              <button className="rp-btn" onClick={nextTrack} aria-label="Suivant">
                ⏭️
              </button>
            </div>

            <div className="rp-volume">
              <span>🔊</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                aria-label="Volume"
              />
              <span>{Math.round(volume * 100)}%</span>
            </div>

            <audio
              ref={audioRef}
              src={track.url}
              preload="metadata"
              loop={false}
            />
          </div>
        )}
      </div>
    </>
  );
}
