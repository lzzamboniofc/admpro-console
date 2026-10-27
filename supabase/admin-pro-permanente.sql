-- AdmPro Console / migração complementar: Pro permanente para administradores.
-- Aplique somente em banco que já tenha schema.sql e console.sql.
-- Já aplicada em admpro-staging (27/10/2026): não a execute lá novamente.
-- Autorização pelo vínculo das tabelas public.admins e public.membros.
-- Não muda o preço do plano Pro comercial; cortesia é individual por conta.

CREATE OR REPLACE FUNCTION private.admpro_admin_ativar_pro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.contas c
     set plano_id=p.id, status_assinatura='ativa',
         trial_ate=null, proximo_vencimento=null,
         preco_acordado_centavos=0
  from public.membros m, public.planos p
  where m.user_id=new.user_id
    and m.conta_id=c.id
    and lower(p.nome)=lower('Pro') and p.ativo;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.admpro_admin_forcar_pro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_plano uuid;
begin
  if exists (
    select 1 from public.membros m
    join public.admins a on a.user_id=m.user_id
    where m.conta_id=new.id
  ) then
    select p.id into v_plano from public.planos p
      where lower(p.nome)=lower('Pro') and p.ativo
      order by p.ordem,p.id limit 1;
    if v_plano is null then
      raise exception 'Plano Pro ativo não encontrado para cortesia administrativa';
    end if;
    new.plano_id:=v_plano;
    new.preco_acordado_centavos:=0;
    new.status_assinatura:='ativa';
    new.trial_ate:=null;
    new.proximo_vencimento:=null;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.admpro_admin_membro_pro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if exists(select 1 from public.admins a where a.user_id=new.user_id) then
    update public.contas c
       set plano_id=p.id, status_assinatura='ativa',
           trial_ate=null, proximo_vencimento=null,
           preco_acordado_centavos=0
    from public.planos p
    where c.id=new.conta_id
      and lower(p.nome)=lower('Pro') and p.ativo;
  end if;
  return new;
end $function$;

drop trigger if exists admpro_admin_forcar_pro on public.contas;
create trigger admpro_admin_forcar_pro
before insert or update on public.contas
for each row execute function private.admpro_admin_forcar_pro();

drop trigger if exists admpro_admin_ativar_pro on public.admins;
create trigger admpro_admin_ativar_pro
after insert on public.admins
for each row execute function private.admpro_admin_ativar_pro();

drop trigger if exists admpro_admin_membro_pro on public.membros;
create trigger admpro_admin_membro_pro
after insert on public.membros
for each row execute function private.admpro_admin_membro_pro();

-- Upgrade dos admins existentes sem cobranças fictícias.
update public.contas c
   set plano_id=p.id,status_assinatura='ativa',
       trial_ate=null,proximo_vencimento=null,preco_acordado_centavos=0
from public.planos p
where lower(p.nome)=lower('Pro') and p.ativo
 and exists(select 1 from public.membros m join public.admins a on a.user_id=m.user_id where m.conta_id=c.id)
 and (c.plano_id is distinct from p.id or c.status_assinatura<>'ativa'
  or c.trial_ate is not null or c.proximo_vencimento is not null
  or c.preco_acordado_centavos is distinct from 0);

-- Admin pode usar o app em sua própria conta; jamais ver dados de terceiros.
-- public.eh_membro(uuid) verifica auth.uid() contra o vínculo de membros.
alter policy dados_privados_ler on public.dados
 using ((select public.eh_membro(conta_id)));

alter policy dados_privados_inserir on public.dados
 with check ((select public.eh_membro(conta_id))
   and exists(select 1 from public.contas c where c.id=conta_id and c.status_assinatura<>'bloqueada'));

alter policy dados_privados_atualizar on public.dados
 using ((select public.eh_membro(conta_id)))
 with check ((select public.eh_membro(conta_id))
   and exists(select 1 from public.contas c where c.id=conta_id and c.status_assinatura<>'bloqueada'));
