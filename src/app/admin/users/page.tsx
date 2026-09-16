import { createClient } from "@/lib/supabase/server";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { UsersPageClient } from "@/components/admin/UsersPageClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const supabase = createClient();

  const [{ data: profiles }, { data: permissionProfiles }, { data: companies }, { data: userCompanies }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, email, full_name, status, system_role, permission_profile_id, approved_at, suspended_at, last_login_at, created_at"
        )
        .order("created_at", { ascending: true }),
      supabase.from("permission_profiles").select("id, name, description").order("name"),
      supabase.from("companies").select("id, name, slug").eq("active", true).order("sort_order"),
      supabase.from("user_companies").select("user_id, company_id"),
    ]);

  return (
    <>
      <AdminHeader />
      <UsersPageClient
        profiles={profiles ?? []}
        permissionProfiles={permissionProfiles ?? []}
        companies={companies ?? []}
        userCompanies={userCompanies ?? []}
      />
    </>
  );
}
