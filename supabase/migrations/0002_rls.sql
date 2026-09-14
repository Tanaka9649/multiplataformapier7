-- =========================================================================
-- PIER7 Multiempresa — RLS
-- =========================================================================

-- ---------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = uid and p.role = 'admin'
  );
$$;

create or replace function public.has_company_access(cid uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select
    public.is_admin(auth.uid())
    or exists (
      select 1 from public.user_companies uc
      where uc.user_id = auth.uid() and uc.company_id = cid
    );
$$;

-- ---------------------------------------------------------------------
-- Habilita RLS
-- ---------------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.user_companies enable row level security;
alter table public.metric_definitions enable row level security;
alter table public.company_metric_config enable row level security;
alter table public.metric_values enable row level security;
alter table public.calendar_items enable row level security;
alter table public.spreadsheet_uploads enable row level security;
alter table public.qualified_lead_files enable row level security;

-- ---------------------------------------------------------------------
-- companies: usuário vê só empresas autorizadas (ou admin vê todas)
-- ---------------------------------------------------------------------
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
  for select using (public.has_company_access(id));

drop policy if exists companies_admin_write on public.companies;
create policy companies_admin_write on public.companies
  for all using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- profiles: usuário vê e edita o próprio perfil; admin vê todos
-- ---------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- user_companies: usuário vê os próprios vínculos; só admin gerencia
-- ---------------------------------------------------------------------
drop policy if exists user_companies_select on public.user_companies;
create policy user_companies_select on public.user_companies
  for select using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists user_companies_admin_write on public.user_companies;
create policy user_companies_admin_write on public.user_companies
  for all using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- metric_definitions: catálogo global, leitura para qualquer autenticado
-- ---------------------------------------------------------------------
drop policy if exists metric_definitions_select on public.metric_definitions;
create policy metric_definitions_select on public.metric_definitions
  for select using (auth.role() = 'authenticated');

drop policy if exists metric_definitions_admin_write on public.metric_definitions;
create policy metric_definitions_admin_write on public.metric_definitions
  for all using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- company_metric_config: escopo por empresa
-- ---------------------------------------------------------------------
drop policy if exists company_metric_config_select on public.company_metric_config;
create policy company_metric_config_select on public.company_metric_config
  for select using (public.has_company_access(company_id));

drop policy if exists company_metric_config_write on public.company_metric_config;
create policy company_metric_config_write on public.company_metric_config
  for all using (public.has_company_access(company_id))
  with check (public.has_company_access(company_id));

-- ---------------------------------------------------------------------
-- metric_values: escopo por empresa
-- ---------------------------------------------------------------------
drop policy if exists metric_values_select on public.metric_values;
create policy metric_values_select on public.metric_values
  for select using (public.has_company_access(company_id));

drop policy if exists metric_values_write on public.metric_values;
create policy metric_values_write on public.metric_values
  for all using (public.has_company_access(company_id))
  with check (public.has_company_access(company_id));

-- ---------------------------------------------------------------------
-- calendar_items: escopo por empresa
-- ---------------------------------------------------------------------
drop policy if exists calendar_items_select on public.calendar_items;
create policy calendar_items_select on public.calendar_items
  for select using (public.has_company_access(company_id));

drop policy if exists calendar_items_write on public.calendar_items;
create policy calendar_items_write on public.calendar_items
  for all using (public.has_company_access(company_id))
  with check (public.has_company_access(company_id));

-- ---------------------------------------------------------------------
-- spreadsheet_uploads: escopo por empresa
-- ---------------------------------------------------------------------
drop policy if exists spreadsheet_uploads_select on public.spreadsheet_uploads;
create policy spreadsheet_uploads_select on public.spreadsheet_uploads
  for select using (public.has_company_access(company_id));

drop policy if exists spreadsheet_uploads_write on public.spreadsheet_uploads;
create policy spreadsheet_uploads_write on public.spreadsheet_uploads
  for all using (public.has_company_access(company_id))
  with check (public.has_company_access(company_id));

-- ---------------------------------------------------------------------
-- qualified_lead_files: escopo por empresa
-- ---------------------------------------------------------------------
drop policy if exists qualified_lead_files_select on public.qualified_lead_files;
create policy qualified_lead_files_select on public.qualified_lead_files
  for select using (public.has_company_access(company_id));

drop policy if exists qualified_lead_files_write on public.qualified_lead_files;
create policy qualified_lead_files_write on public.qualified_lead_files
  for all using (public.has_company_access(company_id))
  with check (public.has_company_access(company_id));

-- =========================================================================
-- Storage — buckets e políticas
-- O primeiro segmento do path do arquivo é sempre o company_id, ex.:
--   spreadsheet-images/<company_id>/<uuid>-<nome>.png
--   qualified-leads/<company_id>/<uuid>-<nome>.csv
-- =========================================================================
insert into storage.buckets (id, name, public)
values ('spreadsheet-images', 'spreadsheet-images', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('qualified-leads', 'qualified-leads', false)
on conflict (id) do nothing;

drop policy if exists spreadsheet_images_rw on storage.objects;
create policy spreadsheet_images_rw on storage.objects
  for all using (
    bucket_id = 'spreadsheet-images'
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'spreadsheet-images'
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists qualified_leads_rw on storage.objects;
create policy qualified_leads_rw on storage.objects
  for all using (
    bucket_id = 'qualified-leads'
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'qualified-leads'
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
  );
