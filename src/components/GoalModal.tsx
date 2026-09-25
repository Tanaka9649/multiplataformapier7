"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase/client";
import type { CompanyGoal, GoalValueSource } from "@/types/database";
import type { GoalMetricOption } from "@/components/GoalsSection";
import { BUTTON_GHOST, BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT_BASE, LABEL_BASE, SELECTED_CONTROL, UNSELECTED_CONTROL, cx } from "@/lib/utils";

interface GoalModalProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  goal: CompanyGoal | null;
  metricOptions: GoalMetricOption[];
  onSaved: () => void;
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}
function startOfMonth() {
  const d = new Date();
  return toISO(new Date(d.getFullYear(), d.getMonth(), 1));
}
function endOfMonth() {
  const d = new Date();
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
function startOfQuarter() {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3);
  return toISO(new Date(d.getFullYear(), q * 3, 1));
}
function endOfQuarter() {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3);
  return toISO(new Date(d.getFullYear(), q * 3 + 3, 0));
}
function startOfYear() {
  const d = new Date();
  return toISO(new Date(d.getFullYear(), 0, 1));
}
function endOfYear() {
  const d = new Date();
  return toISO(new Date(d.getFullYear(), 11, 31));
}

export function GoalModal({ open, onClose, companyId, goal, metricOptions, onSaved }: GoalModalProps) {
  const supabase = createClient();
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [metricKey, setMetricKey] = useState("");
  const [valueSource, setValueSource] = useState<GoalValueSource>("metric");
  const [manualValue, setManualValue] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(goal?.name ?? "");
      setMetricKey(goal?.metric_key ?? metricOptions[0]?.key ?? "");
      setValueSource(goal?.value_source ?? "metric");
      setManualValue(goal?.manual_current_value != null ? String(goal.manual_current_value) : "");
      setTargetValue(goal?.target_value != null ? String(goal.target_value) : "");
      setPeriodStart(goal?.period_start ?? "");
      setPeriodEnd(goal?.period_end ?? "");
    }
  }, [open, goal, metricOptions]);

  function applyShortcut(kind: "month" | "quarter" | "year") {
    if (kind === "month") {
      setPeriodStart(startOfMonth());
      setPeriodEnd(endOfMonth());
    }
    if (kind === "quarter") {
      setPeriodStart(startOfQuarter());
      setPeriodEnd(endOfQuarter());
    }
    if (kind === "year") {
      setPeriodStart(startOfYear());
      setPeriodEnd(endOfYear());
    }
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast("Dê um nome para a meta.", "error");
      return;
    }
    if (!metricKey) {
      showToast("Selecione a métrica relacionada.", "error");
      return;
    }
    const target = Number(targetValue.replace(",", "."));
    if (!target || target <= 0) {
      showToast("Informe um valor de meta maior que zero.", "error");
      return;
    }
    if (valueSource === "manual" && manualValue.trim() === "") {
      showToast("Informe o valor atual.", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        company_id: companyId,
        name: trimmedName,
        metric_key: metricKey,
        value_source: valueSource,
        manual_current_value: valueSource === "manual" ? Number(manualValue.replace(",", ".")) : null,
        target_value: target,
        period_start: periodStart || null,
        period_end: periodEnd || null,
      };

      if (goal) {
        const { error } = await supabase.from("company_goals").update(payload).eq("id", goal.id);
        if (error) throw error;
        showToast("Meta atualizada com sucesso.", "success");
      } else {
        const { error } = await supabase.from("company_goals").insert(payload);
        if (error) throw error;
        showToast("Meta criada.", "success");
      }
      onSaved();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível salvar a meta.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={goal ? "Editar meta" : "Adicionar meta"}
      footer={
        <>
          <button onClick={onClose} disabled={saving} className={BUTTON_SECONDARY}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className={BUTTON_PRIMARY}>
            {saving ? "Salvando..." : "Salvar meta"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={LABEL_BASE}>Nome da meta</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Meta de contratos fechados"
            className={INPUT_BASE}
          />
        </div>

        <div>
          <label className={LABEL_BASE}>Métrica relacionada</label>
          <select value={metricKey} onChange={(e) => setMetricKey(e.target.value)} className={INPUT_BASE}>
            {metricOptions.length === 0 && <option value="">Nenhuma métrica disponível</option>}
            {metricOptions.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL_BASE}>Valor atual</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setValueSource("metric")}
              className={cx(
                "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                valueSource === "metric"
                  ? SELECTED_CONTROL
                  : UNSELECTED_CONTROL
              )}
            >
              Automático (da métrica)
            </button>
            <button
              type="button"
              onClick={() => setValueSource("manual")}
              className={cx(
                "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                valueSource === "manual"
                  ? SELECTED_CONTROL
                  : UNSELECTED_CONTROL
              )}
            >
              Informado manualmente
            </button>
          </div>
          {valueSource === "manual" && (
            <input
              type="text"
              inputMode="decimal"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder="Valor atual"
              className={`mt-2 ${INPUT_BASE}`}
            />
          )}
        </div>

        <div>
          <label className={LABEL_BASE}>Meta (valor alvo)</label>
          <input
            type="text"
            inputMode="decimal"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            placeholder="Ex.: 10"
            className={INPUT_BASE}
          />
        </div>

        <div>
          <label className={LABEL_BASE}>Período (opcional)</label>
          <div className="mb-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => applyShortcut("month")} className={BUTTON_GHOST}>
              Este mês
            </button>
            <button type="button" onClick={() => applyShortcut("quarter")} className={BUTTON_GHOST}>
              Este trimestre
            </button>
            <button type="button" onClick={() => applyShortcut("year")} className={BUTTON_GHOST}>
              Este ano
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className={INPUT_BASE}
            />
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className={INPUT_BASE}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
