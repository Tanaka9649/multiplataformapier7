"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Pencil, Printer, Trash2 } from "lucide-react";
import { StatusBadge, type StatusBadgeVariant } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase/client";
import type { FollowUpActionType, FollowUpLeadSummary, FollowUpOutcome, FollowUpRecord, FollowUpResult, FollowUpScript, FollowUpStageSchedule } from "@/types/database";
import { FOLLOW_UP_RESULT_LABELS, formatFollowUpMoment, formatRelativeDeadline, getDeadlineBadgeVariant } from "@/lib/followUp";
import { LEAD_STATUS_VARIANTS } from "@/lib/uiVariants";
import {
  BUTTON_PRIMARY,
  BUTTON_DANGER,
  BUTTON_GHOST,
  BUTTON_SECONDARY,
  FOLLOW_UP_ACTION_TYPE_LABELS,
  INPUT_BASE,
  LABEL_BASE,
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

function scheduleStatusVariant(schedule: FollowUpStageSchedule): StatusBadgeVariant {
  if (schedule.status === "pending") return getDeadlineBadgeVariant(schedule.deadline_at);
  if (schedule.status === "completed") return "success";
  return "neutral";
}

function scheduleStatusLabel(schedule: FollowUpStageSchedule) {
  if (schedule.status === "pending") return "Agendado";
  if (schedule.status === "completed") return "Realizado";
  if (schedule.status === "skipped") return "Pulado";
  return "Cancelado";
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
  const [schedules, setSchedules] = useState<FollowUpStageSchedule[]>([]);
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
  const [result, setResult] = useState<FollowUpResult>("no_answer");
  const [closeOutcome, setCloseOutcome] = useState<FollowUpOutcome | null>(null);
  const [closing, setClosing] = useState(false);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleStart, setRescheduleStart] = useState("");
  const [rescheduleDeadline, setRescheduleDeadline] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");

  async function loadRecords(leadId: string) {
    setLoadingRecords(true);
    try {
      const [recordsResult, schedulesResult] = await Promise.all([
        supabase.from("follow_up_records").select("*").eq("lead_id", leadId).order("completed_at", { ascending: true }).order("created_at", { ascending: true }),
        supabase.from("follow_up_stage_schedules").select("*").eq("lead_id", leadId).order("stage_number", { ascending: true }),
      ]);
      if (recordsResult.error) throw recordsResult.error;
      if (schedulesResult.error) throw schedulesResult.error;
      setRecords((recordsResult.data ?? []) as FollowUpRecord[]);
      setSchedules((schedulesResult.data ?? []) as FollowUpStageSchedule[]);
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
      setResult("no_answer");
      setCopied(false);
      setCloseOutcome(null);
      setEditingRecordId(null);
      setStage(lead.next_stage ?? (lead.current_stage && lead.current_stage <= maxStage ? lead.current_stage : 1));
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
      const schedule = schedules.find((item) => item.stage_number === stage && item.status === "pending");
      const { error: writeError } = editingRecordId
        ? await supabase.from("follow_up_records").update({ ...payload, result }).eq("id", editingRecordId)
        : schedule
          ? await supabase.rpc("complete_follow_up_stage", {
              p_schedule_id: schedule.id,
              p_result: result,
              p_action_type: actionType,
              p_completed_at: completedAt,
              p_completed_time: completedTime || null,
              p_responsible: responsible,
              p_notes: notes,
            })
          : { error: new Error("Nenhuma etapa pendente foi encontrada para este ciclo.") };
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
    setResult(record.result ?? "no_answer");
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

  function beginReschedule(schedule: FollowUpStageSchedule) {
    setRescheduleId(schedule.id);
    setRescheduleStart(schedule.window_start_at.slice(0, 16));
    setRescheduleDeadline(schedule.deadline_at.slice(0, 16));
    setRescheduleReason("");
  }

  async function handleReschedule() {
    if (!lead || !rescheduleId || !rescheduleStart || !rescheduleDeadline) return;
    const leadId = lead.lead_id;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("reschedule_follow_up_stage", {
        p_schedule_id: rescheduleId,
        p_window_start_at: new Date(rescheduleStart).toISOString(),
        p_deadline_at: new Date(rescheduleDeadline).toISOString(),
        p_reason: rescheduleReason,
      });
      if (error) throw error;
      showToast("Prazo alterado e registrado no histórico.", "success");
      setRescheduleId(null);
      await loadRecords(leadId);
      onChanged();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível alterar o prazo.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={lead.name} size="lg">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-zinc-400">
          <span>{lead.phone || "Sem telefone"}</span>
          {lead.service_interest && <span>{lead.service_interest}</span>}
          <StatusBadge variant={LEAD_STATUS_VARIANTS[lead.status]}>
            {LEAD_STATUS_LABELS[lead.status]}
          </StatusBadge>
          <button type="button" onClick={() => window.print()} className="ml-auto flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 font-medium hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
            <Printer className="h-3.5 w-3.5" /> Imprimir relatório
          </button>
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
          <div className="rounded-xl border border-brand-200/70 bg-brand-50/60 p-3.5 dark:border-brand-900/40 dark:bg-brand-900/20">
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
                  {(editingRecordId
                    ? Array.from({ length: maxStage }, (_, i) => i + 1)
                    : schedules.filter((schedule) => schedule.status === "pending").map((schedule) => schedule.stage_number)
                  ).map((n) => (
                    <option key={n} value={n}>
                      {stageLabel(n)}
                    </option>
                  ))}
                </select>
                {!editingRecordId && schedules.find((schedule) => schedule.stage_number === stage) && (
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-zinc-400">
                    Janela: {formatFollowUpMoment(schedules.find((schedule) => schedule.stage_number === stage)!.window_start_at)} até {formatFollowUpMoment(schedules.find((schedule) => schedule.stage_number === stage)!.deadline_at)} · {formatRelativeDeadline(schedules.find((schedule) => schedule.stage_number === stage)!.deadline_at)}
                  </p>
                )}
                {stage === (schedules.length ? Math.max(...schedules.map((schedule) => schedule.stage_number)) : maxStage) && (
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
              <div className="sm:col-span-2">
                <label className={LABEL_BASE}>Resultado</label>
                <select value={result} onChange={(e) => setResult(e.target.value as FollowUpResult)} className={INPUT_BASE}>
                  {(Object.keys(FOLLOW_UP_RESULT_LABELS) as FollowUpResult[]).map((value) => (
                    <option key={value} value={value}>{FOLLOW_UP_RESULT_LABELS[value]}</option>
                  ))}
                </select>
                {result === "meeting_scheduled" && <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">Encerra o ciclo com sucesso e muda o lead para Reunião marcada.</p>}
                {result === "no_answer" && stage === (schedules.length ? Math.max(...schedules.map((schedule) => schedule.stage_number)) : maxStage) && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Na etapa final, encerra o ciclo sem retorno e muda o lead para Abandonou.</p>}
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
          {schedules.length > 0 && (
            <div className="mb-5">
              <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-zinc-100">Agenda do ciclo</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {schedules.map((schedule) => (
                  <div key={schedule.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-zinc-800">
                    <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-700 dark:text-zinc-200">{stageLabel(schedule.stage_number)}</span><StatusBadge variant={scheduleStatusVariant(schedule)}>{scheduleStatusLabel(schedule)}</StatusBadge></div>
                    <p className="mt-1 text-slate-500 dark:text-zinc-400">{formatFollowUpMoment(schedule.window_start_at)} → {formatFollowUpMoment(schedule.deadline_at)}</p>
                    {schedule.status === "pending" && <div className="mt-1 flex items-center justify-between gap-2"><StatusBadge variant={getDeadlineBadgeVariant(schedule.deadline_at)}>{formatRelativeDeadline(schedule.deadline_at)}</StatusBadge>{canRegister && <button type="button" onClick={() => beginReschedule(schedule)} className={BUTTON_GHOST}>Adiar</button>}</div>}
                  </div>
                ))}
              </div>
              {rescheduleId && (
                <div className="mt-3 grid gap-2 rounded-lg border border-brand-200 bg-brand-50/40 p-3 dark:border-brand-900/50 dark:bg-brand-900/20 sm:grid-cols-2">
                  <div><label className={LABEL_BASE}>Nova abertura</label><input type="datetime-local" value={rescheduleStart} onChange={(event) => setRescheduleStart(event.target.value)} className={INPUT_BASE} /></div>
                  <div><label className={LABEL_BASE}>Novo prazo</label><input type="datetime-local" value={rescheduleDeadline} onChange={(event) => setRescheduleDeadline(event.target.value)} className={INPUT_BASE} /></div>
                  <div className="sm:col-span-2"><label className={LABEL_BASE}>Motivo</label><input value={rescheduleReason} onChange={(event) => setRescheduleReason(event.target.value)} className={INPUT_BASE} /></div>
                  <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setRescheduleId(null)} className={BUTTON_SECONDARY}>Cancelar</button><button type="button" onClick={handleReschedule} className={BUTTON_PRIMARY}>Salvar adiamento</button></div>
                </div>
              )}
            </div>
          )}
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
                      {r.result && <p className="mt-0.5 text-xs font-medium text-brand-700 dark:text-brand-300">Resultado: {FOLLOW_UP_RESULT_LABELS[r.result]}</p>}
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
