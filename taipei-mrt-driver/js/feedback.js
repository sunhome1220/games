'use strict';
// 意見回饋：不經任何伺服器，組好信件後交給玩家自己的郵件 App 寄出（mailto:），玩家按下寄出才會送出。
// 收件信箱放在這一行；要換信箱只改這裡。
const FEEDBACK_TO='pinhoward0704@gmail.com';
const FB_MAX=1500;   // 內文上限（mailto 連結太長在部分郵件 App 會被截斷）
const FB_TYPES={bug:'錯誤回報',idea:'功能建議',data:'資料／站名錯誤',other:'其他'};
// 玩家可勾選是否附上的「遊戲資訊」，只含版本與設定，不含駕駛名稱或任何個人資料
function fbInfo(){
  const L=(typeof LINES!=='undefined'&&typeof SET!=='undefined')?LINES[SET.line]:null;
  const lv=L?`${L.name} ${L.st[SET.from]}→${L.st[SET.to]}，車型 ${SET.model}`:'';
  return [`版本 ${typeof VERSION!=='undefined'?VERSION:'?'}`,lv,
    `畫面 ${innerWidth}×${innerHeight} @${window.devicePixelRatio||1}x`,
    `瀏覽器 ${navigator.userAgent}`].filter(Boolean).join('\n');
}
function fbBuild(type,msg,withInfo){
  const subject=`[北捷駕駛模擬] ${FB_TYPES[type]||FB_TYPES.other}`;
  let body=String(msg||'').trim().slice(0,FB_MAX);
  if(withInfo)body+='\n\n--- 遊戲資訊 ---\n'+fbInfo();
  return {to:FEEDBACK_TO,subject,body,url:'mailto:'+FEEDBACK_TO+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body)};
}
function fbInit(){
  const box=document.getElementById('fb-box'),btn=document.getElementById('m-fb');if(!box||!btn)return;
  const info=document.getElementById('fb-info'),msg=document.getElementById('fb-msg'),st=document.getElementById('fb-st');
  btn.onclick=()=>{box.hidden=!box.hidden;if(!box.hidden){info.textContent=fbInfo();}};
  msg.onkeydown=e=>e.stopPropagation();      // 打字時不要觸發遊戲快捷鍵
  msg.oninput=()=>{document.getElementById('fb-cnt').textContent=msg.value.length+' / '+FB_MAX;};
  document.getElementById('fb-info-chk').onchange=e=>{info.hidden=!e.target.checked;};
  const cur=()=>fbBuild(document.getElementById('fb-type').value,msg.value,document.getElementById('fb-info-chk').checked);
  document.getElementById('fb-send').onclick=()=>{
    if(!msg.value.trim()){st.textContent='請先寫下你的意見。';return;}
    const m=cur();
    st.textContent='已開啟郵件 App，請在信件裡按「寄出」。若沒有任何反應，請改按「複製內容」，再自行寄到 '+m.to;
    location.href=m.url;                     // 必須在點擊當下同步執行
  };
  document.getElementById('fb-copy').onclick=()=>{
    if(!msg.value.trim()){st.textContent='請先寫下你的意見。';return;}
    const m=cur();
    copyText(`收件人：${m.to}\n主旨：${m.subject}\n\n${m.body}`).then(ok=>{st.textContent=ok?'已複製。請貼到郵件，寄給 '+m.to:'複製失敗，請手動選取內容。收件信箱：'+m.to;});
  };
}
