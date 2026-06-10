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

    const { name, language, category, components } = await req.json();
    if (!name || !language || !category || !Array.isArray(components) || components.length === 0) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: name, language, category, components" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    if (category === "AUTHENTICATION") {
      return new Response(JSON.stringify({ error: "Use Marketing ou Utilidade." }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${config.waba_id}/message_templates`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, language, category, components }),
      }
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const metaError = data?.error;
      const code = metaError?.code;
      const sub = metaError?.error_subcode;
      const baseMsg = metaError?.error_user_msg || metaError?.message || "Erro ao criar template";
      let msg = baseMsg;
      if (code === 1 && sub === 99) {
        msg = `A Meta rejeitou (erro genérico). Causa comum: nome "${name}" já existe na WABA. Tente outro (ex: _v2).`;
      }
      return new Response(JSON.stringify({ error: msg, meta: metaError || null }), {
        status: response.status, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, template: data }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("disparos-create-template error", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

// lovable redeploy nudge — 2026-06-10
