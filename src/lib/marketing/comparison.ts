import { differenceInCalendarDays, subDays, subYears } from "date-fns";
import type { ComparisonMode } from "./types";

export function comparisonRange(
  start: string,
  end: string,
  mode: ComparisonMode,
): { start: string; end: string } {
  const s = new Date(start);
  const e = new Date(end);
  if (mode === "previous_year") {
    return {
      start: subYears(s, 1).toISOString().slice(0, 10),
      end: subYears(e, 1).toISOString().slice(0, 10),
    };
  }
  const days = differenceInCalendarDays(e, s) + 1;
  return {
    start: subDays(s, days).toISOString().slice(0, 10),
    end: subDays(e, 1).toISOString().slice(0, 10),
  };
}
