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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, status, system_role, permission_profile_id, approved_at, approved_by, suspended_at, last_login_at, created_at")
    .eq("id", user.id)
    .maybeSingle();

  // Perfil ausente (não deveria acontecer — o trigger cria sempre) ou
  // conta não ativa: nunca renderiza a plataforma nem carrega dado
  // nenhum de empresa.
  if (!profile || profile.status !== "active") {
    redirect("/pending");
  }

  // Marca o último acesso (best-effort).
  await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", user.id);

  const { data: companies } = await supabase
    .from("companies")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f7f7f8] text-sm text-slate-400 dark:bg-[#101012] dark:text-zinc-500">
          Carregando...
        </div>
      }
    >
      <DashboardShell companies={companies ?? []} userEmail={user.email ?? null} profile={profile} />
    </Suspense>
  );
}
