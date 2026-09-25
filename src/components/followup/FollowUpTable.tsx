"use client";

import { NotebookText, PhoneCall } from "lucide-react";
import type { FollowUpLeadSummary } from "@/types/database";
import {
  CARD_SURFACE,
  FOLLOW_UP_OVERDUE_BADGE,
  LEAD_STATUS_BADGE,
  LEAD_STATUS_LABELS,
  cx,
  formatDatePtBR,
  formatDaysOverdue,
  stageLabel,
} from "@/lib/utils";
import { formatFollowUpMoment, formatRelativeDeadline, isWeekend } from "@/lib/followUp";

function isOverdue(nextContactAt: string | null) {
  if (!nextContactAt) return false;
  if (isWeekend()) return false;
  return nextContactAt < new Date().toISOString().slice(0, 10);
}

interface FollowUpTableProps {
  rows: FollowUpLeadSummary[];
  loading: boolean;
  companyName: string;
  canRegister: boolean;
  onSelect: (row: FollowUpLeadSummary) => void;
}

export function FollowUpTable({ rows, loading, companyName, canRegister, onSelect }: FollowUpTableProps) {
  return (
    <div className={cx(CARD_SURFACE, "overflow-hidden p-0")}>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[1520px] border-collapse text-sm">
          <thead className="bg-slate-50 dark:bg-zinc-950">
            <tr className="border-b border-slate-100 dark:border-zinc-800/70">
              {[
                "Nome",
                "Telefone",
                "Empresa",
                "Serviço de interesse",
                "Responsável",
                "Situação",
                "Etapa atual",
                "Último follow-up",
                "Próximo follow-up",
                "Janela programada",
                "Prazo / status",
                "Observação",
                "Resultado",
                "Ação",
              ].map((label) => (
                <th
                  key={label}
                  className="whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={cx("divide-y divide-slate-100 transition-opacity duration-200 dark:divide-zinc-800/70", loading && "opacity-50")}>
            {rows.map((row) => {
              const overdue = isOverdue(row.next_contact_at);
              return (
                <tr
                  key={row.lead_id}
                  className="cursor-pointer hover:bg-slate-50/60 dark:hover:bg-zinc-800/30"
                  onClick={() => onSelect(row)}
                >
                  <td className="min-w-[160px] whitespace-nowrap px-3 py-2 font-medium text-slate-800 dark:text-zinc-200">
                    {row.name}
                  </td>
                  <td className="min-w-[130px] whitespace-nowrap px-3 py-2 text-slate-600 dark:text-zinc-400">{row.phone || "—"}</td>
                  <td className="min-w-[120px] whitespace-nowrap px-3 py-2 text-slate-600 dark:text-zinc-400">{companyName}</td>
                  <td className="max-w-[180px] truncate px-3 py-2 text-slate-600 dark:text-zinc-400" title={row.service_interest}>
                    {row.service_interest || "—"}
                  </td>
                  <td className="min-w-[120px] whitespace-nowrap px-3 py-2 text-slate-600 dark:text-zinc-400">
                    {row.responsible || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className={cx("rounded-full border px-2 py-0.5 text-xs font-medium", LEAD_STATUS_BADGE[row.status])}>
                      {LEAD_STATUS_LABELS[row.status]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600 dark:text-zinc-400">
                    {row.window_start_at && row.deadline_at ? `${formatFollowUpMoment(row.window_start_at)} → ${formatFollowUpMoment(row.deadline_at)}` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {row.deadline_at ? <span className={cx("rounded-full border px-2 py-0.5 text-xs font-medium", formatRelativeDeadline(row.deadline_at).startsWith("Atrasado") ? FOLLOW_UP_OVERDUE_BADGE : "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-900/50 dark:bg-brand-950/20 dark:text-brand-300")}>{formatRelativeDeadline(row.deadline_at)}</span> : row.cycle_status === "completed" ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">Concluído</span> : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-zinc-400">
                    {row.current_stage ? stageLabel(row.current_stage) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-zinc-400">
                    {row.last_contact_at ? formatDatePtBR(row.last_contact_at) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {row.next_contact_at ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-600 dark:text-zinc-400">{formatDatePtBR(row.next_contact_at)}</span>
                        {overdue && (
                          <span className={cx("w-fit rounded-full border px-1.5 py-0.5 text-[10px] font-medium", FOLLOW_UP_OVERDUE_BADGE)}>
                            {formatDaysOverdue(row.next_contact_at)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 dark:text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="max-w-[200px] px-3 py-2">
                    <div className="flex items-center gap-1.5 truncate text-slate-500 dark:text-zinc-400" title={row.last_notes ?? ""}>
                      {row.last_notes && <NotebookText className="h-3.5 w-3.5 shrink-0" />}
                      <span className="truncate">{row.last_notes || "—"}</span>
                    </div>
                  </td>
                  <td className="max-w-[160px] px-3 py-2">
                    {row.outcome ? (
                      <span className={cx(
                        "rounded-full border px-2 py-0.5 text-xs font-medium",
                        row.outcome === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300"
                          : "border-slate-200 bg-slate-50 text-slate-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      )}>
                        {row.outcome === "success" ? "Sucesso" : "Sem retorno"}
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(row);
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <PhoneCall className="h-3.5 w-3.5" />
                      {canRegister && row.status === "follow_up" && row.cycle_status !== "completed" ? "Registrar follow-up" : "Ver histórico"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
