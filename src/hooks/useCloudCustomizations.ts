import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/useAuth";
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
        if (cloud) {
          try {
            localStorage.setItem(CUSTOM_VEHICLES_KEY, JSON.stringify(cloud.custom_vehicles ?? []));
            localStorage.setItem(CUSTOM_PED_KEY, JSON.stringify(cloud.custom_pedestrians ?? []));
            if (cloud.armored_sprite) localStorage.setItem(ARMORED_SPRITE_KEY, cloud.armored_sprite);
            else localStorage.removeItem(ARMORED_SPRITE_KEY);
            localStorage.setItem(OVERRIDE_KEY, JSON.stringify(cloud.asset_overrides ?? {}));
          } catch { /* noop */ }
          // Notifie les écouteurs du jeu
          window.dispatchEvent(new Event(VEHICLES_EVT));
          window.dispatchEvent(new Event(PED_EVT));
          window.dispatchEvent(new CustomEvent(SPRITE_EVT));
          window.dispatchEvent(new Event(OVERRIDES_EVT));
          // Recharger la page pour appliquer les overrides figés au chargement
          // (les overrides d'assets sont lus une seule fois au mount de gameAssets)
          const localBefore = readLocal();
          lastSaved.current = JSON.stringify({
            v: localBefore.custom_vehicles,
            p: localBefore.custom_pedestrians,
            s: localBefore.armored_sprite,
            o: localBefore.asset_overrides,
          });
        } else {
          // Pas de ligne cloud → on pousse l'état local existant
          schedulePush();
        }
      } catch (e) {
        console.warn("[customizations] cloud pull failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [user, fetchCustom]);

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
}
