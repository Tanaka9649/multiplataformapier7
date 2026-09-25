import type { FollowUpResult } from "@/types/database";
import type { BadgeVariant } from "@/lib/uiVariants";

export const FOLLOW_UP_RESULT_LABELS: Record<FollowUpResult, string> = {
  no_answer: "Não respondeu",
  responded: "Respondeu",
  interested: "Demonstrou interesse",
  meeting_scheduled: "Reunião marcada",
  no_interest: "Sem interesse",
};

export function isWeekend(date = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
  return weekday === "Sat" || weekday === "Sun";
}

export function formatFollowUpMoment(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

export function formatRelativeDeadline(iso: string | null) {
  if (!iso) return "Sem prazo";
  if (isWeekend()) return "Pausado no fim de semana";
  const diff = new Date(iso).getTime() - Date.now();
  const overdue = diff < 0;
  const absoluteMinutes = Math.max(1, Math.round(Math.abs(diff) / 60000));
  const days = Math.floor(absoluteMinutes / 1440);
  const hours = Math.floor((absoluteMinutes % 1440) / 60);
  const minutes = absoluteMinutes % 60;
  const parts = [days ? `${days}d` : "", hours ? `${hours}h` : "", !days && minutes ? `${minutes}min` : ""].filter(Boolean);
  return overdue ? `Atrasado há ${parts.join(" ")}` : `Vence em ${parts.join(" ")}`;
}

/** Classifica somente a apresentação do prazo; não altera a cadência nem o cálculo exibido. */
export function getDeadlineBadgeVariant(iso: string | null): BadgeVariant {
  if (!iso || isWeekend()) return "neutral";
  const remainingMs = new Date(iso).getTime() - Date.now();
  if (remainingMs < 0) return "danger";
  if (remainingMs <= 2 * 60 * 60 * 1000) return "warning";
  return "normal";
}
