import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const file = p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const index=file('../index.html'),css=file('../css/style.css'),
  app=file('../js/app.js'),contas=file('../js/contas.js'),
  darkLogo=file('../img/logo/logo-horizontal-escuro.svg'),
  lightLogo=file('../img/logo/logo-horizontal.svg');
assert.equal((index.match(/class="logo-dark"/g)||[]).length,2);
assert.equal((index.match(/class="logo-light"/g)||[]).length,2);
assert(index.includes('logo-horizontal-escuro.svg'));
assert(darkLogo.includes('fill="#EAF7FA"')&&lightLogo.includes('fill="#1A2328"'));
assert(darkLogo.includes('fill="#0E5A6B"'),'Cor do símbolo deve ser preservada');
assert(!css.includes('filter:brightness(0) invert(1)'));
assert(css.includes('html[data-theme=dark] .logo-dark{display:block}'));
assert(contas.includes('id="notes-form" class="internal-notes-form"'));
assert(css.includes('.internal-notes-form{display:grid;gap:15px;'));
assert(css.includes('.internal-notes-list{margin-top:20px}'));
const modal={open:false,close(){},showModal(){}};
const context={document:{querySelector(s){return s==='#modal'?modal:null}},window:{},location:{hash:'#/inicio'}};
vm.runInNewContext(app,context,{filename:'js/app.js'});
const pg=context.window.Console.pagination(80,2);
assert(pg.includes('aria-label="Página anterior"')&&pg.includes('aria-label="Próxima página"'));
assert(pg.includes('>‹</button>')&&pg.includes('>›</button>'));
assert(!pg.includes('>Anterior</button>')&&!pg.includes('>Próxima</button>'));
const disabled=context.window.Console.pagination(10,1);
assert.equal((disabled.match(/disabled/g)||[]).length,2);
console.log('PASS: logos de dois temas, espaçamento das notas e paginação por setas');
