"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Company, ResolvedMetric } from "@/types/database";
import { MetricCard } from "@/components/MetricCard";
import { EditMetricsModal } from "@/components/EditMetricsModal";
import { EmptyState } from "@/components/EmptyState";
import { MetricsGridSkeleton } from "@/components/Skeleton";
import { GoalsSection } from "@/components/GoalsSection";
import { CompanyObservation } from "@/components/CompanyObservation";
import { SectionHeader } from "@/components/SectionHeader";
import { useToast } from "@/components/Toast";
import { BUTTON_SECONDARY } from "@/lib/utils";

export function MetricsGrid({ company }: { company: Company }) {
  const supabase = createClient();
  const { showToast } = useToast();

  const [metrics, setMetrics] = useState<ResolvedMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [configResult, valuesResult] = await Promise.all([
        supabase
          .from("company_metric_config")
          .select(
            "metric_key, visible, label_override, sort_order, metric_definitions(label, format, sort_order)"
          )
          .eq("company_id", company.id)
          .eq("visible", true),
        supabase
          .from("metric_values")
          .select("metric_key, value")
          .eq("company_id", company.id),
      ]);

      const { data: configRows, error: configError } = configResult;

      if (configError) throw configError;

      const { data: valueRows, error: valueError } = valuesResult;

      if (valueError) throw valueError;

      const valueByKey = new Map<string, number>(
        (valueRows ?? []).map((v: any) => [v.metric_key, Number(v.value)])
      );

      const resolved: ResolvedMetric[] = (configRows ?? [])
        .map((row: any) => {
          const def = row.metric_definitions;
          return {
            key: row.metric_key,
            label: row.label_override || def?.label || row.metric_key,
            format: def?.format ?? "integer",
            sort_order: row.sort_order ?? def?.sort_order ?? 0,
            value: valueByKey.get(row.metric_key) ?? 0,
          };
        })
        .sort((a: ResolvedMetric, b: ResolvedMetric) => a.sort_order - b.sort_order);

      setMetrics(resolved);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Não foi possível carregar as métricas.",
        "error"
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section>
      <SectionHeader
        title="Tráfego pago"
        subtitle="Meta Ads"
        action={
          <button onClick={() => setEditOpen(true)} className={BUTTON_SECONDARY}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.25} />
            Editar valores
          </button>
        }
      />

      {loading ? (
        <MetricsGridSkeleton />
      ) : metrics.length === 0 ? (
        <EmptyState message="Nenhuma métrica ativa para esta empresa." />
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m, i) => (
            <div key={m.key} className="animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
              <MetricCard metric={m} />
            </div>
          ))}
        </div>
      )}

      <EditMetricsModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        companyId={company.id}
        metrics={metrics}
        onSaved={load}
      />

      <GoalsSection companyId={company.id} />
      <CompanyObservation companyId={company.id} />
    </section>
  );
}
