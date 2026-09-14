"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Company, CalendarItem } from "@/types/database";
import { CalendarItemModal } from "@/components/CalendarItemModal";
import { SectionHeader } from "@/components/SectionHeader";
import { useToast } from "@/components/Toast";
import {
  CALENDAR_STATUS_DOT,
  CALENDAR_TYPE_COLORS,
  CALENDAR_TYPE_LABELS,
  CARD_SURFACE,
  cx,
} from "@/lib/utils";

const WEEKDAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
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
        .order("date", { ascending: true });
      if (error) throw error;
      setItems(data ?? []);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Não foi possível carregar o calendário.",
        "error"
      );
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
    for (const item of items) {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    return map;
  }, [items]);

  const cells = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const total = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    const list: { day: number | null; date: string | null }[] = [];
    for (let i = 0; i < total; i++) {
      const day = i - firstWeekday + 1;
      if (day < 1 || day > daysInMonth) {
        list.push({ day: null, date: null });
      } else {
        list.push({ day, date: toISODate(new Date(year, month, day)) });
      }
    }
    return list;
  }, [year, month]);

  function openCreate(date: string) {
    setModalDate(date);
    setModalItem(null);
  }

  function openEdit(item: CalendarItem) {
    setModalDate(item.date);
    setModalItem(item);
  }

  return (
    <section>
      <SectionHeader
        title="Calendário"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCursor(new Date(year, month - 1, 1))}
              aria-label="Mês anterior"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-all duration-150 hover:bg-slate-100 active:scale-90 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[120px] text-center text-sm font-medium text-slate-700 dark:text-zinc-300">
              {MONTH_LABELS[month]} de {year}
            </span>
            <button
              onClick={() => setCursor(new Date(year, month + 1, 1))}
              aria-label="Próximo mês"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-all duration-150 hover:bg-slate-100 active:scale-90 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-zinc-400">
        {(Object.keys(CALENDAR_TYPE_LABELS) as (keyof typeof CALENDAR_TYPE_LABELS)[]).map(
          (t) => (
            <span key={t} className={cx("rounded-full border px-2 py-0.5", CALENDAR_TYPE_COLORS[t])}>
              {CALENDAR_TYPE_LABELS[t]}
            </span>
          )
        )}
      </div>

      <div className={cx(CARD_SURFACE, "overflow-hidden p-0")}>
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60 text-center text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:border-zinc-800/70 dark:bg-zinc-950/40 dark:text-zinc-500">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="py-2">
              {w}
            </div>
          ))}
        </div>
        <div className={cx("grid grid-cols-7 transition-opacity duration-200", loading && "opacity-50")}>
          {cells.map((cell, idx) => (
            <div
              key={idx}
              onClick={() => cell.date && openCreate(cell.date)}
              className={cx(
                "min-h-[92px] border-b border-r border-slate-100 p-1.5 align-top transition-colors duration-150 dark:border-zinc-800/70",
                cell.date
                  ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                  : "bg-slate-50/30 dark:bg-zinc-950/30",
                idx % 7 === 6 && "border-r-0"
              )}
            >
              {cell.day && (
                <>
                  <p className="mb-1 text-xs font-medium text-slate-500 dark:text-zinc-400">{cell.day}</p>
                  <div className="flex flex-col gap-1">
                    {(itemsByDate.get(cell.date!) ?? []).slice(0, 3).map((it) => (
                      <button
                        key={it.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(it);
                        }}
                        className={cx(
                          "flex items-center gap-1 truncate rounded border px-1.5 py-0.5 text-left text-[11px] font-medium transition-transform duration-150 active:scale-95",
                          CALENDAR_TYPE_COLORS[it.type]
                        )}
                        title={it.description ?? CALENDAR_TYPE_LABELS[it.type]}
                      >
                        <span
                          className={cx("h-1.5 w-1.5 shrink-0 rounded-full", CALENDAR_STATUS_DOT[it.status])}
                        />
                        <span className="truncate">{CALENDAR_TYPE_LABELS[it.type]}</span>
                      </button>
                    ))}
                    {(itemsByDate.get(cell.date!) ?? []).length > 3 && (
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                        +{(itemsByDate.get(cell.date!) ?? []).length - 3} mais
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {modalDate && (
        <CalendarItemModal
          open={!!modalDate}
          onClose={() => {
            setModalDate(null);
            setModalItem(null);
          }}
          companyId={company.id}
          date={modalDate}
          item={modalItem}
          onSaved={load}
        />
      )}
    </section>
  );
}
