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

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await fetch(
        `https://graph.facebook.com/v21.0/${config.waba_id}/message_templates?limit=100&fields=id,name,language,category,status,components,rejected_reason`,
        { headers: { Authorization: `Bearer ${config.access_token}` }, signal: controller.signal }
      );
    } catch (e: any) {
      clearTimeout(t);
      return new Response(JSON.stringify({
        error: e?.name === "AbortError" ? "Tempo esgotado" : "Erro de conexão com Meta API",
      }), { status: 504, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    clearTimeout(t);

    const data = await response.json();
    if (!response.ok) {
      return new Response(JSON.stringify({ error: data?.error?.message || "Erro ao buscar templates" }), {
        status: response.status, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const templates = (data.data || []).map((t: any) => ({
      id: t.id, name: t.name, language: t.language, category: t.category,
      status: t.status, rejected_reason: t.rejected_reason || null,
      components: t.components || [],
    }));

    return new Response(JSON.stringify({ templates }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("disparos-fetch-templates error", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

// lovable redeploy nudge — 2026-06-10
