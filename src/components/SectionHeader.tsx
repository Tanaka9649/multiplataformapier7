import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-zinc-50">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 dark:text-zinc-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
