-- =========================================================================
-- PIER7 Multiempresa — nome de exibição do usuário (Administração → Usuários)
-- =========================================================================
alter table public.profiles add column if not exists full_name text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, status, system_role)
  values (new.id, new.email, new.raw_user_meta_data->>'name', 'member', 'pending', 'member')
  on conflict (id) do nothing;
  return new;
end;
$$;
