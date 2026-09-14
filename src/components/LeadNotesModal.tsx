"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase/client";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT_BASE, LABEL_BASE, cx } from "@/lib/utils";

interface LeadNotesModalProps {
  open: boolean;
  onClose: () => void;
  leadId: string | null;
  leadName: string;
  initialNotes: string;
  onSaved: (leadId: string, notes: string) => void;
}

export function LeadNotesModal({
  open,
  onClose,
  leadId,
  leadName,
  initialNotes,
  onSaved,
}: LeadNotesModalProps) {
  const supabase = createClient();
  const { showToast } = useToast();
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setNotes(initialNotes);
  }, [open, initialNotes]);

  async function handleSave() {
    if (!leadId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("leads").update({ notes }).eq("id", leadId);
      if (error) throw error;
      onSaved(leadId, notes);
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Não foi possível salvar a observação.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={leadName ? `Observações — ${leadName}` : "Observações"}
      footer={
        <>
          <button onClick={onClose} disabled={saving} className={BUTTON_SECONDARY}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className={BUTTON_PRIMARY}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </>
      }
    >
      <label className={LABEL_BASE}>Observações sobre o lead</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={8}
        placeholder="Ex.: Cliente demonstrou interesse em..."
        className={cx(INPUT_BASE, "resize-none")}
      />
    </Modal>
  );
}
