export type StatusLevel = "critical" | "warning" | "good" | "excellent";

export interface StatusInfo {
  level: StatusLevel;
  emoji: "🔴" | "🟡" | "🔵" | "🟢";
  label: string;
  color: string; // tailwind text class
  bg: string;
}

const STATUS: Record<StatusLevel, Omit<StatusInfo, never> & {}> = {
  critical: { level: "critical", emoji: "🔴", label: "Crítico", color: "text-status-critical", bg: "bg-status-critical/15" },
  warning: { level: "warning", emoji: "🟡", label: "Atenção", color: "text-status-warning", bg: "bg-status-warning/15" },
  good: { level: "good", emoji: "🔵", label: "Bom", color: "text-status-good", bg: "bg-status-good/15" },
  excellent: { level: "excellent", emoji: "🟢", label: "Excelente", color: "text-status-excellent", bg: "bg-status-excellent/15" },
};

// "lower-is-better" para custos / bounce / frequência
type Direction = "higher" | "lower";

export type MetricKey =
  | "ctr_google"
  | "ctr_meta"
  | "cpc"
  | "cpm"
  | "frequency"
  | "bounce_ga4"
  | "cost_per_result"
  | "roas";

export function classifyMetric(metric: MetricKey, value: number): StatusInfo {
  let level: StatusLevel = "good";
  switch (metric) {
    case "ctr_google":
      level = value < 1 ? "critical" : value < 2 ? "warning" : value <= 5 ? "good" : "excellent";
      break;
    case "ctr_meta":
      level = value < 0.5 ? "critical" : value < 1 ? "warning" : value <= 3 ? "good" : "excellent";
      break;
    case "cpc":
      level = value > 5 ? "critical" : value > 2 ? "warning" : value > 0.5 ? "good" : "excellent";
      break;
    case "cpm":
      level = value > 50 ? "critical" : value > 20 ? "warning" : value > 5 ? "good" : "excellent";
      break;
    case "frequency":
      level = value > 5 ? "critical" : value > 3 ? "warning" : value >= 2 ? "good" : "excellent";
      break;
    case "bounce_ga4":
      level = value > 70 ? "critical" : value > 50 ? "warning" : value > 30 ? "good" : "excellent";
      break;
    case "cost_per_result":
      level = value > 100 ? "critical" : value > 30 ? "warning" : value > 10 ? "good" : "excellent";
      break;
    case "roas":
      level = value < 1 ? "critical" : value < 2 ? "warning" : value <= 4 ? "good" : "excellent";
      break;
  }
  return STATUS[level];
}

export function pctDelta(current: number, previous: number): number {
  if (!previous) return 0;
  return ((current - previous) / previous) * 100;
}

export interface DeltaInfo {
  pct: number;
  direction: Direction;
  improved: boolean;
}

export function deltaInfo(current: number, previous: number, lowerIsBetter = false): DeltaInfo {
  const pct = pctDelta(current, previous);
  return {
    pct,
    direction: pct >= 0 ? "higher" : "lower",
    improved: lowerIsBetter ? pct < 0 : pct > 0,
  };
}
