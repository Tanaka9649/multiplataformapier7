import type { UserStatus } from "@/types/database";
import { StatusBadge as SharedStatusBadge, type StatusBadgeVariant } from "@/components/StatusBadge";
import { USER_STATUS_LABELS } from "@/lib/permissions";

const VARIANTS: Record<UserStatus, StatusBadgeVariant> = {
  pending: "warning",
  active: "success",
  suspended: "danger",
  rejected: "neutral",
};

export function StatusBadge({ status }: { status: UserStatus }) {
  return (
    <SharedStatusBadge variant={VARIANTS[status]} className="text-[11px]">
      {USER_STATUS_LABELS[status]}
    </SharedStatusBadge>
  );
}
