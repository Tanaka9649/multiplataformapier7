"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonthYear, shiftMonth } from "@/lib/socialMedia";
import { cx } from "@/lib/utils";

interface PeriodSelectorProps {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}

export function PeriodSelector({ year, month, onChange }: PeriodSelectorProps) {
  function go(delta: number) {
    const next = shiftMonth(year, month, delta);
    onChange(next.year, next.month);
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200/70 bg-white p-1 dark:border-zinc-800/70 dark:bg-zinc-900">
      <button
        onClick={() => go(-1)}
        aria-label="Mês anterior"
        className={cx(
          "flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150",
          "hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        )}
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
      </button>
      <span className="min-w-[140px] px-2 text-center text-sm font-medium text-slate-800 dark:text-zinc-200">
        {formatMonthYear(year, month)}
      </span>
      <button
        onClick={() => go(1)}
        aria-label="Próximo mês"
        className={cx(
          "flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150",
          "hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        )}
      >
        <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
      </button>
    </div>
  );
}
