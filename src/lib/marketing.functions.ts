import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateMarketingData } from "./marketing/mock";
import { fetchMetaForUnit } from "./marketing/meta-api.server";
import type { MarketingData } from "./marketing/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar em formato YYYY-MM-DD");

const InputSchema = z.object({
  start: DateStr,
  end: DateStr,
  units: z.array(z.string().max(64)).max(20).default([]),
  source: z.enum(["all", "ga4", "meta_ads", "google_ads", "facebook_organic", "instagram", "firebase"]).default("all"),
  variant: z.enum(["current", "previous"]).default("current"),
});

export const getMarketingData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<MarketingData> => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    // 1) Resolve o tenant do usuário + checa aprovação (RLS: lê próprio profile).
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("approved, tenant_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileErr || !profile?.approved || !profile.tenant_id) {
      throw new Error("Forbidden: usuário não aprovado ou sem tenant");
    }

    // Mock como base (Google Ads + fallback Meta + tenant demo).
    const base = generateMarketingData(data);

    const mergeDaily = (live: { daily: { date: string; meta: number }[] }) => {
      const byDate = new Map(base.dailySpend.map((d) => [d.date, { ...d, meta: 0 }]));
      for (const d of live.daily) {
        const cur = byDate.get(d.date) ?? { date: d.date, meta: 0, google: 0 };
        cur.meta = d.meta;
        byDate.set(d.date, cur);
      }
      return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    };

    // 1.5) Usuário com Facebook conectado (trial) → usa o token + conta DELE.
    const { data: userMeta } = await (supabaseAdmin as any)
      .from("meta_tokens")
      .select("access_token, ad_account_id, expires_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (userMeta?.access_token && userMeta.ad_account_id) {
      const expired = userMeta.expires_at && new Date(userMeta.expires_at).getTime() < Date.now();
      if (!expired) {
        try {
          const live = await fetchMetaForUnit({
            accountId: userMeta.ad_account_id,
            start: data.start,
            end: data.end,
            unitName: "Sua conta",
            token: userMeta.access_token,
          });
          return { ...base, meta: live.meta, dailySpend: mergeDaily(live) };
        } catch (err) {
          console.error("[meta-api trial] fallback:", err);
          return {
            ...base,
            meta: base.meta && { ...base.meta, _fallback: true, _error: "Falha ao consultar sua conta Meta. Reconecte o Facebook." },
          };
        }
      }
    }

    // 2) Tenant demo → dados fictícios puros.
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("status, name")
      .eq("id", profile.tenant_id)
      .maybeSingle();
    if (!tenant || tenant.status === "demo") {
      return base;
    }

    // 3) Conta Meta do tenant (server-side, service role — tenant_accounts não é exposto ao client).
    const { data: acct } = await (supabaseAdmin as any)
      .from("tenant_accounts")
      .select("account_id")
      .eq("tenant_id", profile.tenant_id)
      .eq("source", "meta_ads")
      .maybeSingle();

    const token = process.env.META_ACCESS_TOKEN;
    const metaAccountId = acct?.account_id;

    if (!token || !metaAccountId) {
      if (!token) console.error("[meta-api] META_ACCESS_TOKEN env var ausente");
      return {
        ...base,
        meta: base.meta && { ...base.meta, _fallback: true, _error: "Integração Meta Ads não configurada" },
      };
    }

    try {
      const live = await fetchMetaForUnit({
        accountId: metaAccountId,
        start: data.start,
        end: data.end,
        unitName: tenant.name,
        token,
      });

      return { ...base, meta: live.meta, dailySpend: mergeDaily(live) };
    } catch (err) {
      console.error("[meta-api] fallback to mock:", err);
      return {
        ...base,
        meta: base.meta && { ...base.meta, _fallback: true, _error: "Falha ao consultar Meta Ads" },
      };
    }
  });
