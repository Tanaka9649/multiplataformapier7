-- =========================================================================
-- PIER7 Multiempresa — View de apoio para a aba Follow-up
--
-- Uma linha por lead com o resumo do follow-up mais recente (etapa,
-- último contato, próximo contato) sem duplicar o lead em outra tabela.
-- `security_invoker = true` garante que a RLS de `leads` e
-- `follow_up_records` seja avaliada com o papel de quem consulta (não do
-- dono da view) — o padrão recomendado pelo Supabase no Postgres 15+.
-- =========================================================================

create or replace view public.follow_up_lead_summary
with (security_invoker = true) as
select
  l.id as lead_id,
  l.company_id,
  l.name,
  l.phone,
  l.service_interest,
  l.responsible,
  l.status,
  latest.stage_number as current_stage,
  latest.completed_at as last_contact_at,
  case when latest.requires_next_contact then latest.next_contact_at else null end as next_contact_at,
  latest.notes as last_notes
from public.leads l
left join lateral (
  select r.stage_number, r.completed_at, r.requires_next_contact, r.next_contact_at, r.notes
  from public.follow_up_records r
  where r.lead_id = l.id
  order by r.completed_at desc, r.created_at desc
  limit 1
) latest on true;

grant select on public.follow_up_lead_summary to authenticated;
