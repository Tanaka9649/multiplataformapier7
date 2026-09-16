import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { UserDetailClient } from "@/components/admin/UserDetailClient";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: profile }, { data: permissionProfiles }, { data: companies }, { data: userCompanies }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, email, full_name, role, status, system_role, permission_profile_id, approved_at, approved_by, suspended_at, last_login_at, created_at"
        )
        .eq("id", params.id)
        .maybeSingle(),
      supabase.from("permission_profiles").select("id, name, description").order("name"),
      supabase.from("companies").select("id, name, slug").eq("active", true).order("sort_order"),
      supabase.from("user_companies").select("company_id").eq("user_id", params.id),
    ]);

  if (!profile) {
    notFound();
  }

  const { data: allRoleRows } = await supabase
    .from("role_permissions")
    .select("profile_id, module_key, action, allowed");

  const { data: overrideRows } = await supabase
    .from("user_permission_overrides")
    .select("company_id, module_key, action, allowed")
    .eq("user_id", params.id);

  return (
    <>
      <AdminHeader />
      <UserDetailClient
        profile={profile}
        permissionProfiles={permissionProfiles ?? []}
        companies={companies ?? []}
        userCompanyIds={(userCompanies ?? []).map((r) => r.company_id)}
        roleRows={allRoleRows ?? []}
        overrideRows={overrideRows ?? []}
      />
    </>
  );
}
