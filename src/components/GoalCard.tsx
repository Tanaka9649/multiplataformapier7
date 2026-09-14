"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { ProgressBar } from "@/components/ProgressBar";
import type { CompanyGoal, MetricFormat } from "@/types/database";
import { CARD_SURFACE, cx, formatDateShortPtBR, formatMetricValue } from "@/lib/utils";

interface GoalCardProps {
  goal: CompanyGoal;
  format: MetricFormat;
  currentValue: number;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function GoalCard({
  goal,
  format,
  currentValue,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: GoalCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const target = goal.target_value;
  const percent = target > 0 ? (currentValue / target) * 100 : 0;
  const reached = currentValue >= target;
  const diff = Math.abs(target - currentValue);

  return (
    <div className={cx(CARD_SURFACE, "p-5 transition-all duration-200 hover:-translate-y-0.5")}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{goal.name}</p>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Opções da meta"
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-7 z-20 w-44 animate-fade-in rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onMoveUp();
                  }}
                  disabled={!canMoveUp}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <ChevronUp className="h-3.5 w-3.5" /> Mover para cima
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onMoveDown();
                  }}
                  disabled={!canMoveDown}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <ChevronDown className="h-3.5 w-3.5" /> Mover para baixo
                </button>
                <div className="my-1 h-px bg-slate-100 dark:bg-zinc-800" />
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-600 transition-colors hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mb-2 flex items-end justify-between gap-2">
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          {formatMetricValue(currentValue, format)}{" "}
          <span className="text-slate-300 dark:text-zinc-600">de</span> {formatMetricValue(target, format)}
        </p>
        <p className="text-lg font-semibold tabular-nums text-slate-900 dark:text-zinc-50">
          {Math.round(percent)}%
        </p>
      </div>

      <ProgressBar percent={percent} />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-zinc-400">
        <span className={cx(reached && "flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400")}>
          {reached ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {currentValue === target ? "Meta atingida" : `Meta superada em ${formatMetricValue(diff, format)}`}
            </>
          ) : (
            `Faltam ${formatMetricValue(diff, format)}`
          )}
        </span>
        {goal.period_start && goal.period_end && (
          <span>
            {formatDateShortPtBR(goal.period_start)} — {formatDateShortPtBR(goal.period_end)}
          </span>
        )}
      </div>
    </div>
  );
}
