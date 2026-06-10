import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getUserId(req: Request, supabase: any): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const userId = await getUserId(req, supabase);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { data: config } = await supabase
      .from("disparos_api_config")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!config) {
      return new Response(JSON.stringify({ error: "API não configurada. Vá em Configurações." }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { phone, template_name, language, components, campaign_id } = await req.json();

    if (!phone || !template_name || !campaign_id) {
      return new Response(JSON.stringify({ error: "phone, template_name e campaign_id são obrigatórios" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Verify campaign ownership server-side; never trust the caller for credit gating.
    const { data: campaign, error: campErr } = await supabase
      .from("disparos_campaigns")
      .select("id, user_id, credit_consumed_at")
      .eq("id", campaign_id)
      .maybeSingle();

    if (campErr || !campaign || campaign.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Campanha não encontrada" }), {
        status: 404, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Charge exactly once per campaign — decision is server-side (atomic compare-and-set).
    if (!campaign.credit_consumed_at) {
      const claimedAt = new Date().toISOString();
      const { data: claimed, error: claimErr } = await supabase
        .from("disparos_campaigns")
        .update({ credit_consumed_at: claimedAt, credits_consumed: 1 })
        .eq("id", campaign_id)
        .is("credit_consumed_at", null)
        .select("id")
        .maybeSingle();

      if (!claimErr && claimed) {
        // We won the race — actually deduct the credit using the service-role admin RPC.
        const { data: cred, error: credErr } = await supabase.rpc("admin_consume_credits", {
          _user_id: userId,
          _tool_slug: "disparos",
          _amount: 1,
        });
        if (credErr || (cred as any)?.ok === false) {
          // Roll back the claim so the campaign can be retried after top-up.
          await supabase
            .from("disparos_campaigns")
            .update({ credit_consumed_at: null, credits_consumed: 0 })
            .eq("id", campaign_id);
          const insufficient = (cred as any)?.error === "insufficient_credits";
          return new Response(JSON.stringify({
            error: insufficient
              ? `Créditos insuficientes (saldo: ${(cred as any)?.available ?? 0}). Compre mais créditos para disparar.`
              : "Falha ao consumir créditos",
            insufficient,
          }), {
            status: 402, headers: { ...CORS, "Content-Type": "application/json" },
          });
        }
      }
      // If we lost the race, another concurrent message already paid for this campaign.
    }

    const body: any = {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: { name: template_name, language: { code: language || "pt_BR" } },
    };
    if (components && components.length > 0) body.template.components = components;

    const response = await fetch(
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

    const data = await response.json();
    if (!response.ok) {
      const errMsg = data?.error?.message || "Falha no envio";
      return new Response(JSON.stringify({ error: errMsg }), {
        status: response.status, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const messageId = data?.messages?.[0]?.id || null;
    return new Response(JSON.stringify({ success: true, message_id: messageId }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("disparos-send-whatsapp error", err);
    return new Response(JSON.stringify({ error: "internal_server_error" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
