-- =========================================================================
-- PIER7 Multiempresa — Usuários, Aprovação de Acesso e Permissões
--
-- Estende profiles/user_companies existentes (não duplica). Introduz:
--   - status de conta (pending/active/suspended/rejected) + aprovação
--   - system_role ('owner' | 'member') — só o dono real da conta é owner
--   - permission_profiles (perfis prontos) + role_permissions (matriz base)
--   - user_permission_overrides (exceções por usuário+empresa+módulo+ação)
--   - admin_audit_logs (histórico administrativo)
--   - funções centrais: is_owner, has_permission (cascata: override > perfil
--     > negar). has_company_access e is_admin são redefinidas para usar
--     essa base, então TODAS as policies que já as usam ganham a nova
--     regra automaticamente (status ativo obrigatório; só o Owner tem
--     bypass total).
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1) profiles — novas colunas
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended', 'rejected')),
  add column if not exists system_role text not null default 'member'
    check (system_role in ('owner', 'member')),
  add column if not exists permission_profile_id uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id),
  add column if not exists suspended_at timestamptz,
  add column if not exists last_login_at timestamptz;

-- ---------------------------------------------------------------------
-- 2) permission_profiles — perfis prontos (templates)
-- ---------------------------------------------------------------------
create table if not exists public.permission_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_permission_profile_fk
  foreign key (permission_profile_id) references public.permission_profiles(id) on delete set null;

-- ---------------------------------------------------------------------
-- 3) role_permissions — matriz base de cada perfil (módulo + ação)
-- ---------------------------------------------------------------------
create table if not exists public.role_permissions (
  profile_id uuid not null references public.permission_profiles(id) on delete cascade,
  module_key text not null,
  action text not null,
  allowed boolean not null default false,
  primary key (profile_id, module_key, action)
);

-- ---------------------------------------------------------------------
-- 4) user_permission_overrides — exceção por usuário + empresa + módulo + ação
-- ---------------------------------------------------------------------
create table if not exists public.user_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  module_key text not null,
  action text not null,
  allowed boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, company_id, module_key, action)
);
create index if not exists user_permission_overrides_user_idx
  on public.user_permission_overrides (user_id);

drop trigger if exists set_updated_at on public.user_permission_overrides;
create trigger set_updated_at before update on public.user_permission_overrides
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5) admin_audit_logs — histórico administrativo (imutável pelo usuário comum)
-- ---------------------------------------------------------------------
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);
create index if not exists admin_audit_logs_target_idx on public.admin_audit_logs (target_user_id);

-- ---------------------------------------------------------------------
-- 6) Owner inicial — localiza o auth.users.id real da conta existente,
-- nunca por comparação de e-mail em runtime.
-- ---------------------------------------------------------------------
update public.profiles p
set system_role = 'owner',
    status = 'active',
    approved_at = now()
from auth.users u
where p.id = u.id and u.email = 'guitanakabrasil@gmail.com';

-- ---------------------------------------------------------------------
-- 7) handle_new_user — cadastro sempre nasce PENDENTE, sem empresas,
-- sem papel administrativo. Substitui a lógica antiga de "primeiro
-- usuário vira admin" (já não se aplica: o owner é fixado acima).
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, status, system_role)
  values (new.id, new.email, 'member', 'pending', 'member')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 8) Funções centrais de autorização
-- ---------------------------------------------------------------------
create or replace function public.is_owner(uid uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.system_role = 'owner' and p.status = 'active'
  );
$$;

-- is_admin agora é só um alias histórico de is_owner: preserva todas as
-- policies antigas que já chamavam is_admin (companies, profiles,
-- user_companies, metric_definitions) restringindo-as corretamente ao
-- Owner, sem precisar reescrever cada uma.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_owner(uid);
$$;

-- has_company_access agora também exige conta ATIVA — isso propaga
-- automaticamente para toda tabela que já usa esta função (suspensão
-- vira bloqueio imediato de leitura/escrita em tudo, sem precisar
-- tocar em cada policy individualmente).
create or replace function public.has_company_access(cid uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select
    public.is_owner(auth.uid())
    or exists (
      select 1
      from public.user_companies uc
      join public.profiles p on p.id = uc.user_id
      where uc.user_id = auth.uid()
        and uc.company_id = cid
        and p.status = 'active'
    );
$$;

-- has_permission — avaliação central de módulo+ação por empresa.
-- Regra (default deny): owner permitido; senão exige empresa liberada
-- (has_company_access já cobre status ativo); override individual tem
-- prioridade; na ausência de override, usa o perfil base; sem perfil
-- ou sem linha correspondente => negado.
create or replace function public.has_permission(p_company_id uuid, p_module text, p_action text)
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile_id uuid;
  v_override boolean;
  v_role_allowed boolean;
begin
  if v_uid is null then
    return false;
  end if;

  if public.is_owner(v_uid) then
    return true;
  end if;

  if not public.has_company_access(p_company_id) then
    return false;
  end if;

  select allowed into v_override
    from public.user_permission_overrides
    where user_id = v_uid and company_id = p_company_id
      and module_key = p_module and action = p_action;
  if v_override is not null then
    return v_override;
  end if;

  select permission_profile_id into v_profile_id from public.profiles where id = v_uid;
  if v_profile_id is null then
    return false;
  end if;

  select allowed into v_role_allowed
    from public.role_permissions
    where profile_id = v_profile_id and module_key = p_module and action = p_action;

  return coalesce(v_role_allowed, false);
end;
$$;

-- RPCs de auto-consulta (sempre escopadas ao próprio auth.uid(), nunca
-- recebem um user_id como parâmetro — não há como um usuário usar isso
-- para ler dados de outra pessoa). Usadas pela UI para decidir o que
-- mostrar/esconder; a garantia real continua sendo o RLS acima.
create or replace function public.get_my_role_permissions()
returns table (module_key text, action text, allowed boolean)
language sql
stable
security definer set search_path = public
as $$
  select rp.module_key, rp.action, rp.allowed
  from public.role_permissions rp
  join public.profiles p on p.permission_profile_id = rp.profile_id
  where p.id = auth.uid();
$$;

create or replace function public.get_my_overrides()
returns table (company_id uuid, module_key text, action text, allowed boolean)
language sql
stable
security definer set search_path = public
as $$
  select o.company_id, o.module_key, o.action, o.allowed
  from public.user_permission_overrides o
  where o.user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 9) EXECUTE restrito — nunca chamável por anon nem via RPC aberto por
-- quem não precisa (mesmo padrão já usado em 0004_security_hardening).
-- ---------------------------------------------------------------------
revoke execute on function public.is_owner(uuid) from public, anon, authenticated;
revoke execute on function public.has_permission(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.get_my_role_permissions() from public, anon, authenticated;
revoke execute on function public.get_my_overrides() from public, anon, authenticated;

grant execute on function public.is_owner(uuid) to authenticated;
grant execute on function public.has_permission(uuid, text, text) to authenticated;
grant execute on function public.get_my_role_permissions() to authenticated;
grant execute on function public.get_my_overrides() to authenticated;

-- ---------------------------------------------------------------------
-- 10) RLS das novas tabelas
-- ---------------------------------------------------------------------
alter table public.permission_profiles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permission_overrides enable row level security;
alter table public.admin_audit_logs enable row level security;

-- Só o Owner administra segurança — usuário comum não lê nem grava
-- estas tabelas diretamente (a própria UI dele usa has_permission()
-- por baixo dos panos via RLS nas tabelas de dados, e as RPCs
-- get_my_* acima para saber o que mostrar).
drop policy if exists permission_profiles_owner on public.permission_profiles;
create policy permission_profiles_owner on public.permission_profiles
  for all using (public.is_owner(auth.uid())) with check (public.is_owner(auth.uid()));

drop policy if exists role_permissions_owner on public.role_permissions;
create policy role_permissions_owner on public.role_permissions
  for all using (public.is_owner(auth.uid())) with check (public.is_owner(auth.uid()));

drop policy if exists user_permission_overrides_owner on public.user_permission_overrides;
create policy user_permission_overrides_owner on public.user_permission_overrides
  for all using (public.is_owner(auth.uid())) with check (public.is_owner(auth.uid()));

drop policy if exists admin_audit_logs_owner on public.admin_audit_logs;
create policy admin_audit_logs_owner on public.admin_audit_logs
  for all using (public.is_owner(auth.uid())) with check (public.is_owner(auth.uid()));

-- ---------------------------------------------------------------------
-- 11) RLS das tabelas existentes — de "for all has_company_access" para
-- policies por ação usando has_permission(company_id, module, action).
-- has_permission já embute has_company_access (empresa liberada + conta
-- ativa), então não é preciso repetir a checagem separadamente.
-- ---------------------------------------------------------------------

-- metric_values (Tráfego pago → editar métricas)
drop policy if exists metric_values_write on public.metric_values;
drop policy if exists metric_values_select on public.metric_values;
create policy metric_values_select on public.metric_values
  for select using (public.has_permission(company_id, 'traffic', 'view'));
create policy metric_values_insert on public.metric_values
  for insert with check (public.has_permission(company_id, 'traffic', 'edit_metrics'));
create policy metric_values_update on public.metric_values
  for update using (public.has_permission(company_id, 'traffic', 'edit_metrics'))
  with check (public.has_permission(company_id, 'traffic', 'edit_metrics'));
create policy metric_values_delete on public.metric_values
  for delete using (public.has_permission(company_id, 'traffic', 'edit_metrics'));

-- company_observations (Tráfego pago → editar observações)
drop policy if exists company_observations_write on public.company_observations;
drop policy if exists company_observations_select on public.company_observations;
create policy company_observations_select on public.company_observations
  for select using (public.has_permission(company_id, 'traffic', 'view'));
create policy company_observations_insert on public.company_observations
  for insert with check (public.has_permission(company_id, 'traffic', 'edit_observations'));
create policy company_observations_update on public.company_observations
  for update using (public.has_permission(company_id, 'traffic', 'edit_observations'))
  with check (public.has_permission(company_id, 'traffic', 'edit_observations'));
create policy company_observations_delete on public.company_observations
  for delete using (public.has_permission(company_id, 'traffic', 'edit_observations'));

-- company_goals (Tráfego pago → gerenciar metas)
drop policy if exists company_goals_write on public.company_goals;
drop policy if exists company_goals_select on public.company_goals;
create policy company_goals_select on public.company_goals
  for select using (public.has_permission(company_id, 'traffic', 'view'));
create policy company_goals_insert on public.company_goals
  for insert with check (public.has_permission(company_id, 'traffic', 'manage_goals'));
create policy company_goals_update on public.company_goals
  for update using (public.has_permission(company_id, 'traffic', 'manage_goals'))
  with check (public.has_permission(company_id, 'traffic', 'manage_goals'));
create policy company_goals_delete on public.company_goals
  for delete using (public.has_permission(company_id, 'traffic', 'manage_goals'));

-- calendar_items (Calendário)
drop policy if exists calendar_items_write on public.calendar_items;
drop policy if exists calendar_items_select on public.calendar_items;
create policy calendar_items_select on public.calendar_items
  for select using (public.has_permission(company_id, 'calendar', 'view'));
create policy calendar_items_insert on public.calendar_items
  for insert with check (public.has_permission(company_id, 'calendar', 'add'));
create policy calendar_items_update on public.calendar_items
  for update using (public.has_permission(company_id, 'calendar', 'edit'))
  with check (public.has_permission(company_id, 'calendar', 'edit'));
create policy calendar_items_delete on public.calendar_items
  for delete using (public.has_permission(company_id, 'calendar', 'delete'));

-- spreadsheet_uploads (Planilhas)
drop policy if exists spreadsheet_uploads_write on public.spreadsheet_uploads;
drop policy if exists spreadsheet_uploads_select on public.spreadsheet_uploads;
create policy spreadsheet_uploads_select on public.spreadsheet_uploads
  for select using (public.has_permission(company_id, 'spreadsheets', 'view'));
create policy spreadsheet_uploads_insert on public.spreadsheet_uploads
  for insert with check (public.has_permission(company_id, 'spreadsheets', 'upload'));
create policy spreadsheet_uploads_delete on public.spreadsheet_uploads
  for delete using (public.has_permission(company_id, 'spreadsheets', 'delete'));

-- qualified_lead_files (Leads qualificados)
drop policy if exists qualified_lead_files_write on public.qualified_lead_files;
drop policy if exists qualified_lead_files_select on public.qualified_lead_files;
create policy qualified_lead_files_select on public.qualified_lead_files
  for select using (public.has_permission(company_id, 'leads', 'view'));
create policy qualified_lead_files_insert on public.qualified_lead_files
  for insert with check (public.has_permission(company_id, 'leads', 'upload'));
create policy qualified_lead_files_delete on public.qualified_lead_files
  for delete using (public.has_permission(company_id, 'leads', 'delete'));

-- leads (Controle de Leads)
drop policy if exists leads_write on public.leads;
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads
  for select using (public.has_permission(company_id, 'leads_control', 'view'));
create policy leads_insert on public.leads
  for insert with check (
    public.has_permission(company_id, 'leads_control', 'add')
    or public.has_permission(company_id, 'leads_control', 'import')
  );
create policy leads_update on public.leads
  for update using (public.has_permission(company_id, 'leads_control', 'edit'))
  with check (public.has_permission(company_id, 'leads_control', 'edit'));
create policy leads_delete on public.leads
  for delete using (public.has_permission(company_id, 'leads_control', 'delete'));

-- social_media_periods / social_story_weeks / social_top_contents (Redes Sociais)
drop policy if exists social_media_periods_write on public.social_media_periods;
drop policy if exists social_media_periods_select on public.social_media_periods;
create policy social_media_periods_select on public.social_media_periods
  for select using (public.has_permission(company_id, 'social', 'view'));
create policy social_media_periods_insert on public.social_media_periods
  for insert with check (public.has_permission(company_id, 'social', 'edit_metrics'));
create policy social_media_periods_update on public.social_media_periods
  for update using (public.has_permission(company_id, 'social', 'edit_metrics'))
  with check (public.has_permission(company_id, 'social', 'edit_metrics'));
create policy social_media_periods_delete on public.social_media_periods
  for delete using (public.has_permission(company_id, 'social', 'edit_metrics'));

drop policy if exists social_story_weeks_write on public.social_story_weeks;
drop policy if exists social_story_weeks_select on public.social_story_weeks;
create policy social_story_weeks_select on public.social_story_weeks
  for select using (
    exists (
      select 1 from public.social_media_periods p
      where p.id = social_period_id and public.has_permission(p.company_id, 'social', 'view')
    )
  );
create policy social_story_weeks_all on public.social_story_weeks
  for all using (
    exists (
      select 1 from public.social_media_periods p
      where p.id = social_period_id and public.has_permission(p.company_id, 'social', 'edit_metrics')
    )
  )
  with check (
    exists (
      select 1 from public.social_media_periods p
      where p.id = social_period_id and public.has_permission(p.company_id, 'social', 'edit_metrics')
    )
  );

drop policy if exists social_top_contents_write on public.social_top_contents;
drop policy if exists social_top_contents_select on public.social_top_contents;
create policy social_top_contents_select on public.social_top_contents
  for select using (public.has_permission(company_id, 'social', 'view'));
create policy social_top_contents_insert on public.social_top_contents
  for insert with check (public.has_permission(company_id, 'social', 'edit_content'));
create policy social_top_contents_update on public.social_top_contents
  for update using (public.has_permission(company_id, 'social', 'edit_content'))
  with check (public.has_permission(company_id, 'social', 'edit_content'));
create policy social_top_contents_delete on public.social_top_contents
  for delete using (public.has_permission(company_id, 'social', 'delete_content'));

-- company_metric_config: infraestrutura (define quais métricas cada
-- empresa exibe) — não é um módulo operacional do registry; leitura
-- continua liberada para quem tem acesso à empresa, escrita fica
-- restrita ao Owner (é catálogo, não dado do dia a dia do usuário).
drop policy if exists company_metric_config_write on public.company_metric_config;
create policy company_metric_config_select on public.company_metric_config
  for select using (public.has_company_access(company_id));
create policy company_metric_config_owner_write on public.company_metric_config
  for all using (public.is_owner(auth.uid())) with check (public.is_owner(auth.uid()));

-- ---------------------------------------------------------------------
-- 12) Storage — os buckets já existentes usam has_company_access(), que
-- já passou a exigir status ativo (item 8). Sem mudança de policy
-- necessária ali; só reforçamos que upload/delete de capa de conteúdo
-- (bucket social-content) e planilhas/leads seguem o mesmo gate.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 13) Realtime no profiles — permite a aplicação reagir imediatamente
-- quando o próprio status muda (ex.: suspensão), sem esperar reload.
-- ---------------------------------------------------------------------
do $$
begin
  execute 'alter publication supabase_realtime add table public.profiles';
exception when duplicate_object then
  null;
end $$;

-- ---------------------------------------------------------------------
-- 14) Perfis prontos + matriz base
-- ---------------------------------------------------------------------
insert into public.permission_profiles (name, description) values
  ('Administrador', 'Acesso operacional completo às empresas atribuídas. Não inclui Administração/Usuários — isso é exclusivo do Owner.'),
  ('Marketing', 'Foco em tráfego pago, redes sociais e calendário. Leitura em leads.'),
  ('Comercial', 'Foco em controle de leads e leads qualificados. Leitura no restante.'),
  ('Somente leitura', 'Visualização em todos os módulos, sem qualquer edição.')
on conflict (name) do nothing;

with v(profile_name, module_key, action, allowed) as (
  values
    -- Administrador: tudo liberado nos módulos reais e nos futuros (Eventos)
    ('Administrador','traffic','view',true), ('Administrador','traffic','edit_metrics',true),
    ('Administrador','traffic','manage_goals',true), ('Administrador','traffic','edit_observations',true),
    ('Administrador','social','view',true), ('Administrador','social','edit_metrics',true),
    ('Administrador','social','edit_content',true), ('Administrador','social','delete_content',true),
    ('Administrador','calendar','view',true), ('Administrador','calendar','add',true),
    ('Administrador','calendar','edit',true), ('Administrador','calendar','delete',true),
    ('Administrador','spreadsheets','view',true), ('Administrador','spreadsheets','upload',true),
    ('Administrador','spreadsheets','delete',true),
    ('Administrador','leads','view',true), ('Administrador','leads','upload',true),
    ('Administrador','leads','download',true), ('Administrador','leads','delete',true),
    ('Administrador','leads_control','view',true), ('Administrador','leads_control','add',true),
    ('Administrador','leads_control','edit',true), ('Administrador','leads_control','delete',true),
    ('Administrador','leads_control','import',true), ('Administrador','leads_control','export',true),
    ('Administrador','events_overview','view',true), ('Administrador','events_overview','edit',true),
    ('Administrador','events_participants','view',true), ('Administrador','events_participants','add',true),
    ('Administrador','events_participants','edit',true), ('Administrador','events_participants','delete',true),
    ('Administrador','events_participants','import',true), ('Administrador','events_participants','export',true),
    ('Administrador','events_participants','checkin',true),
    ('Administrador','events_finance','view',true), ('Administrador','events_finance','add',true),
    ('Administrador','events_finance','edit',true), ('Administrador','events_finance','delete',true),
    ('Administrador','events_finance','import',true), ('Administrador','events_finance','export',true),
    ('Administrador','events_form','view',true), ('Administrador','events_form','edit',true),
    ('Administrador','events_partners','view',true), ('Administrador','events_partners','add',true),
    ('Administrador','events_partners','edit',true), ('Administrador','events_partners','delete',true),
    ('Administrador','events_partners','export',true),

    -- Marketing
    ('Marketing','traffic','view',true), ('Marketing','traffic','edit_metrics',true),
    ('Marketing','traffic','manage_goals',true), ('Marketing','traffic','edit_observations',true),
    ('Marketing','social','view',true), ('Marketing','social','edit_metrics',true),
    ('Marketing','social','edit_content',true), ('Marketing','social','delete_content',true),
    ('Marketing','calendar','view',true), ('Marketing','calendar','add',true),
    ('Marketing','calendar','edit',true), ('Marketing','calendar','delete',true),
    ('Marketing','spreadsheets','view',true), ('Marketing','spreadsheets','upload',true),
    ('Marketing','leads','view',true), ('Marketing','leads','upload',true), ('Marketing','leads','download',true),
    ('Marketing','leads_control','view',true),
    ('Marketing','events_overview','view',true),
    ('Marketing','events_participants','view',true),
    ('Marketing','events_finance','view',true),
    ('Marketing','events_form','view',true),
    ('Marketing','events_partners','view',true),

    -- Comercial
    ('Comercial','traffic','view',true),
    ('Comercial','social','view',true),
    ('Comercial','calendar','view',true), ('Comercial','calendar','add',true),
    ('Comercial','spreadsheets','view',true),
    ('Comercial','leads','view',true), ('Comercial','leads','upload',true), ('Comercial','leads','download',true),
    ('Comercial','leads_control','view',true), ('Comercial','leads_control','add',true),
    ('Comercial','leads_control','edit',true), ('Comercial','leads_control','delete',true),
    ('Comercial','leads_control','import',true), ('Comercial','leads_control','export',true),
    ('Comercial','events_overview','view',true),
    ('Comercial','events_participants','view',true), ('Comercial','events_participants','add',true),
    ('Comercial','events_participants','edit',true), ('Comercial','events_participants','checkin',true),
    ('Comercial','events_finance','view',true),
    ('Comercial','events_form','view',true),
    ('Comercial','events_partners','view',true),

    -- Somente leitura: view em tudo, nada mais
    ('Somente leitura','traffic','view',true),
    ('Somente leitura','social','view',true),
    ('Somente leitura','calendar','view',true),
    ('Somente leitura','spreadsheets','view',true),
    ('Somente leitura','leads','view',true),
    ('Somente leitura','leads_control','view',true),
    ('Somente leitura','events_overview','view',true),
    ('Somente leitura','events_participants','view',true),
    ('Somente leitura','events_finance','view',true),
    ('Somente leitura','events_form','view',true),
    ('Somente leitura','events_partners','view',true)
)
insert into public.role_permissions (profile_id, module_key, action, allowed)
select pp.id, v.module_key, v.action, v.allowed
from v
join public.permission_profiles pp on pp.name = v.profile_name
on conflict (profile_id, module_key, action) do update set allowed = excluded.allowed;
