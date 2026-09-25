-- =========================================================================
-- PIER7 Multiempresa — evolução do Follow-up
--
-- Mantém os registros e scripts existentes e acrescenta:
--   * quantidade de etapas configurável por empresa (default atual: 6);
--   * playbook geral ou específico por serviço, com fallback no cliente;
--   * ciclo/outcome de encerramento sem apagar o histórico;
--   * encerramento atômico que também atualiza a situação do lead;
--   * edição de scripts/playbooks vinculada à permissão follow_up:edit.
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1) Configuração extensível de etapas
-- ---------------------------------------------------------------------
drop view if exists public.follow_up_lead_summary;

alter table public.follow_up_records
  alter column stage_number type integer using stage_number::integer;
alter table public.follow_up_scripts
  alter column stage_number type integer using stage_number::integer;

create table if not exists public.follow_up_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  max_stage integer not null default 6 check (max_stage >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.follow_up_settings (company_id, max_stage)
select id, 6 from public.companies
on conflict (company_id) do nothing;

drop trigger if exists set_updated_at on public.follow_up_settings;
create trigger set_updated_at before update on public.follow_up_settings
  for each row execute procedure public.set_updated_at();

alter table public.follow_up_settings enable row level security;

drop policy if exists follow_up_settings_select on public.follow_up_settings;
drop policy if exists follow_up_settings_insert on public.follow_up_settings;
drop policy if exists follow_up_settings_update on public.follow_up_settings;
create policy follow_up_settings_select on public.follow_up_settings
  for select to authenticated
  using (public.has_permission(company_id, 'follow_up', 'view'));
create policy follow_up_settings_insert on public.follow_up_settings
  for insert to authenticated
  with check (public.has_permission(company_id, 'follow_up', 'edit'));
create policy follow_up_settings_update on public.follow_up_settings
  for update to authenticated
  using (public.has_permission(company_id, 'follow_up', 'edit'))
  with check (public.has_permission(company_id, 'follow_up', 'edit'));

grant select, insert, update on public.follow_up_settings to authenticated;

-- ---------------------------------------------------------------------
-- 2) Playbook por empresa e, opcionalmente, serviço
-- ---------------------------------------------------------------------
create table if not exists public.follow_up_playbooks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  service_interest text,
  content text not null default '',
  active boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists follow_up_playbooks_unique_active_idx
  on public.follow_up_playbooks (
    company_id,
    lower(coalesce(nullif(btrim(service_interest), ''), ''))
  )
  where active;

create index if not exists follow_up_playbooks_company_idx
  on public.follow_up_playbooks (company_id, updated_at desc);
create index if not exists follow_up_playbooks_updated_by_idx
  on public.follow_up_playbooks (updated_by);

create or replace function public.set_follow_up_editor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_by = (select auth.uid());
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_follow_up_editor() from public, anon, authenticated;

drop trigger if exists set_follow_up_editor on public.follow_up_playbooks;
create trigger set_follow_up_editor
  before insert or update on public.follow_up_playbooks
  for each row execute procedure public.set_follow_up_editor();

alter table public.follow_up_playbooks enable row level security;

drop policy if exists follow_up_playbooks_select on public.follow_up_playbooks;
drop policy if exists follow_up_playbooks_insert on public.follow_up_playbooks;
drop policy if exists follow_up_playbooks_update on public.follow_up_playbooks;
drop policy if exists follow_up_playbooks_delete on public.follow_up_playbooks;
create policy follow_up_playbooks_select on public.follow_up_playbooks
  for select to authenticated
  using (public.has_permission(company_id, 'follow_up', 'view'));
create policy follow_up_playbooks_insert on public.follow_up_playbooks
  for insert to authenticated
  with check (public.has_permission(company_id, 'follow_up', 'edit'));
create policy follow_up_playbooks_update on public.follow_up_playbooks
  for update to authenticated
  using (public.has_permission(company_id, 'follow_up', 'edit'))
  with check (public.has_permission(company_id, 'follow_up', 'edit'));
create policy follow_up_playbooks_delete on public.follow_up_playbooks
  for delete to authenticated
  using (public.has_permission(company_id, 'follow_up', 'edit'));

grant select, insert, update, delete on public.follow_up_playbooks to authenticated;

-- ---------------------------------------------------------------------
-- 3) Ciclo e resultado do Follow-up
-- ---------------------------------------------------------------------
create table if not exists public.follow_up_cycles (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed')),
  outcome text check (outcome in ('success', 'no_response')),
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint follow_up_cycles_completion_consistency check (
    (status = 'active' and outcome is null and completed_at is null)
    or
    (status = 'completed' and outcome is not null and completed_at is not null)
  )
);

create unique index if not exists follow_up_cycles_one_active_per_lead_idx
  on public.follow_up_cycles (lead_id)
  where status = 'active';
create index if not exists follow_up_cycles_company_status_idx
  on public.follow_up_cycles (company_id, status, completed_at desc);
create index if not exists follow_up_cycles_completed_by_idx
  on public.follow_up_cycles (completed_by);

drop trigger if exists set_updated_at on public.follow_up_cycles;
create trigger set_updated_at before update on public.follow_up_cycles
  for each row execute procedure public.set_updated_at();

alter table public.follow_up_cycles enable row level security;

drop policy if exists follow_up_cycles_select on public.follow_up_cycles;
create policy follow_up_cycles_select on public.follow_up_cycles
  for select to authenticated
  using (public.has_permission(company_id, 'follow_up', 'view'));

-- Criação/encerramento operacional passa pela função abaixo para que
-- ciclo e situação do lead sejam alterados na mesma transação.
grant select on public.follow_up_cycles to authenticated;

create or replace function public.close_follow_up_cycle(p_lead_id uuid, p_outcome text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_company_id uuid;
  v_cycle_id uuid;
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;
  if p_outcome not in ('success', 'no_response') then
    raise exception 'Resultado de follow-up inválido.' using errcode = '22023';
  end if;

  select l.company_id into v_company_id
  from public.leads l
  where l.id = p_lead_id
  for update;

  if v_company_id is null then
    raise exception 'Lead não encontrado.' using errcode = 'P0002';
  end if;
  if not public.has_permission(v_company_id, 'follow_up', 'edit') then
    raise exception 'Sem permissão para encerrar este follow-up.' using errcode = '42501';
  end if;

  update public.follow_up_cycles
  set status = 'completed',
      outcome = p_outcome,
      completed_at = now(),
      completed_by = v_uid
  where lead_id = p_lead_id and status = 'active'
  returning id into v_cycle_id;

  if v_cycle_id is null then
    insert into public.follow_up_cycles (
      lead_id, company_id, status, outcome, completed_at, completed_by
    ) values (
      p_lead_id, v_company_id, 'completed', p_outcome, now(), v_uid
    )
    returning id into v_cycle_id;
  end if;

  update public.leads
  set status = case when p_outcome = 'success' then 'reuniao_marcada' else 'abandonou' end,
      updated_at = now()
  where id = p_lead_id;

  return v_cycle_id;
end;
$$;

revoke execute on function public.close_follow_up_cycle(uuid, text) from public, anon, authenticated;
grant execute on function public.close_follow_up_cycle(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4) Scripts usam a mesma permissão de edição do módulo
-- ---------------------------------------------------------------------
drop policy if exists follow_up_scripts_insert on public.follow_up_scripts;
drop policy if exists follow_up_scripts_update on public.follow_up_scripts;
drop policy if exists follow_up_scripts_delete on public.follow_up_scripts;

create policy follow_up_scripts_insert on public.follow_up_scripts
  for insert to authenticated
  with check (public.has_permission(company_id, 'follow_up', 'edit'));
create policy follow_up_scripts_update on public.follow_up_scripts
  for update to authenticated
  using (public.has_permission(company_id, 'follow_up', 'edit'))
  with check (public.has_permission(company_id, 'follow_up', 'edit'));
create policy follow_up_scripts_delete on public.follow_up_scripts
  for delete to authenticated
  using (public.has_permission(company_id, 'follow_up', 'edit'));

delete from public.user_permission_overrides
where module_key = 'follow_up' and action = 'configure_scripts';
delete from public.role_permissions
where module_key = 'follow_up' and action = 'configure_scripts';

-- Redes Sociais: separar adicionar e editar conteúdo sem alterar os
-- presets já existentes. Quem podia editar continua podendo adicionar.
insert into public.role_permissions (profile_id, module_key, action, allowed)
select profile_id, 'social', 'add_content', allowed
from public.role_permissions
where module_key = 'social' and action = 'edit_content'
on conflict (profile_id, module_key, action) do update set allowed = excluded.allowed;

drop policy if exists social_top_contents_insert on public.social_top_contents;
create policy social_top_contents_insert on public.social_top_contents
  for insert to authenticated
  with check (public.has_permission(company_id, 'social', 'add_content'));

-- Storage também respeita as ações granulares; esconder botões não é
-- uma barreira de segurança.
drop policy if exists spreadsheet_images_rw on storage.objects;
drop policy if exists spreadsheet_images_select on storage.objects;
drop policy if exists spreadsheet_images_insert on storage.objects;
drop policy if exists spreadsheet_images_update on storage.objects;
drop policy if exists spreadsheet_images_delete on storage.objects;
create policy spreadsheet_images_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'spreadsheet-images'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'spreadsheets', 'view')
  );
create policy spreadsheet_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'spreadsheet-images'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'spreadsheets', 'upload')
  );
create policy spreadsheet_images_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'spreadsheet-images'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'spreadsheets', 'upload')
  )
  with check (
    bucket_id = 'spreadsheet-images'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'spreadsheets', 'upload')
  );
create policy spreadsheet_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'spreadsheet-images'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'spreadsheets', 'delete')
  );

drop policy if exists qualified_leads_rw on storage.objects;
drop policy if exists qualified_leads_select on storage.objects;
drop policy if exists qualified_leads_insert on storage.objects;
drop policy if exists qualified_leads_delete on storage.objects;
create policy qualified_leads_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'qualified-leads'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'leads', 'view')
  );
create policy qualified_leads_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'qualified-leads'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'leads', 'upload')
  );
create policy qualified_leads_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'qualified-leads'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'leads', 'delete')
  );

drop policy if exists social_content_rw on storage.objects;
drop policy if exists social_content_select on storage.objects;
drop policy if exists social_content_insert on storage.objects;
drop policy if exists social_content_update on storage.objects;
drop policy if exists social_content_delete on storage.objects;
create policy social_content_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'social-content'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'social', 'view')
  );
create policy social_content_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'social-content'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'social', 'add_content')
  );
create policy social_content_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'social-content'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'social', 'edit_content')
  )
  with check (
    bucket_id = 'social-content'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'social', 'edit_content')
  );
create policy social_content_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'social-content'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'social', 'delete_content')
  );

-- ---------------------------------------------------------------------
-- 5) Resumo do lead passa a expor o outcome mais recente
-- ---------------------------------------------------------------------
create or replace view public.follow_up_lead_summary
with (security_invoker = true) as
select
  l.id as lead_id,
  l.company_id,
  l.name,
  l.phone,
  l.service_interest,
  l.responsible,
  l.status,
  latest.stage_number as current_stage,
  latest.completed_at as last_contact_at,
  case when latest.requires_next_contact then latest.next_contact_at else null end as next_contact_at,
  latest.notes as last_notes,
  cycle.status as cycle_status,
  cycle.outcome,
  cycle.completed_at as cycle_completed_at
from public.leads l
left join lateral (
  select r.stage_number, r.completed_at, r.requires_next_contact, r.next_contact_at, r.notes
  from public.follow_up_records r
  where r.lead_id = l.id
  order by r.completed_at desc, r.created_at desc
  limit 1
) latest on true
left join lateral (
  select c.status, c.outcome, c.completed_at
  from public.follow_up_cycles c
  where c.lead_id = l.id
  order by c.completed_at desc nulls last, c.created_at desc
  limit 1
) cycle on true;

grant select on public.follow_up_lead_summary to authenticated;
