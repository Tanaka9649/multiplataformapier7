"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, StickyNote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/Modal";
import { Skeleton } from "@/components/Skeleton";
import { SectionHeader } from "@/components/SectionHeader";
import { useToast } from "@/components/Toast";
import type { CompanyObservation as CompanyObservationRow } from "@/types/database";
import {
  BUTTON_GHOST,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  INPUT_BASE,
  LABEL_BASE,
  cx,
  formatDateTimePtBR,
} from "@/lib/utils";

export function CompanyObservation({ companyId }: { companyId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();

  const [observation, setObservation] = useState<CompanyObservationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("company_observations")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      setObservation(data ?? null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível carregar a observação.", "error");
    } finally {
      setLoading(false);
    }
  }, [companyId, showToast, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function openEditor() {
    setDraft(observation?.content ?? "");
    setEditorOpen(true);
  }

  async function handleSave() {
    const content = draft.trim();
    if (!content) {
      showToast("Escreva algo antes de salvar.", "error");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("company_observations")
        .upsert({ company_id: companyId, content }, { onConflict: "company_id" })
        .select()
        .single();
      if (error) throw error;
      setObservation(data);
      showToast("Observação salva.", "success");
      setEditorOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível salvar a observação.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8">
      <SectionHeader title="Observação sobre os resultados" />

      {loading ? (
        <Skeleton className="h-20" />
      ) : observation ? (
        <div className="animate-fade-in-up rounded-2xl border border-slate-200/70 bg-brand-50/30 p-5 dark:border-zinc-800/70 dark:bg-brand-950/10">
          <div className="mb-2 flex items-start justify-between gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 dark:bg-zinc-900 dark:text-brand-400">
              <StickyNote className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            <button onClick={openEditor} className={BUTTON_GHOST}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.25} />
              Editar
            </button>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
            {observation.content}
          </p>
          <p className="mt-4 text-xs text-slate-400 dark:text-zinc-500">
            Última atualização: {formatDateTimePtBR(observation.updated_at)}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-slate-50 px-5 py-5 dark:bg-zinc-900/60 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-400 dark:bg-zinc-800 dark:text-zinc-500">
              <StickyNote className="h-4 w-4" strokeWidth={2} />
            </span>
            <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
              Registre informações importantes sobre o desempenho deste período.
            </p>
          </div>
          <button onClick={openEditor} className={BUTTON_PRIMARY}>
            <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.25} />
            Adicionar observação
          </button>
        </div>
      )}

      <Modal
        open={editorOpen}
        onClose={() => !saving && setEditorOpen(false)}
        title={observation ? "Editar observação" : "Adicionar observação"}
        footer={
          <>
            <button onClick={() => setEditorOpen(false)} disabled={saving} className={BUTTON_SECONDARY}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className={BUTTON_PRIMARY}>
              {saving ? "Salvando..." : "Salvar observação"}
            </button>
          </>
        }
      >
        <label className={cx(LABEL_BASE)} htmlFor="observation-content">
          Texto da observação
        </label>
        <textarea
          id="observation-content"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          placeholder="Ex.: Neste mês tivemos aumento no custo por lead devido à troca dos criativos. Apesar disso, as reuniões realizadas cresceram e tivemos melhora na qualidade das oportunidades."
          className={cx(INPUT_BASE, "resize-none")}
        />
      </Modal>
    </section>
  );
}
