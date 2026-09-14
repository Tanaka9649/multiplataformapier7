"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase/client";
import type { ResolvedMetric } from "@/types/database";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT_BASE, LABEL_BASE } from "@/lib/utils";

interface EditMetricsModalProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  metrics: ResolvedMetric[];
  onSaved: () => void;
}

export function EditMetricsModal({
  open,
  onClose,
  companyId,
  metrics,
  onSaved,
}: EditMetricsModalProps) {
  const supabase = createClient();
  const { showToast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      for (const m of metrics) {
        initial[m.key] = m.format === "integer" ? String(Math.round(m.value)) : String(m.value);
      }
      setValues(initial);
    }
  }, [open, metrics]);

  async function handleSave() {
    setSaving(true);
    try {
      const rows = metrics.map((m) => ({
        company_id: companyId,
        metric_key: m.key,
        value: Number(values[m.key]?.replace(",", ".")) || 0,
      }));

      const { error } = await supabase
        .from("metric_values")
        .upsert(rows, { onConflict: "company_id,metric_key" });

      if (error) throw error;

      showToast("Salvo!", "success");
      onSaved();
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Não foi possível salvar os valores.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Editar valores"
      footer={
        <>
          <button onClick={onClose} disabled={saving} className={BUTTON_SECONDARY}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className={BUTTON_PRIMARY}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {metrics.map((m) => (
          <div key={m.key}>
            <label className={LABEL_BASE}>
              {m.label}
              {m.format === "percentage" && <span className="text-slate-400 dark:text-zinc-500"> (%)</span>}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={values[m.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [m.key]: e.target.value }))}
              className={INPUT_BASE}
            />
          </div>
        ))}
        {metrics.length === 0 && (
          <p className="col-span-full text-sm text-slate-500 dark:text-zinc-400">
            Nenhuma métrica ativa para esta empresa.
          </p>
        )}
      </div>
    </Modal>
  );
}
