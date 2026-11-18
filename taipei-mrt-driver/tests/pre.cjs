// 讓舊測試略過首次教學（localStorage mrt-tut=1）
const pw=require('playwright');const ol=pw.chromium.launch.bind(pw.chromium);
const init=()=>{try{localStorage.setItem('mrt-tut','1');}catch(e){}document.addEventListener('DOMContentLoaded',()=>{const d=document.getElementById('m-adv');if(d)d.open=true;});};
pw.chromium.launch=async(...a)=>{const b=await ol(...a);
  const nc=b.newContext.bind(b),np=b.newPage.bind(b);
  b.newContext=async(...x)=>{const c=await nc(...x);await c.addInitScript(init);return c;};
  b.newPage=async(...x)=>{const p=await np(...x);await p.context().addInitScript(init);return p;};
  return b;};
