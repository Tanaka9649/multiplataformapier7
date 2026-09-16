-- =========================================================================
-- PIER7 Multiempresa — Hardening de performance para as tabelas novas de
-- permissões (mesmo padrão do 0005_performance_hardening.sql: evita
-- auth.<fn>() reavaliado por linha e policies de select redundantes).
-- =========================================================================

-- company_metric_config: a policy "for all" do owner cobria select de
-- novo, duplicando company_metric_config_select. Restringe a de escrita
-- a insert/update/delete.
drop policy if exists company_metric_config_owner_write on public.company_metric_config;
create policy company_metric_config_owner_insert on public.company_metric_config
  for insert with check (public.is_owner((select auth.uid())));
create policy company_metric_config_owner_update on public.company_metric_config
  for update using (public.is_owner((select auth.uid()))) with check (public.is_owner((select auth.uid())));
create policy company_metric_config_owner_delete on public.company_metric_config
  for delete using (public.is_owner((select auth.uid())));

-- social_story_weeks: mesma duplicação entre a "for all" e a de select.
drop policy if exists social_story_weeks_all on public.social_story_weeks;
create policy social_story_weeks_insert on public.social_story_weeks
  for insert with check (
    exists (
      select 1 from public.social_media_periods p
      where p.id = social_period_id and public.has_permission(p.company_id, 'social', 'edit_metrics')
    )
  );
create policy social_story_weeks_update on public.social_story_weeks
  for update using (
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
create policy social_story_weeks_delete on public.social_story_weeks
  for delete using (
    exists (
      select 1 from public.social_media_periods p
      where p.id = social_period_id and public.has_permission(p.company_id, 'social', 'edit_metrics')
    )
  );

-- Tabelas exclusivas do Owner: auth.uid() envolto em (select ...) para
-- não ser reavaliado por linha.
drop policy if exists permission_profiles_owner on public.permission_profiles;
create policy permission_profiles_owner on public.permission_profiles
  for all using (public.is_owner((select auth.uid()))) with check (public.is_owner((select auth.uid())));

drop policy if exists role_permissions_owner on public.role_permissions;
create policy role_permissions_owner on public.role_permissions
  for all using (public.is_owner((select auth.uid()))) with check (public.is_owner((select auth.uid())));

drop policy if exists user_permission_overrides_owner on public.user_permission_overrides;
create policy user_permission_overrides_owner on public.user_permission_overrides
  for all using (public.is_owner((select auth.uid()))) with check (public.is_owner((select auth.uid())));

drop policy if exists admin_audit_logs_owner on public.admin_audit_logs;
create policy admin_audit_logs_owner on public.admin_audit_logs
  for all using (public.is_owner((select auth.uid()))) with check (public.is_owner((select auth.uid())));

-- Índice cobrindo a FK que ficou sem (achado do linter de performance).
create index if not exists admin_audit_logs_actor_idx on public.admin_audit_logs (actor_user_id);
create index if not exists profiles_approved_by_idx on public.profiles (approved_by);
create index if not exists profiles_permission_profile_idx on public.profiles (permission_profile_id);
create index if not exists user_permission_overrides_company_idx on public.user_permission_overrides (company_id);
