// 把 async 函式本體的連續敘述段落抽成子函式（只改屬於該函式本身的 return）。用法見檔內註解；改完必跑 score_check.js
// 把一個 async 函式本體的連續敘述段落抽成子函式：段內「屬於這個函式本身」的 return; 改成 return true;，段尾補 return false;
// 呼叫端：if(await 子函式(u,C))return;  C＝需要的區域變數（用解構取回）
const acorn=require('acorn'),fs=require('fs');
const [,,file,fname,specJson]=process.argv;const spec=JSON.parse(specJson); // [{from:i,to:j,name,ctx:[...] ,doc}]
let src=fs.readFileSync(file,'utf8');const ast=acorn.parse(src,{ecmaVersion:'latest'});
let fn=null;(function w(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id&&n.id.name===fname)fn=n;for(const k in n){const v=n[k];if(Array.isArray(v))v.forEach(w);else if(v&&typeof v==='object'&&v.type)w(v);}})(ast);
const body=fn.body.body;const params=fn.params.map(p=>src.slice(p.start,p.end));
// 找出屬於 fn 本身的 return（不在內層函式裡）
const rets=[];(function w(n,inner){if(!n||typeof n!=='object')return;if(n!==fn&&/Function/.test(n.type))inner=true;if(n.type==='ReturnStatement'&&!inner){if(n.argument)throw new Error('return with value at '+n.start);rets.push(n);}for(const k in n){const v=n[k];if(Array.isArray(v))v.forEach(x=>w(x,inner));else if(v&&typeof v==='object'&&v.type)w(v,inner);}})(fn,false);
let helpers='',edits=[];
for(const sp of spec){const a=body[sp.from].start,b=body[sp.to].end;let seg=src.slice(a,b);
  const rs=rets.filter(r=>r.start>=a&&r.end<=b).sort((x,y)=>y.start-x.start);
  for(const r of rs){const s0=r.start-a,s1=r.end-a;seg=seg.slice(0,s0)+'return true;'+seg.slice(s1);}
  const ctx=sp.ctx.length?'const {'+sp.ctx.join(',')+'}=C;':'';
  helpers+='// '+sp.doc+'\nasync function '+sp.name+'('+params.join(',')+(sp.ctx.length?',C':'')+'){'+ctx+'\n  '+seg+'\n  return false;\n}\n';
  edits.push([a,b,'if(await '+sp.name+'('+params.join(',')+(sp.ctx.length?',{'+sp.ctx.join(',')+'}':'')+'))return;']);}
edits.sort((x,y)=>y[0]-x[0]);for(const [a,b,t] of edits)src=src.slice(0,a)+t+src.slice(b);
const at=src.indexOf((fn.async?'async ':'')+'function '+fname+'(');src=src.slice(0,at)+helpers+src.slice(at);
fs.writeFileSync(file,src);console.log('ok',spec.length);
