"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Lock } from "lucide-react";
import {
  PERMISSION_MODULES,
  applySimpleLevel,
  deriveSimpleLevel,
  type ActionKey,
  type SimpleLevel,
} from "@/lib/permissions";
import { SELECTED_PILL, UNSELECTED_PILL, cx } from "@/lib/utils";

const SIMPLE_OPTIONS: { value: SimpleLevel; label: string }[] = [
  { value: "none", label: "Sem acesso" },
  { value: "view", label: "Somente visualizar" },
  { value: "edit", label: "Editar" },
];

interface PermissionMatrixProps {
  /** module_key:action -> allowed, para a empresa atualmente selecionada. */
  value: Map<string, boolean>;
  onChange: (next: Map<string, boolean>) => void;
}

export function PermissionMatrix({ value, onChange }: PermissionMatrixProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function actionsFor(moduleKey: string): Set<ActionKey> {
    const mod = PERMISSION_MODULES.find((m) => m.key === moduleKey)!;
    const set = new Set<ActionKey>();
    for (const a of mod.actions) {
      if (value.get(`${moduleKey}:${a.key}`)) set.add(a.key);
    }
    return set;
  }

  function setModuleActions(moduleKey: string, actions: Set<ActionKey>) {
    const mod = PERMISSION_MODULES.find((m) => m.key === moduleKey)!;
    const next = new Map(value);
    for (const a of mod.actions) {
      next.set(`${moduleKey}:${a.key}`, actions.has(a.key));
    }
    onChange(next);
  }

  function setSimpleLevel(moduleKey: string, level: SimpleLevel) {
    const mod = PERMISSION_MODULES.find((m) => m.key === moduleKey)!;
    setModuleActions(moduleKey, applySimpleLevel(mod, level));
  }

  function setAction(moduleKey: string, action: ActionKey, allowed: boolean) {
    const next = new Map(value);
    next.set(`${moduleKey}:${action}`, allowed);
    // "view" é implícito quando qualquer outra ação é ligada.
    if (allowed && action !== "view") {
      next.set(`${moduleKey}:view`, true);
    }
    onChange(next);
  }

  return (
    <div className="divide-y divide-slate-100 dark:divide-zinc-800">
      {PERMISSION_MODULES.map((mod) => {
        const currentActions = actionsFor(mod.key);
        const level = deriveSimpleLevel(mod, currentActions);
        const isExpanded = expanded.has(mod.key);
        const advancedActions = mod.actions.filter((a) => a.key !== "view");

        return (
          <div key={mod.key} className={cx("py-3", !mod.implemented && "opacity-50")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => mod.implemented && toggleExpanded(mod.key)}
                  disabled={!mod.implemented}
                  className="flex items-center gap-1 text-sm font-medium text-slate-800 disabled:cursor-not-allowed dark:text-zinc-200"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" strokeWidth={2.25} />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" strokeWidth={2.25} />
                  )}
                  {mod.label}
                  {!mod.implemented && <Lock className="h-3 w-3 text-slate-300 dark:text-zinc-600" strokeWidth={2} />}
                </button>
              </div>

              <div className="flex gap-1 rounded-lg border border-slate-200 p-0.5 dark:border-zinc-800">
                {SIMPLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={!mod.implemented}
                    onClick={() => setSimpleLevel(mod.key, opt.value)}
                    className={cx(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 disabled:cursor-not-allowed",
                      level === opt.value
                        ? SELECTED_PILL
                        : UNSELECTED_PILL
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {!mod.implemented && (
              <p className="mt-1.5 text-[11px] text-slate-400 dark:text-zinc-500">
                Ainda não disponível nesta plataforma (módulo em outro sistema).
              </p>
            )}

            {mod.implemented && isExpanded && (
              <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-zinc-900/60">
                <p className="w-full text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  Permissões avançadas
                </p>
                {advancedActions.map((a) => (
                  <label key={a.key} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={currentActions.has(a.key)}
                      onChange={(e) => setAction(mod.key, a.key, e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-zinc-700"
                    />
                    {a.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
