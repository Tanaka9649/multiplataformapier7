import type { LeadStatus } from "@/types/database";

export type BadgeVariant =
  | "primary"
  | "info"
  | "normal"
  | "warning"
  | "danger"
  | "success"
  | "neutral"
  | "inactive";

/**
 * Variantes semânticas compartilhadas por badges, selects compactos e pills.
 * Cada cor tem tratamento próprio para light e dark mode; nenhum estado escuro
 * depende de fundo branco ou de texto com baixo contraste.
 */
export const BADGE_VARIANT_STYLES: Record<BadgeVariant, string> = {
  primary:
    "border-brand-200/80 bg-brand-50 text-brand-800 dark:border-brand-800/60 dark:bg-brand-900/60 dark:text-brand-200",
  info:
    "border-sky-200/80 bg-sky-50 text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/55 dark:text-sky-200",
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
  inactive:
    "border-slate-200/80 bg-slate-50 text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
};

/** Mantém o conjunto enxuto: azul para fluxo, vermelho para perda e verde para ganho. */
export const LEAD_STATUS_VARIANTS: Record<LeadStatus, BadgeVariant> = {
  abandonou: "danger",
  conversando: "info",
  follow_up: "primary",
  reuniao_marcada: "primary",
  contrato_fechado: "success",
};
