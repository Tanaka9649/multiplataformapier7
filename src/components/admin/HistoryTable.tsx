"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { CARD_SURFACE, cx } from "@/lib/utils";

interface LogRow {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

const ACTION_VERBS: Record<string, string> = {
  user_created: "criou o acesso de",
  user_approved: "aprovou",
  user_rejected: "recusou",
  user_suspended: "suspendeu",
  user_reactivated: "reativou",
  permissions_changed: "alterou as permissões de",
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function HistoryTable({ logs, profiles }: { logs: LogRow[]; profiles: ProfileRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profiles) map.set(p.id, p.full_name ?? p.email ?? "Alguém");
    return map;
  }, [profiles]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-7 sm:px-6 lg:px-8">
      <h1 className="mb-5 text-lg font-semibold text-slate-900 dark:text-zinc-50">Histórico administrativo</h1>

      {logs.length === 0 ? (
        <EmptyState message="Nenhuma ação registrada ainda." />
      ) : (
        <div className={cx(CARD_SURFACE, "divide-y divide-slate-100 p-0 dark:divide-zinc-800")}>
          {logs.map((log) => {
            const actorName = log.actor_user_id ? (nameById.get(log.actor_user_id) ?? "Alguém") : "Sistema";
            const targetName = log.target_user_id ? nameById.get(log.target_user_id) : null;
            const verb = ACTION_VERBS[log.action] ?? log.action;
            const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;
            const isExpanded = expanded.has(log.id);

            return (
              <div key={log.id} className="px-4 py-3">
                <button
                  onClick={() => hasMetadata && toggle(log.id)}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <div className="flex items-start gap-1.5">
                    {hasMetadata &&
                      (isExpanded ? (
                        <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2.25} />
                      ) : (
                        <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2.25} />
                      ))}
                    <p className="text-sm text-slate-700 dark:text-zinc-300">
                      <span className="font-medium text-slate-900 dark:text-zinc-100">{actorName}</span> {verb}
                      {targetName && (
                        <>
                          {" "}
                          <span className="font-medium text-slate-900 dark:text-zinc-100">{targetName}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400 dark:text-zinc-500">
                    {formatDateTime(log.created_at)}
                  </span>
                </button>

                {hasMetadata && isExpanded && (
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-zinc-900/60 dark:text-zinc-400">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
