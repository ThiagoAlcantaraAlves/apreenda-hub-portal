import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Public webhook (verify_jwt = false). Asaas calls this with a configurable token in header `asaas-access-token`.
function jsonRes(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonRes(405, { error: "method_not_allowed" });

  const token = req.headers.get("asaas-access-token");
  const expected = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  if (!expected || token !== expected) {
    console.warn("Webhook token mismatch");
    return jsonRes(401, { error: "invalid_token" });
  }

  const event = await req.json();
  const eventId = event?.id || event?.event + "-" + (event?.payment?.id || event?.subscription?.id || crypto.randomUUID());
  const eventType: string = event?.event || "unknown";

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Idempotency
  const { error: dedupErr } = await admin.from("asaas_events").insert({
    event_id: eventId, event_type: eventType, payload: event,
  });
  if (dedupErr) {
    if (dedupErr.code === "23505") return jsonRes(200, { ok: true, duplicate: true });
    console.error("dedup insert error", dedupErr);
  }

  try {
    if (eventType === "PAYMENT_CONFIRMED" || eventType === "PAYMENT_RECEIVED") {
      const payment = event.payment;
      // Credit pack?
      let ref: any = null;
      const extRef: string | undefined = payment?.externalReference;
      if (extRef) {
        if (extRef.startsWith("pack:")) {
          const [, user_id, pack_id] = extRef.split(":");
          ref = { kind: "pack", user_id, pack_id };
        } else {
          try { ref = JSON.parse(extRef); } catch {}
        }
      }
      if (ref?.kind === "pack" && ref.user_id && ref.pack_id) {
        // Authoritative credits come from DB, never from externalReference
        const { data: pack } = await admin
          .from("credit_packs").select("credits,active").eq("id", ref.pack_id).maybeSingle();
        if (!pack || !pack.active) {
          console.warn("Webhook pack not found or inactive", ref.pack_id);
          return jsonRes(200, { ok: true, ignored: "pack_not_found" });
        }
        const creditsToGrant = Number(pack.credits);
        // Grant credits
        const { data: wallet } = await admin
          .from("credit_wallets").select("pack_credits").eq("user_id", ref.user_id).maybeSingle();
        const next = (wallet?.pack_credits ?? 0) + creditsToGrant;
        await admin.from("credit_wallets")
          .upsert({ user_id: ref.user_id, pack_credits: next }, { onConflict: "user_id" });
        await admin.from("credit_transactions").insert({
          user_id: ref.user_id, type: "grant_pack", amount: creditsToGrant,
          source: "pack", reference: payment.id, metadata: { pack_id: ref.pack_id },
        });
      } else if (payment?.subscription) {
        // Subscription payment confirmed → activate + reset credits for new cycle
        const { data: sub } = await admin
          .from("user_subscriptions").select("*, subscription_plans(*)")
          .eq("asaas_subscription_id", payment.subscription).maybeSingle();
        if (sub) {
          const plan = (sub as any).subscription_plans;
          const periodStart = new Date();
          const periodEnd = new Date(periodStart);
          if (plan.interval === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
          else periodEnd.setMonth(periodEnd.getMonth() + 1);

          await admin.from("user_subscriptions").update({
            status: "active",
            current_period_start: periodStart.toISOString(),
            current_period_end: periodEnd.toISOString(),
            credits_remaining: plan.monthly_credits, // RESET (expira não usado)
          }).eq("id", sub.id);

          await admin.from("credit_transactions").insert({
            user_id: sub.user_id, type: "grant_subscription",
            amount: plan.monthly_credits, source: "subscription",
            reference: payment.id, metadata: { cycle: "renewal" },
          });
        }
      }
    } else if (eventType === "PAYMENT_OVERDUE") {
      const subId = event?.payment?.subscription;
      if (subId) {
        await admin.from("user_subscriptions").update({ status: "past_due" })
          .eq("asaas_subscription_id", subId);
      }
    } else if (eventType === "SUBSCRIPTION_DELETED" || eventType === "SUBSCRIPTION_INACTIVATED") {
      const subId = event?.subscription?.id;
      if (subId) {
        await admin.from("user_subscriptions").update({
          status: "canceled", canceled_at: new Date().toISOString(), credits_remaining: 0,
        }).eq("asaas_subscription_id", subId);
      }
    }
  } catch (e) {
    console.error("Webhook handler error", e);
    return jsonRes(500, { error: "handler_failed" });
  }

  return jsonRes(200, { ok: true });
});
