"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase/client";
import type { CalendarItem, CalendarItemStatus, CalendarItemType } from "@/types/database";
import {
  BUTTON_GHOST_DANGER,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  CALENDAR_STATUS_LABELS,
  CALENDAR_TYPE_LABELS,
  INPUT_BASE,
  LABEL_BASE,
  formatDateLong,
} from "@/lib/utils";

interface CalendarItemModalProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  date: string; // yyyy-mm-dd
  item: CalendarItem | null; // null = criando novo item
  onSaved: () => void;
}

const TYPE_OPTIONS: CalendarItemType[] = ["reels", "story", "post", "tarefa"];
const STATUS_OPTIONS: CalendarItemStatus[] = ["pendente", "concluido", "atrasado"];

export function CalendarItemModal({
  open,
  onClose,
  companyId,
  date,
  item,
  onSaved,
}: CalendarItemModalProps) {
  const supabase = createClient();
  const { showToast } = useToast();

  const [type, setType] = useState<CalendarItemType>("post");
  const [status, setStatus] = useState<CalendarItemStatus>("pendente");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [responsible, setResponsible] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setType(item?.type ?? "post");
      setStatus(item?.status ?? "pendente");
      setDescription(item?.description ?? "");
      setObjective(item?.objective ?? "");
      setResponsible(item?.responsible ?? "");
      setConfirmDelete(false);
    }
  }, [open, item]);

  async function handleSave() {
    setSaving(true);
    try {
      if (item) {
        const { error } = await supabase
          .from("calendar_items")
          .update({ type, status, description, objective, responsible })
          .eq("id", item.id);
        if (error) throw error;
        showToast("Item atualizado.", "success");
      } else {
        const { error } = await supabase.from("calendar_items").insert({
          company_id: companyId,
          date,
          type,
          status,
          description,
          objective,
          responsible,
        });
        if (error) throw error;
        showToast("Item adicionado.", "success");
      }
      onSaved();
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Não foi possível salvar o item.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!item) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("calendar_items").delete().eq("id", item.id);
      if (error) throw error;
      showToast("Item excluído.", "success");
      onSaved();
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Não foi possível excluir o item.",
        "error"
      );
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={formatDateLong(date)}
        footer={
          <>
            {item && (
              <button onClick={() => setConfirmDelete(true)} className={`mr-auto ${BUTTON_GHOST_DANGER}`}>
                Excluir
              </button>
            )}
            <button onClick={onClose} disabled={saving} className={BUTTON_SECONDARY}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className={BUTTON_PRIMARY}>
              {saving ? "Salvando..." : item ? "Atualizar item" : "Adicionar item"}
            </button>
          </>
        }
      >
        {item && (
          <p className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">
            Editando item existente
          </p>
        )}
        <div className="space-y-4">
          <div>
            <label className={LABEL_BASE}>Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CalendarItemType)}
              className={INPUT_BASE}
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {CALENDAR_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL_BASE}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CalendarItemStatus)}
              className={INPUT_BASE}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {CALENDAR_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL_BASE}>Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={INPUT_BASE}
            />
          </div>

          <div>
            <label className={LABEL_BASE}>Objetivo</label>
            <input
              type="text"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className={INPUT_BASE}
            />
          </div>

          <div>
            <label className={LABEL_BASE}>Responsável</label>
            <input
              type="text"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              className={INPUT_BASE}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir item"
        message="Tem certeza que deseja excluir este item do calendário? Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
