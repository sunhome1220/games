#!/usr/bin/env python3
"""從 Natural Earth 1:10m（world-atlas 套件的 countries-10m.json，公有領域）抽出台灣本島與澎湖群島的海岸線，簡化後寫成 js/geo.js。
用法：npm pack world-atlas@2.0.2 && tar xzf world-atlas-2.0.2.tgz
      python3 tools/geo/build_geo.py package/countries-10m.json
簡化容許誤差 TOL（度，約 0.005°≈0.5 km）：遠小於 10 km 一格，換成更細的格子也夠用。"""
import json, sys, math, pathlib
TOL = 0.005
src = json.load(open(sys.argv[1]))
tr = src['transform']; sx, sy = tr['scale']; tx, ty = tr['translate']
arcs = []
for a in src['arcs']:
    x = y = 0; pts = []
    for dx, dy in a:
        x += dx; y += dy; pts.append((x * sx + tx, y * sy + ty))
    arcs.append(pts)
def ring(idx):
    out = []
    for i in idx:
        p = arcs[i] if i >= 0 else arcs[~i][::-1]
        out.extend(p if not out else p[1:])
    return out
tw = next(g for g in src['objects']['countries']['geometries'] if g.get('properties', {}).get('name') == 'Taiwan')
polys = [ring(p[0]) for p in tw['arcs']]  # 只取外環
def dp(pts, tol):  # Douglas–Peucker
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; dmax = 0; k = 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        if a == b: d = math.hypot(px - a[0], py - a[1])
        else: d = abs((b[1]-a[1])*px - (b[0]-a[0])*py + b[0]*a[1] - b[1]*a[0]) / math.hypot(b[1]-a[1], b[0]-a[0])
        if d > dmax: dmax, k = d, i
    if dmax <= tol: return [a, b]
    return dp(pts[:k+1], tol)[:-1] + dp(pts[k:], tol)
def bbox(p): xs = [q[0] for q in p]; ys = [q[1] for q in p]; return min(xs), min(ys), max(xs), max(ys)
main = max(polys, key=lambda p: len(p))
ph = [p for p in polys if (lambda b: 119.2 < b[0] and b[2] < 119.9 and 23.0 < b[1] and b[3] < 23.9)(bbox(p))]
fmt = lambda p: '[' + ','.join('[%.3f,%.3f]' % q for q in dp(p, TOL)) + ']'
out = ("'use strict';\n// 台灣本島與澎湖群島的海岸線（經緯度）：Natural Earth 1:10m（公有領域），經 tools/geo/build_geo.py 簡化（誤差約 0.5 km）。不要手改。\n"
       "const GEO_TW=" + fmt(main) + ";\n"
       "const GEO_PH=[" + ','.join(fmt(p) for p in ph) + "];\n")
pathlib.Path(__file__).resolve().parent.parent.parent.joinpath('js', 'geo.js').write_text(out, encoding='utf-8')
print('Taiwan main pts', len(main), '->', len(dp(main, TOL)), '; Penghu islands', len(ph), [len(dp(p, TOL)) for p in ph], '; other polys', len(polys) - 1 - len(ph))
