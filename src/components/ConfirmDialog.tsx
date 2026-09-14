"use client";

import { Modal } from "@/components/Modal";
import { BUTTON_DANGER, BUTTON_PRIMARY, BUTTON_SECONDARY } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <button onClick={onCancel} className={BUTTON_SECONDARY}>
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading} className={danger ? BUTTON_DANGER : BUTTON_PRIMARY}>
            {loading ? "Aguarde..." : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600 dark:text-zinc-400">{message}</p>
    </Modal>
  );
}
