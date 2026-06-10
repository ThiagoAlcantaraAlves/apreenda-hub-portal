import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function verifySignature(rawBody: string, header: string | null, secret: string) {
  if (!header) return false;
  const provided = header.replace(/^sha256=/, "").trim().toLowerCase();
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
}

serve(async (req) => {
  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      const verifyToken = Deno.env.get("DISPAROS_WEBHOOK_VERIFY_TOKEN") || "disparos_hub_token";
      if (mode === "subscribe" && token === verifyToken) {
        return new Response(challenge, { status: 200 });
      }
      return new Response("Forbidden", { status: 403 });
    }

    const rawBody = await req.text();
    const appSecret = Deno.env.get("DISPAROS_APP_SECRET");
    if (!appSecret) {
      console.error("DISPAROS_APP_SECRET not configured — refusing webhook");
      return new Response("Misconfigured", { status: 500 });
    }
    const ok = await verifySignature(rawBody, req.headers.get("x-hub-signature-256"), appSecret);
    if (!ok) return new Response("Forbidden", { status: 403 });
    const body = JSON.parse(rawBody);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    for (const entry of body?.entry || []) {
      for (const change of entry?.changes || []) {
        for (const status of change?.value?.statuses || []) {
          const whatsappId = status.id;
          const newStatus = status.status;
          const timestamp = status.timestamp ? new Date(parseInt(status.timestamp) * 1000).toISOString() : null;
          const updateData: any = { status: newStatus };
          if (newStatus === "sent") updateData.sent_at = timestamp;
          if (newStatus === "delivered") updateData.delivered_at = timestamp;
          if (newStatus === "read") updateData.read_at = timestamp;
          if (newStatus === "failed") {
            updateData.error_message = status.errors?.[0]?.title || "Falha no envio";
          }
          await supabase.from("disparos_messages").update(updateData).eq("whatsapp_message_id", whatsappId);
        }
      }
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("disparos-whatsapp-webhook error:", err);
    return new Response(JSON.stringify({ error: "internal_server_error" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
