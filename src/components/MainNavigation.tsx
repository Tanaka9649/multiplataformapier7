"use client";

import { BarChart3, CalendarDays, FileSpreadsheet, Instagram, Table2, UserCheck } from "lucide-react";
import { cx } from "@/lib/utils";

export type DashboardTab = "traffic" | "calendar" | "spreadsheets" | "leads" | "leadsControl" | "social";

const TABS: { key: DashboardTab; label: string; icon: typeof BarChart3 }[] = [
  { key: "traffic", label: "Tráfego pago", icon: BarChart3 },
  { key: "calendar", label: "Calendário", icon: CalendarDays },
  { key: "spreadsheets", label: "Planilhas", icon: FileSpreadsheet },
  { key: "leads", label: "Leads qualificados", icon: UserCheck },
  { key: "leadsControl", label: "Controle de Leads", icon: Table2 },
  { key: "social", label: "Redes Sociais", icon: Instagram },
];

interface MainNavigationProps {
  activeTab: DashboardTab;
  onSelect: (tab: DashboardTab) => void;
}

export function MainNavigation({ activeTab, onSelect }: MainNavigationProps) {
  return (
    <div className="border-b border-slate-200/70 bg-white dark:border-zinc-800/70 dark:bg-zinc-950">
      <nav
        className="scrollbar-thin mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8"
        aria-label="Módulos"
      >
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => onSelect(tab.key)}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors duration-150",
                active
                  ? "border-brand-600 font-medium text-slate-900 dark:border-brand-400 dark:text-zinc-50"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300"
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
