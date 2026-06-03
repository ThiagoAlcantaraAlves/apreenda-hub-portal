import { cn } from "@/lib/utils";
import type { StatusInfo } from "@/lib/marketing/classify";

export function StatusBadge({ status, className }: { status: StatusInfo; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        status.bg,
        status.color,
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status.level === "excellent" && "bg-status-excellent animate-pulse",
          status.level === "good" && "bg-status-good",
          status.level === "warning" && "bg-status-warning",
          status.level === "critical" && "bg-status-critical animate-pulse",
        )}
      />
      {status.label}
    </span>
  );
}
