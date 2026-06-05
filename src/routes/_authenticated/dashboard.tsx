import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { subDays } from "date-fns";
import { ArrowLeft, Facebook, Loader2, Check, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterBar, type FilterState } from "@/components/marketing/FilterBar";
import { MetaAdsTab } from "@/components/marketing/tabs/MetaAdsTab";
import { LoadingState } from "@/components/marketing/shared/LoadingState";
import { ErrorState } from "@/components/marketing/shared/ErrorState";
import { useWindsorData } from "@/hooks/useWindsorData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getMetaOAuthUrl } from "@/lib/fb-oauth";
import { getGoogleOAuthUrl } from "@/lib/google-oauth";
import { metaListAccounts, metaSelectAccount } from "@/lib/meta.functions";
import { googleListAssets, googleSelectAssets } from "@/lib/google.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function defaultDates() {
  return {
    start: subDays(new Date(), 6).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  };
}

function daysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400_000));
}

function DashboardPage() {
  const { profile } = useAuth();

  const { data: conn, isLoading: connLoading, refetch } = useQuery({
    queryKey: ["connections", profile?.id],
    queryFn: async () => {
      const [{ data: meta }, { data: google }, { data: tenant }] = await Promise.all([
        (supabase as any).from("meta_tokens").select("ad_account_id").eq("user_id", profile!.id).maybeSingle(),
        (supabase as any)
          .from("google_tokens")
          .select("ga4_property_id, ads_customer_id")
          .eq("user_id", profile!.id)
          .maybeSingle(),
        supabase.from("tenants").select("status").eq("id", profile!.tenant_id!).maybeSingle(),
      ]);
      return {
        metaConnected: !!meta,
        metaAccountSelected: !!meta?.ad_account_id,
        googleConnected: !!google,
        googleAssetSelected: !!(google?.ga4_property_id || google?.ads_customer_id),
        managed: (tenant as any)?.status === "active",
      };
    },
    enabled: !!profile?.id,
  });

  if (connLoading || !conn) {
    return <Shell><LoadingState /></Shell>;
  }

  // Cliente gerenciado → dashboard direto.
  // Trial: precisa conectar PELO MENOS uma fonte (Meta ou Google) e selecionar conta/asset.
  const anyConnected = conn.metaConnected || conn.googleConnected;
  const needsAccountPicker =
    (conn.metaConnected && !conn.metaAccountSelected) ||
    (conn.googleConnected && !conn.googleAssetSelected);

  if (!conn.managed && !anyConnected) {
    return <Shell><ConnectAccounts /></Shell>;
  }
  if (!conn.managed && needsAccountPicker) {
    return (
      <Shell>
        {conn.metaConnected && !conn.metaAccountSelected && <AccountPicker onDone={() => refetch()} />}
        {conn.googleConnected && !conn.googleAssetSelected && <GooglePicker onDone={() => refetch()} />}
      </Shell>
    );
  }

  return (
    <Shell>
      {!conn.managed && <TrialBanner days={daysLeft(profile?.trial_ends_at ?? null)} />}
      <DashboardData />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/home"><ArrowLeft className="size-4 mr-1.5" /> Voltar</Link>
        </Button>
        <span className="block text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Dashboard de Marketing
        </span>
      </div>
      {children}
    </div>
  );
}

function TrialBanner({ days }: { days: number | null }) {
  if (days === null) return null;
  return (
    <div className="mb-4 rounded-lg gold-border bg-card px-4 py-3 text-sm text-foreground flex items-center justify-between gap-3 no-print">
      <span>
        Teste grátis — <span className="text-primary font-semibold">{days} {days === 1 ? "dia restante" : "dias restantes"}</span>
      </span>
      <a href="https://apreenda.com.br" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
        Virar cliente
      </a>
    </div>
  );
}

function DashboardData() {
  const d = defaultDates();
  const [filters, setFilters] = useState<FilterState>({
    start: d.start,
    end: d.end,
    units: [],
    source: "all",
    comparison: "previous_period",
  });
  const w = useWindsorData(filters);
  const update = (next: Partial<FilterState>) => setFilters((prev) => ({ ...prev, ...next }));

  return (
    <>
      <div className="sticky top-0 z-30 mb-4 border-b border-border/40 bg-background/80 py-2.5 backdrop-blur-xl no-print">
        <FilterBar value={filters} onChange={update} />
      </div>
      <div className="space-y-4">
        {w.loading && <LoadingState />}
        {!w.loading && w.error && (
          <ErrorState message={String(w.error)} onRetry={() => window.location.reload()} />
        )}
        {!w.loading && !w.error && w.data && (
          <MetaAdsTab data={w.data} previous={w.previousData} />
        )}
      </div>
    </>
  );
}

function ConnectAccounts() {
  return (
    <div className="max-w-2xl mx-auto py-16">
      <div className="text-center">
        <h1 className="font-display text-3xl text-primary">Conecte suas contas</h1>
        <div className="mt-3 mx-auto h-px w-12 bg-primary/60" />
        <p className="mt-6 text-sm text-muted-foreground leading-relaxed">
          Conecte Facebook/Instagram (Meta) e/ou Google (GA4 + Ads) para ver suas campanhas,
          gastos e resultados num só painel. Seu teste grátis de 30 dias começa agora.
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg gold-border bg-card p-6 text-center">
          <div className="mx-auto w-12 h-12 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
            <Facebook className="size-5" />
          </div>
          <h2 className="mt-4 font-display text-lg text-primary">Meta Ads</h2>
          <p className="mt-2 text-xs text-muted-foreground">Facebook e Instagram Ads</p>
          <a
            href={getMetaOAuthUrl()}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Facebook className="size-4" /> Conectar Meta
          </a>
        </div>

        <div className="rounded-lg gold-border bg-card p-6 text-center">
          <div className="mx-auto w-12 h-12 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
            <BarChart3 className="size-5" />
          </div>
          <h2 className="mt-4 font-display text-lg text-primary">Google</h2>
          <p className="mt-2 text-xs text-muted-foreground">GA4 + Google Ads</p>
          <a
            href={getGoogleOAuthUrl()}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <BarChart3 className="size-4" /> Conectar Google
          </a>
        </div>
      </div>
    </div>
  );
}

function AccountPicker({ onDone }: { onDone: () => void }) {
  const list = useServerFn(metaListAccounts);
  const select = useServerFn(metaSelectAccount);
  const [saving, setSaving] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["meta-accounts"],
    queryFn: () => list() as Promise<{ accounts: { id: string; name: string; currency?: string }[] }>,
  });

  const choose = async (id: string, name: string) => {
    setSaving(id);
    try {
      await select({ data: { accountId: id, accountName: name } });
      onDone();
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-12">
      <h1 className="font-display text-2xl text-primary text-center">Escolha a conta Meta Ads</h1>
      <p className="mt-3 mb-8 text-center text-sm text-muted-foreground">
        Selecione qual conta de anúncios você quer acompanhar.
      </p>
      {isLoading && <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-primary" /></div>}
      {error && <ErrorState message={String((error as Error).message)} onRetry={() => window.location.reload()} />}
      <div className="space-y-2">
        {data?.accounts?.map((a) => (
          <button
            key={a.id}
            onClick={() => choose(a.id, a.name)}
            disabled={!!saving}
            className="w-full flex items-center justify-between rounded-lg gold-border bg-card px-4 py-3 text-left hover:border-primary/70 transition disabled:opacity-60"
          >
            <span>
              <span className="block text-sm text-foreground">{a.name}</span>
              <span className="block text-xs text-muted-foreground font-mono">{a.id}{a.currency ? ` · ${a.currency}` : ""}</span>
            </span>
            {saving === a.id ? <Loader2 className="size-4 animate-spin text-primary" /> : <Check className="size-4 text-primary opacity-0 group-hover:opacity-100" />}
          </button>
        ))}
        {data && data.accounts?.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            Nenhuma conta de anúncios encontrada nesse Facebook.
          </p>
        )}
      </div>
    </div>
  );
}

function GooglePicker({ onDone }: { onDone: () => void }) {
  const list = useServerFn(googleListAssets);
  const save = useServerFn(googleSelectAssets);
  const [ga4, setGa4] = useState<{ id: string; name: string } | null>(null);
  const [ads, setAds] = useState<{ id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["google-assets"],
    queryFn: () =>
      list() as Promise<{
        ga4Properties: { id: string; name: string; account: string }[];
        adsCustomers: { id: string; name: string }[];
      }>,
  });

  const handleSave = async () => {
    if (!ga4 && !ads) return;
    setSaving(true);
    try {
      await save({
        data: {
          ga4PropertyId: ga4?.id ?? null,
          ga4PropertyName: ga4?.name ?? null,
          adsCustomerId: ads?.id ?? null,
          adsCustomerName: ads?.name ?? null,
        },
      });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-12">
      <h1 className="font-display text-2xl text-primary text-center">Escolha suas contas Google</h1>
      <p className="mt-3 mb-8 text-center text-sm text-muted-foreground">
        Selecione uma property do GA4 e/ou um customer do Google Ads.
      </p>
      {isLoading && <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-primary" /></div>}
      {error && <ErrorState message={String((error as Error).message)} onRetry={() => window.location.reload()} />}

      {data && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">GA4 Properties</h3>
            <div className="space-y-2">
              {data.ga4Properties.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Nenhuma property encontrada.</p>
              )}
              {data.ga4Properties.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setGa4(ga4?.id === p.id ? null : { id: p.id, name: p.name })}
                  className={`w-full flex items-center justify-between rounded-lg gold-border bg-card px-4 py-3 text-left transition ${ga4?.id === p.id ? "border-primary" : "hover:border-primary/70"}`}
                >
                  <span>
                    <span className="block text-sm text-foreground">{p.name}</span>
                    <span className="block text-xs text-muted-foreground">{p.account} · {p.id}</span>
                  </span>
                  {ga4?.id === p.id && <Check className="size-4 text-primary" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Google Ads (opcional)</h3>
            <div className="space-y-2">
              {data.adsCustomers.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Nenhum customer Ads disponível.</p>
              )}
              {data.adsCustomers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setAds(ads?.id === c.id ? null : { id: c.id, name: c.name })}
                  className={`w-full flex items-center justify-between rounded-lg gold-border bg-card px-4 py-3 text-left transition ${ads?.id === c.id ? "border-primary" : "hover:border-primary/70"}`}
                >
                  <span className="block text-sm font-mono text-foreground">{c.name}</span>
                  {ads?.id === c.id && <Check className="size-4 text-primary" />}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleSave} disabled={(!ga4 && !ads) || saving} className="w-full">
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Salvar seleção"}
          </Button>
        </div>
      )}
    </div>
  );
}
