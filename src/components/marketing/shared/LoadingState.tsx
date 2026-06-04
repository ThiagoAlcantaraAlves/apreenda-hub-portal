import { Card } from "@/components/ui/card";

export function LoadingState({ label = "Carregando dados…" }: { label?: string }) {
  return (
    <div className="space-y-4 animate-fade-in" aria-label={label} role="status">
      {/* KPI skeletons */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card
            key={i}
            className="h-[112px] border-border/60 bg-card/60 p-4 backdrop-blur-sm overflow-hidden relative"
          >
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-muted/70 animate-pulse" />
              <div className="h-3 w-20 rounded bg-muted/70 animate-pulse" />
            </div>
            <div className="mt-4 h-6 w-24 rounded bg-muted/80 animate-pulse" />
            <div className="mt-3 h-3 w-16 rounded bg-muted/60 animate-pulse" />
          </Card>
        ))}
      </div>
      {/* Chart skeleton */}
      <Card className="h-64 border-border/60 bg-card/60 p-4 backdrop-blur-sm">
        <div className="h-4 w-48 rounded bg-muted/70 animate-pulse" />
        <div className="mt-6 h-44 w-full rounded-lg bg-gradient-to-b from-muted/50 to-muted/10 animate-pulse" />
      </Card>
      <p className="text-center text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
