import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useMemo } from "react";

interface Props {
  /** Série base (diária) usada como ritmo. Geralmente data.dailySpend.meta */
  series: number[];
  /** Cor da linha. CSS var ou hex. Default: var(--primary) */
  color?: string;
  /** Altura em px */
  height?: number;
  /** Inverter (para métricas onde menor é melhor) — só afeta opcionalmente cor */
  id?: string;
}

/**
 * Sparkline minimalista. Aceita uma série numérica e renderiza
 * uma micro area-chart sem eixos. Se a série tiver < 2 pontos
 * ou só zeros, renderiza nada.
 */
export function KpiSparkline({ series, color = "var(--primary)", height = 32, id = "kpi" }: Props) {
  const data = useMemo(() => {
    if (!series || series.length < 2) return [];
    const max = Math.max(...series);
    if (max <= 0) return [];
    return series.map((v, i) => ({ i, v }));
  }, [series]);

  if (!data.length) return <div style={{ height }} />;

  const gradId = `spark-${id}`;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.75}
            fill={`url(#${gradId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
