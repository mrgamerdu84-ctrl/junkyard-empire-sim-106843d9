// Météo/localisation temporairement désactivées pour stabiliser le jeu.
// Le module garde la même API, mais ne lance plus de géolocalisation ni d'appels réseau.

import { useEffect, useState } from "react";

export type WeatherKind = "clear" | "clouds" | "rain" | "snow" | "fog" | "storm";

export type RealWorldEnv = {
  city: string;
  country: string;
  population: number | null;
  weather: WeatherKind;
  tempC: number | null;
  isDay: boolean;
  updatedAt: number;
  source: "geo" | "ip" | "fallback";
};

const EVENT = "jce:realenv-changed";

const STATIC_ENV: RealWorldEnv = {
  city: "Ville",
  country: "Jeu",
  population: null,
  weather: "clear",
  tempC: null,
  isDay: true,
  updatedAt: Date.now(),
  source: "fallback",
};

export function weatherLabelFr(w: WeatherKind): string {
  switch (w) {
    case "clear": return "ciel dégagé";
    case "clouds": return "ciel nuageux";
    case "rain": return "pluie";
    case "snow": return "neige";
    case "fog": return "brouillard";
    case "storm": return "orage";
  }
}

export function weatherLabelEn(w: WeatherKind): string {
  switch (w) {
    case "clear": return "clear skies";
    case "clouds": return "cloudy";
    case "rain": return "rainy";
    case "snow": return "snowy";
    case "fog": return "foggy";
    case "storm": return "stormy";
  }
}

export async function refreshRealWorldEnv(_force = false): Promise<RealWorldEnv | null> {
  const env = { ...STATIC_ENV, updatedAt: Date.now() };
  try { window.dispatchEvent(new CustomEvent(EVENT, { detail: env })); } catch {}
  return env;
}

export function useRealWorldEnv(): RealWorldEnv | null {
  const [env, setEnv] = useState<RealWorldEnv | null>(() => ({ ...STATIC_ENV, updatedAt: Date.now() }));
  useEffect(() => {
    const next = { ...STATIC_ENV, updatedAt: Date.now() };
    setEnv(next);
    try { window.dispatchEvent(new CustomEvent(EVENT, { detail: next })); } catch {}
  }, []);
  return env;
}

export const REAL_ENV_EVENT = EVENT;
