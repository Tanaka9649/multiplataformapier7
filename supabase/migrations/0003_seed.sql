-- =========================================================================
-- PIER7 Multiempresa — Seed: empresas + métricas
-- Idempotente: pode ser rodado de novo sem duplicar dados.
-- =========================================================================

-- ---------------------------------------------------------------------
-- Empresas
-- ---------------------------------------------------------------------
insert into public.companies (name, slug, logo_path, sort_order, active) values
  ('CP Desenvolvimento', 'cp-desenvolvimento', '/logos/cp-desenvolvimento.png', 1, true),
  ('DM Empresarial',     'dm-empresarial',     '/logos/dm-empresarial.png',     2, true),
  ('Kore RH',            'kore-rh',            '/logos/kore-rh.png',            3, true),
  ('Avança Imóveis',     'avanca-imoveis',     '/logos/avanca-imoveis.png',     4, true),
  ('Pier7',              'pier7',              '/logos/pier7.png',              5, true),
  ('Movva',              'movva',              '/logos/movva.png',              6, true)
on conflict (slug) do update set
  name = excluded.name,
  logo_path = excluded.logo_path,
  sort_order = excluded.sort_order,
  active = excluded.active;

-- ---------------------------------------------------------------------
-- Catálogo de métricas (cards da aba "Tráfego pago")
-- ---------------------------------------------------------------------
insert into public.metric_definitions (key, label, format, sort_order) values
  ('gasto_atual',           'Gasto atual',           'currency',   1),
  ('impressoes',            'Impressões',            'integer',    2),
  ('cliques',                'Cliques no link',       'integer',    3),
  ('ctr',                    'CTR',                    'percentage', 4),
  ('cpc',                    'CPC',                    'currency',   5),
  ('leads',                  'Leads',                  'integer',    6),
  ('custo_por_lead',         'Custo por lead',         'currency',   7),
  ('conversas_iniciadas',    'Conversas iniciadas',    'integer',    8),
  ('reunioes_realizadas',    'Reuniões realizadas',    'integer',    9),
  ('contratos_fechados',     'Contratos fechados',     'integer',    10),
  ('visita_cliente',         'Visita com cliente',     'integer',    11)
on conflict (key) do update set
  label = excluded.label,
  format = excluded.format,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------
-- Configuração por empresa
-- Regra base (todas as empresas): gasto_atual, impressoes, cliques, ctr,
-- cpc, leads, custo_por_lead, conversas_iniciadas visíveis.
-- Diferenças aplicadas abaixo por empresa.
-- ---------------------------------------------------------------------
do $$
declare
  base_metrics text[] := array['gasto_atual','impressoes','cliques','ctr','cpc','leads','custo_por_lead','conversas_iniciadas'];
  extra_metrics text[] := array['reunioes_realizadas','contratos_fechados','visita_cliente'];
  c record;
  m text;
  i int;
begin
  for c in select id, slug from public.companies loop
    -- garante linha de config (visível por padrão) para todas as métricas base
    i := 0;
    foreach m in array base_metrics loop
      i := i + 1;
      insert into public.company_metric_config (company_id, metric_key, visible, sort_order)
      values (c.id, m, true, i)
      on conflict (company_id, metric_key) do update set sort_order = excluded.sort_order;
    end loop;
    -- garante linha de config (oculta por padrão) para as métricas extras
    foreach m in array extra_metrics loop
      insert into public.company_metric_config (company_id, metric_key, visible, sort_order)
      values (c.id, m, false, 99)
      on conflict (company_id, metric_key) do nothing;
    end loop;
  end loop;
end $$;

-- CP Desenvolvimento: remove CTR, adiciona Reuniões realizadas e Contratos fechados
update public.company_metric_config set visible = false
  where metric_key = 'ctr' and company_id = (select id from public.companies where slug = 'cp-desenvolvimento');
update public.company_metric_config set visible = true, sort_order = 4
  where metric_key = 'reunioes_realizadas' and company_id = (select id from public.companies where slug = 'cp-desenvolvimento');
update public.company_metric_config set visible = true, sort_order = 9
  where metric_key = 'contratos_fechados' and company_id = (select id from public.companies where slug = 'cp-desenvolvimento');

-- DM Empresarial: remove CTR, adiciona Reuniões realizadas e Contratos fechados
update public.company_metric_config set visible = false
  where metric_key = 'ctr' and company_id = (select id from public.companies where slug = 'dm-empresarial');
update public.company_metric_config set visible = true, sort_order = 4
  where metric_key = 'reunioes_realizadas' and company_id = (select id from public.companies where slug = 'dm-empresarial');
update public.company_metric_config set visible = true, sort_order = 9
  where metric_key = 'contratos_fechados' and company_id = (select id from public.companies where slug = 'dm-empresarial');

-- Kore RH: remove CTR, adiciona Reuniões realizadas e Contratos fechados
update public.company_metric_config set visible = false
  where metric_key = 'ctr' and company_id = (select id from public.companies where slug = 'kore-rh');
update public.company_metric_config set visible = true, sort_order = 4
  where metric_key = 'reunioes_realizadas' and company_id = (select id from public.companies where slug = 'kore-rh');
update public.company_metric_config set visible = true, sort_order = 9
  where metric_key = 'contratos_fechados' and company_id = (select id from public.companies where slug = 'kore-rh');

-- Avança Imóveis: remove CTR, adiciona Visita com cliente e Contratos fechados
update public.company_metric_config set visible = false
  where metric_key = 'ctr' and company_id = (select id from public.companies where slug = 'avanca-imoveis');
update public.company_metric_config set visible = true, sort_order = 4
  where metric_key = 'visita_cliente' and company_id = (select id from public.companies where slug = 'avanca-imoveis');
update public.company_metric_config set visible = true, sort_order = 9
  where metric_key = 'contratos_fechados' and company_id = (select id from public.companies where slug = 'avanca-imoveis');

-- Pier7: remove CTR e remove o card de Leads da aba inicial (mantém o restante)
update public.company_metric_config set visible = false
  where metric_key = 'ctr' and company_id = (select id from public.companies where slug = 'pier7');
update public.company_metric_config set visible = false
  where metric_key = 'leads' and company_id = (select id from public.companies where slug = 'pier7');

-- Movva: remove apenas CTR
update public.company_metric_config set visible = false
  where metric_key = 'ctr' and company_id = (select id from public.companies where slug = 'movva');

-- ---------------------------------------------------------------------
-- Valores iniciais das métricas (zerados — sem dados mockados)
-- ---------------------------------------------------------------------
insert into public.metric_values (company_id, metric_key, value)
select c.id, cmc.metric_key, 0
from public.companies c
join public.company_metric_config cmc on cmc.company_id = c.id
on conflict (company_id, metric_key) do nothing;
