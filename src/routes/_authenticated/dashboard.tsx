import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { subDays } from "date-fns";
import { ArrowLeft, Facebook, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterBar, type FilterState } from "@/components/marketing/FilterBar";
import { MetaAdsTab } from "@/components/marketing/tabs/MetaAdsTab";
import { LoadingState } from "@/components/marketing/shared/LoadingState";
import { ErrorState } from "@/components/marketing/shared/ErrorState";
import { useWindsorData } from "@/hooks/useWindsorData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getMetaOAuthUrl } from "@/lib/fb-oauth";
import { metaListAccounts, metaSelectAccount } from "@/lib/meta.functions";

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

  // Estado de conexão do usuário (token + conta) e tenant
  const { data: conn, isLoading: connLoading, refetch } = useQuery({
    queryKey: ["meta-conn", profile?.id],
    queryFn: async () => {
      const [{ data: tok }, { data: tenant }] = await Promise.all([
        (supabase as any).from("meta_tokens").select("ad_account_id").eq("user_id", profile!.id).maybeSingle(),
        supabase.from("tenants").select("status").eq("id", profile!.tenant_id!).maybeSingle(),
      ]);
      return {
        connected: !!tok,
        accountSelected: !!tok?.ad_account_id,
        managed: (tenant as any)?.status === "active",
      };
    },
    enabled: !!profile?.id,
  });

  if (connLoading || !conn) {
    return <Shell><LoadingState /></Shell>;
  }

  // Cliente gerenciado (Hospitalar/Gabriela) → dashboard direto (dados via conta do tenant).
  // Trial: precisa conectar Facebook e escolher conta.
  if (!conn.managed && !conn.connected) {
    return <Shell><ConnectFacebook /></Shell>;
  }
  if (!conn.managed && conn.connected && !conn.accountSelected) {
    return <Shell><AccountPicker onDone={() => refetch()} /></Shell>;
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

function ConnectFacebook() {
  return (
    <div className="max-w-md mx-auto py-16 text-center">
      <div className="mx-auto w-14 h-14 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
        <Facebook className="size-6" />
      </div>
      <h1 className="mt-6 font-display text-3xl text-primary">Conecte seu Facebook</h1>
      <div className="mt-3 mx-auto h-px w-12 bg-primary/60" />
      <p className="mt-6 text-sm text-muted-foreground leading-relaxed">
        Conecte sua conta de anúncios do Facebook para ver suas campanhas, gastos e resultados
        em um só painel. Seu teste grátis de 30 dias começa agora.
      </p>
      <a
        href={getMetaOAuthUrl()}
        className="mt-8 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        <Facebook className="size-4" /> Conectar com Facebook
      </a>
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
      <h1 className="font-display text-2xl text-primary text-center">Escolha a conta de anúncios</h1>
      <p className="mt-3 mb-8 text-center text-sm text-muted-foreground">
        Selecione qual conta você quer acompanhar no painel.
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
