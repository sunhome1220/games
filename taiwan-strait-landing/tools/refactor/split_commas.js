// 用法：node split_commas.js 300 160 js/a.js…；仍超過 300 字的行在逗號或 + 後斷行（每段約 160 字），前後語法樹不同就不寫入
const acorn=require('acorn'),fs=require('fs');
const LIM=+process.argv[2]||300,SEG=+process.argv[3]||160,files=process.argv.slice(4);
const strip=n=>{if(Array.isArray(n))return n.map(strip);if(n&&typeof n==='object'){const o={};for(const k in n){if(k==='start'||k==='end'||k==='loc'||k==='range')continue;o[k]=strip(n[k]);}return o;}return n;};
for(const f of files){
  const src=fs.readFileSync(f,'utf8'),opts={ecmaVersion:'latest',sourceType:'script'};
  const toks=[...acorn.tokenizer(src,opts)];
  const lines=[];let pos=0;for(const ln of src.split('\n')){lines.push([pos,pos+ln.length,ln]);pos+=ln.length+1;}
  const ins=[];
  for(const [a,b,ln] of lines){if(b-a<=LIM)continue;const ind=(ln.match(/^\s*/)||[''])[0];let last=a;
    for(let i=0;i<toks.length;i++){const t=toks[i];if(t.end<=a||t.end>=b)continue;const l=t.type.label;const nx=toks[i+1];
      if((l===','||l==='+/-'&&src[t.start]==='+')&&t.end-last>SEG&&nx&&nx.type.label!=='=>'&&b-t.end>40){ins.push(t.end);last=t.end;}}
    ins.ind=ins.ind||{};for(const c of ins)if(c>a&&c<b)ins.ind[c]=ind;}
  let out=src;const cs=[...new Set(ins)].sort((x,y)=>y-x);for(const c of cs){let e=c;while(out[e]===' ')e++;out=out.slice(0,c)+'\n'+(ins.ind[c]||'')+'    '+out.slice(e);}
  const A=JSON.stringify(strip(acorn.parse(src,opts))),B=JSON.stringify(strip(acorn.parse(out,opts)));
  if(A!==B){console.log(f,'AST DIFF — skipped');continue;}
  fs.writeFileSync(f,out);console.log(f,'cuts',cs.length,'max now',Math.max(...out.split('\n').map(l=>l.length)));
}
