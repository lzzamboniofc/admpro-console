# Roteiro de homologação — AdmPro Console

Ambiente: projeto Supabase `admpro-staging`; **nunca usar contas pagantes reais** nos primeiros testes. Reverter os dados de teste ao final. Criar três contas Auth: `admin@example.test`, `clienteA@example.test`, `clienteB@example.test` (endereços ilustrativos); o primeiro recebe `public.admins` via SQL Editor.

## 1. Autorização e dados privados

- [ ] Sem sessão: URL `/#/contas` mostra login, nunca uma lista de contas.
- [ ] Sessão usuário não admin: login é seguido de `is_admin()=false`, `signOut()` e “Acesso restrito”.
- [ ] Como não-admin, chamadas diretas às RPCs `console_resumo`, `console_contas`, `console_conta`, `console_registrar_pagamento`, `console_adicionar_admin` retornam `42501`.
- [ ] Como não-admin, `select * from public.notas_conta` e `public.auditoria` devolvem zero registros; INSERT é negado.
- [ ] Como admin, **não é possível ler a tabela `dados`** no REST, nem existe referência a ela no JS. Inspecione Network e execute `node tests/static-check.mjs`.

Exemplo para os dois usuários (após obter sessions usando SDK em página de testes autorizada):

```js
const r = await supabase.rpc('console_resumo');
console.log(r.error?.code); // 42501 para assinante
```

## 2. Métricas e visão geral

- [ ] Dashboard carrega sem baixar tabelas `contas` e `uso_diario` inteiras no navegador.
- [ ] Comparar cards com SQL no README, sob mesmo relógio e fuso da sessão.
- [ ] Gráficos têm números escritos e continuam legíveis em desktop e 360 px.
- [ ] Validar cancelamento e conversão de teste **após** a instalação da auditoria: histórico anterior não existe.
- [ ] Listas de ação mostram link WhatsApp apenas quando o telefone é válido.

## 3. Contas e planos

- [ ] Buscar por nome, telefone, e-mail do dono e cidade; filtros de status, plano, modelo, UF, período, direção; 25 por página.
- [ ] CSV corresponde ao conjunto filtrado, não apenas à página corrente (conferir 28+ contas).
- [ ] Detalhe de conta mostra email por RPC admin, gráfico de uso, pagamentos, feedbacks e notas. Nenhum dado privado de clientes do assinante é consultado.
- [ ] Mudar plano, estender 7/14/30 dias, bloquear/desbloquear e cancelar: confirmação obrigatória, estado correto no banco e registro em `auditoria`.
- [ ] Bloqueio mantém a leitura do app e desabilita gravação após atualização de sessão.
- [ ] Editar o preço do Pro não altera `preco_acordado_centavos` das contas existentes; ação separada “Aplicar preço” exige confirmação explícita.

## 4. Pagamentos e suporte

- [ ] Registrar pagamento manual: `pagamentos.status='pago'`, `criado_por` admin, `contas.status_assinatura='ativa'`, vencimento avançado um mês.
- [ ] Verificar no app que banners de atraso/bloqueio desaparecem após atualizar os dados no servidor.
- [ ] Abrir feedback “pagamento”, confirmar com valor/referência: pagamento e resposta ao feedback gravados juntos; recusar não cria pagamento e envia resposta.
- [ ] Duplicar referência paga da mesma conta é rejeitado, evitando cobrança duplicada.
- [ ] Uma resposta a `feedbacks` aparece no app do assinante após recarregar a tela de suporte.
- [ ] Caixa de suporte filtra por tipo/status, contador na sidebar corresponde ao total real de abertos.

## 5. Avisos

- [ ] Criar aviso para `todos`, `trial`, `atrasada` e `id` de conta específica. Configurar início/fim e ativo.
- [ ] Em cliente A/B, verificar que só público correspondente vê aviso; aviso expirado/inativo não aparece.
- [ ] Fechar aviso no app e confirmar persistência de fechados no cache desse usuário.

## 6. UI e console

- [ ] Validar temas claro/escuro nas rotas `inicio`, `contas`, `conta/:id`, `pagamentos`, `planos`, `avisos`, `suporte`, `configuracoes`.
- [ ] Em largura 360 px: sidebar vira menu, tabelas viram cards, modal não ultrapassa viewport.
- [ ] DevTools Console: nenhuma exceção JavaScript; recursos do painel são carregados do domínio de Console e não do domínio do app.
- [ ] `js/vendor/supabase.js` é servido **localmente**; Network não mostra scripts Supabase carregados de CDN.
- [ ] Conferir acessibilidade: tabulação, foco visível, labels, Escape para fechar modal, menu acessível via teclado.

**Observação:** testes unitários estáticos e browser com SDK simulado não substituem o teste Auth e RLS com sessões reais. Jamais executar o smoke com vendor falso no servidor publicado.