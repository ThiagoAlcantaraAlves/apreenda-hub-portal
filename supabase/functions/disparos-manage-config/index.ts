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

    const body = await req.json().catch(() => ({}));
    const action = body.action || "get";

    if (action === "get") {
      const { data } = await supabase
        .from("disparos_api_config")
        .select("waba_id, phone_number_id, access_token")
        .eq("user_id", userId)
        .maybeSingle();
      return new Response(JSON.stringify({ config: data || null }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (action === "save") {
      const { waba_id, phone_number_id, access_token } = body;
      if (!waba_id || !phone_number_id || !access_token) {
        return new Response(JSON.stringify({ error: "Todos os campos são obrigatórios" }), {
          status: 400, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      const { data: existing } = await supabase
        .from("disparos_api_config").select("id").eq("user_id", userId).maybeSingle();
      if (existing) {
        await supabase.from("disparos_api_config")
          .update({ waba_id, phone_number_id, access_token })
          .eq("id", existing.id);
      } else {
        await supabase.from("disparos_api_config")
          .insert({ waba_id, phone_number_id, access_token, user_id: userId });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("disparos-manage-config error", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
