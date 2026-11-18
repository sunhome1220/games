#!/usr/bin/env python3
"""改版時執行：python3 taiwan-strait-landing/tools/bump_version.py 2026-11-02.02
更新 js/version.js 的 VERSION（頁面會定期抓這個檔案比對，有新版就提示玩家重新整理），
並同步 index.html 裡每個 js 檔的 ?v= 快取參數，以及給舊版（單檔時期）頁面比對用的那一行註解。"""
import re, sys, pathlib
v = sys.argv[1] if len(sys.argv) > 1 else None
if not v: sys.exit(__doc__)
root = pathlib.Path(__file__).resolve().parent.parent
f = root / 'js' / 'version.js'
t = f.read_text(encoding='utf-8')
t, n = re.subn(r"^const VERSION='[^']+'", f"const VERSION='{v}'", t, flags=re.M)
if n != 1: sys.exit('找不到 VERSION')
f.write_text(t, encoding='utf-8')
h = root / 'index.html'
t = h.read_text(encoding='utf-8')
t, n = re.subn(r'(<script src="js/(?:[\w-]+/)?[\w-]+\.js)\?v=[^"]*"', lambda m: m.group(1) + '?v=' + v + '"', t)
if n < 1: sys.exit('index.html 裡找不到 js 檔的 ?v= 參數')
t, m = re.subn(r"const VERSION='[^']+'", f"const VERSION='{v}'", t)
if m != 1: sys.exit('index.html 裡找不到給舊版頁面比對用的 VERSION 註解')
if re.search(r'<script src="js/[^"?]+"', t): sys.exit('index.html 裡有 js 檔沒有 ?v= 參數')
h.write_text(t, encoding='utf-8')
print('VERSION =', v, '（index.html 更新了', n, '個 js 檔的快取參數）')
# 更新日誌只留最近 15 版在 js/core/changelog.js，多的搬到 changelog_old.js（要看全部時才載入）
KEEP = 15
cf, of = root / 'js' / 'core' / 'changelog.js', root / 'js' / 'core' / 'changelog_old.js'
L = cf.read_text(encoding='utf-8').split('\n')
a = next(i for i, l in enumerate(L) if l.startswith('const CHANGELOG=['))
b = next(i for i, l in enumerate(L) if l == '];')
ents = L[a + 1:b]
if len(ents) > KEEP:
    if not all(re.match(r'\s*\{v:', l) for l in ents): sys.exit('changelog.js 有跨行的條目，請維持一版一行')
    cf.write_text('\n'.join(L[:a + 1] + ents[:KEEP] + L[b:]), encoding='utf-8')
    O = of.read_text(encoding='utf-8').split('\n'); k = next(i for i, l in enumerate(O) if l.startswith('const CHANGELOG_OLD_DATA=['))
    of.write_text('\n'.join(O[:k + 1] + ents[KEEP:] + O[k + 1:]), encoding='utf-8')
    print('更新日誌超過', KEEP, '版，舊的', len(ents) - KEEP, '版移到 changelog_old.js')
