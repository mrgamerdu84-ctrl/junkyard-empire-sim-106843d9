import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AvatarKind = "man" | "woman" | "photo";

export type AuthState = {
  user: User | null;
  pseudo: string;
  avatarKind: AvatarKind;
  avatarUrl: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [pseudo, setPseudo] = useState<string>("Chauffeur");
  const [avatarKind, setAvatarKind] = useState<AvatarKind>("man");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("pseudo, avatar_kind, avatar_url")
      .eq("id", uid)
      .maybeSingle();
    if (!data) return;
    if (data.pseudo) setPseudo(data.pseudo);
    if (data.avatar_kind) setAvatarKind(data.avatar_kind as AvatarKind);
    if (data.avatar_kind === "photo" && data.avatar_url) {
      // Bucket privé : signer une URL pour pouvoir l'afficher.
      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrl(data.avatar_url, 60 * 60);
      setAvatarUrl(signed?.signedUrl ?? null);
    } else {
      setAvatarUrl(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else { setPseudo("Chauffeur"); setAvatarKind("man"); setAvatarUrl(null); }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      if (data.session?.user) fetchProfile(data.session.user.id);
      setLoading(false);
    });

    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [fetchProfile]);

  return { user, pseudo, avatarKind, avatarUrl, loading, refresh };
}

export async function signOut() {
  await supabase.auth.signOut();
}
