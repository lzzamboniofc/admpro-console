/* Contas e detalhe: toda listagem é paginada em RPC (25 por página). */
(function(C){
'use strict';
const {esc,brl,date,time,h,card,badge,input,select,waLink,empty,button}=C;
const modelOptions=['','manicure','salao','barbearia','estetica','mecanica','eletrica','limpeza','outro'];
const statusOptions=['','trial','ativa','atrasada','bloqueada','cancelada'];
const F=C.state.contas ||= {busca:'',status:'',plano:'',modelo:'',uf:'',inicio:'',fim:'',ordem:'criado_em',desc:true,pagina:1};
let plans=[];
function args(){return {p_busca:F.busca,p_status:F.status,p_plano:F.plano||null,p_modelo:F.modelo,p_uf:F.uf,p_inicio:F.inicio||null,p_fim:F.fim||null,p_ordem:F.ordem,p_desc:F.desc,p_pagina:F.pagina}}
function td(label,value){return `<td data-label="${esc(label)}">${value}</td>`}
function form(){return `<form id="filtros-contas" class="filters">
 ${input('Buscar nome, telefone, e-mail ou cidade','busca',F.busca,'search','placeholder="Buscar…"')}
 ${select('Status','status',statusOptions.map(s=>[s,s||'Todos']),F.status)}
 ${select('Plano','plano',[['','Todos'],...plans.map(p=>[p.id,p.nome])],F.plano)}
 ${select('Modelo','modelo',modelOptions.map(s=>[s,s||'Todos']),F.modelo)}
 ${input('UF','uf',F.uf,'text','maxlength="2" placeholder="SP"')}
 ${input('De','inicio',F.inicio,'date')}${input('Até','fim',F.fim,'date')}
 ${select('Ordenar','ordem',[['criado_em','Cadastro'],['nome_negocio','Nome'],['ultimo_acesso_em','Último acesso'],['status_assinatura','Status'],['cidade','Cidade']],F.ordem)}
 ${select('Direção','desc',[['true','Decrescente'],['false','Crescente']],String(F.desc))}
 <div class="filter-actions"><button class="btn" type="submit">Filtrar</button><button class="btn outline" id="csv-export" type="button">Exportar CSV</button></div>
 </form>`}
const headers=['Negócio / E-mail','Plano','Status','Telefone','Cidade / UF','Cadastro','Ações'];
function row(c){return `<tr>
 ${td(headers[0],`<a href="#/conta/${esc(c.id)}"><b>${esc(c.nome_negocio)}</b></a><small class="table-sub">${esc(c.email||'E-mail indisponível')}</small>`)}
 ${td('Plano',esc(c.plano))}${td('Status',badge(c.status_assinatura))}
 ${td('Telefone',esc(c.telefone||'—'))}${td('Cidade / UF',esc([c.cidade,c.uf].filter(Boolean).join(' / ')||'—'))}
 ${td('Cadastro',date(c.criado_em))}${td('Ações',`<a class="btn outline compact" href="#/conta/${esc(c.id)}">Detalhes</a> ${waLink(c.telefone)}`)}
 </tr>`}
async function exportCSV(){
 const head=['ID','Nome','E-mail do dono','Telefone','Cidade','UF','Modelo','Plano','Preço contratado (centavos)','Status','Cadastro','Vencimento','Último acesso'];
 const list=[];let page=1,total=0;
 C.toast('Gerando CSV filtrado…');
 while(true){const result=await C.rpc('console_contas',{...args(),p_pagina:page});total=result.total;
  for(const v of result.itens)list.push([v.id,v.nome_negocio,v.email,v.telefone,v.cidade,v.uf,v.modelo_negocio,v.plano,v.preco_contratado_centavos,v.status_assinatura,v.criado_em,v.proximo_vencimento,v.ultimo_acesso_em]);
  if(list.length>=total||!result.itens.length)break;page++;
 }
 C.csv('admpro-contas-'+C.month()+'.csv',head,list);C.toast(list.length+' registros exportados.');
}
C.views.contas={
 async load(){const [p,r]=await Promise.all([C.table('planos',t=>t.select('id,nome').order('ordem')),C.rpc('console_contas',args())]);plans=p||[];return r},
 html(r){return h('Contas','Busca, filtros, paginação e exportação. A consulta de e-mails é restrita ao administrador.')+card(form())+card(`<h2>Assinantes</h2>`+(r.itens?.length?`<div class="table-wrap"><table><thead><tr>${headers.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${r.itens.map(row).join('')}</tbody></table></div>`:empty('Nenhuma conta corresponde aos filtros.'))+C.pagination(r.total,F.pagina))},
 bind(root){const form=root.querySelector('#filtros-contas');form.onsubmit=e=>{e.preventDefault();const d=new FormData(form);['busca','status','plano','modelo','uf','inicio','fim','ordem'].forEach(k=>F[k]=String(d.get(k)||''));F.desc=d.get('desc')==='true';F.pagina=1;C.render()};root.querySelector('#csv-export').onclick=()=>C.action(exportCSV,'CSV gerado.');C.bindPages(root,p=>{F.pagina=p;C.render()})}
};
function usoChart(rows){const series=rows||[],max=Math.max(1,...series.map(x=>x.acessos||0));return card(`<h2>Acessos nos últimos 30 dias</h2><div class="chart-scroll"><div class="bars">${series.map(x=>`<div class="bar-item"><span class="bar-number">${x.acessos}</span><div class="bar-track"><div class="bar" style="height:${Math.max(2,100*x.acessos/max)}%"></div></div><small>${date(x.dia).slice(0,5)}</small></div>`).join('')}</div></div>`) }
function paymentLine(p){return `<div class="detail-line"><b>${esc(p.referencia)}</b><span>${brl(p.valor_centavos)}</span>${badge(p.status)}<span>${date(p.pago_em||p.criado_em)}</span>${['pago','pendente'].includes(p.status)?button('Cancelar / devolver',`data-payment-adjust="${esc(p.id)}"`):'<small>Histórico mantido</small>'}</div>`}
function feedbackLine(f){return `<div class="detail-line"><b>${esc(f.tipo)}</b>${badge(f.status)}<span>${esc(f.mensagem)}</span>${f.resposta?`<p>Resposta: ${esc(f.resposta)}</p>`:''}</div>`}
const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
async function doAction(id,title,description,action,value='',confirm='Confirmar'){
 if(!await C.ask(title,description,confirm))return;
 if(await C.action(()=>C.rpc('console_acao_conta',{p_conta:id,p_acao:action,p_valor:String(value)})))C.render();
}
function detailHtml(payload){const a=payload.conta;
 return h(a.nome_negocio,'Conta '+a.id,`<a href="#/contas" class="btn outline">← Voltar às contas</a>`)+
 `<div class="two-col"><section>${card(`<h2>Dados do negócio</h2><dl class="facts">${[
  ['Nome',a.nome_negocio],['E-mail do dono',a.email],['Telefone',a.telefone],['Cidade/UF',[a.cidade,a.uf].filter(Boolean).join(' / ')],['Modelo',a.modelo_negocio],['Tipo',a.tipo_negocio],['Plano',a.plano],['Valor contratado',brl(a.preco_contratado_centavos)],['Status',a.status_assinatura],['Cadastro',time(a.criado_em)],['Fim do teste',date(a.trial_ate)],['Próximo vencimento',date(a.proximo_vencimento)],['Último acesso',time(a.ultimo_acesso_em)],['Versão do aplicativo',a.versao_app]
 ].map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v||'—')}</dd>`).join('')}</dl>`)}
 ${card(`<h2>Equipe e uso compartilhado</h2><dl class="facts"><dt>Usuários vinculados</dt><dd>${esc(payload.equipe?.usuarios??0)}</dd><dt>Usuários ativos</dt><dd>${esc(payload.equipe?.usuarios_ativos??0)}</dd><dt>Profissionais</dt><dd>${esc(payload.equipe?.profissionais??0)}</dd><dt>Convites pendentes</dt><dd>${esc(payload.equipe?.convites_pendentes??0)}</dd></dl>`)}
 ${card(`<h2>Ações administrativas</h2><div class="stack">${button('Mudar plano','id="change-plan"')}${button('Estender teste','id="extend-trial"')}${button('Registrar pagamento','id="register-pay"')}${button('Bloquear','id="block"')}${button('Desbloquear','id="unblock"')}${button('Cancelar assinatura','id="cancel"')}${waLink(a.telefone)}</div><p class="muted">As alterações são confirmadas e registradas na auditoria do banco.</p>`)}</section>
 <section>${usoChart(payload.uso)}${card(`<h2>Pagamentos</h2>${payload.pagamentos?.length?payload.pagamentos.map(paymentLine).join(''):empty('Nenhum pagamento.')}`)}
 ${card(`<h2>Feedbacks</h2>${payload.feedbacks?.length?payload.feedbacks.map(feedbackLine).join(''):empty('Nenhum feedback.')}`)}
 ${card(`<h2>Notas internas</h2><form id="notes-form" class="internal-notes-form"><label class="field">Nova nota<textarea name="conteudo" maxlength="4000" required></textarea></label><button class="btn" type="submit">Adicionar nota</button></form><div class="stack notes internal-notes-list">${payload.notas?.map(n=>`<article class="note"><p>${esc(n.conteudo)}</p><small>${esc(n.autor_email)} · ${time(n.criado_em)}</small><button class="btn outline compact" data-remove-note="${esc(n.id)}">Excluir</button></article>`).join('')||empty('Sem notas internas.')}</div>`)}</section></div>`;
}
function payDialog(id,a,feedbackId=null){C.modal('Registrar pagamento',`<form id="payment-form" class="form-grid">
 ${input('Valor (R$)','valor',(Number(a.preco_contratado_centavos||0)/100).toFixed(2),'number','step="0.01" min="0.01" required')}
 ${input('Referência (AAAA-MM)','referencia',C.month(),'month','required')}
 ${select('Forma','forma',['pix','dinheiro','transferencia','cartao','outro'])}
 ${input('Data do pagamento','pago_em',new Date().toISOString().slice(0,10),'date','required')}
 <label class="field">Observação<textarea name="observacao" maxlength="1500"></textarea></label>
 <p class="muted">O registro muda a assinatura para ativa e avança o vencimento em um mês. Não troca automaticamente o plano.</p>
 <div class="actions"><button type="button" class="btn outline" id="pay-cancel">Cancelar</button><button type="submit" class="btn">Registrar pagamento</button></div></form>`,box=>{
 box.querySelector('#pay-cancel').onclick=C.close;box.querySelector('form').onsubmit=async e=>{
   e.preventDefault();const f=e.currentTarget,d=new FormData(f),valor=Math.round(Number(d.get('valor'))*100);if(valor<=0){C.toast('Valor inválido.',true);return}
   if(!await C.ask('Confirmar pagamento',`Registrar ${brl(valor)} para ${a.nome_negocio}? Essa operação ativa a assinatura e avança o vencimento.`,'Registrar'))return;
   const args={p_valor:valor,p_referencia:d.get('referencia'),p_forma:d.get('forma'),p_pago_em:d.get('pago_em')+'T12:00:00Z',p_observacao:d.get('observacao')};
   if(feedbackId)args.p_feedback=feedbackId;else args.p_conta=id;
   if(await C.action(()=>C.rpc(feedbackId?'console_confirmar_aviso_pagamento':'console_registrar_pagamento',args))) {C.close();C.render()}
 }; });}
C.views.conta={
 async load(id){if(!uuid.test(id))throw Error('Identificador inválido');const [info,p,equipe]=await Promise.all([C.rpc('console_conta',{p_conta:id}),C.table('planos',t=>t.select('id,nome,preco_mensal_centavos').eq('ativo',true).order('ordem')),C.rpc('console_equipe_conta',{p_conta:id})]);return {...info,plans:p||[],equipe}},
 html(payload){return detailHtml(payload)},
 bind(root,data,id){
  const a=data.conta;
  root.querySelector('#change-plan').onclick=()=>C.modal('Mudar plano',`<form id="set-plan">${select('Novo plano','plano',data.plans.map(p=>[p.id,p.nome+' — '+brl(p.preco_mensal_centavos)]),a.plano_id)}
 <p class="muted">A troca aplica imediatamente os limites e o preço do novo plano. Se a conta estiver em teste, ela será ativada administrativamente e terá vencimento em um mês quando o plano for pago. A operação não registra pagamento.</p>
 <div class="actions"><button type="button" class="btn outline" id="set-plan-cancel">Cancelar</button><button type="submit" class="btn">Aplicar novo plano</button></div></form>`,box=>{
 box.querySelector('#set-plan-cancel').onclick=C.close;
 box.querySelector('form').onsubmit=async e=>{
  e.preventDefault();
  const plan=C.fieldval(e.currentTarget,'plano'),novo=data.plans.find(p=>p.id===plan);
  if(!novo){C.toast('Selecione um plano válido.',true);return}
  if(plan===a.plano_id){C.toast('A empresa já está neste plano.');C.close();return}
  if(!await C.ask('Confirmar mudança de plano',`Alterar de ${a.plano} para ${novo.nome} (${brl(novo.preco_mensal_centavos)}/mês)? A mudança de limites será imediata e o usuário precisará atualizar o AdmPro.`,'Mudar plano'))return;
  if(await C.action(()=>C.rpc('console_acao_conta',{p_conta:id,p_acao:'plano',p_valor:String(plan)}),'Plano atualizado com sucesso')){
   C.close();C.render();
  }
 };
 });
  root.querySelector('#extend-trial').onclick=()=>C.modal('Estender teste',`<form id="extend-form">${select('Período','dias',[['7','7 dias'],['14','14 dias'],['30','30 dias']])}<div class="actions"><button type="submit" class="btn">Continuar</button></div></form>`,box=>{box.querySelector('form').onsubmit=e=>{e.preventDefault();const days=C.fieldval(e.currentTarget,'dias');C.close();doAction(id,'Estender teste',`Adicionar ${days} dias de teste?`,'estender',days,'Estender')}});
  root.querySelector('#register-pay').onclick=()=>payDialog(id,a);
   root.querySelectorAll('[data-payment-adjust]').forEach(b=>b.onclick=()=>{
    const pagamento=(data.pagamentos||[]).find(x=>x.id===b.dataset.paymentAdjust);
    if(pagamento)C.adjustPayment({...pagamento,nome_negocio:a.nome_negocio});
   });
  root.querySelector('#block').onclick=()=>doAction(id,'Bloquear conta','A conta continuará com leitura dos próprios dados, mas não poderá salvar alterações.','bloquear','','Bloquear');
  root.querySelector('#unblock').onclick=()=>doAction(id,'Desbloquear conta','Restaurar a possibilidade de edição segundo a situação de vencimento?','desbloquear','','Desbloquear');
  root.querySelector('#cancel').onclick=()=>doAction(id,'Cancelar assinatura','Atenção: a conta será marcada como cancelada. Esta ação fica registrada na auditoria.','cancelar','','Cancelar assinatura');
  root.querySelector('#notes-form').onsubmit=async e=>{e.preventDefault();const texto=C.fieldval(e.currentTarget,'conteudo');if(await C.action(()=>C.table('notas_conta',t=>t.insert({conta_id:id,conteudo:texto,criado_por:C.user.id}).select('id')))){C.render()}};
  root.querySelectorAll('[data-remove-note]').forEach(b=>b.onclick=async()=>{if(await C.ask('Excluir nota','A exclusão é registrada na auditoria.','Excluir')){if(await C.action(()=>C.table('notas_conta',t=>t.delete().eq('id',b.dataset.removeNote))))C.render()}});
 }
};
C.payDialog=payDialog;
})(window.Console);