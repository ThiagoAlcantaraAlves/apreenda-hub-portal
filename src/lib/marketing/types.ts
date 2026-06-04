export type SourceFilter =
  | "all"
  | "ga4"
  | "meta_ads"
  | "google_ads"
  | "facebook_organic"
  | "instagram"
  | "firebase";

export type ComparisonMode = "previous_period" | "previous_year";

export interface AdRow {
  id: string;
  adsetId: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  result: number;
  resultLabel: string;
  costPerResult: number;
}

export interface AdSetRow {
  id: string;
  campaignId: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  result: number;
  resultLabel: string;
  costPerResult: number;
  ads: AdRow[];
}

export interface CampaignRow {
  id?: string;
  source: "meta" | "google";
  name: string;
  unit: string;
  spend: number;
  impressions: number;
  clicks: number;
  result: number;
  resultLabel: string;
  costPerResult: number;
  adsets?: AdSetRow[];
}

export interface UnitBreakdown {
  unit: string;
  spend: number;
  impressions: number;
  clicks: number;
}

export interface AuctionRow {
  unit: string;
  impressionShare: number; // 0..1
  topOfPage: number;
  absoluteTop: number;
}

export interface DailySpendPoint {
  date: string; // ISO yyyy-MM-dd
  meta: number;
  google: number;
}

export interface ChannelDistribution {
  channel: string;
  sessions: number;
}

export interface TopRow {
  label: string;
  value: number;
}

export interface MarketingData {
  period: { start: string; end: string };

  meta?: {
    _fallback?: boolean;
    _error?: string;
    spend: number;
    reach: number;
    impressions: number;
    frequency: number;
    clicks: number;
    ctr: number;
    cpc: number;
    cpm: number;
    whatsappConversations: number;
    costPerConversation: number;
    purchases: number;
    costPerPurchase: number;
    roas: number;
    campaigns: CampaignRow[];
    unitBreakdown: UnitBreakdown[];
  };

  googleAds?: {
    cost: number;
    impressions: number;
    clicks: number;
    cpc: number;
    conversions: number;
    unitBreakdown: UnitBreakdown[];
    auction: AuctionRow[];
  };

  ga4?: {
    sessions: number;
    users: number;
    newUsers: number;
    bounceRate: number; // %
    avgDuration: number; // s
    conversions: number;
    revenue: number;
    pagesPerSession: number;
    channels: ChannelDistribution[];
    topCities: TopRow[];
    topPages: TopRow[];
    devices: { desktop: number; mobile: number; tablet: number };
  };

  facebook?: {
    reach: number;
    impressions: number;
    engagements: number;
    likes: number;
    comments: number;
    shares: number;
    topPosts: { text: string; type: string; reach: number; engagements: number; date: string }[];
  };

  instagram?: {
    reach: number;
    impressions: number;
    engagements: number;
    followers: number;
    likes: number;
    comments: number;
    contentTypes: { reels: number; carrossel: number; imagem: number; stories: number };
  };

  app?: {
    downloads: number;
    activeUsers: number;
    sessions: number;
    revenue: number;
    iosShare: number; // 0..1
    funnel: { views: number; clicks: number; installs: number };
  };

  dailySpend: DailySpendPoint[];
}
