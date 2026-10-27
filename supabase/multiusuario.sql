-- Métricas agregadas de equipe para o AdmPro Console.
-- Não expõe registros da coleção dados; retorna somente contagens.
create or replace function public.console_equipe_metricas() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.console_exigir_admin();
  return jsonb_build_object(
    'usuarios',(select count(*) from public.membros),
    'usuarios_ativos',(select count(*) from public.membros where ativo),
    'profissionais',(select count(*) from public.dados where colecao='profissionais' and not excluido),
    'contas_multiprofissionais',(select count(*) from (
      select conta_id from public.dados where colecao='profissionais' and not excluido
      group by conta_id having count(*)>1
    ) x)
  );
end $$;

create or replace function public.console_equipe_conta(p_conta uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.console_exigir_admin();
  if not exists(select 1 from public.contas where id=p_conta) then raise exception 'Conta não encontrada'; end if;
  return jsonb_build_object(
    'usuarios',(select count(*) from public.membros where conta_id=p_conta),
    'usuarios_ativos',(select count(*) from public.membros where conta_id=p_conta and ativo),
    'profissionais',(select count(*) from public.dados where conta_id=p_conta and colecao='profissionais' and not excluido),
    'convites_pendentes',(select count(*) from public.convites_membros
      where conta_id=p_conta and aceito_em is null and cancelado_em is null and expira_em>now())
  );
end $$;

revoke all on function public.console_equipe_metricas(),public.console_equipe_conta(uuid) from public,anon;
grant execute on function public.console_equipe_metricas(),public.console_equipe_conta(uuid) to authenticated;
