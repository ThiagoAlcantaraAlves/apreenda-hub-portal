import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TRIAL_DAYS = 30;

function googleCreds() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET não configurados no servidor");
  }
  return { clientId, clientSecret };
}

/** Troca o authorization code do Google por tokens e salva. Inicia o trial (se ainda não iniciado). */
export const googleExchangeCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ code: z.string().min(1), redirectUri: z.string().url() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { clientId, clientSecret } = googleCreds();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: data.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: data.redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });
    const tokenData = await tokenResp.json();
    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error || "Erro ao trocar código Google");
    }
    if (!tokenData.refresh_token) {
      throw new Error(
        "Google não retornou refresh_token. Revogue o acesso em myaccount.google.com/permissions e tente novamente.",
      );
    }

    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

    await supabaseAdmin.from("google_tokens").delete().eq("user_id", userId);
    await supabaseAdmin.from("google_tokens").insert({
      user_id: userId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt,
    });

    // inicia trial de 30 dias se ainda não iniciado
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("trial_started_at")
      .eq("id", userId)
      .maybeSingle();
    if (prof && !(prof as any).trial_started_at) {
      const now = new Date();
      const ends = new Date(now.getTime() + TRIAL_DAYS * 86400_000);
      await supabaseAdmin
        .from("profiles")
        .update({ trial_started_at: now.toISOString(), trial_ends_at: ends.toISOString() } as any)
        .eq("id", userId);
    }

    return { ok: true };
  });

/** Retorna um access_token válido para o usuário (faz refresh se expirou). Server-only helper. */
async function getValidGoogleToken(userId: string): Promise<string> {
  const { clientId, clientSecret } = googleCreds();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("google_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) throw new Error("Conta Google não conectada");

  const r = row as { access_token: string; refresh_token: string; expires_at: string };
  const expiresAt = new Date(r.expires_at).getTime();
  if (expiresAt - Date.now() > 60_000) return r.access_token;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: r.refresh_token,
      grant_type: "refresh_token",
    }).toString(),
  });
  const refreshed = await resp.json();
  if (refreshed.error) {
    throw new Error(refreshed.error_description || refreshed.error || "Erro ao atualizar token Google");
  }
  const newExpiresAt = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString();
  await supabaseAdmin
    .from("google_tokens")
    .update({ access_token: refreshed.access_token, expires_at: newExpiresAt } as any)
    .eq("user_id", userId);
  return refreshed.access_token;
}

/** Lista as properties do GA4 e os customers do Google Ads disponíveis ao usuário. */
export const googleListAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const token = await getValidGoogleToken(userId);

    // GA4 properties via Admin API: account summaries
    const ga4Resp = await fetch(
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const ga4Json = await ga4Resp.json();
    const ga4Properties: { id: string; name: string; account: string }[] = [];
    if (ga4Json.accountSummaries) {
      for (const acc of ga4Json.accountSummaries) {
        for (const prop of acc.propertySummaries ?? []) {
          ga4Properties.push({
            id: String(prop.property).replace("properties/", ""),
            name: prop.displayName,
            account: acc.displayName,
          });
        }
      }
    }

    // Google Ads accessible customers (apenas IDs; nome opcional via desenvolvedor token)
    let adsCustomers: { id: string; name: string }[] = [];
    const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (devToken) {
      try {
        const adsResp = await fetch(
          "https://googleads.googleapis.com/v17/customers:listAccessibleCustomers",
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "developer-token": devToken,
            },
          },
        );
        const adsJson = await adsResp.json();
        if (adsJson.resourceNames) {
          adsCustomers = (adsJson.resourceNames as string[]).map((rn) => {
            const id = rn.replace("customers/", "");
            return { id, name: id };
          });
        }
      } catch {
        // silencioso — Ads é opcional
      }
    }

    return { ga4Properties, adsCustomers };
  });

/** Salva a property GA4 e/ou customer Ads escolhidos. */
export const googleSelectAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        ga4PropertyId: z.string().optional().nullable(),
        ga4PropertyName: z.string().optional().nullable(),
        adsCustomerId: z.string().optional().nullable(),
        adsCustomerName: z.string().optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("google_tokens")
      .update({
        ga4_property_id: data.ga4PropertyId ?? null,
        ga4_property_name: data.ga4PropertyName ?? null,
        ads_customer_id: data.adsCustomerId ?? null,
        ads_customer_name: data.adsCustomerName ?? null,
      } as any)
      .eq("user_id", userId);
    return { ok: true };
  });
