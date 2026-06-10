import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { asaasFetch } from "../_shared/asaas.ts";

function jsonRes(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return jsonRes(401, { error: "unauthorized" });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: claims } = await supabase.auth.getClaims(auth.replace("Bearer ", ""));
    if (!claims?.claims) return jsonRes(401, { error: "unauthorized" });
    const userId = claims.claims.sub as string;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: sub } = await admin
      .from("user_subscriptions").select("*")
      .eq("user_id", userId).in("status", ["trialing", "active", "past_due"]).maybeSingle();
    if (!sub) return jsonRes(404, { error: "no_active_subscription" });

    if (sub.asaas_subscription_id) {
      try { await asaasFetch(`/subscriptions/${sub.asaas_subscription_id}`, { method: "DELETE" }); }
      catch (e) { console.error("Asaas delete failed", e); }
    }

    await admin.from("user_subscriptions").update({
      status: "canceled", canceled_at: new Date().toISOString(),
    }).eq("id", sub.id);

    return jsonRes(200, { ok: true });
  } catch (e) {
    console.error(e);
    return jsonRes(500, { error: "internal_server_error" });
  }
});

// lovable redeploy nudge — 2026-06-10
