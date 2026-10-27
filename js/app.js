/* Núcleo do Console: autenticação, roteamento, erros, modais e helpers. */
(function (w) {
  'use strict';
  const C = w.Console = {views:{},state:{},user:null,authorized:false};
  const $ = (s,root=document) => root.querySelector(s);
  const $$ = (s,root=document) => [...root.querySelectorAll(s)];
  const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const brl = n => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n||0)/100);
  const date = v => v ? new Date(v.length===10?v+'T12:00:00':v).toLocaleDateString('pt-BR'):'—';
  const time = v => v?new Date(v).toLocaleString('pt-BR'):'—';
  const month = () => new Date().toISOString().slice(0,7);
  const h = (title,desc='',extra='')=>`<header class="page-heading"><div><h1>${esc(title)}</h1>${desc?`<p>${esc(desc)}</p>`:''}</div>${extra}</header>`;
  const empty = msg=>`<div class="empty">${esc(msg)}</div>`;
  const card = (body,cls='')=>`<section class="card ${cls}">${body}</section>`;
  const badge = val=>`<span class="badge badge-${esc(val)}">${esc(val)}</span>`;
  const input=(label,name,value='',type='text',extra='')=>`<label class="field">${esc(label)}<input name="${esc(name)}" type="${esc(type)}" value="${esc(value)}" ${extra}></label>`;
  const select=(label,name,opts,value='',extra='')=>`<label class="field">${esc(label)}<select name="${esc(name)}" ${extra}>${opts.map(o=>{const a=Array.isArray(o)?o:[o,o];return `<option value="${esc(a[0])}" ${String(a[0])===String(value)?'selected':''}>${esc(a[1])}</option>`}).join('')}</select></label>`;
  const button=(label,attrs='')=>`<button type="button" class="btn outline compact" ${attrs}>${esc(label)}</button>`;
  const wa=phone=>{let n=String(phone||'').replace(/\D/g,'');if(n.length===10||n.length===11)n='55'+n;return /^\d{12,13}$/.test(n)?'https://wa.me/'+n:null};
  const waLink=phone=>{const u=wa(phone);return u?`<a href="${u}" target="_blank" rel="noopener noreferrer" class="btn outline compact">WhatsApp ↗</a>`:'<span class="muted">Sem WhatsApp</span>'};
  const fieldval=(form,key)=>new FormData(form).get(key);
  const toast=(message,bad=false)=>{const el=$('#toast');el.hidden=false;el.textContent=message;el.classList.toggle('danger',bad);clearTimeout(C.toastTimeout);C.toastTimeout=setTimeout(()=>el.hidden=true,4800)};
  const dialog=$('#modal');
  function modal(title,markup,bind){$('#modal-title').textContent=title;$('#modal-body').innerHTML=markup;if(!dialog.open)dialog.showModal();bind?.($('#modal-body'));}
  function close(){if(dialog.open)dialog.close();}
  function ask(title,msg,label='Confirmar'){
    return new Promise(resolve=>{
      modal(title,`<p>${esc(msg)}</p><div class="actions"><button type="button" class="btn outline" id="ask-cancel">Cancelar</button><button type="button" class="btn danger-btn" id="ask-ok">${esc(label)}</button></div>`,box=>{
        $('#ask-cancel',box).onclick=()=>close();$('#ask-ok',box).onclick=()=>{resolve(true);close()};
      });
      dialog.addEventListener('close',()=>resolve(false),{once:true});
    });
  }
  function loading(){return '<div class="loading" role="status">Carregando dados do Supabase…</div>'}
  async function rpc(name,args={}){if(!C.authorized)throw Error('Acesso restrito');const r=await C.sb.rpc(name,args);if(r.error)throw r.error;return r.data}
  async function table(name,operation){
    if(!C.authorized)throw Error('Acesso restrito');
    if(!['planos','avisos','config_sistema','notas_conta'].includes(name))throw Error('Tabela não liberada para acesso direto');
    const r=await operation(C.sb.from(name));if(r.error)throw r.error;return r.data;
  }
  async function action(fn,message='Operação concluída') {try{await fn();toast(message);return true}catch(e){console.error('Console:',e);toast(e.message||'Falha ao salvar.',true);return false}}
  function pagination(total,page,fn){const pages=Math.ceil(total/25);return `<div class="pagination"><span>${Number(total||0).toLocaleString('pt-BR')} resultados · página ${page} de ${Math.max(1,pages)}</span><button class="btn outline compact" data-page="${page-1}" ${page<=1?'disabled':''}>Anterior</button><button class="btn outline compact" data-page="${page+1}" ${page>=pages?'disabled':''}>Próxima</button></div>`}
  function bindPages(root,callback){$$('[data-page]',root).forEach(b=>b.onclick=()=>callback(Number(b.dataset.page)))}
  function list(items,columns,renderer){if(!items?.length)return empty('Nenhum registro encontrado.');return `<div class="table-wrap"><table><thead><tr>${columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${items.map(renderer).join('')}</tbody></table></div>`}
  function csv(name,columns,rows){const q=v=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};const contents='\ufeff'+[columns.map(q).join(';'),...rows.map(row=>row.map(q).join(';'))].join('\r\n');const blob=new Blob([contents],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  const route=()=>{const [name,...rest]=(location.hash.replace(/^#\/?/,'')||'inicio').split('/');return {name,id:rest[0]||''}}
  let renderToken=0;
  async function render(){
    if(!C.authorized)return;
    const {name,id}=route();const view=C.views[name]||C.views.inicio,token=++renderToken;
    $$('[data-route]').forEach(a=>{a.classList.toggle('selected',a.dataset.route===name);if(a.dataset.route===name)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
    closeMenu();$('#main').innerHTML=loading();
    try{const data=await view.load?.(id);if(token!==renderToken)return;$('#main').innerHTML=await view.html(data,id);await view.bind?.($('#main'),data,id);}
    catch(e){if(token!==renderToken)return;console.error('Console:',e);$('#main').innerHTML=h('Não foi possível carregar')+card(`<p class="error-text">${esc(e.message||'Erro inesperado.')}</p>${button('Tentar novamente','id="retry"')}`);$('#retry').onclick=render;}
  }
  function closeMenu(){$('#sidebar').classList.remove('open');$('#backdrop').hidden=true;$('#menu-toggle').setAttribute('aria-expanded','false')}
  function toggleMenu(){const on=$('#sidebar').classList.toggle('open');$('#backdrop').hidden=!on;$('#menu-toggle').setAttribute('aria-expanded',String(on))}
  Object.assign(C,{ $, $$, esc,brl,date,time,month,h,empty,card,badge,input,select,button,wa,waLink,fieldval,toast,modal,close,ask,rpc,table,action,pagination,bindPages,list,csv,route,render,closeMenu,toggleMenu,loading });
})(window);