import type { ReactNode } from "react";
import { cx } from "@/lib/utils";

export type StatusBadgeVariant = "normal" | "warning" | "danger" | "success" | "neutral";

const VARIANT_STYLES: Record<StatusBadgeVariant, string> = {
  normal:
    "border-sky-200/80 bg-sky-50 text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/55 dark:text-sky-200",
  warning:
    "border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/55 dark:text-amber-200",
  danger:
    "border-rose-200/80 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/55 dark:text-rose-200",
  success:
    "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/55 dark:text-emerald-200",
  neutral:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-zinc-700/80 dark:bg-zinc-800 dark:text-zinc-300",
};

interface StatusBadgeProps {
  children: ReactNode;
  variant?: StatusBadgeVariant;
  className?: string;
}

/** Badge informativo compartilhado. Sem hover para não sugerir interação. */
export function StatusBadge({ children, variant = "neutral", className }: StatusBadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-medium leading-4",
        VARIANT_STYLES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
