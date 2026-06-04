import type {
  CampaignRow,
  DailySpendPoint,
  MarketingData,
  SourceFilter,
} from "./types";
import { UNITS } from "../accounts";

// Hash determinístico para ter dados consistentes a partir dos filtros.
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function dayCount(start: string, end: string): number {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

function isoDay(start: string, offset: number): string {
  const d = new Date(start);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

interface MockArgs {
  start: string;
  end: string;
  units: string[]; // unit ids; empty = all
  source: SourceFilter;
  variant: "current" | "previous";
}

// Objetivos Meta — fixos e realistas para contexto hospitalar.
const META_OBJECTIVES = [
  { suffix: "[WEB]", label: "Compras", cprMin: 8, cprMax: 25 },
  { suffix: "[WHATSAPP]", label: "Conversas WPP", cprMin: 4, cprMax: 12 },
];

export function generateMarketingData(args: MockArgs): MarketingData {
  const seed = hashStr(
    `${args.start}|${args.end}|${args.units.sort().join(",")}|${args.source}|${args.variant}`,
  );
  const rng = makeRng(seed);
  const days = dayCount(args.start, args.end);
  const variantMultiplier = args.variant === "previous" ? 0.85 + rng() * 0.2 : 1;

  const activeUnits = args.units.length
    ? UNITS.filter((u) => args.units.includes(u.id))
    : UNITS;

  // ----- 1) Gerar campanhas primeiro (fonte da verdade) -----
  const campaigns: CampaignRow[] = [];

  activeUnits.forEach((u) => {
    // Meta: uma campanha por objetivo
    META_OBJECTIVES.forEach((obj) => {
      // gasto médio diário R$ 600–1.400 por campanha por unidade
      const dailyBudget = (600 + rng() * 800) * variantMultiplier;
      const cSpend = Math.round(dailyBudget * days);
      // CPM Meta R$ 4–9 → impressões = spend / cpm * 1000
      const cpm = 4 + rng() * 5;
      const cImpressions = Math.round((cSpend / cpm) * 1000);
      // CTR Meta 1.5%–3.5%
      const ctr = 0.015 + rng() * 0.02;
      const cClicks = Math.round(cImpressions * ctr);
      // Custo por resultado dentro da faixa do objetivo
      const cpr = obj.cprMin + rng() * (obj.cprMax - obj.cprMin);
      const cResult = Math.max(1, Math.round(cSpend / cpr));
      const campaignId = `c_${u.id}_${obj.suffix}`;
      // Distribuir em 2-3 conjuntos e cada um em 2-3 anúncios
      const numAdsets = 2 + Math.floor(rng() * 2);
      const adsetWeights = Array.from({ length: numAdsets }, () => 0.5 + rng());
      const wSum = adsetWeights.reduce((s, w) => s + w, 0);
      const adsets = adsetWeights.map((w, i) => {
        const sShare = w / wSum;
        const sSpend = Math.round(cSpend * sShare);
        const sImpr = Math.round(cImpressions * sShare);
        const sClicks = Math.round(cClicks * sShare);
        const sResult = Math.max(1, Math.round(cResult * sShare));
        const adsetId = `${campaignId}_as${i}`;
        const numAds = 2 + Math.floor(rng() * 2);
        const adWeights = Array.from({ length: numAds }, () => 0.5 + rng());
        const awSum = adWeights.reduce((s, w) => s + w, 0);
        const ads = adWeights.map((aw, j) => {
          const aShare = aw / awSum;
          const aSpend = Math.round(sSpend * aShare);
          const aImpr = Math.round(sImpr * aShare);
          const aClicks = Math.round(sClicks * aShare);
          const aResult = Math.max(1, Math.round(sResult * aShare));
          return {
            id: `${adsetId}_ad${j}`,
            adsetId,
            name: `Anúncio ${j + 1} — ${obj.label}`,
            spend: aSpend,
            impressions: aImpr,
            clicks: aClicks,
            result: aResult,
            resultLabel: obj.label,
            costPerResult: aResult ? aSpend / aResult : 0,
          };
        });
        return {
          id: adsetId,
          campaignId,
          name: `Conjunto ${i + 1} — ${obj.label}`,
          spend: sSpend,
          impressions: sImpr,
          clicks: sClicks,
          result: sResult,
          resultLabel: obj.label,
          costPerResult: sResult ? sSpend / sResult : 0,
          ads,
        };
      });
      campaigns.push({
        id: campaignId,
        source: "meta",
        name: `${u.name} — ${obj.label} ${obj.suffix}`,
        unit: u.name,
        spend: cSpend,
        impressions: cImpressions,
        clicks: cClicks,
        result: cResult,
        resultLabel: obj.label,
        costPerResult: cSpend / cResult,
        adsets,
      });
    });

    // Google Search: 1 campanha de leads por unidade
    if (u.accounts.google_ads) {
      const dailyBudget = (500 + rng() * 700) * variantMultiplier;
      const cSpend = Math.round(dailyBudget * days);
      // CPC Google R$ 1,80–4,00
      const cpc = 1.8 + rng() * 2.2;
      const cClicks = Math.max(1, Math.round(cSpend / cpc));
      // CTR Google 5%–9%
      const ctrG = 0.05 + rng() * 0.04;
      const cImpressions = Math.round(cClicks / ctrG);
      // Conversão 6%–12%
      const cResult = Math.max(1, Math.round(cClicks * (0.06 + rng() * 0.06)));
      campaigns.push({
        source: "google",
        name: `Search — ${u.name} [LEADS]`,
        unit: u.name,
        spend: cSpend,
        impressions: cImpressions,
        clicks: cClicks,
        result: cResult,
        resultLabel: "Conversões",
        costPerResult: cSpend / cResult,
      });
    }
  });

  // ----- 2) Derivar totais Meta e Google da soma das campanhas -----
  const metaCamps = campaigns.filter((c) => c.source === "meta");
  const googleCamps = campaigns.filter((c) => c.source === "google");

  const totalMetaSpend = metaCamps.reduce((s, c) => s + c.spend, 0);
  const metaImpressions = metaCamps.reduce((s, c) => s + c.impressions, 0);
  const metaClicks = metaCamps.reduce((s, c) => s + c.clicks, 0);
  const metaConversations = metaCamps
    .filter((c) => c.resultLabel === "Conversas WPP")
    .reduce((s, c) => s + c.result, 0);
  const metaPurchases = metaCamps
    .filter((c) => c.resultLabel === "Compras")
    .reduce((s, c) => s + c.result, 0);
  const metaReach = Math.round(metaImpressions * (0.5 + rng() * 0.15));

  const totalGoogleSpend = googleCamps.reduce((s, c) => s + c.spend, 0);
  const gImpressions = googleCamps.reduce((s, c) => s + c.impressions, 0);
  const gClicks = googleCamps.reduce((s, c) => s + c.clicks, 0);
  const gConversions = googleCamps.reduce((s, c) => s + c.result, 0);

  // ----- 3) Distribuir gasto diário proporcional aos totais (para o gráfico) -----
  const rawDaily = Array.from({ length: days }, (_, i) => {
    const weekend = [0, 6].includes(new Date(isoDay(args.start, i)).getUTCDay()) ? 0.7 : 1;
    return { day: i, weight: (0.85 + rng() * 0.3) * weekend };
  });
  const totalWeight = rawDaily.reduce((s, d) => s + d.weight, 0) || 1;
  const dailySpend: DailySpendPoint[] = rawDaily.map((d) => ({
    date: isoDay(args.start, d.day),
    meta: Math.round((d.weight / totalWeight) * totalMetaSpend),
    google: Math.round((d.weight / totalWeight) * totalGoogleSpend),
  }));

  const meta = {
    spend: totalMetaSpend,
    reach: metaReach,
    impressions: metaImpressions,
    frequency: metaImpressions / Math.max(1, metaReach),
    clicks: metaClicks,
    ctr: (metaClicks / Math.max(1, metaImpressions)) * 100,
    cpc: totalMetaSpend / Math.max(1, metaClicks),
    cpm: (totalMetaSpend / Math.max(1, metaImpressions)) * 1000,
    whatsappConversations: metaConversations,
    costPerConversation: totalMetaSpend / Math.max(1, metaConversations),
    purchases: metaPurchases,
    costPerPurchase: totalMetaSpend / Math.max(1, metaPurchases),
    roas: 1.5 + rng() * 3,
    campaigns,
    unitBreakdown: activeUnits.map((u) => {
      const slice = metaCamps.filter((c) => c.unit === u.name);
      return {
        unit: u.name,
        spend: slice.reduce((s, c) => s + c.spend, 0),
        impressions: slice.reduce((s, c) => s + c.impressions, 0),
        clicks: slice.reduce((s, c) => s + c.clicks, 0),
      };
    }),
  };

  // ----- Google Ads -----
  const googleAds = {
    cost: totalGoogleSpend,
    impressions: gImpressions,
    clicks: gClicks,
    cpc: totalGoogleSpend / Math.max(1, gClicks),
    conversions: gConversions,
    unitBreakdown: activeUnits
      .filter((u) => u.accounts.google_ads)
      .map((u) => {
        const slice = campaigns.filter((c) => c.unit === u.name && c.source === "google");
        return {
          unit: u.name,
          spend: slice.reduce((s, c) => s + c.spend, 0),
          impressions: slice.reduce((s, c) => s + c.impressions, 0),
          clicks: slice.reduce((s, c) => s + c.clicks, 0),
        };
      }),
    auction: activeUnits
      .filter((u) => u.accounts.google_ads)
      .map((u) => ({
        unit: u.name,
        impressionShare: 0.35 + rng() * 0.55,
        topOfPage: 0.4 + rng() * 0.5,
        absoluteTop: 0.15 + rng() * 0.5,
      }))
      .sort((a, b) => b.impressionShare - a.impressionShare),
  };

  // ----- GA4 -----
  const sessions = Math.round((metaClicks + gClicks) * (1.5 + rng() * 1.2));
  const users = Math.round(sessions * (0.7 + rng() * 0.2));
  const ga4 = {
    sessions,
    users,
    newUsers: Math.round(users * (0.5 + rng() * 0.3)),
    bounceRate: 35 + rng() * 30,
    avgDuration: 80 + rng() * 120,
    conversions: Math.round(sessions * (0.02 + rng() * 0.04)),
    revenue: Math.round(sessions * (5 + rng() * 15)),
    pagesPerSession: 1.8 + rng() * 1.5,
    channels: [
      { channel: "Pago", sessions: Math.round(sessions * 0.45) },
      { channel: "Orgânico", sessions: Math.round(sessions * 0.22) },
      { channel: "Direto", sessions: Math.round(sessions * 0.15) },
      { channel: "Social", sessions: Math.round(sessions * 0.10) },
      { channel: "Email", sessions: Math.round(sessions * 0.05) },
      { channel: "Outros", sessions: Math.round(sessions * 0.03) },
    ],
    topCities: [
      "São Paulo", "Rio de Janeiro", "Belo Horizonte", "Curitiba", "Porto Alegre",
      "Brasília", "Salvador", "Recife", "Fortaleza", "Manaus",
    ].map((c, i) => ({ label: c, value: Math.round(sessions * (0.3 - i * 0.025)) })),
    topPages: [
      "/", "/sobre", "/servicos", "/unidades", "/contato",
      "/blog", "/agendar", "/promocoes", "/faq", "/depoimentos",
    ].map((p, i) => ({ label: p, value: Math.round(sessions * (0.4 - i * 0.03)) })),
    devices: {
      desktop: Math.round(sessions * 0.32),
      mobile: Math.round(sessions * 0.61),
      tablet: Math.round(sessions * 0.07),
    },
  };

  // ----- Facebook orgânico -----
  const fbReach = Math.round(metaReach * 0.4);
  const facebook = {
    reach: fbReach,
    impressions: Math.round(fbReach * 1.4),
    engagements: Math.round(fbReach * 0.05),
    likes: Math.round(fbReach * 0.03),
    comments: Math.round(fbReach * 0.008),
    shares: Math.round(fbReach * 0.005),
    topPosts: Array.from({ length: 5 }, (_, i) => ({
      text: [
        "Nova unidade inaugurada com casa cheia 🎉",
        "Promoção relâmpago para clientes fiéis",
        "Equipe ampliada para atender melhor",
        "Conheça nossa nova linha de serviços",
        "Depoimento da semana — obrigado!",
      ][i],
      type: ["Imagem", "Vídeo", "Carrossel", "Texto", "Imagem"][i],
      reach: Math.round(fbReach * (0.3 - i * 0.04)),
      engagements: Math.round(fbReach * (0.025 - i * 0.003)),
      date: isoDay(args.start, Math.floor(rng() * days)),
    })),
  };

  // ----- Instagram -----
  const igReach = Math.round(metaReach * 0.6);
  const instagram = {
    reach: igReach,
    impressions: Math.round(igReach * 1.6),
    engagements: Math.round(igReach * 0.07),
    followers: Math.round(15000 + rng() * 25000),
    likes: Math.round(igReach * 0.05),
    comments: Math.round(igReach * 0.012),
    contentTypes: {
      reels: Math.round(igReach * 0.5),
      carrossel: Math.round(igReach * 0.25),
      imagem: Math.round(igReach * 0.15),
      stories: Math.round(igReach * 0.10),
    },
  };

  // ----- App (Firebase) -----
  const hasFirebase = activeUnits.some((u) => u.accounts.firebase);
  const app = hasFirebase
    ? {
        downloads: Math.round(200 + rng() * 800) * activeUnits.length,
        activeUsers: Math.round(1500 + rng() * 4000),
        sessions: Math.round(8000 + rng() * 12000),
        revenue: Math.round(5000 + rng() * 15000),
        iosShare: 0.35 + rng() * 0.3,
        funnel: {
          views: Math.round(20000 + rng() * 30000),
          clicks: Math.round(8000 + rng() * 10000),
          installs: Math.round(1500 + rng() * 2500),
        },
      }
    : undefined;

  return {
    period: { start: args.start, end: args.end },
    meta,
    googleAds,
    ga4,
    facebook,
    instagram,
    app,
    dailySpend,
  };
}
