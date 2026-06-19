import { createFileRoute } from "@tanstack/react-router";

/**
 * TTS pour la Radio Infos du taxi.
 * POST { text: string, lang: "fr" | "en" }
 * → audio/mpeg (mp3) jouable directement par <audio>.
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
              "Cache-Control": "public, max-age=3600",
            },
          });
        } catch (e) {
          return new Response(`Error: ${(e as Error).message}`, { status: 500, headers: CORS });
        }
      },
    },
  },
});
