import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { deltaInfo } from "@/lib/marketing/classify";

interface Props {
  current: number;
  previous: number;
  lowerIsBetter?: boolean;
  className?: string;
  showZero?: boolean;
}

export function ChangeIndicator({ current, previous, lowerIsBetter, className, showZero }: Props) {
  const info = deltaInfo(current, previous, lowerIsBetter);
  if (!previous && !showZero) return <span className={cn("text-xs text-muted-foreground", className)}>—</span>;
  const Icon = info.direction === "higher" ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        info.improved ? "text-status-excellent" : "text-status-critical",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(info.pct).toFixed(1).replace(".", ",")}%
    </span>
  );
}
