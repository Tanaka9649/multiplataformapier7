-- Índices de cobertura para todas as novas chaves estrangeiras e consultas
-- operacionais de agenda/notificação.
create index if not exists follow_up_cycles_cadence_idx
  on public.follow_up_cycles (cadence_id);
create index if not exists follow_up_notification_reads_user_idx
  on public.follow_up_notification_reads (user_id, read_at desc);
create index if not exists follow_up_records_schedule_idx
  on public.follow_up_records (schedule_id);
create index if not exists follow_up_schedule_delays_company_idx
  on public.follow_up_schedule_delays (company_id, created_at desc);
create index if not exists follow_up_schedule_delays_changed_by_idx
  on public.follow_up_schedule_delays (changed_by);
create index if not exists follow_up_stage_schedules_completed_record_idx
  on public.follow_up_stage_schedules (completed_record_id);
