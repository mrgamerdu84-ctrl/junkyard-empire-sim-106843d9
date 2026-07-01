import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import {
  joinMatchmaking,
  leaveQueue,
  submitMatchEvent,
  finishMatch,
  getMatchState,
  getLeaderboard,
  getMyElo,
  type MpPlayer,
  type MpMatch,
} from "@/lib/multiplayer.functions";

export const Route = createFileRoute("/_authenticated/arena")({
  head: () => ({
    meta: [
      { title: "Arène mondiale — My Taxi World : L'Empire des Rues" },
      { name: "description", content: "Affronte un autre chauffeur du monde entier en temps réel. 5 minutes, le plus de fric gagne." },
    ],
  }),
  component: ArenaPage,
  errorComponent: ({ error }) => (
    <div style={{ padding: 24, color: "#fff7d6", textAlign: "center" }}>
      <h1>Erreur</h1>
      <p>{error.message}</p>
    </div>
  ),
  notFoundComponent: () => <div style={{ padding: 24, color: "#fff7d6" }}>Page introuvable</div>,
});

type View = "lobby" | "queue" | "match" | "result";

function LockedScreen({ title }: { title: string }) {
  return (
    <div style={{ padding: 32, textAlign: "center", color: "#fde047", minHeight: "60vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 12 }}>
      <div style={{ fontSize: 64 }}>🔒</div>
      <h1 style={{ margin: 0 }}>{title}</h1>
      <p style={{ maxWidth: 420, opacity: 0.85 }}>Ce mode est débloqué après avoir terminé la campagne « La Renaissance de Taxi Co. ». Continue de progresser dans les chapitres pour ouvrir le Mode Empire.</p>
      <a href="/" style={{ marginTop: 12, padding: "10px 18px", background: "#f5c542", color: "#1a1208", borderRadius: 8, fontWeight: 800, textDecoration: "none" }}>Retour au jeu</a>
    </div>
  );
}

function ArenaPage() {
  const arenaUnlocked = require("@/game/campaign/unlocks").useUnlock("empire.arena");
  if (!arenaUnlocked) return <LockedScreen title="Arène mondiale verrouillée" />;
  return <ArenaPageInner />;
}

function ArenaPageInner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [view, setView] = useState<View>("lobby");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [duration, setDuration] = useState(300);

  const join = useServerFn(joinMatchmaking);
  const leave = useServerFn(leaveQueue);

  // ----- Lobby data -----
  const leaderboardFn = useServerFn(getLeaderboard);
  const myEloFn = useServerFn(getMyElo);
  const { data: leaderboard } = useQuery({
    queryKey: ["mp-leaderboard"],
    queryFn: () => leaderboardFn(),
    enabled: view === "lobby",
    refetchInterval: 15000,
  });
  const { data: myElo } = useQuery({
    queryKey: ["mp-my-elo"],
    queryFn: () => myEloFn(),
    enabled: view === "lobby" || view === "result",
  });

  // ----- Matchmaking poll: realtime sub to my queue + match -----
  useEffect(() => {
    if (view !== "queue" || !user) return;
    const channel = supabase
      .channel(`mp-queue-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mp_match_players", filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const newMatch = payload.new?.match_id as string | undefined;
          if (newMatch) {
            setMatchId(newMatch);
            setView("match");
          }
        },
      )
      .subscribe();

    // Safety poll every 3s
    const poll = setInterval(async () => {
      try {
        const res = await join({ data: { durationSec: duration } });
        if (res.matchId) {
          setMatchId(res.matchId);
          setView("match");
        }
      } catch {}
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [view, user, duration, join]);

  // ----- Match auto-finish on time -----
  useEffect(() => {
    if (view !== "match") return;
  }, [view]);

  async function startMatchmaking() {
    try {
      const res = await join({ data: { durationSec: duration } });
      if (res.matchId) {
        setMatchId(res.matchId);
        setView("match");
      } else {
        setView("queue");
      }
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function cancelQueue() {
    try {
      await leave({});
    } catch {}
    setView("lobby");
  }

  return (
    <div className="arena-root">
      <style>{styles}</style>

      {view === "lobby" && (
        <div className="arena-lobby">
          <div className="arena-header">
            <button className="arena-back" onClick={() => navigate({ to: "/" })}>← Accueil</button>
            <h1 className="arena-title">⚔️ Arène Mondiale</h1>
          </div>

          <div className="arena-elo-card">
            <div className="arena-elo-rating">{myElo?.rating ?? 1000}</div>
            <div className="arena-elo-label">Ton classement ELO</div>
            <div className="arena-elo-stats">
              <span>🏆 {myElo?.wins ?? 0}</span>
              <span>💀 {myElo?.losses ?? 0}</span>
              <span>🤝 {myElo?.draws ?? 0}</span>
            </div>
          </div>

          <div className="arena-duration">
            <div className="arena-duration-label">Durée du match</div>
            <div className="arena-duration-btns">
              {[180, 300, 600].map((s) => (
                <button
                  key={s}
                  className={`arena-dur-btn ${duration === s ? "active" : ""}`}
                  onClick={() => setDuration(s)}
                >
                  {s / 60} min
                </button>
              ))}
            </div>
          </div>

          <button className="arena-play-btn" onClick={startMatchmaking}>
            🌍 Trouver un adversaire
          </button>

          <div className="arena-leaderboard">
            <h2>🏆 Top 100 Mondial</h2>
            <div className="arena-lb-list">
              {(leaderboard ?? []).map((row, i) => (
                <div key={row.user_id} className={`arena-lb-row ${row.user_id === user?.id ? "me" : ""}`}>
                  <span className="arena-lb-rank">#{i + 1}</span>
                  <span className="arena-lb-name">{row.pseudo}</span>
                  <span className="arena-lb-rating">{row.rating}</span>
                  <span className="arena-lb-wl">{row.wins}V / {row.losses}D</span>
                </div>
              ))}
              {(!leaderboard || leaderboard.length === 0) && (
                <div className="arena-empty">Sois le premier sur le podium !</div>
              )}
            </div>
          </div>
        </div>
      )}

      {view === "queue" && (
        <QueueScreen onCancel={cancelQueue} />
      )}

      {view === "match" && matchId && (
        <MatchScreen
          matchId={matchId}
          onFinish={() => setView("result")}
        />
      )}

      {view === "result" && matchId && (
        <ResultScreen
          matchId={matchId}
          onAgain={() => { setMatchId(null); setView("lobby"); }}
        />
      )}
    </div>
  );
}

function QueueScreen({ onCancel }: { onCancel: () => void }) {
  const [dots, setDots] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const i = setInterval(() => {
      setDots((d) => (d + 1) % 4);
      setElapsed((e) => e + 1);
    }, 500);
    return () => clearInterval(i);
  }, []);
  return (
    <div className="arena-queue">
      <div className="arena-queue-spinner">🚕</div>
      <div className="arena-queue-text">
        Recherche d'un adversaire{".".repeat(dots)}
      </div>
      <div className="arena-queue-sub">Temps d'attente : {Math.floor(elapsed / 2)}s</div>
      <button className="arena-cancel-btn" onClick={onCancel}>Annuler</button>
    </div>
  );
}

function MatchScreen({ matchId, onFinish }: { matchId: string; onFinish: () => void }) {
  const { user } = useAuth();
  const stateFn = useServerFn(getMatchState);
  const submitFn = useServerFn(submitMatchEvent);
  const finishFn = useServerFn(finishMatch);

  const [match, setMatch] = useState<MpMatch | null>(null);
  const [players, setPlayers] = useState<MpPlayer[]>([]);
  const [now, setNow] = useState(Date.now());
  const [lastClick, setLastClick] = useState(0);
  const [flash, setFlash] = useState<{ amount: number; ts: number } | null>(null);
  const [oppFlash, setOppFlash] = useState<{ amount: number; ts: number } | null>(null);
  const finishedRef = useRef(false);

  const me = useMemo(() => players.find((p) => p.user_id === user?.id), [players, user]);
  const opp = useMemo(() => players.find((p) => p.user_id !== user?.id), [players, user]);

  // Initial load
  useEffect(() => {
    stateFn({ data: { matchId } }).then((s) => {
      setMatch(s.match);
      setPlayers(s.players);
    }).catch(() => {});
  }, [matchId, stateFn]);

  // Realtime sub
  useEffect(() => {
    const ch = supabase
      .channel(`mp-match-${matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mp_match_players", filter: `match_id=eq.${matchId}` },
        (payload: any) => {
          const row = payload.new as MpPlayer;
          setPlayers((prev) => {
            const idx = prev.findIndex((p) => p.user_id === row.user_id);
            if (idx === -1) return [...prev, row];
            const copy = [...prev]; copy[idx] = row; return copy;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mp_match_events", filter: `match_id=eq.${matchId}` },
        (payload: any) => {
          const row = payload.new;
          if (row.user_id !== user?.id) {
            setOppFlash({ amount: row.amount, ts: Date.now() });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mp_matches", filter: `id=eq.${matchId}` },
        (payload: any) => setMatch(payload.new as MpMatch),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId, user]);

  // Tick
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const endsAt = match ? new Date(match.started_at).getTime() + match.duration_sec * 1000 : 0;
  const remaining = Math.max(0, Math.floor((endsAt - now) / 1000));

  // Auto-finish
  useEffect(() => {
    if (!match || finishedRef.current) return;
    if (remaining <= 0 && match.status === "active") {
      finishedRef.current = true;
      finishFn({ data: { matchId } }).then(() => onFinish()).catch(() => {
        setTimeout(() => onFinish(), 1000);
      });
    }
    if (match.status === "finished") {
      finishedRef.current = true;
      onFinish();
    }
  }, [remaining, match, finishFn, matchId, onFinish]);

  // Compute deterministic next fare from seed + missions_completed
  function computeFare(seed: number, idx: number): number {
    const x = Math.abs(Math.sin(seed * 9301 + idx * 49297 + 233280) * 100000);
    return 25 + Math.floor((x % 71));
  }

  const cooldownMs = 8000;
  const sinceClick = now - lastClick;
  const canClick = sinceClick >= cooldownMs && remaining > 0 && me;
  const cooldownRemaining = Math.max(0, cooldownMs - sinceClick);

  async function takeRide() {
    if (!canClick || !me || !match) return;
    const fare = computeFare(match.seed, me.missions_completed);
    setLastClick(Date.now());
    setFlash({ amount: fare, ts: Date.now() });
    try {
      await submitFn({ data: { matchId, amount: fare } });
    } catch (e: any) {
      console.error("submit", e);
    }
  }

  const diff = (me?.score ?? 0) - (opp?.score ?? 0);

  return (
    <div className="arena-match">
      <div className="match-timer">
        ⏱️ {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
      </div>

      <div className="match-scoreboard">
        <PlayerCard player={me} side="me" isMe />
        <div className="match-vs">VS</div>
        <PlayerCard player={opp} side="opp" />
      </div>

      <div className={`match-diff ${diff > 0 ? "winning" : diff < 0 ? "losing" : ""}`}>
        {diff > 0 ? `+${diff}€ d'avance` : diff < 0 ? `${diff}€ de retard` : "Égalité"}
      </div>

      <div className="match-action">
        <button
          className={`match-take-ride ${!canClick ? "cd" : ""}`}
          onClick={takeRide}
          disabled={!canClick}
        >
          {canClick ? "🚕 PRENDRE UNE COURSE" : `⏳ ${Math.ceil(cooldownRemaining / 1000)}s`}
        </button>
        <div className="match-hint">Tape le plus de courses possible avant la fin !</div>
      </div>

      {flash && Date.now() - flash.ts < 1500 && (
        <div className="match-flash me-flash" key={`me-${flash.ts}`}>
          +{flash.amount}€
        </div>
      )}
      {oppFlash && Date.now() - oppFlash.ts < 1500 && (
        <div className="match-flash opp-flash" key={`opp-${oppFlash.ts}`}>
          Adversaire +{oppFlash.amount}€
        </div>
      )}
    </div>
  );
}

function PlayerCard({ player, side, isMe }: { player: MpPlayer | undefined; side: "me" | "opp"; isMe?: boolean }) {
  return (
    <div className={`pc pc-${side}`}>
      <div className="pc-name">{isMe ? "TOI" : (player?.pseudo ?? "...")}</div>
      <div className="pc-score">{player?.score ?? 0}€</div>
      <div className="pc-rides">{player?.missions_completed ?? 0} courses</div>
    </div>
  );
}

function ResultScreen({ matchId, onAgain }: { matchId: string; onAgain: () => void }) {
  const { user } = useAuth();
  const stateFn = useServerFn(getMatchState);
  const { data } = useQuery({
    queryKey: ["mp-result", matchId],
    queryFn: () => stateFn({ data: { matchId } }),
    refetchInterval: 2000,
  });

  const me = data?.players.find((p) => p.user_id === user?.id);
  const opp = data?.players.find((p) => p.user_id !== user?.id);
  const status = data?.match.status;
  const winnerId = data?.match.winner_id;
  const isWin = winnerId === user?.id;
  const isDraw = status === "finished" && !winnerId;

  const eloDelta = me?.elo_after != null ? me.elo_after - me.elo_before : null;

  return (
    <div className="arena-result">
      <div className="result-title">
        {status !== "finished" && "Calcul du résultat..."}
        {isWin && "🏆 VICTOIRE !"}
        {!isWin && !isDraw && status === "finished" && "💀 Défaite"}
        {isDraw && "🤝 Égalité"}
      </div>

      <div className="result-scores">
        <div className="result-row">
          <span>Toi</span>
          <span>{me?.score ?? 0}€ — {me?.missions_completed ?? 0} courses</span>
        </div>
        <div className="result-row">
          <span>{opp?.pseudo ?? "Adversaire"}</span>
          <span>{opp?.score ?? 0}€ — {opp?.missions_completed ?? 0} courses</span>
        </div>
      </div>

      {eloDelta != null && (
        <div className={`result-elo ${eloDelta > 0 ? "up" : eloDelta < 0 ? "down" : ""}`}>
          ELO : {me?.elo_before} → {me?.elo_after} ({eloDelta > 0 ? "+" : ""}{eloDelta})
        </div>
      )}

      <button className="arena-play-btn" onClick={onAgain}>
        ↻ Rejouer
      </button>
    </div>
  );
}

const styles = `
  .arena-root {
    position: fixed; inset: 0; z-index: 9999;
    background: linear-gradient(180deg, #0a0c10 0%, #1a1208 100%);
    color: #fff7d6;
    font-family: system-ui, -apple-system, sans-serif;
    overflow-y: auto;
    padding: 16px;
    box-sizing: border-box;
  }
  .arena-lobby { max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
  .arena-header { display: flex; align-items: center; gap: 12px; }
  .arena-back { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-weight: 700; }
  .arena-title { font-size: 24px; font-weight: 900; color: #f5c542; margin: 0; flex: 1; text-align: center; }
  .arena-elo-card { background: linear-gradient(180deg, #1f2937, #111827); border: 2px solid #f5c542; border-radius: 16px; padding: 20px; text-align: center; }
  .arena-elo-rating { font-size: 48px; font-weight: 900; color: #f5c542; line-height: 1; }
  .arena-elo-label { color: #94a3b8; font-size: 13px; margin-top: 4px; }
  .arena-elo-stats { display: flex; justify-content: center; gap: 18px; margin-top: 12px; font-weight: 700; font-size: 15px; }
  .arena-duration { background: rgba(0,0,0,0.3); border-radius: 12px; padding: 14px; }
  .arena-duration-label { font-size: 13px; color: #94a3b8; margin-bottom: 8px; text-align: center; }
  .arena-duration-btns { display: flex; gap: 8px; }
  .arena-dur-btn { flex: 1; padding: 10px; background: rgba(255,255,255,0.05); border: 2px solid #374151; color: #fff; border-radius: 8px; cursor: pointer; font-weight: 700; }
  .arena-dur-btn.active { background: #f5c542; color: #1a1208; border-color: #fde047; }
  .arena-play-btn { background: linear-gradient(180deg, #f5c542, #e0a92a); color: #1a1208; border: 2px solid #fde047; padding: 18px; border-radius: 16px; font-size: 20px; font-weight: 900; cursor: pointer; box-shadow: 0 6px 0 #8a6510; text-transform: uppercase; letter-spacing: 1px; }
  .arena-play-btn:active { transform: translateY(4px); box-shadow: 0 2px 0 #8a6510; }
  .arena-leaderboard { background: rgba(0,0,0,0.3); border-radius: 12px; padding: 14px; }
  .arena-leaderboard h2 { font-size: 16px; margin: 0 0 10px; color: #f5c542; }
  .arena-lb-list { display: flex; flex-direction: column; gap: 4px; max-height: 320px; overflow-y: auto; }
  .arena-lb-row { display: grid; grid-template-columns: 40px 1fr 60px 80px; gap: 8px; padding: 8px 10px; background: rgba(255,255,255,0.04); border-radius: 6px; font-size: 13px; align-items: center; }
  .arena-lb-row.me { background: rgba(245,197,66,0.2); border: 1px solid #f5c542; }
  .arena-lb-rank { font-weight: 900; color: #f5c542; }
  .arena-lb-name { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .arena-lb-rating { font-weight: 900; text-align: right; }
  .arena-lb-wl { font-size: 11px; color: #94a3b8; text-align: right; }
  .arena-empty { text-align: center; padding: 20px; color: #94a3b8; }

  .arena-queue { max-width: 360px; margin: 80px auto; display: flex; flex-direction: column; align-items: center; gap: 20px; }
  .arena-queue-spinner { font-size: 72px; animation: bounce 1s infinite; }
  @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
  .arena-queue-text { font-size: 22px; font-weight: 900; color: #f5c542; }
  .arena-queue-sub { color: #94a3b8; }
  .arena-cancel-btn { background: rgba(239,68,68,0.2); border: 2px solid #ef4444; color: #fca5a5; padding: 12px 24px; border-radius: 10px; cursor: pointer; font-weight: 700; }

  .arena-match { max-width: 480px; margin: 0 auto; padding-top: 16px; display: flex; flex-direction: column; gap: 18px; position: relative; }
  .match-timer { font-size: 36px; font-weight: 900; color: #f5c542; text-align: center; font-variant-numeric: tabular-nums; }
  .match-scoreboard { display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: center; }
  .pc { background: linear-gradient(180deg, #1f2937, #111827); border-radius: 12px; padding: 14px; text-align: center; }
  .pc-me { border: 2px solid #10b981; }
  .pc-opp { border: 2px solid #ef4444; }
  .pc-name { font-size: 12px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  .pc-score { font-size: 32px; font-weight: 900; color: #f5c542; margin: 4px 0; }
  .pc-rides { font-size: 11px; color: #94a3b8; }
  .match-vs { font-size: 20px; font-weight: 900; color: #f5c542; }
  .match-diff { text-align: center; font-size: 18px; font-weight: 900; padding: 8px; border-radius: 8px; background: rgba(255,255,255,0.05); }
  .match-diff.winning { color: #10b981; background: rgba(16,185,129,0.15); }
  .match-diff.losing { color: #ef4444; background: rgba(239,68,68,0.15); }
  .match-action { display: flex; flex-direction: column; gap: 8px; align-items: center; margin-top: 12px; }
  .match-take-ride { width: 100%; padding: 28px; font-size: 22px; font-weight: 900; background: linear-gradient(180deg, #f5c542, #e0a92a); color: #1a1208; border: 3px solid #fde047; border-radius: 18px; cursor: pointer; box-shadow: 0 8px 0 #8a6510; letter-spacing: 1px; }
  .match-take-ride.cd { background: linear-gradient(180deg, #4b5563, #1f2937); color: #94a3b8; border-color: #4b5563; box-shadow: 0 4px 0 #111827; cursor: not-allowed; }
  .match-take-ride:not(.cd):active { transform: translateY(5px); box-shadow: 0 3px 0 #8a6510; }
  .match-hint { color: #94a3b8; font-size: 13px; }
  .match-flash { position: fixed; top: 30%; left: 50%; transform: translateX(-50%); padding: 12px 24px; border-radius: 12px; font-size: 28px; font-weight: 900; pointer-events: none; animation: floatUp 1.5s ease-out forwards; z-index: 10000; }
  .me-flash { background: #10b981; color: #fff; }
  .opp-flash { background: #ef4444; color: #fff; top: 40%; font-size: 18px; }
  @keyframes floatUp { 0% { opacity: 0; transform: translate(-50%, 20px); } 20% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; transform: translate(-50%, -60px); } }

  .arena-result { max-width: 400px; margin: 60px auto; display: flex; flex-direction: column; gap: 18px; text-align: center; background: linear-gradient(180deg, #1f2937, #111827); border: 2px solid #f5c542; border-radius: 16px; padding: 28px; }
  .result-title { font-size: 32px; font-weight: 900; color: #f5c542; }
  .result-scores { display: flex; flex-direction: column; gap: 8px; }
  .result-row { display: flex; justify-content: space-between; padding: 10px 14px; background: rgba(255,255,255,0.05); border-radius: 8px; font-weight: 700; }
  .result-elo { font-size: 18px; font-weight: 900; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.05); }
  .result-elo.up { color: #10b981; }
  .result-elo.down { color: #ef4444; }
`;
