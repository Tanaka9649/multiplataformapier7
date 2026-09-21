"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Settings2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { SectionHeader } from "@/components/SectionHeader";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { usePermissions } from "@/lib/usePermissions";
import { FollowUpTable } from "@/components/followup/FollowUpTable";
import { FollowUpLeadPanel } from "@/components/followup/FollowUpLeadPanel";
import { FollowUpScriptsConfig } from "@/components/followup/FollowUpScriptsConfig";
import type { FollowUpLeadSummary, FollowUpScript } from "@/types/database";
import { BUTTON_SECONDARY, INPUT_BASE, cx, escapePostgrestValue } from "@/lib/utils";

type FilterMode = "active" | "today" | "overdue" | "next7" | "noNextContact" | "completed";

const FILTER_OPTIONS: { key: FilterMode; label: string }[] = [
  { key: "active", label: "Ativos" },
  { key: "today", label: "Hoje" },
  { key: "overdue", label: "Atrasados" },
  { key: "next7", label: "Próximos 7 dias" },
  { key: "noNextContact", label: "Sem próximo contato" },
  { key: "completed", label: "Concluídos" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysFromNowISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function startOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

interface Indicators {
  today: number;
  overdue: number;
  next7: number;
  completedMonth: number;
}

export function FollowUpSection({ companyId, companyName }: { companyId: string; companyName: string }) {
  const supabase = createClient();
  const { showToast } = useToast();
  const { can, isOwner } = usePermissions();

  const canView = isOwner || can(companyId, "follow_up", "view");
  const canRegister = isOwner || can(companyId, "follow_up", "register");
  const canDelete = isOwner || can(companyId, "follow_up", "delete");
  const canConfigureScripts = isOwner || can(companyId, "follow_up", "configure_scripts");

  const [rows, setRows] = useState<FollowUpLeadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [indicators, setIndicators] = useState<Indicators>({ today: 0, overdue: 0, next7: 0, completedMonth: 0 });

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("active");
  const [responsibleFilter, setResponsibleFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [stageFilter, setStageFilter] = useState<"all" | number>("all");

  const [scripts, setScripts] = useState<FollowUpScript[]>([]);
  const [selectedLead, setSelectedLead] = useState<FollowUpLeadSummary | null>(null);
  const [scriptsConfigOpen, setScriptsConfigOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const hasActiveFilters =
    debouncedSearch.trim() !== "" || responsibleFilter.trim() !== "" || serviceFilter.trim() !== "" || stageFilter !== "all";

  const loadScripts = useCallback(async () => {
    const { data, error } = await supabase.from("follow_up_scripts").select("*").eq("company_id", companyId);
    if (!error) setScripts((data ?? []) as FollowUpScript[]);
  }, [supabase, companyId]);

  const loadIndicators = useCallback(async () => {
    try {
      const { data: activeRows } = await supabase
        .from("follow_up_lead_summary")
        .select("next_contact_at")
        .eq("company_id", companyId)
        .eq("status", "follow_up");
      const today = todayISO();
      const in7 = daysFromNowISO(7);
      let todayCount = 0;
      let overdueCount = 0;
      let next7Count = 0;
      for (const r of activeRows ?? []) {
        const nc = (r as { next_contact_at: string | null }).next_contact_at;
        if (!nc) continue;
        if (nc === today) todayCount++;
        else if (nc < today) overdueCount++;
        else if (nc <= in7) next7Count++;
      }

      const { data: monthRecords } = await supabase
        .from("follow_up_records")
        .select("lead_id, leads!inner(status)")
        .eq("company_id", companyId)
        .gte("created_at", startOfMonthISO());
      const closedLeadIds = new Set<string>();
      for (const r of monthRecords ?? []) {
        const leadStatus = (r as unknown as { lead_id: string; leads: { status: string } | { status: string }[] }).leads;
        const status = Array.isArray(leadStatus) ? leadStatus[0]?.status : leadStatus?.status;
        if (status === "contrato_fechado") {
          closedLeadIds.add((r as { lead_id: string }).lead_id);
        }
      }

      setIndicators({ today: todayCount, overdue: overdueCount, next7: next7Count, completedMonth: closedLeadIds.size });
    } catch {
      // Indicadores são um resumo auxiliar — uma falha aqui não deve
      // impedir a listagem principal de carregar.
    }
  }, [supabase, companyId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from("follow_up_lead_summary").select("*").eq("company_id", companyId);

      const term = debouncedSearch.trim();
      if (term) {
        // Pesquisa por nome/telefone busca em todos os leads da empresa
        // (não só os ativos em follow-up), para permitir localizar
        // histórico de leads já encerrados (item 10/24 do escopo).
        const esc = escapePostgrestValue(term);
        query = query.or(`name.ilike.%${esc}%,phone.ilike.%${esc}%`);
      } else {
        switch (filterMode) {
          case "active":
            query = query.eq("status", "follow_up");
            break;
          case "today":
            query = query.eq("status", "follow_up").eq("next_contact_at", todayISO());
            break;
          case "overdue":
            query = query.eq("status", "follow_up").lt("next_contact_at", todayISO());
            break;
          case "next7":
            query = query.eq("status", "follow_up").gt("next_contact_at", todayISO()).lte("next_contact_at", daysFromNowISO(7));
            break;
          case "noNextContact":
            query = query.eq("status", "follow_up").is("next_contact_at", null);
            break;
          case "completed":
            query = query.in("status", ["contrato_fechado", "abandonou"]).not("current_stage", "is", null);
            break;
        }
      }

      if (responsibleFilter.trim()) query = query.ilike("responsible", `%${escapePostgrestValue(responsibleFilter.trim())}%`);
      if (serviceFilter.trim()) query = query.ilike("service_interest", `%${escapePostgrestValue(serviceFilter.trim())}%`);
      if (stageFilter !== "all") query = query.eq("current_stage", stageFilter);

      const { data, error } = await query.order("name", { ascending: true }).limit(500);
      if (error) throw error;
      setRows((data ?? []) as FollowUpLeadSummary[]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível carregar o follow-up.", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, companyId, debouncedSearch, filterMode, responsibleFilter, serviceFilter, stageFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadScripts();
    loadIndicators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  function refreshAll() {
    load();
    loadIndicators();
  }

  function clearFilters() {
    setSearchInput("");
    setResponsibleFilter("");
    setServiceFilter("");
    setStageFilter("all");
  }

  const stageOptions = useMemo(() => {
    const set = new Set<number>();
    rows.forEach((r) => r.current_stage && set.add(r.current_stage));
    return Array.from(set).sort((a, b) => a - b);
  }, [rows]);

  if (!canView) {
    return (
      <section>
        <SectionHeader title="Follow-up" />
        <EmptyState message="Você não tem permissão para visualizar o Follow-up." />
      </section>
    );
  }

  return (
    <section>
      <SectionHeader
        title="Follow-up"
        action={
          canConfigureScripts && (
            <button onClick={() => setScriptsConfigOpen(true)} className={BUTTON_SECONDARY}>
              <Settings2 className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.25} />
              Configurar scripts
            </button>
          )
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Para hoje", value: indicators.today },
          { label: "Atrasados", value: indicators.overdue },
          { label: "Próximos 7 dias", value: indicators.next7 },
          { label: "Concluídos no mês", value: indicators.completedMonth },
        ].map((ind) => (
          <div
            key={ind.label}
            className="rounded-xl border border-slate-200/70 bg-white px-3.5 py-3 dark:border-zinc-800/70 dark:bg-zinc-900"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">{ind.label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-zinc-50">{ind.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Pesquisar por nome ou telefone..."
            className={cx(INPUT_BASE, "pl-9")}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilterMode(opt.key)}
              disabled={!!debouncedSearch.trim()}
              className={cx(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                filterMode === opt.key
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={responsibleFilter}
            onChange={(e) => setResponsibleFilter(e.target.value)}
            placeholder="Responsável"
            className={cx(INPUT_BASE, "w-auto py-1.5 text-sm")}
          />
          <input
            type="text"
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            placeholder="Serviço"
            className={cx(INPUT_BASE, "w-auto py-1.5 text-sm")}
          />
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
            className={cx(INPUT_BASE, "w-auto py-1.5 text-sm")}
          >
            <option value="all">Etapa: Todas</option>
            {stageOptions.map((n) => (
              <option key={n} value={n}>
                {n}º Follow-up
              </option>
            ))}
          </select>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <X className="h-3.5 w-3.5" />
              Limpar filtros
            </button>
          )}
        </div>

        <p className="text-xs text-slate-400 dark:text-zinc-500">
          {rows.length} {rows.length === 1 ? "lead" : "leads"}
        </p>
      </div>

      {loading && rows.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          message={
            hasActiveFilters || filterMode !== "active"
              ? "Nenhum lead encontrado para esses filtros."
              : "Nenhum lead em follow-up no momento. Mude a Situação de um lead para \"Follow-up\" no Controle de Leads."
          }
        />
      ) : (
        <FollowUpTable
          rows={rows}
          loading={loading}
          companyName={companyName}
          canRegister={canRegister}
          scripts={scripts}
          onSelect={setSelectedLead}
        />
      )}

      <FollowUpLeadPanel
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        companyId={companyId}
        lead={selectedLead}
        scripts={scripts}
        canRegister={canRegister}
        canDelete={canDelete}
        onChanged={refreshAll}
      />

      <FollowUpScriptsConfig
        open={scriptsConfigOpen}
        onClose={() => setScriptsConfigOpen(false)}
        companyId={companyId}
        scripts={scripts}
        onChanged={loadScripts}
      />
    </section>
  );
}
