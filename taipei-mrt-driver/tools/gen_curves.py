#!/usr/bin/env python3
"""由 data/osm_routes_raw.json（OpenStreetMap 路線關係的軌道幾何，2026-11 擷取，© OpenStreetMap contributors，ODbL）
算出每條路線的平面形狀與彎道，輸出 data/curves.json，供 js/lines.js 與路線圖使用。
用法：python3 taipei-mrt-driver/tools/gen_curves.py
【推估】彎道限速 = sqrt(橫向加速度 × 半徑)，橫向加速度取 1.0 m/s²（舒適上限的常見值），不是北捷公布的彎道限速。
【推估】軌道弧長依各線站距總和等比例縮放，與遊戲的站位對齊；各站在地圖上的實際位置有數十公尺誤差。"""
import json, math, pathlib
H = pathlib.Path(__file__).resolve().parent.parent
raw = json.load(open(H/'data/osm_routes_raw.json'))
stj = json.load(open(H/'data/stations.json'))
REL = {5633242: 'red', 9437776: 'blue', 4250357: 'green', 447449: 'brown'}
REVERSE = {'brown'}          # OSM 路線方向與遊戲站序相反的路線
A_LAT = 1.0                   # m/s²
def hav(a, b):
    R = 6371000; p1, p2 = math.radians(a[0]), math.radians(b[0]); dl = math.radians(b[1]-a[1]); dp = p2-p1
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(h))
def chain(ways):
    segs = [[(p['lat'], p['lon']) for p in w['geometry']] for w in ways]
    used = [False]*len(segs); c = list(segs[0]); used[0] = True; ch = True
    while ch:
        ch = False
        for i, s in enumerate(segs):
            if used[i]: continue
            if hav(c[-1], s[0]) < 3: c += s[1:]
            elif hav(c[-1], s[-1]) < 3: c += s[::-1][1:]
            elif hav(c[0], s[-1]) < 3: c = s[:-1] + c
            elif hav(c[0], s[0]) < 3: c = s[::-1][:-1] + c
            else: continue
            used[i] = True; ch = True
    assert all(used), '有 way 無法串接'
    return c
def resample(pts, step):
    cum = [0.0]
    for i in range(len(pts)-1): cum.append(cum[-1]+hav(pts[i], pts[i+1]))
    n = int(cum[-1]//step)+1; out = []; j = 0
    for k in range(n+1):
        s = min(k*step, cum[-1])
        while j < len(pts)-2 and cum[j+1] < s: j += 1
        t = (s-cum[j])/max(cum[j+1]-cum[j], 1e-9)
        out.append((pts[j][0]+(pts[j+1][0]-pts[j][0])*t, pts[j][1]+(pts[j+1][1]-pts[j][1])*t))
    return out, cum[-1]
out = {'_source': 'OpenStreetMap 路線關係的軌道幾何（© OpenStreetMap contributors，ODbL，2026-11 擷取）；彎道限速為依半徑推估，非官方', 'lines': {}}
for e in raw['elements']:
    key = REL.get(e['id'])
    if not key: continue
    pts = chain([m for m in e['members'] if m['type'] == 'way' and 'geometry' in m])
    if key in REVERSE: pts = pts[::-1]
    gt = sum((x['dist_km'] or 0) for x in stj[key])*1000      # 遊戲的站距總和（公尺）
    # 紅線：遊戲起點 R01 廣慈/奉天宮（延伸段）不在 OSM 路線內，OSM 路線從象山起；其餘線的起訖與遊戲一致
    skip = (stj[key][1]['dist_km'] or 0)*1000 if key == 'red' else 0
    pts25, L = resample(pts, 25)
    scale = (gt-skip)/L
    lat0 = pts25[0][0]; kx = 111320*math.cos(math.radians(lat0)); ky = 110540
    xy = [((p[1]-pts25[0][1])*kx, (p[0]-pts25[0][0])*ky) for p in pts25]
    head = [math.atan2(xy[i+1][1]-xy[i][1], xy[i+1][0]-xy[i][0]) for i in range(len(xy)-1)]
    # 100 m 窗口的轉角 → 半徑；平滑後找出彎道（R<1000 m）
    W = 4; rad = []
    for i in range(len(head)-W):
        d = head[i+W]-head[i]; d = (d+math.pi) % (2*math.pi)-math.pi
        rad.append((i*25, d))
    curves = []; cur = None
    for s, d in rad:
        R = (W*25)/max(abs(d), 1e-6)
        if R < 1000:
            sg = 1 if d > 0 else -1          # + 為左轉（逆時針）
            if cur and cur['sg'] == sg and s-cur['e'] <= 50: cur['e'] = s+W*25; cur['Rs'].append(R)
            else:
                if cur: curves.append(cur)
                cur = {'sg': sg, 's': s, 'e': s+W*25, 'Rs': [R]}
        elif cur and s-cur['e'] > 50: curves.append(cur); cur = None
    if cur: curves.append(cur)
    res = []
    for c in curves:
        R = min(c['Rs']); length = c['e']-c['s']
        if length < 100: continue
        lim = math.sqrt(A_LAT*R)*3.6
        res.append({'s0': round((c['s'])*scale+skip), 's1': round(c['e']*scale+skip), 'dir': 'L' if c['sg'] > 0 else 'R', 'R': round(R), 'lim': int(lim//5*5)})
    # 平面形狀：每 25 m 一點（相對起點的公尺座標，x 東、y 北）
    shape = [[round(xy[i][0]), round(xy[i][1])] for i in range(0, len(xy))]    # 每 25 m 一點（3D 軌道轉彎需要較細的形狀）
    out['lines'][key] = {'len_osm': round(L), 'len_game': round(gt), 'skip': round(skip), 'scale': round(scale, 4), 'shape': shape, 'step': 25, 'curves': res}
    print(key, 'OSM %.1f km / 遊戲 %.1f km, 縮放 %.3f, 彎道 %d 個, 半徑最小 %s m' % (L/1000, gt/1000, scale, len(res), min([c['R'] for c in res], default='-')))
json.dump(out, open(H/'data/curves.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('data/curves.json', (H/'data/curves.json').stat().st_size, 'bytes')
