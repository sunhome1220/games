'use strict';
/* ---------- 存檔：自動存檔＋3 個手動存檔位（瀏覽器 localStorage） ----------
   存的是「某一階段開始時」的完整戰局：S（排除選取、模式這類畫面暫存）＋ 亂數位置（RNGA）＋ 小數累計（ACC）＋ 設定選項。
   讀檔後接著同一條亂數序列，所以和沒中斷直接玩的結果完全相同。
   SAVE_VER 是「存檔格式版本」，和畫面上的遊戲版本分開：畫面、文字、一般規則的小改版不用動它，舊存檔照常能讀（新增的欄位以預設值補上）；
   只有 S 的結構改了、舊檔補預設值也讀不對時才加 1（舊存檔會提示無法讀取）。 */
const SAVE_VER=1,SAVE_SLOTS=['auto','1','2','3'],SAVE_SKIP=new Set(['sel','mode','busy','hover','hoverId','baseSel','cnSel','thSel','cnPend','heloU','afPend']);
const saveKey=id=>'tsl-save-'+id;
function saveCan(){return !!(S&&S.started&&!S.over&&!S.sim&&!S.video&&!(typeof MISSION!=='undefined'&&MISSION));}
function saveMeta(o){return o?{turn:o.S.turn,phase:o.S.phase,era:o.S.era,side:o.S.ctrl&&o.S.ctrl.atk==='human'?(o.S.ctrl.def==='human'?'雙方':'攻方'):'守方',t:o.t}:null;}
function saveRead(id){try{const t=localStorage.getItem(saveKey(id));return t?JSON.parse(t):null;}catch(e){return null;}}
function saveInfo(id){const o=saveRead(id);return o&&o.S?saveMeta(o):null;}
function saveWrite(id){ // 回傳 true／false
  if(!saveCan())return false;
  try{
    const cfg={};CFG_IDS.forEach(k=>{const e=$('#'+k);if(e)cfg[k]=e.value;});
    const body=JSON.stringify({v:SAVE_VER,app:typeof VERSION!=='undefined'?VERSION:'',t:Date.now(),cfg,rng:RNGA,logn:LOGN,acc:ACC,
      S:JSON.parse(JSON.stringify(S,function(k,v){return this===S&&SAVE_SKIP.has(k)?undefined:v;}))});
    localStorage.setItem(saveKey(id),body);return true;
  }catch(e){return false;}
}
function saveDel(id){try{localStorage.removeItem(saveKey(id));}catch(e){}}
function saveAuto(){if(saveCan()&&S.phase&&S.ctrl[S.phase]==='human'&&!S.preAI)saveWrite('auto');}
function saveLoad(id){ // 回傳錯誤文字；成功回傳 ''
  const o=saveRead(id);if(!o||!o.S)return '這個存檔位是空的。';
  if(o.v!==SAVE_VER)return '這個存檔是舊的存檔格式（遊戲版本 '+(o.app||'?')+'），目前版本讀不了。';
  if(S&&S.busy)return '遊戲正在處理中，請稍後再讀檔。';
  try{
    CFG_IDS.forEach(k=>{const e=$('#'+k);if(e&&o.cfg&&o.cfg[k]!=null)e.value=o.cfg[k];});
    newState();const fresh=S;S=Object.assign(fresh,o.S); // 新版新增、舊存檔沒有的欄位保留預設值
    for(const k in ACC)delete ACC[k];Object.assign(ACC,o.acc||{});
    seedRng(S.seed);RNGA=o.rng>>>0;LOGN=o.logn|0;
    HL.shots=[];HL.pend=[];
    if(typeof vStop==='function')vStop();
    $('#modal').hidden=true;mboxSet('');$('#resume').hidden=true;$('#vcard').hidden=true;
    if(document.body.classList.contains('mapfs')&&typeof setFs==='function')setFs(false);
    if(!$('#home').hidden)homeClose();
    setTab('cmd');render();toast('已讀取：第 '+S.turn+' 回合 · '+SIDE[S.phase]+'階段',3200);
    return '';
  }catch(e){try{reset();}catch(_){}return '讀檔失敗：'+e.message;}
}
const saveLabel=id=>id==='auto'?'自動存檔':'存檔 '+id;
function saveDesc(m){if(!m)return '';const d=new Date(m.t),p=n=>String(n).padStart(2,'0');return '第 '+m.turn+' 回合 · '+(ERA[m.era]?ERA[m.era].n:m.era)+' · 你操作：'+m.side+' · '+(d.getMonth()+1)+'/'+d.getDate()+' '+p(d.getHours())+':'+p(d.getMinutes());}
function saveHTML(){ // 設定頁的存檔區塊；沒有進行中的戰役時，只能讀檔
  const can=saveCan();
  return '<div class="wz-q" style="margin-top:16px">戰局存檔</div><div class="wz-note">輪到你操作的每個階段開始時自動存檔；也可以手動存 3 個存檔位。存檔放在這個瀏覽器裡（清除網站資料會消失）。'+(can?'':'目前沒有進行中的戰役，只能讀檔。')+'</div>'+
    SAVE_SLOTS.map(id=>{const m=saveInfo(id);
      return '<div class="svrow" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px"><div style="flex:1 1 12em"><b>'+saveLabel(id)+'</b><div class="wz-note" style="margin:0">'+(m?saveDesc(m):'尚無存檔')+'</div></div>'+
        (id==='auto'?'':'<button class="ghost sm" data-svw="'+id+'"'+(can?'':' disabled')+'>存入</button>')+
        '<button class="ghost sm" data-svr="'+id+'"'+(m?'':' disabled')+'>讀取</button>'+
        (id==='auto'?'':'<button class="ghost sm" data-svd="'+id+'"'+(m?'':' disabled')+'>刪除</button>')+'</div>';}).join('');
}
function saveBind(box,again){ // 綁定 saveHTML 的按鈕；again＝重畫設定頁
  box.querySelectorAll('[data-svw]').forEach(b=>b.onclick=()=>{const id=b.dataset.svw;if(saveInfo(id)&&!confirm('覆蓋「存檔 '+id+'」？'))return;toast(saveWrite(id)?'已存入存檔 '+id:'存檔失敗（瀏覽器空間不足或被封鎖）',2600);again();});
  box.querySelectorAll('[data-svd]').forEach(b=>b.onclick=()=>{if(confirm('刪除「存檔 '+b.dataset.svd+'」？')){saveDel(b.dataset.svd);again();}});
  box.querySelectorAll('[data-svr]').forEach(b=>b.onclick=()=>{
    if(S&&S.started&&!S.over&&!confirm('讀取存檔會結束目前這一局，確定嗎？'))return;
    const e=saveLoad(b.dataset.svr);if(e){toast(e,4200);again();}});
}
