// Cliente para a Meta Marketing API (Graph API v21.0).
// Usado apenas em server functions — lê process.env.META_ACCESS_TOKEN.

import type { AdRow, AdSetRow, CampaignRow, MarketingData } from "./types";

const GRAPH = "https://graph.facebook.com/v21.0";

interface InsightAction { action_type: string; value: string }
interface InsightRow {
  date_start?: string;
  date_stop?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: InsightAction[];
  action_values?: InsightAction[];
}

const WPP_ACTIONS = new Set([
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.total_messaging_connection",
]);
const PURCHASE_ACTIONS = new Set(["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"]);

function num(v: string | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function sumActions(rows: InsightAction[] | undefined, set: Set<string>): number {
  if (!rows) return 0;
  return rows.filter((a) => set.has(a.action_type)).reduce((s, a) => s + num(a.value), 0);
}

async function graphGet<T>(path: string, params: Record<string, string>, token: string): Promise<T> {
  const url = new URL(`${GRAPH}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Meta API: ${msg}`);
  }
  return json as T;
}

interface PagedResponse<T> { data: T[]; paging?: { next?: string } }

interface CampaignNode {
  id: string;
  name: string;
  objective?: string;
  insights?: PagedResponse<InsightRow>;
}

export async function fetchMetaForUnit(opts: {
  accountId: string;
  start: string;
  end: string;
  unitName: string;
  token: string;
}): Promise<{
  meta: NonNullable<MarketingData["meta"]>;
  daily: { date: string; meta: number }[];
}> {
  const { accountId, start, end, unitName, token } = opts;
  const timeRange = JSON.stringify({ since: start, until: end });
  const acct = `act_${accountId}`;

  // 1) Account-level insights (totais)
  const totalsRes = await graphGet<PagedResponse<InsightRow>>(
    `/${acct}/insights`,
    {
      time_range: timeRange,
      level: "account",
      fields: "spend,impressions,reach,frequency,clicks,ctr,cpc,cpm,actions,action_values",
    },
    token,
  );
  const t = totalsRes.data[0] ?? {};

  const spend = num(t.spend);
  const impressions = num(t.impressions);
  const reach = num(t.reach);
  const clicks = num(t.clicks);
  const wppConv = sumActions(t.actions, WPP_ACTIONS);
  const purchases = sumActions(t.actions, PURCHASE_ACTIONS);
  const purchaseValue = sumActions(t.action_values, PURCHASE_ACTIONS);

  // 2) Daily spend
  const dailyRes = await graphGet<PagedResponse<InsightRow>>(
    `/${acct}/insights`,
    {
      time_range: timeRange,
      level: "account",
      time_increment: "1",
      fields: "spend",
    },
    token,
  );
  const daily = dailyRes.data.map((d) => ({
    date: d.date_start ?? "",
    meta: num(d.spend),
  }));

  // 3) Campanhas
  interface CampNode extends CampaignNode { id: string }
  const campsRes = await graphGet<PagedResponse<CampNode>>(
    `/${acct}/campaigns`,
    {
      limit: "200",
      fields: `id,name,objective,insights.time_range(${timeRange}){spend,impressions,clicks,ctr,cpc,actions}`,
    },
    token,
  );

  // 4) Conjuntos de anúncios (ad sets)
  interface AdSetNode {
    id: string;
    name: string;
    campaign_id: string;
    insights?: PagedResponse<InsightRow>;
  }
  const adsetsRes = await graphGet<PagedResponse<AdSetNode>>(
    `/${acct}/adsets`,
    {
      limit: "500",
      fields: `id,name,campaign_id,insights.time_range(${timeRange}){spend,impressions,clicks,ctr,cpc,actions}`,
    },
    token,
  );

  // 5) Anúncios (ads)
  interface AdNode {
    id: string;
    name: string;
    adset_id: string;
    campaign_id: string;
    insights?: PagedResponse<InsightRow>;
  }
  const adsRes = await graphGet<PagedResponse<AdNode>>(
    `/${acct}/ads`,
    {
      limit: "500",
      fields: `id,name,adset_id,campaign_id,insights.time_range(${timeRange}){spend,impressions,clicks,ctr,cpc,actions}`,
    },
    token,
  );

  function rowMetrics(ins: InsightRow | undefined) {
    const sp = num(ins?.spend);
    const cl = num(ins?.clicks);
    const wpp = sumActions(ins?.actions, WPP_ACTIONS);
    const pur = sumActions(ins?.actions, PURCHASE_ACTIONS);
    const result = wpp || pur || cl;
    const resultLabel = wpp ? "Conversas WPP" : pur ? "Compras" : "Cliques no link";
    return {
      spend: sp,
      impressions: num(ins?.impressions),
      clicks: cl,
      result,
      resultLabel,
      costPerResult: result ? sp / result : 0,
    };
  }

  // Construir ads filtrando spend > 0
  const adsByAdset = new Map<string, AdRow[]>();
  for (const a of adsRes.data) {
    const m = rowMetrics(a.insights?.data?.[0]);
    if (m.spend <= 0) continue;
    const row: AdRow = { id: a.id, adsetId: a.adset_id, name: a.name, ...m };
    const arr = adsByAdset.get(a.adset_id) ?? [];
    arr.push(row);
    adsByAdset.set(a.adset_id, arr);
  }

  // Construir adsets filtrando spend > 0
  const adsetsByCampaign = new Map<string, AdSetRow[]>();
  for (const s of adsetsRes.data) {
    const m = rowMetrics(s.insights?.data?.[0]);
    if (m.spend <= 0) continue;
    const row: AdSetRow = {
      id: s.id,
      campaignId: s.campaign_id,
      name: s.name,
      ...m,
      ads: (adsByAdset.get(s.id) ?? []).sort((a, b) => b.spend - a.spend),
    };
    const arr = adsetsByCampaign.get(s.campaign_id) ?? [];
    arr.push(row);
    adsetsByCampaign.set(s.campaign_id, arr);
  }

  const campaigns: CampaignRow[] = campsRes.data
    .map((c) => {
      const m = rowMetrics(c.insights?.data?.[0]);
      return {
        id: c.id,
        source: "meta" as const,
        name: c.name,
        unit: unitName,
        ...m,
        adsets: (adsetsByCampaign.get(c.id) ?? []).sort((a, b) => b.spend - a.spend),
      };
    })
    .filter((c) => c.spend > 0);

  return {
    meta: {
      spend,
      reach,
      impressions,
      frequency: num(t.frequency) || (reach ? impressions / reach : 0),
      clicks,
      ctr: num(t.ctr),
      cpc: num(t.cpc),
      cpm: num(t.cpm),
      whatsappConversations: wppConv,
      costPerConversation: wppConv ? spend / wppConv : 0,
      purchases,
      costPerPurchase: purchases ? spend / purchases : 0,
      roas: spend && purchaseValue ? purchaseValue / spend : 0,
      campaigns,
      unitBreakdown: [{ unit: unitName, spend, impressions, clicks }],
    },
    daily,
  };
}
