-- =========================================================================
-- PIER7 Multiempresa — Hardening de performance (achados INFO/WARN do
-- linter de performance do Supabase: FKs sem índice, políticas
-- permissivas duplicadas e auth.<fn>() reavaliado por linha).
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1) Índices cobrindo foreign keys
-- ---------------------------------------------------------------------
create index if not exists company_metric_config_metric_key_idx on public.company_metric_config (metric_key);
create index if not exists metric_values_metric_key_idx on public.metric_values (metric_key);
create index if not exists user_companies_company_id_idx on public.user_companies (company_id);

-- ---------------------------------------------------------------------
-- 2) Tabelas onde a policy "select" é subconjunto exato da policy
-- "for all": a policy de select é redundante (for all já cobre select
-- com a mesma condição) e só custa uma avaliação a mais por linha.
-- ---------------------------------------------------------------------
drop policy if exists company_metric_config_select on public.company_metric_config;
drop policy if exists metric_values_select on public.metric_values;
drop policy if exists calendar_items_select on public.calendar_items;
drop policy if exists spreadsheet_uploads_select on public.spreadsheet_uploads;
drop policy if exists qualified_lead_files_select on public.qualified_lead_files;

-- ---------------------------------------------------------------------
-- 3) companies: separa a policy de admin em insert/update/delete (a
-- leitura já é coberta por companies_select) e evita auth.uid() sendo
-- reavaliado linha a linha.
-- ---------------------------------------------------------------------
drop policy if exists companies_admin_write on public.companies;
create policy companies_admin_insert on public.companies
  for insert with check (public.is_admin((select auth.uid())));
create policy companies_admin_update on public.companies
  for update using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));
create policy companies_admin_delete on public.companies
  for delete using (public.is_admin((select auth.uid())));

-- ---------------------------------------------------------------------
-- 4) profiles
-- ---------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = (select auth.uid()) or public.is_admin((select auth.uid())));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_insert on public.profiles
  for insert with check (public.is_admin((select auth.uid())));
create policy profiles_admin_delete on public.profiles
  for delete using (public.is_admin((select auth.uid())));

-- ---------------------------------------------------------------------
-- 5) user_companies
-- ---------------------------------------------------------------------
drop policy if exists user_companies_select on public.user_companies;
create policy user_companies_select on public.user_companies
  for select using (user_id = (select auth.uid()) or public.is_admin((select auth.uid())));

drop policy if exists user_companies_admin_write on public.user_companies;
create policy user_companies_admin_insert on public.user_companies
  for insert with check (public.is_admin((select auth.uid())));
create policy user_companies_admin_update on public.user_companies
  for update using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));
create policy user_companies_admin_delete on public.user_companies
  for delete using (public.is_admin((select auth.uid())));

-- ---------------------------------------------------------------------
-- 6) metric_definitions
-- ---------------------------------------------------------------------
drop policy if exists metric_definitions_select on public.metric_definitions;
create policy metric_definitions_select on public.metric_definitions
  for select using ((select auth.role()) = 'authenticated');

drop policy if exists metric_definitions_admin_write on public.metric_definitions;
create policy metric_definitions_admin_insert on public.metric_definitions
  for insert with check (public.is_admin((select auth.uid())));
create policy metric_definitions_admin_update on public.metric_definitions
  for update using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));
create policy metric_definitions_admin_delete on public.metric_definitions
  for delete using (public.is_admin((select auth.uid())));
