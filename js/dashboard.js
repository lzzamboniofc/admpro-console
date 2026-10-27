(function(C){
'use strict';
const {esc,brl,date,card,h,empty,waLink,badge}=C;
function chart(title,items,currency=false){
 const max=Math.max(1,...(items||[]).map(x=>Number(x.valor)||0));
 return card(`<h2>${esc(title)}</h2><div class="chart-scroll"><div class="bars" role="img" aria-label="${esc(title)}">${(items||[]).map(x=>`<div class="bar-item"><span class="bar-number">${currency?brl(x.valor):Number(x.valor||0).toLocaleString('pt-BR')}</span><div class="bar-track"><div class="bar" style="height:${Math.max(2,100*Number(x.valor||0)/max)}%"></div></div><small>${esc(x.rotulo)}</small></div>`).join('')}</div></div>`,'chart');
}
function bucket(title,rows,desc){return card(`<div class="section-head"><h2>${esc(title)}</h2><span>${rows.length} exibidos</span></div>${rows.length?rows.map(r=>`<div class="action-row"><div><a href="#/conta/${esc(r.conta_id||r.id)}"><b>${esc(r.nome_negocio)}</b></a><p>${esc(desc(r))}</p></div>${waLink(r.telefone)}</div>`).join(''):empty('Nada pendente nesta categoria.')}`)}
C.views.inicio={
 async load(){const [resumo,graficos,pendencias,equipe]=await Promise.all(['console_resumo','console_graficos','console_pendencias','console_equipe_metricas'].map(n=>C.rpc(n)));return{resumo,graficos,pendencias,equipe}},
 html({resumo:r,graficos:g,pendencias:p,equipe:e}){
  const entries=[['Contas totais',r.total],['Em teste',r.trial],['Pagantes ativas',r.pagantes],['Atrasadas',r.atrasadas],['Bloqueadas',r.bloqueadas],['MRR',brl(r.mrr_centavos)],['Receita recebida (mês)',brl(r.receita_mes_centavos)],['Novas contas (mês)',r.novas_mes],['Cancelamentos (mês)',r.cancelamentos_mes],['Churn mensal',`${r.churn_pct||0}%`],['Conversão 90 dias',`${r.conversao_90d_pct||0}%`],['Ativas últimos 7 dias',r.ativos_7d],['Usuários com acesso',e.usuarios],['Usuários ativos',e.usuarios_ativos],['Profissionais',e.profissionais],['Contas multiprofissionais',e.contas_multiprofissionais]];
  return h('Visão geral','Assinaturas, receita e sinais de atenção.')+
    `<section class="stats-grid">${entries.map(([name,value])=>card(`<small>${esc(name)}</small><strong>${esc(value)}</strong>`,'stat')).join('')}</section>`+
    `<section class="graphs">${chart('Novas contas — 12 semanas',g.novas_semanas)}${chart('Receita — 12 meses',g.receita_meses,true)}${chart('Contas por modelo de negócio',g.modelos)}${chart('Acessos diários — 30 dias',g.acessos_30d)}</section>`+
    h('Ações prioritárias','Lista limitada aos 12 registros mais urgentes por categoria.')+
    `<section class="tasks-grid">${bucket('Teste acabando em até 3 dias',p.trial_fim,r=>'Fim: '+date(r.trial_ate))}${bucket('Pagamentos atrasados',p.atrasadas,r=>'Vencimento: '+date(r.proximo_vencimento))}${bucket('Sem acesso há 14 dias',p.inativas,r=>'Último acesso: '+date(r.ultimo_acesso_em))}${bucket('Feedbacks em aberto',p.feedbacks,r=>r.tipo+' — '+r.mensagem.slice(0,90))}</section>`;
 }
};
})(window.Console);