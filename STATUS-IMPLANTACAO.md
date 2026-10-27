# AdmPro Console — estado da implantação em 27/10/2026

## Concluído
- Código-fonte do painel em repositório separado: https://github.com/lzzamboniofc/admpro-console
- **Site publicado pelo GitHub Pages:** https://lzzamboniofc.github.io/admpro-console/
- GitHub Actions concluído com sucesso: https://github.com/lzzamboniofc/admpro-console/actions/runs/40575845000
- Supabase de testes `admpro-staging` (`stvenawjeyyhpvwvpjkm`) com todas as migrações do Console aplicadas.
- Primeiro usuário administrador real habilitado em `public.admins`; `public.is_admin() = true` validado com JWT simulado para esse usuário.
- Tabelas `notas_conta` e `auditoria` com RLS e 15 RPCs `console_*`; testes transacionais de escopo e pagamentos passaram.
- Código estático validado por GitHub Actions (testes e checksum da UMD `@supabase/supabase-js@2.117.3`).
- SQL, testes e documentação **não são enviados ao artefato publicado no Pages**; o website serve HTML, CSS, JS e logo.

## Pendências de homologação
- Testar login real com a senha escolhida diretamente no Supabase e verificar a interface.
- Validar desktop/mobile, tema claro/escuro, 360px e ausência de erros no console.
- Validar fluxos com contas de teste: pagamentos, alteração de plano, avisos segmentados, respostas de suporte e auditoria.
- Revisar configurações de e-mail do Supabase Auth se houver convite/recuperação de senha.

**Não execute novamente** `supabase/console.sql` no projeto `admpro-staging`.
A versão principal do AdmPro dos assinantes permanece intacta. O Console é uma interface pública hospedada no GitHub Pages; **os dados são protegidos pelas RPCs e RLS**, não por segredo do URL.
