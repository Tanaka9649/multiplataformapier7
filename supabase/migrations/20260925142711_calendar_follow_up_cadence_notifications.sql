-- =========================================================================
-- PIER7 — Calendário, cadência de Follow-up e notificações internas
-- =========================================================================

-- Fase 1 — título obrigatório no Calendário, preservando itens existentes.
alter table public.calendar_items add column if not exists title text;

update public.calendar_items
set title = coalesce(
  nullif(btrim(description), ''),
  case type
    when 'reels' then 'Vídeo para Reels'
    when 'story' then 'Story'
    when 'post' then 'Post estático'
    else 'Tarefa'
  end
)
where title is null or btrim(title) = '';

alter table public.calendar_items alter column title set not null;
alter table public.calendar_items drop constraint if exists calendar_items_title_not_blank;
alter table public.calendar_items
  add constraint calendar_items_title_not_blank check (btrim(title) <> '');

-- Fase 3 — modelos de cadência e snapshot imutável por ciclo.
drop view if exists public.follow_up_lead_summary;

create table if not exists public.follow_up_cadences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null default 'Cadência padrão',
  service_interest text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint follow_up_cadences_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists follow_up_cadences_active_service_idx
  on public.follow_up_cadences (company_id, lower(coalesce(nullif(btrim(service_interest), ''), '')))
  where active;
create index if not exists follow_up_cadences_company_idx
  on public.follow_up_cadences (company_id, active);

create table if not exists public.follow_up_cadence_stages (
  id uuid primary key default gen_random_uuid(),
  cadence_id uuid not null references public.follow_up_cadences(id) on delete cascade,
  stage_number integer not null check (stage_number >= 1),
  delay_min_hours integer not null check (delay_min_hours >= 0),
  delay_max_hours integer not null check (delay_max_hours >= delay_min_hours),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cadence_id, stage_number)
);

create index if not exists follow_up_cadence_stages_cadence_idx
  on public.follow_up_cadence_stages (cadence_id, stage_number);

drop trigger if exists set_updated_at on public.follow_up_cadences;
create trigger set_updated_at before update on public.follow_up_cadences
  for each row execute procedure public.set_updated_at();
drop trigger if exists set_updated_at on public.follow_up_cadence_stages;
create trigger set_updated_at before update on public.follow_up_cadence_stages
  for each row execute procedure public.set_updated_at();

alter table public.follow_up_cadences enable row level security;
alter table public.follow_up_cadence_stages enable row level security;

create policy follow_up_cadences_select on public.follow_up_cadences
  for select to authenticated using (public.has_permission(company_id, 'follow_up', 'view'));
create policy follow_up_cadences_insert on public.follow_up_cadences
  for insert to authenticated with check (public.has_permission(company_id, 'follow_up', 'edit'));
create policy follow_up_cadences_update on public.follow_up_cadences
  for update to authenticated using (public.has_permission(company_id, 'follow_up', 'edit'))
  with check (public.has_permission(company_id, 'follow_up', 'edit'));
create policy follow_up_cadences_delete on public.follow_up_cadences
  for delete to authenticated using (public.has_permission(company_id, 'follow_up', 'edit'));

create policy follow_up_cadence_stages_select on public.follow_up_cadence_stages
  for select to authenticated using (
    exists (select 1 from public.follow_up_cadences c where c.id = cadence_id
      and public.has_permission(c.company_id, 'follow_up', 'view'))
  );
create policy follow_up_cadence_stages_insert on public.follow_up_cadence_stages
  for insert to authenticated with check (
    exists (select 1 from public.follow_up_cadences c where c.id = cadence_id
      and public.has_permission(c.company_id, 'follow_up', 'edit'))
  );
create policy follow_up_cadence_stages_update on public.follow_up_cadence_stages
  for update to authenticated using (
    exists (select 1 from public.follow_up_cadences c where c.id = cadence_id
      and public.has_permission(c.company_id, 'follow_up', 'edit'))
  ) with check (
    exists (select 1 from public.follow_up_cadences c where c.id = cadence_id
      and public.has_permission(c.company_id, 'follow_up', 'edit'))
  );
create policy follow_up_cadence_stages_delete on public.follow_up_cadence_stages
  for delete to authenticated using (
    exists (select 1 from public.follow_up_cadences c where c.id = cadence_id
      and public.has_permission(c.company_id, 'follow_up', 'edit'))
  );

grant select, insert, update, delete on public.follow_up_cadences to authenticated;
grant select, insert, update, delete on public.follow_up_cadence_stages to authenticated;

with inserted as (
  insert into public.follow_up_cadences (company_id, name, service_interest)
  select c.id, 'Cadência padrão', null from public.companies c
  where not exists (
    select 1 from public.follow_up_cadences fc
    where fc.company_id = c.id and fc.active and nullif(btrim(fc.service_interest), '') is null
  )
  returning id
)
insert into public.follow_up_cadence_stages (cadence_id, stage_number, delay_min_hours, delay_max_hours)
select i.id, s.stage_number, s.delay_min_hours, s.delay_max_hours
from inserted i
cross join (values
  (1, 24, 24), (2, 28, 40), (3, 56, 56),
  (4, 104, 104), (5, 128, 128), (6, 176, 176)
) as s(stage_number, delay_min_hours, delay_max_hours);

alter table public.follow_up_cycles
  add column if not exists cadence_id uuid references public.follow_up_cadences(id) on delete set null,
  add column if not exists cadence_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists started_at timestamptz not null default now();

alter table public.follow_up_records
  add column if not exists cycle_id uuid references public.follow_up_cycles(id) on delete set null,
  add column if not exists result text,
  add column if not exists schedule_id uuid,
  add column if not exists delay_hours integer;

alter table public.follow_up_records drop constraint if exists follow_up_records_result_check;
alter table public.follow_up_records add constraint follow_up_records_result_check
  check (result is null or result in ('no_answer', 'responded', 'interested', 'meeting_scheduled', 'no_interest'));

create table if not exists public.follow_up_stage_schedules (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.follow_up_cycles(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  stage_number integer not null check (stage_number >= 1),
  window_start_at timestamptz not null,
  deadline_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped', 'cancelled')),
  completed_record_id uuid references public.follow_up_records(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, stage_number),
  constraint follow_up_stage_window_valid check (deadline_at >= window_start_at)
);

alter table public.follow_up_records drop constraint if exists follow_up_records_schedule_id_fkey;
alter table public.follow_up_records add constraint follow_up_records_schedule_id_fkey
  foreign key (schedule_id) references public.follow_up_stage_schedules(id) on delete set null;

create table if not exists public.follow_up_schedule_delays (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.follow_up_stage_schedules(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  previous_window_start_at timestamptz not null,
  previous_deadline_at timestamptz not null,
  new_window_start_at timestamptz not null,
  new_deadline_at timestamptz not null,
  reason text not null default '',
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.follow_up_notification_reads (
  schedule_id uuid not null references public.follow_up_stage_schedules(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (schedule_id, user_id)
);

create index if not exists follow_up_stage_schedules_company_deadline_idx
  on public.follow_up_stage_schedules (company_id, status, deadline_at);
create index if not exists follow_up_stage_schedules_lead_idx
  on public.follow_up_stage_schedules (lead_id, stage_number);
create index if not exists follow_up_stage_schedules_cycle_idx
  on public.follow_up_stage_schedules (cycle_id, status, stage_number);
create index if not exists follow_up_schedule_delays_schedule_idx
  on public.follow_up_schedule_delays (schedule_id, created_at desc);
create index if not exists follow_up_records_cycle_result_idx
  on public.follow_up_records (cycle_id, stage_number, result);

drop trigger if exists set_updated_at on public.follow_up_stage_schedules;
create trigger set_updated_at before update on public.follow_up_stage_schedules
  for each row execute procedure public.set_updated_at();

alter table public.follow_up_stage_schedules enable row level security;
alter table public.follow_up_schedule_delays enable row level security;
alter table public.follow_up_notification_reads enable row level security;

create policy follow_up_stage_schedules_select on public.follow_up_stage_schedules
  for select to authenticated using (public.has_permission(company_id, 'follow_up', 'view'));
create policy follow_up_stage_schedules_insert on public.follow_up_stage_schedules
  for insert to authenticated with check (public.has_permission(company_id, 'follow_up', 'register'));
create policy follow_up_stage_schedules_update on public.follow_up_stage_schedules
  for update to authenticated using (public.has_permission(company_id, 'follow_up', 'register'))
  with check (public.has_permission(company_id, 'follow_up', 'register'));
create policy follow_up_schedule_delays_select on public.follow_up_schedule_delays
  for select to authenticated using (public.has_permission(company_id, 'follow_up', 'view'));
create policy follow_up_schedule_delays_insert on public.follow_up_schedule_delays
  for insert to authenticated with check (public.has_permission(company_id, 'follow_up', 'register'));
create policy follow_up_notification_reads_select on public.follow_up_notification_reads
  for select to authenticated using (user_id = (select auth.uid()));
create policy follow_up_notification_reads_insert on public.follow_up_notification_reads
  for insert to authenticated with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.follow_up_stage_schedules s
      where s.id = schedule_id and public.has_permission(s.company_id, 'follow_up', 'view')
    )
  );
create policy follow_up_notification_reads_update on public.follow_up_notification_reads
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update on public.follow_up_stage_schedules to authenticated;
grant select, insert on public.follow_up_schedule_delays to authenticated;
grant select, insert, update on public.follow_up_notification_reads to authenticated;

-- Soma horas corridas, mas pausa integralmente em sábados e domingos.
create or replace function public.add_weekday_hours(p_start timestamptz, p_hours integer)
returns timestamptz
language plpgsql
immutable
set search_path = public
as $$
declare
  v_result timestamptz := p_start;
  v_remaining integer := greatest(p_hours, 0);
begin
  while v_remaining > 0 loop
    v_result := v_result + interval '1 hour';
    if extract(isodow from v_result at time zone 'America/Sao_Paulo') < 6 then
      v_remaining := v_remaining - 1;
    end if;
  end loop;
  while extract(isodow from v_result at time zone 'America/Sao_Paulo') >= 6 loop
    v_result := v_result + interval '1 hour';
  end loop;
  return v_result;
end;
$$;

revoke execute on function public.add_weekday_hours(timestamptz, integer) from public, anon;
grant execute on function public.add_weekday_hours(timestamptz, integer) to authenticated;

create or replace function public.start_follow_up_cycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cadence public.follow_up_cadences%rowtype;
  v_cycle_id uuid;
  v_snapshot jsonb;
  v_anchor timestamptz := now();
  v_stage record;
begin
  if new.status = 'follow_up' then
    if exists (select 1 from public.follow_up_cycles where lead_id = new.id and status = 'active') then
      return new;
    end if;

    select c.* into v_cadence
    from public.follow_up_cadences c
    where c.company_id = new.company_id and c.active
      and lower(coalesce(nullif(btrim(c.service_interest), ''), '')) = lower(coalesce(nullif(btrim(new.service_interest), ''), ''))
    order by c.updated_at desc limit 1;

    if v_cadence.id is null then
      select c.* into v_cadence
      from public.follow_up_cadences c
      where c.company_id = new.company_id and c.active and nullif(btrim(c.service_interest), '') is null
      order by c.updated_at desc limit 1;
    end if;

    if v_cadence.id is null then
      insert into public.follow_up_cadences (company_id, name) values (new.company_id, 'Cadência padrão')
      returning * into v_cadence;
      insert into public.follow_up_cadence_stages (cadence_id, stage_number, delay_min_hours, delay_max_hours)
      values (v_cadence.id,1,24,24),(v_cadence.id,2,28,40),(v_cadence.id,3,56,56),
             (v_cadence.id,4,104,104),(v_cadence.id,5,128,128),(v_cadence.id,6,176,176);
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'stage_number', s.stage_number,
      'delay_min_hours', s.delay_min_hours,
      'delay_max_hours', s.delay_max_hours
    ) order by s.stage_number), '[]'::jsonb) into v_snapshot
    from public.follow_up_cadence_stages s where s.cadence_id = v_cadence.id;

    insert into public.follow_up_cycles (lead_id, company_id, cadence_id, cadence_snapshot, started_at)
    values (new.id, new.company_id, v_cadence.id, v_snapshot, v_anchor)
    returning id into v_cycle_id;

    for v_stage in select * from jsonb_to_recordset(v_snapshot)
      as x(stage_number integer, delay_min_hours integer, delay_max_hours integer)
      order by stage_number
    loop
      v_anchor := public.add_weekday_hours(v_anchor, v_stage.delay_min_hours);
      insert into public.follow_up_stage_schedules (
        cycle_id, lead_id, company_id, stage_number, window_start_at, deadline_at
      ) values (
        v_cycle_id, new.id, new.company_id, v_stage.stage_number, v_anchor,
        public.add_weekday_hours(v_anchor, v_stage.delay_max_hours - v_stage.delay_min_hours)
      );
    end loop;
  elsif old.status = 'follow_up' and new.status <> 'follow_up' then
    update public.follow_up_stage_schedules s set status = 'cancelled'
    from public.follow_up_cycles c
    where c.id = s.cycle_id and c.lead_id = new.id and c.status = 'active' and s.status = 'pending';
    update public.follow_up_cycles
    set status = 'completed',
        outcome = coalesce(outcome, case when new.status in ('reuniao_marcada','contrato_fechado') then 'success' else 'no_response' end),
        completed_at = coalesce(completed_at, now()),
        completed_by = coalesce(completed_by, (select auth.uid()))
    where lead_id = new.id and status = 'active';
  end if;
  return new;
end;
$$;

revoke execute on function public.start_follow_up_cycle() from public, anon, authenticated;
drop trigger if exists leads_start_follow_up_cycle on public.leads;
create trigger leads_start_follow_up_cycle
  after insert or update of status on public.leads
  for each row execute procedure public.start_follow_up_cycle();

-- Inicia a agenda também para leads que já estavam em follow-up antes
-- desta evolução. A função é idempotente e respeita ciclo ativo existente.
update public.leads set status = status where status = 'follow_up';

create or replace function public.complete_follow_up_stage(
  p_schedule_id uuid,
  p_result text,
  p_action_type text,
  p_completed_at date,
  p_completed_time time,
  p_responsible text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_schedule public.follow_up_stage_schedules%rowtype;
  v_record_id uuid;
  v_max_stage integer;
begin
  if v_uid is null then raise exception 'Não autenticado.' using errcode = '42501'; end if;
  if p_result not in ('no_answer','responded','interested','meeting_scheduled','no_interest') then
    raise exception 'Resultado inválido.' using errcode = '22023';
  end if;
  if p_action_type not in ('whatsapp','ligacao','mensagem','outro') then
    raise exception 'Tipo de ação inválido.' using errcode = '22023';
  end if;

  select * into v_schedule from public.follow_up_stage_schedules where id = p_schedule_id for update;
  if v_schedule.id is null then raise exception 'Etapa agendada não encontrada.' using errcode = 'P0002'; end if;
  if not public.has_permission(v_schedule.company_id, 'follow_up', 'register') then
    raise exception 'Sem permissão para registrar follow-up.' using errcode = '42501';
  end if;
  if v_schedule.status <> 'pending' then raise exception 'Esta etapa já foi tratada.' using errcode = '22023'; end if;

  update public.follow_up_stage_schedules
  set status = 'skipped', completed_at = now()
  where cycle_id = v_schedule.cycle_id and status = 'pending' and stage_number < v_schedule.stage_number;

  insert into public.follow_up_records (
    lead_id, company_id, cycle_id, schedule_id, stage_number, action_type,
    completed_at, completed_time, responsible, notes, result,
    requires_next_contact, next_contact_at, created_by
  ) values (
    v_schedule.lead_id, v_schedule.company_id, v_schedule.cycle_id, v_schedule.id,
    v_schedule.stage_number, p_action_type, coalesce(p_completed_at, current_date),
    p_completed_time, coalesce(p_responsible,''), coalesce(p_notes,''), p_result,
    p_result in ('no_answer','responded','interested'), null, v_uid
  ) returning id into v_record_id;

  update public.follow_up_stage_schedules
  set status = 'completed', completed_record_id = v_record_id, completed_at = now()
  where id = v_schedule.id;

  select max(stage_number) into v_max_stage
  from public.follow_up_stage_schedules where cycle_id = v_schedule.cycle_id;

  if p_result = 'meeting_scheduled' then
    update public.follow_up_cycles set status='completed', outcome='success', completed_at=now(), completed_by=v_uid
    where id=v_schedule.cycle_id;
    update public.follow_up_stage_schedules set status='cancelled'
    where cycle_id=v_schedule.cycle_id and status='pending';
    update public.leads set status='reuniao_marcada', responsible=coalesce(p_responsible,responsible)
    where id=v_schedule.lead_id;
  elsif p_result = 'no_interest' or (p_result = 'no_answer' and v_schedule.stage_number = v_max_stage) then
    update public.follow_up_cycles set status='completed', outcome='no_response', completed_at=now(), completed_by=v_uid
    where id=v_schedule.cycle_id;
    update public.follow_up_stage_schedules set status='cancelled'
    where cycle_id=v_schedule.cycle_id and status='pending';
    update public.leads set status='abandonou', responsible=coalesce(p_responsible,responsible)
    where id=v_schedule.lead_id;
  else
    update public.leads set responsible=coalesce(p_responsible,responsible)
    where id=v_schedule.lead_id;
  end if;
  return v_record_id;
end;
$$;

revoke execute on function public.complete_follow_up_stage(uuid,text,text,date,time,text,text) from public, anon, authenticated;
grant execute on function public.complete_follow_up_stage(uuid,text,text,date,time,text,text) to authenticated;

create or replace function public.reschedule_follow_up_stage(
  p_schedule_id uuid, p_window_start_at timestamptz, p_deadline_at timestamptz, p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_schedule public.follow_up_stage_schedules%rowtype;
begin
  select * into v_schedule from public.follow_up_stage_schedules where id=p_schedule_id for update;
  if v_schedule.id is null then raise exception 'Etapa não encontrada.' using errcode='P0002'; end if;
  if not public.has_permission(v_schedule.company_id,'follow_up','register') then raise exception 'Sem permissão.' using errcode='42501'; end if;
  if p_deadline_at < p_window_start_at then raise exception 'Janela inválida.' using errcode='22023'; end if;
  insert into public.follow_up_schedule_delays (
    schedule_id, company_id, previous_window_start_at, previous_deadline_at,
    new_window_start_at, new_deadline_at, reason, changed_by
  ) values (v_schedule.id,v_schedule.company_id,v_schedule.window_start_at,v_schedule.deadline_at,
    p_window_start_at,p_deadline_at,coalesce(p_reason,''),v_uid);
  update public.follow_up_stage_schedules
  set window_start_at=p_window_start_at, deadline_at=p_deadline_at where id=p_schedule_id;
end;
$$;

revoke execute on function public.reschedule_follow_up_stage(uuid,timestamptz,timestamptz,text) from public, anon, authenticated;
grant execute on function public.reschedule_follow_up_stage(uuid,timestamptz,timestamptz,text) to authenticated;

-- Resumo operacional: a próxima etapa pendente vem da agenda, não de um
-- campo manual. `security_invoker` mantém as políticas das tabelas-base.
create or replace view public.follow_up_lead_summary
with (security_invoker = true) as
select
  l.id as lead_id, l.company_id, l.name, l.phone, l.service_interest,
  l.responsible, l.status,
  coalesce(latest.stage_number, next_schedule.stage_number) as current_stage,
  latest.completed_at as last_contact_at,
  (next_schedule.window_start_at at time zone 'America/Sao_Paulo')::date as next_contact_at,
  latest.notes as last_notes,
  cycle.status as cycle_status, cycle.outcome, cycle.completed_at as cycle_completed_at,
  cycle.id as cycle_id,
  next_schedule.id as next_schedule_id,
  next_schedule.stage_number as next_stage,
  next_schedule.window_start_at, next_schedule.deadline_at,
  next_schedule.status as schedule_status
from public.leads l
left join lateral (
  select c.* from public.follow_up_cycles c where c.lead_id=l.id
  order by (c.status='active') desc, c.created_at desc limit 1
) cycle on true
left join lateral (
  select r.stage_number,r.completed_at,r.notes from public.follow_up_records r
  where r.lead_id=l.id order by r.completed_at desc,r.created_at desc limit 1
) latest on true
left join lateral (
  select s.* from public.follow_up_stage_schedules s
  where s.cycle_id=cycle.id and s.status='pending'
  order by s.stage_number limit 1
) next_schedule on true;

grant select on public.follow_up_lead_summary to authenticated;

create or replace view public.follow_up_notifications
with (security_invoker = true) as
select s.id as schedule_id, s.company_id, c.slug as company_slug, c.name as company_name,
  s.lead_id, l.name as lead_name,
  l.responsible, s.stage_number, s.window_start_at, s.deadline_at,
  r.read_at,
  case
    when s.deadline_at < now() then 'overdue'
    when s.deadline_at <= now() + interval '2 hours' then 'due_soon'
    else 'scheduled'
  end as urgency
from public.follow_up_stage_schedules s
join public.leads l on l.id=s.lead_id
join public.companies c on c.id=s.company_id
left join public.follow_up_notification_reads r
  on r.schedule_id=s.id and r.user_id=(select auth.uid())
where s.status='pending'
  and extract(isodow from now() at time zone 'America/Sao_Paulo') < 6
  and s.deadline_at <= now() + interval '2 hours';

grant select on public.follow_up_notifications to authenticated;
