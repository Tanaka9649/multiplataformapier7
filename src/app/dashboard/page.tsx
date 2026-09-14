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
      <DashboardShell companies={companies ?? []} userEmail={user.email ?? null} />
    </Suspense>
  );
}
