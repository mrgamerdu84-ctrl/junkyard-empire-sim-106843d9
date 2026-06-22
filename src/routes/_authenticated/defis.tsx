import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import {
  createDefi,
  listMyDefis,
  submitDefiRun,
  type DefiWithPeers,
} from "@/lib/defis.functions";

export const Route = createFileRoute("/_authenticated/defis")({
  head: () => ({
    meta: [
      { title: "Défis 1v1 — Junky Empire Taxi" },
      { name: "description", content: "Défie un autre chauffeur sur une partie de 5 minutes : qui rapportera le plus de fric ?" },
    ],
  }),
  component: DefisPage,
  errorComponent: ({ error }) => (
    <div style={{ padding: 24, color: "#fff7d6", textAlign: "center" }}>
      <h1>Erreur</h1>
      <p>{error.message}</p>
    </div>
  ),
  notFoundComponent: () => <div style={{ padding: 24, color: "#fff7d6" }}>Page introuvable</div>,
});

function DefisPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const list = useServerFn(listMyDefis);
  const create = useServerFn(createDefi);
  const submit = useServerFn(submitDefiRun);

  const { data: defis, isLoading, refetch } = useQuery({
    queryKey: ["defis"],
    queryFn: () => list(),
    refetchOnWindowFocus: true,
  });

  // Realtime : refresh à chaque changement de la table defis qui me concerne
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("defis-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "defis" },
        () => refetch(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, refetch]);

  const [opponentPseudo, setOpponentPseudo] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: async () => create({ data: { opponentPseudo: opponentPseudo.trim() } }),
    onSuccess: () => {
      setOpponentPseudo("");
      setCreateError(null);
      queryClient.invalidateQueries({ queryKey: ["defis"] });
    },
    onError: (e: any) => setCreateError(e?.message ?? "Erreur"),
  });

  const incoming = useMemo(() => (defis ?? []).filter(d => d.status === "pending" && d.opponent_id === user?.id && d.opponent_score === null), [defis, user]);
  const myPending = useMemo(() => (defis ?? []).filter(d => d.status === "pending" && d.creator_id === user?.id && d.creator_score === null), [defis, user]);
  const waiting = useMemo(() => (defis ?? []).filter(d => d.status === "pending" && ((d.creator_id === user?.id && d.creator_score !== null) || (d.opponent_id === user?.id && d.opponent_score !== null))), [defis, user]);
  const done = useMemo(() => (defis ?? []).filter(d => d.status === "completed" || d.status === "expired"), [defis]);

  const launchDefi = (d: DefiWithPeers) => {
    try {
      sessionStorage.setItem("mttw.activeDefi", JSON.stringify({
        id: d.id, seed: d.seed, durationSec: d.duration_sec,
      }));
    } catch {}
    router.navigate({ to: "/" });
  };

  const fakeSubmit = async (d: DefiWithPeers) => {
    // Tant que l'intégration jeu n'est pas branchée, on saisit la manche jouée.
    // Le serveur recalcule le score depuis le seed — le client ne peut PAS
    // envoyer un montant arbitraire en €.
    const rawMissions = prompt(`Nombre de courses terminées pendant ta manche :`, "0");
    if (rawMissions === null) return;
    const missionsCompleted = Math.max(0, Math.floor(Number(rawMissions) || 0));
    const rawElapsed = prompt(`Temps écoulé (en secondes, max ${d.duration_sec}) :`, String(d.duration_sec));
    if (rawElapsed === null) return;
    const elapsedSec = Math.max(0, Math.floor(Number(rawElapsed) || 0));
    setSubmitting(d.id);
    try {
      await submit({ data: { defiId: d.id, missionsCompleted, elapsedSec } });
      await refetch();
    } catch (e: any) {
      alert(e?.message ?? "Erreur");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#0f172a,#1f2937)", color: "#fff7d6", fontFamily: "system-ui, sans-serif", padding: "16px" }}>
      <style>{`
        .defi-card { background: linear-gradient(180deg,#1f2937,#111827); border: 2px solid #f5c542; border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
        .defi-btn { appearance:none; border:2px solid #fde047; cursor:pointer; background: linear-gradient(180deg,#f5c542,#e0a92a); color:#1a1208; font-weight:900; padding:10px 14px; border-radius:10px; box-shadow:0 4px 0 #8a6510; }
        .defi-btn.blue { background: linear-gradient(180deg,#3b82f6,#1d4ed8); color:#fff; border-color:#60a5fa; box-shadow:0 4px 0 #1e3a8a; }
        .defi-btn.green { background: linear-gradient(180deg,#10b981,#059669); color:#fff; border-color:#34d399; box-shadow:0 4px 0 #064e3b; }
        .defi-input { width:100%; padding:10px; border-radius:8px; border:2px solid #374151; background:#0f172a; color:#fff7d6; font-size:15px; }
        .defi-section-title { font-weight:900; color:#f5c542; font-size:14px; text-transform:uppercase; letter-spacing:1px; margin-top:14px; margin-bottom:6px; }
      `}</style>

      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ margin: 0, fontSize: 22, color: "#f5c542" }}>⚔️ Défis 1v1</h1>
          <button className="defi-btn" onClick={() => router.navigate({ to: "/" })}>🏠 Retour</button>
        </div>

        <div className="defi-card">
          <div style={{ fontWeight: 900, fontSize: 16 }}>🚖 Lancer un nouveau défi</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            Tape le pseudo d'un autre chauffeur. Vous aurez chacun 5 minutes pour faire le plus de fric. L'adversaire a 24 h pour relever le défi.
          </div>
          <input
            className="defi-input"
            placeholder="Pseudo de l'adversaire"
            value={opponentPseudo}
            onChange={e => setOpponentPseudo(e.target.value)}
            disabled={createMut.isPending}
          />
          {createError && <div style={{ color: "#fca5a5", fontSize: 12 }}>⚠️ {createError === "Opponent not found" ? "Pseudo introuvable" : createError}</div>}
          <button
            className="defi-btn green"
            disabled={!opponentPseudo.trim() || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            {createMut.isPending ? "Création…" : "⚔️ Défier ce joueur"}
          </button>
        </div>

        {isLoading && <div style={{ textAlign: "center", opacity: 0.7 }}>Chargement…</div>}

        {incoming.length > 0 && (
          <>
            <div className="defi-section-title">📨 Défis reçus ({incoming.length})</div>
            {incoming.map(d => (
              <DefiCard key={d.id} d={d} meId={user!.id} actionLabel="🎮 Jouer ma manche" onAction={() => launchDefi(d)} altLabel="✍️ Saisir score" onAlt={() => fakeSubmit(d)} submitting={submitting === d.id} />
            ))}
          </>
        )}

        {myPending.length > 0 && (
          <>
            <div className="defi-section-title">🚀 À jouer (j'ai lancé)</div>
            {myPending.map(d => (
              <DefiCard key={d.id} d={d} meId={user!.id} actionLabel="🎮 Jouer ma manche" onAction={() => launchDefi(d)} altLabel="✍️ Saisir score" onAlt={() => fakeSubmit(d)} submitting={submitting === d.id} />
            ))}
          </>
        )}

        {waiting.length > 0 && (
          <>
            <div className="defi-section-title">⏳ En attente de l'adversaire ({waiting.length})</div>
            {waiting.map(d => <DefiCard key={d.id} d={d} meId={user!.id} />)}
          </>
        )}

        {done.length > 0 && (
          <>
            <div className="defi-section-title">📜 Historique</div>
            {done.map(d => <DefiCard key={d.id} d={d} meId={user!.id} />)}
          </>
        )}

        {!isLoading && (defis?.length ?? 0) === 0 && (
          <div style={{ textAlign: "center", opacity: 0.7, marginTop: 24 }}>
            Aucun défi pour l'instant. Lance le premier ! 🥇
          </div>
        )}
      </div>
    </div>
  );
}

function DefiCard({
  d, meId,
  actionLabel, onAction,
  altLabel, onAlt,
  submitting,
}: {
  d: DefiWithPeers;
  meId: string;
  actionLabel?: string;
  onAction?: () => void;
  altLabel?: string;
  onAlt?: () => void;
  submitting?: boolean;
}) {
  const isCreator = d.creator_id === meId;
  const meScore = isCreator ? d.creator_score : d.opponent_score;
  const oppScore = isCreator ? d.opponent_score : d.creator_score;
  const oppPseudo = isCreator ? d.opponent_pseudo : d.creator_pseudo;
  const won = d.status === "completed" && d.winner_id === meId;
  const lost = d.status === "completed" && d.winner_id && d.winner_id !== meId;
  const draw = d.status === "completed" && d.winner_id === null;

  const expiresIn = () => {
    const ms = new Date(d.expires_at).getTime() - Date.now();
    if (ms <= 0) return "expiré";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h${m.toString().padStart(2,"0")}` : `${m}min`;
  };

  return (
    <div className="defi-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>
          {isCreator ? "Toi" : oppPseudo} vs {isCreator ? oppPseudo : "Toi"}
        </div>
        <div style={{ fontSize: 11, opacity: 0.7 }}>
          {d.status === "pending" && `Expire dans ${expiresIn()}`}
          {d.status === "expired" && "⌛ Expiré"}
          {d.status === "completed" && (won ? "🏆 Victoire" : lost ? "💀 Défaite" : draw ? "🤝 Égalité" : "")}
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 13 }}>
        <div>Toi : <strong>{meScore !== null ? `${meScore} €` : "—"}</strong></div>
        <div>{oppPseudo} : <strong>{oppScore !== null ? `${oppScore} €` : "—"}</strong></div>
      </div>
      <div style={{ fontSize: 11, opacity: 0.6 }}>
        Durée {Math.round(d.duration_sec/60)} min · seed #{d.seed.toString().slice(-6)}
      </div>
      {(onAction || onAlt) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {onAction && <button className="defi-btn green" onClick={onAction} disabled={submitting}>{actionLabel}</button>}
          {onAlt && <button className="defi-btn blue" onClick={onAlt} disabled={submitting}>{submitting ? "Envoi…" : altLabel}</button>}
        </div>
      )}
    </div>
  );
}
