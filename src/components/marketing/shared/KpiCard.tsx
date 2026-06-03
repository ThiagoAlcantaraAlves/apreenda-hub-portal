import { Card } from "@/components/ui/card";
import { ChangeIndicator } from "./ChangeIndicator";
import { StatusBadge } from "./StatusBadge";
import { KpiSparkline } from "./KpiSparkline";
import type { StatusInfo } from "@/lib/marketing/classify";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "hero" | "standard" | "muted";

interface Props {
  icon: LucideIcon;
  label: string;
  value: string;
  previous?: { current: number; previous: number; lowerIsBetter?: boolean };
  previousLabel?: string;
  status?: StatusInfo;
  className?: string;
  variant?: Variant;
  /** Série diária para sparkline (opcional). Quando ausente, esconde graciosamente. */
  sparkline?: number[];
  /** Delay de stagger em ms para o fade-in */
  delay?: number;
}

export function KpiCard({
  icon: Icon,
  label,
  value,
  previous,
  previousLabel,
  status,
  className,
  variant = "standard",
  sparkline,
  delay = 0,
}: Props) {
  const isHero = variant === "hero";

  return (
    <Card
      className={cn(
        "group relative overflow-hidden border-border/60 p-3 md:p-4 animate-fade-in transition-smooth",
        "hover:-translate-y-0.5 hover:shadow-elegant",
        isHero
          ? "bg-gradient-hero shadow-card hover:shadow-glow"
          : "bg-card/70 backdrop-blur-sm shadow-card",
        className,
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Brilho superior sutil */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px",
          isHero
            ? "bg-gradient-to-r from-transparent via-accent/60 to-transparent"
            : "bg-gradient-to-r from-transparent via-border to-transparent",
        )}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-smooth md:h-7 md:w-7",
              isHero
                ? "bg-primary/10 text-primary group-hover:bg-primary/15"
                : "bg-accent/15 text-primary group-hover:bg-accent/25",
            )}
          >
            <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
          </span>
          <span className="truncate font-medium">{label}</span>
        </div>
        {status && <StatusBadge status={status} />}
      </div>

      <div
        className={cn(
          "mt-2 font-display font-semibold leading-tight tracking-tight md:mt-3",
          isHero ? "text-2xl md:text-[1.75rem]" : "text-xl md:text-2xl",
        )}
      >
        {value}
      </div>

      {(previous || sparkline) && (
        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="min-w-0 flex-1">
            {previous && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ChangeIndicator
                  current={previous.current}
                  previous={previous.previous}
                  lowerIsBetter={previous.lowerIsBetter}
                />
                {previousLabel && (
                  <span className="truncate hidden sm:inline opacity-70">{previousLabel}</span>
                )}
              </div>
            )}
          </div>
          {sparkline && sparkline.length > 1 && (
            <div className="w-16 shrink-0 opacity-70 transition-smooth group-hover:opacity-100 md:w-20">
              <KpiSparkline
                series={sparkline}
                color={isHero ? "var(--accent)" : "var(--primary)"}
                height={28}
                id={label.replace(/\s+/g, "-")}
              />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
