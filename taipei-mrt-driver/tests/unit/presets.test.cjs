// 預設關卡：每個都是 1～3 站、站序有效、起訖不同；預設 SET 就是第一個預設關卡。node taipei-mrt-driver/tests/unit/presets.test.cjs
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..','..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(root,'js','lines.js'),'utf8')+';this.L=LINES',ctx);
const m=html.match(/const PRESETS=\{[\s\S]*?\n\};/);const P=vm.runInContext('('+m[0].replace(/^const PRESETS=/,'').replace(/;$/,'')+')',vm.createContext({}));
let pass=0,fail=0;const ok=(n,c,x)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+x:''));};
ok('四條路線都有預設關卡',['red','blue','green','brown'].every(k=>P[k]&&P[k].length>=3));
const bad=[];for(const k in P)for(const [label,f,t] of P[k]){const N=ctx.L[k].st.length,n=Math.abs(t-f);
  if(!(Number.isInteger(f)&&Number.isInteger(t)&&f>=0&&t>=0&&f<N&&t<N&&n>=1&&n<=3))bad.push(`${k} ${label} ${f}→${t}`);
  const names=label.split(' → ');if(names.length===2&&!label.includes(ctx.L[k].st[f].split('/')[0])&&!label.includes(ctx.L[k].st[f]))bad.push('名稱不符 '+label);}
ok('每個預設關卡都是 1～3 站、站序有效、標籤與起點站名相符',bad.length===0,bad.join(' | '));
const d=html.match(/let SET=\{line:'(\w+)',from:(\d+),to:(\d+)/);
ok('預設 SET 等於第一個預設關卡',d&&P[d[1]][0][1]===+d[2]&&P[d[1]][0][2]===+d[3],d&&d.slice(1).join(','));
console.log(`合計：通過 ${pass} 項、失敗 ${fail} 項`);process.exit(fail?1:0);
