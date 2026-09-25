"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { GoalCard } from "@/components/GoalCard";
import { GoalModal } from "@/components/GoalModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Skeleton } from "@/components/Skeleton";
import { SectionHeader } from "@/components/SectionHeader";
import type { CompanyGoal, MetricFormat } from "@/types/database";
import { BUTTON_PRIMARY } from "@/lib/utils";

export interface GoalMetricOption {
  key: string;
  label: string;
  format: MetricFormat;
}

export function GoalsSection({ companyId }: { companyId: string }) {
  const supabase = createClient();
  const { showToast } = useToast();

  const [goals, setGoals] = useState<CompanyGoal[]>([]);
  const [metricOptions, setMetricOptions] = useState<GoalMetricOption[]>([]);
  const [valuesByKey, setValuesByKey] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<CompanyGoal | null>(null);
  const [toDelete, setToDelete] = useState<CompanyGoal | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [goalsRes, configRes, valuesRes] = await Promise.all([
        supabase
          .from("company_goals")
          .select("*")
          .eq("company_id", companyId)
          .eq("active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("company_metric_config")
          .select("metric_key, sort_order, label_override, metric_definitions(label, format, sort_order)")
          .eq("company_id", companyId)
          .eq("visible", true),
        supabase.from("metric_values").select("metric_key, value").eq("company_id", companyId),
      ]);

      if (goalsRes.error) throw goalsRes.error;
      if (configRes.error) throw configRes.error;
      if (valuesRes.error) throw valuesRes.error;

      setGoals(goalsRes.data ?? []);

      const options: GoalMetricOption[] = (configRes.data ?? [])
        .map((row: any) => {
          const def = row.metric_definitions;
          return {
            key: row.metric_key,
            label: row.label_override || def?.label || row.metric_key,
            format: (def?.format ?? "integer") as MetricFormat,
            sort_order: row.sort_order ?? def?.sort_order ?? 0,
          };
        })
        .sort((a: any, b: any) => a.sort_order - b.sort_order);
      setMetricOptions(options);

      const values: Record<string, number> = {};
      for (const v of valuesRes.data ?? []) values[v.metric_key] = Number(v.value);
      setValuesByKey(values);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível carregar as metas.", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditingGoal(null);
    setModalOpen(true);
  }

  function openEdit(goal: CompanyGoal) {
    setEditingGoal(goal);
    setModalOpen(true);
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("company_goals").delete().eq("id", toDelete.id);
      if (error) throw error;
      showToast("Meta excluída.", "success");
      setToDelete(null);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível excluir a meta.", "error");
    } finally {
      setDeleting(false);
    }
  }

  const sortedGoals = useMemo(() => [...goals].sort((a, b) => a.sort_order - b.sort_order), [goals]);

  async function moveGoal(goal: CompanyGoal, direction: -1 | 1) {
    const idx = sortedGoals.findIndex((g) => g.id === goal.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sortedGoals.length) return;
    const other = sortedGoals[swapIdx];
    try {
      await Promise.all([
        supabase.from("company_goals").update({ sort_order: other.sort_order }).eq("id", goal.id),
        supabase.from("company_goals").update({ sort_order: goal.sort_order }).eq("id", other.id),
      ]);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível reordenar as metas.", "error");
    }
  }

  const metricFormatByKey = useMemo(() => {
    const map: Record<string, MetricFormat> = {};
    for (const m of metricOptions) map[m.key] = m.format;
    return map;
  }, [metricOptions]);

  return (
    <section className="mt-8">
      <SectionHeader
        title="Metas"
        subtitle={goals.length > 0 ? "Acompanhe o progresso dos principais objetivos." : undefined}
        action={
          goals.length > 0 && (
            <button onClick={openCreate} className={BUTTON_PRIMARY}>
              <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.25} />
              Adicionar meta
            </button>
          )
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : sortedGoals.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-slate-50 px-5 py-6 dark:bg-zinc-900/60 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-400 dark:bg-zinc-800 dark:text-zinc-500">
              <Target className="h-4 w-4" strokeWidth={2} />
            </span>
            <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
              Acompanhe visualmente os principais objetivos desta empresa.
            </p>
          </div>
          <button onClick={openCreate} className={BUTTON_PRIMARY}>
            <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.25} />
            Criar primeira meta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {sortedGoals.map((goal, i) => (
            <div key={goal.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
              <GoalCard
                goal={goal}
                format={goal.metric_key ? metricFormatByKey[goal.metric_key] ?? "integer" : "integer"}
                currentValue={
                  goal.value_source === "manual"
                    ? goal.manual_current_value ?? 0
                    : goal.metric_key
                      ? valuesByKey[goal.metric_key] ?? 0
                      : 0
                }
                onEdit={() => openEdit(goal)}
                onDelete={() => setToDelete(goal)}
                onMoveUp={() => moveGoal(goal, -1)}
                onMoveDown={() => moveGoal(goal, 1)}
                canMoveUp={i > 0}
                canMoveDown={i < sortedGoals.length - 1}
              />
            </div>
          ))}
        </div>
      )}

      <GoalModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        goal={editingGoal}
        metricOptions={metricOptions}
        onSaved={load}
      />

      <ConfirmDialog
        open={!!toDelete}
        title="Excluir esta meta?"
        message="Essa ação não poderá ser desfeita."
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </section>
  );
}
