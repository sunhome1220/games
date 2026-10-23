// 以 WebAudio 即時合成全部音效，不依賴任何檔案
const Sfx = (() => {
  let ctx = null, master = null, muted = false;
  let chargeOsc = null, chargeGain = null, noiseBuf = null;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : CONFIG.audio.master;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : CONFIG.audio.master;
    if (m) chargeStop();
  }
  const isMuted = () => muted;

  function tone(freq, dur, type, vol, slideTo, delay = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq, q, type, delay = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type || 'bandpass';
    f.frequency.value = freq; f.Q.value = q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  // 一格「卡」：短促的齒輪棘輪聲，pitch 0..1
  function ratchet(pitch) {
    tone(260 + pitch * 520, 0.045, 'square', 0.12, 120 + pitch * 200);
    noise(0.03, 0.18, 2200 + pitch * 2500, 4, 'bandpass');
  }
  // 蓄力時逐漸增強的機械運轉聲
  function chargeStart() {
    if (!ctx || muted || chargeOsc) return;
    chargeOsc = ctx.createOscillator(); chargeGain = ctx.createGain();
    chargeOsc.type = 'sawtooth'; chargeOsc.frequency.value = 70;
    chargeGain.gain.value = 0.0001;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    chargeOsc.connect(f); f.connect(chargeGain); chargeGain.connect(master);
    chargeOsc.start();
  }
  function chargeUpdate(p) {
    if (!chargeOsc) return;
    const t = ctx.currentTime;
    chargeOsc.frequency.setTargetAtTime(70 + p * 190, t, 0.04);
    chargeGain.gain.setTargetAtTime(0.02 + p * 0.1, t, 0.04);
  }
  function chargeStop() {
    if (!chargeOsc) return;
    const o = chargeOsc, g = chargeGain;
    chargeOsc = chargeGain = null;
    g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03);
    o.stop(ctx.currentTime + 0.15);
  }
  // 放手：發條釋放的一聲 whirr
  function launch(p) {
    chargeStop();
    tone(180, 0.35, 'sawtooth', 0.1 + p * 0.1, 620 + p * 500);
    noise(0.3, 0.2, 1500, 1.2, 'bandpass');
  }
  // 行進中的「卡、卡、卡」，隨速度改變音高
  function tick(speedRatio) {
    const r = Math.max(0, Math.min(1, speedRatio));
    tone(150 + r * 200, 0.05, 'square', 0.1, 90 + r * 60);
    noise(0.035, 0.12, 1500 + r * 2500, 3, 'bandpass');
  }
  function shoot() {
    tone(420, 0.28, 'sawtooth', 0.18, 70);
    noise(0.22, 0.35, 900, 0.8, 'lowpass');
  }
  function hit() {
    tone(110, 0.4, 'sine', 0.5, 35);
    noise(0.35, 0.5, 700, 0.7, 'lowpass');
    tone(900, 0.1, 'square', 0.1, 300);
  }
  function miss() { noise(0.25, 0.18, 500, 1, 'lowpass', 0.05); tone(260, 0.2, 'triangle', 0.1, 120, 0.05); }
  function bump() { tone(90, 0.15, 'square', 0.25, 50); noise(0.1, 0.25, 600, 1, 'lowpass'); }
  function pickup() { [660, 880, 1175].forEach((f, i) => tone(f, 0.12, 'triangle', 0.18, 0, i * 0.07)); }
  function boom() { tone(80, 0.6, 'sawtooth', 0.4, 30); noise(0.6, 0.6, 500, 0.6, 'lowpass'); }
  function click() { tone(660, 0.06, 'square', 0.1, 880); }
  function cancel() { tone(300, 0.12, 'triangle', 0.12, 140); }
  function win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'square', 0.16, 0, i * 0.13));
    tone(1047, 0.6, 'triangle', 0.18, 0, 0.55);
  }
  function lose() {
    [392, 330, 262, 196].forEach((f, i) => tone(f, 0.28, 'sawtooth', 0.14, 0, i * 0.18));
  }
  return { init, setMuted, isMuted, ratchet, chargeStart, chargeUpdate, chargeStop,
           launch, tick, shoot, hit, miss, bump, pickup, boom, click, cancel, win, lose };
})();
