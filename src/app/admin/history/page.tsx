import { createClient } from "@/lib/supabase/server";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { HistoryTable } from "@/components/admin/HistoryTable";

export const dynamic = "force-dynamic";

export default async function AdminHistoryPage() {
  const supabase = createClient();

  const [{ data: logs }, { data: profiles }] = await Promise.all([
    supabase
      .from("admin_audit_logs")
      .select("id, actor_user_id, action, target_user_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  return (
    <>
      <AdminHeader />
      <HistoryTable logs={logs ?? []} profiles={profiles ?? []} />
    </>
  );
}
