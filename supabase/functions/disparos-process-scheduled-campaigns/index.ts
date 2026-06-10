import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface Recipient { phone: string; name?: string; }

function resolveValue(raw: string, r: Recipient): string {
  const firstName = (r.name || "").trim().split(/\s+/)[0] || "";
  const fullName = (r.name || "").trim();
  return raw
    .replace(/\{\{\s*primeiro_nome\s*\}\}/gi, firstName || "cliente")
    .replace(/\{\{\s*nome\s*\}\}/gi, fullName || "cliente")
    .replace(/\{\{\s*telefone\s*\}\}/gi, r.phone || "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const providedSecret = req.headers.get("x-cron-secret");
    const authorized = cronSecret && providedSecret === cronSecret;
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const nowIso = new Date().toISOString();

    const { data: due, error: fetchErr } = await supabase
      .from("disparos_scheduled_campaigns")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", nowIso)
      .order("scheduled_for", { ascending: true })
      .limit(10);

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    if (!due || due.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    let processedCount = 0;

    for (const sched of due) {
      // Lock
      const { error: lockErr } = await supabase
        .from("disparos_scheduled_campaigns")
        .update({ status: "processing" })
        .eq("id", sched.id).eq("status", "pending");
      if (lockErr) continue;

      const { data: config } = await supabase
        .from("disparos_api_config").select("*").eq("user_id", sched.user_id).maybeSingle();
      if (!config) {
        await supabase.from("disparos_scheduled_campaigns").update({
          status: "failed", error_message: "API não configurada",
          processed_at: new Date().toISOString(),
        }).eq("id", sched.id);
        continue;
      }

      try {
        const recipients: Recipient[] = Array.isArray(sched.recipients) ? sched.recipients : [];
        if (recipients.length === 0) {
          await supabase.from("disparos_scheduled_campaigns").update({
            status: "failed", error_message: "Sem destinatários",
            processed_at: new Date().toISOString(),
          }).eq("id", sched.id);
          continue;
        }

        // Consume 1 credit for the scheduled campaign via service-role RPC.
        const { data: cred, error: credErr } = await supabase.rpc("admin_consume_credits", {
          _user_id: sched.user_id,
          _tool_slug: "disparos",
          _amount: 1,
        });
        if (credErr || (cred as any)?.ok === false) {
          const insufficient = (cred as any)?.error === "insufficient_credits";
          await supabase.from("disparos_scheduled_campaigns").update({
            status: "failed",
            error_message: insufficient
              ? `Créditos insuficientes (saldo: ${(cred as any)?.available ?? 0})`
              : "Falha ao consumir créditos",
            processed_at: new Date().toISOString(),
          }).eq("id", sched.id);
          continue;
        }


        const { data: campaign, error: campErr } = await supabase
          .from("disparos_campaigns").insert({
            user_id: sched.user_id,
            template_name: sched.template_name,
            template_language: sched.template_language || "pt_BR",
            variables: sched.variables || {},
            total_recipients: recipients.length,
            status: "in_progress",
            credits_consumed: 1,
            credit_consumed_at: new Date().toISOString(),
          }).select().single();
        if (campErr || !campaign) throw new Error(campErr?.message || "Falha ao criar campanha");

        const startedAt = Date.now();
        let sumMs = 0;
        let successCount = 0;

        for (const r of recipients) {
          const phone = (r.phone || "").replace(/\D/g, "");
          if (!phone) continue;

          const vars = (sched.variables || {}) as Record<string, string>;
          const slotKeys = Object.keys(vars).filter((k) => /^\{\{\d+\}\}$/.test(k))
            .sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")));
          const bodyParams = slotKeys.map((k) => ({
            type: "text", text: resolveValue(String(vars[k] ?? ""), r),
          }));
          const components = bodyParams.length > 0 ? [{ type: "body", parameters: bodyParams }] : undefined;

          const body: any = {
            messaging_product: "whatsapp", to: phone, type: "template",
            template: {
              name: sched.template_name,
              language: { code: sched.template_language || "pt_BR" },
            },
          };
          if (components) body.template.components = components;

          const t0 = Date.now();
          let messageId: string | null = null;
          let status = "sent";
          let errorMessage: string | null = null;
          try {
            const resp = await fetch(
              `https://graph.facebook.com/v21.0/${config.phone_number_id}/messages`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${config.access_token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
              }
            );
            const data = await resp.json();
            if (!resp.ok) {
              status = "failed";
              errorMessage = data?.error?.message || JSON.stringify(data);
            } else {
              messageId = data?.messages?.[0]?.id || null;
              successCount += 1;
            }
          } catch (e) {
            status = "failed";
            errorMessage = (e as Error).message;
          }
          const sendMs = Date.now() - t0;
          sumMs += sendMs;

          await supabase.from("disparos_messages").insert({
            user_id: sched.user_id,
            campaign_id: campaign.id,
            contact_phone: phone,
            contact_name: r.name || null,
            whatsapp_message_id: messageId,
            status, error_message: errorMessage,
            sent_at: status === "sent" ? new Date().toISOString() : null,
            send_time_ms: sendMs,
          });
          await new Promise((res) => setTimeout(res, 100));
        }

        const totalMs = Date.now() - startedAt;
        const avgMs = recipients.length > 0 ? Math.round(sumMs / recipients.length) : 0;

        await supabase.from("disparos_campaigns").update({
          status: "completed",
          completed_at: new Date().toISOString(),
          total_duration_ms: totalMs,
          avg_send_time_ms: avgMs,
        }).eq("id", campaign.id);

        await supabase.from("disparos_scheduled_campaigns").update({
          status: "completed",
          campaign_id: campaign.id,
          processed_at: new Date().toISOString(),
        }).eq("id", sched.id);

        processedCount += 1;
        console.log(`Scheduled ${sched.id} completed: ${successCount}/${recipients.length}`);
      } catch (err) {
        await supabase.from("disparos_scheduled_campaigns").update({
          status: "failed",
          error_message: (err as Error).message,
          processed_at: new Date().toISOString(),
        }).eq("id", sched.id);
      }
    }

    return new Response(JSON.stringify({ processed: processedCount }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("disparos-process-scheduled-campaigns error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

// lovable redeploy nudge — 2026-06-10
