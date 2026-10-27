import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const base=fileURLToPath(new URL('../', import.meta.url));
for(const name of readdirSync(join(base,'js')).filter(f=>f.endsWith('.js'))){
 const code=readFileSync(join(base,'js',name),'utf8');
 execFileSync(process.execPath,['--check',join(base,'js',name)]);
 assert(!/\.from\(\s*['"]dados['"]\s*\)/.test(code),`Acesso privado proibido: ${name}`);
 assert(!/service_role|sb_secret_/i.test(code),`Chave secreta proibida: ${name}`);
}
const sql=readFileSync(join(base,'supabase/console.sql'),'utf8');
assert(!/(from|join|update|into)\s+public\.dados\b/i.test(sql),'RPC do Console não deve tocar em public.dados');
for(const symbol of ['console_resumo','console_graficos','console_pendencias','console_contas','console_conta(', 'console_pagamentos','console_feedbacks','console_acao_conta','console_registrar_pagamento','console_confirmar_aviso_pagamento','console_responder_feedback'])assert(sql.includes(symbol),`${symbol} ausente`);
for(const id of ['auth-screen','login-form','sidebar','modal','main'])assert(readFileSync(join(base,'index.html'),'utf8').includes(`id="${id}"`));
console.log('PASS: sintaxe JS, separação de dados privados, RPCs e HTML.');
