import { createFileRoute } from "@tanstack/react-router";

/**
 * Endpoint d'upload APK pour le workflow GitHub Actions.
 *
 * Reçoit le binaire .apk en POST, vérifie le token partagé `UPLOAD_TOKEN`,
 * puis le pousse dans le bucket Supabase Storage `apks` (upsert).
 *
 * Auth :  Authorization: Bearer <UPLOAD_TOKEN>
 * Body  :  raw binary (Content-Type: application/vnd.android.package-archive)
 * Query :  ?name=MyTaxiWorldTycoon.apk  (optionnel ; défaut MyTaxiWorldTycoon.apk)
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/upload-apk")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: CORS }),

      GET: async () =>
        json({ ok: true, hint: "POST your APK binary with Authorization: Bearer <UPLOAD_TOKEN>" }),

      POST: async ({ request }) => {
        const expected = process.env.UPLOAD_TOKEN;
        if (!expected) {
          return json({ error: "Server not configured: UPLOAD_TOKEN missing" }, 500);
        }

        const auth = request.headers.get("authorization") ?? "";
        const provided = auth.toLowerCase().startsWith("bearer ")
          ? auth.slice(7).trim()
          : "";
        if (!provided || provided !== expected) {
          return json({ error: "Unauthorized" }, 401);
        }

        // Récupération du fichier (binaire brut)
        const buf = await request.arrayBuffer();
        if (!buf || buf.byteLength === 0) {
          return json({ error: "Empty body" }, 400);
        }
        if (buf.byteLength > 200 * 1024 * 1024) {
          return json({ error: "File too large (max 200 MB)" }, 413);
        }

        // Nom de fichier
        const url = new URL(request.url);
        const rawName = url.searchParams.get("name") || "MyTaxiWorldTycoon.apk";
        const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const finalName = safeName.toLowerCase().endsWith(".apk")
          ? safeName
          : `${safeName}.apk`;

        // Upload dans le bucket "apks" (upsert)
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.storage
          .from("apks")
          .upload(finalName, buf, {
            upsert: true,
            contentType: "application/vnd.android.package-archive",
            cacheControl: "300",
          });

        if (error) {
          console.error("[upload-apk] storage error:", error);
          return json({ error: error.message }, 500);
        }

        return json({
          ok: true,
          name: finalName,
          size: buf.byteLength,
          uploadedAt: new Date().toISOString(),
        });
      },
    },
  },
});
