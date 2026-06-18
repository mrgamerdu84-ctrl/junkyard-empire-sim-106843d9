import { useEffect, useState } from "react";

export type VersionInfo = { buildId: string; builtAt: number };

export type VersionCheckState = {
  local: VersionInfo | null;
  remote: VersionInfo | null;
  hasUpdate: boolean;
  loading: boolean;
  refresh: () => void;
};

// Stable Lovable URL — published build of this project.
const REMOTE_URL = "https://project--ab16a35f-e8a7-4c6d-9688-bfa3968869de.lovable.app/version.json";
const LOCAL_URL = "/version.json";

async function fetchJson(url: string): Promise<VersionInfo | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.builtAt === "number" && typeof data?.buildId === "string") {
      return data as VersionInfo;
    }
    return null;
  } catch {
    return null;
  }
}

export function useVersionCheck(): VersionCheckState {
  const [local, setLocal] = useState<VersionInfo | null>(null);
  const [remote, setRemote] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [l, r] = await Promise.all([fetchJson(LOCAL_URL), fetchJson(REMOTE_URL)]);
      if (cancelled) return;
      setLocal(l);
      setRemote(r);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const hasUpdate = !!(local && remote && remote.builtAt > local.builtAt + 60_000);

  return { local, remote, hasUpdate, loading, refresh: () => setTick((t) => t + 1) };
}

export function formatBuildDate(info: VersionInfo | null): string {
  if (!info) return "—";
  const d = new Date(info.builtAt);
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
