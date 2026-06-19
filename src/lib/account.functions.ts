import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Supprime définitivement le compte de l'utilisateur connecté :
 * profil, scores, rôles, et compte auth.
 */
export const deleteOwnAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Nettoyer les données applicatives (RLS bypass via service role)
    await supabaseAdmin.from("daily_scores").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    // 2) Supprimer l'avatar dans le storage (best effort)
    try {
      const { data: files } = await supabaseAdmin.storage
        .from("avatars")
        .list(userId);
      if (files && files.length > 0) {
        const paths = files.map((f) => `${userId}/${f.name}`);
        await supabaseAdmin.storage.from("avatars").remove(paths);
      }
    } catch {
      // ignore
    }

    // 3) Supprimer le compte auth
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
