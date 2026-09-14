-- =========================================================================
-- PIER7 Multiempresa — Observação sobre os resultados (por empresa)
-- =========================================================================

create table if not exists public.company_observations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- unique(company_id) já cria um índice cobrindo a FK — não é preciso
-- outro índice separado para o mesmo propósito.

drop trigger if exists set_updated_at on public.company_observations;
create trigger set_updated_at before update on public.company_observations
  for each row execute procedure public.set_updated_at();

alter table public.company_observations enable row level security;

-- Mesmo padrão das demais tabelas com escopo por empresa (metric_values,
-- calendar_items etc.): uma única policy "for all" cobrindo select e
-- escrita, sem policy de select redundante.
drop policy if exists company_observations_select on public.company_observations;
drop policy if exists company_observations_write on public.company_observations;
create policy company_observations_write on public.company_observations
  for all using (public.has_company_access(company_id))
  with check (public.has_company_access(company_id));
