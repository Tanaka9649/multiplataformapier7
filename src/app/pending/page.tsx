import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CARD_SURFACE, cx } from "@/lib/utils";

export const dynamic = "force-dynamic";

const COPY: Record<string, { title: string; message: string }> = {
  pending: {
    title: "Acesso em análise",
    message: "Seu acesso foi solicitado e está aguardando aprovação do administrador.",
  },
  suspended: {
    title: "Acesso suspenso",
    message: "Seu acesso a esta plataforma foi suspenso. Entre em contato com o administrador para mais informações.",
  },
  rejected: {
    title: "Acesso não aprovado",
    message: "Sua solicitação de acesso não foi aprovada. Entre em contato com o administrador para mais informações.",
  },
};

export default async function PendingPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase.from("profiles").select("status").eq("id", user.id).maybeSingle();

  if (profile?.status === "active") {
    redirect("/dashboard");
  }

  const copy = COPY[profile?.status ?? "pending"] ?? COPY.pending;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#f7f7f8] px-4 transition-colors dark:bg-[#101012]">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className={cx(CARD_SURFACE, "w-full max-w-sm animate-fade-in-up p-8 text-center")}>
        <div className="mb-6 flex justify-center">
          <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">PIER7</span>
        </div>
        <h1 className="mb-2 text-lg font-semibold text-slate-900 dark:text-zinc-100">{copy.title}</h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-zinc-400">{copy.message}</p>

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="mx-auto rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
          >
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
