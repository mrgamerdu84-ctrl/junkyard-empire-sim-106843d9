// Météo réelle + jour/nuit basés sur la position du joueur.
// Sources gratuites sans clé : Open-Meteo (météo), BigDataCloud (reverse-geo), ipapi (fallback IP).

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

const STORAGE_POS = "jce.realenv.pos";
const STORAGE_ENV = "jce.realenv.cache";
const EVENT = "jce:realenv-changed";

function mapWeatherCode(code: number): WeatherKind {
  if (code === 0) return "clear";
  if (code <= 3) return "clouds";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 95) return "storm";
  return "clouds";
}

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

async function getPosition(): Promise<{ lat: number; lon: number; source: "geo" | "ip" }> {
  // 1) cache local
  try {
    const raw = localStorage.getItem(STORAGE_POS);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p.lat === "number" && typeof p.lon === "number" && Date.now() - p.t < 24 * 3600 * 1000) {
        return { lat: p.lat, lon: p.lon, source: p.source ?? "geo" };
      }
    }
  } catch {}

  // 2) géoloc navigateur
  const geo: { lat: number; lon: number } | null = await new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    const timeout = window.setTimeout(() => resolve(null), 4000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(timeout);
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {
        window.clearTimeout(timeout);
        resolve(null);
      },
      { enableHighAccuracy: false, maximumAge: 3600_000, timeout: 4000 }
    );
  });
  if (geo) {
    try { localStorage.setItem(STORAGE_POS, JSON.stringify({ ...geo, source: "geo", t: Date.now() })); } catch {}
    return { ...geo, source: "geo" };
  }

  // 3) fallback IP geo
  try {
    const r = await fetch("https://ipapi.co/json/");
    if (r.ok) {
      const j = await r.json();
      if (typeof j.latitude === "number" && typeof j.longitude === "number") {
        const pos = { lat: j.latitude, lon: j.longitude, source: "ip" as const };
        try { localStorage.setItem(STORAGE_POS, JSON.stringify({ ...pos, t: Date.now() })); } catch {}
        return pos;
      }
    }
  } catch {}

  // 4) ultime fallback : Paris
  return { lat: 48.8566, lon: 2.3522, source: "ip" };
}

async function reverseCity(lat: number, lon: number): Promise<{ city: string; country: string; population: number | null }> {
  let city = "Paris";
  let country = "France";
  try {
    const r = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=fr`
    );
    if (r.ok) {
      const j = await r.json();
      city = j.city || j.locality || j.principalSubdivision || city;
      country = j.countryName || country;
    }
  } catch {}
  // Population via Open-Meteo Geocoding (gratuit, sans clé)
  let population: number | null = null;
  try {
    const r = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&format=json`
    );
    if (r.ok) {
      const j = await r.json();
      const first = Array.isArray(j.results) && j.results.length > 0 ? j.results[0] : null;
      if (first && typeof first.population === "number") population = first.population;
    }
  } catch {}
  return { city, country, population };
}

async function fetchWeather(lat: number, lon: number): Promise<{ kind: WeatherKind; tempC: number | null; isDay: boolean }> {
  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day`
    );
    if (r.ok) {
      const j = await r.json();
      const c = j.current ?? {};
      return {
        kind: mapWeatherCode(Number(c.weather_code ?? 0)),
        tempC: typeof c.temperature_2m === "number" ? Math.round(c.temperature_2m) : null,
        isDay: Number(c.is_day) === 1,
      };
    }
  } catch {}
  // fallback : jour basé sur heure locale
  const h = new Date().getHours();
  return { kind: "clear", tempC: null, isDay: h >= 7 && h < 21 };
}

let refreshing = false;
export async function refreshRealWorldEnv(force = false): Promise<RealWorldEnv | null> {
  if (refreshing) return null;
  refreshing = true;
  try {
    // Cache 15 min sauf si force
    if (!force) {
      try {
        const raw = localStorage.getItem(STORAGE_ENV);
        if (raw) {
          const e = JSON.parse(raw) as RealWorldEnv;
          if (Date.now() - e.updatedAt < 15 * 60 * 1000) {
            window.dispatchEvent(new CustomEvent(EVENT, { detail: e }));
            return e;
          }
        }
      } catch {}
    }
    const pos = await getPosition();
    const [{ city, country, population }, weather] = await Promise.all([
      reverseCity(pos.lat, pos.lon),
      fetchWeather(pos.lat, pos.lon),
    ]);
    const env: RealWorldEnv = {
      city,
      country,
      population,
      weather: weather.kind,
      tempC: weather.tempC,
      isDay: weather.isDay,
      updatedAt: Date.now(),
      source: pos.source,
    };
    try { localStorage.setItem(STORAGE_ENV, JSON.stringify(env)); } catch {}
    window.dispatchEvent(new CustomEvent(EVENT, { detail: env }));
    return env;
  } finally {
    refreshing = false;
  }
}

export function useRealWorldEnv(): RealWorldEnv | null {
  const [env, setEnv] = useState<RealWorldEnv | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_ENV);
      return raw ? (JSON.parse(raw) as RealWorldEnv) : null;
    } catch { return null; }
  });
  useEffect(() => {
    const handler = (e: Event) => setEnv((e as CustomEvent<RealWorldEnv>).detail);
    window.addEventListener(EVENT, handler);
    refreshRealWorldEnv(false);
    const id = window.setInterval(() => refreshRealWorldEnv(false), 15 * 60 * 1000);
    return () => { window.removeEventListener(EVENT, handler); window.clearInterval(id); };
  }, []);
  return env;
}

export const REAL_ENV_EVENT = EVENT;
