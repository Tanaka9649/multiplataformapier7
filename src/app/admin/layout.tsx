import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * A opção "Administração" deve ser completamente invisível para quem
 * não é Owner. Este layout garante isso no servidor para toda a árvore
 * /admin/** — mesmo alguém digitando a URL direto sem nunca ver o link
 * no menu é barrado aqui, antes de qualquer dado ser carregado.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, system_role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active" || profile.system_role !== "owner") {
    redirect("/dashboard");
  }

  return <div className="min-h-screen bg-[#f7f7f8] transition-colors dark:bg-[#101012]">{children}</div>;
}
