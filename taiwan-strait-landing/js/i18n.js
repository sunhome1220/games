/* 語言：預設繁體中文；可選 English／日本語／简体中文（可隨時更改）。其餘介面與內容在顯示時轉換 */
(function(){
  'use strict';
  const VALID=['zh-TW','en','ja','zh-CN'];let lang='zh-TW',locked=false;
  try{lang=localStorage.getItem('tsl-lang')||'zh-TW';locked=localStorage.getItem('tsl-lang-lock')==='1';}catch(e){}
  if(!VALID.includes(lang))lang='zh-TW';
  window.TSL_LANG=lang;window.TSL_LOCK=false;window.TSL_MISS=new Set();
  window.TSL_SET=function(l){if(!VALID.includes(l))return;try{localStorage.setItem('tsl-lang',l);localStorage.removeItem('tsl-lang-lock');}catch(e){}location.reload();};
  document.documentElement.lang={'zh-TW':'zh-Hant','zh-CN':'zh-Hans',en:'en',ja:'ja'}[lang];
  const CJK=/[㐀-鿿]/;
  let tx=s=>s;
  if(lang==='zh-CN'){
    const from=window.TSL_CN,to=window.TSL_CNS,m={},ph=window.TSL_CNP||{},pk=Object.keys(ph).sort((a,b)=>b.length-a.length);
    for(let i=0;i<from.length;i++)m[from[i]]=to[i];
    const pre=pk.length?new RegExp(pk.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g'):null;
    tx=s=>{if(!CJK.test(s))return s;if(pre)s=s.replace(pre,x=>ph[x]);return s.replace(/[\u3400-\u9fff]/g,c=>m[c]||c);};
  }else if(lang==='en'||lang==='ja'){
    const dict=window.TSL_DICT[lang]||{},keys=Object.keys(dict).sort((a,b)=>b.length-a.length);
    const esc=k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re=keys.length?new RegExp(keys.map(esc).join('|'),'g'):null;
    const P=lang==='en'?{'，':', ','。':'. ','：':': ','；':'; ','、':', ','（':' (','）':') ','「':'"','」':'"','『':'"','』':'"','？':'? ','！':'! ','～':'–','％':'%','－':'-','　':' ','·':'·'}
      :{'，':'、','；':'；','～':'〜'};
    tx=s=>{
      if(!CJK.test(s)&&!/[，。：；、（）「」『』？！～％－　]/.test(s))return s;
      let o=re?s.replace(re,m=>dict[m]):s;
      o=o.replace(/[，。：；、（）「」『』？！～％－　]/g,c=>P[c]!==undefined?P[c]:c);
      if(lang==='en')o=o.replace(/([a-z)%])([A-Z])/g,'$1 $2').replace(/([:;,])(?=[A-Za-z(])/g,'$1 ').replace(/ {2,}/g,' ').replace(/ ([,.;:!?])/g,'$1').replace(/\(\s+/g,'(').replace(/ \)/g,')');
      const left=o.match(/[㐀-鿿]+/g);if(left&&lang==='en')left.forEach(x=>window.TSL_MISS.add(x));if(left&&lang==='ja'){}
      return o;
    };
  }
  window.TSL_T=tx;
  if(lang==='zh-TW')return;
  const skip=n=>{const e=n.nodeType===1?n:n.parentElement;return !e||e.closest('[data-notr],script,style');};
  const doText=n=>{if(skip(n))return;const v=n.nodeValue;if(!v)return;const t=tx(v);if(t!==v)n.nodeValue=t;};
  const ATTR=['title','aria-label','placeholder','alt','data-tip'];
  const doEl=e=>{if(e.nodeType!==1||skip(e))return;for(const a of ATTR){const v=e.getAttribute(a);if(v){const t=tx(v);if(t!==v)e.setAttribute(a,t);}}};
  const walk=root=>{
    if(root.nodeType===3){doText(root);return;}
    if(root.nodeType!==1||skip(root))return;
    doEl(root);
    const w=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);let n;
    while((n=w.nextNode())){if(n.nodeType===3)doText(n);else doEl(n);}
  };
  walk(document.body);document.title=tx(document.title);
  new MutationObserver(ms=>{
    for(const m of ms){
      if(m.type==='childList')m.addedNodes.forEach(n=>walk(n));
      else if(m.type==='characterData')doText(m.target);
      else if(m.type==='attributes')doEl(m.target);
    }
  }).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTR});
})();
