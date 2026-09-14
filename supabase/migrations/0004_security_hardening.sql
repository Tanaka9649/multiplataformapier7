-- =========================================================================
-- PIER7 Multiempresa — Hardening (achados do linter de segurança do Supabase)
-- =========================================================================

-- 1) search_path mutável em função de trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2) funções SECURITY DEFINER não devem ser chamáveis diretamente via
-- RPC por anon/authenticated (só precisam ser invocadas internamente
-- pelas políticas de RLS).
revoke execute on function public.is_admin(uuid) from public, anon, authenticated;
revoke execute on function public.has_company_access(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- as políticas de RLS são avaliadas no contexto do usuário autenticado,
-- então authenticated precisa poder invocar estas duas para as políticas
-- funcionarem — só perde o acesso "anon" e o acesso via RPC direto do
-- handle_new_user (que é só de trigger mesmo).
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.has_company_access(uuid) to authenticated;
