#!/usr/bin/env python3
"""改版時執行：python3 tools/bump_version.py 2026-10-19.02
同步更新 js/version.js 的 VERSION 與 index.html 各 <script> 的 ?v= 快取參數。"""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
v = sys.argv[1] if len(sys.argv) > 1 else None
if not v: sys.exit(__doc__)
p = root / 'js/version.js'
p.write_text(re.sub(r"const VERSION = '[^']+'", f"const VERSION = '{v}'", p.read_text(encoding='utf-8')), encoding='utf-8')
h = root / 'index.html'
h.write_text(re.sub(r'(\.(?:js|css))\?v=[^"]*', r'\g<1>?v=' + v, h.read_text(encoding='utf-8')), encoding='utf-8')
print('VERSION =', v)
