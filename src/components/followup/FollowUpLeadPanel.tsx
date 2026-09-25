"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase/client";
import type { FollowUpActionType, FollowUpLeadSummary, FollowUpOutcome, FollowUpRecord, FollowUpScript } from "@/types/database";
import {
  BUTTON_PRIMARY,
  BUTTON_DANGER,
  BUTTON_SECONDARY,
  FOLLOW_UP_ACTION_TYPE_LABELS,
  INPUT_BASE,
  LABEL_BASE,
  LEAD_STATUS_BADGE,
  LEAD_STATUS_LABELS,
  cx,
  formatDatePtBR,
  formatDateTimePtBR,
  pickFollowUpScript,
  stageLabel,
} from "@/lib/utils";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

interface FollowUpLeadPanelProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  lead: FollowUpLeadSummary | null;
  scripts: FollowUpScript[];
  canRegister: boolean;
  canEdit: boolean;
  canDelete: boolean;
  maxStage: number;
  onChanged: () => void;
}

export function FollowUpLeadPanel({
  open,
  onClose,
  companyId,
  lead,
  scripts,
  canRegister,
  canEdit,
  canDelete,
  maxStage,
  onChanged,
}: FollowUpLeadPanelProps) {
  const supabase = createClient();
  const { showToast } = useToast();

  const [records, setRecords] = useState<FollowUpRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toDelete, setToDelete] = useState<FollowUpRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  const [stage, setStage] = useState(1);
  const [completedAt, setCompletedAt] = useState(todayISO());
  const [completedTime, setCompletedTime] = useState("");
  const [actionType, setActionType] = useState<FollowUpActionType>("whatsapp");
  const [responsible, setResponsible] = useState("");
  const [notes, setNotes] = useState("");
  const [requiresNext, setRequiresNext] = useState(true);
  const [nextContactAt, setNextContactAt] = useState("");
  const [closeOutcome, setCloseOutcome] = useState<FollowUpOutcome | null>(null);
  const [closing, setClosing] = useState(false);

  async function loadRecords(leadId: string) {
    setLoadingRecords(true);
    try {
      const { data, error } = await supabase
        .from("follow_up_records")
        .select("*")
        .eq("lead_id", leadId)
        .order("completed_at", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      setRecords((data ?? []) as FollowUpRecord[]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível carregar o histórico.", "error");
    } finally {
      setLoadingRecords(false);
    }
  }

  useEffect(() => {
    if (open && lead) {
      loadRecords(lead.lead_id);
      setResponsible(lead.responsible);
      setCompletedAt(todayISO());
      setCompletedTime("");
      setActionType("whatsapp");
      setNotes("");
      setRequiresNext(true);
      setNextContactAt("");
      setCopied(false);
      setCloseOutcome(null);
      setEditingRecordId(null);
      setStage(lead.current_stage && lead.current_stage <= maxStage ? lead.current_stage : 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead?.lead_id]);

  if (!lead) return null;

  const script = pickFollowUpScript(scripts, stage, lead.service_interest);
  const active = lead.status === "follow_up" && lead.cycle_status !== "completed";

  async function handleCopyScript() {
    if (!script) return;
    try {
      await navigator.clipboard.writeText(script.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast("Não foi possível copiar o script.", "error");
    }
  }

  async function handleRegister() {
    if (!lead) return;
    if (requiresNext && !nextContactAt) {
      showToast("Informe a data do próximo contato.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        lead_id: lead.lead_id,
        company_id: companyId,
        stage_number: stage,
        action_type: actionType,
        completed_at: completedAt,
        completed_time: completedTime || null,
        responsible,
        notes,
        requires_next_contact: requiresNext,
        next_contact_at: requiresNext ? nextContactAt : null,
      };
      const { error: writeError } = editingRecordId
        ? await supabase.from("follow_up_records").update(payload).eq("id", editingRecordId)
        : await supabase.from("follow_up_records").insert(payload);
      if (writeError) throw writeError;

      // Item 23: alterações de Responsável feitas no Follow-up refletem no
      // Controle de Leads (mesma fonte de dados, nunca duplicada).
      if (responsible.trim() !== lead.responsible.trim()) {
        const { error: updateError } = await supabase
          .from("leads")
          .update({ responsible })
          .eq("id", lead.lead_id);
        if (updateError) throw updateError;
      }

      showToast(editingRecordId ? "Registro atualizado." : "Follow-up registrado.", "success");
      setEditingRecordId(null);
      setNotes("");
      setCompletedTime("");
      await loadRecords(lead.lead_id);
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível registrar o follow-up.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!toDelete || !lead) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("follow_up_records").delete().eq("id", toDelete.id);
      if (error) throw error;
      showToast("Registro excluído.", "success");
      setToDelete(null);
      await loadRecords(lead.lead_id);
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível excluir o registro.", "error");
    } finally {
      setDeleting(false);
    }
  }

  function startEditing(record: FollowUpRecord) {
    setEditingRecordId(record.id);
    setStage(record.stage_number);
    setCompletedAt(record.completed_at);
    setCompletedTime(record.completed_time?.slice(0, 5) ?? "");
    setActionType(record.action_type);
    setResponsible(record.responsible);
    setNotes(record.notes);
    setRequiresNext(record.requires_next_contact);
    setNextContactAt(record.next_contact_at ?? "");
  }

  async function handleClose() {
    if (!closeOutcome || !lead) return;
    setClosing(true);
    try {
      const { error } = await supabase.rpc("close_follow_up_cycle", {
        p_lead_id: lead.lead_id,
        p_outcome: closeOutcome,
      });
      if (error) throw error;
      showToast(
        closeOutcome === "success" ? "Follow-up encerrado com reunião marcada." : "Follow-up encerrado sem retorno.",
        "success"
      );
      setCloseOutcome(null);
      onChanged();
      onClose();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível encerrar o follow-up.", "error");
    } finally {
      setClosing(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={lead.name} size="lg">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-zinc-400">
          <span>{lead.phone || "Sem telefone"}</span>
          {lead.service_interest && <span>{lead.service_interest}</span>}
          <span className={cx("rounded-full border px-2 py-0.5 font-medium", LEAD_STATUS_BADGE[lead.status])}>
            {LEAD_STATUS_LABELS[lead.status]}
          </span>
        </div>

        {lead.outcome && (
          <div className={cx(
            "rounded-xl border px-4 py-3 text-sm font-medium",
            lead.outcome === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300"
              : "border-slate-200 bg-slate-50 text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
          )}>
            Resultado do ciclo: {lead.outcome === "success" ? "Sucesso — Reunião marcada" : "Sem retorno — Processo encerrado"}
          </div>
        )}

        {script && (
          <div className="rounded-xl border border-brand-200/70 bg-brand-50/60 p-3.5 dark:border-brand-900/40 dark:bg-brand-950/20">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                Script recomendado — {stageLabel(stage)}
              </p>
              <button
                onClick={handleCopyScript}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100 dark:text-brand-300 dark:hover:bg-brand-900/40"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar script"}
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
              {script.content}
            </p>
          </div>
        )}

        {(canRegister || !!editingRecordId) && active && (
          <div className="rounded-xl border border-slate-200/70 p-4 dark:border-zinc-800/70">
            <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-zinc-100">
              {editingRecordId ? "Editar registro" : "Registrar follow-up"}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL_BASE}>Etapa</label>
                <select value={stage} onChange={(e) => setStage(Number(e.target.value))} className={INPUT_BASE}>
                  {Array.from({ length: maxStage }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {stageLabel(n)}
                    </option>
                  ))}
                </select>
                {stage === maxStage && (
                  <p className="mt-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    Esta é a última etapa configurada.
                  </p>
                )}
              </div>
              <div>
                <label className={LABEL_BASE}>Tipo de ação</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as FollowUpActionType)}
                  className={INPUT_BASE}
                >
                  {(Object.keys(FOLLOW_UP_ACTION_TYPE_LABELS) as FollowUpActionType[]).map((k) => (
                    <option key={k} value={k}>
                      {FOLLOW_UP_ACTION_TYPE_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL_BASE}>Data realizada</label>
                <input
                  type="date"
                  value={completedAt}
                  onChange={(e) => setCompletedAt(e.target.value)}
                  className={INPUT_BASE}
                />
              </div>
              <div>
                <label className={LABEL_BASE}>Horário (opcional)</label>
                <input
                  type="time"
                  value={completedTime}
                  onChange={(e) => setCompletedTime(e.target.value)}
                  className={INPUT_BASE}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL_BASE}>Responsável</label>
                <input
                  type="text"
                  value={responsible}
                  onChange={(e) => setResponsible(e.target.value)}
                  className={INPUT_BASE}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL_BASE}>Observação sobre o contato</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Ex.: Cliente não respondeu."
                  className={cx(INPUT_BASE, "resize-none")}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL_BASE}>Precisa entrar em contato novamente?</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRequiresNext(true)}
                    className={cx(BUTTON_SECONDARY, "flex-1", requiresNext && "border-brand-500 text-brand-700 dark:text-brand-300")}
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequiresNext(false)}
                    className={cx(BUTTON_SECONDARY, "flex-1", !requiresNext && "border-brand-500 text-brand-700 dark:text-brand-300")}
                  >
                    Não
                  </button>
                </div>
              </div>
              {requiresNext && (
                <div className="sm:col-span-2">
                  <label className={LABEL_BASE}>Data do próximo contato</label>
                  <input
                    type="date"
                    value={nextContactAt}
                    onChange={(e) => setNextContactAt(e.target.value)}
                    className={INPUT_BASE}
                  />
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              {editingRecordId && (
                <button onClick={() => setEditingRecordId(null)} disabled={saving} className={BUTTON_SECONDARY}>
                  Cancelar edição
                </button>
              )}
              <button onClick={handleRegister} disabled={saving} className={BUTTON_PRIMARY}>
                {saving ? "Salvando..." : editingRecordId ? "Salvar alterações" : "Registrar follow-up"}
              </button>
            </div>
          </div>
        )}

        {canEdit && active && (
          <div className="rounded-xl border border-slate-200/70 p-4 dark:border-zinc-800/70">
            <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Encerrar follow-up</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              O histórico será preservado e o lead sairá da lista ativa.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => setCloseOutcome("success")} className={BUTTON_PRIMARY}>
                Sucesso — Reunião marcada
              </button>
              <button onClick={() => setCloseOutcome("no_response")} className={BUTTON_DANGER}>
                Sem retorno — Encerrar
              </button>
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-zinc-100">Histórico</p>
          {loadingRecords ? (
            <p className="text-xs text-slate-400 dark:text-zinc-500">Carregando...</p>
          ) : records.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-zinc-500">Nenhum follow-up registrado ainda.</p>
          ) : (
            <ol className="space-y-2.5 border-l border-slate-200 pl-4 dark:border-zinc-800">
              {records.map((r) => (
                <li key={r.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand-500" />
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                        {formatDateTimePtBR(r.completed_at + (r.completed_time ? `T${r.completed_time}` : "T00:00:00"))}
                        {" · "}
                        {stageLabel(r.stage_number)}
                        {" · "}
                        {FOLLOW_UP_ACTION_TYPE_LABELS[r.action_type]}
                        {r.responsible && ` · ${r.responsible}`}
                      </p>
                      {r.notes && <p className="mt-0.5 text-sm text-slate-600 dark:text-zinc-400">{r.notes}</p>}
                      {r.requires_next_contact && r.next_contact_at && (
                        <p className="mt-0.5 text-xs text-slate-400 dark:text-zinc-500">
                          Próximo contato: {formatDatePtBR(r.next_contact_at)}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {canEdit && active && (
                        <button onClick={() => startEditing(r)} aria-label="Editar registro" className="rounded-md p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setToDelete(r)} aria-label="Excluir registro" className="rounded-md p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-zinc-600 dark:hover:bg-red-950/40 dark:hover:text-red-400">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="Excluir este registro?"
        message="O histórico deste follow-up será removido permanentemente."
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
      <ConfirmDialog
        open={!!closeOutcome}
        title="Confirmar encerramento"
        message={
          closeOutcome === "success"
            ? "O ciclo será encerrado como Sucesso e a situação do lead mudará para Reunião marcada."
            : "O ciclo será encerrado como Sem retorno e a situação do lead mudará para Abandonou."
        }
        confirmLabel="Confirmar encerramento"
        loading={closing}
        onConfirm={handleClose}
        onCancel={() => setCloseOutcome(null)}
      />
    </Modal>
  );
}
