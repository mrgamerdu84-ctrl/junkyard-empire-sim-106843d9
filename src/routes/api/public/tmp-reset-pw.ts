import { createFileRoute } from "@tanstack/react-router";

const TOKEN = "k3J9xQ2wL7vR4nP8zE5tY1uA6sD0fH";

export const Route = createFileRoute("/api/public/tmp-reset-pw")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json();
        if (body.token !== TOKEN) {
          return new Response("forbidden", { status: 403 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        if (listErr) return Response.json({ error: listErr.message }, { status: 500 });
        const user = list.users.find((u) => u.email?.toLowerCase() === body.email.toLowerCase());
        if (!user) return Response.json({ error: "user not found" }, { status: 404 });
        const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
          password: body.password,
        });
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ ok: true, userId: user.id });
      },
    },
  },
});
