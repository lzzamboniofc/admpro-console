(function(C){
'use strict';
const $=C.$;
let contadorTimer=null,atualizandoContadores=false,ultimoTotal=null,ultimoPixParaConferir=null;
async function init(){
 const conf=window.AdmProConsoleConfig;
 if(!conf?.supabaseUrl||!conf.supabaseKey||conf.supabaseKey.includes('PREENCHER')){
   $('#auth-screen').hidden=false;$('#login-error').textContent='Preencha js/config.js com a chave pública do Supabase.';return;
 }
 if(!window.supabase?.createClient){$('#auth-screen').hidden=false;$('#login-error').textContent='Biblioteca local do Supabase indisponível.';return}
 C.sb=window.supabase.createClient(conf.supabaseUrl,conf.supabaseKey,{auth:{storageKey:'admpro-console-session',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 const {data:{session},error}=await C.sb.auth.getSession();if(error)console.error(error);
 if(session){await check(session.user)}else{showLogin('')}
}
function showLogin(msg){
 C.authorized=false;C.user=null;$('#console').hidden=true;$('#auth-screen').hidden=false;
 $('#login-error').textContent=msg||'';clearInterval(contadorTimer);contadorTimer=null;
 ultimoTotal=null;ultimoPixParaConferir=null;
}
async function check(user){
 try{
  const {data,error}=await C.sb.rpc('is_admin');if(error)throw error;
  if(data!==true){await C.sb.auth.signOut();showLogin('Acesso restrito. Esta conta não é administradora.');return}
  C.authorized=true;C.user=user;$('#user-email').textContent=user.email||'';
  $('#auth-screen').hidden=true;$('#console').hidden=false;
  await C.render();
  await atualizarContadores();
  if(!contadorTimer)contadorTimer=setInterval(atualizarContadores,20000);
 }catch(e){console.error(e);await C.sb.auth.signOut();showLogin('Não foi possível verificar sua permissão. Acesso restrito.');}
}
async function atualizarContadores(){
 if(!C.authorized||atualizandoContadores||document.hidden)return;
 atualizandoContadores=true;
 try{
  const [feedbacks,pedidos]=await Promise.all([
   C.rpc('console_feedbacks',{p_tipo:'',p_status:'',p_pagina:1}),
   C.rpc('console_pedidos_plano',{p_situacao:'pendentes',p_pagina:1})
  ]);
  const suporte=Number(feedbacks.abertos||0);
  const suporteBadge=$('#support-count');suporteBadge.textContent=suporte;suporteBadge.hidden=!suporte;
  const total=Number(pedidos.total||0),conferir=Number(pedidos.para_conferir||0);
  const badge=$('#payments-count');badge.textContent=conferir||total;badge.hidden=!total;
  badge.title=conferir?conferir+' Pix para conferir':total+' solicitações de plano pendentes';
  const mudou=ultimoTotal!==null&&(total!==ultimoTotal||conferir!==ultimoPixParaConferir);
  if(ultimoPixParaConferir!==null&&conferir>ultimoPixParaConferir){
    C.toast('Novo Pix informado! Confira a solicitação em Pagamentos.');
  }
  ultimoTotal=total;ultimoPixParaConferir=conferir;
  if(mudou&&!$('#modal').open&&['inicio','pagamentos','suporte'].includes(C.route().name))await C.render();
 }catch(e){console.warn('Atualização de solicitações e suporte:',e.message)}
 finally{atualizandoContadores=false}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)atualizarContadores()});
$('#login-form').addEventListener('submit',async e=>{
 e.preventDefault();const f=e.currentTarget,btn=f.querySelector('button');btn.disabled=true;$('#login-error').textContent='';
 try{const {data,error}=await C.sb.auth.signInWithPassword({email:C.fieldval(f,'email'),password:C.fieldval(f,'senha')});if(error)throw error;await check(data.user)}
 catch(err){$('#login-error').textContent=err.message||'Falha no login'}finally{btn.disabled=false}
});
$('#logout').onclick=async()=>{if(!await C.ask('Encerrar sessão','Deseja sair do Console?','Sair'))return;await C.sb.auth.signOut();showLogin('Sessão encerrada.')};
$('#theme-toggle').onclick=()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;localStorage.setItem('admpro-console-theme',theme)};
document.documentElement.dataset.theme=localStorage.getItem('admpro-console-theme')||'light';
$('#menu-toggle').onclick=C.toggleMenu;$('#backdrop').onclick=C.closeMenu;$('#modal-close').onclick=C.close;
window.addEventListener('hashchange',()=>C.render());
init();
})(window.Console);