import type { UserStatus } from "@/types/database";
import { USER_STATUS_LABELS } from "@/lib/permissions";
import { cx } from "@/lib/utils";

const STYLES: Record<UserStatus, string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  suspended: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  rejected: "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400",
};

export function StatusBadge({ status }: { status: UserStatus }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", STYLES[status])}>
      {USER_STATUS_LABELS[status]}
    </span>
  );
}
