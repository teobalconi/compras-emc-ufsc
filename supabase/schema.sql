-- ============================================================================
-- SCHEMA COMPLETO: [Compras EMC] PLANEJAMENTO & EXECUÇÃO (2025-26)
-- Execute este script no SQL Editor do Supabase antes de rodar o seed.sql
-- ============================================================================

-- 1. EQUIPE (compartilhada entre Planejamento, Execução e destinatários de e-mail)
create table if not exists equipe (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null unique,
  etapas text,
  responsavel text,
  ativo boolean default true,
  created_at timestamptz default now()
);

-- 2. GRUPOS POR ETAPA (Etapas 1 a 5)
create table if not exists grupos_etapa (
  id uuid primary key default gen_random_uuid(),
  etapa int not null check (etapa between 1 and 5),
  grupo text not null,
  descricao text
);

-- 3. CRONOGRAMA ANUAL (Planejamento)
create table if not exists cronograma_anual (
  id uuid primary key default gen_random_uuid(),
  etapa_nome text not null,
  etapa_num int not null check (etapa_num between 1 and 5),
  tipo text not null check (tipo in ('Inserção', 'Execução')),
  atividade text not null,
  responsavel text default 'Unidades',
  dias_uteis int not null,
  data_inicio date,
  data_fim date
);

-- 4. PLANEJAMENTO - ITENS DAS 5 ETAPAS (18 colunas padronizadas)
create table if not exists planejamento_itens (
  id uuid primary key default gen_random_uuid(),
  etapa int not null check (etapa between 1 and 5),
  num_item text,
  qtd_total numeric(12,2) default 0,
  processo text,
  responsavel_pesquisa text,
  item_comp text,
  item_excl text,
  dem_excl text,
  pecul text,
  cod_siasg text,
  codigo_item text,
  unidade_medida text default 'UN',
  descricao_resumida text not null,
  especificacao text,
  detalhamento text,
  valor_unitario numeric(14,2) default 0,
  valor_total numeric(14,2) generated always as (coalesce(qtd_total, 0) * coalesce(valor_unitario, 0)) stored,
  emc_ctc numeric(12,2) default 0,
  sd text,
  created_at timestamptz default now()
);

-- 5. EXECUÇÃO - SALDO ANUAL
create table if not exists saldo_anual (
  id uuid primary key default gen_random_uuid(),
  setor text not null default 'EMC/CTC',
  edital_oficio text not null,
  item text not null,
  codigo text,
  unidade text default 'UN',
  descricao text not null,
  licitado numeric(12,2) default 0,
  saldo_total numeric(12,2) default 0,
  qt_def_setor numeric(12,2) default 0,
  saldo_setor numeric(12,2) default 0,
  valor_unitario numeric(14,2) default 0,
  fim_vigencia date not null,
  detalhamento text,
  created_at timestamptz default now()
);

-- 6. EXECUÇÃO - REGISTRO DE PEDIDOS / EMPENHOS (abate automaticamente do saldo_setor)
create table if not exists execucao_pedidos (
  id uuid primary key default gen_random_uuid(),
  saldo_item_id uuid references saldo_anual(id) on delete restrict,
  data_pedido date not null default current_date,
  solicitante text not null,
  laboratorio_setor text,
  quantidade numeric(12,2) not null check (quantidade > 0),
  numero_sd_empenho text,
  status text default 'Solicitado' check (status in ('Solicitado', 'Empenhado', 'Entregue', 'Cancelado')),
  observacao text,
  created_at timestamptz default now()
);

-- Trigger: Recalcula saldo_setor automaticamente a partir de qt_def_setor menos pedidos ativos
create or replace function recalcular_saldo_item(p_saldo_id uuid) returns void as $$
begin
  if p_saldo_id is null then
    return;
  end if;

  update saldo_anual
  set saldo_setor = qt_def_setor - coalesce((
    select sum(quantidade)
    from execucao_pedidos
    where saldo_item_id = p_saldo_id
      and status <> 'Cancelado'
  ), 0)
  where id = p_saldo_id;
end;
$$ language plpgsql;

create or replace function recalcular_saldo_setor() returns trigger as $$
begin
  if tg_op = 'UPDATE' and old.saldo_item_id is distinct from new.saldo_item_id then
    perform recalcular_saldo_item(old.saldo_item_id);
  end if;
  perform recalcular_saldo_item(coalesce(new.saldo_item_id, old.saldo_item_id));
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_atualiza_saldo_setor on execucao_pedidos;
create trigger trg_atualiza_saldo_setor
after insert or update or delete on execucao_pedidos
for each row execute function recalcular_saldo_setor();

-- 7. VIEW: ATAS VIGENTES (consolida os pregões ativos a partir do Saldo Anual)
create or replace view atas_vigentes
with (security_invoker = true) as
select
  edital_oficio,
  setor,
  min(fim_vigencia) as fim_vigencia,
  (min(fim_vigencia) - current_date) as dias_restantes,
  count(*) as total_itens,
  sum(saldo_setor) as soma_saldo_unidades,
  sum(saldo_setor * valor_unitario) as valor_saldo_disponivel,
  case
    when min(fim_vigencia) < current_date then 'Vencida'
    when (min(fim_vigencia) - current_date) <= 30 then 'Vence em 30 dias'
    else 'Vigente'
  end as status_ata
from saldo_anual
group by edital_oficio, setor
order by fim_vigencia asc;

-- Função SECURITY DEFINER para checar autorização sem causar recursão infinita na tabela equipe
create or replace function is_equipe_autorizada()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.equipe e
    where lower(e.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and e.ativo = true
  );
$$;

-- Segurança (RLS): Apenas usuários autenticados cuja conta está ativa na tabela 'equipe' podem ler/editar
alter table equipe enable row level security;
alter table grupos_etapa enable row level security;
alter table cronograma_anual enable row level security;
alter table planejamento_itens enable row level security;
alter table saldo_anual enable row level security;
alter table execucao_pedidos enable row level security;

drop policy if exists "Acesso equipe autorizada" on equipe;
create policy "Acesso equipe autorizada" on equipe
  for all using (is_equipe_autorizada()) with check (is_equipe_autorizada());

drop policy if exists "Acesso grupos" on grupos_etapa;
create policy "Acesso grupos" on grupos_etapa
  for all using (is_equipe_autorizada()) with check (is_equipe_autorizada());

drop policy if exists "Acesso cronograma" on cronograma_anual;
create policy "Acesso cronograma" on cronograma_anual
  for all using (is_equipe_autorizada()) with check (is_equipe_autorizada());

drop policy if exists "Acesso planejamento" on planejamento_itens;
create policy "Acesso planejamento" on planejamento_itens
  for all using (is_equipe_autorizada()) with check (is_equipe_autorizada());

drop policy if exists "Acesso saldo" on saldo_anual;
create policy "Acesso saldo" on saldo_anual
  for all using (is_equipe_autorizada()) with check (is_equipe_autorizada());

drop policy if exists "Acesso execucao" on execucao_pedidos;
create policy "Acesso execucao" on execucao_pedidos
  for all using (is_equipe_autorizada()) with check (is_equipe_autorizada());
