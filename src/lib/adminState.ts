// =============================================================
// Sync de l'état du panel admin vers Supabase (par utilisateur).
// - useIsAdmin() : check du rôle 'admin' via la table user_roles.
// - useCloudAdminSync() : hydrate l'état local depuis la base au login,
//   puis push debouncé à chaque changement local (concurrents, véhicules,
//   config). Expose aussi pushNow() / pullNow() pour les boutons manuels.
// =============================================================
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  setAdmin,
  subscribeAdmin,
  getAdmin,
  type AdminConfig,
} from "@/game/adminConfig";
import {
  listCustomVehicles,
  addCustomVehicle,
  removeCustomVehicle,
  type CustomVehicle,
} from "@/game/gameAssets";
import type { User } from "@supabase/supabase-js";

export type CloudCompetitor = {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  treasury: number;
  taxiCount: number;
  bankrupt: boolean;
  /** Optionnel : sprite vue du ciel pour les taxis rivaux de ce concurrent (data URL ou URL CDN). */
  vehicleUrl?: string;
};

export type AdminStateRow = {
  competitors: CloudCompetitor[];
  custom_vehicles: CustomVehicle[];
  config: Partial<AdminConfig>;
};

const COMPS_EVENT = "jce:competitors-set"; // cloud → CityCompetitors

export function getLocalCompetitors(): CloudCompetitor[] {
  const w = window as unknown as { __jceCompetitors?: CloudCompetitor[] };
  return Array.isArray(w.__jceCompetitors) ? w.__jceCompetitors : [];
}

export function setCompetitorsFromCloud(comps: CloudCompetitor[]) {
  window.dispatchEvent(new CustomEvent(COMPS_EVENT, { detail: comps }));
}

/** Hook : true si l'utilisateur connecté a le rôle 'admin'. */
export function useIsAdmin(user: User | null): { isAdmin: boolean; loading: boolean } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        setIsAdmin(!!data);
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  return { isAdmin, loading };
}

async function fetchRow(userId: string): Promise<AdminStateRow | null> {
  const { data, error } = await supabase
    .from("admin_state")
    .select("competitors, custom_vehicles, config")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    competitors: ((data as any).competitors ?? []) as CloudCompetitor[],
    custom_vehicles: ((data as any).custom_vehicles ?? []) as CustomVehicle[],
    config: ((data as any).config ?? {}) as Partial<AdminConfig>,
  };
}

async function upsertRow(userId: string, row: AdminStateRow): Promise<void> {
  await supabase.from("admin_state").upsert(
    {
      user_id: userId,
      competitors: row.competitors as any,
      custom_vehicles: row.custom_vehicles as any,
      config: row.config as any,
    },
    { onConflict: "user_id" },
  );
}

function snapshot(): AdminStateRow {
  return {
    competitors: getLocalCompetitors(),
    custom_vehicles: listCustomVehicles(),
    config: getAdmin(),
  };
}

function applyToLocal(row: AdminStateRow) {
  // Config : merge des clés présentes.
  if (row.config && Object.keys(row.config).length > 0) {
    setAdmin(row.config as Partial<AdminConfig>);
  }
  // Véhicules : remplace l'ensemble local par celui du cloud.
  const local = listCustomVehicles();
  for (const v of local) removeCustomVehicle(v.id);
  for (const v of row.custom_vehicles ?? []) {
    addCustomVehicle({ id: v.id, name: v.name, url: v.url, category: v.category });
  }
  // Concurrents : event vers CityCompetitors.
  setCompetitorsFromCloud(row.competitors ?? []);
}

/**
 * Sync bidirectionnel discret :
 * - au mount/login → pullNow() (cloud écrase le local)
 * - puis tout changement local (config, véhicules, concurrents) → push debouncé
 */
export function useCloudAdminSync(user: User | null) {
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);

  const pullNow = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    setLastError(null);
    try {
      const row = await fetchRow(user.id);
      if (row) applyToLocal(row);
    } catch (e: any) {
      setLastError(e?.message ?? "Erreur sync");
    } finally {
      setSyncing(false);
    }
  }, [user?.id]);

  const pushNow = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    setLastError(null);
    try {
      await upsertRow(user.id, snapshot());
    } catch (e: any) {
      setLastError(e?.message ?? "Erreur sync");
    } finally {
      setSyncing(false);
    }
  }, [user?.id]);

  // Hydrate une seule fois par session/user.
  useEffect(() => {
    if (!user) {
      hydratedRef.current = false;
      return;
    }
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    void pullNow();
  }, [user?.id, pullNow]);

  // Push debouncé sur tout changement local.
  useEffect(() => {
    if (!user) return;
    const queuePush = () => {
      if (!hydratedRef.current) return; // ne pas écraser le cloud avant hydratation
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void pushNow();
      }, 800);
    };
    const unsubAdmin = subscribeAdmin(queuePush);
    const onCustom = () => queuePush();
    const onComps = () => queuePush();
    window.addEventListener("jce.customVehicles.changed", onCustom);
    window.addEventListener("jce:competitors-changed", onComps as EventListener);
    return () => {
      unsubAdmin();
      window.removeEventListener("jce.customVehicles.changed", onCustom);
      window.removeEventListener("jce:competitors-changed", onComps as EventListener);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [user?.id, pushNow]);

  return { syncing, lastError, pullNow, pushNow };
}
