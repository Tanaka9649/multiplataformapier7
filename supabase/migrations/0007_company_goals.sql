-- =========================================================================
-- PIER7 Multiempresa — Medidor de metas (por empresa)
-- =========================================================================

create table if not exists public.company_goals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  metric_key text references public.metric_definitions(key) on delete set null,
  value_source text not null default 'metric' check (value_source in ('metric', 'manual')),
  manual_current_value numeric,
  target_value numeric not null check (target_value > 0),
  period_start date,
  period_end date,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_goals_company_id_idx on public.company_goals (company_id, sort_order);
create index if not exists company_goals_metric_key_idx on public.company_goals (metric_key);

drop trigger if exists set_updated_at on public.company_goals;
create trigger set_updated_at before update on public.company_goals
  for each row execute procedure public.set_updated_at();

alter table public.company_goals enable row level security;

-- Mesmo padrão das demais tabelas com escopo por empresa: uma única
-- policy "for all" usando has_company_access, sem policy de select
-- redundante.
drop policy if exists company_goals_select on public.company_goals;
drop policy if exists company_goals_write on public.company_goals;
create policy company_goals_write on public.company_goals
  for all using (public.has_company_access(company_id))
  with check (public.has_company_access(company_id));
