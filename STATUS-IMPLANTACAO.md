# AdmPro Console — implantação de testes (27/10/2026)

## Concluído

- Repositório **independente** publicado como código-fonte: https://github.com/lzzamboniofc/admpro-console
- Supabase **admpro-staging** (`stvenawjeyyhpvwvpjkm`), migrações do Console aplicadas; não reexecute `supabase/console.sql` nesse banco.
- Usuário Auth real cadastrado e habilitado como **administrador** em `public.admins`; o banco confirmou `is_admin() = true`.
- RPCs administrativas e tabelas `notas_conta`, `auditoria` com RLS; testes transacionais de autorização, aviso segmentado, pagamento, feedback e auditoria aprovados.
- `js/vendor/supabase.js` oficial @supabase/supabase-js 2.117.3, checksum no repositório e testes automatizados `tests/static-check.mjs` e `tests/view-render.mjs`.
- Nenhuma chave secreta/service_role no front-end. Console não consulta `public.dados`.

## Pendente

1. **Habilitar o Pages no GitHub:** abra https://github.com/lzzamboniofc/admpro-console/settings/pages e configure **Build and deployment → Source: GitHub Actions**. O conector GitHub não oferece a operação de habilitação de Pages. Depois execute/reexecute `Publicar AdmPro Console no GitHub Pages` em Actions, se necessário.
2. Confirmar que https://lzzamboniofc.github.io/admpro-console/ está acessível e fazer login real com o usuário administrador criado.
3. Homologar os fluxos com usuários de teste, incluindo pagamentos simulados, filtros, tema claro/escuro e tela de 360px.
4. Configurar e testar redirecionamentos de e-mail no Supabase Auth caso queira usar recuperação e convites por e-mail.

**Importante:** o Console é administrativo, não acessa registros privados dos clientes do assinante. O GitHub Pages hospeda código estático público; a proteção dos dados depende das RPCs e RLS do Supabase. Não use para cobranças reais até homologação.
