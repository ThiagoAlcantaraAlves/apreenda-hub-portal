import { Fragment, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Activity, ChevronDown, ChevronRight, DollarSign, Eye, MessageCircle, MousePointerClick, Printer,
  ShoppingCart, Target, TrendingUp, Users,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { KpiCard } from "../shared/KpiCard";
import { StatusBadge } from "../shared/StatusBadge";
import { classifyMetric } from "@/lib/marketing/classify";
import { formatBRL, formatDecimal, formatNumber, formatPercent, formatRange } from "@/lib/marketing/format";
import type { MarketingData } from "@/lib/marketing/types";
import { cn } from "@/lib/utils";

interface Props { data: MarketingData; previous?: MarketingData; }

export function MetaAdsTab({ data, previous }: Props) {
  const m = data.meta!;
  const pm = previous?.meta;
  const campaigns = m.campaigns.filter((c) => c.source === "meta" && c.spend > 0);

  const [openCamps, setOpenCamps] = useState<Set<string>>(new Set());
  const [openSets, setOpenSets] = useState<Set<string>>(new Set());
  const [showAllKpis, setShowAllKpis] = useState(false);
  const toggle = (set: Set<string>, fn: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    fn(next);
  };

  // série base para sparklines (mesmo ritmo do gasto)
  const baseSeries = useMemo(
    () => (data.dailySpend || []).map((d) => d.meta || 0),
    [data.dailySpend],
  );

  // resumo do gráfico
  const chartSummary = useMemo(() => {
    if (!data.dailySpend?.length) return null;
    const total = data.dailySpend.reduce((s, d) => s + (d.meta || 0), 0);
    const avg = total / data.dailySpend.length;
    const peak = data.dailySpend.reduce((p, d) => ((d.meta || 0) > (p.meta || 0) ? d : p), data.dailySpend[0]);
    return { total, avg, peak };
  }, [data.dailySpend]);

  return (
    <div className="space-y-4 animate-fade-in">
      {m._fallback && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          Não foi possível conectar à Meta API — exibindo dados de exemplo.
          {m._error && <span className="ml-1 opacity-70">({m._error})</span>}
        </div>
      )}

      {/* Info bar — só no desktop */}
      <div className="hidden items-center justify-between gap-2 no-print md:flex">
        <div className="flex flex-col text-sm text-muted-foreground">
          <span>
            Período: <span className="text-foreground">{formatRange(data.period.start, data.period.end)}</span>
          </span>
          {!m._fallback && (
            <span className="text-xs inline-flex items-center gap-1 text-status-excellent">
              <span className="h-1.5 w-1.5 rounded-full bg-status-excellent animate-pulse" />
              ao vivo
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => window.print()} className="transition-smooth hover:border-accent/50">
          <Printer className="mr-1.5 h-4 w-4" /> Imprimir
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {/* Hero */}
        <KpiCard variant="hero" delay={0} icon={DollarSign} label="Investimento" value={formatBRL(m.spend)}
          previous={pm ? { current: m.spend, previous: pm.spend } : undefined}
          previousLabel={pm ? formatBRL(pm.spend) : undefined}
          sparkline={baseSeries} />
        <KpiCard variant="hero" delay={40} icon={MessageCircle} label="Conversas WPP" value={formatNumber(m.whatsappConversations)}
          previous={pm ? { current: m.whatsappConversations, previous: pm.whatsappConversations } : undefined}
          sparkline={baseSeries} />
        <KpiCard variant="hero" delay={80} icon={DollarSign} label="Custo/conversa" value={formatBRL(m.costPerConversation)}
          status={classifyMetric("cost_per_result", m.costPerConversation)} />
        <KpiCard variant="hero" delay={120} icon={TrendingUp} label="ROAS" value={`${m.roas.toFixed(2)}x`}
          status={classifyMetric("roas", m.roas)} />

        {/* Standard */}
        <KpiCard delay={160} icon={Target} label="CTR" value={formatPercent(m.ctr)}
          status={classifyMetric("ctr_meta", m.ctr)} sparkline={baseSeries} />
        <KpiCard delay={200} icon={DollarSign} label="CPC" value={formatBRL(m.cpc)}
          status={classifyMetric("cpc", m.cpc)}
          previous={pm ? { current: m.cpc, previous: pm.cpc, lowerIsBetter: true } : undefined}
          sparkline={baseSeries} />

        {/* Secundárias */}
        <KpiCard delay={240} icon={Users} label="Alcance" value={formatNumber(m.reach)}
          previous={pm ? { current: m.reach, previous: pm.reach } : undefined}
          sparkline={baseSeries}
          className={showAllKpis ? "" : "hidden md:block"} />
        <KpiCard delay={280} icon={MousePointerClick} label="Cliques" value={formatNumber(m.clicks)}
          previous={pm ? { current: m.clicks, previous: pm.clicks } : undefined}
          sparkline={baseSeries}
          className={showAllKpis ? "" : "hidden md:block"} />
        <KpiCard delay={320} icon={Eye} label="Impressões" value={formatNumber(m.impressions)}
          previous={pm ? { current: m.impressions, previous: pm.impressions } : undefined}
          sparkline={baseSeries}
          className={showAllKpis ? "" : "hidden md:block"} />
        <KpiCard delay={360} icon={DollarSign} label="CPM" value={formatBRL(m.cpm)}
          status={classifyMetric("cpm", m.cpm)}
          className={showAllKpis ? "" : "hidden md:block"} />
        <KpiCard delay={400} icon={Activity} label="Frequência" value={formatDecimal(m.frequency)}
          status={classifyMetric("frequency", m.frequency)}
          className={showAllKpis ? "" : "hidden md:block"} />
        <KpiCard delay={440} icon={ShoppingCart} label="Compras" value={formatNumber(m.purchases)}
          previous={pm ? { current: m.purchases, previous: pm.purchases } : undefined}
          className={showAllKpis ? "" : "hidden md:block"} />
      </div>

      {/* Toggle métricas secundárias — só mobile */}
      <button
        type="button"
        onClick={() => setShowAllKpis((v) => !v)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card/50 py-2.5 text-xs font-medium text-muted-foreground backdrop-blur-sm transition-smooth hover:bg-muted/40 hover:text-foreground md:hidden"
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAllKpis && "rotate-180")} />
        {showAllKpis ? "Ver menos métricas" : "Ver mais métricas (6)"}
      </button>

      {/* Gráfico de evolução */}
      <Card className="overflow-hidden border-border/60 bg-card/70 p-4 backdrop-blur-sm shadow-card">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="font-display text-base md:text-lg">
              Evolução de investimento<span className="hidden md:inline"> — Meta Ads</span>
            </h3>
            {chartSummary && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Total <span className="font-medium text-foreground">{formatBRL(chartSummary.total)}</span>
                <span className="mx-1.5 opacity-50">·</span>
                Média/dia <span className="font-medium text-foreground">{formatBRL(chartSummary.avg)}</span>
                {chartSummary.peak && (
                  <>
                    <span className="mx-1.5 opacity-50">·</span>
                    Pico em <span className="font-medium text-foreground">{chartSummary.peak.date.slice(8, 10)}/{chartSummary.peak.date.slice(5, 7)}</span>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <AreaChart data={data.dailySpend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="metaSpend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" strokeOpacity={0.6} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => v.slice(8, 10) + "/" + v.slice(5, 7)}
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                cursor={{ stroke: "var(--accent)", strokeWidth: 1, strokeDasharray: "3 3" }}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  color: "var(--foreground)",
                  boxShadow: "var(--shadow-elegant)",
                  fontSize: 12,
                }}
                formatter={(v: number) => [formatBRL(v), "Meta Ads"]}
                labelFormatter={(l: string) => `${l.slice(8, 10)}/${l.slice(5, 7)}/${l.slice(0, 4)}`}
              />
              <Area
                type="monotone"
                dataKey="meta"
                stroke="var(--primary)"
                strokeWidth={2.25}
                fill="url(#metaSpend)"
                activeDot={{ r: 5, fill: "var(--accent)", stroke: "var(--background)", strokeWidth: 2 }}
                name="Meta Ads"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ── Campanhas: cards no mobile ── */}
      <div className="md:hidden space-y-2">
        <h3 className="font-display text-lg">Campanhas Meta Ads</h3>
        {!campaigns.length && (
          <p className="py-6 text-center text-sm text-muted-foreground">Sem campanhas no período.</p>
        )}
        {[...campaigns].sort((a, b) => b.spend - a.spend).map((c, i) => {
          const cId = c.id ?? `c${i}`;
          const cOpen = openCamps.has(cId);
          const rowCtr = c.impressions ? (c.clicks / c.impressions) * 100 : 0;
          const rowCpc = c.clicks ? c.spend / c.clicks : 0;
          const status = classifyMetric("cost_per_result", c.costPerResult);
          const adsets = (c.adsets ?? []).filter((s) => s.spend > 0);
          return (
            <div key={cId} className="overflow-hidden rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm shadow-card transition-smooth active:scale-[0.99]">
              <button
                type="button"
                className="flex w-full items-start gap-3 p-3.5 text-left"
                onClick={() => toggle(openCamps, setOpenCamps, cId)}
              >
                {adsets.length ? (
                  <ChevronRight className={cn("mt-0.5 h-4 w-4 shrink-0 text-primary transition-transform", cOpen && "rotate-90")} />
                ) : <span className="mt-0.5 inline-block h-4 w-4 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight">{c.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.resultLabel}</p>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div>
                      <span className="text-muted-foreground">Gasto </span>
                      <span className="font-semibold">{formatBRL(c.spend)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Resultado </span>
                      <span className="font-semibold">{formatNumber(c.result)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">CTR </span>
                      <span>{formatPercent(rowCtr)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">CPC </span>
                      <span>{formatBRL(rowCpc)}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Custo/resultado </span>
                      <span>{formatBRL(c.costPerResult)}</span>
                    </div>
                  </div>
                </div>
                <StatusBadge status={status} />
              </button>

              {cOpen && adsets.sort((a, b) => b.spend - a.spend).map((s) => {
                const sOpen = openSets.has(s.id);
                const sCpc = s.clicks ? s.spend / s.clicks : 0;
                const sStatus = classifyMetric("cost_per_result", s.costPerResult);
                const ads = (s.ads ?? []).filter((a) => a.spend > 0);
                return (
                  <div key={s.id} className="border-t border-border/40 bg-muted/30 animate-accordion-down">
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 px-3.5 py-2.5 text-left"
                      onClick={() => toggle(openSets, setOpenSets, s.id)}
                    >
                      <span className="text-muted-foreground text-xs mt-0.5">↳</span>
                      {ads.length ? (
                        <ChevronRight className={cn("mt-0.5 h-3.5 w-3.5 shrink-0 text-primary transition-transform", sOpen && "rotate-90")} />
                      ) : <span className="mt-0.5 inline-block h-3.5 w-3.5 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-muted-foreground">{s.name}</p>
                        <div className="mt-1 grid grid-cols-3 gap-x-3 text-[11px]">
                          <div><span className="text-muted-foreground">Gasto </span><span>{formatBRL(s.spend)}</span></div>
                          <div><span className="text-muted-foreground">CPC </span><span>{formatBRL(sCpc)}</span></div>
                          <div><span className="text-muted-foreground">Result. </span><span>{formatNumber(s.result)}</span></div>
                        </div>
                      </div>
                      <StatusBadge status={sStatus} />
                    </button>

                    {sOpen && ads.sort((a, b) => b.spend - a.spend).map((a) => {
                      const aCpc = a.clicks ? a.spend / a.clicks : 0;
                      const aStatus = classifyMetric("cost_per_result", a.costPerResult);
                      return (
                        <div key={a.id} className="flex items-start gap-2 border-t border-border/20 bg-muted/50 px-3.5 py-2">
                          <span className="text-[10px] text-muted-foreground mt-0.5 pl-5">↳</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] text-muted-foreground">{a.name}</p>
                            <div className="mt-0.5 grid grid-cols-3 gap-x-3 text-[11px]">
                              <div><span className="text-muted-foreground/70">Gasto </span><span>{formatBRL(a.spend)}</span></div>
                              <div><span className="text-muted-foreground/70">CPC </span><span>{formatBRL(aCpc)}</span></div>
                              <div><span className="text-muted-foreground/70">Result. </span><span>{formatNumber(a.result)}</span></div>
                            </div>
                          </div>
                          <StatusBadge status={aStatus} />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Campanhas: tabela no desktop ── */}
      <Card className="hidden overflow-hidden border-border/60 bg-card/70 p-0 backdrop-blur-sm shadow-card md:block">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h3 className="font-display text-lg">Campanhas Meta Ads</h3>
          <span className="text-xs text-muted-foreground">{campaigns.length} ativa{campaigns.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-muted/40 text-left">
              <tr className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="whitespace-nowrap px-4 py-2.5 font-semibold">Campanha</th>
                <th className="whitespace-nowrap px-2 py-2.5 font-semibold">Objetivo</th>
                <th className="whitespace-nowrap px-2 py-2.5 text-right font-semibold">Gasto</th>
                <th className="whitespace-nowrap px-2 py-2.5 text-right font-semibold">Impr.</th>
                <th className="whitespace-nowrap px-2 py-2.5 text-right font-semibold">Cliques</th>
                <th className="whitespace-nowrap px-2 py-2.5 text-right font-semibold">CTR</th>
                <th className="whitespace-nowrap px-2 py-2.5 text-right font-semibold">CPC</th>
                <th className="whitespace-nowrap px-2 py-2.5 text-right font-semibold">Result.</th>
                <th className="whitespace-nowrap px-2 py-2.5 text-right font-semibold">Custo/R.</th>
                <th className="whitespace-nowrap px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {[...campaigns].sort((a, b) => b.spend - a.spend).map((c, i) => {
                const cId = c.id ?? `c${i}`;
                const cOpen = openCamps.has(cId);
                const rowCtr = c.impressions ? (c.clicks / c.impressions) * 100 : 0;
                const rowCpc = c.clicks ? c.spend / c.clicks : 0;
                const status = classifyMetric("cost_per_result", c.costPerResult);
                const adsets = (c.adsets ?? []).filter((s) => s.spend > 0);
                const borderColor =
                  status.level === "excellent" ? "border-l-status-excellent" :
                  status.level === "good" ? "border-l-status-good" :
                  status.level === "warning" ? "border-l-status-warning" : "border-l-status-critical";
                return (
                  <Fragment key={cId}>
                    <tr
                      className={cn(
                        "cursor-pointer border-b border-border/30 border-l-2 transition-smooth hover:bg-accent/5",
                        borderColor,
                      )}
                      onClick={() => toggle(openCamps, setOpenCamps, cId)}
                    >
                      <td className="max-w-[280px] truncate px-4 py-2.5">
                        <span className="inline-flex items-center gap-2">
                          {adsets.length ? (
                            <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", cOpen && "rotate-90 text-primary")} />
                          ) : <span className="inline-block w-3.5" />}
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/15 text-[10px] font-semibold text-primary">
                            {c.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="truncate font-medium">{c.name}</span>
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-muted-foreground">{c.resultLabel}</td>
                      <td className="px-2 py-2.5 text-right font-medium">{formatBRL(c.spend)}</td>
                      <td className="px-2 py-2.5 text-right">{formatNumber(c.impressions)}</td>
                      <td className="px-2 py-2.5 text-right">{formatNumber(c.clicks)}</td>
                      <td className="px-2 py-2.5 text-right">{formatPercent(rowCtr)}</td>
                      <td className="px-2 py-2.5 text-right">{formatBRL(rowCpc)}</td>
                      <td className="px-2 py-2.5 text-right">{formatNumber(c.result)}</td>
                      <td className="px-2 py-2.5 text-right">{formatBRL(c.costPerResult)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={status} /></td>
                    </tr>
                    {cOpen && adsets.sort((a, b) => b.spend - a.spend).map((s) => {
                      const sOpen = openSets.has(s.id);
                      const sCtr = s.impressions ? (s.clicks / s.impressions) * 100 : 0;
                      const sCpc = s.clicks ? s.spend / s.clicks : 0;
                      const sStatus = classifyMetric("cost_per_result", s.costPerResult);
                      const ads = (s.ads ?? []).filter((a) => a.spend > 0);
                      return (
                        <Fragment key={s.id}>
                          <tr
                            className="cursor-pointer border-b border-border/20 bg-muted/30 transition-smooth hover:bg-accent/10"
                            onClick={() => toggle(openSets, setOpenSets, s.id)}
                          >
                            <td className="max-w-[280px] truncate py-1.5 px-2 pl-10 text-muted-foreground">
                              <span className="inline-flex items-center gap-1.5">
                                {ads.length ? (
                                  <ChevronRight className={cn("h-3 w-3 transition-transform", sOpen && "rotate-90 text-primary")} />
                                ) : <span className="inline-block w-3" />}
                                <span className="truncate">↳ {s.name}</span>
                              </span>
                            </td>
                            <td className="py-1.5 px-2 text-muted-foreground/70">{s.resultLabel}</td>
                            <td className="py-1.5 px-2 text-right">{formatBRL(s.spend)}</td>
                            <td className="py-1.5 px-2 text-right">{formatNumber(s.impressions)}</td>
                            <td className="py-1.5 px-2 text-right">{formatNumber(s.clicks)}</td>
                            <td className="py-1.5 px-2 text-right">{formatPercent(sCtr)}</td>
                            <td className="py-1.5 px-2 text-right">{formatBRL(sCpc)}</td>
                            <td className="py-1.5 px-2 text-right">{formatNumber(s.result)}</td>
                            <td className="py-1.5 px-2 text-right">{formatBRL(s.costPerResult)}</td>
                            <td className="py-1.5 px-4"><StatusBadge status={sStatus} /></td>
                          </tr>
                          {sOpen && ads.sort((a, b) => b.spend - a.spend).map((a) => {
                            const aCtr = a.impressions ? (a.clicks / a.impressions) * 100 : 0;
                            const aCpc = a.clicks ? a.spend / a.clicks : 0;
                            const aStatus = classifyMetric("cost_per_result", a.costPerResult);
                            return (
                              <tr key={a.id} className="border-b border-border/10 bg-muted/50 text-muted-foreground">
                                <td className="max-w-[280px] truncate py-1 px-2 pl-16">↳ {a.name}</td>
                                <td className="py-1 px-2">{a.resultLabel}</td>
                                <td className="py-1 px-2 text-right">{formatBRL(a.spend)}</td>
                                <td className="py-1 px-2 text-right">{formatNumber(a.impressions)}</td>
                                <td className="py-1 px-2 text-right">{formatNumber(a.clicks)}</td>
                                <td className="py-1 px-2 text-right">{formatPercent(aCtr)}</td>
                                <td className="py-1 px-2 text-right">{formatBRL(aCpc)}</td>
                                <td className="py-1 px-2 text-right">{formatNumber(a.result)}</td>
                                <td className="py-1 px-2 text-right">{formatBRL(a.costPerResult)}</td>
                                <td className="py-1 px-4"><StatusBadge status={aStatus} /></td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                );
              })}
              {!campaigns.length && (
                <tr><td colSpan={10} className="py-8 text-center text-muted-foreground">Sem campanhas no período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
