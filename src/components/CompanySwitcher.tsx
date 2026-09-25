"use client";

import type { Company } from "@/types/database";
import { SELECTED_PILL, UNSELECTED_PILL, cx } from "@/lib/utils";

interface CompanySwitcherProps {
  companies: Company[];
  activeSlug: string;
  onSelect: (slug: string) => void;
}

export function CompanySwitcher({ companies, activeSlug, onSelect }: CompanySwitcherProps) {
  return (
    <div className="border-b border-slate-200/70 bg-white dark:border-zinc-800/70 dark:bg-zinc-950">
      <div className="scrollbar-thin mx-auto flex max-w-7xl gap-1.5 overflow-x-auto px-4 py-2.5 sm:px-6 lg:px-8">
        {companies.map((company) => {
          const active = company.slug === activeSlug;
          return (
            <button
              key={company.id}
              onClick={() => onSelect(company.slug)}
              aria-pressed={active}
              title={company.name}
              className={cx(
                "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-150 active:scale-[0.97]",
                active
                  ? SELECTED_PILL
                  : UNSELECTED_PILL
              )}
            >
              {company.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
