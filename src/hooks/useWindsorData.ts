import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { getMarketingData } from "@/lib/marketing.functions";
import type { MarketingData, SourceFilter, ComparisonMode } from "@/lib/marketing/types";
import { comparisonRange } from "@/lib/marketing/comparison";
import { ALL_SOURCES, UNITS } from "@/lib/accounts";

export interface UseWindsorParams {
  start: string;
  end: string;
  units: string[];
  source: SourceFilter;
  comparison: ComparisonMode;
}

export function useWindsorData(p: UseWindsorParams) {
  const fetchFn = useServerFn(getMarketingData);

  const cur = useQuery({
    queryKey: ["marketing", "current", p],
    queryFn: () =>
      fetchFn({
        data: { start: p.start, end: p.end, units: p.units, source: p.source, variant: "current" },
      }) as Promise<MarketingData>,
    staleTime: 60_000,
  });

  const prevRange = useMemo(() => comparisonRange(p.start, p.end, p.comparison), [p.start, p.end, p.comparison]);
  const prev = useQuery({
    queryKey: ["marketing", "previous", p, prevRange],
    queryFn: () =>
      fetchFn({
        data: {
          start: prevRange.start,
          end: prevRange.end,
          units: p.units,
          source: p.source,
          variant: "previous",
        },
      }) as Promise<MarketingData>,
    staleTime: 60_000,
  });

  const data = cur.data;
  const previousData = prev.data;

  const flags = useMemo(() => {
    const d = data;
    return {
      hasGoogleData: !!d?.googleAds && (d.googleAds.impressions > 0 || d.googleAds.clicks > 0),
      hasMetaData: !!d?.meta && d.meta.spend > 0,
      hasFacebookData: !!d?.facebook && d.facebook.reach > 0,
      hasInstagramData: !!d?.instagram && d.instagram.reach > 0,
      hasAppData: !!d?.app && d.app.downloads > 0,
      hasGa4Data: !!d?.ga4 && d.ga4.sessions > 0,
    };
  }, [data]);

  return {
    data,
    previousData,
    previousRange: prevRange,
    loading: cur.isLoading || prev.isLoading,
    error: cur.error ?? prev.error,
    accounts: UNITS,
    connectedSources: ALL_SOURCES,
    ...flags,
  };
}
