# AdmPro Console — andamento da implantação em 27/10/2026

## Concluído

- O Supabase **admpro-staging** (`stvenawjeyyhpvwvpjkm`) recebeu as migrações `admpro_console_initial`, `admpro_console_payment_feedback_atomic`, `admpro_console_cohort_conversion_fix` e `admpro_console_audit_author_indexes`.
- Tabelas `notas_conta` e `auditoria` com RLS; 15 funções `console_*`; preço contratado isolado do preço de tabela.
- Testes em transações com rollback aprovaram: bloqueio de RPCs a não-admin, isolamento de `public.dados` mesmo com registros existentes, avisos segmentados, bloqueio e confirmação atômica de pagamento, feedback e auditoria.
- A biblioteca **Supabase JS 2.117.3** foi copiada da distribuição oficial verificada pelo GitHub Actions para `js/vendor/supabase.js`.
- `sha256sum -c js/vendor/supabase.js.sha256` passou; testes `node tests/static-check.mjs` e `node tests/view-render.mjs` passaram.
- O workflow `.github/workflows/publicar-pages.yml` está no pacote, pronto para publicar em um repositório GitHub Pages separado.

## Ainda precisa da sua ação

1. **Criar o usuário administrador no Supabase Auth.** No projeto `admpro-staging`, abra Authentication → Users → Add user e cadastre o seu e-mail com senha escolhida diretamente lá. O banco tem **0 usuários Auth e 0 administradores**; não use e-mail fictício nem compartilhe sua senha. Após criar o usuário, execute `supabase/criar-primeiro-admin.sql` no SQL Editor, trocando o e-mail de exemplo. Por segurança, use um e-mail exclusivo para a administração do Console.
2. **Criar o repositório independente no GitHub.** O conector GitHub disponível nesta conversa não permite criar repositórios. Crie `lzzamboniofc/admpro-console`, envie o conteúdo da pasta `admpro-console` para a raiz do novo repositório e mantenha `.github/workflows/`.
3. **Habilitar GitHub Pages.** Em Settings → Pages, selecione Source = GitHub Actions. Acompanhe Actions → Publicar AdmPro Console no GitHub Pages. Com resultado verde, o endereço previsto será `https://lzzamboniofc.github.io/admpro-console/`.

## Atenção

O endereço acima **não foi publicado nem verificado**. Não há usuário administrador real ainda. A aplicação **não está homologada para cobranças reais**, apesar de o banco de teste ter passado nas verificações transacionais. A `main` do app AdmPro segue intacta.