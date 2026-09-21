"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase/client";
import type { FollowUpScript } from "@/types/database";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT_BASE, LABEL_BASE, cx, stageLabel } from "@/lib/utils";

interface FollowUpScriptsConfigProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  scripts: FollowUpScript[];
  onChanged: () => void;
}

const emptyForm = {
  id: "" as string | null,
  serviceInterest: "",
  stage: 1,
  content: "",
  active: true,
};

export function FollowUpScriptsConfig({ open, onClose, companyId, scripts, onChanged }: FollowUpScriptsConfigProps) {
  const supabase = createClient();
  const { showToast } = useToast();

  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<FollowUpScript | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(emptyForm);
      setEditing(false);
    }
  }, [open]);

  function startEdit(script: FollowUpScript) {
    setForm({
      id: script.id,
      serviceInterest: script.service_interest ?? "",
      stage: script.stage_number,
      content: script.content,
      active: script.active,
    });
    setEditing(true);
  }

  async function handleSave() {
    if (!form.content.trim()) {
      showToast("Escreva o texto do script.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        company_id: companyId,
        service_interest: form.serviceInterest.trim() || null,
        stage_number: form.stage,
        content: form.content,
        active: form.active,
      };
      const { error } = form.id
        ? await supabase.from("follow_up_scripts").update(payload).eq("id", form.id)
        : await supabase.from("follow_up_scripts").insert(payload);
      if (error) {
        if (error.code === "23505") {
          throw new Error("Já existe um script ativo para essa etapa e serviço nesta empresa.");
        }
        throw error;
      }
      showToast(form.id ? "Script atualizado." : "Script criado.", "success");
      setForm(emptyForm);
      setEditing(false);
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível salvar o script.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("follow_up_scripts").delete().eq("id", toDelete.id);
      if (error) throw error;
      showToast("Script excluído.", "success");
      setToDelete(null);
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível excluir o script.", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Configurar scripts de follow-up" size="lg">
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200/70 p-4 dark:border-zinc-800/70">
          <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-zinc-100">
            {editing ? "Editar script" : "Novo script"}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL_BASE}>Etapa</label>
              <select
                value={form.stage}
                onChange={(e) => setForm((f) => ({ ...f, stage: Number(e.target.value) }))}
                className={INPUT_BASE}
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {stageLabel(n)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_BASE}>Serviço (opcional)</label>
              <input
                type="text"
                value={form.serviceInterest}
                onChange={(e) => setForm((f) => ({ ...f, serviceInterest: e.target.value }))}
                placeholder="Vazio = script padrão da etapa"
                className={INPUT_BASE}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL_BASE}>Texto do script</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={4}
                className={cx(INPUT_BASE, "resize-none")}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 dark:border-zinc-700"
              />
              Ativo
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            {editing && (
              <button
                onClick={() => {
                  setForm(emptyForm);
                  setEditing(false);
                }}
                className={BUTTON_SECONDARY}
              >
                Cancelar edição
              </button>
            )}
            <button onClick={handleSave} disabled={saving} className={BUTTON_PRIMARY}>
              <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.25} />
              {saving ? "Salvando..." : editing ? "Salvar alterações" : "Adicionar script"}
            </button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-zinc-100">Scripts cadastrados</p>
          {scripts.length === 0 ? (
            <EmptyState message="Nenhum script cadastrado ainda." />
          ) : (
            <div className="space-y-2">
              {scripts.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-zinc-800"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                      {stageLabel(s.stage_number)} · {s.service_interest || "Padrão da etapa"}
                      {!s.active && <span className="ml-1.5 text-slate-400 dark:text-zinc-500">(inativo)</span>}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-slate-500 dark:text-zinc-400">{s.content}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => startEdit(s)}
                      aria-label="Editar script"
                      className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setToDelete(s)}
                      aria-label="Excluir script"
                      className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-zinc-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="Excluir este script?"
        message="Essa ação não poderá ser desfeita."
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </Modal>
  );
}
