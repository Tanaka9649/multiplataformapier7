import {
  CalendarCheck,
  CircleDollarSign,
  Eye,
  FileCheck2,
  LineChart,
  MapPin,
  MessageCircle,
  MousePointerClick,
  Percent,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ResolvedMetric } from "@/types/database";
import { CARD_SURFACE, cx, formatMetricValue } from "@/lib/utils";

const METRIC_ICONS: Record<string, LucideIcon> = {
  gasto_atual: Wallet,
  impressoes: Eye,
  cliques: MousePointerClick,
  ctr: Percent,
  cpc: CircleDollarSign,
  leads: Users,
  custo_por_lead: Target,
  conversas_iniciadas: MessageCircle,
  reunioes_realizadas: CalendarCheck,
  contratos_fechados: FileCheck2,
  visita_cliente: MapPin,
};

export function MetricCard({ metric }: { metric: ResolvedMetric }) {
  const Icon = METRIC_ICONS[metric.key] ?? LineChart;
  return (
    <div className={cx(CARD_SURFACE, "p-4 transition-all duration-200 hover:-translate-y-0.5")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">
          {metric.label}
        </p>
        <Icon className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-zinc-600" strokeWidth={2} />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-50">
        {formatMetricValue(metric.value, metric.format)}
      </p>
    </div>
  );
}
