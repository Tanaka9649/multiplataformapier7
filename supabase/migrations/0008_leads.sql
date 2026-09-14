-- =========================================================================
-- PIER7 Multiempresa — Controle de Leads (planilha por empresa)
-- =========================================================================

create extension if not exists pg_trgm;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entry_date date not null default current_date,
  name text not null default '',
  phone text not null default '',
  service_interest text not null default '',
  origin text not null default 'instagram'
    check (origin in ('instagram', 'evento', 'prospeccao', 'trafego_pago')),
  responsible text not null default '',
  qualification smallint not null default 1 check (qualification between 1 and 5),
  status text not null default 'conversando'
    check (status in ('abandonou', 'conversando', 'reuniao_marcada', 'contrato_fechado')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Filtros e ordenação mais comuns: por empresa + data de entrada (ordem
-- padrão da planilha), e por empresa + cada campo de filtro.
create index if not exists leads_company_entry_date_idx
  on public.leads (company_id, entry_date desc);
create index if not exists leads_company_origin_idx
  on public.leads (company_id, origin);
create index if not exists leads_company_qualification_idx
  on public.leads (company_id, qualification);
create index if not exists leads_company_status_idx
  on public.leads (company_id, status);

-- Pesquisa por nome/telefone em tabelas grandes: trigram + GIN é a
-- estratégia padrão do Postgres para ILIKE '%...%' performático.
create index if not exists leads_name_trgm_idx
  on public.leads using gin (name gin_trgm_ops);
create index if not exists leads_phone_trgm_idx
  on public.leads using gin (phone gin_trgm_ops);

drop trigger if exists set_updated_at on public.leads;
create trigger set_updated_at before update on public.leads
  for each row execute procedure public.set_updated_at();

alter table public.leads enable row level security;

drop policy if exists leads_select on public.leads;
drop policy if exists leads_write on public.leads;
create policy leads_write on public.leads
  for all using (public.has_company_access(company_id))
  with check (public.has_company_access(company_id));
