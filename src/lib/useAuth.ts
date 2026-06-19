import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { refreshLicense } from "@/lib/license";

export type AvatarKind = "man" | "woman" | "photo";

export type AuthState = {
  user: User | null;
  pseudo: string;
  driverName: string;
  avatarKind: AvatarKind;
  avatarUrl: string | null;
  licenseLevel: number;
  licenseXp: number;
  loading: boolean;
  refresh: () => Promise<void>;
};

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [pseudo, setPseudo] = useState<string>("Chauffeur");
  const [driverName, setDriverName] = useState<string>("");
  const [avatarKind, setAvatarKind] = useState<AvatarKind>("man");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [licenseLevel, setLicenseLevel] = useState<number>(1);
  const [licenseXp, setLicenseXp] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("pseudo, driver_name, avatar_kind, avatar_url, license_level, license_xp")
      .eq("id", uid)
      .maybeSingle();
    if (!data) return;
    if (data.pseudo) setPseudo(data.pseudo);
    setDriverName((data as any).driver_name ?? "");
    if (data.avatar_kind) setAvatarKind(data.avatar_kind as AvatarKind);
    setLicenseLevel((data as any).license_level ?? 1);
    setLicenseXp((data as any).license_xp ?? 0);
    if (data.avatar_kind === "photo" && data.avatar_url) {
      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrl(data.avatar_url, 60 * 60);
      setAvatarUrl(signed?.signedUrl ?? null);
    } else {
      setAvatarUrl(null);
    }
    // sync le cache permis partagé (utilisé par le jeu)
    refreshLicense();
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
      else {
        setPseudo("Chauffeur"); setDriverName(""); setAvatarKind("man"); setAvatarUrl(null);
        setLicenseLevel(1); setLicenseXp(0);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      if (data.session?.user) fetchProfile(data.session.user.id);
      setLoading(false);
    });

    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [fetchProfile]);

  return { user, pseudo, driverName, avatarKind, avatarUrl, licenseLevel, licenseXp, loading, refresh };
}

export async function signOut() {
  await supabase.auth.signOut();
}
