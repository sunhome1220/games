#!/usr/bin/env python3
"""Build the i18n dictionary embedded in index.html (<script id="tsl-dict">).
Inputs: segs.json (source Chinese segments, indexed), c*.tsv (idx<TAB>en<TAB>ja), extras.tsv (key<TAB>en<TAB>ja).
zh-CN: character map (OpenCC t2s) + phrase overrides where phrase conversion differs from char-by-char.
Usage: python3 build_dict.py   (needs: pip install opencc-python-reimplemented)"""
import json, glob, os, re, sys
import opencc
here = os.path.dirname(os.path.abspath(__file__))
page = os.path.join(here, '..', '..', 'index.html')
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
        if len(parts) < 3 or not parts[0].isdigit():
            print('BAD LINE', f, repr(ln[:60])); sys.exit(1)
        rows[int(parts[0])] = (parts[1], parts[2])
for i, sg in enumerate(segs):
    if i not in rows: missing.append(i); continue
    e, j = OVR.get(i, rows[i])
    k = clean(sg)
    en.setdefault(k, e); ja.setdefault(k, j)
for ln in open(os.path.join(here, 'extras.tsv'), encoding='utf-8').read().split('\n'):
    if ln.strip():
        k, e, j = ln.split('\t'); en[k] = e; ja[k] = j
if missing: print('MISSING', missing[:20], len(missing)); sys.exit(1)
cc = opencc.OpenCC('t2s'); cp = opencc.OpenCC('tw2sp')
allc = set()
for sg in list(en.keys()) + [open(page, encoding='utf-8').read()]:
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
blob = '<script id="tsl-dict">' + body + '</script>'
s = open(page, encoding='utf-8').read()
s2, n = re.subn(r'<script id="tsl-dict">.*?</script>', lambda m: blob, s, count=1, flags=re.S)
assert n == 1
open(page, 'w', encoding='utf-8').write(s2)
print('keys', len(en), 'cn chars', len(frm), 'phrases', len(phr), 'bytes', len(blob))
