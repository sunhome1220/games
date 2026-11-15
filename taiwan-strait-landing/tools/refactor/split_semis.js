// 用法：npm i acorn（在暫存資料夾）後，node split_semis.js 300 js/a.js js/b.js…；超過 300 字的行在最外層分號後斷行，前後語法樹不同就不寫入
// 把超長行在「最外層的分號」後面斷行（用 acorn 斷詞，不會切到字串、正規表示式、模板字串、for(;;) 裡）；再比對前後語法樹必須相同
const acorn=require('acorn'),fs=require('fs');
const LIM=+process.argv[2]||300,files=process.argv.slice(3);
const strip=n=>{if(Array.isArray(n))return n.map(strip);if(n&&typeof n==='object'){const o={};for(const k in n){if(k==='start'||k==='end'||k==='loc'||k==='range')continue;o[k]=strip(n[k]);}return o;}return n;};
for(const f of files){
  const src=fs.readFileSync(f,'utf8');const opts={ecmaVersion:'latest',sourceType:'script',allowHashBang:true};
  const toks=[...acorn.tokenizer(src,opts)];
  // 每個分號的位置與括號深度（() 和 [] 都算；{} 不算——函式本體裡的敘述可以斷行）
  let d=0;const cut=[];
  for(const t of toks){const l=t.type.label;if(l==='('||l==='['||l==='${')d++;else if(l===')'||l===']')d--;else if(l==='}'&&t.type===acorn.tokTypes.dollarBraceR)d--;
    if(l===';'&&d===0)cut.push(t.end);}
  // 只處理超長行
  const lines=[];let pos=0;for(const ln of src.split('\n')){lines.push([pos,pos+ln.length,ln]);pos+=ln.length+1;}
  const long=lines.filter(([a,b,ln])=>b-a>LIM);
  let out=src,ins=[];
  for(const [a,b,ln] of long){const ind=(ln.match(/^\s*/)||[''])[0];for(const c of cut)if(c>a&&c<b){const rest=src.slice(c,b);if(/^\s*(\/\/.*)?$/.test(rest))continue;ins.push([c,'\n'+ind+'  ']);}}
  ins.sort((x,y)=>y[0]-x[0]);for(const [c,s] of ins){let e=c;while(out[e]===' ')e++;out=out.slice(0,c)+s+out.slice(e);}
  const A=JSON.stringify(strip(acorn.parse(src,opts))),B=JSON.stringify(strip(acorn.parse(out,opts)));
  if(A!==B){console.log(f,'AST DIFF — skipped');continue;}
  fs.writeFileSync(f,out);const mx=Math.max(...out.split('\n').map(l=>l.length));console.log(f,'cuts',ins.length,'max now',mx);
}
