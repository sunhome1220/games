'use strict';
// 分享連結：關卡連結（路線、起訖站、車型、天色）與成績分享。
// 網頁無法直接呼叫 AirDrop；這裡用 Web Share API（navigator.share）叫出系統分享面板，
// iPhone／iPad／Mac 的 Safari 分享面板本來就有 AirDrop，由使用者點選。不支援時退回複製連結。
// navigator.share 需要 HTTPS（或 localhost）並且必須在點擊的當下同步呼叫。
const SHARE_THEMES=['day','dusk','night'];
const shareBase=()=>location.href.split(/[?#]/)[0];
// 關卡連結：用站號（例如 BL07）而不是索引，資料更新後連結仍然有效
function buildShareUrl(o){
  const q=new URLSearchParams({line:o.line,from:o.fromCode,to:o.toCode});
  if(o.model&&o.model!=='auto')q.set('model',o.model);
  if(o.theme&&o.theme!=='auto')q.set('theme',o.theme);
  return shareBase()+'?'+q.toString();
}
function currentLevelUrl(){const L=LINES[SET.line];return buildShareUrl({line:SET.line,fromCode:L.code[SET.from],toCode:L.code[SET.to],model:SET.model,theme:SET.theme});}
// 解析分享連結的參數並套用到 SET；任何一項不合法就整個忽略，不會用到未驗證的字串
function applyShareParams(search){
  const q=new URLSearchParams(search),line=q.get('line');
  if(!line||!Object.prototype.hasOwnProperty.call(LINES,line))return null;
  const L=LINES[line],f=L.code.indexOf(q.get('from')),t=L.code.indexOf(q.get('to'));
  if(f<0||t<0||f===t)return null;
  const m=q.get('model'),th=q.get('theme');
  SET.line=line;SET.from=f;SET.to=t;
  SET.model=(m&&FLEETS[line].some(x=>x[0]===m))?m:'auto';       // 車型不屬於該路線就改回隨機
  if(SHARE_THEMES.includes(th))SET.theme=th;
  return {line,from:f,to:t,model:SET.model,theme:SET.theme};
}
function levelLabel(line,f,t){const L=LINES[line];return `${L.name} ${L.st[f]} → ${L.st[t]}（${Math.abs(t-f)} 站）`;}
function copyText(s){
  const legacy=()=>{try{const ta=document.createElement('textarea');ta.value=s;ta.setAttribute('readonly','');ta.style.cssText='position:absolute;left:-9999px;top:0;font-size:16px';document.body.appendChild(ta);ta.select();ta.setSelectionRange(0,s.length);const ok=document.execCommand('copy');ta.remove();return ok;}catch(e){return false;}};
  if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(s).then(()=>true,()=>legacy());
  return Promise.resolve(legacy());
}
function showShareBox(id,text,status){
  const el=document.getElementById(id);if(!el)return;
  el.hidden=false;el.innerHTML='';
  const p=document.createElement('div');p.className='sh-st';p.textContent=status;
  const ta=document.createElement('textarea');ta.readOnly=true;ta.value=text;ta.rows=3;ta.onfocus=()=>ta.select();
  el.appendChild(p);el.appendChild(ta);
  ta.style.height='auto';ta.style.height=(ta.scrollHeight+4)+'px';   // 依內容撐高，連結才不會被切掉
}
// 分享：先試系統分享面板（含 AirDrop），不支援或失敗就複製連結並顯示出來讓使用者手動複製
function doShare(payload,boxId){
  if(typeof navigator.share==='function'){
    return navigator.share(payload).then(()=>'shared',e=>{
      if(e&&e.name==='AbortError')return 'cancel';             // 使用者關掉分享面板，不算錯誤
      return fallbackCopy(payload,boxId,true);   // 有分享面板但沒成功
    });
  }
  return fallbackCopy(payload,boxId);
}
function fallbackCopy(payload,boxId,failed){
  const full=payload.text+'\n'+payload.url;
  return copyText(full).then(ok=>{showShareBox(boxId,full,ok?(failed?'分享沒有成功，已改為複製連結，可以貼給朋友':'已複製連結，可以貼給朋友（這個瀏覽器沒有分享面板）'):'請長按下方文字複製，貼給朋友');return ok?'copied':'manual';});
}
function shareLevel(){
  const L=LINES[SET.line],url=currentLevelUrl(),M=SET.model==='auto'?'':MODELS[SET.model].name;
  return doShare({title:'北捷駕駛模擬',text:`🚇 北捷駕駛模擬｜${levelLabel(SET.line,SET.from,SET.to)}${M?'，'+M:''}，來挑戰這一關！`,url},'sh-menu');
}
// 結算頁：分享成績與同一關的挑戰連結
let LASTRES=null;
function shareResult(){
  if(!LASTRES)return Promise.resolve('none');
  const r=LASTRES,g=r.g,L=LINES[g.opt.line],f=L.code.indexOf(g.stations[0].code),t=L.code.indexOf(g.stations[g.stations.length-1].code);
  const url=buildShareUrl({line:g.opt.line,fromCode:g.stations[0].code,toCode:g.stations[g.stations.length-1].code,model:g.M.id,theme:g.theme});
  const text=`🚇 北捷駕駛模擬｜駕駛 ${drvName()} 開 ${levelLabel(g.opt.line,f,t)}（${g.M.name}）拿到 ${r.grade} 評級、總分 ${r.total}${r.rank===0?'，目前個人第 1 名':''}。你能開得更準嗎？`;
  return doShare({title:'北捷駕駛模擬成績',text,url},'sh-res');
}
