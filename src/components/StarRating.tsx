"use client";

import { Star } from "lucide-react";
import { cx } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md";
}

export function StarRating({ value, onChange, size = "sm" }: StarRatingProps) {
  const dim = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <div className="flex items-center gap-0.5" role={onChange ? "radiogroup" : undefined} aria-label="Qualificação">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
          className={cx(dim, "shrink-0", onChange && "cursor-pointer transition-transform duration-100 active:scale-90")}
        >
          <Star
            className={cx(
              dim,
              n <= value
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-slate-300 dark:text-zinc-700"
            )}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}
