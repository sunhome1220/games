#!/usr/bin/env python3
"""改版時執行：python3 pullback-rush/tools/bump_version.py 2026-10-23.02
更新 js/version.js 的 VERSION，並同步 index.html 內各檔案的 ?v= 參數。
玩家開著的頁面會定期抓 js/version.js 比對，有新版就提示重新整理。"""
import re, sys, pathlib
v = sys.argv[1] if len(sys.argv) > 1 else None
if not v: sys.exit(__doc__)
root = pathlib.Path(__file__).resolve().parent.parent
ver = root / 'js' / 'version.js'
t = ver.read_text(encoding='utf-8')
t, n = re.subn(r"^const VERSION = '[^']+'", f"const VERSION = '{v}'", t, flags=re.M)
if n != 1: sys.exit('找不到 VERSION')
ver.write_text(t, encoding='utf-8')
h = root / 'index.html'
t = h.read_text(encoding='utf-8')
t, n = re.subn(r'((?:src|href)="(?:js|css)/[^"?]+)(?:\?v=[^"]*)?"', rf'\1?v={v}"', t)
h.write_text(t, encoding='utf-8')
print('VERSION =', v, f'（更新 {n} 個檔案參數）')
