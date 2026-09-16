import { CARD_SURFACE, cx } from "@/lib/utils";

interface StoriesWeeklyChartProps {
  weeks: { week_number: number; average_views: number }[];
}

export function StoriesWeeklyChart({ weeks }: StoriesWeeklyChartProps) {
  const sorted = [...weeks].sort((a, b) => a.week_number - b.week_number);
  const max = Math.max(1, ...sorted.map((w) => w.average_views));
  const width = 560;
  const height = 140;
  const barGap = 18;
  const barWidth = sorted.length > 0 ? (width - barGap * (sorted.length + 1)) / sorted.length : 0;

  return (
    <div className={cx(CARD_SURFACE, "p-4 sm:p-5")}>
      <svg viewBox={`0 0 ${width} ${height + 28}`} className="w-full" role="img" aria-label="Média semanal de visualizações dos Stories">
        {sorted.map((w, i) => {
          const barHeight = Math.max(4, (w.average_views / max) * height);
          const x = barGap + i * (barWidth + barGap);
          const y = height - barHeight;
          return (
            <g key={w.week_number}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={6}
                className="fill-brand-500 dark:fill-brand-400"
              />
              <text
                x={x + barWidth / 2}
                y={y - 8}
                textAnchor="middle"
                className="fill-slate-600 text-[11px] font-medium dark:fill-zinc-300"
              >
                {new Intl.NumberFormat("pt-BR").format(w.average_views)}
              </text>
              <text
                x={x + barWidth / 2}
                y={height + 20}
                textAnchor="middle"
                className="fill-slate-400 text-[11px] dark:fill-zinc-500"
              >
                Semana {w.week_number}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
