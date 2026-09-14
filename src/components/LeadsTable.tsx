"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, MoreVertical, NotebookText, Trash2 } from "lucide-react";
import { StarRating } from "@/components/StarRating";
import type { Lead, LeadOrigin, LeadStatus } from "@/types/database";
import {
  CARD_SURFACE,
  LEAD_ORIGIN_LABELS,
  LEAD_STATUS_BADGE,
  LEAD_STATUS_LABELS,
  cx,
} from "@/lib/utils";

export type LeadSortKey = "entry_date" | "name" | "qualification" | "status";

interface LeadsTableProps {
  leads: Lead[];
  loading: boolean;
  sortKey: LeadSortKey;
  sortDir: "asc" | "desc";
  onSort: (key: LeadSortKey) => void;
  onFieldChange: (leadId: string, field: keyof Lead, value: string | number) => void;
  onOpenNotes: (lead: Lead) => void;
  onDeleteRequest: (lead: Lead) => void;
}

function TextCell({
  value,
  onCommit,
  placeholder,
}: {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <input
      type="text"
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== value) onCommit(local);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-full min-w-[120px] rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-slate-800 outline-none transition-colors hover:border-slate-200 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 dark:text-zinc-200 dark:hover:border-zinc-700 dark:focus:bg-zinc-900 dark:focus:ring-brand-900/40"
    />
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex items-center gap-1 whitespace-nowrap text-[11px] font-medium uppercase tracking-wider transition-colors",
        active ? "text-slate-700 dark:text-zinc-200" : "text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
      )}
    >
      {label}
      {active ? (
        dir === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

function RowMenu({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Opções do lead"
        className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 z-20 w-36 animate-fade-in rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            <button
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir lead
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function LeadsTable({
  leads,
  loading,
  sortKey,
  sortDir,
  onSort,
  onFieldChange,
  onOpenNotes,
  onDeleteRequest,
}: LeadsTableProps) {
  return (
    <div className={cx(CARD_SURFACE, "overflow-hidden p-0")}>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse text-sm">
          <thead className="bg-slate-50/70 dark:bg-zinc-950/40">
            <tr className="border-b border-slate-100 dark:border-zinc-800/70">
              <th className="sticky left-0 z-10 bg-slate-50/70 px-3 py-2.5 text-left dark:bg-zinc-950/40">
                <SortHeader label="Data" active={sortKey === "entry_date"} dir={sortDir} onClick={() => onSort("entry_date")} />
              </th>
              <th className="sticky left-[92px] z-10 min-w-[160px] bg-slate-50/70 px-3 py-2.5 text-left shadow-[2px_0_0_rgba(0,0,0,0.03)] dark:bg-zinc-950/40">
                <SortHeader label="Nome" active={sortKey === "name"} dir={sortDir} onClick={() => onSort("name")} />
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Telefone
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Serviço de interesse
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Origem
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Responsável
              </th>
              <th className="px-3 py-2.5 text-left">
                <SortHeader
                  label="Qualificação"
                  active={sortKey === "qualification"}
                  dir={sortDir}
                  onClick={() => onSort("qualification")}
                />
              </th>
              <th className="px-3 py-2.5 text-left">
                <SortHeader label="Situação" active={sortKey === "status"} dir={sortDir} onClick={() => onSort("status")} />
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Observações
              </th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className={cx("divide-y divide-slate-100 transition-opacity duration-200 dark:divide-zinc-800/70", loading && "opacity-50")}>
            {leads.map((lead) => (
              <tr key={lead.id} className="group hover:bg-slate-50/60 dark:hover:bg-zinc-800/30">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1 group-hover:bg-slate-50/60 dark:bg-zinc-900 dark:group-hover:bg-zinc-800/30">
                  <input
                    type="date"
                    value={lead.entry_date}
                    onChange={(e) => onFieldChange(lead.id, "entry_date", e.target.value)}
                    className="rounded-md border border-transparent bg-transparent px-1.5 py-1.5 text-sm text-slate-700 outline-none transition-colors hover:border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:text-zinc-300 dark:hover:border-zinc-700 dark:focus:ring-brand-900/40"
                  />
                </td>
                <td className="sticky left-[92px] z-10 min-w-[160px] bg-white px-3 py-1 shadow-[2px_0_0_rgba(0,0,0,0.03)] group-hover:bg-slate-50/60 dark:bg-zinc-900 dark:group-hover:bg-zinc-800/30">
                  <TextCell value={lead.name} onCommit={(v) => onFieldChange(lead.id, "name", v)} placeholder="Nome" />
                </td>
                <td className="px-3 py-1">
                  <TextCell value={lead.phone} onCommit={(v) => onFieldChange(lead.id, "phone", v)} placeholder="Telefone" />
                </td>
                <td className="px-3 py-1">
                  <TextCell
                    value={lead.service_interest}
                    onCommit={(v) => onFieldChange(lead.id, "service_interest", v)}
                    placeholder="Serviço"
                  />
                </td>
                <td className="px-3 py-1">
                  <select
                    value={lead.origin}
                    onChange={(e) => onFieldChange(lead.id, "origin", e.target.value as LeadOrigin)}
                    className="rounded-md border border-transparent bg-transparent px-1.5 py-1.5 text-sm text-slate-700 outline-none transition-colors hover:border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:text-zinc-300 dark:hover:border-zinc-700 dark:focus:ring-brand-900/40"
                  >
                    {(Object.keys(LEAD_ORIGIN_LABELS) as LeadOrigin[]).map((o) => (
                      <option key={o} value={o}>
                        {LEAD_ORIGIN_LABELS[o]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-1">
                  <TextCell
                    value={lead.responsible}
                    onCommit={(v) => onFieldChange(lead.id, "responsible", v)}
                    placeholder="Responsável"
                  />
                </td>
                <td className="px-3 py-1">
                  <StarRating value={lead.qualification} onChange={(v) => onFieldChange(lead.id, "qualification", v)} />
                </td>
                <td className="px-3 py-1">
                  <select
                    value={lead.status}
                    onChange={(e) => onFieldChange(lead.id, "status", e.target.value as LeadStatus)}
                    className={cx(
                      "cursor-pointer rounded-full border px-2 py-1 text-xs font-medium outline-none transition-colors",
                      LEAD_STATUS_BADGE[lead.status]
                    )}
                  >
                    {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {LEAD_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="max-w-[180px] px-3 py-1">
                  <button
                    onClick={() => onOpenNotes(lead)}
                    className="flex w-full items-center gap-1.5 truncate rounded-md px-2 py-1.5 text-left text-sm text-slate-500 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    title={lead.notes || "Adicionar observação"}
                  >
                    <NotebookText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{lead.notes || "—"}</span>
                  </button>
                </td>
                <td className="px-3 py-1">
                  <RowMenu onDelete={() => onDeleteRequest(lead)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
