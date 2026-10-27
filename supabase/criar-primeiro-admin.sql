-- Execute no SQL Editor do projeto admpro-staging, APÓS criar sua conta em Authentication > Users.
-- O e-mail abaixo é um exemplo obrigatório de substituir. Jamais coloque senhas nesta consulta.
do $primeiro_admin$
declare
  v_email text := 'SEU_EMAIL@EXEMPLO.COM';
  v_user uuid;
begin
  if v_email = 'SEU_EMAIL@EXEMPLO.COM' then
    raise exception 'Substitua pelo email de seu usuário Auth antes de executar.';
  end if;
  select id into v_user from auth.users where lower(email)=lower(trim(v_email)) limit 1;
  if v_user is null then raise exception 'Usuário Auth não encontrado: %', v_email; end if;
  insert into public.admins(user_id) values (v_user) on conflict do nothing;
  raise notice 'Permissão administrativa aplicada ao usuário Auth %', v_user;
end $primeiro_admin$;