#!/usr/bin/env python3
"""改版時執行：python3 pikmin-like/tools/bump_version.py 2026-10-23.02
更新 index.html 內的 VERSION（頁面會定期抓自己比對，有新版就提示玩家重新整理）。"""
import re, sys, pathlib
v = sys.argv[1] if len(sys.argv) > 1 else None
if not v: sys.exit(__doc__)
h = pathlib.Path(__file__).resolve().parent.parent / 'index.html'
t = h.read_text(encoding='utf-8')
t, n = re.subn(r"^const VERSION='[^']+'", f"const VERSION='{v}'", t, flags=re.M)
if n != 1: sys.exit('找不到 VERSION')
h.write_text(t, encoding='utf-8')
print('VERSION =', v)
