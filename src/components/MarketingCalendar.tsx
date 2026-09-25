"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Company, CalendarItem } from "@/types/database";
import { CalendarItemModal } from "@/components/CalendarItemModal";
import { Modal } from "@/components/Modal";
import { SectionHeader } from "@/components/SectionHeader";
import { useToast } from "@/components/Toast";
import {
  BUTTON_PRIMARY,
  CALENDAR_STATUS_DOT,
  CALENDAR_STATUS_LABELS,
  CALENDAR_TYPE_COLORS,
  CALENDAR_TYPE_LABELS,
  CARD_SURFACE,
  cx,
  formatDateLong,
} from "@/lib/utils";

const WEEKDAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function toISODate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function CalendarItemButton({ item, onClick }: { item: CalendarItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      title={item.title}
      className={cx(
        "w-full rounded-lg border px-2 py-1.5 text-left transition-transform duration-150 hover:brightness-95 active:scale-[0.98] dark:hover:brightness-110",
        CALENDAR_TYPE_COLORS[item.type]
      )}
    >
      <span className="block truncate text-xs font-semibold">{item.title}</span>
      <span className="mt-0.5 flex items-center gap-1 truncate text-[10px] opacity-80">
        <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", CALENDAR_STATUS_DOT[item.status])} />
        {CALENDAR_TYPE_LABELS[item.type]} · {CALENDAR_STATUS_LABELS[item.status]}
      </span>
      {item.responsible && (
        <span className="mt-0.5 block truncate text-[10px] opacity-70">{item.responsible}</span>
      )}
    </button>
  );
}

export function MarketingCalendar({ company }: { company: Company }) {
  const supabase = createClient();
  const { showToast } = useToast();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [modalItem, setModalItem] = useState<CalendarItem | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rangeStart = toISODate(new Date(year, month, 1));
      const rangeEnd = toISODate(new Date(year, month + 1, 1));
      const { data, error } = await supabase
        .from("calendar_items")
        .select("*")
        .eq("company_id", company.id)
        .gte("date", rangeStart)
        .lt("date", rangeEnd)
        .order("date", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      setItems(data ?? []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível carregar o calendário.", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id, year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) map.set(item.date, [...(map.get(item.date) ?? []), item]);
    return map;
  }, [items]);

  const populatedDates = useMemo(() => [...itemsByDate.keys()].sort(), [itemsByDate]);
  const cells = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const total = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    return Array.from({ length: total }, (_, index) => {
      const day = index - firstWeekday + 1;
      return day < 1 || day > daysInMonth
        ? { day: null, date: null }
        : { day, date: toISODate(new Date(year, month, day)) };
    });
  }, [year, month]);

  function openCreate(date: string) {
    setExpandedDate(null);
    setModalDate(date);
    setModalItem(null);
  }

  function openEdit(item: CalendarItem) {
    setExpandedDate(null);
    setModalDate(item.date);
    setModalItem(item);
  }

  const defaultCreationDate = useMemo(() => {
    const today = new Date();
    return today.getFullYear() === year && today.getMonth() === month
      ? toISODate(today)
      : toISODate(new Date(year, month, 1));
  }, [year, month]);

  const monthNavigation = (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Mês anterior" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:focus-visible:ring-brand-500">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[136px] text-center text-sm font-medium text-slate-700 dark:text-zinc-300">{MONTH_LABELS[month]} de {year}</span>
      <button type="button" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Próximo mês" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:focus-visible:ring-brand-500">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <section>
      <SectionHeader title="Calendário" action={monthNavigation} />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="hidden flex-wrap gap-2 text-xs text-slate-500 sm:flex dark:text-zinc-400">
          {(Object.keys(CALENDAR_TYPE_LABELS) as (keyof typeof CALENDAR_TYPE_LABELS)[]).map((type) => (
            <span key={type} className={cx("rounded-full border px-2 py-0.5", CALENDAR_TYPE_COLORS[type])}>{CALENDAR_TYPE_LABELS[type]}</span>
          ))}
        </div>
        <button type="button" onClick={() => openCreate(defaultCreationDate)} className={cx(BUTTON_PRIMARY, "ml-auto gap-2 px-3")}>
          <CalendarPlus className="h-4 w-4" /> Novo item
        </button>
      </div>

      <div className={cx(CARD_SURFACE, "hidden overflow-hidden p-0 md:block")}>
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60 text-center text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:border-zinc-800/70 dark:bg-zinc-950/40 dark:text-zinc-500">
          {WEEKDAY_LABELS.map((weekday) => <div key={weekday} className="py-2.5">{weekday}</div>)}
        </div>
        <div className={cx("grid grid-cols-7 transition-opacity", loading && "opacity-50")}>
          {cells.map((cell, index) => {
            const dayItems = cell.date ? itemsByDate.get(cell.date) ?? [] : [];
            return (
              <div
                key={`${cell.date ?? "empty"}-${index}`}
                onClick={() => cell.date && openCreate(cell.date)}
                className={cx(
                  "min-h-[172px] border-b border-r border-slate-100 p-2.5 transition-colors dark:border-zinc-800/70 xl:min-h-[190px]",
                  cell.date ? "cursor-pointer hover:bg-slate-50/80 dark:hover:bg-zinc-800/30" : "bg-slate-50/30 dark:bg-zinc-950/30",
                  index % 7 === 6 && "border-r-0"
                )}
              >
                {cell.day && cell.date && (
                  <>
                    <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-zinc-400">{cell.day}</p>
                    <div className="space-y-1.5">
                      {dayItems.slice(0, 3).map((item) => <CalendarItemButton key={item.id} item={item} onClick={() => openEdit(item)} />)}
                      {dayItems.length > 3 && (
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); setExpandedDate(cell.date); }}
                          className="w-full rounded-md px-2 py-1 text-left text-[11px] font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-900/30"
                        >
                          +{dayItems.length - 3} {dayItems.length === 4 ? "item" : "itens"}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={cx("space-y-3 transition-opacity md:hidden", loading && "opacity-50")}>
        {!loading && populatedDates.length === 0 && (
          <div className={cx(CARD_SURFACE, "p-8 text-center")}>
            <CalendarPlus className="mx-auto mb-3 h-7 w-7 text-slate-300 dark:text-zinc-600" />
            <p className="text-sm text-slate-500 dark:text-zinc-400">Nenhum item neste mês.</p>
            <button type="button" onClick={() => openCreate(defaultCreationDate)} className="mt-3 text-sm font-semibold text-brand-700 dark:text-brand-300">Adicionar o primeiro item</button>
          </div>
        )}
        {populatedDates.map((date) => (
          <article key={date} className={cx(CARD_SURFACE, "p-3")}>
            <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-zinc-800">
              <h3 className="text-sm font-semibold capitalize text-slate-800 dark:text-zinc-100">{formatDateLong(date)}</h3>
              <button type="button" onClick={() => openCreate(date)} aria-label={`Adicionar item em ${formatDateLong(date)}`} className="rounded-lg p-1.5 text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-900/30">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              {(itemsByDate.get(date) ?? []).map((item) => <CalendarItemButton key={item.id} item={item} onClick={() => openEdit(item)} />)}
            </div>
          </article>
        ))}
      </div>

      {expandedDate && (
        <Modal open onClose={() => setExpandedDate(null)} title={formatDateLong(expandedDate)} size="lg" footer={
          <button type="button" onClick={() => openCreate(expandedDate)} className={cx(BUTTON_PRIMARY, "gap-2")}><Plus className="h-4 w-4" /> Adicionar item</button>
        }>
          <div className="grid gap-2 sm:grid-cols-2">
            {(itemsByDate.get(expandedDate) ?? []).map((item) => <CalendarItemButton key={item.id} item={item} onClick={() => openEdit(item)} />)}
          </div>
        </Modal>
      )}

      {modalDate && (
        <CalendarItemModal
          open
          onClose={() => { setModalDate(null); setModalItem(null); }}
          companyId={company.id}
          date={modalDate}
          item={modalItem}
          onSaved={load}
        />
      )}
    </section>
  );
}
