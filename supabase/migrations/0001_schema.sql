-- =========================================================================
-- PIER7 Multiempresa — Schema inicial
-- =========================================================================
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_path text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- profiles (espelha auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

-- cria profile automaticamente quando um usuário se cadastra.
-- o primeiro usuário do sistema vira admin e ganha acesso a todas as
-- empresas já cadastradas (bootstrap — não há convite/gestão de usuários
-- na UI ainda; novos usuários após o primeiro entram sem empresas
-- vinculadas e precisam ser liberados manualmente em user_companies).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  is_first boolean;
begin
  select not exists (select 1 from public.profiles) into is_first;

  insert into public.profiles (id, email, role)
  values (new.id, new.email, case when is_first then 'admin' else 'member' end)
  on conflict (id) do nothing;

  if is_first then
    insert into public.user_companies (user_id, company_id)
    select new.id, c.id from public.companies c
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------
-- user_companies (empresas autorizadas por usuário)
-- ---------------------------------------------------------------------
create table if not exists public.user_companies (
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

-- ---------------------------------------------------------------------
-- metric_definitions (catálogo global de métricas possíveis)
-- ---------------------------------------------------------------------
create table if not exists public.metric_definitions (
  key text primary key,
  label text not null,
  format text not null check (format in ('currency', 'integer', 'percentage')),
  sort_order int not null default 0
);

-- ---------------------------------------------------------------------
-- company_metric_config (quais métricas cada empresa exibe, e como)
-- ---------------------------------------------------------------------
create table if not exists public.company_metric_config (
  company_id uuid not null references public.companies(id) on delete cascade,
  metric_key text not null references public.metric_definitions(key) on delete cascade,
  visible boolean not null default true,
  label_override text,
  sort_order int not null default 0,
  primary key (company_id, metric_key)
);

-- ---------------------------------------------------------------------
-- metric_values (valores atuais de cada métrica por empresa)
-- ---------------------------------------------------------------------
create table if not exists public.metric_values (
  company_id uuid not null references public.companies(id) on delete cascade,
  metric_key text not null references public.metric_definitions(key) on delete cascade,
  value numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (company_id, metric_key)
);

-- ---------------------------------------------------------------------
-- calendar_items
-- ---------------------------------------------------------------------
create table if not exists public.calendar_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  date date not null,
  type text not null check (type in ('reels', 'story', 'post', 'tarefa')),
  status text not null default 'pendente' check (status in ('pendente', 'concluido', 'atrasado')),
  description text,
  objective text,
  responsible text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists calendar_items_company_date_idx on public.calendar_items (company_id, date);

-- ---------------------------------------------------------------------
-- spreadsheet_uploads
-- ---------------------------------------------------------------------
create table if not exists public.spreadsheet_uploads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  storage_path text not null,
  period_start date,
  period_end date,
  description text,
  created_at timestamptz not null default now()
);
create index if not exists spreadsheet_uploads_company_idx on public.spreadsheet_uploads (company_id, created_at desc);

-- ---------------------------------------------------------------------
-- qualified_lead_files
-- ---------------------------------------------------------------------
create table if not exists public.qualified_lead_files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index if not exists qualified_lead_files_company_idx on public.qualified_lead_files (company_id, created_at desc);

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.calendar_items;
create trigger set_updated_at before update on public.calendar_items
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at on public.metric_values;
create trigger set_updated_at before update on public.metric_values
  for each row execute procedure public.set_updated_at();
