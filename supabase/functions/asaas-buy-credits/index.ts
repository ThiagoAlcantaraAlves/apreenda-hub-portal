import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getOrCreateCustomer, asaasFetch } from "../_shared/asaas.ts";

function jsonRes(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return jsonRes(401, { error: "unauthorized" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: claims } = await supabase.auth.getClaims(auth.replace("Bearer ", ""));
    if (!claims?.claims) return jsonRes(401, { error: "unauthorized" });
    const userId = claims.claims.sub as string;

    const { pack_id, cpfCnpj, phone } = await req.json();
    if (!pack_id) return jsonRes(400, { error: "pack_id required" });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: pack } = await admin
      .from("credit_packs").select("*").eq("id", pack_id).maybeSingle();
    if (!pack || !pack.active) return jsonRes(404, { error: "pack_not_found" });

    const { data: profile } = await admin
      .from("profiles").select("full_name,email").eq("id", userId).maybeSingle();

    const { data: lastSub } = await admin
      .from("user_subscriptions").select("asaas_customer_id")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();

    const customer = await getOrCreateCustomer({
      name: profile?.full_name || profile?.email || "Cliente",
      email: profile?.email!,
      cpfCnpj,
      phone,
      existingId: lastSub?.asaas_customer_id ?? null,
    });

    const due = new Date();
    due.setDate(due.getDate() + 3);

    const payment = await asaasFetch("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customer.id,
        billingType: "UNDEFINED",
        value: pack.price_cents / 100,
        dueDate: due.toISOString().slice(0, 10),
        description: `${pack.name} — Apreenda`,
        externalReference: `pack:${userId}:${pack.id}:${pack.credits}`,
      }),
    });

    return jsonRes(200, {
      ok: true,
      payment_id: payment.id,
      invoice_url: payment.invoiceUrl,
    });
  } catch (e) {
    console.error(e);
    return jsonRes(500, { error: "internal_server_error" });
  }
});
