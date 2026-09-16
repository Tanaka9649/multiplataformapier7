"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { SocialContentCard } from "@/components/social/SocialContentCard";
import { SocialContentModal } from "@/components/social/SocialContentModal";
import type { SocialNetwork, SocialTopContent } from "@/types/database";
import { BUTTON_PRIMARY } from "@/lib/utils";

interface SocialTopContentsProps {
  companyId: string;
  network: SocialNetwork;
  year: number;
  month: number;
}

export function SocialTopContents({ companyId, network, year, month }: SocialTopContentsProps) {
  const supabase = createClient();
  const { showToast } = useToast();

  const [items, setItems] = useState<SocialTopContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SocialTopContent | null>(null);
  const [toDelete, setToDelete] = useState<SocialTopContent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("social_top_contents")
        .select("*")
        .eq("company_id", companyId)
        .eq("network", network)
        .eq("year", year)
        .eq("month", month)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      setItems(data ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível carregar os conteúdos.", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, network, year, month]);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(item: SocialTopContent) {
    setEditing(item);
    setModalOpen(true);
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      if (toDelete.thumbnail_storage_path) {
        await supabase.storage.from("social-content").remove([toDelete.thumbnail_storage_path]);
      }
      const { error } = await supabase.from("social_top_contents").delete().eq("id", toDelete.id);
      if (error) throw error;
      showToast("Conteúdo excluído.", "success");
      setToDelete(null);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível excluir o conteúdo.", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const a = items[index];
    const b = items[target];
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    try {
      await supabase.from("social_top_contents").update({ sort_order: b.sort_order }).eq("id", a.id);
      await supabase.from("social_top_contents").update({ sort_order: a.sort_order }).eq("id", b.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível reordenar.", "error");
      load();
    }
  }

  const nextSortOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;

  return (
    <section className="mt-8">
      <SectionHeader
        title="Conteúdos com melhor resultado"
        action={
          <button onClick={openAdd} className={BUTTON_PRIMARY}>
            <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.25} />
            Adicionar conteúdo
          </button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState message="Nenhum conteúdo adicionado ainda para este período." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <div key={item.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
              <SocialContentCard
                content={item}
                canMoveUp={i > 0}
                canMoveDown={i < items.length - 1}
                onEdit={() => openEdit(item)}
                onDelete={() => setToDelete(item)}
                onMoveUp={() => handleMove(i, -1)}
                onMoveDown={() => handleMove(i, 1)}
              />
            </div>
          ))}
        </div>
      )}

      <SocialContentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        network={network}
        year={year}
        month={month}
        existing={editing}
        nextSortOrder={nextSortOrder}
        onSaved={load}
      />

      <ConfirmDialog
        open={!!toDelete}
        title="Excluir conteúdo"
        message="Tem certeza que deseja excluir este conteúdo? Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </section>
  );
}
