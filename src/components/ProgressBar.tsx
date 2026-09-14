"use client";

import { useEffect, useState } from "react";
import { cx } from "@/lib/utils";

export function ProgressBar({ percent, className }: { percent: number; className?: string }) {
  const target = Math.max(0, Math.min(percent, 100));
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setWidth(target));
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return (
    <div
      className={cx("h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800", className)}
      role="progressbar"
      aria-valuenow={Math.round(target)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-brand-600 transition-[width] duration-700 ease-out-soft motion-reduce:transition-none dark:bg-brand-500"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
