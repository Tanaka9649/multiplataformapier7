"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase/client";
import type { FollowUpCadence } from "@/types/database";
import { BUTTON_GHOST_DANGER, BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT_BASE, LABEL_BASE, cx } from "@/lib/utils";

type DraftStage = { stage_number: number; delay_min_hours: number; delay_max_hours: number };
const DEFAULT_STAGES: DraftStage[] = [
  [1, 24, 24], [2, 28, 40], [3, 56, 56], [4, 104, 104], [5, 128, 128], [6, 176, 176],
].map(([stage_number, delay_min_hours, delay_max_hours]) => ({ stage_number, delay_min_hours, delay_max_hours }));

export function FollowUpCadenceConfig({ open, onClose, companyId, onSaved }: {
  open: boolean;
  onClose: () => void;
  companyId: string;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const { showToast } = useToast();
  const [cadences, setCadences] = useState<FollowUpCadence[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [name, setName] = useState("Cadência padrão");
  const [service, setService] = useState("");
  const [stages, setStages] = useState<DraftStage[]>(DEFAULT_STAGES);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("follow_up_cadences")
      .select("*, follow_up_cadence_stages(*)")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("service_interest", { ascending: true });
    if (error) {
      showToast(error.message, "error");
      return;
    }
    const rows = (data ?? []) as FollowUpCadence[];
    setCadences(rows);
    if (rows[0]) selectCadence(rows[0]);
    else startNew();
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, companyId]);

  function selectCadence(cadence: FollowUpCadence) {
    setSelectedId(cadence.id);
    setName(cadence.name);
    setService(cadence.service_interest ?? "");
    setStages((cadence.follow_up_cadence_stages ?? []).sort((a, b) => a.stage_number - b.stage_number).map((stage) => ({
      stage_number: stage.stage_number,
      delay_min_hours: stage.delay_min_hours,
      delay_max_hours: stage.delay_max_hours,
    })));
  }

  function startNew() {
    setSelectedId("");
    setName("Nova cadência");
    setService("");
    setStages(DEFAULT_STAGES.map((stage) => ({ ...stage })));
  }

  function updateStage(index: number, field: keyof DraftStage, value: number) {
    setStages((current) => current.map((stage, i) => i === index ? { ...stage, [field]: Math.max(field === "stage_number" ? 1 : 0, value) } : stage));
  }

  async function save() {
    if (!name.trim() || stages.length === 0) return showToast("Informe um nome e ao menos uma etapa.", "error");
    if (new Set(stages.map((stage) => stage.stage_number)).size !== stages.length) return showToast("Os números das etapas não podem se repetir.", "error");
    if (stages.some((stage) => stage.delay_max_hours < stage.delay_min_hours)) return showToast("O prazo máximo deve ser maior ou igual ao mínimo.", "error");
    setSaving(true);
    try {
      let cadenceId = selectedId;
      const payload = { company_id: companyId, name: name.trim(), service_interest: service.trim() || null, active: true };
      if (cadenceId) {
        const { error } = await supabase.from("follow_up_cadences").update(payload).eq("id", cadenceId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("follow_up_cadences").insert(payload).select("id").single();
        if (error) throw error;
        cadenceId = data.id;
      }
      const { error: deleteError } = await supabase.from("follow_up_cadence_stages").delete().eq("cadence_id", cadenceId);
      if (deleteError) throw deleteError;
      const { error: insertError } = await supabase.from("follow_up_cadence_stages").insert(
        stages.sort((a, b) => a.stage_number - b.stage_number).map((stage) => ({ ...stage, cadence_id: cadenceId }))
      );
      if (insertError) throw insertError;
      const maxStage = Math.max(...stages.map((stage) => stage.stage_number));
      await supabase.from("follow_up_settings").upsert({ company_id: companyId, max_stage: maxStage });
      showToast("Cadência salva. Ciclos em andamento mantêm a configuração anterior.", "success");
      await load();
      onSaved();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível salvar a cadência.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Configurar cadências" size="lg" footer={
      <><button type="button" onClick={onClose} className={BUTTON_SECONDARY}>Fechar</button><button type="button" onClick={save} disabled={saving} className={BUTTON_PRIMARY}>{saving ? "Salvando..." : "Salvar cadência"}</button></>
    }>
      <p className="mb-4 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
        A cadência específica do serviço tem prioridade sobre a geral. Alterações valem apenas para novos ciclos.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {cadences.map((cadence) => (
          <button key={cadence.id} type="button" onClick={() => selectCadence(cadence)} className={cx(BUTTON_SECONDARY, selectedId === cadence.id && "border-brand-500 dark:border-brand-500")}>
            {cadence.service_interest || "Geral"}
          </button>
        ))}
        <button type="button" onClick={startNew} className={cx(BUTTON_SECONDARY, "gap-1.5")}><Plus className="h-4 w-4" /> Nova</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={LABEL_BASE}>Nome</label><input value={name} onChange={(event) => setName(event.target.value)} className={INPUT_BASE} /></div>
        <div><label className={LABEL_BASE}>Serviço (vazio = geral)</label><input value={service} onChange={(event) => setService(event.target.value)} className={INPUT_BASE} placeholder="Ex.: Holding familiar" /></div>
      </div>
      <div className="mt-5 space-y-2">
        <div className="grid grid-cols-[70px_1fr_1fr_38px] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
          <span>Etapa</span><span>Após (h)</span><span>Até (h)</span><span />
        </div>
        {stages.map((stage, index) => (
          <div key={`${stage.stage_number}-${index}`} className="grid grid-cols-[70px_1fr_1fr_38px] gap-2">
            <input type="number" min={1} value={stage.stage_number} onChange={(event) => updateStage(index, "stage_number", Number(event.target.value))} className={INPUT_BASE} />
            <input type="number" min={0} value={stage.delay_min_hours} onChange={(event) => updateStage(index, "delay_min_hours", Number(event.target.value))} className={INPUT_BASE} />
            <input type="number" min={stage.delay_min_hours} value={stage.delay_max_hours} onChange={(event) => updateStage(index, "delay_max_hours", Number(event.target.value))} className={INPUT_BASE} />
            <button type="button" onClick={() => setStages((current) => current.filter((_, i) => i !== index))} className={BUTTON_GHOST_DANGER} aria-label="Remover etapa"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <button type="button" onClick={() => setStages((current) => [...current, { stage_number: Math.max(0, ...current.map((stage) => stage.stage_number)) + 1, delay_min_hours: 24, delay_max_hours: 24 }])} className={cx(BUTTON_SECONDARY, "mt-2 gap-1.5")}>
          <Plus className="h-4 w-4" /> Adicionar etapa
        </button>
      </div>
    </Modal>
  );
}
