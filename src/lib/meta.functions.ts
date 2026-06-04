import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const META_API = "https://graph.facebook.com/v21.0";
const TRIAL_DAYS = 30;

function appCreds() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new Error("META_APP_ID e META_APP_SECRET não configurados no servidor");
  return { appId, appSecret };
}

/** Troca o authorization code (OAuth redirect) por token long-lived e salva. Inicia o trial. */
export const metaExchangeCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ code: z.string().min(1), redirectUri: z.string().url() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { appId, appSecret } = appCreds();

    // code -> short-lived
    const codeResp = await fetch(
      `${META_API}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(data.redirectUri)}&client_secret=${appSecret}&code=${data.code}`,
    );
    const codeResult = await codeResp.json();
    if (codeResult.error) throw new Error(codeResult.error.message || "Erro ao trocar código");

    // short -> long-lived (~60 dias)
    let token = codeResult.access_token;
    let expiresIn = codeResult.expires_in || 5184000;
    const longResp = await fetch(
      `${META_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${token}`,
    );
    const longResult = await longResp.json();
    if (!longResult.error && longResult.access_token) {
      token = longResult.access_token;
      expiresIn = longResult.expires_in || 5184000;
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // substitui token anterior
    await supabaseAdmin.from("meta_tokens").delete().eq("user_id", userId);
    await supabaseAdmin.from("meta_tokens").insert({
      user_id: userId,
      access_token: token,
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
        .update({ trial_started_at: now.toISOString(), trial_ends_at: ends.toISOString() })
        .eq("id", userId);
    }

    return { ok: true };
  });

/** Lista as contas de anúncio do usuário conectado. */
export const metaListAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const { data: row } = await supabaseAdmin
      .from("meta_tokens")
      .select("access_token")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row) throw new Error("Conta Meta não conectada");

    const accounts: any[] = [];
    let nextUrl: string | null = `${META_API}/me/adaccounts?fields=id,name,account_status,currency&limit=200&access_token=${(row as any).access_token}`;
    let pages = 0;
    while (nextUrl && pages < 10) {
      const resp: Response = await fetch(nextUrl);
      const page: any = await resp.json();
      if (page.error) throw new Error(page.error.message || "Erro ao listar contas");
      if (page.data) accounts.push(...page.data);
      nextUrl = page.paging?.next || null;
      pages++;
    }
    return { accounts };
  });

/** Define a conta de anúncio escolhida pelo usuário. */
export const metaSelectAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ accountId: z.string().min(1), accountName: z.string().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await supabaseAdmin
      .from("meta_tokens")
      .update({ ad_account_id: data.accountId.replace("act_", ""), ad_account_name: data.accountName ?? null })
      .eq("user_id", userId);
    return { ok: true };
  });
