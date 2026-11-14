#!/usr/bin/env python3
"""Build the i18n dictionary js/dict.js (loaded by index.html before the other scripts).
Inputs: segs.json (source Chinese segments, indexed), c*.tsv (idx<TAB>en<TAB>ja), extras.tsv (key<TAB>en<TAB>ja).
(Write ∅ in the ja column for a deliberately empty Japanese text.)
The ja column may be left empty (or omitted): the Japanese UI then shows the English text instead of Chinese, and the key is listed in ja_todo.txt for a later batch translation.
zh-CN: character map (OpenCC t2s) + phrase overrides where phrase conversion differs from char-by-char.
Usage: python3 build_dict.py   (needs: pip install opencc-python-reimplemented)"""
import json, glob, os, re, sys
import opencc
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(here, '..', '..')
out = os.path.join(root, 'js', 'dict.js')
# 簡體字表要涵蓋頁面與所有程式檔裡出現的字（含現有的 dict.js，與單檔時期掃整份 index.html 的範圍相同）
pages = [os.path.join(root, 'index.html')] + sorted(glob.glob(os.path.join(root, 'js', '*.js')))
segs = json.load(open(os.path.join(here, 'segs.json'), encoding='utf-8'))
OVR = {811: (' ×10k', ' 万'), 812: ('', '人'), 813: ('', '人')}
def clean(k):
    if k[:1] in '">' or k.startswith('" '):
        m = re.search(r'(?:">|="|>)(?!.*(?:">|="|>))(.*)$', k, re.S)
        return m.group(1) if m else k
    return k
en, ja, missing = {}, {}, []
rows = {}
for f in sorted(glob.glob(os.path.join(here, 'c0*.tsv'))):
    lines = open(f, encoding='utf-8').read().split('\n')
    for ln in lines:
        if not ln.strip('\n'): continue
        parts = ln.split('\t')
        if len(parts) < 2 or not parts[0].isdigit():
            print('BAD LINE', f, repr(ln[:60])); sys.exit(1)
        rows[int(parts[0])] = (parts[1], parts[2] if len(parts) > 2 else '')
for i, sg in enumerate(segs):
    if i not in rows: missing.append(i); continue
    e, j = OVR.get(i, rows[i])
    k = clean(sg)
    en.setdefault(k, e); ja.setdefault(k, j)
for ln in open(os.path.join(here, 'extras.tsv'), encoding='utf-8').read().split('\n'):
    if ln.strip():
        p = ln.split('\t'); k, e, j = p[0], p[1], (p[2] if len(p) > 2 else ''); en[k] = e; ja[k] = j
if missing: print('MISSING', missing[:20], len(missing)); sys.exit(1)
# 日文缺字（第三欄空白或沒有）時，顯示英文，不要顯示中文；待補清單寫到 ja_todo.txt，累積後再一起補譯
todo = [(k, en[k]) for k in en if not ja[k].strip() and en[k].strip()]
for k, e in todo: ja[k] = e
for k in ja:
    if ja[k] == '∅': ja[k] = ''  # 「∅」＝日文刻意留空（不是缺字）
open(os.path.join(here, 'ja_todo.txt'), 'w', encoding='utf-8').write(''.join(k + '\t' + e + '\n' for k, e in todo))
print('ja fallback to English:', len(todo), '(see ja_todo.txt)')
cc = opencc.OpenCC('t2s'); cp = opencc.OpenCC('tw2sp')
allc = set()
for sg in list(en.keys()) + [open(p, encoding='utf-8').read() for p in pages]:
    allc.update(c for c in sg if '㐀' <= c <= '鿿')
frm, to = [], []
for c in sorted(allc):
    s = cc.convert(c)
    if s != c: frm.append(c); to.append(s)
cmap = dict(zip(frm, to))
phr = {}
for k in en:
    a = cp.convert(k); b = ''.join(cmap.get(c, c) for c in k)
    if a != b: phr[k] = a
d = {'en': en, 'ja': ja}
body = ('window.TSL_DICT=' + json.dumps(d, ensure_ascii=False, separators=(',', ':')) +
        ';window.TSL_CN=' + json.dumps(''.join(frm), ensure_ascii=False) + ';window.TSL_CNS=' + json.dumps(''.join(to), ensure_ascii=False) +
        ';window.TSL_CNP=' + json.dumps(phr, ensure_ascii=False, separators=(',', ':')) + ';').replace('</', '<\\/')
open(out, 'w', encoding='utf-8').write(body + '\n')
print('keys', len(en), 'cn chars', len(frm), 'phrases', len(phr), 'bytes', len(body))
