"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Save } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase/client";
import type { FollowUpPlaybook } from "@/types/database";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT_BASE, LABEL_BASE, cx, pickFollowUpPlaybook } from "@/lib/utils";

interface FollowUpPlaybookPanelProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  companyName: string;
  playbooks: FollowUpPlaybook[];
  services: string[];
  canEdit: boolean;
  onChanged: () => Promise<void> | void;
}

export function FollowUpPlaybookPanel({
  open, onClose, companyId, companyName, playbooks, services, canEdit, onChanged,
}: FollowUpPlaybookPanelProps) {
  const supabase = createClient();
  const { showToast } = useToast();
  const [service, setService] = useState("");
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = useMemo(() => pickFollowUpPlaybook(playbooks, service), [playbooks, service]);
  const exact = useMemo(
    () => playbooks.find((item) => item.active && (item.service_interest ?? "").trim().toLowerCase() === service.trim().toLowerCase()) ?? null,
    [playbooks, service]
  );
  const isFallback = !!service && !!selected && !exact;

  useEffect(() => {
    if (!open) return;
    setEditing(false);
    setContent(selected?.content ?? "");
  }, [open, service, selected?.id, selected?.content]);

  function startEditing() {
    setContent(selected?.content ?? "");
    setEditing(true);
  }

  async function save() {
    if (!content.trim()) {
      showToast("Escreva a sequência de follow-up.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        company_id: companyId,
        service_interest: service.trim() || null,
        content,
        active: true,
      };
      const { error } = exact
        ? await supabase.from("follow_up_playbooks").update(payload).eq("id", exact.id)
        : await supabase.from("follow_up_playbooks").insert(payload);
      if (error) {
        if (error.code === "23505") throw new Error("Já existe uma sequência ativa para esta empresa e serviço.");
        throw error;
      }
      await onChanged();
      setEditing(false);
      showToast("Sequência de follow-up salva.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível salvar a sequência.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={() => !saving && onClose()} title="Sequência de Follow-up" size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-[240px] flex-1">
            <label className={LABEL_BASE}>Empresa e serviço</label>
            <p className="mb-2 text-sm font-medium text-slate-800 dark:text-zinc-100">{companyName}</p>
            <select value={service} onChange={(event) => setService(event.target.value)} className={INPUT_BASE}>
              <option value="">Playbook geral da empresa</option>
              {services.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          {canEdit && !editing && (
            <button onClick={startEditing} className={BUTTON_SECONDARY}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {exact ? "Editar sequência" : service ? "Criar versão específica" : "Criar sequência"}
            </button>
          )}
        </div>

        {isFallback && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-zinc-900 dark:text-zinc-400">
            Não há uma versão específica para este serviço. Exibindo o playbook geral da empresa.
          </p>
        )}

        {editing ? (
          <div>
            <label className={LABEL_BASE}>Texto da sequência</label>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={18}
              placeholder={"1º FOLLOW-UP\nPesquisar sobre a empresa...\n\n2º FOLLOW-UP\nRealizar ligação..."}
              className={cx(INPUT_BASE, "resize-y font-sans leading-relaxed")}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setEditing(false)} disabled={saving} className={BUTTON_SECONDARY}>Cancelar</button>
              <button onClick={save} disabled={saving} className={BUTTON_PRIMARY}>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        ) : selected ? (
          <div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/60 p-5 text-sm leading-relaxed text-slate-700 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
            {selected.content}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-zinc-700 dark:text-zinc-500">
            Nenhuma sequência cadastrada para esta empresa.
          </div>
        )}
      </div>
    </Modal>
  );
}
