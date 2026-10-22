// ===== 暱稱與表情（連線對戰）=====
// 暱稱：最多 8 個字，存在這台裝置（沒設定過就用「玩家＋隨機 3 碼」）；連線成功時互相傳送，顯示在回合標題、結果畫面和「我的強化」頁籤。
// 表情：8 個固定表情，傳的是編號（不是文字，避免被塞奇怪的內容）；雙方畫面都會在該方那一側浮出泡泡 2 秒，每人 2 秒最多送一個，可以關掉對手的表情。
const NICK_MAX = 8;
const EMOJIS = ['👍', '👏', '😄', '😮', '😭', '🔥', '🤝', '⏰'];
const cleanNick = s => [...String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim()].slice(0, NICK_MAX).join('');
let myName = '', peerName = '對手', emoLast = 0, emoPeerLast = 0, emoMute = false;
{
  let v = ''; try { v = cleanNick(localStorage.getItem('rc-nick')); } catch (e) {}
  if (!v) { v = '玩家' + (100 + Math.floor(Math.random() * 900)); try { localStorage.setItem('rc-nick', v); } catch (e) {} }
  myName = cleanNick(new URLSearchParams(location.search).get('nick')) || v;   // ?nick=：測試用，只在這一頁生效、不存檔
  try { emoMute = localStorage.getItem('rc-emo-mute') === '1'; } catch (e) {}
}
const nameOf = side => side === mySide ? myName : peerName;
const sideLabel = s => online() ? nameOf(s) : SIDE[s].name;   // 連線時用暱稱，其他模式維持紅方／黑方
const sendName = () => send({ t: 'name', name: myName });
$('nickIn').value = myName;
$('nickIn').oninput = e => {
  const v = cleanNick(e.target.value); if (!v) return;
  myName = v; try { localStorage.setItem('rc-nick', v); } catch (err) {}
  if (online()) { sendName(); updateHeader(); }
};
$('nickIn').onchange = e => { e.target.value = myName; };   // 清空就還原成目前的暱稱
function renderEmoBtn() {
  $('emoBtn').hidden = !online();
  if (!online()) $('emoBox').hidden = true;
}
function showEmoji(mine, i) {
  const st = $('stage3') && $('stage3').offsetWidth ? $('stage3') : cv, r = st.getBoundingClientRect();
  const el = document.createElement('div'); el.className = 'emoBubble';
  el.append(EMOJIS[i]); const nm = document.createElement('small'); nm.textContent = mine ? myName : peerName; el.append(nm);
  el.style.left = (r.left + r.width * (0.2 + Math.random() * 0.6)) + 'px'; el.style.top = (mine ? r.bottom - 78 : r.top + 28) + 'px';   // 我在棋盤下方、對手在上方
  document.body.appendChild(el); setTimeout(() => el.remove(), 2300);
}
function sendEmoji(i) {
  if (!online() || !EMOJIS[i]) return;
  if (Date.now() - emoLast < 2000) { toast('表情送太快了，稍等一下'); return; }
  emoLast = Date.now(); send({ t: 'emo', i }); showEmoji(true, i); SFX.play('click'); $('emoBox').hidden = true;
}
function showEmoMute() { $('emoMute').textContent = `🔇 隱藏對手的表情：${emoMute ? '開' : '關'}`; }
$('emoBox').insertBefore(Object.assign(document.createElement('div'), { id: 'emoRow' }), $('emoMute'));
EMOJIS.forEach((e, i) => { const b = document.createElement('button'); b.textContent = e; b.onclick = () => sendEmoji(i); $('emoRow').appendChild(b); });
$('emoBtn').onclick = () => { $('emoBox').hidden = !$('emoBox').hidden; showEmoMute(); };
$('emoMute').onclick = () => { emoMute = !emoMute; try { localStorage.setItem('rc-emo-mute', emoMute ? '1' : '0'); } catch (e) {} showEmoMute(); };
// 處理暱稱、表情訊息；回傳 true＝已處理
function onNetSocial(m) {
  if (m.t === 'name') { peerName = cleanNick(m.name) || '對手'; updateHeader(); if (!$('perkOv').hidden) showPerks(perkTab); return true; }
  if (m.t === 'emo') {
    if (!emoMute && EMOJIS[m.i] && Date.now() - emoPeerLast > 500) { emoPeerLast = Date.now(); showEmoji(false, m.i); SFX.play('click'); }   // 對方狂按時，500 毫秒內的忽略
    return true;
  }
  return false;
}
