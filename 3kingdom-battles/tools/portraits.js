#!/usr/bin/env node
// 武將頭像工具（資料在 assets/portraits/characters.js，紀錄在 assets/portraits/log.json）
//   node 3kingdom-battles/tools/portraits.js prompts [id,id…]      產生提示詞到 assets/portraits/prompts/（貼到任何生成工具用）
//   node 3kingdom-battles/tools/portraits.js import <id> <圖.png> --model "…" --source "…" --license "…" [--mood m] [--seed n] [--date YYYY-MM-DD]
//                                                                    手動生成的圖片入庫：檢查 PNG 1024×1024、改成規定檔名、寫入生成紀錄
//   node 3kingdom-battles/tools/portraits.js gen <id,id…> [--n 1]   用 OpenAI 圖片 API 直接生成（需要 OPENAI_API_KEY，模型用 PORTRAIT_MODEL，預設 gpt-image-1）
//   node 3kingdom-battles/tools/portraits.js check                  檢查人物資料、檔名、圖片規格與紀錄（測試也會跑）
//   node 3kingdom-battles/tools/portraits.js sheet                  產生縮小辨識度對照表 assets/portraits/sheet.html（＋ sheet.png）
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..'), DIR = path.join(ROOT, 'assets', 'portraits'), LOG = path.join(DIR, 'log.json');
require(path.join(DIR, 'characters.js')); require(path.join(ROOT, 'js', 'data.js')); require(path.join(ROOT, 'js', 'portraits.js'));
const A = globalThis.PORTRAIT_ART, D = globalThis.DATA, P = globalThis.PORTRAITS;

const args = process.argv.slice(2), cmd = args[0];
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
const readLog = () => JSON.parse(fs.readFileSync(LOG, 'utf8'));
const byId = id => { const c = A.CHARACTERS.find(x => x.id === id); if (!c) throw new Error('沒有這個人物：' + id); return c; };
const fileOf = (ch, mood) => mood && mood !== 'default' ? `${ch.id}__${mood}.png` : ch.file;
const moodSpec = (ch, mood) => mood && mood !== 'default' ? (ch.moods && ch.moods[mood]) || { expression: (P.MOODS[ch.id] && P.MOODS[ch.id][mood] || {}).name } : null;

// 讀 PNG 尺寸（IHDR）
function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47 || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
function writeRecord(rec) { const L = readLog(); L.push(rec); fs.writeFileSync(LOG, JSON.stringify(L, null, 2) + '\n'); }
const today = () => new Date().toISOString().slice(0, 10);

function prompts() {
  const ids = args[1] ? args[1].split(',') : A.CHARACTERS.map(c => c.id);
  const out = path.join(DIR, 'prompts'); fs.mkdirSync(out, { recursive: true });
  for (const id of ids) {
    const ch = byId(id), p = A.buildPrompt(ch);
    fs.writeFileSync(path.join(out, `${id}.txt`), `# ${ch.name}（${id}）模板 ${p.template}｜檔名 ${ch.file}\n\n## Prompt\n${p.positive}\n\n## Negative prompt\n${p.negative}\n`);
    console.log(`${id}.txt`);
  }
}

function importImage() {
  const [, id, src] = args; const ch = byId(id); const mood = opt('mood');
  const need = ['model', 'source', 'license'].filter(k => !opt(k));
  if (!src || need.length) throw new Error('用法：import <id> <圖.png> --model … --source … --license …（缺 ' + need.join('、') + '）');
  const buf = fs.readFileSync(src), sz = pngSize(buf);
  if (!sz) throw new Error('不是 PNG：' + src);
  if (sz.w !== 1024 || sz.h !== 1024) throw new Error(`尺寸要 1024×1024，這張是 ${sz.w}×${sz.h}`);
  const file = fileOf(ch, mood); fs.writeFileSync(path.join(DIR, file), buf);
  const p = A.buildPrompt(ch, moodSpec(ch, mood));
  writeRecord({ id, mood: mood || 'default', file, date: opt('date') || today(), provider: opt('provider') || 'manual', model: opt('model'), seed: opt('seed') || null, template: p.template, prompt: opt('prompt') || p.positive, negative: p.negative, source: opt('source'), license: opt('license'), sha256: crypto.createHash('sha256').update(buf).digest('hex') });
  console.log(`已存成 assets/portraits/${file}，並寫入生成紀錄。審核後把 characters.js 裡 ${id} 的 status 改成 'approved' 才會在遊戲出現。`);
}

async function gen() {
  const key = process.env.OPENAI_API_KEY; if (!key) throw new Error('沒有 OPENAI_API_KEY');
  const model = process.env.PORTRAIT_MODEL || 'gpt-image-1', n = +(opt('n') || 1);
  const out = path.join(DIR, 'candidates'); fs.mkdirSync(out, { recursive: true });
  for (const id of (args[1] || '').split(',').filter(Boolean)) {
    const ch = byId(id), p = A.buildPrompt(ch);
    const prompt = `${p.positive}\nAvoid: ${p.negative}.`;
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, prompt, size: '1024x1024', n, quality: 'high' }),
    });
    if (!res.ok) throw new Error(`${id}：API 錯誤 ${res.status} ${await res.text()}`);
    const j = await res.json();
    j.data.forEach((d, i) => {
      const f = path.join(out, `${id}-${Date.now()}-${i}.png`); fs.writeFileSync(f, Buffer.from(d.b64_json, 'base64'));
      fs.writeFileSync(f.replace(/\.png$/, '.json'), JSON.stringify({ id, date: today(), provider: 'openai', model, prompt, template: p.template, source: 'generated from text prompt only, no reference images', license: 'see provider terms (pre-launch check)' }, null, 2));
      console.log('候選圖：' + path.relative(ROOT, f));
    });
  }
  console.log('挑選後用 import 入庫（候選圖資料夾不進版控）。');
}

// 檢查：回傳錯誤清單（測試也會呼叫）
function check() {
  const errs = [], warns = [], L = readLog(), ids = new Set();
  const OUTSIDE = ['zhangfei', 'zhugeliang', 'zhaoyun']; // 還沒進遊戲的人物
  for (const ch of A.CHARACTERS) {
    if (ids.has(ch.id)) errs.push('重複的 id：' + ch.id); ids.add(ch.id);
    if (!D.GENERALS[ch.id] && !OUTSIDE.includes(ch.id)) errs.push(`${ch.id} 不在 GENERALS，遊戲會對不到`);
    if (D.GENERALS[ch.id] && D.GENERALS[ch.id].name !== ch.name) errs.push(`${ch.id} 名字不一致：${ch.name} ≠ ${D.GENERALS[ch.id].name}`);
    const entries = [['default', ch.file, ch.status], ...Object.entries(ch.moods || {}).map(([m, v]) => [m, v.file, v.status])];
    for (const [mood, file, status] of entries) {
      if (file !== fileOf(ch, mood)) errs.push(`${ch.id}/${mood} 檔名應為 ${fileOf(ch, mood)}，不是 ${file}`);
      if (mood !== 'default' && !(P.MOODS[ch.id] && P.MOODS[ch.id][mood])) errs.push(`${ch.id} 沒有 ${mood} 這種情緒（js/portraits.js MOODS）`);
      if (!['planned', 'generated', 'approved', 'rejected'].includes(status)) errs.push(`${ch.id}/${mood} 狀態不明：${status}`);
      const f = path.join(DIR, file), exists = fs.existsSync(f);
      if (status === 'approved' || status === 'generated') {
        if (!exists) { errs.push(`${file} 標成 ${status} 但檔案不存在`); continue; }
        const buf = fs.readFileSync(f), sz = pngSize(buf);
        if (!sz) errs.push(`${file} 不是 PNG`); else if (sz.w !== 1024 || sz.h !== 1024) errs.push(`${file} 是 ${sz.w}×${sz.h}，應為 1024×1024`);
        const rec = L.filter(r => r.file === file).pop();
        if (!rec) errs.push(`${file} 沒有生成紀錄（log.json）`);
        else {
          for (const k of ['date', 'model', 'prompt', 'source', 'license']) if (!rec[k]) errs.push(`${file} 紀錄缺 ${k}`);
          if (rec.sha256 && rec.sha256 !== crypto.createHash('sha256').update(buf).digest('hex')) errs.push(`${file} 和紀錄的 sha256 不同（圖片被換過卻沒重新入庫）`);
        }
      } else if (exists) warns.push(`${file} 存在但狀態是 ${status}，遊戲不會載入`);
    }
  }
  const known = new Set(A.CHARACTERS.flatMap(ch => [ch.file, ...Object.values(ch.moods || {}).map(m => m.file)]));
  for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.png') && f !== 'sheet.png')) if (!known.has(f)) errs.push(`${f} 沒有對應的人物資料（檔名規則：<id>.png 或 <id>__<情緒>.png）`);
  return { errs, warns };
}

async function sheet() {
  const sizes = [256, 96, 72, 52, 32];
  const rows = A.CHARACTERS.map(ch => {
    const f = fs.existsSync(path.join(DIR, ch.file)) ? ch.file : null;
    const cell = s => f ? `<img src="${f}" width="${s}" height="${s}">` : (D.GENERALS[ch.id] ? P.svg(ch.id, 'default', { side: ch.side }).replace('<svg', `<svg width="${s}" height="${s}"`) : `<div class="na" style="width:${s}px;height:${s}px">—</div>`);
    return `<tr><th>${ch.name}<small>${ch.id}<br>${ch.status}${f ? '' : '（SVG）'}</small></th>${sizes.map(s => `<td>${cell(s)}</td>`).join('')}</tr>`;
  }).join('');
  const html = `<!doctype html><meta charset="utf-8"><title>頭像縮小對照</title><style>body{background:#2b2118;color:#f5e9d3;font:13px sans-serif}td,th{padding:6px;text-align:center;vertical-align:middle}th small{display:block;color:#c9b79a;font-weight:normal}.na{background:#3a2d20;display:inline-flex;align-items:center;justify-content:center}</style>
<table><tr><th></th>${sizes.map(s => `<th>${s}px</th>`).join('')}</tr>${rows}</table>`;
  fs.writeFileSync(path.join(DIR, 'sheet.html'), html);
  try {
    const { loadPlaywright } = require(path.join(ROOT, 'tests', 'lib.js')); const { chromium } = loadPlaywright();
    const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 760, height: 600 } });
    await pg.goto('file://' + path.join(DIR, 'sheet.html')); await pg.screenshot({ path: path.join(DIR, 'sheet.png'), fullPage: true }); await b.close();
    console.log('assets/portraits/sheet.html、sheet.png');
  } catch (e) { console.log('assets/portraits/sheet.html（沒有 Playwright，略過截圖）'); }
}

if (require.main === module) (async () => {
  if (cmd === 'prompts') prompts();
  else if (cmd === 'import') importImage();
  else if (cmd === 'gen') await gen();
  else if (cmd === 'sheet') await sheet();
  else if (cmd === 'check') {
    const { errs, warns } = check();
    warns.forEach(w => console.log('⚠ ' + w)); errs.forEach(e => console.log('✗ ' + e));
    console.log(errs.length ? `${errs.length} 個錯誤` : `通過：${A.CHARACTERS.length} 位人物，${A.CHARACTERS.filter(c => c.status === 'approved').length} 張已審核`);
    process.exit(errs.length ? 1 : 0);
  } else console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 9).join('\n'));
})().catch(e => { console.error('錯誤：' + e.message); process.exit(1); });

module.exports = { check };
