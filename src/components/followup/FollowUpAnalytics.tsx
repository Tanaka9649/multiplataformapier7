"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { createClient } from "@/lib/supabase/client";
import { FOLLOW_UP_RESULT_LABELS } from "@/lib/followUp";
import type { FollowUpResult } from "@/types/database";
import { BUTTON_SECONDARY, INPUT_BASE, LABEL_BASE, stageLabel } from "@/lib/utils";

type AnalyticsRow = { stage_number: number; result: FollowUpResult | null; completed_at: string; responsible: string; leads: { service_interest: string } | null };

export function FollowUpAnalytics({ open, onClose, companyId }: { open: boolean; onClose: () => void; companyId: string }) {
  const supabase = createClient();
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [responsible, setResponsible] = useState("");
  const [service, setService] = useState("");
  const [rows, setRows] = useState<AnalyticsRow[]>([]);

  useEffect(() => {
    if (!open) return;
    let query = supabase.from("follow_up_records").select("stage_number,result,completed_at,responsible,leads(service_interest)").eq("company_id", companyId).gte("completed_at", from).lte("completed_at", to);
    if (responsible.trim()) query = query.ilike("responsible", `%${responsible.trim()}%`);
    query.then(({ data }) => setRows((data ?? []) as unknown as AnalyticsRow[]));
  }, [open, companyId, from, to, responsible, supabase]);

  const filtered = useMemo(() => rows.filter((row) => !service.trim() || row.leads?.service_interest?.toLowerCase().includes(service.trim().toLowerCase())), [rows, service]);
  const stages = useMemo(() => [...new Set(filtered.map((row) => row.stage_number))].sort((a, b) => a - b), [filtered]);

  return (
    <Modal open={open} onClose={onClose} title="Análise de follow-up" size="lg" footer={<button type="button" onClick={onClose} className={BUTTON_SECONDARY}>Fechar</button>}>
      <div className="grid gap-3 sm:grid-cols-4">
        <div><label className={LABEL_BASE}>De</label><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={INPUT_BASE} /></div>
        <div><label className={LABEL_BASE}>Até</label><input type="date" value={to} onChange={(event) => setTo(event.target.value)} className={INPUT_BASE} /></div>
        <div><label className={LABEL_BASE}>Responsável</label><input value={responsible} onChange={(event) => setResponsible(event.target.value)} className={INPUT_BASE} /></div>
        <div><label className={LABEL_BASE}>Serviço</label><input value={service} onChange={(event) => setService(event.target.value)} className={INPUT_BASE} /></div>
      </div>
      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-zinc-950"><tr><th className="px-3 py-2 text-left">Etapa</th>{(Object.keys(FOLLOW_UP_RESULT_LABELS) as FollowUpResult[]).map((result) => <th key={result} className="whitespace-nowrap px-3 py-2 text-right text-xs">{FOLLOW_UP_RESULT_LABELS[result]}</th>)}<th className="px-3 py-2 text-right">Total</th></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">{stages.map((stage) => {
            const stageRows = filtered.filter((row) => row.stage_number === stage);
            return <tr key={stage}><td className="px-3 py-2 font-medium">{stageLabel(stage)}</td>{(Object.keys(FOLLOW_UP_RESULT_LABELS) as FollowUpResult[]).map((result) => <td key={result} className="px-3 py-2 text-right">{stageRows.filter((row) => row.result === result).length}</td>)}<td className="px-3 py-2 text-right font-semibold">{stageRows.length}</td></tr>;
          })}</tbody>
        </table>
        {filtered.length === 0 && <p className="p-8 text-center text-sm text-slate-400">Nenhum registro no período.</p>}
      </div>
    </Modal>
  );
}
