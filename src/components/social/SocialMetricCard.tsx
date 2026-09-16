import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { CARD_SURFACE, cx } from "@/lib/utils";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(Math.round(value));
}

interface SocialMetricCardProps {
  label: string;
  value: number | null;
  previousValue?: number | null;
  /** "followers" mostra diferença absoluta ("+126 no mês"); as demais mostram variação percentual. */
  metricKey?: string;
  icon?: LucideIcon;
  suffix?: string;
}

export function SocialMetricCard({ label, value, previousValue, metricKey, icon: Icon, suffix }: SocialMetricCardProps) {
  const hasValue = value !== null && value !== undefined;
  const hasComparison =
    hasValue && previousValue !== null && previousValue !== undefined && previousValue !== 0;

  let deltaLabel: string | null = null;
  let trend: "up" | "down" | "flat" = "flat";

  if (hasComparison) {
    if (metricKey === "followers") {
      const diff = value! - previousValue!;
      trend = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
      deltaLabel = `${diff > 0 ? "+" : ""}${formatNumber(diff)} no mês`;
    } else {
      const pct = ((value! - previousValue!) / Math.abs(previousValue!)) * 100;
      trend = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
      deltaLabel = `${pct > 0 ? "+" : ""}${pct.toFixed(0)}% vs mês anterior`;
    }
  }

  return (
    <div className={cx(CARD_SURFACE, "p-4 transition-all duration-200 hover:-translate-y-0.5")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">
          {label}
        </p>
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-zinc-600" strokeWidth={2} />}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-50">
        {hasValue ? formatNumber(value!) : "—"}
        {hasValue && suffix ? <span className="ml-1 text-sm font-medium text-slate-400 dark:text-zinc-500">{suffix}</span> : null}
      </p>
      {deltaLabel && (
        <p
          className={cx(
            "mt-1.5 flex items-center gap-1 text-xs font-medium",
            trend === "up" && "text-emerald-600 dark:text-emerald-400",
            trend === "down" && "text-red-600 dark:text-red-400",
            trend === "flat" && "text-slate-400 dark:text-zinc-500"
          )}
        >
          {trend === "up" && <TrendingUp className="h-3 w-3" strokeWidth={2.5} />}
          {trend === "down" && <TrendingDown className="h-3 w-3" strokeWidth={2.5} />}
          {trend === "flat" && <Minus className="h-3 w-3" strokeWidth={2.5} />}
          {deltaLabel}
        </p>
      )}
    </div>
  );
}
