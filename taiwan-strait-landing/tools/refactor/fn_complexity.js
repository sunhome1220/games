// 複雜度報告：列出分支數最多的函式（分支＝if、迴圈、三元、&&／||、catch）。用法：NODE_PATH=<含 acorn 的 node_modules> node tools/refactor/fn_complexity.js js/*.js
const acorn=require('acorn'),fs=require('fs');const R=[];
for(const f of process.argv.slice(2)){const src=fs.readFileSync(f,'utf8');const ast=acorn.parse(src,{ecmaVersion:'latest',locations:true});
 const walk=(n,name)=>{if(!n||typeof n!=='object')return;
  if(/Function/.test(n.type)){let nm=n.id&&n.id.name||name;if(nm){let br=0;const cnt=x=>{if(!x||typeof x!=='object')return;if(/^(If|For|ForIn|ForOf|While|DoWhile|Switch|Conditional|Catch)/.test(x.type)||(x.type==='LogicalExpression'))br++;if(x!==n&&/Function/.test(x.type))return;for(const k in x)if(k!=='loc'){const v=x[k];if(Array.isArray(v))v.forEach(cnt);else if(v&&typeof v==='object')cnt(v);}};cnt(n.body);R.push([f.replace('js/',''),nm,n.loc.end.line-n.loc.start.line+1,n.end-n.start,br]);}}
  for(const k in n)if(k!=='loc'){const v=n[k];if(Array.isArray(v))v.forEach(x=>walk(x,(n.type==='VariableDeclarator'&&n.id.name)||name));else if(v&&typeof v==='object')walk(v,(n.type==='VariableDeclarator'&&n.id.name)||(n.type==='Property'&&n.key&&n.key.name)||name);}};
 walk(ast,null);}
R.sort((a,b)=>b[4]-a[4]);console.log('檔案 函式 行數 字數 分支數');R.slice(0,15).forEach(r=>console.log(r.join('  ')));
