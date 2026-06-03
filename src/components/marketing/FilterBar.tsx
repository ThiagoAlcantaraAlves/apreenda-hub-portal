import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, Check, ChevronDown } from "lucide-react";
import { endOfMonth, format, startOfMonth, startOfYear, subDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ComparisonMode, SourceFilter } from "@/lib/marketing/types";

export interface FilterState {
  start: string;
  end: string;
  units: string[];
  source: SourceFilter;
  comparison: ComparisonMode;
}

interface Props {
  value: FilterState;
  onChange: (next: Partial<FilterState>) => void;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

function usePresets() {
  return useMemo(() => {
    const now = new Date();
    return [
      { label: "Hoje", start: iso(now), end: iso(now) },
      { label: "Ontem", start: iso(subDays(now, 1)), end: iso(subDays(now, 1)) },
      { label: "Últimos 7 dias", start: iso(subDays(now, 6)), end: iso(now) },
      { label: "Últimos 14 dias", start: iso(subDays(now, 13)), end: iso(now) },
      { label: "Últimos 30 dias", start: iso(subDays(now, 29)), end: iso(now) },
      { label: "Últimos 90 dias", start: iso(subDays(now, 89)), end: iso(now) },
      { label: "Este mês", start: iso(startOfMonth(now)), end: iso(now) },
      { label: "Mês passado", start: iso(startOfMonth(subMonths(now, 1))), end: iso(endOfMonth(subMonths(now, 1))) },
      { label: "Este ano", start: iso(startOfYear(now)), end: iso(now) },
    ];
  }, []);
}

function useClosedMonths() {
  return useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const m = subMonths(now, i + 1);
      return {
        label: format(m, "MMM/yy", { locale: ptBR }),
        start: iso(startOfMonth(m)),
        end: iso(endOfMonth(m)),
      };
    });
  }, []);
}

function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const date = new Date(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start bg-background/60 text-xs transition-smooth hover:border-accent/60"
        >
          <CalendarIcon className="mr-1.5 h-3.5 w-3.5 shrink-0 text-primary" />
          {format(date, "dd/MM/yy")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => { if (d) onChange(iso(d)); setOpen(false); }}
          initialFocus
          className="p-3 pointer-events-auto"
          locale={ptBR}
        />
      </PopoverContent>
    </Popover>
  );
}

/* ── Mobile: single pill → bottom Sheet ── */
function FilterBarMobile({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const presets = usePresets();
  const closedMonths = useClosedMonths();
  const periodLabel = `${format(new Date(value.start), "dd/MM/yy")} – ${format(new Date(value.end), "dd/MM/yy")}`;

  const activePreset = presets.find((p) => p.start === value.start && p.end === value.end);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-2 rounded-xl border border-border/60 bg-card/70 px-3 py-2 backdrop-blur-sm shadow-card transition-smooth hover:border-accent/50 hover:shadow-elegant"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/15 text-primary">
          <CalendarIcon className="h-3.5 w-3.5" />
        </span>
        <span className="flex-1 truncate text-left text-sm font-medium">
          {activePreset ? activePreset.label : periodLabel}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-smooth group-hover:text-foreground" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl px-4 pb-8">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2 font-display text-lg">
              <CalendarIcon className="h-4 w-4 text-primary" />
              Filtrar período
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-5">
            <Section title="Atalhos">
              <div className="grid grid-cols-2 gap-1.5">
                {presets.map((p) => {
                  const active = p.start === value.start && p.end === value.end;
                  return (
                    <PresetButton
                      key={p.label}
                      active={active}
                      onClick={() => { onChange({ start: p.start, end: p.end }); setOpen(false); }}
                    >
                      {p.label}
                      {active && <Check className="h-3.5 w-3.5" />}
                    </PresetButton>
                  );
                })}
              </div>
            </Section>

            <Section title="Datas personalizadas">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">De</p>
                  <DateField value={value.start} onChange={(v) => onChange({ start: v })} />
                </div>
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">Até</p>
                  <DateField value={value.end} onChange={(v) => onChange({ end: v })} />
                </div>
              </div>
            </Section>

            <Section title="Meses fechados">
              <div className="grid grid-cols-4 gap-1.5">
                {closedMonths.map((m) => {
                  const active = m.start === value.start && m.end === value.end;
                  return (
                    <button
                      key={m.label}
                      onClick={() => { onChange({ start: m.start, end: m.end }); setOpen(false); }}
                      className={cn(
                        "rounded-lg border px-2 py-1.5 text-xs transition-smooth",
                        active
                          ? "border-accent/60 bg-accent/15 text-primary font-medium"
                          : "border-border/60 bg-background/40 hover:bg-accent/10",
                      )}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </Section>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function PresetButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-smooth",
        active
          ? "border-accent/60 bg-accent/15 text-primary font-medium ring-1 ring-accent/40"
          : "border-border/60 bg-background/40 text-foreground hover:bg-accent/10 hover:border-accent/40",
      )}
    >
      {children}
    </button>
  );
}

/* ── Desktop: single pill → popover de 3 colunas ── */
function FilterBarDesktop({ value, onChange }: Props) {
  const presets = usePresets();
  const closedMonths = useClosedMonths();
  const periodLabel = `${format(new Date(value.start), "dd/MM/yy")} – ${format(new Date(value.end), "dd/MM/yy")}`;
  const activePreset = presets.find((p) => p.start === value.start && p.end === value.end);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="group inline-flex h-9 items-center gap-2 rounded-xl border border-border/60 bg-card/70 px-3 backdrop-blur-sm shadow-card transition-smooth hover:border-accent/50 hover:shadow-elegant"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/15 text-primary">
            <CalendarIcon className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-medium">{activePreset ? activePreset.label : periodLabel}</span>
          {activePreset && (
            <span className="text-xs text-muted-foreground">· {periodLabel}</span>
          )}
          <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60 transition-smooth group-hover:opacity-100" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[640px] p-0 border-border/60 shadow-elegant animate-scale-in"
      >
        <div className="grid grid-cols-[1fr_1fr_1fr] divide-x divide-border/60">
          {/* Atalhos */}
          <div className="p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Atalhos</p>
            <div className="flex flex-col gap-1">
              {presets.map((p) => {
                const active = p.start === value.start && p.end === value.end;
                return (
                  <button
                    key={p.label}
                    onClick={() => onChange({ start: p.start, end: p.end })}
                    className={cn(
                      "flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-smooth",
                      active
                        ? "bg-accent/15 text-primary font-medium ring-1 ring-accent/40"
                        : "text-foreground hover:bg-muted/60",
                    )}
                  >
                    {p.label}
                    {active && <Check className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Datas personalizadas */}
          <div className="p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Datas personalizadas</p>
            <div className="space-y-2">
              <div>
                <p className="mb-1 text-[11px] text-muted-foreground">De</p>
                <DateField value={value.start} onChange={(v) => onChange({ start: v })} />
              </div>
              <div>
                <p className="mb-1 text-[11px] text-muted-foreground">Até</p>
                <DateField value={value.end} onChange={(v) => onChange({ end: v })} />
              </div>
            </div>
          </div>

          {/* Meses fechados */}
          <div className="p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Meses fechados</p>
            <div className="grid grid-cols-2 gap-1">
              {closedMonths.map((m) => {
                const active = m.start === value.start && m.end === value.end;
                return (
                  <button
                    key={m.label}
                    onClick={() => onChange({ start: m.start, end: m.end })}
                    className={cn(
                      "rounded-md px-2 py-1.5 text-xs transition-smooth",
                      active
                        ? "bg-accent/15 text-primary font-medium ring-1 ring-accent/40"
                        : "text-foreground hover:bg-muted/60",
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ── Public export ── */
export function FilterBar({ value, onChange }: Props) {
  return (
    <>
      <div className="md:hidden">
        <FilterBarMobile value={value} onChange={onChange} />
      </div>
      <div className="hidden md:block">
        <FilterBarDesktop value={value} onChange={onChange} />
      </div>
    </>
  );
}
