"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import {
  METRIC_FIELDS_BY_NETWORK,
  PRODUCTION_FIELDS_BY_NETWORK,
  SOCIAL_NETWORK_LABELS,
  formatMonthYear,
} from "@/lib/socialMedia";
import type { SocialMediaPeriod, SocialNetwork, SocialStoryWeek } from "@/types/database";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT_BASE, LABEL_BASE, cx } from "@/lib/utils";

const STORY_WEEKS = [1, 2, 3, 4];

interface EditSocialMetricsModalProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  network: SocialNetwork;
  year: number;
  month: number;
  period: SocialMediaPeriod | null;
  storyWeeks: SocialStoryWeek[];
  onSaved: () => void;
}

type Draft = Record<string, string>;

function toDraft(period: SocialMediaPeriod | null, keys: string[]): Draft {
  const draft: Draft = {};
  for (const key of keys) {
    const raw = period ? (period as any)[key] : null;
    draft[key] = raw === null || raw === undefined ? "" : String(raw);
  }
  return draft;
}

export function EditSocialMetricsModal({
  open,
  onClose,
  companyId,
  network,
  year,
  month,
  period,
  storyWeeks,
  onSaved,
}: EditSocialMetricsModalProps) {
  const supabase = createClient();
  const { showToast } = useToast();

  const metricFields = METRIC_FIELDS_BY_NETWORK[network];
  const productionFields = PRODUCTION_FIELDS_BY_NETWORK[network];
  const allKeys = [...metricFields, ...productionFields].map((f) => f.key);

  const [metricsDraft, setMetricsDraft] = useState<Draft>({});
  const [weeksDraft, setWeeksDraft] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMetricsDraft(toDraft(period, allKeys));
    const weeks: Record<number, string> = {};
    for (const wk of STORY_WEEKS) {
      const found = storyWeeks.find((w) => w.week_number === wk);
      weeks[wk] = found ? String(found.average_views) : "";
    }
    setWeeksDraft(weeks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, period, storyWeeks]);

  function parseNumeric(raw: string): number | null {
    const trimmed = raw.trim().replace(",", ".");
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        company_id: companyId,
        network,
        year,
        month,
      };
      for (const key of allKeys) {
        payload[key] = parseNumeric(metricsDraft[key] ?? "");
      }

      const { data: savedPeriod, error: periodError } = await supabase
        .from("social_media_periods")
        .upsert(payload, { onConflict: "company_id,network,year,month" })
        .select()
        .single();
      if (periodError) throw periodError;

      if (network === "instagram") {
        const weekRows = STORY_WEEKS.map((wk) => ({
          social_period_id: savedPeriod.id,
          week_number: wk,
          average_views: parseNumeric(weeksDraft[wk] ?? "") ?? 0,
        }));
        const { error: weeksError } = await supabase
          .from("social_story_weeks")
          .upsert(weekRows, { onConflict: "social_period_id,week_number" });
        if (weeksError) throw weeksError;
      }

      showToast("Salvo.", "success");
      onSaved();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível salvar as métricas.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title={`Editar métricas — ${SOCIAL_NETWORK_LABELS[network]}`}
      size="lg"
      footer={
        <>
          <button onClick={onClose} disabled={saving} className={BUTTON_SECONDARY}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className={BUTTON_PRIMARY}>
            {saving ? "Salvando..." : "Salvar métricas"}
          </button>
        </>
      }
    >
      <p className="mb-4 text-xs text-slate-400 dark:text-zinc-500">{formatMonthYear(year, month)}</p>

      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Métricas
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {metricFields.map((field) => (
              <div key={field.key}>
                <label className={LABEL_BASE}>{field.label}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={metricsDraft[field.key] ?? ""}
                  onChange={(e) => setMetricsDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                  className={INPUT_BASE}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        {network === "instagram" && (
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Stories — média semanal de visualizações
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {STORY_WEEKS.map((wk) => (
                <div key={wk}>
                  <label className={LABEL_BASE}>Semana {wk}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={weeksDraft[wk] ?? ""}
                    onChange={(e) => setWeeksDraft((d) => ({ ...d, [wk]: e.target.value }))}
                    className={INPUT_BASE}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Produção do mês
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {productionFields.map((field) => (
              <div key={field.key}>
                <label className={LABEL_BASE}>{field.label}</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={metricsDraft[field.key] ?? ""}
                  onChange={(e) => setMetricsDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                  className={cx(INPUT_BASE)}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
