# AdmPro Console — painel de administração (staging)

> **Situação em 27/10/2026:** As migrações `admpro_console_initial`, `admpro_console_payment_feedback_atomic` e `admpro_console_cohort_conversion_fix` e `admpro_console_audit_author_indexes` já foram aplicadas ao Supabase `admpro-staging`; os testes SQL de autorização, pagamento e auditoria foram aprovados com `ROLLBACK`. **Não reexecute `console.sql` nesse projeto**. Não há nenhum usuário Auth/admin no staging; o primeiro admin depende da criação do seu usuário real. O repositório GitHub Pages separado ainda precisa ser criado na conta GitHub (a integração de GitHub disponível não oferece essa operação).


Painel **independente** do AdmPro, em HTML/CSS/JS puro, roteado por hash. O mesmo projeto Supabase atende o app e o painel; o Console nunca consulta a tabela `public.dados`. Nenhuma `service_role` é usada no navegador. **O login é seguido obrigatoriamente da RPC `is_admin()`; não-admin é desconectado.** As RLS e as RPCs verificam autorização novamente no banco: esconder a tela não substitui essa barreira.

## Situação encontrada e entregas

O projeto Supabase `admpro-staging` (`stvenawjeyyhpvwvpjkm`, São Paulo) já tinha as tabelas `planos`, `contas`, `membros`, `dados`, `pagamentos`, `uso_diario`, `avisos`, `feedbacks`, `config_sistema`, `admins`, além de RLS, Auth e agendamento de status. Não havia Console, `notas_conta`, `auditoria` nem RPCs do painel.

Este pacote inclui `supabase/console.sql` (migração complementar, sem reexecutar `schema.sql`), telas de indicadores, contas, pagamentos, planos, avisos, suporte, configuração e auditoria, tema claro/escuro, tabelas responsivas, CSV, modal de confirmação, testes e scripts. Não possui build nem framework. A migração foi aplicada no Supabase de staging e o arquivo UMD já está incluído neste pacote; **ainda falta criar o primeiro administrador, publicar o endereço separado e homologar login e cobranças no navegador antes de uso real**.

## Estrutura

```text
admpro-console/
├── index.html
├── css/style.css
├── img/logo/{logo-horizontal.svg,simbolo.svg}
├── js/{config.js,app.js,bootstrap.js,dashboard.js,contas.js,gestao.js}
├── js/vendor/{supabase.js,supabase.js.sha256}   # UMD oficial incluído e verificado
├── scripts/baixar-vendor.sh
├── supabase/{console.sql,criar-primeiro-admin.sql}
├── tests/{aceitacao.md,static-check.mjs,view-render.mjs}
├── .github/workflows/publicar-pages.yml
└── README.md
```

## Instalação

1. Confirme o projeto Supabase `admpro-staging`. Faça backup do banco de testes antes de aplicar qualquer migração.
2. **Se for um banco novo, não o staging já migrado:** abra **SQL Editor** e execute `supabase/console.sql` como proprietário do banco, apenas **uma vez**. A migração é complementar e ativa RLS em `notas_conta` e `auditoria`. Não reexecute o schema inicial do app. `preco_acordado_centavos` é adicionado a `contas` e preenchido para contratos existentes, preservando preços quando um plano for editado.
3. **Biblioteca instalada:** este ZIP já contém `js/vendor/supabase.js` e o checksum `js/vendor/supabase.js.sha256`, obtidos da distribuição oficial **@supabase/supabase-js@2.117.3** por GitHub Actions. Para revalidar, rode `sha256sum -c js/vendor/supabase.js.sha256`. O script opcional `bash scripts/baixar-vendor.sh` obtém novamente o pacote oficial em um computador conectado à internet. Na publicação, o GitHub Actions também verifica o SHA fixado. **O navegador nunca usa CDN.**
4. Revise `js/config.js`: já vem configurado **somente para staging**, com URL e chave *publishable* pública. Não insira chave `service_role`, token secreto ou senha.
5. Crie o primeiro usuário pelo Supabase Auth (Authentication > Users > Add user), com e-mail confirmado. Escolha sua própria senha **diretamente no Supabase** (não envie credenciais para ninguém). Em seguida, no SQL Editor, execute `supabase/criar-primeiro-admin.sql` após substituir o email de exemplo; alternativamente use a consulta abaixo:

```sql
insert into public.admins (user_id)
select id from auth.users where lower(email) = lower('SEU_EMAIL@EXEMPLO.COM')
on conflict (user_id) do nothing;
```

**É proposital que o primeiro admin seja nomeado por SQL Editor**, pois não existe usuário administrador anterior autorizado a adicionar admins via RPC. Os próximos podem ser adicionados no Console por e-mail.

6. Sirva os arquivos num servidor estático, em vez de abrir com `file://`:

```bash
python3 -m http.server 8010 --directory admpro-console
# Acesse http://localhost:8010
```

7. Entre com o e-mail e a senha cadastrados no Supabase. O Console verifica a RPC `is_admin()` após o login e, em caso negativo, encerra a sessão com mensagem “Acesso restrito”.

## Publicação em endereço separado

**Use outro repositório GitHub**, por exemplo `lzzamboniofc/admpro-console`, com GitHub Pages em `https://lzzamboniofc.github.io/admpro-console/` (endereço previsto, válido somente após ativar Pages). Esse repositório é **independente** do app dos assinantes.

1. No GitHub, crie um **novo repositório** `admpro-console` (público para Pages no plano gratuito).
2. Descompacte o ZIP e envie **o conteúdo interno** de `admpro-console/` para a raiz do novo repositório; a pasta `.github/workflows/` deve ser mantida. Não envie o ZIP como um arquivo único.
3. Abra **Settings > Pages > Build and deployment > Source: GitHub Actions** no novo repositório.
4. A cada push em `main`, `.github/workflows/publicar-pages.yml` executa os testes, baixa o UMD da **distribuição oficial npm versão fixa 2.117.3**, confere o SHA-256 e publica somente `index.html`, `css/`, `img/`, `js/` e `.nojekyll`. **Nenhuma RPC SQL ou documentação interna é servida pelo Pages.** Não há build da aplicação: apenas cópia de arquivos estáticos para publicação.
5. Confira a aba Actions: o workflow deve mostrar resultado verde. Somente então abra `https://lzzamboniofc.github.io/admpro-console/` e faça login com o administrador criado no passo 5.

O GitHub Pages serve HTML/JS sem build, mas o site exige HTTPS para o Auth. O endereço do Console não precisa ser secreto, porque a autorização é aplicada pelo Supabase. **A criação do repositório e ativação do Pages são ações manuais porque o conector GitHub disponível não possui ferramentas para criar repositórios nem configurar Pages.**

No Supabase Auth, configure **Site URL** e as **Redirect URLs** necessárias para o app de assinantes. O Console faz login por e-mail/senha, sem redirecionamento de OAuth. Não disponibilize o Console publicamente antes de executar `console.sql` e fazer os testes de autorização.

## Fluxos e observações importantes

- **Pagamentos:** a confirmação faz um INSERT em `pagamentos` (`status='pago'`), muda `contas.status_assinatura` para `ativa` e avança `proximo_vencimento` em um mês, tudo na mesma transação. A confirmação de um aviso “Já paguei” também responde ao feedback na mesma transação. **Pagamento não promove automaticamente uma conta do plano Gratuito ao Pro**: selecione o plano Pro antes, após conferência. O aviso enviado pelo app **não é comprovante de pagamento**.
- **Status:** contas bloqueadas continuam podendo ler/exportar dados do próprio app, mas sem poder gravar. O app da outra aba/dispositivo precisa atualizar sua leitura do servidor para ver o status novo (ao retornar à aba ou sincronizar). Não há um push Realtime implementado.
- **Preços:** a migração congela `preco_acordado_centavos` por conta. Editar um preço em `planos` não muda contratos existentes. Apenas “Aplicar preço às contas” altera explicitamente todos os contratos desse plano, com confirmação e auditoria.
- **Churn e conversão:** como o schema original não tinha histórico de estados, o Console usa `auditoria` para eventos a partir desta migração. Não há reconstrução confiável de cancelamentos/conversões anteriores. Churn mensal mostrado = cancelamentos únicos no mês / (pagantes ativas atuais + cancelamentos únicos no mês) × 100. Conversão 90 dias = contas criadas nos últimos 90 dias **e** com transição auditada de trial para Pro ativo / contas criadas nos últimos 90 dias × 100. São indicadores operacionais aproximados com essa definição, **não cohort analytics completos**.
- **MRR** = soma dos `preco_acordado_centavos` de contas com status `ativa` e preço positivo. **Receita** = soma de `pagamentos.valor_centavos` pagos em `pago_em` do mês. Atrasos = `status_assinatura='atrasada'`, bloqueios = `'bloqueada'`; “Ativas em 7 dias” significa contas com `ultimo_acesso_em` nos últimos 7 dias.
- **Pagamentos atrasados (aba)** = cobranças `pendente` de referência anterior ao mês corrente ou cujo próximo vencimento passou. Não cria automaticamente cobranças pendentes; uma conta atrasada pode aparecer na lista de ações da visão geral mesmo sem pagamento pendente cadastrado.
- **Exportar CSV** = varrer RPC paginada de 25 registros por chamada; considere limitar ou agendar exportações se houver centenas de milhares de assinantes.
- **Notas** e **auditoria**: admin pode ler notas internas; admin não pode inserir nem alterar auditoria diretamente. Triggers registram qualquer mudança administrativa nas tabelas administradas, inclusive pelo console SQL/API com JWT de admin, preservando `antes` e `depois` sem dados privados dos clientes dos assinantes. Alterações feitas como proprietário do banco, sem JWT, não são registradas como ação de admin.
- **Avisos por público**: são filtrados pelas RLS existentes da tabela `avisos`. Cada usuário recebe apenas avisos `ativos` no período, destinados a “todos”, ao próprio status, ou ao `id` da conta.

## Verificação da instalação no staging

No SQL Editor do `admpro-staging`, confira a instalação com:

```sql
select tablename, rowsecurity from pg_tables where schemaname='public' and tablename in ('notas_conta','auditoria');
select proname from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='public' and proname like 'console_%' order by proname;
select count(*) from public.admins;
```

**Cuidado:** o último comando deve mostrar 0 até você conceder acesso ao primeiro usuário. Um visitante sem cadastro nunca vira admin sozinho. Não compartilhe sua senha nem uma chave `service_role`.

## Conferência SQL — indicadores do dashboard

Execute no SQL Editor **para comparar com os cards da Visão geral**. As consultas abaixo refletem a mesma regra do `console_resumo()`:

```sql
with c as (
 select c.*,coalesce(c.preco_acordado_centavos,p.preco_mensal_centavos) preco
 from public.contas c join public.planos p on p.id=c.plano_id
)
select count(*) contas_totais,
 count(*) filter (where status_assinatura='trial') em_teste,
 count(*) filter (where status_assinatura='ativa' and preco>0) pagantes_ativas,
 count(*) filter (where status_assinatura='atrasada') atrasadas,
 count(*) filter (where status_assinatura='bloqueada') bloqueadas,
 coalesce(sum(preco) filter (where status_assinatura='ativa' and preco>0),0) mrr_centavos,
 count(*) filter (where criado_em>=date_trunc('month',now())) novas_mes,
 count(*) filter (where ultimo_acesso_em>=now()-interval '7 days') ativas_7d
from c;

select coalesce(sum(valor_centavos),0) receita_mes_centavos
from public.pagamentos where status='pago'
  and pago_em>=date_trunc('month',now())
  and pago_em<date_trunc('month',now())+interval '1 month';

select count(distinct conta_id) cancelamentos_mes
from public.auditoria where entidade='contas' and acao='update'
 and criado_em>=date_trunc('month',now())
 and depois->>'status_assinatura'='cancelada'
 and coalesce(antes->>'status_assinatura','')<>'cancelada';

select count(distinct conta_id) conversoes_trial_90d
from public.auditoria a join public.contas c on c.id=a.conta_id
where a.entidade='contas' and a.acao='update'
 and a.criado_em>=now()-interval '90 days' and c.criado_em>=now()-interval '90 days'
 and a.antes->>'status_assinatura'='trial' and a.depois->>'status_assinatura'='ativa'
 and coalesce((a.depois->>'preco_acordado_centavos')::integer,0)>0;

select count(*) base_trial_90d from public.contas
where criado_em>=now()-interval '90 days';
```

Para confirmar as séries dos gráficos:

```sql
select date_trunc('week',criado_em) semana,count(*) novas from public.contas
where criado_em>=date_trunc('week',now())-interval '11 weeks'
group by 1 order by 1;
select date_trunc('month',pago_em) mes,sum(valor_centavos) receita_centavos
from public.pagamentos where status='pago' and pago_em>=date_trunc('month',now())-interval '11 months'
group by 1 order by 1;
select modelo_negocio,count(*) from public.contas group by modelo_negocio order by 2 desc;
select dia,sum(acessos) from public.uso_diario
where dia>=current_date-29 group by dia order by dia;
```

**Verificar RLS:**

```sql
select tablename,rowsecurity from pg_tables
where schemaname='public' and tablename in ('notas_conta','auditoria');
select proname,prosecdef from pg_proc p join pg_namespace n on p.pronamespace=n.oid
where n.nspname='public' and proname like 'console_%';
```

## Testes e segurança

Rode `node tests/static-check.mjs` para validar código e garantir que nenhum JS do painel referencia a tabela `dados`. Siga `tests/aceitacao.md` para verificação manual com administradores e usuários comuns no Supabase e no navegador.

**Segurança em produção:** reavalie permissões de funções `SECURITY DEFINER` com o Security Advisor do Supabase, configure confirmação de e-mail/2FA para administradores, revise os textos jurídicos do aplicativo e faça homologação completa. Ter HTTPS e RLS não substitui o tratamento de dados pessoais sob a LGPD.