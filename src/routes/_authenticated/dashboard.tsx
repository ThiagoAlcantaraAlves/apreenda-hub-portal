import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { subDays } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterBar, type FilterState } from "@/components/marketing/FilterBar";
import { MetaAdsTab } from "@/components/marketing/tabs/MetaAdsTab";
import { LoadingState } from "@/components/marketing/shared/LoadingState";
import { ErrorState } from "@/components/marketing/shared/ErrorState";
import { useWindsorData } from "@/hooks/useWindsorData";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function defaultDates() {
  return {
    start: subDays(new Date(), 6).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  };
}

function DashboardPage() {
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
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/home"><ArrowLeft className="size-4 mr-1.5" /> Voltar</Link>
        </Button>
        <span className="block text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Dashboard de Marketing
        </span>
      </div>

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
    </div>
  );
}
