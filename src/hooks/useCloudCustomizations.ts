import { useEffect, useRef, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getMyCustomizations, saveMyCustomizations } from "@/lib/customizations.functions";


const CUSTOM_VEHICLES_KEY = "jce.customVehicles";
const CUSTOM_PED_KEY = "jce.customPedestrians";
const ARMORED_SPRITE_KEY = "jce.armored.sprite";
const OVERRIDE_KEY = "jce.assetOverrides";

const VEHICLES_EVT = "jce.customVehicles.changed";
const PED_EVT = "jce.customPedestrians.changed";
const SPRITE_EVT = "jce:armored-sprite-changed";
const OVERRIDES_EVT = "jce.assetOverrides.changed";

type LocalSnapshot = {
  custom_vehicles: unknown[];
  custom_pedestrians: unknown[];
  armored_sprite: string | null;
  asset_overrides: Record<string, unknown>;
};

function readLocal(): LocalSnapshot {
  try {
    return {
      custom_vehicles: JSON.parse(localStorage.getItem(CUSTOM_VEHICLES_KEY) ?? "[]") as unknown[],
      custom_pedestrians: JSON.parse(localStorage.getItem(CUSTOM_PED_KEY) ?? "[]") as unknown[],
      armored_sprite: localStorage.getItem(ARMORED_SPRITE_KEY),
      asset_overrides: JSON.parse(localStorage.getItem(OVERRIDE_KEY) ?? "{}") as Record<string, unknown>,
    };
  } catch {
    return { custom_vehicles: [], custom_pedestrians: [], armored_sprite: null, asset_overrides: {} };
  }
}

/**
 * Synchronise les personnalisations (véhicules, piétons, sprite blindé, overrides)
 * entre le localStorage du joueur et le cloud Lovable — pour que tout suive sur tous
 * ses appareils dès qu'il se connecte.
 */
export function useCloudCustomizations() {
  const { user } = useAuth();
  const fetchCustom = useServerFn(getMyCustomizations);
  const saveCustom = useServerFn(saveMyCustomizations);
  const hydratedFor = useRef<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const lastSaved = useRef<string>("");

  // Applique un snapshot cloud au localStorage et notifie les écouteurs.
  // ⚠️ Merge conservateur : les valeurs locales (rotations récentes,
  // véhicules ajoutés sur cet appareil) ne sont JAMAIS écrasées par le cloud —
  // sinon une rotation faite juste avant un reload disparaîtrait si le push
  // debouncé n'a pas eu le temps de partir.
  const applyCloud = useCallback((cloud: {
    custom_vehicles?: unknown;
    custom_pedestrians?: unknown;
    armored_sprite?: string | null;
    asset_overrides?: unknown;
  } | null) => {
    if (!cloud) return;
    try {
      const local = readLocal();

      // Overrides : union, local prioritaire (rotations, remplacements).
      const cloudOv = (cloud.asset_overrides ?? {}) as Record<string, unknown>;
      const mergedOv = { ...cloudOv, ...local.asset_overrides };

      // Véhicules / piétons : union par id, local prioritaire.
      const mergeById = (a: unknown[], b: unknown[]) => {
        const map = new Map<string, unknown>();
        for (const it of a) { const id = (it as { id?: string })?.id; if (id) map.set(id, it); }
        for (const it of b) { const id = (it as { id?: string })?.id; if (id) map.set(id, it); }
        return [...map.values()];
      };
      const mergedVeh = mergeById((cloud.custom_vehicles as unknown[]) ?? [], local.custom_vehicles);
      const mergedPed = mergeById((cloud.custom_pedestrians as unknown[]) ?? [], local.custom_pedestrians);

      // Sprite blindé : local prioritaire s'il existe.
      const mergedSprite = local.armored_sprite ?? cloud.armored_sprite ?? null;

      localStorage.setItem(CUSTOM_VEHICLES_KEY, JSON.stringify(mergedVeh));
      localStorage.setItem(CUSTOM_PED_KEY, JSON.stringify(mergedPed));
      if (mergedSprite) localStorage.setItem(ARMORED_SPRITE_KEY, mergedSprite);
      else localStorage.removeItem(ARMORED_SPRITE_KEY);
      localStorage.setItem(OVERRIDE_KEY, JSON.stringify(mergedOv));
    } catch { /* noop */ }
    window.dispatchEvent(new Event(VEHICLES_EVT));
    window.dispatchEvent(new Event(PED_EVT));
    window.dispatchEvent(new CustomEvent(SPRITE_EVT));
    window.dispatchEvent(new Event(OVERRIDES_EVT));
    const local = readLocal();
    lastSaved.current = JSON.stringify({
      v: local.custom_vehicles,
      p: local.custom_pedestrians,
      s: local.armored_sprite,
      o: local.asset_overrides,
    });
    // Après merge, on repush pour que le cloud reflète l'union.
    schedulePush();
  }, []);

  // Pull cloud → local au login
  useEffect(() => {
    if (!user) {
      hydratedFor.current = null;
      return;
    }
    if (hydratedFor.current === user.id) return;
    hydratedFor.current = user.id;

    let cancelled = false;
    (async () => {
      try {
        const cloud = await fetchCustom();
        if (cancelled) return;
        if (cloud) applyCloud(cloud);
        else schedulePush();
      } catch (e) {
        console.warn("[customizations] cloud pull failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [user, fetchCustom, applyCloud]);

  // Push local → cloud (debounced)
  const schedulePush = () => {
    if (!user) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const local = readLocal();
      const snap = JSON.stringify({
        v: local.custom_vehicles,
        p: local.custom_pedestrians,
        s: local.armored_sprite,
        o: local.asset_overrides,
      });
      if (snap === lastSaved.current) return;
      lastSaved.current = snap;
      try {
        await saveCustom({ data: local as never });
      } catch (e) {
        console.warn("[customizations] cloud push failed", e);
      }
    }, 800);
  };

  useEffect(() => {
    if (!user) return;
    const onChange = () => schedulePush();
    window.addEventListener(VEHICLES_EVT, onChange);
    window.addEventListener(PED_EVT, onChange);
    window.addEventListener(SPRITE_EVT, onChange);
    window.addEventListener(OVERRIDES_EVT, onChange);
    return () => {
      window.removeEventListener(VEHICLES_EVT, onChange);
      window.removeEventListener(PED_EVT, onChange);
      window.removeEventListener(SPRITE_EVT, onChange);
      window.removeEventListener(OVERRIDES_EVT, onChange);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Realtime : si un autre appareil du même joueur modifie ses personnalisations,
  // on récupère la nouvelle version sans rechargement.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`user_customizations:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_customizations", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as {
            custom_vehicles?: unknown;
            custom_pedestrians?: unknown;
            armored_sprite?: string | null;
            asset_overrides?: unknown;
          } | null;
          if (!row) return;
          applyCloud(row);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, applyCloud]);

  // Refetch quand l'onglet redevient visible — filet si le canal a sauté.
  useEffect(() => {
    if (!user) return;
    const onFocus = async () => {
      try {
        const cloud = await fetchCustom();
        if (cloud) applyCloud(cloud);
      } catch { /* noop */ }
    };
    window.addEventListener("focus", onFocus);
    const onVis = () => { if (document.visibilityState === "visible") onFocus(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user, fetchCustom, applyCloud]);
}

