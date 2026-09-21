-- =========================================================================
-- PIER7 Multiempresa — Controle de Leads: nova Situação "Follow-up"
--
-- Adiciona o valor 'follow_up' ao enum textual de status da tabela leads.
-- Mantém o mesmo padrão de CHECK constraint já usado (não migramos para
-- um tipo enum do Postgres para não quebrar o client tipado atual, que
-- trata status como texto livre validado por CHECK).
-- =========================================================================

alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check
  check (status in ('abandonou', 'conversando', 'follow_up', 'reuniao_marcada', 'contrato_fechado'));
