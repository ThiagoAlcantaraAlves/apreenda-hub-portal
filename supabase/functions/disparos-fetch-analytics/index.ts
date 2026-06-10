import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getUserId(req: Request, supabase: any) {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;
  const { data } = await supabase.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  return data?.user?.id || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userId = await getUserId(req, supabase);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { data: config } = await supabase
      .from("disparos_api_config").select("*").eq("user_id", userId).maybeSingle();
    if (!config) {
      return new Response(JSON.stringify({ error: "API não configurada" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { start, end, granularity } = await req.json();
    if (!start || !end) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: start, end" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const params = new URLSearchParams({
      start: String(start), end: String(end),
      granularity: granularity || "DAILY",
      phone_numbers: JSON.stringify([config.phone_number_id]),
      conversation_categories: JSON.stringify(["AUTHENTICATION", "MARKETING", "UTILITY", "SERVICE"]),
      dimensions: JSON.stringify(["CONVERSATION_CATEGORY"]),
    });

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${config.waba_id}/conversation_analytics?${params}`,
      { headers: { Authorization: `Bearer ${config.access_token}` } }
    );
    const data = await response.json();
    if (!response.ok) {
      return new Response(JSON.stringify({ error: data?.error?.message || "Erro" }), {
        status: response.status, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { data: campaignStats } = await supabase
      .from("disparos_campaigns")
      .select("id, template_name, total_recipients, status, created_at")
      .eq("user_id", userId)
      .gte("created_at", new Date(start * 1000).toISOString())
      .lte("created_at", new Date(end * 1000).toISOString())
      .order("created_at", { ascending: false });

    const ids = (campaignStats || []).map((c: any) => c.id);
    const { data: messageStats } = ids.length
      ? await supabase.from("disparos_messages").select("status").in("campaign_id", ids)
      : { data: [] };

    const messageCounts = (messageStats || []).reduce<Record<string, number>>((acc, m: any) => {
      acc[m.status] = (acc[m.status] || 0) + 1; return acc;
    }, {});

    return new Response(JSON.stringify({
      conversation_analytics: data?.conversation_analytics || data,
      campaigns: campaignStats || [],
      message_counts: messageCounts,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("disparos-fetch-analytics error", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

// lovable redeploy nudge — 2026-06-10
