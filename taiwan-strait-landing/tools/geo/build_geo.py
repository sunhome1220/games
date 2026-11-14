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
# ---- 大陸沿岸（含沿岸島嶼）、金門、琉球諸島：裁切到遊戲格範圍（約 116.2～129°E、20.3～26.7°N）----
BB = (116.2, 20.3, 129.0, 26.7)
def clip(poly, bb):  # Sutherland–Hodgman：多邊形裁切到矩形
    x0, y0, x1, y1 = bb
    def cut(pts, inside, inter):
        out = []
        for i in range(len(pts)):
            a, b = pts[i - 1], pts[i]
            if inside(b):
                if not inside(a): out.append(inter(a, b))
                out.append(b)
            elif inside(a): out.append(inter(a, b))
        return out
    ix = lambda X: (lambda a, b: (X, a[1] + (b[1] - a[1]) * (X - a[0]) / (b[0] - a[0])))
    iy = lambda Y: (lambda a, b: (a[0] + (b[0] - a[0]) * (Y - a[1]) / (b[1] - a[1]), Y))
    pts = poly
    for inside, inter in ((lambda p: p[0] >= x0, ix(x0)), (lambda p: p[0] <= x1, ix(x1)), (lambda p: p[1] >= y0, iy(y0)), (lambda p: p[1] <= y1, iy(y1))):
        if not pts: break
        pts = cut(pts, inside, inter)
    return pts
def country(name):
    g = next(x for x in src['objects']['countries']['geometries'] if x.get('properties', {}).get('name') == name)
    return [ring(p[0]) for p in (g['arcs'] if g['type'] == 'MultiPolygon' else [g['arcs']])]
inbb = lambda p: any(BB[0] <= x <= BB[2] and BB[1] <= y <= BB[3] for x, y in p)
cn = [q for q in (clip(p, BB) for p in country('China') if inbb(p)) if len(q) >= 3]
km = [p for p in polys if (lambda b: 118.1 < b[0] and b[2] < 118.6 and 24.3 < b[1] and b[3] < 24.6)(bbox(p))]  # 金門（大金門、小金門）
senkaku = lambda b: 123.3 < b[0] and b[2] < 124.0 and 25.5 < b[1] and b[3] < 26.1  # 釣魚台列嶼：遊戲原本就不畫，排除
jp = [q for q in (clip(p, BB) for p in country('Japan') if inbb(p) and not senkaku(bbox(p))) if len(q) >= 3]
out = ("'use strict';\n// 台灣本島與澎湖群島的海岸線（經緯度）：Natural Earth 1:10m（公有領域），經 tools/geo/build_geo.py 簡化（誤差約 0.5 km）。不要手改。\n"
       "const GEO_TW=" + fmt(main) + ";\n"
       "const GEO_PH=[" + ','.join(fmt(p) for p in ph) + "];\n"
       "// 大陸沿岸（含沿岸島嶼）、金門、琉球諸島（已裁切到遊戲格範圍；釣魚台列嶼不畫；馬祖太小，Natural Earth 1:10m 沒有收錄）\n"
       "const GEO_CN=[" + ','.join(fmt(p) for p in cn) + "];\n"
       "const GEO_KM=[" + ','.join(fmt(p) for p in km) + "];\n"
       "const GEO_JP=[" + ','.join(fmt(p) for p in jp) + "];\n")
pathlib.Path(__file__).resolve().parent.parent.parent.joinpath('js', 'geo.js').write_text(out, encoding='utf-8')
print('CN polys', len(cn), [len(dp(p, TOL)) for p in cn][:5], 'KM', len(km), 'JP', len(jp)); print('Taiwan main pts', len(main), '->', len(dp(main, TOL)), '; Penghu islands', len(ph), [len(dp(p, TOL)) for p in ph], '; other polys', len(polys) - 1 - len(ph))
