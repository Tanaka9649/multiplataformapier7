"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { StarRating } from "@/components/StarRating";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase/client";
import type { Lead, LeadOrigin, LeadStatus } from "@/types/database";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  INPUT_BASE,
  LABEL_BASE,
  LEAD_ORIGIN_LABELS,
  LEAD_STATUS_LABELS,
  cx,
  formatPhoneBR,
} from "@/lib/utils";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

interface LeadFormModalProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  onCreated: (lead: Lead) => void;
}

export function LeadFormModal({ open, onClose, companyId, onCreated }: LeadFormModalProps) {
  const supabase = createClient();
  const { showToast } = useToast();

  const [entryDate, setEntryDate] = useState(todayISO());
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceInterest, setServiceInterest] = useState("");
  const [origin, setOrigin] = useState<LeadOrigin>("instagram");
  const [responsible, setResponsible] = useState("");
  const [qualification, setQualification] = useState(3);
  const [status, setStatus] = useState<LeadStatus>("conversando");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEntryDate(todayISO());
      setName("");
      setPhone("");
      setServiceInterest("");
      setOrigin("instagram");
      setResponsible("");
      setQualification(3);
      setStatus("conversando");
      setNotes("");
    }
  }, [open]);

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast("Informe o nome do lead.", "error");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .insert({
          company_id: companyId,
          entry_date: entryDate,
          name: trimmedName,
          phone,
          service_interest: serviceInterest,
          origin,
          responsible,
          qualification,
          status,
          notes,
        })
        .select()
        .single();
      if (error) throw error;
      showToast("Lead adicionado.", "success");
      onCreated(data as Lead);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível adicionar o lead.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adicionar lead"
      size="lg"
      footer={
        <>
          <button onClick={onClose} disabled={saving} className={BUTTON_SECONDARY}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className={BUTTON_PRIMARY}>
            {saving ? "Salvando..." : "Adicionar lead"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL_BASE}>Data de entrada</label>
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className={INPUT_BASE}
          />
        </div>
        <div>
          <label className={LABEL_BASE}>Nome</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={INPUT_BASE}
            placeholder="Nome do lead"
          />
        </div>
        <div>
          <label className={LABEL_BASE}>Telefone</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(formatPhoneBR(e.target.value))}
            className={INPUT_BASE}
            placeholder="(34) 99999-9999"
          />
        </div>
        <div>
          <label className={LABEL_BASE}>Serviço de interesse</label>
          <input
            type="text"
            value={serviceInterest}
            onChange={(e) => setServiceInterest(e.target.value)}
            className={INPUT_BASE}
          />
        </div>
        <div>
          <label className={LABEL_BASE}>Origem</label>
          <select value={origin} onChange={(e) => setOrigin(e.target.value as LeadOrigin)} className={INPUT_BASE}>
            {(Object.keys(LEAD_ORIGIN_LABELS) as LeadOrigin[]).map((o) => (
              <option key={o} value={o}>
                {LEAD_ORIGIN_LABELS[o]}
              </option>
            ))}
          </select>
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
        <div>
          <label className={LABEL_BASE}>Qualificação</label>
          <div className={cx(INPUT_BASE, "flex items-center")}>
            <StarRating value={qualification} onChange={setQualification} size="md" />
          </div>
        </div>
        <div>
          <label className={LABEL_BASE}>Situação</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)} className={INPUT_BASE}>
            {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL_BASE}>Observações</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={cx(INPUT_BASE, "resize-none")}
          />
        </div>
      </div>
    </Modal>
  );
}
