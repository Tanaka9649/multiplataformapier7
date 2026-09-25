"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Plus, Search, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { SectionHeader } from "@/components/SectionHeader";
import { LeadsTable, type LeadSortKey } from "@/components/LeadsTable";
import { LeadFormModal } from "@/components/LeadFormModal";
import { LeadNotesModal } from "@/components/LeadNotesModal";
import { LeadImportModal } from "@/components/LeadImportModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import type { Lead, LeadOrigin, LeadStatus } from "@/types/database";
import { usePermissions } from "@/lib/usePermissions";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  INPUT_BASE,
  LEAD_ORIGIN_LABELS,
  LEAD_STATUS_LABELS,
  escapePostgrestValue,
  formatDatePtBR,
  cx,
} from "@/lib/utils";

const PAGE_SIZE_OPTIONS = [25, 50, 100];

type OriginFilter = "all" | LeadOrigin;
type QualificationFilter = "all" | "1" | "2" | "3" | "4" | "5";
type StatusFilter = "all" | LeadStatus;

export function LeadsControl({ companyId }: { companyId: string }) {
  const supabase = createClient();
  const { showToast } = useToast();
  const { can, isOwner } = usePermissions();
  const canAdd = isOwner || can(companyId, "leads_control", "add");
  const canEdit = isOwner || can(companyId, "leads_control", "edit");
  const canDelete = isOwner || can(companyId, "leads_control", "delete");
  const canImport = isOwner || can(companyId, "leads_control", "import");
  const canExport = isOwner || can(companyId, "leads_control", "export");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all");
  const [qualificationFilter, setQualificationFilter] = useState<QualificationFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [sortKey, setSortKey] = useState<LeadSortKey>("entry_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [notesLead, setNotesLead] = useState<Lead | null>(null);
  const [toDelete, setToDelete] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const hasActiveFilters =
    debouncedSearch.trim() !== "" || originFilter !== "all" || qualificationFilter !== "all" || statusFilter !== "all";

  useEffect(() => {
    setPage((p) => (p === 1 ? p : 1));
  }, [debouncedSearch, originFilter, qualificationFilter, statusFilter, sortKey, sortDir, pageSize, companyId]);

  const buildBaseQuery = useCallback(
    (withFilters: boolean) => {
      let query = supabase.from("leads").select("*", { count: "exact" }).eq("company_id", companyId);
      if (withFilters) {
        const term = debouncedSearch.trim();
        if (term) {
          const esc = escapePostgrestValue(term);
          query = query.or(`name.ilike.%${esc}%,phone.ilike.%${esc}%`);
        }
        if (originFilter !== "all") query = query.eq("origin", originFilter);
        if (qualificationFilter !== "all") query = query.eq("qualification", Number(qualificationFilter));
        if (statusFilter !== "all") query = query.eq("status", statusFilter);
      }
      return query;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companyId, debouncedSearch, originFilter, qualificationFilter, statusFilter]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, error, count } = await buildBaseQuery(true)
        .order(sortKey, { ascending: sortDir === "asc" })
        .range(from, to);
      if (error) throw error;
      setLeads(data ?? []);
      setTotalCount(count ?? 0);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível carregar os leads.", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildBaseQuery, sortKey, sortDir, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSort(key: LeadSortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  async function handleFieldChange(leadId: string, field: keyof Lead, value: string | number) {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, [field]: value } : l)));
    setSaveStatus("saving");
    try {
      const { error } = await supabase.from("leads").update({ [field]: value }).eq("id", leadId);
      if (error) throw error;
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível salvar a alteração.", "error");
      setSaveStatus("idle");
      load();
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("leads").delete().eq("id", toDelete.id);
      if (error) throw error;
      showToast("Lead excluído.", "success");
      setToDelete(null);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível excluir o lead.", "error");
    } finally {
      setDeleting(false);
    }
  }

  function clearFilters() {
    setSearchInput("");
    setOriginFilter("all");
    setQualificationFilter("all");
    setStatusFilter("all");
  }

  async function handleExport(format: "xlsx" | "csv", withFilters: boolean) {
    setExportMenuOpen(false);
    try {
      const XLSX = await import("xlsx");
      const { data, error } = await buildBaseQuery(withFilters)
        .order(sortKey, { ascending: sortDir === "asc" })
        .limit(20000);
      if (error) throw error;
      const rows = (data ?? []) as Lead[];
      if (rows.length === 0) {
        showToast("Nenhum lead para exportar.", "error");
        return;
      }
      const exportData = rows.map((r) => ({
        "Data de entrada": formatDatePtBR(r.entry_date),
        Nome: r.name,
        Telefone: r.phone,
        "Serviço de interesse": r.service_interest,
        Origem: LEAD_ORIGIN_LABELS[r.origin],
        Responsável: r.responsible,
        Qualificação: r.qualification,
        Situação: LEAD_STATUS_LABELS[r.status],
        Observações: r.notes,
      }));
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
      const filename = `leads-${new Date().toISOString().slice(0, 10)}.${format}`;
      if (format === "xlsx") {
        XLSX.writeFile(workbook, filename);
      } else {
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      showToast(`${rows.length} leads exportados.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível exportar os leads.", "error");
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const countLabel = useMemo(() => {
    if (hasActiveFilters) return `${totalCount} de ${totalCount} leads`;
    return `${totalCount} ${totalCount === 1 ? "lead" : "leads"}`;
  }, [totalCount, hasActiveFilters]);

  return (
    <section>
      <SectionHeader
        title="Controle de Leads"
        action={
          <div className="flex items-center gap-3">
            {saveStatus !== "idle" && (
              <span className="animate-fade-in text-xs text-slate-400 dark:text-zinc-500">
                {saveStatus === "saving" ? "Salvando..." : "Salvo"}
              </span>
            )}
            {canAdd && <button onClick={() => setFormOpen(true)} className={BUTTON_PRIMARY}>
              <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.25} />
              Adicionar lead
            </button>}
          </div>
        }
      />

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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value as OriginFilter)}
              className={cx(INPUT_BASE, "w-auto py-1.5 text-sm")}
            >
              <option value="all">Origem: Todas</option>
              {(Object.keys(LEAD_ORIGIN_LABELS) as LeadOrigin[]).map((o) => (
                <option key={o} value={o}>
                  {LEAD_ORIGIN_LABELS[o]}
                </option>
              ))}
            </select>
            <select
              value={qualificationFilter}
              onChange={(e) => setQualificationFilter(e.target.value as QualificationFilter)}
              className={cx(INPUT_BASE, "w-auto py-1.5 text-sm")}
            >
              <option value="all">Qualificação: Todas</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={String(n)}>
                  {n} {n === 1 ? "estrela" : "estrelas"}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className={cx(INPUT_BASE, "w-auto py-1.5 text-sm")}
            >
              <option value="all">Situação: Todas</option>
              {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS_LABELS[s]}
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

          <div className="flex items-center gap-2">
            {canImport && <button onClick={() => setImportOpen(true)} className={BUTTON_SECONDARY}>
              <Upload className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.25} />
              Importar
            </button>}
            {canExport && <div className="relative">
              <button onClick={() => setExportMenuOpen((v) => !v)} className={BUTTON_SECONDARY}>
                <Download className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.25} />
                Exportar
              </button>
              {exportMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setExportMenuOpen(false)} />
                  <div className="absolute right-0 top-9 z-20 w-56 animate-fade-in rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                      Resultados filtrados
                    </p>
                    <button
                      onClick={() => handleExport("xlsx", true)}
                      className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs text-slate-600 transition-colors hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Excel (.xlsx)
                    </button>
                    <button
                      onClick={() => handleExport("csv", true)}
                      className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs text-slate-600 transition-colors hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      CSV
                    </button>
                    <div className="my-1 h-px bg-slate-100 dark:bg-zinc-800" />
                    <p className="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                      Todos os leads
                    </p>
                    <button
                      onClick={() => handleExport("xlsx", false)}
                      className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs text-slate-600 transition-colors hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Excel (.xlsx)
                    </button>
                    <button
                      onClick={() => handleExport("csv", false)}
                      className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs text-slate-600 transition-colors hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      CSV
                    </button>
                  </div>
                </>
              )}
            </div>}
          </div>
        </div>

        <p className="text-xs text-slate-400 dark:text-zinc-500">{countLabel}</p>
      </div>

      {loading && leads.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <EmptyState message={hasActiveFilters ? "Nenhum lead encontrado para esses filtros." : "Nenhum lead cadastrado ainda."} />
      ) : (
        <>
          <LeadsTable
            leads={leads}
            loading={loading}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            onFieldChange={handleFieldChange}
            onOpenNotes={setNotesLead}
            onDeleteRequest={setToDelete}
            canEdit={canEdit}
            canDelete={canDelete}
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className={cx(INPUT_BASE, "w-auto py-1.5 text-xs")}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} por página
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {canAdd && <LeadFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        companyId={companyId}
        onCreated={() => load()}
      />}

      {canImport && <LeadImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        companyId={companyId}
        onImported={() => load()}
      />}

      {canEdit && <LeadNotesModal
        open={!!notesLead}
        onClose={() => setNotesLead(null)}
        leadId={notesLead?.id ?? null}
        leadName={notesLead?.name ?? ""}
        initialNotes={notesLead?.notes ?? ""}
        onSaved={(leadId, notes) => {
          setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, notes } : l)));
        }}
      />}

      {canDelete && <ConfirmDialog
        open={!!toDelete}
        title="Excluir este lead?"
        message="Essa ação não poderá ser desfeita."
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />}
    </section>
  );
}
