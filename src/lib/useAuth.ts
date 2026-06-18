import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AuthState = { user: User | null; pseudo: string; loading: boolean };

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [pseudo, setPseudo] = useState<string>("Chauffeur");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchPseudo = async (uid: string) => {
      const { data } = await supabase.from("profiles").select("pseudo").eq("id", uid).maybeSingle();
      if (mounted && data?.pseudo) setPseudo(data.pseudo);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (session?.user) fetchPseudo(session.user.id);
      else setPseudo("Chauffeur");
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      if (data.session?.user) fetchPseudo(data.session.user.id);
      setLoading(false);
    });

    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  return { user, pseudo, loading };
}

export async function signOut() {
  await supabase.auth.signOut();
}
