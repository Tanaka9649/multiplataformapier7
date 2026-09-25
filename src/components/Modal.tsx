"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cx } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export function Modal({ open, onClose, title, children, footer, size = "md" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 animate-fade-in bg-slate-900/40 backdrop-blur-[2px] dark:bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "relative z-10 max-h-[90vh] w-full animate-modal-in overflow-y-auto rounded-2xl border border-slate-200/70 bg-white p-6 shadow-xl dark:border-zinc-800/70 dark:bg-zinc-900 dark:shadow-2xl",
          size === "sm" && "max-w-sm",
          size === "md" && "max-w-lg",
          size === "lg" && "max-w-2xl"
        )}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-50">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-slate-400 transition-all duration-150 hover:bg-slate-100 hover:text-slate-600 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 dark:focus-visible:ring-brand-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
