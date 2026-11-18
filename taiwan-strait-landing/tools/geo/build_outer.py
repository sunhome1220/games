#!/usr/bin/env python3
"""外圍示意區用的真實地理資料：大陸陸地輪廓、河流、湖泊 → js/data/outer.js
來源：Natural Earth 1:10m（公有領域）的 ne_10m_land、ne_10m_rivers_lake_centerlines、ne_10m_lakes（geojson，
     取自 https://github.com/nvkelso/natural-earth-vector/tree/master/geojson）。
用法：python3 tools/geo/build_outer.py <land.geojson> <rivers.geojson> <lakes.geojson>
範圍 BB 略大於外圍示意區（約 113.6～129.7°E、17.4～32.3°N；範圍定義在 js/core/map.js 的 oMX0／oMX1／oMY0／oMY1）。簡化容許誤差 TOL（度）。"""
import json, sys, math, pathlib
BB = (113.5, 17.3, 129.8, 32.4)
TOL = 0.01
def dp(pts, tol):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; dmax = 0; k = 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        d = math.hypot(px - a[0], py - a[1]) if a == b else abs((b[1]-a[1])*px - (b[0]-a[0])*py + b[0]*a[1] - b[1]*a[0]) / math.hypot(b[1]-a[1], b[0]-a[0])
        if d > dmax: dmax, k = d, i
    if dmax <= tol: return [a, b]
    return dp(pts[:k+1], tol)[:-1] + dp(pts[k:], tol)
def clip(poly, bb):  # Sutherland–Hodgman
    def edge(pts, inside, inter):
        out = []
        for i in range(len(pts)):
            a, b = pts[i - 1], pts[i]
            if inside(b):
                if not inside(a): out.append(inter(a, b))
                out.append(b)
            elif inside(a): out.append(inter(a, b))
        return out
    x0, y0, x1, y1 = bb
    ix = lambda x: (lambda a, b: (x, a[1] + (b[1]-a[1])*(x-a[0])/(b[0]-a[0])))
    iy = lambda y: (lambda a, b: (a[0] + (b[0]-a[0])*(y-a[1])/(b[1]-a[1]), y))
    for ins, it in ((lambda p: p[0] >= x0, ix(x0)), (lambda p: p[0] <= x1, ix(x1)), (lambda p: p[1] >= y0, iy(y0)), (lambda p: p[1] <= y1, iy(y1))):
        poly = edge(poly, ins, it)
        if not poly: return []
    return poly
fmt = lambda p: '[' + ','.join('[%.3f,%.3f]' % (x, y) for x, y in p) + ']'
inb = lambda x, y: BB[0] <= x <= BB[2] and BB[1] <= y <= BB[3]
# ---- 大陸陸地：與範圍相交、面積最大的那一塊（歐亞大陸）。其他島嶼沿用原本的示意畫法
land = json.load(open(sys.argv[1]))
best = None
for f in land['features']:
    g = f['geometry']; polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    for P in polys:
        ring = [tuple(q) for q in P[0]]
        xs = [q[0] for q in ring]; ys = [q[1] for q in ring]
        if min(xs) > -20 and max(xs) > 150 and min(ys) > -40 and len(ring) > 50000:  # 歐亞非大陸（含中國）
            best = ring
cl = clip(best, BB)
cl = dp(cl + [cl[0]], TOL)[:-1]
# ---- 河流：只取範圍內的名稱；方向統一成「第 0 點＝河口」
NAMES = {'Yangtze': ('長江', 'e'), 'Han': ('漢江', 'e'), 'Huai': ('淮河', 'e'), 'Fuchun': ('富春江', 'e'), 'Min': ('閩江', 'e'), 'Ou': ('甌江', 'e'), 'Jiulong': ('九龍江', 'e'), 'Dong': ('東江', 's'), 'Mei': ('梅江', 's'), 'Gan': ('贛江', 'n'), 'Cagayan': ('卡加延河', 'n')}
SEA = {'Yangtze', 'Min', 'Ou', 'Jiulong', 'Dong', 'Fuchun', 'Cagayan'}  # 河口在範圍內且通海（或通往河口）的河：繪圖時把河口對齊到海岸格的邊
YZ_LOWER = [(120.55, 31.97), (120.28, 31.97), (120.0, 32.05), (119.75, 32.12)]
# ★推估：長江張家港（120.55°E）以下河道寬 5 km 以上，一格（約 10 km）都畫不下細線，改成「水格」：沿近似中線（北支水道）、半寬（km）的帶狀範圍內的格子當水面，不再畫細線
YZ_WIDE = [(120.55, 31.97, 5), (120.85, 32.03, 5), (121.2, 31.99, 5), (121.6, 31.91, 5), (121.98, 31.83, 5)]
rv = json.load(open(sys.argv[2])); rivers = []
for f in rv['features']:
    nm = f['properties'].get('name')
    if nm not in NAMES: continue
    zh, mouth = NAMES[nm]; g = f['geometry']; lines = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
    for l in lines:
        pts = [tuple(q[:2]) for q in l if inb(q[0], q[1])]
        if len(pts) < 2: continue
        pts = dp(pts, TOL * 2)
        key = {'e': lambda p: -p[0], 's': lambda p: p[1], 'n': lambda p: -p[1]}[mouth]
        if key(pts[0]) > key(pts[-1]): pts = pts[::-1]
        if nm == 'Yangtze' and abs(pts[0][0] - 119.606) < 0.01:  # Natural Earth 的長江中心線只到鎮江（119.6°E），下游河口段沒有資料
            pts = YZ_LOWER + pts  # ★推估：依鎮江、江陰、張家港、南通、啟東的位置手畫的近似線（第 0 點在河口）
        rivers.append((zh, pts, 1 if nm in SEA else 0))
# ---- 湖泊
LAKEZH = {'Poyang Hu': '鄱陽湖', 'Tai Hu': '太湖', 'Chao Hu': '巢湖', 'Xinanjiang Shuiku': '新安江水庫', 'Xinfengjiang Shuiku': '新豐江水庫'}
lk = json.load(open(sys.argv[3])); lakes = []
for f in lk['features']:
    g = f['geometry']; polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    for P in polys:
        ring = [tuple(q[:2]) for q in P[0]]
        c2 = clip(ring[:-1], BB)
        if len(c2) >= 3: lakes.append((LAKEZH.get(f['properties'].get('name'), ''), dp(c2 + [c2[0]], TOL)[:-1] if len(c2) > 8 else c2))
out = ["'use strict';",
 "// 外圍示意區的真實地理資料：Natural Earth 1:10m（公有領域），由 tools/geo/build_outer.py 產生，不要手改。",
 'const OUTER_LAND=' + fmt(cl) + ';',
 'const OUTER_RIVERS=[' + ','.join('[%s,%s,%d]' % (json.dumps(n, ensure_ascii=False), fmt(p), z) for n, p, z in rivers) + '];',
 'const OUTER_WATER=' + json.dumps([list(q) for q in YZ_WIDE]) + ';',
 'const OUTER_LAKES=[' + ','.join('[%s,%s]' % (json.dumps(n, ensure_ascii=False), fmt(p)) for n, p in lakes) + '];', '']
pathlib.Path(__file__).resolve().parents[2].joinpath('js', 'data', 'outer.js').write_text('\n'.join(out), encoding='utf-8')
print(len(cl), 'land pts;', len(rivers), 'rivers;', len(lakes), 'lakes')
