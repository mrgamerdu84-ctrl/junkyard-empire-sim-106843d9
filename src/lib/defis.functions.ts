import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Defi = {
  id: string;
  creator_id: string;
  opponent_id: string;
  seed: number;
  duration_sec: number;
  creator_score: number | null;
  opponent_score: number | null;
  status: "pending" | "completed" | "expired";
  winner_id: string | null;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
};

export type DefiWithPeers = Defi & {
  creator_pseudo: string;
  opponent_pseudo: string;
};

export const findUserByPseudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pseudo: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .rpc("find_user_by_pseudo", { _pseudo: data.pseudo });
    if (error) throw new Error(error.message);
    return (rows && rows[0]) || null;
  });

export const createDefi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { opponentPseudo: string; durationSec?: number }) => d)
  .handler(async ({ data, context }) => {
    const { data: newId, error } = await context.supabase.rpc("create_defi", {
      _opponent_pseudo: data.opponentPseudo,
      _duration_sec: data.durationSec ?? 300,
    });
    if (error) throw new Error(error.message);
    return { id: newId as string };
  });

export const listMyDefis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Marque expirés au passage
    await context.supabase
      .from("defis")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString());

    const { data: defis, error } = await context.supabase
      .from("defis")
      .select("*")
      .or(`creator_id.eq.${context.userId},opponent_id.eq.${context.userId}`)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const ids = new Set<string>();
    (defis ?? []).forEach((d: any) => { ids.add(d.creator_id); ids.add(d.opponent_id); });
    const { data: profs } = await context.supabase
      .from("profiles")
      .select("id, pseudo")
      .in("id", Array.from(ids));
    const pseudoMap = new Map<string, string>();
    (profs ?? []).forEach((p: any) => pseudoMap.set(p.id, p.pseudo));

    return (defis ?? []).map((d: any) => ({
      ...d,
      creator_pseudo: pseudoMap.get(d.creator_id) ?? "?",
      opponent_pseudo: pseudoMap.get(d.opponent_id) ?? "?",
    })) as DefiWithPeers[];
  });

/**
 * Soumet une manche de défi. Le client n'envoie PAS de score €.
 * Il envoie uniquement (missions terminées, temps écoulé) — le serveur
 * recalcule le score depuis le seed du défi, avec plafond temps + plafond
 * physique (1 course / 8 s max).
 */
export const submitDefiRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { defiId: string; missionsCompleted: number; elapsedSec: number }) => d)
  .handler(async ({ data, context }) => {
    const { data: updated, error } = await (context.supabase as any).rpc("submit_defi_run", {
      _defi_id: data.defiId,
      _missions_completed: Math.max(0, Math.floor(data.missionsCompleted)),
      _elapsed_sec: Math.max(0, Math.floor(data.elapsedSec)),
    });
    if (error) throw new Error(error.message);
    return updated as Defi;
  });
