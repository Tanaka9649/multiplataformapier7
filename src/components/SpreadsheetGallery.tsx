"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SpreadsheetUpload } from "@/types/database";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { BUTTON_GHOST_DANGER, CARD_SURFACE, cx, formatDatePtBR } from "@/lib/utils";

interface GalleryItem extends SpreadsheetUpload {
  signedUrl: string | null;
}

export function SpreadsheetGallery({
  companyId,
  refreshKey,
}: {
  companyId: string;
  refreshKey: number;
}) {
  const supabase = createClient();
  const { showToast } = useToast();

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<GalleryItem | null>(null);
  const [toDelete, setToDelete] = useState<GalleryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("spreadsheet_uploads")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = data ?? [];
      const withUrls: GalleryItem[] = await Promise.all(
        rows.map(async (row: SpreadsheetUpload) => {
          const { data: signed } = await supabase.storage
            .from("spreadsheet-images")
            .createSignedUrl(row.storage_path, 60 * 60);
          return { ...row, signedUrl: signed?.signedUrl ?? null };
        })
      );
      setItems(withUrls);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Não foi possível carregar os documentos.",
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

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await supabase.storage.from("spreadsheet-images").remove([toDelete.storage_path]);
      const { error } = await supabase
        .from("spreadsheet_uploads")
        .delete()
        .eq("id", toDelete.id);
      if (error) throw error;
      showToast("Documento excluído.", "success");
      setToDelete(null);
      setViewing(null);
      load();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Não foi possível excluir o documento.",
        "error"
      );
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyState message="Nenhum documento adicionado ainda." />;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, i) => (
          <button
            key={item.id}
            onClick={() => setViewing(item)}
            style={{ animationDelay: `${i * 30}ms` }}
            className={cx(
              CARD_SURFACE,
              "group animate-fade-in-up overflow-hidden p-0 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 dark:hover:border-brand-700"
            )}
          >
            <div className="aspect-video w-full overflow-hidden bg-slate-100 dark:bg-zinc-800">
              {item.signedUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.signedUrl}
                  alt={item.description ?? "Documento"}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              )}
            </div>
            <div className="p-3">
              <p className="truncate text-sm font-medium text-slate-800 dark:text-zinc-200">
                {item.description || "Sem descrição"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                {item.period_start && item.period_end
                  ? `${formatDatePtBR(item.period_start)} – ${formatDatePtBR(item.period_end)}`
                  : formatDatePtBR(item.created_at.slice(0, 10))}
              </p>
            </div>
          </button>
        ))}
      </div>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Documento"
        size="lg"
        footer={
          viewing && (
            <button onClick={() => setToDelete(viewing)} className={`mr-auto ${BUTTON_GHOST_DANGER}`}>
              Excluir
            </button>
          )
        }
      >
        {viewing?.signedUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={viewing.signedUrl}
            alt="Documento em tamanho grande"
            className="w-full rounded-lg border border-slate-200 object-contain dark:border-zinc-800"
          />
        )}
        {viewing && (
          <div className="mt-3 space-y-1 text-sm text-slate-600 dark:text-zinc-400">
            {viewing.description && <p>{viewing.description}</p>}
            {viewing.period_start && viewing.period_end && (
              <p className="text-slate-400 dark:text-zinc-500">
                Período: {formatDatePtBR(viewing.period_start)} – {formatDatePtBR(viewing.period_end)}
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Excluir documento"
        message="Tem certeza que deseja excluir este documento? Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
