#!/usr/bin/env python3
"""從 Natural Earth 1:10m 的都市區圖層（ne_10m_urban_areas，公有領域；依 MODIS 衛星影像判讀的建成區）
抽出台灣本島的都市區多邊形（含內部的非都市空洞），簡化後寫成 js/data/urban.js。
用法：下載 https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_urban_areas.geojson
      python3 tools/geo/build_urban.py ne_10m_urban_areas.geojson
簡化容許誤差 TOL（度，0.005°≈0.5 km）；面積小於 MIN_KM2 的多邊形與空洞略去（遠小於 10 km 一格）。"""
import json, sys, math, pathlib
TOL, MIN_KM2 = 0.005, 4
KX, KY = 101.0, 111.0  # 北緯 23.5° 附近每度的公里數
src = json.load(open(sys.argv[1]))
def area(r): return abs(sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1))) / 2 * KX * KY
def dp(pts, tol):  # Douglas–Peucker
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; dmax = 0; k = 0
    for i in range(1, len(pts) - 1):
        p = pts[i]; dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy)
        d = math.hypot(p[0] - a[0], p[1] - a[1]) if L == 0 else abs(dx * (a[1] - p[1]) - dy * (a[0] - p[0])) / L
        if d > dmax: dmax, k = d, i
    if dmax <= tol: return [a, b]
    return dp(pts[:k + 1], tol)[:-1] + dp(pts[k:], tol)
def simp(r):
    r = [tuple(p[:2]) for p in r]; m = len(r) // 2
    out = dp(r[:m + 1], TOL)[:-1] + dp(r[m:], TOL)
    return [[round(x, 3), round(y, 3)] for x, y in out[:-1]]
polys = []
for f in src['features']:
    g = f['geometry']
    for p in (g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]):
        o = p[0]; cx = sum(q[0] for q in o) / len(o); cy = sum(q[1] for q in o) / len(o)
        if not (119.9 < cx < 122.2 and 21.8 < cy < 25.4) or area(o) < MIN_KM2: continue
        rings = [simp(o)] + [simp(h) for h in p[1:] if area(h) >= MIN_KM2]
        polys.append((area(o), [r for r in rings if len(r) >= 3]))
polys.sort(key=lambda x: -x[0])
tot = sum(a for a, _ in polys)
out = "'use strict';\n// 台灣都市區（建成區）輪廓：Natural Earth 1:10m ne_10m_urban_areas（公有領域），由 tools/geo/build_urban.py 產生，不要手改。\n"
out += "// 每個多邊形＝[外環, 空洞…]，座標 [經度, 緯度]；共 %d 個、外環面積合計約 %d 平方公里。\n" % (len(polys), tot)
out += 'const GEO_URB=' + json.dumps([p for _, p in polys], separators=(',', ':')).replace(']],[[[', ']],\n[[[') + ';\n'
pathlib.Path(__file__).resolve().parents[2].joinpath('js/data/urban.js').write_text(out, encoding='utf-8')
print(len(polys), 'polygons', round(tot), 'km2', sum(len(r) for _, p in polys for r in p), 'points')
