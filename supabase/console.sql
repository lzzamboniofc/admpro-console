-- AdmPro Console / migração complementar ao supabase/schema.sql.
-- Executar como proprietário via SQL Editor ou migração; nunca no navegador.
-- Não consulta a tabela public.dados. Todas as funções públicas exigem administrador.

alter table public.contas add column if not exists preco_acordado_centavos integer
  check(preco_acordado_centavos is null or preco_acordado_centavos >= 0);
-- Congela o preço já atribuído aos assinantes existentes na data de migração.
update public.contas c set preco_acordado_centavos=p.preco_mensal_centavos
from public.planos p where c.plano_id=p.id and c.preco_acordado_centavos is null;

create table if not exists public.notas_conta (
 id uuid primary key default gen_random_uuid(), conta_id uuid not null references public.contas(id) on delete cascade,
 conteudo text not null check(length(trim(conteudo)) between 1 and 4000),
 criado_por uuid not null references auth.users(id), criado_em timestamptz not null default now(),
 atualizado_em timestamptz not null default now()
);
create index if not exists notas_conta_idx on public.notas_conta(conta_id,criado_em desc);

create table if not exists public.auditoria (
 id bigint generated always as identity primary key,
 admin_id uuid references auth.users(id), acao text not null,
 entidade text not null, entidade_id text, conta_id uuid,
 antes jsonb, depois jsonb, detalhes jsonb not null default '{}'::jsonb,
 criado_em timestamptz not null default now()
);
create index if not exists auditoria_quando_idx on public.auditoria(criado_em desc);
create index if not exists auditoria_conta_idx on public.auditoria(conta_id,criado_em desc);
create index if not exists auditoria_admin_id_idx on public.auditoria(admin_id);
create index if not exists notas_conta_criado_por_idx on public.notas_conta(criado_por);

alter table public.notas_conta enable row level security;
alter table public.auditoria enable row level security;
drop policy if exists console_notas_select on public.notas_conta;
create policy console_notas_select on public.notas_conta for select to authenticated
 using ((select public.is_admin()));
drop policy if exists console_notas_insert on public.notas_conta;
create policy console_notas_insert on public.notas_conta for insert to authenticated
 with check ((select public.is_admin()) and criado_por=(select auth.uid()));
drop policy if exists console_notas_update on public.notas_conta;
create policy console_notas_update on public.notas_conta for update to authenticated
 using ((select public.is_admin()) and criado_por=(select auth.uid()))
 with check ((select public.is_admin()) and criado_por=(select auth.uid()));
drop policy if exists console_notas_delete on public.notas_conta;
create policy console_notas_delete on public.notas_conta for delete to authenticated
 using ((select public.is_admin()));
drop policy if exists console_auditoria_select on public.auditoria;
create policy console_auditoria_select on public.auditoria for select to authenticated
 using ((select public.is_admin()));
revoke all on public.notas_conta, public.auditoria from public, anon, authenticated;
grant select,insert,update,delete on public.notas_conta to authenticated;
grant select on public.auditoria to authenticated;

-- O próprio banco registra qualquer alteração administrativa, inclusive via API fora do painel.
create or replace function private.console_auditar() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_old jsonb; v_new jsonb; v_conta uuid; v_id text;
begin
 if auth.uid() is null or not public.is_admin() then
   return coalesce(new,old);
 end if;
 if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return new; end if;
 v_old:=case when tg_op <> 'INSERT' then to_jsonb(old) end;
 v_new:=case when tg_op <> 'DELETE' then to_jsonb(new) end;
 v_conta:=case when tg_table_name='contas' then coalesce((v_new->>'id')::uuid,(v_old->>'id')::uuid)
  when tg_table_name in ('pagamentos','feedbacks','notas_conta') then
    coalesce((v_new->>'conta_id')::uuid,(v_old->>'conta_id')::uuid)
  else null end;
 v_id:=coalesce(v_new->>'id',v_old->>'id',v_new->>'chave',v_old->>'chave',v_new->>'user_id',v_old->>'user_id');
 insert into public.auditoria(admin_id,acao,entidade,entidade_id,conta_id,antes,depois)
 values(auth.uid(),lower(tg_op),tg_table_name,v_id,v_conta,v_old,v_new);
 return coalesce(new,old);
end $$;
revoke all on function private.console_auditar() from public,anon,authenticated;
do $$ declare t text;
begin
 foreach t in array array['contas','planos','pagamentos','avisos','feedbacks','config_sistema','admins','notas_conta'] loop
   execute format('drop trigger if exists console_auditoria_trigger on public.%I',t);
   execute format('create trigger console_auditoria_trigger after insert or update or delete on public.%I for each row execute function private.console_auditar()',t);
 end loop;
end $$;

-- Novo campo não pode ser modificado pelo assinante via REST.
create or replace function private.proteger_conta() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user not in ('postgres','service_role') and not public.is_admin() then
   if old.status_assinatura='bloqueada' then raise exception 'CONTA_BLOQUEADA' using errcode='42501'; end if;
   if new.id is distinct from old.id or new.plano_id is distinct from old.plano_id
      or new.preco_acordado_centavos is distinct from old.preco_acordado_centavos
      or new.status_assinatura is distinct from old.status_assinatura
      or new.trial_ate is distinct from old.trial_ate
      or new.proximo_vencimento is distinct from old.proximo_vencimento
      or new.criado_em is distinct from old.criado_em
      or new.ultimo_acesso_em is distinct from old.ultimo_acesso_em
      or new.versao_app is distinct from old.versao_app then
      raise exception 'CAMPOS_ASSINATURA_PROTEGIDOS' using errcode='42501';
   end if;
 end if;
 return new;
end $$;

-- Evita que chamadas arbitrárias tentem forjar o autor das notas.
create or replace function private.console_nota_validar() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.conta_id is distinct from old.conta_id
   or new.criado_por is distinct from old.criado_por or new.criado_em is distinct from old.criado_em)
   then raise exception 'NOTA_IDENTIDADE_IMUTAVEL' using errcode='42501'; end if;
 new.atualizado_em:=now(); return new;
end $$;
drop trigger if exists console_nota_validar on public.notas_conta;
create trigger console_nota_validar before insert or update on public.notas_conta
for each row execute function private.console_nota_validar();

-- RPCs públicas sem EXECUTE para PUBLIC, anon. A guarda roda dentro de TODAS elas.
create or replace function private.console_exigir_admin() returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not (select public.is_admin()) then
   raise exception 'ACESSO_RESTRITO' using errcode='42501';
 end if;
end $$;
revoke all on function private.console_exigir_admin() from public,anon,authenticated;

-- Métricas exatas por agregação no servidor. Churn: cancelamentos do mês / base
-- pagante estimada de abertura (pagantes atuais + cancelamentos no mês).
-- Conversão: entradas trial->ativa Pro nos últimos 90d / trials iniciados 90d.
create or replace function public.console_resumo() returns jsonb language plpgsql stable security definer
set search_path='' as $$
declare v jsonb;
begin
 perform private.console_exigir_admin();
 with b as (select date_trunc('month',now()) as mes),
 c as (select c.*,p.preco_mensal_centavos,
  coalesce(c.preco_acordado_centavos,p.preco_mensal_centavos) as preco from public.contas c join public.planos p on p.id=c.plano_id),
 canc as (select count(distinct a.conta_id) as n from public.auditoria a,b
  where a.entidade='contas' and a.acao='update' and a.criado_em>=b.mes
    and a.depois->>'status_assinatura'='cancelada'
    and coalesce(a.antes->>'status_assinatura','')<>'cancelada'),
 conv as (select count(distinct a.conta_id) as n from public.auditoria a
  join public.contas origem on origem.id=a.conta_id and origem.criado_em>=now()-interval '90 days'
  where a.entidade='contas' and a.acao='update' and a.criado_em>=now()-interval '90 days'
    and a.antes->>'status_assinatura'='trial'
    and a.depois->>'status_assinatura'='ativa'
    and coalesce((a.depois->>'preco_acordado_centavos')::integer,0)>0)
 select jsonb_build_object(
  'total',count(*),'trial',count(*) filter (where status_assinatura='trial'),
  'pagantes',count(*) filter (where status_assinatura='ativa' and preco>0),
  'atrasadas',count(*) filter (where status_assinatura='atrasada'),
  'bloqueadas',count(*) filter (where status_assinatura='bloqueada'),
  'mrr_centavos',coalesce(sum(preco) filter (where status_assinatura='ativa' and preco>0),0),
  'receita_mes_centavos',(select coalesce(sum(valor_centavos),0) from public.pagamentos,b where status='pago' and pago_em>=b.mes and pago_em<b.mes+interval '1 month'),
  'novas_mes',count(*) filter (where criado_em >= (select mes from b)),
  'cancelamentos_mes',(select n from canc),
  'churn_pct',round(100.0*(select n from canc)/greatest(1, count(*) filter (where status_assinatura='ativa' and preco>0)+(select n from canc)),1),
  'conversao_90d_pct',round(100.0*(select n from conv)/greatest(1,count(*) filter (where criado_em>=now()-interval '90 days')),1),
  'ativos_7d',count(*) filter (where ultimo_acesso_em>=now()-interval '7 days'))
 into v from c;
 return v;
end $$;

create or replace function public.console_graficos() returns jsonb language plpgsql stable security definer
set search_path='' as $$
declare v jsonb;
begin
 perform private.console_exigir_admin();
 select jsonb_build_object(
  'novas_semanas',(select coalesce(jsonb_agg(jsonb_build_object('rotulo',to_char(g.inicio,'DD/MM'), 'valor',
      (select count(*) from public.contas c where c.criado_em>=g.inicio and c.criado_em<g.inicio+interval '7 days')) order by g.inicio),'[]'::jsonb)
      from generate_series(date_trunc('week',now())-interval '11 weeks',date_trunc('week',now()),interval '1 week') as g(inicio)),
  'receita_meses',(select coalesce(jsonb_agg(jsonb_build_object('rotulo',to_char(g.inicio,'MM/YY'), 'valor',
      (select coalesce(sum(valor_centavos),0) from public.pagamentos p where p.status='pago' and p.pago_em>=g.inicio and p.pago_em<g.inicio+interval '1 month')) order by g.inicio),'[]'::jsonb)
      from generate_series(date_trunc('month',now())-interval '11 months',date_trunc('month',now()),interval '1 month') g(inicio)),
  'modelos',(select coalesce(jsonb_agg(jsonb_build_object('rotulo',modelo_negocio,'valor',n) order by n desc),'[]'::jsonb)
      from (select modelo_negocio,count(*) n from public.contas group by modelo_negocio) m),
  'acessos_30d',(select coalesce(jsonb_agg(jsonb_build_object('rotulo',to_char(g.dia,'DD/MM'), 'valor',
      (select coalesce(sum(acessos),0) from public.uso_diario u where u.dia=g.dia::date)) order by g.dia),'[]'::jsonb)
      from generate_series(current_date-29,current_date,interval '1 day') g(dia))
 ) into v;
 return v;
end $$;

create or replace function public.console_pendencias() returns jsonb language plpgsql stable security definer
set search_path='' as $$
declare v jsonb;
begin
 perform private.console_exigir_admin();
 select jsonb_build_object(
 'trial_fim',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select id,nome_negocio,telefone,trial_ate from public.contas where status_assinatura='trial' and trial_ate between current_date and current_date+3 order by trial_ate limit 12) x),
 'atrasadas',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select id,nome_negocio,telefone,proximo_vencimento from public.contas where status_assinatura in ('atrasada','bloqueada') order by proximo_vencimento nulls last limit 12) x),
 'inativas',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select id,nome_negocio,telefone,ultimo_acesso_em from public.contas where criado_em<now()-interval '14 days' and (ultimo_acesso_em<now()-interval '14 days' or ultimo_acesso_em is null) and status_assinatura in ('trial','ativa','atrasada') order by ultimo_acesso_em nulls first limit 12) x),
 'feedbacks',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select f.id,f.conta_id,c.nome_negocio,c.telefone,f.tipo,f.mensagem,f.criado_em from public.feedbacks f join public.contas c on c.id=f.conta_id where f.status='aberto' order by f.criado_em limit 12) x)
 ) into v;return v;
end $$;

-- Busca e paginação em SQL; nenhuma listagem integral de assinantes no browser.
create or replace function public.console_contas(
 p_busca text default '', p_status text default '', p_plano uuid default null,
 p_modelo text default '',p_uf text default '',p_inicio date default null,p_fim date default null,
 p_ordem text default 'criado_em',p_desc boolean default true,p_pagina integer default 1)
 returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb;
begin
 perform private.console_exigir_admin();
 if p_ordem not in ('criado_em','nome_negocio','ultimo_acesso_em','status_assinatura','cidade') then
   raise exception 'Ordenação inválida';end if;
 with f as (select c.*,p.nome plano,p.preco_mensal_centavos,
  coalesce(c.preco_acordado_centavos,p.preco_mensal_centavos) preco_contratado_centavos,
  (select u.email from public.membros m join auth.users u on u.id=m.user_id where m.conta_id=c.id and m.papel='dono' order by u.created_at limit 1) as email
  from public.contas c join public.planos p on p.id=c.plano_id),
 filtrado as(select * from f where
  (coalesce(p_busca,'')='' or concat_ws(' ',nome_negocio,telefone,email,cidade) ilike '%'||trim(p_busca)||'%')
  and (coalesce(p_status,'')='' or status_assinatura=p_status)
  and (p_plano is null or plano_id=p_plano)
  and (coalesce(p_modelo,'')='' or modelo_negocio=p_modelo)
  and (coalesce(p_uf,'')='' or uf=upper(p_uf))
  and (p_inicio is null or criado_em>=p_inicio::timestamptz)
  and (p_fim is null or criado_em<(p_fim+1)::timestamptz)),
 pag as (select * from filtrado order by
  case when p_ordem='criado_em' and p_desc then criado_em end desc nulls last,
  case when p_ordem='criado_em' and not p_desc then criado_em end asc nulls last,
  case when p_ordem='ultimo_acesso_em' and p_desc then ultimo_acesso_em end desc nulls last,
  case when p_ordem='ultimo_acesso_em' and not p_desc then ultimo_acesso_em end asc nulls last,
  case when p_ordem='nome_negocio' and p_desc then nome_negocio end desc nulls last,
  case when p_ordem='nome_negocio' and not p_desc then nome_negocio end asc nulls last,
  case when p_ordem='status_assinatura' and p_desc then status_assinatura end desc nulls last,
  case when p_ordem='status_assinatura' and not p_desc then status_assinatura end asc nulls last,
  case when p_ordem='cidade' and p_desc then cidade end desc nulls last,
  case when p_ordem='cidade' and not p_desc then cidade end asc nulls last,
  id limit 25 offset (greatest(1,least(100000,coalesce(p_pagina,1)))-1)*25)
 select jsonb_build_object('total',(select count(*) from filtrado),'pagina',greatest(1,coalesce(p_pagina,1)),
  'itens',coalesce((select jsonb_agg(to_jsonb(pag)) from pag),'[]'::jsonb)) into v;
 return v;
end $$;

create or replace function public.console_conta(p_conta uuid) returns jsonb language plpgsql stable security definer
set search_path='' as $$
declare v jsonb;
begin
 perform private.console_exigir_admin();
 if not exists(select 1 from public.contas where id=p_conta) then raise exception 'Conta não encontrada';end if;
 select jsonb_build_object(
  'conta',(select to_jsonb(x) from (select c.*,p.nome plano,
    coalesce(c.preco_acordado_centavos,p.preco_mensal_centavos) preco_contratado_centavos,
    (select email from auth.users u join public.membros m on m.user_id=u.id where m.conta_id=c.id and m.papel='dono' limit 1) email
    from public.contas c join public.planos p on p.id=c.plano_id where c.id=p_conta) x),
  'uso',(select coalesce(jsonb_agg(to_jsonb(u) order by dia),'[]'::jsonb) from
   (select dia,acessos,clientes_total,servicos_criados,lancamentos_criados from public.uso_diario where conta_id=p_conta and dia>=current_date-29 order by dia) u),
  'pagamentos',(select coalesce(jsonb_agg(to_jsonb(p) order by criado_em desc),'[]'::jsonb) from
   (select * from public.pagamentos where conta_id=p_conta order by criado_em desc limit 100) p),
  'feedbacks',(select coalesce(jsonb_agg(to_jsonb(f) order by criado_em desc),'[]'::jsonb) from
   (select * from public.feedbacks where conta_id=p_conta order by criado_em desc limit 100) f),
  'notas',(select coalesce(jsonb_agg(to_jsonb(n) order by criado_em desc),'[]'::jsonb) from
   (select n.*,u.email autor_email from public.notas_conta n join auth.users u on u.id=n.criado_por where conta_id=p_conta order by criado_em desc limit 100) n)
 ) into v;
 return v;
end $$;

create or replace function public.console_pagamentos(p_aba text default 'pago',p_mes text default '',p_pagina integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb;
begin
 perform private.console_exigir_admin();
 if p_aba not in ('pago','pendente','atrasado') then raise exception 'Aba inválida';end if;
 if coalesce(p_mes,'')<>'' and p_mes !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Mês inválido';end if;
 with f as (select p.*,c.nome_negocio,c.telefone from public.pagamentos p join public.contas c on c.id=p.conta_id where
   (case when p_aba='atrasado' then p.status='pendente' and (p.referencia<to_char(current_date,'YYYY-MM') or c.proximo_vencimento<current_date)
         else p.status=p_aba end)
   and (coalesce(p_mes,'')='' or p.referencia=p_mes)),
 pg as (select * from f order by criado_em desc,id limit 25 offset (greatest(1,coalesce(p_pagina,1))-1)*25)
 select jsonb_build_object('total',(select count(*) from f),
   'total_centavos',(select coalesce(sum(valor_centavos),0) from f),
   'itens',coalesce((select jsonb_agg(to_jsonb(pg)) from pg),'[]'::jsonb)) into v;
 return v;
end $$;

create or replace function public.console_feedbacks(p_tipo text default '',p_status text default '',p_pagina integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb;
begin
 perform private.console_exigir_admin();
 with f as (select fb.*,c.nome_negocio,c.telefone from public.feedbacks fb join public.contas c on c.id=fb.conta_id
 where (coalesce(p_tipo,'')='' or fb.tipo=p_tipo) and (coalesce(p_status,'')='' or fb.status=p_status)),
 pg as(select * from f order by criado_em desc,id limit 25 offset(greatest(1,coalesce(p_pagina,1))-1)*25)
 select jsonb_build_object('total',(select count(*) from f),
  'abertos',(select count(*) from public.feedbacks where status='aberto'),
  'itens',coalesce((select jsonb_agg(to_jsonb(pg)) from pg),'[]'::jsonb)) into v;
 return v;
end $$;

create or replace function public.console_auditoria(p_pagina integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb;
begin
 perform private.console_exigir_admin();
 with pag as(select a.id,a.admin_id,u.email as admin_email,a.acao,a.entidade,a.entidade_id,a.conta_id,a.criado_em,a.antes,a.depois
 from public.auditoria a left join auth.users u on u.id=a.admin_id order by a.criado_em desc,a.id desc limit 25 offset(greatest(1,coalesce(p_pagina,1))-1)*25)
 select jsonb_build_object('total',(select count(*) from public.auditoria),
 'itens',coalesce((select jsonb_agg(to_jsonb(pag)) from pag),'[]'::jsonb)) into v;
 return v;
end $$;

create or replace function public.console_lista_admins() returns jsonb language plpgsql stable security definer
set search_path='' as $$
begin
 perform private.console_exigir_admin();
 return (select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'email',u.email) order by u.email),'[]'::jsonb)
 from public.admins a join auth.users u on u.id=a.user_id);
end $$;
create or replace function public.console_adicionar_admin(p_email text) returns void language plpgsql security definer
set search_path='' as $$
declare v_user uuid;
begin
 perform private.console_exigir_admin();
 select id into v_user from auth.users where lower(email)=lower(trim(p_email)) limit 1;
 if v_user is null then raise exception 'Usuário não encontrado. Ele precisa se cadastrar antes.';end if;
 insert into public.admins(user_id) values(v_user) on conflict do nothing;
end $$;

-- Toda ação administrativa que altera conta usa confirmação na interface e trigger de auditoria.
create or replace function public.console_acao_conta(p_conta uuid,p_acao text,p_valor text default '')
returns void language plpgsql security definer set search_path='' as $$
declare v_status text; v_plano uuid; v_preco integer; v_dias int;
begin
 perform private.console_exigir_admin();
 perform 1 from public.contas where id=p_conta for update;
 if not found then raise exception 'Conta não encontrada';end if;
 if p_acao='plano' then
   begin v_plano:=p_valor::uuid; exception when invalid_text_representation then raise exception 'Plano inválido'; end;
   select preco_mensal_centavos into v_preco from public.planos where id=v_plano and ativo;
   if not found then raise exception 'Plano inativo ou inexistente';end if;
   update public.contas set plano_id=v_plano,preco_acordado_centavos=v_preco where id=p_conta;
 elsif p_acao='estender' then
   v_dias:=p_valor::int;
   if v_dias not in (7,14,30) then raise exception 'Extensão inválida';end if;
   update public.contas set trial_ate=greatest(coalesce(trial_ate,current_date),current_date)+v_dias,
     status_assinatura='trial' where id=p_conta;
 elsif p_acao='bloquear' then
   update public.contas set status_assinatura='bloqueada' where id=p_conta;
 elsif p_acao='desbloquear' then
   update public.contas set status_assinatura=case when proximo_vencimento<current_date then 'atrasada' else 'ativa' end
   where id=p_conta;
 elsif p_acao='cancelar' then
   update public.contas set status_assinatura='cancelada' where id=p_conta;
 else raise exception 'Ação não permitida';
 end if;
end $$;

-- Operação atômica com auditoria via triggers e sem promover plano automaticamente.
create or replace function public.console_registrar_pagamento(
 p_conta uuid,p_valor integer,p_referencia text,p_forma text,
 p_pago_em timestamptz default now(),p_observacao text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_preco integer;
begin
 perform private.console_exigir_admin();
 if p_valor is null or p_valor<=0 then raise exception 'Valor inválido';end if;
 if p_referencia !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Referência inválida';end if;
 if trim(coalesce(p_forma,''))='' then raise exception 'Forma obrigatória';end if;
 if p_pago_em>now()+interval '1 day' then raise exception 'Data futura inválida';end if;
 perform 1 from public.contas where id=p_conta for update;
 if not found then raise exception 'Conta não encontrada';end if;
 if exists(select 1 from public.pagamentos where conta_id=p_conta and referencia=p_referencia and status='pago')
   then raise exception 'Esta referência já possui pagamento confirmado';end if;
 insert into public.pagamentos(conta_id,valor_centavos,referencia,status,forma,pago_em,observacao,criado_por)
 values(p_conta,p_valor,p_referencia,'pago',left(p_forma,80),coalesce(p_pago_em,now()),nullif(trim(p_observacao),''),auth.uid())
 returning id into v_id;
 update public.contas set status_assinatura='ativa',
   proximo_vencimento=(greatest(coalesce(proximo_vencimento,current_date),current_date)+interval '1 month')::date
 where id=p_conta;
 return v_id;
end $$;

-- Confirmação de aviso de pagamento é transacional: registra o pagamento e responde ao cliente.
create or replace function public.console_confirmar_aviso_pagamento(
 p_feedback uuid,p_valor integer,p_referencia text,p_forma text,
 p_pago_em timestamptz default now(),p_observacao text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_conta uuid;v_id uuid;
begin
 perform private.console_exigir_admin();
 select conta_id into v_conta from public.feedbacks
  where id=p_feedback and tipo='pagamento' and status='aberto' for update;
 if v_conta is null then raise exception 'Aviso de pagamento inexistente ou já tratado';end if;
 v_id:=public.console_registrar_pagamento(v_conta,p_valor,p_referencia,p_forma,p_pago_em,p_observacao);
 update public.feedbacks set status='respondido',
  resposta='Pagamento confirmado e registrado. Obrigado!',respondido_em=now()
  where id=p_feedback;
 return v_id;
end $$;

create unique index if not exists pagamentos_pagos_conta_referencia_uniq
on public.pagamentos(conta_id,referencia) where status='pago';

create or replace function public.console_responder_feedback(p_feedback uuid,p_resposta text,p_status text)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.console_exigir_admin();
 if p_status not in ('aberto','respondido','fechado') then raise exception 'Status inválido';end if;
 if length(coalesce(p_resposta,''))>5000 then raise exception 'Resposta muito longa';end if;
 update public.feedbacks set resposta=nullif(trim(p_resposta),''),status=p_status,
   respondido_em=case when nullif(trim(p_resposta),'') is not null then now() else null end
 where id=p_feedback;
 if not found then raise exception 'Solicitação não encontrada';end if;
end $$;

create or replace function public.console_aplicar_preco(p_plano uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_valor integer;v_qtd integer;
begin
 perform private.console_exigir_admin();
 select preco_mensal_centavos into v_valor from public.planos where id=p_plano;
 if not found then raise exception 'Plano inexistente';end if;
 update public.contas set preco_acordado_centavos=v_valor where plano_id=p_plano;
 get diagnostics v_qtd=row_count;return v_qtd;
end $$;

-- Bloqueia EXECUTE de APIs privilegiadas para convidados, sem depender de defaults.
do $$ declare v regprocedure;
begin
 for v in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname like 'console_%' loop
   execute format('revoke all on function %s from public,anon,authenticated',v);
   execute format('grant execute on function %s to authenticated',v);
 end loop;
end $$;