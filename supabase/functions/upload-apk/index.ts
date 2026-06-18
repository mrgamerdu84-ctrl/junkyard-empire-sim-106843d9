// Edge Function: upload-apk
// Reçoit l'APK depuis GitHub Actions et le stocke dans le bucket "apks".
//
// Auth :  Authorization: Bearer <UPLOAD_TOKEN>
// Body  :  raw binary (application/vnd.android.package-archive)
// Query :  ?name=MyTaxiWorldTycoon.apk  (optionnel)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method === "GET") {
    return json({
      ok: true,
      hint: "POST your APK binary with Authorization: Bearer <UPLOAD_TOKEN>",
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const expected = Deno.env.get("UPLOAD_TOKEN");
  if (!expected) {
    return json({ error: "Server not configured: UPLOAD_TOKEN missing" }, 500);
  }

  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  if (!provided || provided !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  const buf = await req.arrayBuffer();
  if (!buf || buf.byteLength === 0) {
    return json({ error: "Empty body" }, 400);
  }
  if (buf.byteLength > 200 * 1024 * 1024) {
    return json({ error: "File too large (max 200 MB)" }, 413);
  }

  const url = new URL(req.url);
  const rawName = url.searchParams.get("name") || "MyTaxiWorldTycoon.apk";
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const finalName = safeName.toLowerCase().endsWith(".apk")
    ? safeName
    : `${safeName}.apk`;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { error } = await supabase.storage
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
});
