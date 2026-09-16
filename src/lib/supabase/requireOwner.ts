import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Confirma que quem está chamando a rota é o Owner ativo, usando o
 * client normal (respeita RLS/sessão do cookie) — nunca confia em nada
 * vindo do corpo da requisição para decidir isso.
 */
export async function requireOwner() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, status: 401, message: "Não autenticado." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, status, system_role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.system_role !== "owner" || profile.status !== "active") {
    return { ok: false as const, status: 403, message: "Apenas o Owner pode realizar esta ação." };
  }

  return { ok: true as const, ownerId: user.id };
}
