// 測試用的「假 PeerJS」：用 localStorage（誰在線）＋BroadcastChannel（傳資料）在同一個瀏覽器的多個分頁之間模擬配對與連線，
// 讓大廳主機推舉、房間報到、主機離線接手、建立房間／加入等真實流程可以在沒有外網的環境測試。用法：page.addInitScript(MOCK_PEER_SRC)
module.exports = `(() => {
  const REG = 'mp-reg', uid = Math.random().toString(36).slice(2);
  const live = () => { try { const o = JSON.parse(localStorage.getItem(REG) || '{}'), t = Date.now(); for (const k of Object.keys(o)) if (t - o[k].ts > 1500) delete o[k]; return o; } catch (e) { return {}; } };
  const put = o => localStorage.setItem(REG, JSON.stringify(o));
  class Em { constructor() { this.h = {}; } on(e, f) { (this.h[e] = this.h[e] || []).push(f); return this; } once(e, f) { const g = (...a) => { this.h[e] = this.h[e].filter(x => x !== g); f(...a); }; return this.on(e, g); } emit(e, ...a) { (this.h[e] || []).slice().forEach(f => f(...a)); } }
  class Conn extends Em {
    constructor(peer, remote, id) { super(); this.peer = peer; this.remote = remote; this.id = id; this.open = false; this.ch = new BroadcastChannel('mpc-' + id); this.ch.onmessage = e => this.recv(e.data); peer.conns.add(this); }
    recv(m) {
      if (m.k === 'ack') { if (!this.open) { this.open = true; this.emit('open'); } }
      else if (m.k === 'd') this.emit('data', m.d);
      else if (m.k === 'bye') this.shut(false);
    }
    send(d) { if (this.open) this.ch.postMessage({ k: 'd', d: JSON.parse(JSON.stringify(d)) }); }
    close() { this.shut(true); }
    shut(tell) { if (this.dead) return; this.dead = true; const was = this.open; this.open = false; if (tell) this.ch.postMessage({ k: 'bye' }); this.ch.close(); this.peer.conns.delete(this); if (was || !tell) this.emit('close'); }
  }
  class Peer extends Em {
    constructor(id) {
      super(); this.conns = new Set(); this.destroyed = false; this.disconnected = false; this.id = id || 'mp-' + Math.random().toString(36).slice(2, 8);
      setTimeout(() => {
        const o = live();
        if (id && o[id] && o[id].uid !== uid) { this.destroyed = true; this.emit('error', { type: 'unavailable-id' }); return; }
        const beat = () => { const x = live(); x[this.id] = { ts: Date.now(), uid }; put(x); };
        beat(); this.timer = setInterval(beat, 400);
        this.inbox = new BroadcastChannel('mp-' + this.id);
        this.inbox.onmessage = e => { const m = e.data; if (m.k !== 'conn') return; const c = new Conn(this, m.from, m.id); this.emit('connection', c); c.ch.postMessage({ k: 'ack' }); c.open = true; c.emit('open'); };
        this.emit('open', this.id);
      }, 5);
    }
    connect(target) {
      const c = new Conn(this, target, Math.random().toString(36).slice(2));
      setTimeout(() => {
        if (!live()[target]) { c.dead = true; c.ch.close(); this.conns.delete(c); this.emit('error', { type: 'peer-unavailable' }); return; }
        new BroadcastChannel('mp-' + target).postMessage({ k: 'conn', id: c.id, from: this.id });
      }, 5);
      return c;
    }
    destroy() { if (this.destroyed) return; this.destroyed = true; clearInterval(this.timer); for (const c of [...this.conns]) c.shut(true); try { const x = live(); if (x[this.id] && x[this.id].uid === uid) { delete x[this.id]; put(x); } } catch (e) {} if (this.inbox) this.inbox.close(); }
    reconnect() {}
  }
  const all = new Set(); const Orig = Peer;
  window.Peer = class extends Orig { constructor(id) { super(id); all.add(this); } };
  window.__mpDie = () => { for (const p of all) p.destroy(); };   // 測試用：模擬這個分頁的所有 peer 都消失（含通知對方連線中斷）
})();`;
