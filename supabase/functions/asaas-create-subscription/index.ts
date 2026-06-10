import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getOrCreateCustomer, asaasFetch } from "../_shared/asaas.ts";

interface RequestBody {
  plan_id: string;
  cpfCnpj?: string;
  phone?: string;
}

function jsonRes(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getUser(req: Request): Promise<{ supabase: SupabaseClient; userId: string; email: string; name: string } | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data, error } = await supabase.auth.getClaims(auth.replace("Bearer ", ""));
  if (error || !data?.claims) return null;
  const { data: profile } = await supabase
    .from("profiles").select("full_name,email").eq("id", data.claims.sub).maybeSingle();
  return {
    supabase,
    userId: data.claims.sub as string,
    email: profile?.email || data.claims.email,
    name: profile?.full_name || profile?.email || "Cliente",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const ctx = await getUser(req);
    if (!ctx) return jsonRes(401, { error: "unauthorized" });

    const body = (await req.json()) as RequestBody;
    if (!body.plan_id) return jsonRes(400, { error: "plan_id required" });

    // Service-role client for writes
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Block if user already has active sub
    const { data: existing } = await admin
      .from("user_subscriptions").select("id,status")
      .eq("user_id", ctx.userId)
      .in("status", ["trialing", "active", "past_due"]).maybeSingle();
    if (existing) return jsonRes(409, { error: "already_subscribed" });

    const { data: plan, error: planErr } = await admin
      .from("subscription_plans").select("*").eq("id", body.plan_id).maybeSingle();
    if (planErr || !plan || !plan.active) return jsonRes(404, { error: "plan_not_found" });

    // Reuse asaas_customer_id from any past subscription
    const { data: lastSub } = await admin
      .from("user_subscriptions").select("asaas_customer_id")
      .eq("user_id", ctx.userId).order("created_at", { ascending: false }).limit(1).maybeSingle();

    const customer = await getOrCreateCustomer({
      name: ctx.name,
      email: ctx.email,
      cpfCnpj: body.cpfCnpj,
      phone: body.phone,
      existingId: lastSub?.asaas_customer_id ?? null,
    });

    const trialDays = plan.trial_days ?? 0;
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + trialDays);
    const yyyy = nextDueDate.toISOString().slice(0, 10);

    const sub = await asaasFetch("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: customer.id,
        billingType: "UNDEFINED", // user picks PIX/CARD/BOLETO at checkout
        value: plan.price_cents / 100,
        nextDueDate: yyyy,
        cycle: plan.interval === "yearly" ? "YEARLY" : "MONTHLY",
        description: `Assinatura ${plan.name} — Apreenda`,
        externalReference: ctx.userId,
      }),
    });

    // Compute current period end
    const periodEnd = new Date(nextDueDate);
    if (plan.interval === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    const status = trialDays > 0 ? "trialing" : "active";
    const credits = trialDays > 0 ? plan.monthly_credits : plan.monthly_credits;

    const { error: insErr } = await admin.from("user_subscriptions").insert({
      user_id: ctx.userId,
      plan_id: plan.id,
      status,
      trial_ends_at: trialDays > 0 ? nextDueDate.toISOString() : null,
      current_period_start: new Date().toISOString(),
      current_period_end: periodEnd.toISOString(),
      credits_remaining: credits,
      asaas_customer_id: customer.id,
      asaas_subscription_id: sub.id,
    });
    if (insErr) {
      console.error("Insert sub error", insErr);
      return jsonRes(500, { error: "insert_failed" });
    }

    // Grant trial credits transaction
    if (credits > 0) {
      await admin.from("credit_transactions").insert({
        user_id: ctx.userId,
        type: "grant_subscription",
        amount: credits,
        source: "subscription",
        reference: sub.id,
        metadata: { trial: trialDays > 0 },
      });
    }

    // Get checkout / invoice URL of first payment
    let invoiceUrl: string | null = null;
    try {
      const payments = await asaasFetch(`/subscriptions/${sub.id}/payments`);
      invoiceUrl = payments?.data?.[0]?.invoiceUrl ?? null;
    } catch (_) { /* trial may not generate immediate payment */ }

    return jsonRes(200, {
      ok: true,
      subscription_id: sub.id,
      invoice_url: invoiceUrl,
      status,
      trial_ends_at: trialDays > 0 ? nextDueDate.toISOString() : null,
    });
  } catch (e) {
    console.error(e);
    return jsonRes(500, { error: "internal_server_error" });
  }
});
