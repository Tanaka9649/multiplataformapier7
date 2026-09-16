import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

/**
 * Client com a service_role key — poder irrestrito, ignora RLS.
 * Só pode ser usado em rotas de servidor (app/api/**\/route.ts) ou
 * Server Actions. O import "server-only" no topo faz o build falhar se
 * este arquivo acabar sendo importado por um Client Component.
 *
 * Requer a env var SUPABASE_SERVICE_ROLE_KEY configurada no projeto
 * Vercel (Settings → Environment Variables), copiada de
 * Supabase → Project Settings → API → service_role secret. Nunca deve
 * levar o prefixo NEXT_PUBLIC_ nem aparecer em código versionado.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada. Adicione essa variável de ambiente no projeto da Vercel (copiada de Supabase → Settings → API → service_role) antes de usar recursos de administração de usuários."
    );
  }

  return createSupabaseClient(SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
