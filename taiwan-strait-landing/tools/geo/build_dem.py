#!/usr/bin/env python3
"""台澎高程網格：用 SRTM（美國 NASA，公有領域；取自 AWS Terrain Tiles 的 skadi 圖磚 NxxEyyy.hgt.gz，1 角秒）
算出每 0.02°（約 2 km）網格的平均海拔，存成 js/dem.js（每點 1 位元組＝海拔÷20 公尺，base64）。
用法：下載 N21..N25 × E119..E121 的 .hgt.gz 到某個資料夾，再執行 python3 tools/geo/build_dem.py <資料夾>"""
import sys, gzip, base64, pathlib, numpy as np
src = pathlib.Path(sys.argv[1])
LON0, LON1, LAT0, LAT1, D = 119.3, 122.1, 21.8, 25.4, 0.02
W, H = round((LON1 - LON0) / D), round((LAT1 - LAT0) / D)
N = 3601
tiles = {}
def tile(lat, lon):
    k = (lat, lon)
    if k not in tiles:
        f = src / ('N%02dE%03d.hgt.gz' % (lat, lon))
        if f.exists():
            a = np.frombuffer(gzip.open(f).read(), dtype='>i2').reshape(N, N).astype(np.float32)
            a[a < -1000] = 0; a[a < 0] = 0
            tiles[k] = a
        else: tiles[k] = None
    return tiles[k]
out = np.zeros((H, W), dtype=np.uint8)
step = 3600 * D  # 每格 72 個取樣
for j in range(H):
    lat_top = LAT1 - j * D
    for i in range(W):
        lon_l = LON0 + i * D
        tlat, tlon = int(np.floor(lat_top - 1e-9)), int(np.floor(lon_l + 1e-9))
        a = tile(tlat, tlon)
        if a is None: continue
        r0 = int(round((tlat + 1 - lat_top) * 3600)); c0 = int(round((lon_l - tlon) * 3600))
        blk = a[r0:r0 + int(step), c0:c0 + int(step)]
        if blk.size: out[j, i] = min(255, int(round(float(blk.mean()) / 20)))
b64 = base64.b64encode(out.tobytes()).decode()
js = ("'use strict';\n// 台澎高程網格（每 0.02° 約 2 km 的平均海拔，每點 1 位元組＝海拔÷20 公尺）：SRTM 1 角秒（NASA，公有領域），由 tools/geo/build_dem.py 產生，不要手改。\n"
      "const DEM={lon0:%s,lat1:%s,d:%s,w:%d,h:%d,b:'%s'};\n" % (LON0, LAT1, D, W, H, b64))
p = pathlib.Path(__file__).resolve().parent.parent.parent / 'js' / 'dem.js'
p.write_text(js, encoding='utf-8')
print('grid', W, 'x', H, 'max m', int(out.max()) * 20, 'bytes', len(js))
