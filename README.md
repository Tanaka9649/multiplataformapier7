# PIER7 · Plataforma Multiempresa

Dashboard de marketing multiempresa (Tráfego pago, Calendário, Planilhas e
Leads qualificados), inspirado em `free-energy-dashboard.vercel.app`, agora
com seletor de 6 empresas do grupo PIER7 e persistência real em Supabase.

Stack: Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase
(Postgres, Auth, Storage), pronto para deploy na Vercel.

## Status: banco já provisionado e testado

Já criei e testei o projeto Supabase de verdade (não é só código local):

- Projeto `pier7-multiempresa` (ref `xdrjhiqkckjrqpxjpxwi`), região São Paulo
  (`sa-east-1`), plano free ($0/mês).
- As 5 migrations abaixo já foram aplicadas nele.
- `get_advisors` (linter de segurança e performance do Supabase) rodado
  depois das migrations: zero achados de nível ERROR/WARN restantes — só
  itens INFO esperados de um banco recém-criado (ex.: "índice ainda não
  usado", que é normal antes do primeiro tráfego real).
- Testei isolamento entre empresas na prática: criei dois usuários de
  teste, um autorizado só para CP Desenvolvimento e outro só para Avança
  Imóveis, e confirmei via SQL (simulando a sessão autenticada de cada um)
  que cada um só enxerga sua própria empresa em `companies`,
  `metric_values` e `company_metric_config`, que a leitura de
  `calendar_items` fica igualmente isolada, e que uma tentativa de inserir
  um item de calendário na empresa do outro é **rejeitada pelo Postgres**
  com erro `42501` (violação de RLS) — não é validação só no front. Os
  usuários de teste foram removidos depois; o banco está limpo (0 usuários,
  pronto pro seu primeiro cadastro real virar admin).

Se quiser usar esse projeto já pronto, pule para a seção **4** com:

```
NEXT_PUBLIC_SUPABASE_URL=https://xdrjhiqkckjrqpxjpxwi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave anon enviada no chat>
```

Se preferir usar seu próprio projeto Supabase, siga as seções 1–3 normalmente
com as 5 migrations (a ordem importa).

---

## 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto (ou use
   um existente).
2. Em **Project Settings → API**, copie:
   - `Project URL` → vai em `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → vai em `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Rodar as migrations

No painel do Supabase, abra **SQL Editor** e rode, **nesta ordem**, o
conteúdo de cada arquivo em `supabase/migrations/`:

1. `0001_schema.sql` — cria todas as tabelas, extensões e triggers.
2. `0002_rls.sql` — habilita RLS, cria as funções de autorização e as
   políticas de acesso, além dos buckets de Storage e suas políticas.
3. `0003_seed.sql` — insere as 6 empresas, o catálogo de métricas e a
   configuração de quais cards cada empresa exibe. É idempotente: pode
   rodar de novo sem duplicar nada.
4. `0004_security_hardening.sql` — corrige os 2 achados do linter de
   segurança (search_path mutável e funções SECURITY DEFINER expostas
   demais via RPC).
5. `0005_performance_hardening.sql` — corrige os achados do linter de
   performance (FKs sem índice, políticas RLS duplicadas e `auth.uid()`
   sendo reavaliado linha a linha).

Todos os scripts podem ser colados e executados de uma vez (Run) — são
escritos para rodar em sequência sem intervenção manual.

## 3. Criar o primeiro usuário (admin)

A aplicação não tem tela de convite de usuários ainda. O fluxo é:

1. Rode a aplicação (local ou já em produção) e acesse `/login`.
2. Clique em **"Não tem conta? Criar acesso"** e cadastre o primeiro
   e-mail/senha.
3. **O primeiro usuário cadastrado no projeto vira admin automaticamente e
   já recebe acesso a todas as empresas** (ver trigger `handle_new_user` em
   `0001_schema.sql`).
4. Se o Supabase estiver com confirmação de e-mail obrigatória ativada
   (padrão), confirme o e-mail antes do primeiro login — ou desative
   temporariamente em **Authentication → Providers → Email → Confirm
   email** durante o setup inicial.

Para liberar outros usuários depois, insira manualmente em
`user_companies` pelo SQL Editor (ainda não há UI de gestão de usuários):

```sql
insert into public.user_companies (user_id, company_id)
select u.id, c.id
from auth.users u, public.companies c
where u.email = 'pessoa@pier7.com.br'
  and c.slug in ('pier7', 'cp-desenvolvimento'); -- empresas liberadas
```

## 4. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha com os valores do passo 1:

```bash
cp .env.example .env.local
```

## 5. Rodar localmente (opcional)

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## 6. Deploy na Vercel

1. Suba este projeto para um repositório no GitHub (upload do ZIP pela
   interface web do GitHub também funciona).
2. Na Vercel, importe o repositório.
3. Em **Environment Variables**, adicione `NEXT_PUBLIC_SUPABASE_URL` e
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` com os mesmos valores do `.env.local`.
4. Deploy. O build já foi validado localmente (`next build` sem erros).

---

## Estrutura do banco

| Tabela | Descrição |
|---|---|
| `companies` | As 6 empresas do grupo, com logo e ordem de exibição |
| `profiles` | Espelho de `auth.users`, com `role` (`admin`/`member`) |
| `user_companies` | Quais empresas cada usuário pode acessar |
| `metric_definitions` | Catálogo global de métricas possíveis (cards) |
| `company_metric_config` | Quais métricas cada empresa exibe, rótulo e ordem |
| `metric_values` | Valor atual de cada métrica por empresa |
| `calendar_items` | Itens do calendário de conteúdo, por empresa |
| `spreadsheet_uploads` | Prints de planilha enviados, por empresa |
| `qualified_lead_files` | Arquivos de leads qualificados, por empresa |

Regras de negócio por empresa (cards da aba "Tráfego pago") já estão
aplicadas em `0003_seed.sql`: CTR removido de todas; Reuniões
realizadas + Contratos fechados para CP Desenvolvimento, DM Empresarial e
Kore RH; Visita com cliente + Contratos fechados para Avança Imóveis; card
de Leads também removido para Pier7; Movva mantém todo o resto.

## Segurança

- RLS habilitado em todas as tabelas — nenhuma linha é visível sem que o
  usuário tenha vínculo em `user_companies` (ou seja admin).
- Buckets do Storage (`spreadsheet-images`, `qualified-leads`) são privados;
  arquivos são organizados por `<company_id>/<arquivo>` e as políticas de
  Storage reutilizam a mesma checagem de autorização das tabelas.
- Nenhuma service role key é usada no client — só a `anon key`, protegida
  pelas políticas de RLS.
- `company_id` nunca é confiável vindo "puro" do client sem que o banco
  reafirme a autorização via RLS em toda escrita.

## O que já foi validado vs. o que falta

Validado por mim, de ponta a ponta na camada de dados:
- `next build`, `next lint` e typecheck limpos.
- Schema, seed e as regras de métricas por empresa aplicados e conferidos
  no banco real (contagens e chaves visíveis por empresa batem com a
  especificação).
- Isolamento entre empresas testado no nível do Postgres/RLS (leitura e
  escrita), não só no código do front.
- Linter de segurança e performance do Supabase limpos.

O que ainda não dá pra validar sem um navegador de verdade contra o app
implantado (recomendo fazer uma vez, após o deploy):
- Fluxo de login/cadastro na tela `/login`.
- Troca de empresa e aba pela UI (`CompanySwitcher`/`MainNavigation`).
- Upload de imagem em Planilhas e arquivo em Leads qualificados (grava no
  Storage e depois abre via signed URL).
- Tela de gestão de usuários/empresas ainda não existe (hoje é via SQL
  Editor, comando pronto na seção 3 acima).
