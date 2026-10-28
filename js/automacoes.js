/* Automações: reutiliza os avisos cadastrados, sem duplicar textos. */
(function(w){
'use strict';
const C=w.Console;
const {h,card,esc,badge,input,select,button,empty,date}=C;
const EVENTOS=[
 ['teste_inicio','Início do período de teste'],
 ['teste_antes','Dias antes do fim do teste'],
 ['teste_encerrado','Teste encerrado'],
 ['vencimento_antes','Dias antes do vencimento'],
 ['vencimento_hoje','Vencimento hoje'],
 ['pagamento_pendente','Pagamento pendente (1 dia após)'],
 ['pagamento_atrasado','Dias após o vencimento'],
 ['risco_suspensao','Dias antes da suspensão'],
 ['suspensa','Assinatura suspensa'],
 ['pagamento_confirmado','Pagamento confirmado'],
 ['renovada','Assinatura renovada'],
 ['restabelecida','Acesso restabelecido'],
 ['plano_alterado','Plano alterado'],
 ['cancelada','Assinatura cancelada']
];
const comDias=new Set(['teste_antes','vencimento_antes','pagamento_atrasado','risco_suspensao']);
const rotulo=(e,d)=>{const n=EVENTOS.find(x=>x[0]===e)?.[1]||e;return comDias.has(e)?n+' · '+d+' dia(s)':n};
let cache={regras:[],avisos:[],entregas:[]};
const aviso=(r)=>cache.avisos.find(a=>a.id===r.aviso_id)||{};
const linha=(r)=>{
 const a=aviso(r);
 return `<div class="action-row"><div class="automation-description"><b>${esc(a.titulo||'Aviso indisponível')}</b>
  <div class="automation-tags">${badge(r.ativo?'ativa':'inativa')} ${badge(r.prioridade)} <small>${esc(rotulo(r.evento,r.dias))}</small></div>
  <p class="muted">${esc(a.mensagem||'Mensagem removida.')}</p>
  <small>${r.permite_fechar?'Pode ser fechado':'Não permite fechar'} · ${esc(a.inicio?('Disponível a partir de '+date(a.inicio)):'Sem data de início')}</small>
  </div><div class="stack horizontal">
   ${button('Prévia',`data-preview-rule="${esc(r.id)}"`)}
   ${button('Editar',`data-edit-rule="${esc(r.id)}"`)}
   ${button(r.ativo?'Pausar':'Ativar',`data-toggle-rule="${esc(r.id)}"`)}
   ${button('Excluir',`data-delete-rule="${esc(r.id)}"`)}
  </div></div>`;
};
C.views.automacoes={
 async load(){
  const [regras,avisos,entregas]=await Promise.all([
   C.table('automacoes_alerta',t=>t.select('*').order('criado_em',{ascending:true})),
   C.table('avisos',t=>t.select('id,titulo,mensagem,tipo,ativo,inicio,fim').order('titulo')),
   C.table('alertas_entregas',t=>t.select('id,criado_em,visualizado_em,fechado_em,referencia').order('criado_em',{ascending:false}).limit(200))
  ]);
  cache={regras:regras||[],avisos:avisos||[],entregas:entregas||[]};return cache;
 },
 html({regras,avisos,entregas}){
  const ativos=regras.filter(r=>r.ativo).length;
  const vistos=entregas.filter(e=>e.visualizado_em).length;
  return h('Automação de alertas','Conecte os avisos existentes a situações de teste, vencimento e assinatura.',button('Nova automação','id="rule-new"'))+
  `<div class="stats-grid"><section class="card stat"><small>Regras cadastradas</small><strong>${regras.length}</strong></section>
  <section class="card stat"><small>Regras ativas</small><strong>${ativos}</strong></section>
  <section class="card stat"><small>Últimas entregas</small><strong>${entregas.length}</strong></section>
  <section class="card stat"><small>Visualizadas (amostra)</small><strong>${vistos}</strong></section></div>`+
  card(`<h2>Como funciona</h2><p>Você continua criando os textos em <a href="#/avisos">Avisos</a>. Aqui escolhe o evento que dispara cada mensagem. O sistema confere as datas e os pagamentos no Supabase; apenas o proprietário da empresa recebe alertas financeiros no AdmPro.</p>
  <p class="muted">Os avisos associados passam a ser modelos automáticos e não aparecem como comunicados gerais. O botão “Prévia” não envia nada. Cada regra pode ser pausada individualmente. Os modelos podem permanecer inativos em Avisos: o envio automático é controlado pela regra.</p>
  <p class="muted">O agendamento executa diariamente; o acesso do proprietário também verifica alertas do dia. As entregas são registradas sem duplicação.</p>`)+
  card(`<div class="section-head"><h2>Regras configuradas</h2><small>${avisos.length} mensagens cadastradas</small></div>${regras.length?regras.map(linha).join(''):empty('Nenhuma regra. Clique em Nova automação.')}`);
 },
 bind(root){
  root.querySelector('#rule-new').onclick=()=>editar();
  root.querySelectorAll('[data-edit-rule]').forEach(b=>b.onclick=()=>editar(cache.regras.find(r=>r.id===b.dataset.editRule)));
  root.querySelectorAll('[data-preview-rule]').forEach(b=>b.onclick=()=>visualizar(cache.regras.find(r=>r.id===b.dataset.previewRule)));
  root.querySelectorAll('[data-toggle-rule]').forEach(b=>b.onclick=async()=>{
   const r=cache.regras.find(x=>x.id===b.dataset.toggleRule);if(!r)return;
   if(!await C.ask(r.ativo?'Pausar automação':'Ativar automação',r.ativo?'A regra deixará de gerar novos alertas.':'A regra passará a gerar alertas quando a condição for atendida.','Confirmar'))return;
   if(await C.action(()=>C.table('automacoes_alerta',t=>t.update({ativo:!r.ativo,atualizado_em:new Date().toISOString()}).eq('id',r.id))))C.render();
  });
  root.querySelectorAll('[data-delete-rule]').forEach(b=>b.onclick=async()=>{
   if(!await C.ask('Excluir automação','As entregas associadas também serão excluídas. O texto do aviso será preservado.','Excluir'))return;
   if(await C.action(()=>C.table('automacoes_alerta',t=>t.delete().eq('id',b.dataset.deleteRule))))C.render();
  });
 }
};
function visualizar(r){
 if(!r)return;const a=aviso(r);
 C.modal('Prévia no AdmPro',`<p class="muted">${esc(rotulo(r.evento,r.dias))} · Prioridade: ${esc(r.prioridade)}</p>
 <div class="notice-preview automation-preview ${r.prioridade==='critica'?'critical':r.prioridade==='alta'?'warning':''}">
 <strong>${esc(a.titulo||'Título do aviso')}</strong><p>${esc(a.mensagem||'Mensagem do aviso')}</p>
 ${r.permite_fechar?'<small>× O proprietário pode dispensar o alerta.</small>':'<small>Este alerta permanece visível enquanto válido.</small>'}
 </div><p class="muted">Simulação visual — nenhuma mensagem será enviada.</p>
 <div class="actions"><button class="btn" type="button" id="preview-close">Fechar</button></div>`,box=>{box.querySelector('#preview-close').onclick=C.close});
}
function editar(r={}){
 if(!cache.avisos.length){C.toast('Cadastre um aviso antes de criar uma automação.',true);return}
 const a=aviso(r),evento=r.evento||'teste_antes';
 const markup=`<form id="rule-form" class="form-grid">
  ${select('Mensagem já cadastrada','aviso_id',cache.avisos.map(x=>[x.id,x.titulo]),r.aviso_id||cache.avisos[0].id,'required')}
  ${select('Evento','evento',EVENTOS,evento,'required')}
  ${input('Quantidade de dias','dias',r.dias??3,'number','min="0" max="90" required')}
  ${select('Prioridade','prioridade',[['baixa','Baixa'],['normal','Normal'],['alta','Alta'],['critica','Crítica']],r.prioridade||'normal')}
  ${select('Permitir fechar','permite_fechar',[['true','Sim'],['false','Não']],String(r.permite_fechar??true))}
  ${select('Automação ativa','ativo',[['true','Sim'],['false','Não']],String(r.ativo??true))}
  <h3>Prévia da mensagem</h3><div id="rule-preview" class="notice-preview"></div>
  <p class="muted">Dias só se aplicam a lembretes antes/depois do vencimento ou do período de teste. O prazo de tolerância é o cadastrado em Configurações.</p>
  <div class="actions"><button type="button" class="btn outline" id="rule-cancel">Cancelar</button><button type="submit" class="btn">Salvar regra</button></div>
 </form>`;
 C.modal(r.id?'Editar automação':'Nova automação',markup,box=>{
  const f=box.querySelector('#rule-form');
  const preview=()=>{
   const n=cache.avisos.find(x=>x.id===f.elements.aviso_id.value)||{};
   const precisaDias=comDias.has(f.elements.evento.value);
   f.elements.dias.disabled=!precisaDias;if(!precisaDias)f.elements.dias.value=0;
   else if(Number(f.elements.dias.value)<1)f.elements.dias.value=1;
   box.querySelector('#rule-preview').innerHTML=`<strong>${esc(n.titulo||'Título')}</strong><p>${esc(n.mensagem||'Mensagem')}</p>`;
  };
  f.elements.aviso_id.onchange=preview;f.elements.evento.onchange=preview;preview();
  box.querySelector('#rule-cancel').onclick=C.close;
  f.onsubmit=async e=>{
   e.preventDefault();const d=new FormData(f);
   const payload={aviso_id:String(d.get('aviso_id')),evento:String(d.get('evento')),dias:comDias.has(String(d.get('evento')))?Number(d.get('dias')):0,
    prioridade:String(d.get('prioridade')),permite_fechar:d.get('permite_fechar')==='true',ativo:d.get('ativo')==='true',
    atualizado_em:new Date().toISOString()};
   if(comDias.has(payload.evento)&&(payload.dias<1||payload.dias>90)){C.toast('Informe um prazo entre 1 e 90 dias.',true);return}
   if(r.id)payload.id=r.id;
   if(!await C.ask('Salvar automação','Vincular a mensagem ao evento selecionado? Ela deixará de aparecer como comunicado manual enquanto vinculada.','Salvar'))return;
   if(await C.action(()=>C.table('automacoes_alerta',t=>t.upsert(payload).select('id')))){C.close();C.render()}
  };
 });
}
})(window);
