import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function logAdminAction(params: {
  actorUserId: string;
  action: string;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  await admin.from("admin_audit_logs").insert({
    actor_user_id: params.actorUserId,
    action: params.action,
    target_user_id: params.targetUserId ?? null,
    metadata: params.metadata ?? {},
  });
}
