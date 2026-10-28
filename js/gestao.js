/* Pagamentos, planos, avisos, suporte e configurações. Nunca acessa public.dados. */
(function(C){
'use strict';
const {esc,brl,date,time,h,card,badge,empty,input,select,button,waLink}=C;
const P=C.state.pagamentos ||= {aba:'pago',mes:'',pagina:1};
const S=C.state.suporte ||= {tipo:'',status:'',pagina:1};
const audit=C.state.auditoria ||= {pagina:1};
function td(l,v){return `<td data-label="${esc(l)}">${v}</td>`}
function payRow(p){return `<tr>${td('Negócio',`<a href="#/conta/${esc(p.conta_id)}">${esc(p.nome_negocio)}</a>`)}${td('Referência',esc(p.referencia))}${td('Valor',brl(p.valor_centavos))}${td('Status',badge(p.status))}${td('Forma',esc(p.forma||'—'))}${td('Data',date(p.pago_em||p.criado_em))}${td('Ações',`<div class="stack horizontal">${p.status==='pago'||p.status==='pendente'?button('Ajustar',`data-adjust-payment="${esc(p.id)}"`):'<small>Histórico preservado</small>'}${waLink(p.telefone)}</div>`)}</tr>`}
function feedbackRow(f){return `<tr>${td('Conta',`<a href="#/conta/${esc(f.conta_id)}">${esc(f.nome_negocio)}</a>`)}${td('Tipo',esc(f.tipo))}${td('Status',badge(f.status))}${td('Mensagem',`<div class="prewrap">${esc(f.mensagem)}</div>${f.resposta?`<small>Resposta: ${esc(f.resposta)}</small>`:''}`)}${td('Data',time(f.criado_em))}${td('Ações',`<div class="stack horizontal"><button class="btn outline compact" data-reply="${esc(f.id)}">Responder</button>${waLink(f.telefone)}</div>`)}</tr>`}
C.views.pagamentos={
 async load(){return Promise.all([C.rpc('console_pagamentos',{p_aba:P.aba,p_mes:P.mes,p_pagina:P.pagina}),C.rpc('console_feedbacks',{p_tipo:'pagamento',p_status:'aberto',p_pagina:1})]).then(([data,alerts])=>({data,alerts}))},
 html({data:r,alerts}){return h('Pagamentos','Conferência, cobrança e registros manuais.',button('Registrar pagamento','id="pay-new"'))+
  `<div class="tabs" role="tablist">${[['pago','Recebidos'],['pendente','Pendentes'],['atrasado','Atrasados'],['estornado','Estornados'],['cancelado','Cancelados']].map(([id,title])=>`<button type="button" role="tab" aria-selected="${id===P.aba}" data-tab="${id}" class="${P.aba===id?'active':''}">${title}</button>`).join('')}</div>`+
  card(`<div class="filter-line">${input('Referência / mês','mes',P.mes,'month')}<button type="button" class="btn outline" id="pay-filter">Aplicar filtro</button></div><div class="mini-stats"><span>Total de registros: <b>${r.total}</b></span><span>Soma filtrada: <b>${brl(r.total_centavos)}</b></span></div>`)+
  card(`<h2>${P.aba==='pago'?'Pagamentos recebidos':P.aba==='pendente'?'Pagamentos pendentes':P.aba==='estornado'?'Estornos registrados':P.aba==='cancelado'?'Pagamentos cancelados':'Pagamentos atrasados'}</h2>`+
    (r.itens.length?`<div class="table-wrap"><table><thead><tr>${['Negócio','Referência','Valor','Status','Forma','Data','Ações'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${r.itens.map(payRow).join('')}</tbody></table></div>`:empty('Nenhum pagamento encontrado.'))+C.pagination(r.total,P.pagina))+
  card(`<h2>Avisos “Já paguei” para conferência</h2><p class="muted">O aviso não confirma pagamento automaticamente.</p>${alerts.itens?.length?alerts.itens.map(f=>`<div class="action-row"><div><a href="#/conta/${esc(f.conta_id)}"><b>${esc(f.nome_negocio)}</b></a><p>${esc(f.mensagem)}</p><small>${time(f.criado_em)}</small></div><div class="stack horizontal"><button class="btn compact" data-confirm-alert="${esc(f.id)}">Confirmar</button><button class="btn outline compact" data-refuse-alert="${esc(f.id)}">Recusar</button></div></div>`).join(''):empty('Nenhum aviso pendente.')}`);
 },
 bind(root,{alerts,data}){
  root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{P.aba=b.dataset.tab;P.pagina=1;C.render()});
  root.querySelector('#pay-filter').onclick=()=>{P.mes=root.querySelector('[name="mes"]').value;P.pagina=1;C.render()};
  C.bindPages(root,p=>{P.pagina=p;C.render()});
  root.querySelector('#pay-new').onclick=()=>selectAccountForPayment();
  root.querySelectorAll('[data-adjust-payment]').forEach(b=>b.onclick=()=>{
    const p=(data?.itens||[]).find(x=>x.id===b.dataset.adjustPayment);if(p)C.adjustPayment(p);
  });
  root.querySelectorAll('[data-confirm-alert]').forEach(b=>b.onclick=()=>{const f=alerts.itens.find(x=>x.id===b.dataset.confirmAlert);if(!f)return;
    C.modal('Confirmar pagamento informado',`<p>Confirme os dados com o extrato antes de registrar:</p><p><b>${esc(f.nome_negocio)}</b><br>${esc(f.mensagem)}</p><a href="#/conta/${esc(f.conta_id)}">Consultar conta</a><div class="actions"><button type="button" class="btn" id="open-payment">Informar valor e referência</button></div>`,box=>{
      box.querySelector('#open-payment').onclick=()=>{C.close();C.payDialog(f.conta_id,{nome_negocio:f.nome_negocio,preco_contratado_centavos:0},f.id)};
    });
  });
  root.querySelectorAll('[data-refuse-alert]').forEach(b=>b.onclick=()=>{const f=alerts.itens.find(x=>x.id===b.dataset.refuseAlert);if(f)replyDialog(f,true)});
 }
};
async function selectAccountForPayment(){
 C.modal('Registrar pagamento',`<form id="find-account-form">${input('Nome, telefone ou e-mail','busca','','search','required')}<div class="actions"><button class="btn" type="submit">Pesquisar conta</button></div></form><div id="account-results"></div>`,box=>{
  box.querySelector('form').onsubmit=async e=>{
   e.preventDefault();try{const r=await C.rpc('console_contas',{p_busca:C.fieldval(e.currentTarget,'busca'),p_pagina:1});
     box.querySelector('#account-results').innerHTML=r.itens.map(x=>`<button type="button" class="account-select" data-account="${esc(x.id)}">${esc(x.nome_negocio)} · ${esc(x.email)} · ${brl(x.preco_contratado_centavos)}</button>`).join('')||empty('Nenhuma conta encontrada.');
     box.querySelectorAll('[data-account]').forEach(b=>b.onclick=()=>{const a=r.itens.find(x=>x.id===b.dataset.account);C.close();C.payDialog(a.id,a)});
   }catch(e){C.toast(e.message,true)}
  };
 });
}
function adjustPayment(p){
 if(!p||!['pago','pendente'].includes(p.status))return;
 const alvo=p.nome_negocio||'esta empresa',reembolso=p.status==='pago';
 C.modal('Ajustar pagamento',`<form id="adjust-pay" class="form-grid">
  <div class="payment-adjust-summary"><b>${esc(alvo)}</b><p>Referência: ${esc(p.referencia)} · ${brl(p.valor_centavos)} · Status: ${esc(p.status)}</p></div>
  ${select('O que fazer?','acao',[
    ['cancelar','Cancelar lançamento incorreto'],
    ...(reembolso?[['estornar','Registrar devolução total (estorno)']]:[])
  ])}
  <label class="field">Motivo (obrigatório)<textarea name="motivo" required minlength="5" maxlength="1500" rows="3" placeholder="Descreva por que o pagamento será cancelado ou devolvido."></textarea></label>
  <p class="muted">Nenhum pagamento será excluído definitivamente. Estornar registra a devolução no financeiro, mas não envia dinheiro: efetue a devolução real pelo Pix/cartão/banco. O vencimento da assinatura não será alterado automaticamente.</p>
  <div class="actions"><button type="button" class="btn outline" id="adjust-cancel">Voltar</button><button type="submit" class="btn danger-btn">Confirmar ajuste</button></div>
 </form>`,box=>{
   box.querySelector('#adjust-cancel').onclick=C.close;
   box.querySelector('form').onsubmit=async e=>{
     e.preventDefault();const d=new FormData(e.currentTarget);
     const acao=d.get('acao'),motivo=String(d.get('motivo')||'').trim();
     if(motivo.length<5){C.toast('Descreva o motivo do ajuste.',true);return;}
     if(!await C.ask('Confirmar ajuste financeiro',acao==='estornar'
       ?'Confirma que a devolução total foi ou será realizada fora do AdmPro? O registro original permanecerá no histórico.'
       :'Cancelar este lançamento? Ele sairá dos recebimentos, mas continuará no histórico para auditoria.','Confirmar'))return;
     if(await C.action(async()=>{
       const mensagem=await C.rpc('console_ajustar_pagamento',{p_pagamento:p.id,p_acao:acao,p_motivo:motivo});
       C.toast(mensagem);
     },'Ajuste registrado')){C.close();C.render();}
   };
 });
}
C.adjustPayment=adjustPayment;
function replyDialog(f,refuse=false){C.modal(refuse?'Recusar aviso de pagamento':'Responder ao suporte',`<form id="reply-form">${select('Status','status',[['aberto','Aberto'],['respondido','Respondido'],['fechado','Fechado']],refuse?'respondido':'respondido')}<label class="field">Resposta para o usuário<textarea name="resposta" required maxlength="5000">${refuse?'Não foi possível confirmar o pagamento. Envie o comprovante e confira os dados informados.':esc(f.resposta||'')}</textarea></label><p class="muted">A resposta aparecerá no aplicativo do assinante.</p><div class="actions"><button type="submit" class="btn">Salvar resposta</button></div></form>`,box=>{
  box.querySelector('form').onsubmit=async e=>{e.preventDefault();const d=new FormData(e.currentTarget);if(!await C.ask('Confirmar resposta','Enviar esta resposta para o assinante e alterar o status da solicitação?','Enviar'))return;
    if(await C.action(()=>C.rpc('console_responder_feedback',{p_feedback:f.id,p_resposta:d.get('resposta'),p_status:d.get('status')}))){C.close();C.render()}
  };
 });}
const tipos=['duvida','problema','sugestao','pagamento'];
C.views.suporte={
 async load(){return C.rpc('console_feedbacks',{p_tipo:S.tipo,p_status:S.status,p_pagina:S.pagina})},
 html(r){return h('Suporte','Caixa de entrada e respostas enviadas aos usuários.')+card(`<div class="filters narrow">${select('Tipo','tipo',[['','Todos'],...tipos.map(x=>[x,x])],S.tipo)}${select('Status','status',[['','Todos'],['aberto','Aberto'],['respondido','Respondido'],['fechado','Fechado']],S.status)}<button type="button" class="btn" id="support-filter">Filtrar</button></div><p><b>${r.abertos||0}</b> solicitações abertas no total.</p>`)+
 card((r.itens.length?`<div class="table-wrap"><table><thead><tr>${['Conta','Tipo','Status','Mensagem','Data','Ações'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${r.itens.map(feedbackRow).join('')}</tbody></table></div>`:empty('Nenhum feedback encontrado.'))+C.pagination(r.total,S.pagina))},
 bind(root,r){root.querySelector('#support-filter').onclick=()=>{S.tipo=root.querySelector('[name="tipo"]').value;S.status=root.querySelector('[name="status"]').value;S.pagina=1;C.render()};C.bindPages(root,p=>{S.pagina=p;C.render()});root.querySelectorAll('[data-reply]').forEach(b=>b.onclick=()=>{const f=r.itens.find(x=>x.id===b.dataset.reply);if(f)replyDialog(f)})}
};
function planoForm(p={}){
 return `<form class="form-grid" id="plan-form">
 ${input('Nome','nome',p.nome||'','text','required maxlength="100"')}
 ${input('Preço mensal (R$)','preco',p.preco_mensal_centavos==null?'0':(p.preco_mensal_centavos/100).toFixed(2),'number','min="0" step="0.01" required')}
 ${input('Limite de clientes (vazio = ilimitado)','clientes',p.limite_clientes??'','number','min="0"')}
 ${input('Serviços por mês (vazio = ilimitado)','servicos',p.limite_servicos_mes??'','number','min="0"')}
 ${input('Ordem','ordem',p.ordem??0,'number','required')}
 ${select('Ativo','ativo',[['true','Sim'],['false','Não']],String(p.ativo??true))}
 <label class="field">Recursos (JSON)<textarea name="recursos" rows="4" required>${esc(JSON.stringify(p.recursos||{},null,2))}</textarea></label>
 <p class="muted">Ao mudar o preço do plano, os valores contratados por contas existentes continuam preservados.</p>
 <div class="actions"><button class="btn" type="submit">Salvar plano</button></div>
 </form>`
}
C.views.planos={
 async load(){return C.table('planos',t=>t.select('*').order('ordem'))},
 html(plans){return h('Planos','Valores novos não são aplicados retroativamente.',button('Novo plano','id="new-plan"'))+card(`<div class="table-wrap"><table><thead><tr>${['Plano','Preço','Clientes','Serviços/mês','Ativo','Ações'].map(s=>`<th>${s}</th>`).join('')}</tr></thead><tbody>${plans.map(p=>`<tr>${td('Plano',esc(p.nome))}${td('Preço',brl(p.preco_mensal_centavos))}${td('Clientes',p.limite_clientes??'∞')}${td('Serviços/mês',p.limite_servicos_mes??'∞')}${td('Ativo',p.ativo?'Sim':'Não')}${td('Ações',`<div class="stack horizontal"><button class="btn outline compact" data-edit-plan="${esc(p.id)}">Editar</button><button class="btn outline compact" data-apply-plan="${esc(p.id)}">Aplicar preço às contas</button><button class="btn outline compact" data-del-plan="${esc(p.id)}">Excluir</button></div>`)}</tr>`).join('')}</tbody></table></div>`)},
 bind(root,plans){root.querySelector('#new-plan').onclick=()=>editPlan();root.querySelectorAll('[data-edit-plan]').forEach(b=>b.onclick=()=>editPlan(plans.find(x=>x.id===b.dataset.editPlan)));
 root.querySelectorAll('[data-del-plan]').forEach(b=>b.onclick=async()=>{if(!await C.ask('Excluir plano','Planos vinculados a contas não poderão ser excluídos.','Excluir'))return; if(await C.action(()=>C.table('planos',t=>t.delete().eq('id',b.dataset.delPlan))))C.render()});
 root.querySelectorAll('[data-apply-plan]').forEach(b=>b.onclick=async()=>{const p=plans.find(x=>x.id===b.dataset.applyPlan);if(!await C.ask('Alterar contratos existentes',`ATENÇÃO: todos os assinantes do plano ${p.nome} passarão a ter o preço contratado de ${brl(p.preco_mensal_centavos)}. Esta ação é registrada na auditoria.`, 'Aplicar novo preço'))return;
 if(await C.action(async()=>{const qtd=await C.rpc('console_aplicar_preco',{p_plano:p.id});C.toast(qtd+' contratos atualizados.')}))C.render()})}
};
function editPlan(p){C.modal(p?'Editar plano':'Novo plano',planoForm(p||{}),box=>{box.querySelector('form').onsubmit=async e=>{
 e.preventDefault();const d=new FormData(e.currentTarget);let recursos;try{recursos=JSON.parse(String(d.get('recursos')));if(!recursos||Array.isArray(recursos)||typeof recursos!=='object')throw Error('JSON de recursos deve ser um objeto')}catch(err){C.toast(err.message,true);return}
 const payload={nome:d.get('nome'),preco_mensal_centavos:Math.round(Number(d.get('preco'))*100),limite_clientes:d.get('clientes')===''?null:Number(d.get('clientes')),limite_servicos_mes:d.get('servicos')===''?null:Number(d.get('servicos')),ativo:d.get('ativo')==='true',ordem:Number(d.get('ordem')),recursos};
 if(p?.id)payload.id=p.id;
 if(p && p.preco_mensal_centavos!==payload.preco_mensal_centavos && !await C.ask('Confirmar mudança de preço',`Alterar preço de ${p.nome}? Contratos existentes manterão os valores acordados.`, 'Alterar preço'))return;
 if(await C.action(()=>C.table('planos',t=>t.upsert(payload).select('id')))){C.close();C.render()}
 }});}
function avisoForm(p={}){const publico=['todos','trial','atrasada'].includes(p.publico)?p.publico:'conta';return `<form id="notice-form" class="form-grid">
 ${input('Título','titulo',p.titulo||'','text','required maxlength="160"')}
 <label class="field">Mensagem<textarea name="mensagem" maxlength="2000" required rows="5">${esc(p.mensagem||'')}</textarea></label>
 ${select('Tipo','tipo',[['info','Informação'],['alerta','Alerta']],p.tipo||'info')}
 ${select('Público','publico',[['todos','Todos'],['trial','Em teste'],['atrasada','Atrasadas'],['conta','Conta específica']],publico)}
 ${input('ID da conta (quando específico)','conta',publico==='conta'?p.publico:'')}
 ${input('Início','inicio',p.inicio?new Date(p.inicio).toISOString().slice(0,16):new Date().toISOString().slice(0,16),'datetime-local','required')}
 ${input('Fim (opcional)','fim',p.fim?new Date(p.fim).toISOString().slice(0,16):'','datetime-local')}
 ${select('Ativo','ativo',[['true','Sim'],['false','Não']],String(p.ativo??true))}
 <h3>Prévia do aviso</h3><div id="notice-preview" class="notice-preview"><strong>${esc(p.titulo||'Título')}</strong><p>${esc(p.mensagem||'Mensagem do aviso')}</p></div>
 <div class="actions"><button class="btn" type="submit">Salvar aviso</button></div></form>`}
C.views.avisos={
 async load(){return C.table('avisos',t=>t.select('*').order('inicio',{ascending:false}))},
 html(items){return h('Avisos','Mensagens programadas no início do aplicativo.',button('Novo aviso','id="new-notice"'))+card(items.length?items.map(n=>`<div class="action-row"><div><b>${esc(n.titulo)}</b> ${badge(n.tipo)}<p>${esc(n.mensagem)}</p><small>Público: ${esc(n.publico)} · ${date(n.inicio)} a ${date(n.fim)} · ${n.ativo?'Ativo':'Inativo'}</small></div><div class="stack horizontal"><button class="btn outline compact" data-edit-notice="${esc(n.id)}">Editar</button><button class="btn outline compact" data-del-notice="${esc(n.id)}">Excluir</button></div></div>`).join(''):empty('Nenhum aviso cadastrado.'))},
 bind(root,items){root.querySelector('#new-notice').onclick=()=>editNotice();root.querySelectorAll('[data-edit-notice]').forEach(b=>b.onclick=()=>editNotice(items.find(x=>x.id===b.dataset.editNotice)));root.querySelectorAll('[data-del-notice]').forEach(b=>b.onclick=async()=>{if(await C.ask('Excluir aviso','O aviso deixará de ser enviado aos assinantes.','Excluir'))if(await C.action(()=>C.table('avisos',t=>t.delete().eq('id',b.dataset.delNotice))))C.render()})}
};
function editNotice(n){C.modal(n?'Editar aviso':'Novo aviso',avisoForm(n||{}),box=>{
 const f=box.querySelector('form'),preview=()=>{box.querySelector('#notice-preview').innerHTML=`<strong>${esc(f.elements.titulo.value)}</strong><p>${esc(f.elements.mensagem.value)}</p>`};
 f.elements.titulo.oninput=preview;f.elements.mensagem.oninput=preview;
 f.onsubmit=async e=>{e.preventDefault();const d=new FormData(f);let pub=d.get('publico')==='conta'?String(d.get('conta')).trim():d.get('publico');
 if(d.get('publico')==='conta'&&!/^[0-9a-f-]{36}$/i.test(pub)){C.toast('Informe um UUID de conta válido.',true);return}
 const payload={titulo:d.get('titulo'),mensagem:d.get('mensagem'),tipo:d.get('tipo'),publico:pub,
 inicio:new Date(d.get('inicio')).toISOString(),fim:d.get('fim')?new Date(d.get('fim')).toISOString():null,ativo:d.get('ativo')==='true'};
 if(n)payload.id=n.id;
 if(!await C.ask('Confirmar aviso',`Salvar aviso para público “${pub}”?`, 'Salvar'))return;
 if(await C.action(()=>C.table('avisos',t=>t.upsert(payload).select('id')))){C.close();C.render()}
 };
 });}
const configKeys=[['pix_chave','Chave Pix','text'],['pix_nome_recebedor','Nome do recebedor','text'],['whatsapp_suporte','WhatsApp de suporte','tel'],['dias_teste','Dias de teste','number'],['dias_tolerancia','Dias de tolerância','number']];
C.views.configuracoes={
 async load(){return Promise.all([C.table('config_sistema',t=>t.select('chave,valor')),C.rpc('console_lista_admins'),C.rpc('console_auditoria',{p_pagina:audit.pagina})]).then(([config,admins,log])=>({config,admins,log}))},
 html({config,admins,log}){const conf=Object.fromEntries(config.map(x=>[x.chave,x.valor]));return h('Configurações do sistema','Parâmetros globais, administradores e auditoria.')+
 card(`<h2>Configurações gerais</h2><form id="config-system" class="form-grid">${configKeys.map(([k,l,t])=>input(l,k,conf[k]??'',t,t==='number'?'min="0" max="365" required':'maxlength="200"')).join('')}<button class="btn" type="submit">Salvar configurações</button></form>`)+
 card(`<h2>Administradores</h2><div class="stack">${admins.map(x=>`<div class="detail-line"><b>${esc(x.email||'Sem e-mail')}</b><small>${esc(x.user_id)}</small></div>`).join('')||empty('Nenhum administrador listado.')}</div><form id="add-admin" class="filter-line"><label class="field">Adicionar administrador por e-mail<input type="email" name="email" required></label><button type="submit" class="btn">Adicionar</button></form><p class="muted">A pessoa precisa possuir usuário Supabase Auth antes de receber permissão.</p>`)+
 card(`<h2>Auditoria</h2><div class="table-wrap"><table><thead><tr>${['Quando','Administrador','Ação','Tabela','Conta','Alteração'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${log.itens.map(a=>`<tr>${td('Quando',time(a.criado_em))}${td('Administrador',esc(a.admin_email||a.admin_id||'Sistema'))}${td('Ação',esc(a.acao))}${td('Tabela',esc(a.entidade))}${td('Conta',a.conta_id?`<a href="#/conta/${esc(a.conta_id)}">${esc(a.conta_id.slice(0,8))}</a>`:'—')}${td('Alteração',`<button type="button" data-audit="${a.id}" class="btn outline compact">Detalhes</button>`)}</tr>`).join('')}</tbody></table></div>`+C.pagination(log.total,audit.pagina))},
 bind(root,{log}){
 root.querySelector('#config-system').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,d=new FormData(f);if(!await C.ask('Salvar parâmetros','As novas configurações serão utilizadas pelo aplicativo e pelos próximos testes e cobranças.','Salvar'))return;
   if(await C.action(async()=>{const records=configKeys.map(([k,_,t])=>({chave:k,valor:t==='number'?Number(d.get(k)):(String(d.get(k)).trim()||null)}));await C.table('config_sistema',t=>t.upsert(records,{onConflict:'chave'}))}))C.render()
 };
 root.querySelector('#add-admin').onsubmit=async e=>{e.preventDefault();const email=C.fieldval(e.currentTarget,'email');if(!await C.ask('Adicionar administrador',`Conceder acesso total de administração a ${email}?`, 'Conceder acesso'))return;
  if(await C.action(()=>C.rpc('console_adicionar_admin',{p_email:email})))C.render()
 };
 C.bindPages(root,p=>{audit.pagina=p;C.render()});root.querySelectorAll('[data-audit]').forEach(b=>b.onclick=()=>{const item=log.itens.find(x=>String(x.id)===b.dataset.audit);C.modal('Registro de auditoria',`<p>Antes:</p><pre class="json">${esc(JSON.stringify(item.antes,null,2))}</pre><p>Depois:</p><pre class="json">${esc(JSON.stringify(item.depois,null,2))}</pre>`)})
 }
};
})(window.Console);