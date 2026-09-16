-- =========================================================================
-- PIER7 Multiempresa — Redes Sociais
-- Preenchimento manual nesta primeira versão; estrutura pensada para
-- permitir integrações automáticas futuras (Meta/TikTok/YouTube APIs)
-- sem refazer o módulo: cada linha já é escopada por
-- company_id + network + year + month.
-- =========================================================================

-- ---------------------------------------------------------------------
-- social_media_periods — métricas mensais por empresa + rede
-- ---------------------------------------------------------------------
create table if not exists public.social_media_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  network text not null check (network in ('instagram', 'tiktok', 'youtube')),
  year int not null check (year between 2020 and 2100),
  month int not null check (month between 1 and 12),

  -- métricas de audiência/engajamento — nulas quando não usadas pela rede
  followers bigint,
  new_followers bigint,
  reach bigint,
  impressions bigint,
  profile_views bigint,
  link_clicks bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  watch_hours numeric,

  -- produção do mês
  reels_count int,
  carousel_count int,
  static_posts_count int,
  stories_count int,
  videos_count int,
  shorts_count int,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (company_id, network, year, month)
);
create index if not exists social_media_periods_company_idx
  on public.social_media_periods (company_id, network, year, month);

drop trigger if exists set_updated_at on public.social_media_periods;
create trigger set_updated_at before update on public.social_media_periods
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- social_story_weeks — média semanal de visualizações dos Stories
-- (Instagram apenas; média mensal é calculada na aplicação)
-- ---------------------------------------------------------------------
create table if not exists public.social_story_weeks (
  id uuid primary key default gen_random_uuid(),
  social_period_id uuid not null references public.social_media_periods(id) on delete cascade,
  week_number int not null check (week_number between 1 and 6),
  average_views bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (social_period_id, week_number)
);
create index if not exists social_story_weeks_period_idx
  on public.social_story_weeks (social_period_id);

drop trigger if exists set_updated_at on public.social_story_weeks;
create trigger set_updated_at before update on public.social_story_weeks
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- social_top_contents — conteúdos com melhor resultado (curadoria manual)
-- ---------------------------------------------------------------------
create table if not exists public.social_top_contents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  network text not null check (network in ('instagram', 'tiktok', 'youtube')),
  year int not null check (year between 2020 and 2100),
  month int not null check (month between 1 and 12),
  content_type text not null check (content_type in ('reel', 'carrossel', 'post', 'video', 'short')),

  title text not null,
  url text not null,
  thumbnail_url text,
  thumbnail_storage_path text,
  published_at date,

  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  notes text,

  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists social_top_contents_company_idx
  on public.social_top_contents (company_id, network, year, month, sort_order);

drop trigger if exists set_updated_at on public.social_top_contents;
create trigger set_updated_at before update on public.social_top_contents
  for each row execute procedure public.set_updated_at();

-- =========================================================================
-- RLS — reaproveita has_company_access(uuid) já existente
-- =========================================================================
alter table public.social_media_periods enable row level security;
alter table public.social_story_weeks enable row level security;
alter table public.social_top_contents enable row level security;

drop policy if exists social_media_periods_select on public.social_media_periods;
create policy social_media_periods_select on public.social_media_periods
  for select using (public.has_company_access(company_id));

drop policy if exists social_media_periods_write on public.social_media_periods;
create policy social_media_periods_write on public.social_media_periods
  for all using (public.has_company_access(company_id))
  with check (public.has_company_access(company_id));

drop policy if exists social_story_weeks_select on public.social_story_weeks;
create policy social_story_weeks_select on public.social_story_weeks
  for select using (
    exists (
      select 1 from public.social_media_periods p
      where p.id = social_period_id and public.has_company_access(p.company_id)
    )
  );

drop policy if exists social_story_weeks_write on public.social_story_weeks;
create policy social_story_weeks_write on public.social_story_weeks
  for all using (
    exists (
      select 1 from public.social_media_periods p
      where p.id = social_period_id and public.has_company_access(p.company_id)
    )
  )
  with check (
    exists (
      select 1 from public.social_media_periods p
      where p.id = social_period_id and public.has_company_access(p.company_id)
    )
  );

drop policy if exists social_top_contents_select on public.social_top_contents;
create policy social_top_contents_select on public.social_top_contents
  for select using (public.has_company_access(company_id));

drop policy if exists social_top_contents_write on public.social_top_contents;
create policy social_top_contents_write on public.social_top_contents
  for all using (public.has_company_access(company_id))
  with check (public.has_company_access(company_id));

-- =========================================================================
-- Storage — capas de conteúdo (thumbnails)
-- Primeiro segmento do path é sempre o company_id, ex.:
--   social-content/<company_id>/<network>/<year>/<month>/<uuid>.jpg
-- =========================================================================
insert into storage.buckets (id, name, public)
values ('social-content', 'social-content', false)
on conflict (id) do nothing;

drop policy if exists social_content_rw on storage.objects;
create policy social_content_rw on storage.objects
  for all using (
    bucket_id = 'social-content'
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'social-content'
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
  );
