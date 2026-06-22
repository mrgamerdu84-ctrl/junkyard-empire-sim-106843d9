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
          // Route publique : pas d'auth requise (la radio doit marcher sur mobile
          // y compris pour les visiteurs anonymes). Anti-abus : on tronque à 500 chars.
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
            console.warn("[radio-tts] upstream", r.status, msg.slice(0, 200));
            // 200 + fallback flag : le client bascule sur SpeechSynthesis sans crasher.
            return new Response(JSON.stringify({ error: "TTS_UPSTREAM", status: r.status, fallback: true }), {
              status: 200,
              headers: { ...CORS, "Content-Type": "application/json" },
            });
          }
          // IMPORTANT : on bufferise (arrayBuffer) au lieu de streamer r.body.
          // Le streaming à travers le Worker peut faire planter Cloudflare en
          // 502 si l'upstream coupe la connexion en cours de route.
          const audio = await r.arrayBuffer();
          return new Response(audio, {
            status: 200,
            headers: {
              ...CORS,
              "Content-Type": "audio/mpeg",
              "Cache-Control": "private, max-age=3600",
            },
          });
        } catch (e) {
          console.warn("[radio-tts] error", (e as Error).message);
          return new Response(JSON.stringify({ error: "TTS_FAILED", fallback: true }), {
            status: 200,
            headers: { ...CORS, "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
