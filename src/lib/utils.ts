import type { CalendarItemStatus, CalendarItemType, MetricFormat } from "@/types/database";

export function formatMetricValue(value: number, format: MetricFormat): string {
  if (format === "currency") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 2,
    }).format(value);
  }
  if (format === "percentage") {
    return new Intl.NumberFormat("pt-BR", {
      style: "percent",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value / 100);
  }
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(
    Math.round(value)
  );
}

export function formatDatePtBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

export function formatDateShortPtBR(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(d);
}

export function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" }).format(d);
}

export function formatDateTimePtBR(isoStr: string): string {
  const d = new Date(isoStr);
  const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(d);
  return `${date} às ${time}`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export const CALENDAR_TYPE_LABELS: Record<CalendarItemType, string> = {
  reels: "Vídeo para Reels",
  story: "Story",
  post: "Post estático",
  tarefa: "Tarefa",
};

export const CALENDAR_TYPE_COLORS: Record<CalendarItemType, string> = {
  reels: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800/60",
  story: "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-950/50 dark:text-pink-300 dark:border-pink-800/60",
  post: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/60",
  tarefa: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60",
};

export const CALENDAR_STATUS_LABELS: Record<CalendarItemStatus, string> = {
  pendente: "Pendente",
  concluido: "Concluído",
  atrasado: "Atrasado",
};

export const CALENDAR_STATUS_DOT: Record<CalendarItemStatus, string> = {
  pendente: "bg-amber-500",
  concluido: "bg-emerald-500",
  atrasado: "bg-red-500",
};

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function uniqueFileName(originalName: string): string {
  const ext = originalName.includes(".") ? originalName.split(".").pop() : "";
  const base = crypto.randomUUID();
  return ext ? `${base}.${ext}` : base;
}

/**
 * Design system compartilhado — dark mode usa a família "zinc" (cinza
 * neutro / grafite) em vez de "slate" (que tem viés azulado) para dar a
 * sensação de grafite pedida, sem preto quase absoluto. Light mode
 * continua em slate, que já lê como um cinza levemente frio e elegante.
 */
export const CARD_SURFACE =
  "rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-zinc-800/70 dark:bg-zinc-900 dark:shadow-none";

export const PANEL_SURFACE =
  "border-slate-200/70 bg-white dark:border-zinc-800/70 dark:bg-zinc-950";

export const BUTTON_PRIMARY =
  "inline-flex items-center justify-center rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-brand-800 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-600 dark:hover:bg-brand-500";

export const BUTTON_SECONDARY =
  "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all duration-150 hover:bg-slate-50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800";

export const BUTTON_DANGER =
  "inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-red-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-600 dark:hover:bg-red-500";

export const BUTTON_GHOST_DANGER =
  "inline-flex items-center justify-center rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-all duration-150 hover:bg-red-50 active:scale-[0.97] dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40";

export const BUTTON_GHOST =
  "inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-all duration-150 hover:bg-slate-50 active:scale-[0.97] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

export const INPUT_BASE =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-400 dark:focus:ring-brand-900/40";

export const LABEL_BASE = "mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300";

export const LEAD_ORIGIN_LABELS: Record<import("@/types/database").LeadOrigin, string> = {
  instagram: "Instagram",
  evento: "Evento",
  prospeccao: "Prospecção",
  trafego_pago: "Tráfego pago",
};

export const LEAD_STATUS_LABELS: Record<import("@/types/database").LeadStatus, string> = {
  abandonou: "Abandonou",
  conversando: "Conversando",
  reuniao_marcada: "Reunião marcada",
  contrato_fechado: "Contrato fechado",
};

export const LEAD_STATUS_BADGE: Record<import("@/types/database").LeadStatus, string> = {
  abandonou:
    "bg-rose-50 text-rose-700 border-rose-200/70 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40",
  conversando:
    "bg-sky-50 text-sky-700 border-sky-200/70 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/40",
  reuniao_marcada:
    "bg-violet-50 text-violet-700 border-violet-200/70 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-900/40",
  contrato_fechado:
    "bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40",
};

/** Formata dígitos como telefone brasileiro (fixo ou celular) sem
 *  bloquear outros formatos — usado só como máscara visual ao digitar. */
export function formatPhoneBR(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Escapa vírgula e parênteses antes de colocar um valor dentro de um
 *  filtro .or() do PostgREST, já que esses caracteres têm significado
 *  estrutural na sintaxe do filtro (e telefones formatados usam
 *  parênteses). */
export function escapePostgrestValue(value: string): string {
  return value.replace(/[,()]/g, (c) => `\\${c}`);
}
