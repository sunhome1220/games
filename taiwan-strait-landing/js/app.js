'use strict';
/* ---------- 安裝 App／加入主畫面 ---------- */
(function(){
  const btn=$('#btnInstall');if(!btn)return;
  const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const ua=navigator.userAgent,ios=/iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1),mobile=ios||/Android/.test(ua);
  let dp=null;
  const sync=()=>{btn.hidden=standalone()||!(dp||mobile);btn.textContent=dp?'📲 安裝 App':'📲 加入主畫面';};
  addEventListener('beforeinstallprompt',e=>{e.preventDefault();dp=e;sync();});
  addEventListener('appinstalled',()=>{dp=null;btn.hidden=true;});
  try{if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});}catch(e){}
  btn.onclick=async()=>{
    if(dp){dp.prompt();try{await dp.userChoice;}catch(e){}dp=null;sync();return;}
    let d=document.getElementById('wn');if(d)d.remove();
    d=document.createElement('div');d.id='wn';d.setAttribute('role','dialog');d.setAttribute('aria-label','加入主畫面');
    const steps=ios?['點 Safari 下方（或右上角）的「分享」按鈕','在選單中往下找並點「加入主畫面」','按「新增」，之後就能像 App 一樣從主畫面開啟']:['點瀏覽器右上角的選單（⋮）','選「安裝應用程式」或「加到主畫面」','確認後，之後就能像 App 一樣從主畫面開啟'];
    d.innerHTML='<div class="wn-card"><button class="wn-x" aria-label="關閉">✕</button><h3>加入主畫面</h3><p style="margin:0 0 6px;font-size:13.5px">把遊戲加到主畫面，可以全螢幕開啟、不用每次輸入網址：</p><ol style="margin:4px 0 0;padding-left:20px;font-size:13.5px">'+steps.map(x=>'<li style="margin:5px 0">'+x+'</li>').join('')+'</ol><div class="btns"><button id="wnOk">知道了</button></div></div>';
    document.body.appendChild(d);const close=()=>d.remove();d.querySelector('#wnOk').onclick=close;d.querySelector('.wn-x').onclick=close;d.addEventListener('click',e=>{if(e.target===d)close();});d.querySelector('#wnOk').focus();
  };
  sync();
})();
$('#verLog').onclick=e=>{e.preventDefault();showChangelog(true);};
if(wnSeen!==VERSION)setTimeout(()=>showChangelog(false),600);
const newverBtn=$('#newver');
function updateLabel(){newverBtn.textContent=S&&S.started&&!S.over?'🔔 有新版本，點此更新（對局將結束）':'🔔 有新版本，點此更新';}
async function checkUpdate(){
  try{
    const txt=await (await fetch('js/version.js?check='+Date.now(),{cache:'no-store'})).text();
    const v=(txt.match(/const VERSION='([^']+)'/)||[])[1];
    newverBtn.hidden=!v||v===VERSION;if(!newverBtn.hidden)updateLabel();
  }catch(e){/* 離線或無法取得時略過 */}
}
newverBtn.onclick=()=>location.replace(location.pathname+'?v='+Date.now());
if(location.protocol.startsWith('http')){
  checkUpdate();setInterval(checkUpdate,5*60*1000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkUpdate();});
  addEventListener('focus',checkUpdate);addEventListener('pageshow',checkUpdate);
}
$('#btnStart').addEventListener('click',()=>{if(!newverBtn.hidden)updateLabel();});

/* ---------- 設定視窗（語言等不常改的選項放這裡，避免作戰設定頁過長） ---------- */
const LANGOPTS={'zh-TW':['繁體中文','預設語言。'],en:['English','English interface and content.'],ja:['日本語','日本語のインターフェースと内容。'],'zh-CN':['简体中文','简体中文界面与内容。']};
let SETTINGS_STATN='100';
function applyPref(id,v){ // 設定視窗改選項：開始前走一般流程；對局中只改該項，不重設指揮權等
  const el=$('#'+id);if(!el)return;el.value=v;
  if(!S||!S.started){el.dispatchEvent(new Event('change'));return;}
  if(id==='optSpeed'){if(S.sim&&!S.simAuto)S.speed=+v;}
  else if(id==='optNews'){S.newsOn=v!=='0';S.newsCompact=v==='2';}
  else if(id==='optVoice'){try{localStorage.setItem('tsl-voice-user','1');}catch(e){}voiceBtn();}
  else if(id==='optSfx')sfxBtn();
  else if(id==='optFxSpd')FXSPD=+v||1;
  else if(id==='optTerm'){TERM=v;render();}
  else if(id==='optVSpeed'){if(S.video)V.sp=+v||2;}
  saveSetup();
}
function renderSettings(){
  const box=$('#mbox'),cur=window.TSL_LANG||'zh-TW';
  const seg=(attr,ent,on,n)=>'<div class="seg" role="radiogroup" style="--n:'+n+'">'+ent.map(([v,o])=>'<button class="segb'+(v===on?' on':'')+'" role="radio" aria-checked="'+(v===on)+'" '+attr+'="'+v+'"><b>'+o[0]+'</b></button>').join('')+'</div>';
  let h='<div class="eyebrow">⚙ 設定</div><div class="btns" style="margin:4px 0 12px"><button class="ghost" id="stHist">📜 戰績紀錄（'+loadHistory().length+' 場）</button></div><h3>語言 / Language</h3>'+seg('data-lang',Object.entries(LANGOPTS),cur,2)+
    '<div class="wz-note" style="margin-top:10px">'+LANGOPTS[cur][1]+'</div><div class="wz-note" style="margin-top:8px">切換語言後頁面會重新載入；進行中的對局會結束。</div>';
  PREF_FIELDS.forEach(f=>{const v=$('#'+f.sel).value,ent=Object.entries(f.opts);
    h+='<div class="wz-q" style="margin-top:16px">'+f.q+'</div>'+seg('data-pref="'+f.sel+'" data-v',ent,v,ent.length<=3?ent.length:2)+(f.opts[v]&&f.opts[v][1]?'<div class="wz-note" style="margin-top:8px">'+f.opts[v][1]+'</div>':'');});
  h+='<div class="wz-q" style="margin-top:16px">進階：用目前設定跑統計</div><div class="wz-note">想知道這組設定誰比較有利？讓電腦自動模擬多局，統計勝率、代價與決策的影響。</div>'+
    '<div style="margin-top:8px">'+seg('data-statn',[['50',['50 局']],['100',['100 局']],['300',['300 局']]],SETTINGS_STATN,3)+'</div>'+
    '<div class="btns" style="margin-top:10px"><button class="ghost" id="stRun"'+(STAT.running?' disabled':'')+'>開始統計</button></div>';
  h+='<div class="wz-q" style="margin-top:16px">支持作者</div><a id="stTip" class="btnlink" href="https://service.jkopay.com/r/transfer?j=Transfer:900386051&amp;amount=50" target="_blank" rel="noopener noreferrer">☕ 請作者喝杯咖啡<br><small>純屬好玩！不給也能玩到爆。金額預設 50 元（約一杯超商咖啡），付款時可以自己改。</small></a>';
  h+='<div class="btns" style="margin-top:16px"><button id="stClose">關閉</button></div>';
  box.innerHTML=h;
  box.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{
    const v=b.dataset.lang;if(v===cur)return;
    if(confirm('Language / 語言 → '+LANGOPTS[v][0]+'\n\n切換後頁面會重新載入（進行中的對局會結束）/ The page reloads and the current game ends.'))window.TSL_SET(v);
  });
  box.querySelectorAll('[data-pref]').forEach(b=>b.onclick=()=>{applyPref(b.dataset.pref,b.dataset.v);renderSettings();});
  $('#stHist').onclick=()=>{mboxSet('');$('#modal').hidden=false;renderHistory();};
  box.querySelectorAll('[data-statn]').forEach(b=>b.onclick=()=>{SETTINGS_STATN=b.dataset.statn;renderSettings();});
  $('#stRun').onclick=()=>{$('#modal').hidden=true;box.innerHTML='';if(!S.started)readSetup();runStats(+SETTINGS_STATN);};
  $('#stClose').onclick=()=>{$('#modal').hidden=true;box.innerHTML='';};
  $('#stClose').focus();
}
function openSettings(){
  if(!$('#modal').hidden)return;
  mboxSet('');$('#modal').hidden=false;$('#resume').hidden=true;renderSettings();
}
$('#btnSettings').onclick=openSettings;

/* ---------- setup wizard ---------- */
const isSim=()=>$('#optMode').value==='sim';
const isVideo=()=>$('#optMode').value==='video';
const PREF_FIELDS=[
  {sel:'optSpeed',q:'推演速度（電腦推演模式）',opts:{'1':['一般','每個動作有短暫停頓，方便看清楚。'],'0.35':['快速','縮短動作之間的停頓。']}},
  {sel:'optVSpeed',q:'播放速度（純模擬影片模式）',opts:{'1':['1×','逐步閱讀，一場約需數分鐘。'],'2':['2×','建議速度。'],'4':['4×','快轉，適合只看結果與重點。']}},
  {sel:'optNews',q:'每回合結束時顯示國際快訊',opts:{'1':['完整快訊','戰場插圖、頭條與戰況摘要，每回合跳出一個視窗。'],'2':['簡訊','只在畫面上閃一行頭條，不跳視窗；完整內容仍寫入戰報。'],'0':['不顯示','直接進入下一回合。']}},
  {sel:'optFxSpd',q:'火力動畫速度',opts:{'0.5':['慢（0.5 倍）','動畫時間加倍，看得比較清楚。'],'1':['正常','（預設）各武器速度依真實速度成比例。'],'2':['快（2 倍）','動畫時間減半。'],'4':['很快（4 倍）','動畫時間剩四分之一，適合快速推進。']}},
  {sel:'optTerm',q:'部隊兵力的表示方式',opts:{'plain':['通俗文字','（預設）陸軍旅顯示「戰力 %」、艦隊顯示「艘」、飛彈顯示「發射車」、航艦顯示「輕傷／重創／擊沉」，島上合計換算成「相當於幾個旅」。'],'steps':['戰棋用語（步）','沿用兵棋的「步」：每個單位有幾步，受損一次少一步；合計顯示加權後的戰力點數。規則完全相同，只是說法不同。']}},
  {sel:'optSfx',q:'空襲警報音效',opts:{'0':['關閉','（預設）不播放。'],'1':['開啟','第 1 回合攻方第一波火力打擊開始時，鳴放約 6 秒的空襲警報（瀏覽器合成的升降音，不是官方錄音）。觀戰與統計模式不響。']}},
  {sel:'optVoice',q:'戰報語音播放',opts:{'0':['不播放','（預設）安靜閱讀。瀏覽器內建語音較機械，所以預設不開。'],'1':['自動播放','每回合結束時，用瀏覽器內建語音簡短唸出「海峽快訊」的重點（不逐條唸戰報、不唸生硬的數字），語言隨介面語言；也可隨時用地圖上方的「語音」按鈕開關。']}}
];
const SETUP_PAGES=[
 {t:'對戰方式',s:'方式',d:'先決定怎麼玩：自己指揮，或交給電腦推演整場戰爭。（語言、速度、快訊、語音在右上角「⚙ 設定」）',fields:[
  {sel:'optMode',q:'模式',opts:{play:['對戰','由你下令移動、攻擊與打擊，隨時掌握戰場。'],sim:['電腦推演','雙方由電腦操作，途中在 7 個關鍵節點暫停，由你做決策或擲骰，最後產出推演時間軸與檢討報告。','電腦推演'],video:['純模擬（看影片）','全程由電腦操作，並自動決策與擲骰，像看攻防影片：以戰棋地圖為背景播放，雙方動作與影響顯示在下方字幕區。可暫停、變速、拖曳時間軸，結束後附戰後檢討。','純模擬']}},
  {sel:'optSide',q:'你要操作哪一方？',when:()=>$('#optMode').value==='play',opts:{atk:['攻方（紅）','你指揮渡海登陸，電腦防守台灣。'],def:['守方（藍）','你防守台灣，電腦負責進攻。'],both:['雙方都操作','同一台裝置輪流操作兩方。'],none:['都不操作（觀戰）','兩邊都由電腦操作，看戰局演變。','觀戰']}}]},
 {t:'判定回合與兵力年代',s:'回合',d:'戰爭持續到指定回合結束，才依三項條件判定勝負，攻方達成 2 項以上獲勝：① 台北由攻方控制 ② 攻方控制的主要港口（基隆、台北港、台中港、高雄）卸載容量足以支撐島上部隊（容量依實際吞吐量：高雄 25、台中港 8、台北港 5、基隆 4，至少 8） ③ 攻方島上綜合戰力（依部隊種類加權）不少於守方。只拿下台北且連續控制 2 個回合以上，判「僵局」（首都陷落但攻方孤立）；到最後才占領則視為暫時占領，仍判守方勝。每回合約半天。',fields:[
  {sel:'optT',q:'幾回合後判定？',opts:{'6':['第 6 回合','約 3 天。時間很緊，攻方多半來不及站穩。'],'8':['第 8 回合','約 4 天。基準設定。'],'10':['第 10 回合','約 5 天。攻方有較多時間奪港。'],'12':['第 12 回合','約 6 天。長期戰，攻方較有機會站穩。']}},
  {sel:'optEra',q:'兵力年代（年份）',opts:Object.fromEntries(Object.entries(ERA).map(([y,e])=>[y,[e.n,e.d,e.short]]))}]},
 {t:'戰前集結',s:'集結',d:'集結越公開，台美日越早準備。',fields:[
  {sel:'optExer',q:'演習規模（借演習轉為攻擊）',when:()=>!isSim()&&$('#optBuild').value==='exercise',opts:{small:['小規模','同歷次環台軍演（單日約 150 架次、十幾艘軍艦）。識破約 15%。基準。'],mid:['中規模','超過歷次軍演。護航艦 +2（預先部署在海峽），識破約 45%。'],huge:['空前大規模','近乎戰爭的規模。護航艦 +3、兩棲旅 +1，但識破約 85%。']}},
  {sel:'optLift',q:'共軍海運運力估計（登陸艦與運輸船）',when:()=>!isSim(),opts:{'0':['保守','總運力約 8 個旅（約 3～4 萬人）：兩棲艦群 4 個可直接搶灘；滾裝船 4 個旅要等拿下港口，或守住灘頭架設浮動碼頭才能卸載（後續梯隊）。依 2025 年分析的保守估計。'],'1':['中間（基準）','總運力約 11 個旅（約 4 萬人）：兩棲艦群 5 個可直接搶灘；滾裝船 6 個旅屬後續梯隊，要港口或浮動碼頭。依多數公開估計的中間值。'],'2':['樂觀','總運力約 13 個旅（約 6 萬人）：兩棲艦群 5 個可直接搶灘；滾裝船 8 個旅屬後續梯隊，要港口或浮動碼頭。依 Shugart 2022 年軍民合計的樂觀估計。']}},
  {sel:'optMonth',q:'開戰月份（決定天候機率）',opts:{'1':['1 月','東北季風、浪高；無颱風。守方動員較慢。'],'2':['2 月','東北季風、浪高；無颱風。守方動員較慢。'],'3':['3 月','東北季風尾聲，天候漸穩。'],'4':['4 月','春季窗口：海象最穩定，第 1 回合必為好天氣。基準設定。'],'5':['5 月','天候尚可，梅雨前後。'],'6':['6 月','梅雨季，濕度高、能見度時好時壞。'],'7':['7 月','颱風季開始，惡劣天候機率上升（無東北季風）。'],'8':['8 月','颱風季高峰，惡劣天候機率最高。'],'9':['9 月','颱風季高峰，惡劣天候機率高。'],'10':['10 月','秋季窗口：能見度佳，第 1 回合火力 +2；東北季風開始。'],'11':['11 月','東北季風，浪高。'],'12':['12 月','東北季風、浪高；無颱風。守方動員較慢。']}},
  {sel:'optBuild',q:'攻方怎麼集結？',when:()=>!isSim(),opts:{open:['公開全面集結','兵力最多（+2 兩棲旅、+1 重型旅、護航艦隊 +2），但守方提早動員、美國航艦已在附近。'],exercise:['演習掩護','以軍演名義集結，雙方都只有部分預警。基準。'],surprise:['戰略突襲','兵力少一截（−2 兩棲旅、−1 重型旅），換取守方動員延後。']}},
  {sel:'optAxN',q:'攻擊軸線：北部（林口、桃園，可多選）',when:()=>!isSim(),opts:{'0':['不指定／電腦決定','北、中部都不勾時，由電腦選一個主攻區並集中兵力。'],'1':['選擇北部','朝台北方向（林口、淡水、桃園）。']}},
  {sel:'optAxC',q:'攻擊軸線：中部（新竹、苗栗、台中港）',when:()=>!isSim(),opts:{'0':['不選',''],'1':['選擇中部','朝台中港與新竹方向。']}},
  {sel:'optAxP',q:'攻擊軸線：澎湖',when:()=>!isSim(),opts:{'0':['不選','澎湖不作為目標，陸戰旅改歸中部軸線。'],'1':['選擇澎湖','陸戰旅攻占馬公，作為跳板（基準設定）；與本島同時進攻。'],'2':['先取澎湖再攻本島','頭幾回合集中火力與陸戰旅奪下馬公，拿到前進基地（攻方火力 +1）後才渡海攻本島（最晚第 7 回合出發）；代價：主攻延後，守方有更多時間動員與疏散。']}}],
  note:()=>isSim()?'推演模式的集結會在第一個事件節點由你選擇，這一頁不用設定。':''},
  {t:'假設情境',s:'假設',d:'想玩「如果……」的情境嗎？下面全部預設關閉，每一項都標明依據與代價；開啟後結算頁會標示使用了哪些假設，結果不代表真實預測。攻方、守方各有選項，點開分組查看。',fields:[
  {sel:'optWiLift',grp:'atk',q:'海運運力無限（舊版外掛）',opts:{'0':['關閉',''],'1':['開啟','登陸艦與運輸船多到不必往返，增援旅不用等船。這是舊版的假設，並不符合實際運力；結算頁會標明本局用了這個假設。']}},
  {sel:'optWiShip',grp:'atk',q:'加速造艦',opts:{'0':['關閉',''],'1':['開啟','護航艦隊 +2、航艦 +1（上限 4）、兩棲艦群 +2、滾裝船團 +2。代價：軍費壓力大。屬推估。']}},
  {sel:'optWiWx',grp:'atk',q:'海象永遠適合登陸（純假設）',opts:{'0':['關閉',''],'1':['開啟','開戰後天候固定良好。不符實際氣候，只供體驗。']}},
  {sel:'optWiDArms',grp:'def',q:'軍購準時到貨',opts:{'0':['關閉',''],'1':['開啟','美製武器如期交付：守方反艦飛彈 +3、防空 +1；2026 年海馬士第二批（18 輛、陸軍戰術飛彈 20 枚）開戰前到貨，其他年代長程飛彈 +2。']}},
  {sel:'optWiLocal',grp:'def',q:'國造武器提前量產',opts:{'0':['關閉',''],'1':['開啟','海鯤潛艦 +1、長程飛彈 +3。依官方量產計畫的樂觀假設，屬推估。']}},
  {sel:'optWiAllies',grp:'def',q:'美日提前介入',opts:{'0':['關閉',''],'1':['開啟','美軍航艦打擊群提前到位。']}}]},
 {t:'守方戰前準備',s:'守備',d:'開戰前守方的備戰、預警反應與兵力部署，都在這裡先決定，開戰後不再彈窗。選「電腦決定」就由電腦隨機挑一項（不含🔥）。每項都標明好處與代價。',fields:EVENTS.filter(e=>e.setup).map(e=>({sel:e.setup,q:e.title,when:()=>$('#optMode').value!=='play'||$('#optSide').value!=='atk',opts:Object.fromEntries([['auto',['電腦決定','由電腦隨機挑一項。']]].concat(e.choice.options.map(o=>[o.id,[o.label,o.desc]])))}))},
 {t:'美日參戰與確認',s:'確認',d:'美國、日本是否參戰、以什麼方式參戰，會大幅改變戰局。下方是設定摘要；任何一頁都可以回去修改，所有頁面看過之後，在哪一頁都能開始作戰。',fields:[
  {sel:'optAirGen',q:'空軍裝備世代（隱形機占比）',opts:{legacy:['非隱形為主','雙方戰機以第四代為主，隱形機很少。'],mixed:['混合（基準）','共軍殲-20／殲-35 約兩成、盟軍 F-35／F-22 約四成；台灣沒有隱形機。隱形占比隨年代每年略增。'],stealthy:['隱形佔多數','共軍約四成五、盟軍約六成五為隱形機；台灣仍沒有。']}},
  {sel:'optAirModel',q:'空戰模型',opts:{bvr:['視距外（基準）','隱形占比、反隱形感測與電子戰會影響制空與防空突破。盟軍要參戰後隱形機才會出現。'],simple:['簡化','不計隱形與電戰，沿用舊的制空判定。']}},
  {sel:'optEW',q:'電子戰強度',opts:{low:['低','干擾弱：空戰與飛彈較容易命中，損失較大。'],mid:['中（基準）',''],high:['高','干擾強：空戰飛彈較易被干擾落空，損失較小；對岸防空壓制也較容易。']}},
  {sel:'optFx',q:'參戰情境',opts:{interest:['依自身利益決定','美日不擲骰，依戰況與自身利益評估是否參戰：半導體與第一島鏈、攻方是否已拿下港口或台北、守軍撐不撐得住、美軍傷亡、日本與美國彼此的態度、本國基地是否被打。事件節點會列出評估理由。','依利益'],intel:['只提供情報（不公開參戰）','美國只提供情報與目標資料（守方反艦飛彈命中門檻 −1），不補給、不出兵、不公開參戰；日本中立，戰區基地也不能被打擊。','只提供情報'],none:['不介入（台灣孤軍）','美日全程不參戰，戰區基地也不能被打擊。'],full:['開戰即全面介入','美日第 1 回合就參戰，航艦仍要 2 回合才抵達。']}},{sel:'optAlly',q:'美日盟軍由誰操作',when:()=>$('#optMode').value==='play'&&$('#optSide').value!=='atk',opts:{ai:['電腦操作','美日艦隊與潛艦由電腦依戰況行動。'],player:['你操作','美日參戰後，你可以移動美航艦、護航艦、海自艦艇與攻擊潛艦，下達艦隊齊射、艦載機打擊與戰斧巡弋飛彈；沒下令的單位在結束階段由電腦代為行動。美日是否參戰仍由戰況決定。']}}],summary:true},
];
const WZ={i:0,done:SETUP_PAGES.map((_,i)=>i===0)};
function optLabel(sel,v){for(const f of PREF_FIELDS.concat(...SETUP_PAGES.map(pg=>pg.fields)))if(f.sel===sel)return f.opts[v]?f.opts[v][0]:v;return v;}
function saveSetup(){try{const cfg={};CFG_IDS.forEach(id=>cfg[id]=$('#'+id).value);localStorage.setItem('tsl-setup',JSON.stringify({cfg,done:WZ.done}));}catch(e){}}
function loadSetup(){
  try{const o=JSON.parse(localStorage.getItem('tsl-setup')||'null');if(!o)return;
    let vu='';try{vu=localStorage.getItem('tsl-voice-user')||'';}catch(e){}
    Object.entries(o.cfg||{}).forEach(([id,v])=>{if(id==='optVoice'&&!vu)return;const el=$('#'+id);if(el&&[...el.options].some(x=>x.value===v))el.value=v;});
    if($('#optFx').value==='dice')$('#optFx').value='interest'; // 舊版的「擲骰決定參戰」已移除
    if(Array.isArray(o.done)&&o.done.length===WZ.done.length)WZ.done=o.done.map(Boolean);
  }catch(e){}
  voiceBtn();
}
$('#optLang').value=window.TSL_LANG;
const wzVis=()=>SETUP_PAGES.map((pg,i)=>i).filter(i=>{const pg=SETUP_PAGES[i];return pg.summary||!pg.fields.length||pg.fields.some(f=>!f.when||f.when());}); // 沒有任何可設定項目的頁面（例如推演模式的「戰前集結」）直接略過
function wzGo(d){const v=wzVis(),p=v.indexOf(WZ.i);const t=v[Math.max(0,Math.min(v.length-1,(p<0?0:p)+d))];if(t!==undefined&&t!==WZ.i){WZ.i=t;renderWizard();}}
function renderWizard(){
  const vis=wzVis();if(!vis.includes(WZ.i))WZ.i=vis.find(i=>i>WZ.i)??vis[vis.length-1];
  const pg=SETUP_PAGES[WZ.i],N=vis.length,pos=vis.indexOf(WZ.i);WZ.done[WZ.i]=true;
  $('#wzStep').textContent='作戰設定 · 第 '+(pos+1)+' / '+N+' 頁';
  $('#wzTitle').textContent=pg.t;$('#wzDesc').textContent=pg.d;
  $('#wzChips').innerHTML=vis.map((i,n)=>{const x=SETUP_PAGES[i];return '<button data-i="'+i+'" class="'+(i===WZ.i?'on':'')+(WZ.done[i]?' ok':'')+'" title="'+x.t+'" aria-label="第 '+(n+1)+' 頁 '+x.t+'" aria-current="'+(i===WZ.i?'step':'false')+'"><i>'+(WZ.done[i]&&i!==WZ.i?'✓':n+1)+'</i><span>'+x.s+'</span></button>';}).join('');
  let h='';
  let gcur=null;const GN={atk:'攻方',def:'守方'};WZ.open=WZ.open||{};
  const gclose=()=>{if(gcur){h+='</details>';gcur=null;}};
  pg.fields.filter(f=>!f.when||f.when()).forEach(f=>{
    if(f.grp!==gcur){gclose();if(f.grp){gcur=f.grp;h+='<details class="rg wzg" data-g="'+f.grp+'"'+(WZ.open[f.grp]?' open':'')+'><summary><b>'+GN[f.grp]+'</b></summary>';}}
    const cur=$('#'+f.sel).value;
    const ent=Object.entries(f.opts);
    h+='<div class="wz-q">'+f.q+'</div><div class="seg" role="radiogroup" aria-label="'+f.q+'" style="--n:'+(ent.length<=3?ent.length:2)+'">'+ent.map(([v,o])=>'<button class="segb'+(v===cur?' on':'')+'"'+''+' role="radio" aria-checked="'+(v===cur)+'" data-sel="'+f.sel+'" data-v="'+v+'">'+(o[2]||o[0])+'</button>').join('')+'</div><div class="seg-desc"><b>'+(f.opts[cur]?f.opts[cur][0]:'')+'</b>　'+(f.opts[cur]?f.opts[cur][1]:'')+'</div>';
  });
  gclose();
  const note=pg.note&&pg.note();if(note)h+='<div class="wz-note">'+note+'</div>';
  if(pg.summary){
    const sim=isSim(),rows=[['模式',optLabel('optMode',$('#optMode').value)]];
    if(isVideo())rows.push(['操作','電腦自動（影片）'],['播放',optLabel('optVSpeed',$('#optVSpeed').value)]);else if(!sim)rows.push(['操作',optLabel('optSide',$('#optSide').value)]);else rows.push(['速度',optLabel('optSpeed',$('#optSpeed').value)]);
    rows.push(['判定',optLabel('optT',$('#optT').value)]);rows.push(['年代',optLabel('optEra',$('#optEra').value)]);
    rows.push(['集結',sim?'推演中選擇':optLabel('optBuild',$('#optBuild').value)]);
    rows.push(['參戰',optLabel('optFx',$('#optFx').value)]);if(!sim&&$('#optSide').value!=='atk')rows.push(['盟軍',optLabel('optAlly',$('#optAlly').value)]);rows.push(['空戰',optLabel('optAirModel',$('#optAirModel').value)+'・'+optLabel('optAirGen',$('#optAirGen').value)+'・電戰'+optLabel('optEW',$('#optEW').value)]);rows.push(['快訊',optLabel('optNews',$('#optNews').value)]);rows.push(['語音',optLabel('optVoice',$('#optVoice').value)]);
    h+='<table class="wz-sum">'+rows.map(r=>'<tr><td>'+r[0]+'</td><td>'+r[1]+'</td></tr>').join('')+'</table>';
  }
  if(pg.summary)h+='<div class="wz-seed"><label>戰局碼（選填）<input id="wzSeed" type="text" inputmode="text" autocomplete="off" spellcheck="false" placeholder="貼上別人的戰局碼，可重現同樣的設定與天候" value="'+(WZ.seedTxt||'').replace(/"/g,'&quot;')+'"></label><div class="dd">戰局碼包含設定與亂數種子（天候、擲骰結果）；空白就自動產生，結局頁會顯示本局的碼。你的決策不同，局勢仍會不同。</div></div>';
  $('#wzBody').innerHTML=h;
  $('#wzPrev').disabled=pos===0;$('#wzNext').disabled=pos===N-1;
  const left=vis.map((i,n)=>WZ.done[i]?null:n+1).filter(Boolean),b=$('#btnStart');
  b.disabled=left.length>0;b.textContent=isSim()?'開始推演':isVideo()?'開始播放':'開始作戰';
  $('#wzHint').textContent=left.length?'還有第 '+left.join('、')+' 頁沒看過，看過每一頁後才能開始。':'設定完成，在任何一頁都可以開始。';
  saveSetup();
}
$('#wzChips').addEventListener('click',e=>{const b=e.target.closest('[data-i]');if(!b)return;WZ.i=+b.dataset.i;renderWizard();});
$('#wzPrev').onclick=()=>wzGo(-1);
$('#wzNext').onclick=()=>wzGo(1);
$('#wzBody').addEventListener('toggle',e=>{const d=e.target;if(d.dataset&&d.dataset.g){WZ.open=WZ.open||{};WZ.open[d.dataset.g]=d.open;}},true);
$('#wzBody').addEventListener('change',e=>{if(e.target.id!=='wzSeed')return;const v=e.target.value.trim(),o=parseSeedCode(v);WZ.seedTxt=v;
  if(o&&o.c){Object.entries(o.c).forEach(([id,x])=>{const el=$('#'+id);if(el&&[...el.options].some(q=>q.value===x)&&el.value!==x){el.value=x;el.dispatchEvent(new Event('change'));}});toast('已套用戰局碼的設定');}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-copyseed]');if(!b)return;const t=S.seedCode||'';try{navigator.clipboard.writeText(t).then(()=>toast('已複製戰局碼'),()=>toast('複製失敗，請手動選取'));}catch(x){toast('複製失敗，請手動選取');}});
$('#wzBody').addEventListener('click',e=>{
  const b=e.target.closest('.segb[data-sel]');if(!b)return;
  const el=$('#'+b.dataset.sel);el.value=b.dataset.v;el.dispatchEvent(new Event('change'));
});
/* ---------- side tabs ---------- */
function setTab(name){
  document.querySelectorAll('#sidetabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===name));
  document.querySelectorAll('.tabpane').forEach(p=>{p.hidden=p.dataset.pane!==name;});
}
$('#sidetabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)setTab(b.dataset.tab);});
$('#flist').addEventListener('toggle',e=>{const d=e.target;if(d.dataset&&d.dataset.f)FOLD[d.dataset.f]=d.open;},true);
function thFold(open){const t=document.querySelector('.theater');t.classList.toggle('collapsed',!open);const b=$('#btnThFold');b.textContent=open?'收折戰區圖':'展開戰區圖';b.setAttribute('aria-expanded',open);}
$('#btnThFold').onclick=()=>thFold(document.querySelector('.theater').classList.contains('collapsed'));
$('#btnThWide').onclick=()=>{const t=document.querySelector('.theater');t.classList.toggle('wide');$('#btnThWide').textContent=t.classList.contains('wide')?'縮小戰區圖':'放大戰區圖';};
/* ---------- map zoom and fullscreen ---------- */
let ZOOM=1;const ZMIN=.4,ZMAX=5; // 最大 500%
function setZoom(z,recenter,anc){ // anc＝{fx,fy,px,py}：縮放後讓內容上的 (fx,fy)（占全圖比例）留在視窗內的 (px,py)——以手指中點或游標為錨點，像 Google 地圖
  const w=document.querySelector('.mapwrap'),m=$('#map'),old=ZOOM,fs=document.body.classList.contains('mapfs');
  const fx=(w.scrollLeft+w.clientWidth/2)/Math.max(1,w.scrollWidth),fy=(w.scrollTop+w.clientHeight/2)/Math.max(1,w.scrollHeight);
  ZOOM=Math.max(ZMIN,Math.min(ZMAX,Math.round(z*1000)/1000));
  m.classList.toggle('zlo',FG>2&&ZOOM<1.6);{const nu=usForZoom(ZOOM);if(nu!==US){US=nu;if(S&&S.started)requestAnimationFrame(()=>render());}} // 縮小時棋子縮成一格、地名只留勝負要點
  // 縮放 1 = 原本可見範圍（遊戲格）填滿寬度；外圍示意區只在縮小或拖曳時看到
  m.style.width=(ZOOM*EXT*100)+'%';m.style.minWidth=ZOOM*EXT<1?'0':'';
  w.style.maxHeight='';
  if(fs)w.style.height='';
  else{
    const ww=w.clientWidth||w.parentElement.clientWidth,h1=ww*VBH/VBW,cap=innerHeight*.86;
    if(ZOOM>=1)w.style.height=(ZOOM===1?h1:Math.min(h1*ZOOM,cap)).toFixed(0)+'px';
    else{const hd=Math.min(ww*ZOOM*EXT*EVBH/EVBW,cap),t=Math.min(1,(1-ZOOM)/.3);w.style.height=(h1+(hd-h1)*t).toFixed(0)+'px';}
  }
  const ox=(MX0+VBW/2)/EVBW,oy=(MY0+VBH/2)/EVBH;
  if(anc){w.scrollLeft=anc.fx*w.scrollWidth-anc.px;w.scrollTop=anc.fy*w.scrollHeight-anc.py;}
  else{const cx=recenter?ox:fx,cy=recenter?oy:fy;w.scrollLeft=cx*w.scrollWidth-w.clientWidth/2;w.scrollTop=cy*w.scrollHeight-w.clientHeight/2;}
  const t=Math.round(ZOOM*100)+'%';$('#zLabel').textContent=t;$('#fsZ').textContent=t;
  if(old!==ZOOM&&!fs)try{localStorage.setItem('tsl-zoom',String(ZOOM));}catch(e){}
}
document.querySelectorAll('.zb').forEach(b=>b.addEventListener('click',()=>setZoom(ZOOM+(+b.dataset.z)*.25)));
$('#btnLoc').onclick=()=>setZoom(ZOOM,true); // 回到台灣：維持目前縮放，把地圖捲回遊戲區中央
$('#zLabel').onclick=()=>setZoom(1,true);$('#fsZ').onclick=()=>setZoom(1,true);
(function(){
  const w=document.querySelector('.mapwrap');
  // 錨點：視窗內 (cx,cy)（client 座標）對應的內容位置
  const anchorAt=(cx,cy)=>{const r=w.getBoundingClientRect(),px=cx-r.left-w.clientLeft,py=cy-r.top-w.clientTop;return {fx:(w.scrollLeft+px)/Math.max(1,w.scrollWidth),fy:(w.scrollTop+py)/Math.max(1,w.scrollHeight),px,py};};
  w.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();setZoom(ZOOM*Math.exp(-e.deltaY*.0025),false,anchorAt(e.clientX,e.clientY));}},{passive:false}); // 觸控板捏合與 Ctrl＋滾輪：以游標為中心連續縮放
  let st=null,moved=false;
  w.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;st={x:e.clientX,y:e.clientY,l:w.scrollLeft,t:w.scrollTop};moved=false;});
  w.addEventListener('pointermove',e=>{if(!st)return;const dx=e.clientX-st.x,dy=e.clientY-st.y;
    if(!moved&&Math.hypot(dx,dy)>6)moved=true;
    if(moved){w.classList.add('drag');w.scrollLeft=st.l-dx;w.scrollTop=st.t-dy;}});
  const end=()=>{st=null;w.classList.remove('drag');};
  w.addEventListener('pointerup',end);w.addEventListener('pointerleave',end);w.addEventListener('pointercancel',end);
  w.addEventListener('click',e=>{if(moved){e.stopPropagation();e.preventDefault();moved=false;}},true);
  // 手機雙指縮放（像 Google 地圖）：以兩指中點為錨點縮放，兩指一起移動時地圖跟著平移；鬆開一指後回到單指拖曳
  let pd=0,pz=1,raf=0,pa=null,last=null;
  const dist=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
  const mid=t=>[(t[0].clientX+t[1].clientX)/2,(t[0].clientY+t[1].clientY)/2];
  w.addEventListener('touchstart',e=>{if(e.touches.length===2){pd=Math.max(1,dist(e.touches));pz=ZOOM;const m=mid(e.touches);pa=anchorAt(m[0],m[1]);}},{passive:true});
  w.addEventListener('touchmove',e=>{if(e.touches.length!==2||!pd)return;e.preventDefault(); // 不讓瀏覽器自己縮放整頁或同時捲動
    const m=mid(e.touches),r=w.getBoundingClientRect();last={z:pz*dist(e.touches)/pd,px:m[0]-r.left-w.clientLeft,py:m[1]-r.top-w.clientTop};
    if(raf)return;raf=requestAnimationFrame(()=>{raf=0;if(!last||!pa)return;setZoom(last.z,false,{fx:pa.fx,fy:pa.fy,px:last.px,py:last.py});});},{passive:false});
  const pEnd=e=>{if(e.touches.length<2){pd=0;pa=null;last=null;}};
  w.addEventListener('touchend',pEnd,{passive:true});w.addEventListener('touchcancel',pEnd,{passive:true});
  w.addEventListener('gesturestart',e=>e.preventDefault()); // iOS Safari：擋掉整頁縮放
})();
function setFs(on){
  document.body.classList.toggle('mapfs',on);
  const root=document.documentElement;
  if(on&&root.requestFullscreen)root.requestFullscreen().catch(()=>{/* 不支援時仍以頁面內全螢幕顯示 */});
  else if(!on&&document.fullscreenElement)document.exitFullscreen().catch(()=>{});
  if(on){savedZoom=ZOOM;requestAnimationFrame(()=>requestAnimationFrame(fitZoom));}else{setZoom(savedZoom||1,true);}
}
let savedZoom=1;
// in fullscreen, start with the whole map visible
function fitZoom(){
  const w=document.querySelector('.mapwrap');
  const h1=w.clientWidth*VBH/VBW;
  setZoom(Math.max(ZMIN,Math.min(1,(w.clientHeight-4)/h1)),true);
}
$('#btnFs').onclick=()=>setFs(true);
{const b=$('#btnRng');if(b){b.setAttribute('aria-pressed',RNG_ALL);b.onclick=()=>{RNG_ALL=!RNG_ALL;b.setAttribute('aria-pressed',RNG_ALL);try{localStorage.setItem('tsl-rng',RNG_ALL?'1':'0');}catch(e){}renderMap();};}}$('#fsExit').onclick=()=>setFs(false);
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&document.body.classList.contains('mapfs')){document.body.classList.remove("mapfs");setZoom(savedZoom||1,true);}else if(document.fullscreenElement&&document.body.classList.contains('mapfs'))requestAnimationFrame(fitZoom);});
addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('mapfs'))setFs(false);});
$('#fsStrike').onclick=()=>$('#btnStrike').click();$('#fsEnd').onclick=()=>$('#btnEnd').click();

// let the computer finish this phase for the player: every unit that has not acted yet is handled by the AI, then the phase ends
const INTENT={ // 選項格式：[id, 名稱, 效果, 代價]
  atk:[{k:'fire',t:'打擊重點',o:[['','照電腦判斷','綜合考量各目標。',''],
         ['ssm','壓制反艦與火箭飛彈','優先打岸置飛彈與火箭砲，保護渡海船團。','灘頭守軍壓力較小，登陸部隊較辛苦。'],
         ['reserve','打擊機動預備隊','優先打裝甲旅與後備旅，削弱守方反擊。','岸置飛彈仍在威脅船團。']]},
       {k:'axis',t:'主攻方向',o:[['','照開局計畫','沿用開局選的攻擊軸線。',''],
         ['north','北部','火力與登陸集中林口、桃園一帶。','中部灘頭較空，守方可能轉移兵力。'],
         ['central','中部','火力與登陸集中新竹、苗栗、台中港一帶。','北部較空。']]},
       {k:'adv',t:'躍進與補給',o:[['','照電腦判斷','依首都與港口的遠近決定。',''],
         ['port','優先占領港口','島上部隊先奪基隆、台北港、台中港、高雄，才能卸載重型裝備、擴大補給。','首都方向進度延後。'],
         ['hold','先鞏固灘頭再擴張','島上部隊不前進，只打有把握的攻擊，減少損失。','進度慢，回合可能不夠。'],
         ['dash','全力突進首都','島上部隊直撲台北，攻擊門檻降低。','損失大，補給線容易斷。']]},
       {k:'cvw',t:'艦載機任務',if:()=>S.units.some(u=>u.type==='cv'&&u.side==='atk'),o:[['','照固定公式','有敵艦在打擊距離內：制空 40%、對艦 40%、對地 20%；沒有：制空 60%、對地 40%（從下一回合開始生效）。',''],
         ['ship','優先打艦艇','對艦 60%、制空 30%、對地 10%（從下一回合開始生效）。','制空與登陸支援減弱。'],
         ['air','優先制空','制空 70%、對艦 20%、對地 10%（從下一回合開始生效）。','對艦打擊減弱。'],
         ['land','優先支援登陸','對地 50%、制空 40%、對艦 10%（從下一回合開始生效）。','敵艦較少受到壓力。']]}],
  def:[{k:'msl',t:'飛彈使用節奏',o:[['','照電腦判斷','發射後視情況轉移陣地。',''],
         ['save','隱蔽待機','每具只射 1 發，只打兩棲、裝甲、空降與航艦，其餘按兵不動、保持隱蔽。','火力輸出低，一般船團可能漏網。'],
         ['salvo','集中齊射','全部飛彈打同一個目標，對航艦能造成飽和擊中。','射完不轉移，容易被火力打擊到。'],
         ['scoot','打了就跑','每具只射 1 發，射後立刻轉移並重新隱蔽。','火力減半。']]},
       {k:'asm',t:'反艦打擊優先',o:[['','照電腦判斷','依目標價值（航艦、補給船團、載著旅的運輸船較高）挑選。',''],
         ['tr','運輸船優先','岸置飛彈與艦艇先打載著部隊的運輸船與補給船團（「擊殺於水際」）：船沉了，船上的旅一併殲滅。','護航艦防空完整，在防空涵蓋內的船團多半被攔截。'],
         ['esc','護航艦優先','先打 055／052D／054A 等護航艦，消耗它們的防空、拆掉防空傘，之後的船團比較好打。','運輸船這個階段少挨打，較多部隊上岸。']]},
       {k:'hold',t:'防守重點',o:[['','照電腦判斷','',''],
         ['capital','死守台北','部隊向首都收縮，並優先攻擊逼近首都的敵軍。','港口與灘頭較空。'],
         ['ports','死守主要港口','部隊向基隆、台中、高雄收縮，不讓攻方開通補給。','首都與灘頭較空。'],
         ['preserve','保存兵力','只打有把握的戰鬥，不輕易出擊。','攻方較容易站穩。']]},
       {k:'line',t:'防線配置',o:[['','照電腦判斷','',''],
         ['beach','灘岸前推','部隊朝敵船團實際接近的灘頭靠攏，在灘頭交戰。','擠在開闊的海岸平原，暴露在艦砲與空襲下。'],
         ['depth','縱深防禦','部隊不進入海岸格，守在城市與山地（火力打擊較難命中、地形防禦加成），等敵人上岸再在內陸交戰。','灘頭沒人守，攻方上岸容易，可以從容建立灘頭。'],
         ['mobile','機動預備','裝甲旅留在原地隱蔽待命，不提前往海岸移動；敵人上岸後才集中反擊（攻擊門檻降低）。','敵人上岸前，海岸只靠步兵與後備旅。']]},
       {k:'hmr',t:'海馬士任務',if:()=>S.units.some(u=>u.side==='def'&&u.type==='hmr'&&alive(u)),o:[['','照電腦判斷','陸軍戰術飛彈留給裝甲、兩棲、陸戰、空降旅，其他目標用火箭彈。',''],
         ['beach','打灘頭登陸部隊','火箭彈與陸軍戰術飛彈集中打剛上岸的旅，趁他們還沒站穩。','灘頭補給站與港口照常運作。'],
         ['log','打港口與灘頭補給站','優先打灘頭補給站與攻方占領港口裡的部隊，削弱卸載與補給。','剛上岸的部隊少挨打。'],
         ['cn','飛彈留給縱深打擊','島上戰場只用火箭彈（4 格內），陸軍戰術飛彈全部留給縱深打擊打大陸集結區。','約 80 km 外的島上目標這個階段不打。']]},
       {k:'deep',t:'縱深打擊目標',o:[['','照電腦判斷','依「命中率×效果」挑選。',''],
         ['stg','集結港口與船團','優先打大陸沿岸集結中的部隊、船隻與海軍基地，減少渡海兵力。','火箭軍與機場照常運作，火力打擊不會變少。'],
         ['rf','火箭軍陣地','優先打火箭軍駐地與預備陣地，降低之後的飛彈火力。','飛彈與發射車多已疏散，效果有限；集結的船團照常出發。'],
         ['air','機場','優先打福建、浙江的空軍基地，降低共軍出擊架次。','機場受損 2 回合就修復一級。']]},
       {k:'sub',t:'海鯤潛艦任務',if:()=>S.units.some(u=>u.side==='def'&&u.type==='hk'),o:[['','電腦判斷','依「目標價值×命中率」選目標。',''],
         ['cvy','專打補給船團','只打補給船團（慢速商船，命中約 85%，附近每有一艘護航艦 −10%），直接削弱攻方補給。','不打登陸艦與護航艦。'],
         ['lnd','專打登陸船團','只打兩棲艦與運兵船（命中約 50%），減少上岸兵力。','補給船團不會被打。'],
         ['cv','專打航艦','只打航艦群（命中約 30%，護航厚、很難打）；擊沉是大消息。','命中低，魚雷用完回港前沒戰果。'],
         ['dd','專打護航艦','只打護航艦（命中約 35%），削弱護航，讓其他船團更好打。','不打運輸船。']]}]
};
const intentGroups=side=>INTENT[side].filter(g=>!g.if||g.if());
function askIntent(side){
  return new Promise(done=>{
    const box=mboxSet('ev');$('#modal').hidden=false;$('#resume').hidden=true;
    const cur=Object.assign({},(S.lastIntent&&S.lastIntent[side])||{});
    const sumTxt=()=>{const a=intentGroups(side).map(g=>{const o=g.o.find(x=>x[0]===(cur[g.k]||''));return o&&o[0]?g.t+'：'+o[1]:'';}).filter(Boolean);return a.length?a.join('　·　'):'全部照電腦判斷';};
    box.innerHTML='<div class="eyebrow">第 '+S.turn+' 回合 · '+SIDE[side]+'階段</div><h3>指揮官意圖</h3><p class="dd">電腦代打前，先下達本階段的作戰重點（只影響這一階段）。下面是目前的選擇，點一列可更改。</p>'+
      '<div class="itbody">'+intentGroups(side).map(g=>'<div class="itgrp" data-g="'+g.k+'"><button class="ithead" aria-expanded="false" data-g="'+g.k+'"><span class="intg">'+g.t+'</span><span class="itcur"></span><i>▾</i></button><div class="itcards" hidden role="radiogroup" aria-label="'+g.t+'">'+g.o.map(o=>'<button class="segb itc'+((cur[g.k]||'')===o[0]?' on':'')+'" role="radio" data-g="'+g.k+'" data-v="'+o[0]+'"><b>'+o[1]+'</b>'+(o[2]?'<span>效果：'+o[2]+'</span>':'')+(o[3]?'<span class="cost">代價：'+o[3]+'</span>':'')+'</button>').join('')+'</div></div>').join('')+'</div>'+
      '<label class="itskip"><input type="checkbox" id="itSkip"> '+TX('這一局之後不再詢問，沿用這次的設定（可按「重設意圖」改）')+'</label><div class="itfoot"><div class="itsum" id="itSum"></div><div class="itbtns"><button class="ghost" id="itNo">取消</button><button id="itGo">開始代打</button></div></div>';
    box.classList.add('itbox');
    const fin=r=>{box.classList.remove('itbox');$('#modal').hidden=true;box.classList.remove('ev');done(r);};
    const upd=()=>{$('#itSum').textContent='本次：'+sumTxt();
      intentGroups(side).forEach(g=>{const o=g.o.find(x=>x[0]===(cur[g.k]||''))||g.o[0];box.querySelector('.itgrp[data-g="'+g.k+'"] .itcur').textContent=o[1];});};upd();
    const openG=k=>box.querySelectorAll('.itgrp').forEach(x=>{const on=x.dataset.g===k;x.classList.toggle('open',on);x.querySelector('.itcards').hidden=!on;x.querySelector('.ithead').setAttribute('aria-expanded',on);});
    box.querySelectorAll('.ithead').forEach(h=>h.onclick=()=>openG(h.closest('.itgrp').classList.contains('open')?null:h.dataset.g));
    box.querySelectorAll('.itc').forEach(b=>b.onclick=()=>{cur[b.dataset.g]=b.dataset.v;box.querySelectorAll('.itc[data-g="'+b.dataset.g+'"]').forEach(x=>{const on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-checked',on);});upd();openG(null);});
    $('#itGo').onclick=()=>{S.lastIntent=S.lastIntent||{};S.lastIntent[side]=Object.assign({},cur);S.intentSkip=S.intentSkip||{};S.intentSkip[side]=!!$('#itSkip').checked;fin(cur);};
    $('#itNo').onclick=()=>fin(null);
    $('#itGo').focus();
  });
}
// 戰況簽章：天候、美日參戰程度、雙方兵力（每 3 個單位一級）、颱風——任何一項變了就重新詢問，否則沿用上次的意圖
const intentSig=()=>[S.weather&&S.weather.n,S.fx&&S.fx.lv?S.fx.lv.US+'/'+S.fx.lv.JP:'',Math.floor(S.units.filter(u=>u.side==='atk').length/3),Math.floor(S.units.filter(u=>u.side==='def').length/3),S.typhoon?1:0].join('|');
function defLedger(){ // 守方彈藥帳：存量、本階段可打發數、海上敵船團（讓打擊對象的取捨有依據）
  const P=S.pools;if(!P)return '';const sea=S.units.filter(u=>u.side==='atk'&&atSea(u)&&isShip(u)),tr=sea.filter(u=>u.type==='cvy'||u.type==='lst'||u.type==='ro').length,sub=S.units.filter(u=>u.side==='def'&&u.type==='hk').length;
  return '　彈藥：反艦飛彈 '+fmt1(P.rocAS)+'、長程飛彈 '+fmt1(P.rocMsl)+((P.rocAtc||0)+(P.rocGml||0)>0?'、陸軍戰術飛彈 '+Math.round(P.rocAtc||0)+' 枚、火箭彈 '+Math.round(P.rocGml||0)+' 莢艙':'')+'（縱深打擊本階段可打 '+(S.dfire||0)+' 包）、防空 '+P.rocAD+(sub?'、海鯤 '+sub+' 艘':'')+'；海上敵船團 '+sea.length+' 支（其中運輸船 '+tr+' 支）。';
}
async function assistPhase(){
  if(!humanTurn())return;
  const side=S.phase;const sk=S.intentSkip&&S.intentSkip[side];
  const last=S.lastIntent&&S.lastIntent[side],sg=intentSig(),reuse=!sk&&last&&S.intentSig&&S.intentSig[side]===sg;
  if(reuse)toast('戰況沒有重大變化，沿用上次的指揮官意圖（可按「重設意圖」改）');
  const it=(sk||reuse)?Object.assign({},last||{}):await askIntent(side);if(!it)return;
  if(!sk&&!reuse){S.intentSig=S.intentSig||{};S.intentSig[side]=sg;}
  if(sk)toast('沿用上次的指揮官意圖（按「重設意圖」可以修改）',1800);
  S.intent=it;S.busy=true;S.sel=null;S.mode=null;render();
  if(Object.values(it).some(Boolean))log('【指揮官意圖】'+SIDE[side]+'：'+intentGroups(side).map(g=>{const o=g.o.find(x=>x[0]===(it[g.k]||''));return o&&o[0]?g.t+'＝'+o[1]:'';}).filter(Boolean).join('、'));
  try{if(side==='atk')await aiAtk();else await aiDef();}catch(e){console.error(e);}
  S.intent=null;S.busy=false;render();
  if(!S.over)endPhase();
}
$('#btnIntentReset').onclick=()=>{if(S.intentSkip)S.intentSkip[S.phase]=false;toast('下次按「電腦代打」會再詢問指揮官意圖',1800);render();};
$('#btnAssist').onclick=assistPhase;$('#fsAssist').onclick=assistPhase;$('#mbAssist').onclick=assistPhase;
$('#mbEnd').onclick=()=>$('#btnEnd').click();$('#mbStrike').onclick=()=>$('#btnStrike').click();
function reset(){newState();readSetup();render();renderWizard();}
loadSetup();
try{const z=+localStorage.getItem('tsl-zoom');if(z)ZOOM=Math.max(ZMIN,Math.min(ZMAX,z));else if(innerWidth<700)ZOOM=1.6;}catch(e){if(innerWidth<700)ZOOM=1.6;}
reset();setZoom(ZOOM,true);
addEventListener('resize',()=>{if(!document.body.classList.contains('mapfs'))setZoom(ZOOM);});
