"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cx } from "@/lib/utils";

const TABS = [
  { href: "/admin/users", label: "Usuários" },
  { href: "/admin/history", label: "Histórico" },
];

export function AdminHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-200/70 bg-white transition-colors dark:border-zinc-800/70 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Voltar
          </Link>
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-zinc-50">
            Administração
          </span>
        </div>
        <ThemeToggle />
      </div>
      <nav className="mx-auto flex max-w-6xl gap-1 px-4 sm:px-6 lg:px-8" aria-label="Administração">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cx(
                "border-b-2 px-3 py-2.5 text-sm transition-colors duration-150",
                active
                  ? "border-brand-600 font-medium text-slate-900 dark:border-brand-400 dark:text-zinc-50"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
