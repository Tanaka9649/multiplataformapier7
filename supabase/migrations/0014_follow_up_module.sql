-- =========================================================================
-- PIER7 Multiempresa — Módulo Follow-up
--
-- Área operacional de acompanhamento comercial sobre os leads já
-- cadastrados em `leads` (Controle de Leads). NÃO cria um novo cadastro
-- de lead: follow_up_records apenas registra histórico de contato para
-- um lead existente (lead_id). follow_up_scripts guarda os textos de
-- script por empresa + etapa + serviço de interesse (opcional).
--
-- Segue exatamente o mesmo padrão de RLS das demais tabelas de dados
-- (ver 0010_permissions.sql / 0012_permissions_hardening.sql):
-- has_permission(company_id, module_key, action) já embute
-- has_company_access (empresa liberada + conta ativa) e a cascata
-- override > perfil > negar. Privilégios de DML em anon/authenticated
-- já vêm dos default privileges do schema public (mesmo padrão de
-- `leads`, sem GRANT explícito) — a única barreira real é o RLS abaixo.
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1) follow_up_records — histórico de contatos (nunca sobrescrito)
-- ---------------------------------------------------------------------
create table if not exists public.follow_up_records (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  stage_number smallint not null default 1 check (stage_number >= 1),
  action_type text not null default 'whatsapp'
    check (action_type in ('whatsapp', 'ligacao', 'mensagem', 'outro')),
  completed_at date not null default current_date,
  completed_time time,
  responsible text not null default '',
  notes text not null default '',
  requires_next_contact boolean not null default false,
  next_contact_at date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint follow_up_records_next_contact_consistency
    check (not requires_next_contact or next_contact_at is not null)
);

-- Consultas mais comuns: histórico de um lead em ordem cronológica; lista
-- ativa por empresa; indicadores por data de próximo contato.
create index if not exists follow_up_records_lead_idx
  on public.follow_up_records (lead_id, completed_at desc, created_at desc);
create index if not exists follow_up_records_company_next_contact_idx
  on public.follow_up_records (company_id, next_contact_at);
create index if not exists follow_up_records_company_idx
  on public.follow_up_records (company_id, created_at desc);

drop trigger if exists set_updated_at on public.follow_up_records;
create trigger set_updated_at before update on public.follow_up_records
  for each row execute procedure public.set_updated_at();

alter table public.follow_up_records enable row level security;

drop policy if exists follow_up_records_select on public.follow_up_records;
drop policy if exists follow_up_records_insert on public.follow_up_records;
drop policy if exists follow_up_records_update on public.follow_up_records;
drop policy if exists follow_up_records_delete on public.follow_up_records;

create policy follow_up_records_select on public.follow_up_records
  for select using (public.has_permission(company_id, 'follow_up', 'view'));
create policy follow_up_records_insert on public.follow_up_records
  for insert with check (public.has_permission(company_id, 'follow_up', 'register'));
create policy follow_up_records_update on public.follow_up_records
  for update using (public.has_permission(company_id, 'follow_up', 'edit'))
  with check (public.has_permission(company_id, 'follow_up', 'edit'));
create policy follow_up_records_delete on public.follow_up_records
  for delete using (public.has_permission(company_id, 'follow_up', 'delete'));

-- ---------------------------------------------------------------------
-- 2) follow_up_scripts — textos de script configuráveis por empresa
-- ---------------------------------------------------------------------
create table if not exists public.follow_up_scripts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  service_interest text,
  stage_number smallint not null default 1 check (stage_number >= 1),
  content text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Evita dois scripts ativos ambíguos para a mesma empresa+etapa+serviço
-- (serviço vazio/NULL = script padrão da etapa).
create unique index if not exists follow_up_scripts_unique_active_idx
  on public.follow_up_scripts (company_id, stage_number, coalesce(service_interest, ''))
  where active;

create index if not exists follow_up_scripts_company_idx
  on public.follow_up_scripts (company_id, stage_number);

drop trigger if exists set_updated_at on public.follow_up_scripts;
create trigger set_updated_at before update on public.follow_up_scripts
  for each row execute procedure public.set_updated_at();

alter table public.follow_up_scripts enable row level security;

drop policy if exists follow_up_scripts_select on public.follow_up_scripts;
drop policy if exists follow_up_scripts_insert on public.follow_up_scripts;
drop policy if exists follow_up_scripts_update on public.follow_up_scripts;
drop policy if exists follow_up_scripts_delete on public.follow_up_scripts;

-- Leitura: qualquer usuário com acesso ao módulo (precisa ver o script
-- recomendado ao registrar um follow-up). Escrita: só quem tem a ação
-- dedicada 'configure_scripts' (área discreta e restrita do item 19).
create policy follow_up_scripts_select on public.follow_up_scripts
  for select using (public.has_permission(company_id, 'follow_up', 'view'));
create policy follow_up_scripts_insert on public.follow_up_scripts
  for insert with check (public.has_permission(company_id, 'follow_up', 'configure_scripts'));
create policy follow_up_scripts_update on public.follow_up_scripts
  for update using (public.has_permission(company_id, 'follow_up', 'configure_scripts'))
  with check (public.has_permission(company_id, 'follow_up', 'configure_scripts'));
create policy follow_up_scripts_delete on public.follow_up_scripts
  for delete using (public.has_permission(company_id, 'follow_up', 'configure_scripts'));

-- ---------------------------------------------------------------------
-- 3) Registro do módulo na matriz de permissões (mesmo padrão do
-- 0012_permissions_hardening.sql — perfis prontos existentes ganham
-- acesso coerente com o que já tinham em leads_control).
-- ---------------------------------------------------------------------
with v(profile_name, module_key, action, allowed) as (
  values
    ('Administrador','follow_up','view',true), ('Administrador','follow_up','register',true),
    ('Administrador','follow_up','edit',true), ('Administrador','follow_up','delete',true),
    ('Administrador','follow_up','configure_scripts',true),

    ('Marketing','follow_up','view',true),

    ('Comercial','follow_up','view',true), ('Comercial','follow_up','register',true),
    ('Comercial','follow_up','edit',true), ('Comercial','follow_up','delete',true),

    ('Somente leitura','follow_up','view',true)
)
insert into public.role_permissions (profile_id, module_key, action, allowed)
select pp.id, v.module_key, v.action, v.allowed
from v
join public.permission_profiles pp on pp.name = v.profile_name
on conflict (profile_id, module_key, action) do update set allowed = excluded.allowed;
