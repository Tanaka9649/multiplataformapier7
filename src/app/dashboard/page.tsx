import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/DashboardShell";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // As duas leituras continuam protegidas por RLS, mas não dependem uma da
  // outra. Executá-las em paralelo elimina um round-trip sem enfraquecer a
  // validação de identidade feita acima com getUser().
  const [profileResult, companiesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, role, status, system_role, permission_profile_id, approved_at, approved_by, suspended_at, last_login_at, created_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("companies")
      .select("id, name, slug, logo_path, sort_order, active, created_at")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
  ]);

  const profile = profileResult.data;

  // Perfil ausente (não deveria acontecer — o trigger cria sempre) ou
  // conta não ativa: nunca renderiza a plataforma nem carrega dado
  // nenhum de empresa.
  if (!profile || profile.status !== "active") {
    redirect("/pending");
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f7f7f8] text-sm text-slate-400 dark:bg-[#101012] dark:text-zinc-500">
          Carregando...
        </div>
      }
    >
      <DashboardShell companies={companiesResult.data ?? []} userEmail={user.email ?? null} profile={profile} />
    </Suspense>
  );
}
