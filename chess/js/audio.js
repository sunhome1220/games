// ----- 音效（Web Audio 即時合成，不需要音檔） -----
// 每種武器由數層聲音疊成：槍口爆裂（crack，高頻瞬間）＋槍身（body，中頻）＋低頻悶響（thump）＋環境殘響（reverb 尾音），
// 並依真實武器特性調整：手槍短促、步槍有超音速爆音與回音、機槍連發、霰彈槍低沉巨響＋拉槍栓、火箭筒噴射呼嘯、迫擊砲「咚」＋落下哨音。
const SFX = (() => {
  let ac = null, master = null, dry = null, wet = null, conv = null, noiseBuf = null, muted = false;
  try { muted = localStorage.getItem('rc-mute') === '1'; } catch (e) {}
  const VOL = 0.75;
  const rv = (x = 0.05) => x * (0.92 + Math.random() * 0.16);   // 每次發聲略有變化，連發才不會像錄音重播
  // 建立音訊鏈：dry／wet（殘響）→ 總音量 → 壓縮器（防爆音、讓巨響更有厚度）→ 輸出
  function setup(ctx) {
    ac = ctx;
    master = ctx.createGain(); master.gain.value = muted ? 0 : VOL;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.18;
    master.connect(comp); comp.connect(ctx.destination);
    dry = ctx.createGain(); dry.connect(master);
    // 殘響：用指數衰減的噪音當脈衝響應（約 1.8 秒，高頻衰減較快，像戶外空曠處的回音）
    const len = Math.floor(ctx.sampleRate * 1.8), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c); let lp = 0;
      for (let i = 0; i < len; i++) {
        const k = i / len, a = (Math.random() * 2 - 1) * Math.pow(1 - k, 3.2);
        lp += (a - lp) * (0.9 - 0.8 * k);   // 越到尾端越悶
        d[i] = lp;
      }
    }
    conv = ctx.createConvolver(); conv.buffer = ir;
    wet = ctx.createGain(); wet.gain.value = 0.9; wet.connect(conv); conv.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }
  function init() {   // 瀏覽器規定要在使用者操作後才能出聲
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) setup(new AC());
  }
  // 輸出到 dry，並以 send（0～1）分一部分到殘響
  function route(node, send) {
    node.connect(dry);
    if (send > 0) { const g = ac.createGain(); g.gain.value = send; node.connect(g); g.connect(wet); }
  }
  // 振盪器：波形、起訖頻率、長度、音量、延遲；attack 為起音時間（秒）
  function tone(type, f0, f1, dur, vol, delay = 0, send = 0, attack = 0.002, lp = 0) {
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n = o; o.connect(g);
    if (lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; g.connect(f); n = f; } else n = g;
    route(n, send); o.start(t); o.stop(t + dur + 0.03);
  }
  // 濾波噪音：濾波種類、起訖頻率、長度、音量、延遲、Q
  function noise(type, f0, f1, dur, vol, delay = 0, q = 1, send = 0, attack = 0.001) {
    const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); route(g, send); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  }
  // 一發槍響：crack 槍口爆裂、body 槍身、thump 低頻悶響、tail 殘響尾音、snap 超音速爆音
  function shot(o) {
    const d = o.delay || 0, f = rv(0.06);
    noise('highpass', 5000 * f, 2500, o.crackT || 0.03, o.crack, d, 0.7, o.send || 0.2);
    noise('bandpass', o.bodyF * f, o.bodyF * 0.35, o.bodyT, o.body, d, 0.9, o.send || 0.2);
    tone('sine', o.thumpF * f, o.thumpF * 0.4, o.thumpT, o.thump, d, o.send || 0.2, 0.002);
    if (o.snap) noise('bandpass', 3200 * f, 1800, 0.05, o.snap, d, 3, 0.1);
    if (o.tail) noise('lowpass', 1400, 120, o.tailT || 0.5, o.tail, d + 0.01, 0.7, 0.9);
  }
  // 金屬機械聲（槍栓、滑套、彈殼）
  const metal = (delay, f = 2400, vol = 0.18) => { noise('bandpass', f * rv(0.1), f * 0.8, 0.018, vol, delay, 9, 0.05); tone('triangle', f * 0.5, f * 0.3, 0.03, vol * 0.4, delay, 0.05); };
  const casing = delay => { for (let i = 0; i < 3; i++) tone('sine', 5200 * rv(0.25), 4300, 0.09, 0.025, delay + i * (0.04 + Math.random() * 0.05), 0.2); };
  const S = {
    click:   () => tone('square', 1500, 900, 0.025, 0.05),
    // 車輛起步：低沉引擎轉速上升＋輪胎碾過地面
    launch:  k => { tone('sawtooth', 62, 95 + 70 * k, 0.5, 0.07, 0, 0.1, 0.03, 500); noise('bandpass', 300, 1200 + 900 * k, 0.45, 0.1 + 0.1 * k, 0, 1.5, 0.05, 0.04); },
    bump:    v => { const k = Math.min(1, v / 600); tone('sine', 190, 55, 0.16, 0.45 * k); noise('lowpass', 2200, 300, 0.08, 0.3 * k); },
    // 手槍：清脆短促，滑套回彈的金屬聲
    pistol:  () => { shot({ crack: 0.55, crackT: 0.025, bodyF: 1800, bodyT: 0.06, body: 0.3, thumpF: 220, thumpT: 0.06, thump: 0.28, tail: 0.1, tailT: 0.4, send: 0.2 }); metal(0.1, 3000, 0.12); },
    // 步槍：較大的爆音、超音速「啪」聲、悠長的山谷回音
    rifle:   () => { shot({ crack: 0.8, crackT: 0.04, bodyF: 1200, bodyT: 0.11, body: 0.5, thumpF: 150, thumpT: 0.13, thump: 0.5, snap: 0.35, tail: 0.22, tailT: 0.9, send: 0.4 }); metal(0.28, 2000, 0.1); },
    // 機槍：快速連發（與畫面四連發同步，每 70 毫秒一發），每發略有差異，最後散落彈殼
    mg:      () => { for (let i = 0; i < 4; i++) shot({ delay: i * 0.07, crack: rv(0.6) * (i === 0 ? 1.1 : 1), crackT: 0.03, bodyF: 1500, bodyT: 0.07, body: 0.38, thumpF: 170, thumpT: 0.07, thump: 0.36, tail: i === 3 ? 0.2 : 0.06, tailT: i === 3 ? 0.7 : 0.25, send: 0.3 }); casing(0.3); },
    // 霰彈槍：寬頻巨響＋低沉震動，隨後「喀嚓、喀嚓」拉動泵動槍機
    shotgun: () => { shot({ crack: 1.0, crackT: 0.05, bodyF: 1100, bodyT: 0.3, body: 0.8, thumpF: 95, thumpT: 0.24, thump: 0.85, tail: 0.3, tailT: 0.9, send: 0.5 }); metal(0.42, 1700, 0.22); metal(0.56, 2300, 0.24); casing(0.62); },
    // 火箭筒：發射時「噗」的後噴氣流，接著火箭發動機持續噴射呼嘯
    rocket:  () => { noise('lowpass', 900, 150, 0.14, 0.55, 0, 0.8, 0.3); tone('sine', 75, 38, 0.2, 0.55, 0, 0.3);
                     noise('bandpass', 500, 3200, 0.6, 0.3, 0.03, 1.4, 0.35, 0.05); noise('highpass', 2500, 6000, 0.5, 0.1, 0.05, 0.7, 0.2, 0.05);
                     tone('sawtooth', 52, 105, 0.6, 0.06, 0.03, 0.1, 0.05, 700); },
    // 迫擊砲：砲彈滑入管底「鏘」一聲撞針擊發，接著空洞的「咚」＋管口噴出的氣流，最後一道下墜的哨音（與砲彈飛行同步）
    mortar:  () => { metal(0, 1100, 0.3); tone('sine', 150, 48, 0.4, 0.95, 0.03, 0.35, 0.003); tone('triangle', 300, 90, 0.2, 0.3, 0.03, 0.3);
                     noise('lowpass', 1300, 120, 0.28, 0.55, 0.03, 0.8, 0.3); noise('bandpass', 700, 250, 0.18, 0.35, 0.03, 4, 0.4);   // 管內共鳴
                     tone('sine', 520, 410, 0.35, 0.07, 0.05, 0.5); noise('highpass', 2000, 900, 0.1, 0.22, 0.03, 1, 0.3);
                     tone('sine', 2800, 650, 0.6, 0.08, 0.22, 0.2, 0.05); },
    // 子彈命中：悶悶的撞擊＋金屬聲
    hit:     () => { noise('bandpass', 1900, 600, 0.08, 0.4, 0, 1, 0.15); tone('sine', 150, 65, 0.15, 0.4, 0, 0.1); tone('sine', 1900, 1500, 0.16, 0.05, 0.01, 0.2); },
    // 爆炸：低頻次聲波＋長尾噪音＋碎石飛散的劈啪聲＋大量殘響
    boom:    big => { const T = big ? 1 : 0.55;
                      tone('sine', 72, 24, 1.15 * T, 0.95, 0, 0.5, 0.004); tone('sine', 140, 45, 0.5 * T, 0.5, 0, 0.3);
                      noise('lowpass', 2800, 70, 1.5 * T, 0.9, 0, 0.7, 0.6, 0.003);
                      noise('bandpass', 1400, 400, 0.25 * T, 0.5, 0, 0.8, 0.3);
                      for (let i = 0; i < (big ? 7 : 3); i++) noise('bandpass', (1500 + Math.random() * 4000), 1000, 0.05, 0.14 * Math.random() + 0.06, 0.1 + Math.random() * 0.6 * T, 2, 0.3); },
    // 勝利：銅管號角（鋸齒波經低通濾波）
    card:    () => { tone('triangle', 660, 990, 0.12, 0.12, 0, 0.3); tone('triangle', 990, 1320, 0.2, 0.1, 0.09, 0.4); noise('highpass', 4000, 9000, 0.08, 0.1, 0, 1, 0.2); },
    // ── 終極魔法的專屬音效 ──
    // 隕石雨：長長的下墜呼嘯，接著一顆顆隕石依序轟然落地（和畫面的 0.5 秒 + 0.12 秒間隔對齊）
    meteor:  () => { tone('sine', 2200, 260, 0.55, 0.14, 0, 0.3, 0.05); noise('bandpass', 3000, 400, 0.55, 0.22, 0, 1, 0.3, 0.1);
                     for (let i = 0; i < 8; i++) { const d = 0.5 + i * 0.12; tone('sine', 90 - i * 3, 28, 0.6, 0.55, d, 0.5, 0.004); noise('lowpass', 2400, 90, 0.6, 0.5, d, 0.7, 0.5, 0.003); }
                     noise('lowpass', 500, 60, 1.6, 0.3, 0.5, 0.7, 0.5, 0.3); },
    // 起死回生：神聖的和聲漸強（大和弦＋高泛音），夾帶閃爍的沙沙聲
    holy:    () => { [[261.6, 0], [329.6, 0.1], [392, 0.2], [523.3, 0.3], [659.3, 0.4], [784, 0.5]].forEach(([f, d]) => { tone('sine', f, f, 1.9, 0.1, d, 0.8, 0.6); tone('triangle', f * 2, f * 2, 1.6, 0.04, d + 0.1, 0.8, 0.7); });
                     noise('highpass', 5000, 9000, 1.6, 0.06, 0.2, 1, 0.6, 0.5); for (let i = 0; i < 6; i++) tone('sine', 1760 + i * 220, 1760 + i * 220, 0.5, 0.04, 0.3 + i * 0.2, 0.7, 0.01); },
    // 時間暫停：倒數的滴答聲逐漸變慢，最後一聲低沉的銅鑼
    tick:    () => { let t = 0; for (let i = 0; i < 9; i++) { noise('bandpass', i % 2 ? 2600 : 1900, 1800, 0.05, 0.28, t, 6, 0.1, 0.001); tone('sine', i % 2 ? 900 : 700, 500, 0.06, 0.12, t, 0.1); t += 0.12 + i * 0.03; }
                     tone('sine', 98, 90, 2.2, 0.5, t, 0.8, 0.01); tone('triangle', 196, 188, 1.6, 0.16, t, 0.8, 0.01); noise('bandpass', 700, 300, 1.4, 0.1, t, 3, 0.6, 0.01);
                     tone('sine', 300, 1200, 0.6, 0.07, 0, 0.5, 0.4); },
    // 神之護盾：能量由低漸高升起，再「鏘」地罩上，帶著六角形結界的細碎共鳴
    shield:  () => { tone('sawtooth', 120, 720, 0.8, 0.06, 0, 0.4, 0.5, 1500); tone('sine', 240, 960, 0.8, 0.1, 0, 0.5, 0.4);
                     [880, 1318, 1760].forEach((f, i) => tone('sine', f, f * 0.998, 1.2, 0.12, 0.8 + i * 0.05, 0.8, 0.005)); noise('bandpass', 4200, 2600, 0.9, 0.1, 0.78, 4, 0.5, 0.01); noise('highpass', 5200, 8000, 0.5, 0.07, 0.9, 1, 0.5, 0.01); },
    // 天雷審判：三次落雷的炸裂聲＋隆隆回響（和畫面的 0.35／0.58／0.82 秒對齊）
    thunder: () => { [0.35, 0.58, 0.82].forEach(d => { noise('highpass', 1500, 6000, 0.12, 0.55, d, 0.7, 0.3, 0.001); tone('sine', 70, 28, 0.9, 0.7, d, 0.5, 0.002); });
                     noise('lowpass', 900, 70, 2.2, 0.4, 0.35, 0.7, 0.7, 0.05); noise('bandpass', 400, 100, 1.6, 0.18, 0, 2, 0.6, 0.3); },
    // 冰封世界：結冰的碎裂聲與水晶般的叮噹聲
    freeze:  () => { noise('bandpass', 1400, 250, 0.45, 0.3, 0.4, 5, 0.5, 0.005); noise('highpass', 6000, 9500, 1.2, 0.1, 0.4, 1, 0.6, 0.1);
                     for (let i = 0; i < 10; i++) { const f = [2093, 2637, 3136, 3951][i % 4]; tone('sine', f, f * 0.995, 0.5, 0.07, 0.45 + i * 0.1, 0.8, 0.003); }
                     tone('sine', 80, 40, 0.9, 0.35, 0.4, 0.5, 0.01); noise('lowpass', 600, 80, 0.9, 0.2, 0.4, 1, 0.5, 0.02); },
    heal:    () => [784, 988, 1319].forEach((f, i) => tone('sine', f, f * 1.01, 0.3, 0.12, i * 0.07, 0.4)),
    win:     () => [523, 659, 784, 1047].forEach((f, i) => { tone('sawtooth', f, f, i === 3 ? 0.9 : 0.32, 0.11, i * 0.15, 0.4, 0.02, 2200); tone('triangle', f / 2, f / 2, i === 3 ? 0.9 : 0.32, 0.12, i * 0.15, 0.2, 0.02); }),
    promote: () => [392, 523, 659].forEach((f, i) => tone('sawtooth', f, f, 0.14, 0.08, i * 0.08, 0.2, 0.01, 2000)),
    // 運輸機低空飛過：螺旋槳引擎的低頻嗡鳴（振幅快速起伏）＋都卜勒效應（逼近時音調高、遠離時降低）
    plane:   () => { const t = ac.currentTime;
                     for (const [f, v] of [[84, 0.07], [88, 0.06]]) {
                       const o = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain(), lp = ac.createBiquadFilter();
                       o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 1.12, t); o.frequency.exponentialRampToValueAtTime(f * 0.88, t + 1.7);
                       lfo.frequency.value = 27; lg.gain.value = v * 0.5; lfo.connect(lg); lg.connect(g.gain);
                       g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.5); g.gain.setValueAtTime(v, t + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
                       lp.type = 'lowpass'; lp.frequency.value = 900; o.connect(lp); lp.connect(g); route(g, 0.15); o.start(t); o.stop(t + 1.85); lfo.start(t); lfo.stop(t + 1.85);
                     }
                     noise('bandpass', 350, 280, 1.6, 0.08, 0, 2, 0.1, 0.4); },
    // 補給箱落地：沉重撞擊＋塵土，接著銅管號角
    thud:    () => { tone('sine', 105, 36, 0.28, 0.7, 0, 0.3); noise('lowpass', 900, 120, 0.22, 0.35, 0, 0.8, 0.3); metal(0.04, 900, 0.14);
                     [392, 523, 659, 784].forEach((f, i) => tone('sawtooth', f, f, 0.2, 0.09, 0.16 + i * 0.08, 0.35, 0.01, 1900)); },
    // 防空飛彈升空：高亢的固態火箭噴氣聲，快速爬升
    aa:      () => { noise('lowpass', 1600, 300, 0.1, 0.35, 0, 0.8, 0.2); noise('highpass', 1500, 6500, 0.45, 0.28, 0.02, 0.8, 0.3, 0.02);
                     noise('bandpass', 900, 4200, 0.4, 0.2, 0.02, 2, 0.3, 0.03); tone('sawtooth', 160, 700, 0.4, 0.05, 0.02, 0.1, 0.03, 1500); },
  };
  // 各音效的音量修正（實測各音效最大振幅後調成大致平衡：槍聲 < 爆炸，撞擊／點擊聲較小）
  const TRIM = { meteor: 1, holy: 1.6, tick: 1.6, shield: 1.6, thunder: 1, freeze: 1.8, click: 9, launch: 4.5, pistol: 3.2, rifle: 2.4, mg: 0.65, shotgun: 2.7, rocket: 2, mortar: 1.2, hit: 2.7, boom: 1.1, aa: 1.3, plane: 1.3, thud: 2.2, win: 1.3, promote: 2, bump: 1, card: 2, heal: 1.5 };
  // 以獨立的音量匯流排播放，使每個音效套用自己的修正值
  function run(n, a) {
    const g = TRIM[n] || 1, d0 = dry, w0 = wet;
    dry = ac.createGain(); dry.gain.value = g; dry.connect(master);
    wet = ac.createGain(); wet.gain.value = 0.9 * g; wet.connect(conv);
    try { S[n](...a); } finally { dry = d0; wet = w0; }
  }
  return {
    init,
    play(n, ...a) { if (ac && !muted) run(n, a); },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('rc-mute', muted ? '1' : '0'); } catch (e) {}
      if (master) master.gain.value = muted ? 0 : VOL;
      return muted;
    },
    get muted() { return muted; },
    // 測試用：離線渲染某個音效，回傳取樣資料（不輸出聲音）
    async _render(name, args = [], secs = 3) {
      const keep = [ac, master, dry, wet, conv, noiseBuf], off = new OfflineAudioContext(2, 44100 * secs, 44100);
      setup(off); try { run(name, args); const buf = await off.startRendering(); return buf; } finally { [ac, master, dry, wet, conv, noiseBuf] = keep; }
    },
  };
})();

