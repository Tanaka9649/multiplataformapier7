"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cx } from "@/lib/utils";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-8 w-8 shrink-0 rounded-lg" aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
      title={isDark ? "Modo claro" : "Modo escuro"}
      className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg text-slate-500 transition-all duration-150 hover:bg-slate-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:focus-visible:ring-brand-500"
    >
      <Sun
        className={cx(
          "absolute h-4 w-4 transition-all duration-300 ease-out-soft",
          isDark ? "-translate-y-6 rotate-90 opacity-0" : "translate-y-0 rotate-0 opacity-100"
        )}
      />
      <Moon
        className={cx(
          "absolute h-4 w-4 transition-all duration-300 ease-out-soft",
          isDark ? "translate-y-0 rotate-0 opacity-100" : "translate-y-6 -rotate-90 opacity-0"
        )}
      />
    </button>
  );
}
