import type { ReactNode } from "react";
import { cx } from "@/lib/utils";
import { BADGE_VARIANT_STYLES, type BadgeVariant } from "@/lib/uiVariants";

export type StatusBadgeVariant = BadgeVariant;

interface StatusBadgeProps {
  children: ReactNode;
  variant?: StatusBadgeVariant;
  className?: string;
}

/** Badge informativo compartilhado. Sem hover para não sugerir interação. */
export function StatusBadge({ children, variant = "neutral", className }: StatusBadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-medium leading-4",
        BADGE_VARIANT_STYLES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
