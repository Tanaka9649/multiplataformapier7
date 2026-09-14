"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { QualifiedLeadFile } from "@/types/database";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { BUTTON_GHOST, BUTTON_GHOST_DANGER, CARD_SURFACE, cx, formatBytes, formatDatePtBR } from "@/lib/utils";

export function FileList({
  companyId,
  refreshKey,
}: {
  companyId: string;
  refreshKey: number;
}) {
  const supabase = createClient();
  const { showToast } = useToast();

  const [files, setFiles] = useState<QualifiedLeadFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<QualifiedLeadFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("qualified_lead_files")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setFiles(data ?? []);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Não foi possível carregar os arquivos.",
        "error"
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, refreshKey]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleOpen(f: QualifiedLeadFile) {
    setOpening(f.id);
    try {
      const { data, error } = await supabase.storage
        .from("qualified-leads")
        .createSignedUrl(f.storage_path, 60 * 5);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Não foi possível abrir o arquivo.",
        "error"
      );
    } finally {
      setOpening(null);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await supabase.storage.from("qualified-leads").remove([toDelete.storage_path]);
      const { error } = await supabase
        .from("qualified_lead_files")
        .delete()
        .eq("id", toDelete.id);
      if (error) throw error;
      showToast("Arquivo excluído.", "success");
      setToDelete(null);
      load();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Não foi possível excluir o arquivo.",
        "error"
      );
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return <EmptyState message="Nenhum arquivo enviado ainda." />;
  }

  return (
    <>
      <div className={cx(CARD_SURFACE, "overflow-hidden p-0")}>
        <ul className="divide-y divide-slate-100 dark:divide-zinc-800/70">
          {files.map((f, i) => (
            <li
              key={f.id}
              style={{ animationDelay: `${i * 30}ms` }}
              className="flex animate-fade-in-up items-center justify-between gap-4 px-4 py-3 transition-colors duration-150 hover:bg-slate-50 dark:hover:bg-zinc-800/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-zinc-200">
                  {f.original_name}
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {formatDatePtBR(f.created_at.slice(0, 10))} · {formatBytes(f.size_bytes)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button onClick={() => handleOpen(f)} disabled={opening === f.id} className={BUTTON_GHOST}>
                  <Download className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.25} />
                  {opening === f.id ? "Abrindo..." : "Abrir/baixar"}
                </button>
                <button onClick={() => setToDelete(f)} className={BUTTON_GHOST_DANGER}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.25} />
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="Excluir arquivo"
        message="Tem certeza que deseja excluir este arquivo? Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
