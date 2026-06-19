import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * TTS pour la Radio Infos du taxi.
 * POST { text: string, lang: "fr" | "en" }
 * → audio/mpeg (mp3) jouable directement par <audio>.
 *
 * Auth : Bearer JWT Supabase requis (évite l'abus de la clé LOVABLE_API_KEY).
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export const Route = createFileRoute("/api/public/radio-tts")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          // --- Auth check : exige un JWT Supabase valide ---
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
            return new Response("Auth not configured", { status: 503, headers: CORS });
          }
          const authHeader = request.headers.get("authorization") || "";
          if (!authHeader.startsWith("Bearer ")) {
            return new Response("Unauthorized", { status: 401, headers: CORS });
          }
          const token = authHeader.slice("Bearer ".length).trim();
          if (!token) {
            return new Response("Unauthorized", { status: 401, headers: CORS });
          }
          const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          });
          const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
          if (claimsErr || !claimsData?.claims?.sub) {
            return new Response("Unauthorized", { status: 401, headers: CORS });
          }

          const { text, lang } = (await request.json()) as { text?: string; lang?: string };
          if (!text || typeof text !== "string") {
            return new Response("Missing text", { status: 400, headers: CORS });
          }
          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) {
            return new Response("TTS not configured", { status: 503, headers: CORS });
          }
          const voice = lang === "en" ? "alloy" : "shimmer";
          const r = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/gpt-4o-mini-tts",
              input: text.slice(0, 500),
              voice,
              response_format: "mp3",
            }),
          });
          if (!r.ok) {
            const msg = await r.text().catch(() => "");
            return new Response(`TTS upstream ${r.status}: ${msg}`, { status: 502, headers: CORS });
          }
          return new Response(r.body, {
            status: 200,
            headers: {
              ...CORS,
              "Content-Type": "audio/mpeg",
              "Cache-Control": "private, max-age=3600",
            },
          });
        } catch (e) {
          return new Response(`Error: ${(e as Error).message}`, { status: 500, headers: CORS });
        }
      },
    },
  },
});
