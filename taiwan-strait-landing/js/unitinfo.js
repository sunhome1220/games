'use strict';
/* ---------- 單位說明資料（滑鼠懸停卡片用）：現實對應、角色、遊戲規則、圖片 ---------- */
const UDOC={
  amph:{real:'解放軍陸軍兩棲合成旅（東部戰區，配 05 式兩棲突擊車等）',role:'攻方主力登陸部隊，具兩棲能力，從大陸沿岸出海搶灘。',rules:['在海上交戰有 −2 的懲罰（陸戰旅為 −1），所以多半在登陸時才決戰','海上移動力受天候影響；惡劣天候不利渡海','每格最多 2 個友軍，疊放時防禦 −1']},
  mar:{real:{atk:'解放軍海軍陸戰隊旅',def:'中華民國海軍陸戰隊旅'},role:'兩棲作戰專長的精銳部隊。',rules:['在海上交戰的懲罰較小（−1）','開局預設負責澎湖方向（攻占馬公）']},
  abn:{real:'解放軍空降兵（以運-20、運-9 等運輸機空降）',role:'攻方空降突擊部隊，可繞過灘頭直接降落在目標附近。',rules:['空降需要天候允許','落點若遭地面火力壓制，約一半機率損失一半戰力；否則運輸機群有約 1/6 機率遭防空攔截，同樣損失一半戰力','降落前停在大陸待命']},
  arm:{real:'解放軍陸軍重型合成旅（99A 式戰車、04A 步戰車等）',role:'攻方高攻擊力、高機動的地面主力。',rules:['攻擊力與機動力是雙方地面部隊中最高的','登陸後才能發揮；渡海時需要港口或灘頭支援']},
  inf:{real:'中華民國陸軍步兵／機械化步兵旅（雲豹裝甲車等）',role:'守方的基本守備部隊，駐守城市、港口與山區。',rules:['守備部隊（標示「守備」）原地防守，不主動出擊','防禦力高，適合城市與山地','旅的武器（標槍、拖式飛彈約 2.5～4 km，迫擊砲約 7 km）打不到隔壁格（約 20 km 外）海上的兩棲艦與滾裝船；要等對方搶灘突擊（登陸艇靠岸）或船進港卸載時才交戰']},
  tank:{real:'中華民國陸軍裝甲旅（M60A3、CM-11 勇虎、M1A2T 戰車）',role:'守方機動反擊部隊。',rules:['攻擊力高，是反擊灘頭、收復目標的主力','「機動反擊」決策可再 +1 攻擊','旅的武器（標槍、拖式飛彈約 2.5～4 km，迫擊砲約 7 km）打不到隔壁格（約 20 km 外）海上的兩棲艦與滾裝船；要等對方搶灘突擊（登陸艇靠岸）或船進港卸載時才交戰']},
  res:{real:'動員後備旅（後備軍人動員編成）',role:'戰爭爆發後依動員節奏逐梯次補入的預備部隊。',rules:['攻防較低、編制戰力小（每步綜合戰力約裝甲旅的四分之一），但數量能補強守備','動員被延遲或減半時，後備旅會晚到或變少','旅的武器（標槍、拖式飛彈約 2.5～4 km，迫擊砲約 7 km）打不到隔壁格（約 20 km 外）海上的兩棲艦與滾裝船；要等對方搶灘突擊（登陸艇靠岸）或船進港卸載時才交戰']},
  ssm:{real:'雄風二／雄風三型、魚叉岸防飛彈機動發射車',role:'守方打擊船團的主力，是攻方火力打擊的首要目標。',rules:['機動隱蔽：未暴露時，火力打擊多半只打到誘餌與空車','開火後暴露；打完會轉移陣地重新隱蔽','每單位約 8 輛發射車（推估），每階段最多 2 發、每發 2 枚，可射的車少了發數跟著減少；射程約 160 km，耗用「反艦飛彈」存量','被精準打擊命中時只影響 1 輛，分成完全摧毀、火力受損（2 回合後修復）、機動受損（維持暴露）']},
  mlrs:{real:'雷霆2000（RT-2000）多管火箭系統（陸軍）',role:'守方陸軍遠程火力：反登陸與區域火力打擊，面積性火力。',rules:['射程依彈種 15／30／45 km（遊戲取最遠約 40 km）；防護低、機動高','無導引面積火力，命中比海馬士低、打船更難；打海灘上的部隊與靠岸船團','彈藥有限（庫存點數）；開火後暴露，下一階段要再裝填，所以隔一個階段才能再打']},
  hmr:{real:'M142 海馬士（HIMARS）高機動火箭砲系統',role:'守方長程精準火力：火箭彈打近處，陸軍戰術飛彈打遠處。',rules:['火箭彈射程約 80 km；陸軍戰術飛彈（ATACMS）射程約 300 km；兩種彈藥各有實際庫存，打完就沒有','每次最多 4 輛齊射，每階段次數依可射車數；打完就轉移，重新隱蔽']},
  dd:{real:'解放軍海軍 052D／055 型等驅逐艦、護衛艦',role:'為登陸船團護航，提供防空與反潛。',rules:['護航艦在附近時，守方反艦飛彈較難命中船團','被擊沉會減少「護航艦隊」點數','AI 會貼近己方船團，或朝登陸區靠攏']},
  cv:{real:'解放軍海軍遼寧、山東、福建艦航艦戰鬥群',role:'提供艦載機制空與打擊。',rules:['被反艦攻擊重創會減少「航艦」點數','AI 在台灣東側海域游弋，遇岸置飛彈威脅就退向外海']},
  ff:{real:'中華民國海軍巡防艦、沱江級飛彈快艇等',role:'守方水面艦艇，牽制攻方船團。',rules:['平時停在港口（只有港口能停靠）','出港後保持在飛彈射程外圍牽制，避開護航艦','每階段 1 發，射程依艦型約 120～200 km；被擊沉會減少「守方海軍」點數']}
};
const FXDOC={
  kadena:{real:'美國空軍第18聯隊（嘉手納基地）：F-15C／D、F-35A，正換裝 F-15EX',role:'沖繩的主力戰機，需要日本同意使用基地才能出擊。'},
  usmc:{real:'美國海軍陸戰隊第12濱海團：NMESIS 海軍陸戰隊遠征艦艇攔截系統（反艦飛彈）',role:'岸置反艦打擊，需要日本同意使用基地。'},
  ssn:{real:'美國海軍攻擊潛艦（維吉尼亞級等）',role:'隱蔽的水下打擊力量，無法被火力打擊。'},
  bomber:{real:'美國空軍 B-1B 槍騎兵轟炸機，可攜帶 LRASM 長程反艦飛彈',role:'從關島長程出擊，每次攻擊發數較多。'},
  csg:{real:'美國海軍第7艦隊航艦打擊群（尼米茲級／福特級核動力航艦與艦載機）',role:'參戰後 2 回合抵達台灣東側海域，是最強的盟軍空中打擊力量。'},
  mdtf:{real:'美國陸軍多域特遣隊：海馬士、堤豐飛彈系統',role:'部署在先島群島的陸基長程打擊，需要日本同意。'},
  jasdf:{real:'日本航空自衛隊第9航空團（那霸基地）：F-15J',role:'沖繩的日本主力戰機。'},
  jgsdf:{real:'日本陸上自衛隊地對艦飛彈連隊：12式地對艦誘導彈',role:'部署在宮古・石垣一帶的岸置反艦飛彈。'},
  jmsdf:{real:'日本海上自衛隊護衛隊群：出雲級直升機護衛艦、F-35B 等',role:'從佐世保出港，日本參戰後 1 回合抵達台灣東北側。'},
  jss:{real:'日本海上自衛隊潛艦隊（蒼龍級、大鯨級）',role:'隱蔽的水下打擊力量，無法被火力打擊。'}
};
// 圖片：能明確使用的實物照片（公有領域、CC0、CC BY）放在 img/；其餘用示意圖並說明原因
const UIMG={
  hmr:{"f": "img/hmr.jpg", "by": "US Army Staff Sergeant Jameson Harris", "lic": "公有領域", "page": "https://commons.wikimedia.org/wiki/File:M142_HIMARS_firing.jpg"},
  mdtf:{"f": "img/hmr.jpg", "by": "US Army Staff Sergeant Jameson Harris", "lic": "公有領域", "page": "https://commons.wikimedia.org/wiki/File:M142_HIMARS_firing.jpg"},
  ssm:{"f": "img/ssm.jpg", "by": "玄史生", "lic": "CC0", "page": "https://commons.wikimedia.org/wiki/File:Covered_ROCN_Hsiung_Feng_II_%26_Hsiung_Feng_III_Anti-Ship_Missile_Launchers_Truck_Display_at_Zuoying_Naval_Base_Ground_20141123a.jpg"},
  tank:{"f": "img/tank.jpg", "by": "玄史生", "lic": "CC0", "page": "https://commons.wikimedia.org/wiki/File:CM-11_Tank_before_Testing_Demo_20130302a.jpg"},
  cv:{"f": "img/cv.jpg", "by": "日本防衛省・統合幕僚監部", "lic": "CC BY 4.0", "page": "https://commons.wikimedia.org/wiki/File:A_PLAN_Shenyang_J-15_carrier-based_fighter_aircraft_is_taking_off_from_Chinese_aircraft_carrier_PLANS_Shandong_(CV-17)_20240709.jpg"},
  dd:{"f": "img/dd.jpg", "by": "Thehistorianisaac", "lic": "CC BY 4.0", "page": "https://commons.wikimedia.org/wiki/File:Changsha(%E9%95%BF%E6%B2%99,_173)_in_hong_kong.jpg"},
  amph:{"f": "img/amph.jpg", "by": "Ministry of Defence of the Russian Federation", "lic": "CC BY 4.0", "page": "https://commons.wikimedia.org/wiki/File:Chinese_ZBD-05.jpg"},
  csg:{"f": "img/csg.jpg", "by": "Official Navy Page from United States of America MC2 James R", "lic": "公有領域", "page": "https://commons.wikimedia.org/wiki/File:Flickr_-_Official_U.S._Navy_Imagery_-_The_Nimitz-class_aircraft_carrier_USS_Carl_Vinson_(CVN_70)_is_underway_in_the_Arabian_Sea..jpg"},
  kadena:{"f": "img/kadena.jpg", "by": "Balon Greyjoy", "lic": "CC0", "page": "https://commons.wikimedia.org/wiki/File:20190206_F-15C_Eagle_Kadena_AB-12.jpg"},
  jasdf:{"f": "img/jasdf.jpg", "by": "Staff Sgt. Divine Cox", "lic": "公有領域", "page": "https://commons.wikimedia.org/wiki/File:JASDF_F-15J_lands_at_Andersen_for_Cope_North_2020.jpg"},
  bomber:{"f": "img/bomber.jpg", "by": "Balon Greyjoy", "lic": "CC0", "page": "https://commons.wikimedia.org/wiki/File:20180512_B-1B_Lancer_Dyess_AFB_Air_Show_2018_13.jpg"},
  jgsdf:{"f": "img/jgsdf.jpg", "by": "https://www.mod.go.jp/js/ 統合幕僚監部", "lic": "CC BY 4.0", "page": "https://commons.wikimedia.org/wiki/File:JGSDF_2nd_Artillery_Brigade_launch_a_Type_12_surface-to-ship_missile_during_Exercise_Talisman_Sabre_2025.jpg"},
  jss:{"f": "img/jss.jpg", "by": "海上自衛隊", "lic": "CC BY 4.0", "page": "https://commons.wikimedia.org/wiki/File:JMSDF_S%C5%8Dry%C5%AB_class_submarine.png"},
  inf:{"f": "img/inf.jpg", "by": "玄史生", "lic": "CC0", "page": "https://commons.wikimedia.org/wiki/File:CM-32_Yunpao_APC_Display_at_Armor_School_Rigjht_Rear_View_20130302.jpg"},
  mar:{"f": "img/mar.jpg", "by": "中国新闻社", "lic": "CC BY 4.0", "page": "https://commons.wikimedia.org/wiki/File:PLA_Marine_Boarding_Z-18_on_PLANS_Anhui.png", "only": "atk"},
  jmsdf:{"f": "img/jmsdf.jpg", "by": "海上自衛隊", "lic": "CC BY 4.0", "page": "https://commons.wikimedia.org/wiki/File:JMSDF_CVH_JS_Izumo_in_Ocean.jpg"}
};
const NOPHOTO={
  default:'沒有找到授權明確（公有領域、CC0 或 CC BY）的實物照片'
};
const WHY={
  res:'後備旅是遊戲中的編制概念，沒有對應的單一裝備，也沒有授權明確的照片',
  abn:'找到的運-20 照片是防疫人員與下機場景，不適合代表空降旅，故以示意圖呈現',
  arm:'解放軍戰車照片多來自官方媒體（版權保留）或授權為 CC BY-SA（本專案不採用），故以示意圖呈現',
  ff:'中華民國海軍艦艇照片多為 CC BY-SA 授權（本專案不採用），故以示意圖呈現',
  mar:'守方（中華民國）海軍陸戰隊沒有授權明確的照片，故以示意圖呈現',
  ssn:'找到的授權明確照片不是潛艦本體，故以示意圖呈現',
  usmc:'找到的授權明確照片是記者會場景，無法清楚看到 NMESIS，故以示意圖呈現'
};
// 示意圖（原創簡圖）：照片不可用時顯示；顏色依陣營
function silh(type,side){
  const c=side==='atk'?'var(--atk)':side==='us'?'var(--us)':side==='jp'?'var(--jp)':'var(--def)',k='fill="'+c+'" stroke="var(--ink)" stroke-width="1.4" stroke-linejoin="round"',g='fill="none" stroke="var(--ink)" stroke-width="1.6" stroke-linecap="round"';
  const sea='<path d="M0 100q20-6 40 0t40 0 40 0 40 0 40 0 40 0 40 0 40 0" '+g+' opacity=".35"/>';
  const W={
   soldier:'<circle cx="150" cy="38" r="12" '+k+'/><path d="M132 60h36l8 40h-18l-8-22-8 22h-18z" '+k+'/><path d="M168 66l42-12" '+g+' stroke-width="4"/><path d="M118 100h64" '+g+' opacity=".4"/>',
   tank:'<path d="M70 86h160l-12 16H82z" '+k+'/><path d="M96 86V70h92l14 16z" '+k+'/><path d="M138 70V54h40v16z" '+k+'/><path d="M178 60h72" '+g+' stroke-width="5"/><circle cx="92" cy="94" r="4" '+k+'/><circle cx="128" cy="94" r="4" '+k+'/><circle cx="164" cy="94" r="4" '+k+'/><circle cx="200" cy="94" r="4" '+k+'/>',
   ifv:'<path d="M70 88h150l-10 14H82z" '+k+'/><path d="M84 88V66l30-12h80l22 20v14z" '+k+'/><path d="M150 54V44h30v10z" '+k+'/><path d="M180 48h42" '+g+' stroke-width="4"/><circle cx="96" cy="95" r="4" '+k+'/><circle cx="126" cy="95" r="4" '+k+'/><circle cx="156" cy="95" r="4" '+k+'/><circle cx="186" cy="95" r="4" '+k+'/>',
   truck:'<path d="M60 90h80V62h-24l-10 14H60z" '+k+'/><path d="M144 90h110V70H144z" '+k+'/><path d="M156 66l86-22M156 74l86-22" '+g+' stroke-width="9" opacity=".85"/><circle cx="82" cy="98" r="9" '+k+'/><circle cx="170" cy="98" r="9" '+k+'/><circle cx="222" cy="98" r="9" '+k+'/>',
   ship:'<path d="M40 82h220l-24 22H66z" '+k+'/><path d="M90 82V66h40v16zM130 66V52h30v14z" '+k+'/><path d="M160 52V38M146 44h28" '+g+'/><path d="M196 82V70h22v12z" '+k+'/>'+sea,
   carrier:'<path d="M24 78h252l-14 24H56z" '+k+'/><path d="M24 78l28-6h224" '+g+'/><path d="M196 78V58h26v20zM208 58V46" '+k+'/><path d="M40 70l24-6M70 70l24-6" '+g+' opacity=".6"/>'+sea,
   sub:'<path d="M40 76q10-18 60-18h110q40 0 50 18-10 18-50 18H100q-50 0-60-18z" '+k+'/><path d="M150 58V42h24v16z" '+k+'/><path d="M264 76l20-12v24z" '+k+'/>'+sea,
   jet:'<path d="M40 70l120-8 70 6 40 2-40 6-70 6-120-8z" '+k+'/><path d="M150 64l-34-30h26l30 28zM150 74l-34 30h26l30-28z" '+k+'/><path d="M60 68l-16-14h14l12 12z" '+k+'/>',
   plane:'<path d="M30 70h200l40-6-4 12-36 6H30z" '+k+'/><path d="M120 66L84 30h22l50 36zM120 78L84 114h22l50-36z" '+k+'/><path d="M40 68L24 46h16l22 22z" '+k+'/>',
   para:'<path d="M110 40q40-36 80 0z" '+k+'/><path d="M114 40l36 44M186 40l-36 44" '+g+'/><circle cx="150" cy="90" r="8" '+k+'/><path d="M142 98h16l4 14h-24z" '+k+'/>'
  };
  const m={amph:'ifv',arm:'tank',tank:'tank',inf:'ifv',res:'soldier',mar:'soldier',abn:'para',ssm:'truck',hmr:'truck',mlrs:'truck',csg:'carrier',dd:'ship',ff:'ship',cv:'carrier',ssn:'sub',jss:'sub',kadena:'jet',jasdf:'jet',bomber:'plane',csg:'carrier',jmsdf:'ship',jgsdf:'truck',usmc:'truck',mdtf:'truck'};
  return '<svg viewBox="0 0 300 120" class="silh" role="img" aria-label="示意圖">'+(W[m[type]||'soldier'])+'</svg>';
}
function photoBlock(key,side,fallbackWhy){
  const im=UIMG[key];
  if(im&&(!im.only||im.only===side))
    return '<div class="ph"><img src="'+im.f+'" alt="" loading="lazy" decoding="async"><div class="cr">照片：'+im.by+' · '+im.lic+'（Wikimedia Commons）</div></div>';
  return '<div class="ph"><div class="sc">'+silh(key,side)+'</div><div class="cr">示意圖（原創簡圖，非實物照片）。原因：'+(fallbackWhy||WHY[key]||NOPHOTO.default)+'</div></div>';
}
function statParts(u,kind){ // 攻擊／防禦的算式：基礎值與各項修正
  const T=TYPES[u.type],base=T[kind],sm=sideMod(u,kind),wk=weak(u),sup=(u.side==='atk'&&onTW(u)&&supply().over)?1:0,stk=(kind==='def'&&unitsAt(K(u.c,u.r)).filter(x=>!isShip(x)).length>1)?1:0;
  const a=[];if(sm)a.push('事件 '+(sm>0?'+':'−')+Math.abs(sm));if(wk)a.push('受創 −1');if(sup)a.push('補給不足 −1');if(stk)a.push('疊放 −1');
  return a.length?'<small>（基礎 '+base+'；'+a.join('，')+'）</small>':'';
}
function unitCard(u){
  const T=TYPES[u.type],h=hexOf(u),st=unitStatusList(u,h),d=UDOC[u.type]||{},realT=typeof d.real==='object'?d.real[u.side]:d.real;
  const terr=terrDef(h);
  return photoBlock(u.type,u.side)+
    '<b style="color:var(--'+u.side+')">'+SIDE[u.side]+' · '+T.n+'</b>'+(realT?'<div class="td">對應：'+realT+'</div>':'')+
    '<div class="ts"><span>攻 <b>'+effAtk(u)+'</b>'+statParts(u,'atk')+'</span><span>防 <b>'+effDef(u)+'</b>'+statParts(u,'def')+(u.side==='def'&&terr&&isLand(h)?'<small>（地形再 +'+terr+'）</small>':'')+'</span><span>移 <b>'+T.mv+'</b></span><span>'+hpCell(u)[1]+' <b>'+hpCell(u)[0]+'</b></span></div>'+
    (d.role?'<div class="td">'+d.role+'</div>':'')+
    (d.rules?'<ul class="tr">'+d.rules.map(x=>'<li>'+x+'</li>').join('')+'</ul>':'')+
    '<div class="td">'+hname(h)+(st.length?' · '+st.join(' · '):'')+'</div>';
}
function fxCard(f,f0){ // 美日部隊：f＝戰力狀態，f0＝說明用的部隊
  const d=FXDOC[f.id]||{},side=f.c==='US'?'us':'jp';
  return photoBlock(f.id,side)+'<b style="color:var(--'+side+')">'+f.n+'</b>'+(d.real?'<div class="td">對應：'+d.real+'</div>':'')+(d.role?'<div class="td">'+d.role+'</div>':'')+
    '<div class="td">'+f.d+'<br>狀態：'+fxStatus(f)+'　戰力 '+'●'.repeat(Math.max(0,f.hp))+'○'.repeat(Math.max(0,f.max-f.hp))+'</div>';
}
/* 滑鼠移到單位上：在游標旁顯示單位說明（電腦操作、對戰、影片模式皆可；僅限有滑鼠的裝置） */
let CARDHTML=null;
(function(){
  let tip=null;
  const hide=()=>{if(tip)tip.hidden=true;};
  const place=e=>{const r=tip.getBoundingClientRect();let x=e.clientX+16,y=e.clientY+16;if(x+r.width>innerWidth-8)x=e.clientX-r.width-12;if(y+r.height>innerHeight-8)y=e.clientY-r.height-12;tip.style.left=Math.max(4,x)+'px';tip.style.top=Math.max(4,y)+'px';};
  const pips=(a,m)=>'●'.repeat(Math.max(0,a))+'○'.repeat(Math.max(0,m-a));
  const FLEETN={'第7艦隊':'csg','海自護衛隊群':'jmsdf'};
  const html=el=>{
    const ue=el.closest('[data-id]');
    if(ue){const u=S&&S.units&&S.units.find(x=>x.id===+ue.dataset.id);if(!u||!alive(u))return '';return unitCard(u);}
    const fe=el.closest('[data-far]');
    if(fe){const nm=fe.getAttribute('data-far'),f=FARINFO[nm];if(!f)return '';
      const fu=FLEETN[nm]&&S.fx&&S.fx.units.find(x=>x.id===FLEETN[nm]);
      if(fu)return fxCard(fu)+'<div class="td">'+f.r+'</div>';
      return '<b style="color:var(--'+(f.w==='atk'?'atk':f.w==='us'?'us':'jp')+')">'+f.t+'</b><div class="td">'+f.d+'<br>'+f.r+(fu?'<br>狀態：'+fxStatus(fu)+'　戰力 '+pips(fu.hp,fu.max):'')+'</div>';}
    const be=el.closest('[data-b]'); // 戰區圖：美日基地
    if(be){const k=be.getAttribute('data-b'),B=BASES[k];if(!B)return '';
      const us=S.fx.units.filter(f=>f.base===k);
      return '<b style="color:var(--'+(B.c==='US'?'us':'jp')+')">'+B.n+'</b><div class="td">'+B.d+'</div>'+
        (us.length?'<div class="td">'+us.map(f=>f.n+'：'+fxStatus(f)+'（'+pips(f.hp,f.max)+'）').join('<br>')+'</div>':'');}
    const ce=el.closest('[data-cn]'); // 戰區圖：中方基地
    if(ce){const k=ce.getAttribute('data-cn'),B=CNB[k];if(!B)return '';
      return '<b style="color:var(--atk)">'+KIND_N[B.kind]+' · '+B.n+'</b><div class="td">'+B.d+'<br>'+(S.cn[k]>0?'運作中':'已癱瘓')+'　完整度 '+pips(S.cn[k],B.hp)+'</div>';}
    return '';
  };
  CARDHTML=html;
  if(!matchMedia('(hover:hover)').matches)return; // 觸控裝置：改用資訊欄的「詳細資料」按鈕
  tip=document.createElement('div');tip.id='utip';tip.hidden=true;document.body.appendChild(tip);
  const SEL='[data-id],[data-far],[data-b],[data-cn]';
  [$('#map'),$('#tmap')].forEach(map=>{if(!map)return;
  map.addEventListener('mousemove',e=>{
    const el=e.target.closest&&e.target.closest(SEL);
    if(!el){hide();return;}
    const h=html(el);if(!h){hide();return;}
    if(tip.dataset.k!==h){tip.innerHTML=h;tip.dataset.k=h;}
    tip.hidden=false;place(e);
  });
  map.addEventListener('mouseleave',hide);map.addEventListener('mousedown',hide);map.addEventListener('wheel',hide,{passive:true});
  });
})();
$('#info').addEventListener('click',e=>{
  const b=e.target.closest('#btnDetail');if(!b||!CARDHTML)return;
  const t=document.createElement('div');if(b.dataset.id)t.setAttribute('data-id',b.dataset.id);else t.setAttribute('data-far',b.dataset.far);
  const h=CARDHTML(t);if(!h)return;
  const box=mboxSet('');box.innerHTML='<div class="ucard" style="border:0;padding:0;margin:0">'+h+'</div><div class="btns" style="margin-top:10px"><button id="cardClose">關閉</button></div>';
  $('#modal').hidden=false;$('#resume').hidden=true;$('#cardClose').onclick=()=>{$('#modal').hidden=true;};$('#cardClose').focus();
});
document.addEventListener('click',e=>{ // 守方縱深打擊：也可直接點右側「中方基地」清單的列（手機上比點地圖小圖示容易）
  const r=e.target.closest('[data-cnrow]');if(!r)return;const id=r.getAttribute('data-cnrow');
  if(tomClick(id))return;
    if(humanCN(id))return;
  S.cnSel=S.cnSel===id?null:id;S.thSel=null;render();
});
$('#btnStrike').onclick=()=>{if(!humanTurn())return;S.mode=S.mode==='strike'?null:'strike';S.sel=null;render();};
$('#btnEnd').onclick=()=>{if(!humanTurn())return;if(endPhaseGuard())return;endPhase();};
$('#btnUndo').onclick=undoMove;$('#btnHkHome').onclick=hkGoHome;$('#btnHkWpn').onclick=hkCycleWpn;$('#mbUndo').onclick=undoMove;
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='z'&&S&&S.started&&undoAvail()){e.preventDefault();undoMove();}});
function readSetup(){
  S.era=$('#optEra').value;if(!S.started)previewEra();
  S.T=+$('#optT').value;S.sim=$('#optMode').value==='sim';S.video=$('#optMode').value==='video';S.speed=S.sim?+$('#optSpeed').value:1;
  const sd=$('#optSide').value;
  S.ctrl=S.sim||S.video?{atk:'ai',def:'ai'}:{atk:sd==='atk'||sd==='both'?'human':'ai',def:sd==='def'||sd==='both'?'human':'ai'};
  S.newsOn=$('#optNews').value!=='0';S.newsCompact=$('#optNews').value==='2';S.fxScen=$('#optFx').value==='dice'?'interest':$('#optFx').value;S.airGen=$('#optAirGen').value;S.airModel=$('#optAirModel').value;S.ewLv=$('#optEW').value;S.allyCtl=$('#optAlly').value==='player'?'player':'ai';
}
['#optT','#optEra','#optSide','#optMode','#optSpeed','#optVSpeed','#optBuild','#optExer','#optLift','#optMonth','#optFxBias','#optWiLift','#optWiShip','#optWiWx','#optWiDArms','#optWiLocal','#optWiAllies','#optPreDiplo','#optPreDeploy','#optReact','#optNavy','#optPenghu','#optPrepos','#optNews','#optVoice','#optSfx','#optFxSpd','#optTerm','#optFx','#optAlly','#optAirGen','#optAirModel','#optEW','#optAxN','#optAxC','#optAxP'].forEach(id=>$(id).addEventListener('change',()=>{readSetup();saveSetup();renderWizard();render();}));
const CFG_IDS=['optMode','optSide','optSpeed','optVSpeed','optT','optEra','optBuild','optExer','optLift','optMonth','optFxBias','optWiLift','optWiShip','optWiWx','optWiDArms','optWiLocal','optWiAllies','optPreDiplo','optPreDeploy','optReact','optNavy','optPenghu','optPrepos','optFx','optAlly','optAirGen','optAirModel','optEW','optNews','optVoice','optSfx','optFxSpd','optTerm','optAxN','optAxC','optAxP'];
const DEFAULT_CFG={optMode:'play',optSide:'atk',optSpeed:'1',optVSpeed:'2',optT:'8',optEra:'2026',optBuild:'exercise',optExer:'small',optLift:'1',optMonth:'4',optFxBias:'0',optWiLift:'0',optWiShip:'0',optWiWx:'0',optWiDArms:'0',optWiLocal:'0',optWiAllies:'0',optPreDiplo:'auto',optPreDeploy:'auto',optReact:'auto',optNavy:'auto',optPenghu:'auto',optPrepos:'auto',optFx:'interest',optAlly:'ai',optAirGen:'mixed',optAirModel:'bvr',optEW:'mid',optNews:'1',optVoice:'0',optSfx:'0',optFxSpd:'1',optTerm:'plain',optAxN:'0',optAxC:'0',optAxP:'1'};
$('#btnStart').onclick=()=>{if(!$('#btnStart').disabled)startGame();};
// one-off start with the default settings; the saved setup choices are left as they were
$('#btnDefault').onclick=()=>{
  const keep={};Object.keys(DEFAULT_CFG).forEach(id=>{keep[id]=$('#'+id).value;$('#'+id).value=DEFAULT_CFG[id];});
  startGame();
  Object.entries(keep).forEach(([id,v])=>{$('#'+id).value=v;});
  renderWizard();
};
function seedCode(seed){const c={};CFG_IDS.forEach(id=>{const e=$('#'+id);if(e)c[id]=e.value;});try{return 'TSL1-'+btoa(unescape(encodeURIComponent(JSON.stringify({s:seed,c})))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}catch(e){return seed;}}
function parseSeedCode(t){t=(t||'').trim();if(!/^TSL1-/.test(t))return null;try{const b=t.slice(5).replace(/-/g,'+').replace(/_/g,'/');const o=JSON.parse(decodeURIComponent(escape(atob(b))));return o&&o.s?o:null;}catch(e){return null;}}
function initSeed(){HL.shots=[];HL.pend=[];const w=(WZ.seedTxt||'').trim();const o=parseSeedCode(w);const seed=o?o.s:(w||newSeed());S.seed=seed;S.seedCode=seedCode(seed);seedRng(seed);}
function startGame(){
  readSetup();initSeed();if(S.video){startVideo();return;}
  S.started=true;setTab('cmd');
  applyEra();applyFxScenario();log(applyMonth().join('；')+'。');applyWhatIf();airInit();mslInit();
  if(!S.sim){const b=$('#optBuild').value,fx=applyBuildup(b);log('戰前集結：'+BUILDUP.find(x=>x.id===b).label+'。'+fx.join('、'));applyPlan();}
  S.lastSnap=snap();
  log((S.sim?'推演開始':'作戰開始')+'。判定回合：第 '+S.T+' 回合。');
  if(S.exer&&!S.sim){S.busy=true;render();exercisePrelude().then(()=>{S.busy=false;beginPhase('atk');});}else beginPhase('atk');
}
function confirmBox(msg){return new Promise(res=>{const box=mboxSet('');
  box.innerHTML='<div class="eyebrow">確認打擊</div><h3>升級戰事？</h3><p>'+msg+'</p><div class="btns"><button id="cfY">確定打擊</button><button class="ghost" id="cfN">取消</button></div>';
  $('#modal').hidden=false;$('#cfY').onclick=()=>{$('#modal').hidden=true;res(true);};$('#cfN').onclick=()=>{$('#modal').hidden=true;res(false);};$('#cfN').focus();});}
$('#tmap').addEventListener('click',async e=>{
  const cn=e.target.closest('[data-cn]');
  if(cn){
    const id=cn.getAttribute('data-cn');
    if(tomClick(id))return;
    if(humanCN(id))return;
    S.cnSel=S.cnSel===id?null:id;S.thSel=null;render();return;
  }
  const el=e.target.closest('[data-b]');if(!el)return;const b=el.getAttribute('data-b');
  if(humanTurn()&&S.phase==='atk'&&S.mode==='strike'&&S.fire>0&&baseTargets(b).length){
    const w=escalationText(b);if(w&&!(await confirmBox(w)))return;
    strikeBase(b);if(S.fire<=0)S.mode=null;render();return;
  }
  S.thSel=S.thSel===b?null:b;S.cnSel=null;render();
});
$('#resume').onclick=()=>{$('#resume').hidden=true;$('#modal').hidden=false;};
