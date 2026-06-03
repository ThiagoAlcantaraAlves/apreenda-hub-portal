// Hub multi-tenant: a config real de contas vem do banco (tenant_accounts),
// resolvida no servidor em marketing.functions.ts. Aqui ficam só os tipos e
// uma unidade genérica usada pelo gerador de mock (demo / fallback) e pela UI.
export type SourceKey =
  | "ga4"
  | "google_ads"
  | "meta_ads"
  | "facebook_organic"
  | "instagram"
  | "firebase";

export type UnitId = string;

export interface UnitConfig {
  id: UnitId;
  name: string;
  accounts: {
    google_ads?: string[];
    meta_ads?: string[];
    googleanalytics4?: string[];
    facebook?: string[];
    firebase?: string[];
  };
}

// Unidade genérica — o mock gera dados sobre ela; os dados reais por tenant
// são resolvidos no server (tenant_accounts).
export const UNITS: UnitConfig[] = [
  { id: "tenant", name: "Conta", accounts: {} },
];

export const ALL_SOURCES: { key: SourceKey; label: string }[] = [
  { key: "meta_ads", label: "Meta Ads" },
  { key: "google_ads", label: "Google Ads" },
];
