/* 按鈕文字單行；括號內的文字縮小（在翻譯之後處理，以免切斷句子） */
(function(){
  const SEL='button:not(.opt),.segb',RE=/([（(][^（）()]*[）)])/;
  const fix=b=>{
    const w=document.createTreeWalker(b,NodeFilter.SHOW_TEXT);const ns=[];let n;
    while((n=w.nextNode())){if(n.parentElement&&n.parentElement.closest('small'))continue;if(RE.test(n.nodeValue))ns.push(n);}
    ns.forEach(t=>{const parts=t.nodeValue.split(RE),f=document.createDocumentFragment();
      parts.forEach((p,k)=>{if(!p)return;if(k%2){const m=document.createElement('small');m.className='pn';m.textContent=p;f.appendChild(m);}else f.appendChild(document.createTextNode(p));});
      t.replaceWith(f);});
  };
  const scan=r=>{if(r.nodeType===3)r=r.parentElement;if(!r||r.nodeType!==1)return;const b=r.closest&&r.closest(SEL);if(b)fix(b);if(r.querySelectorAll)r.querySelectorAll(SEL).forEach(fix);};
  scan(document.body);
  new MutationObserver(ms=>{for(const m of ms){if(m.type==='childList')m.addedNodes.forEach(scan);else scan(m.target);}}).observe(document.body,{childList:true,subtree:true,characterData:true});
})();
