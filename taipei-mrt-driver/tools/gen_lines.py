#!/usr/bin/env python3
"""由 data/stations.json（維基百科車站表解析結果）產生 js/lines.js。
用法：python3 taipei-mrt-driver/tools/gen_lines.py
【已查證】站序、站名、站體（高架／平面／地下）、月台形式、站間距離：來自 data/stations.json。
          文湖線哪些高架站位於道路中央上方（ro）：來自維基「文湖線」條目的敘述。
【示意】SCENE 的周邊疏密（z）與河、山、湖、醫院、機廠等（L／R 為行進方向左右，依一般地理知識，未逐站查證）。"""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
D = json.load(open(root / 'data' / 'stations.json', encoding='utf-8'))
META = {
    'red':   dict(name='淡水信義線', short='紅線', color='#e3002c', cars=6, trainLen=140),
    'blue':  dict(name='板南線',     short='藍線', color='#0070bd', cars=6, trainLen=140),
    'green': dict(name='松山新店線', short='綠線', color='#008659', cars=6, trainLen=140),
    'brown': dict(name='文湖線',     short='棕線', color='#c48c31', cars=4, trainLen=76),
}
ENV = {'地下': 'tunnel', '高架': 'elev', '平面': 'grade'}
def plat(p): return 'mixed' if '混合' in p else 'side' if p.startswith('側式') else 'island'
# z：high 高樓／mid 中高樓／low 低矮住宅／rural 田野；L／R：行進方向（站序遞增）左右側的地貌；ro：高架下方為道路（已查證）；lm：地標
SCENE = {
 # 淡水信義線（站序遞增＝往淡水；淡水河在左（西）側、陽明山在右（東）側）
 'R14': dict(z='mid'), 'R15': dict(z='high'), 'R16': dict(z='high'), 'R17': dict(z='mid'), 'R18': dict(z='mid'),
 'R19': dict(z='mid', R=['mtn']), 'R20': dict(z='mid', R=['mtn']), 'R21': dict(z='mid', R=['mtn']), 'R22': dict(z='mid', R=['mtn']),
 'R23': dict(z='low', R=['mtn', 'depot']), 'R24': dict(z='low', L=['field'], R=['mtn']),
 'R25': dict(z='rural', L=['field', 'river', 'mtn'], R=['field', 'mtn']),
 'R26': dict(z='low', L=['river', 'mtn']), 'R27': dict(z='low', L=['river', 'trees', 'mtn']), 'R28': dict(z='mid', L=['river', 'mtn']),
 # 文湖線（站序遞增＝往南港展覽館）
 'BR01': dict(z='low', L=['mtn'], R=['mtn'], ro=True), 'BR02': dict(z='low', L=['mtn'], R=['mtn']),
 'BR03': dict(z='mid', L=['mtn'], R=['mtn']), 'BR04': dict(z='mid', R=['hospital']), 'BR05': dict(z='mid'),
 'BR06': dict(z='high', ro=True), 'BR07': dict(z='high', ro=True), 'BR08': dict(z='high', ro=True), 'BR09': dict(z='high', ro=True),
 'BR10': dict(z='high', ro=True), 'BR11': dict(z='high', ro=True), 'BR12': dict(z='mid', ro=True),
 'BR15': dict(z='mid', ro=True), 'BR16': dict(z='mid', ro=True), 'BR17': dict(z='high', ro=True), 'BR18': dict(z='high', ro=True),
 'BR19': dict(z='mid', ro=True), 'BR20': dict(z='mid', R=['lake', 'trees'], ro=True), 'BR21': dict(z='low', ro=True),
 'BR22': dict(z='low', L=['mtn'], R=['mtn'], ro=True), 'BR23': dict(z='high'), 'BR24': dict(z='high', lm=['expo']),
}
out = ['// 由 tools/gen_lines.py 自 data/stations.json 產生，請勿手改（改 gen_lines.py 的 SCENE 後重新產生）。',
       '// 已查證：站序、站名、站體 env（elev 高架／grade 平面／tunnel 地下）、月台 plat、站間距離 d（公尺）。',
       '// 示意：sc（周邊疏密與地貌）。', 'const LINES={']
for k, m in META.items():
    rows = D[k]
    st = [r['name'] for r in rows]
    code = [r['code'] for r in rows]
    en = [r.get('en','') for r in rows]
    d = [round(rows[i + 1]['dist_km'] * 1000) for i in range(len(rows) - 1)]
    env = [ENV[r['structure']] for r in rows]
    pl = [plat(r['platform']) for r in rows]
    sc = [SCENE.get(r['code'], {}) for r in rows]
    out.append(f"  {k}:{{name:{json.dumps(m['name'],ensure_ascii=False)},short:{json.dumps(m['short'],ensure_ascii=False)},color:'{m['color']}',cars:{m['cars']},trainLen:{m['trainLen']},")
    out.append(f"    st:{json.dumps(st,ensure_ascii=False)},")
    out.append(f"    code:{json.dumps(code)},")
    out.append(f"    en:{json.dumps(en,ensure_ascii=False)},")
    out.append(f"    d:{json.dumps(d)},")
    out.append(f"    env:{json.dumps(env)},")
    out.append(f"    plat:{json.dumps(pl)},")
    out.append(f"    sc:{json.dumps(sc,ensure_ascii=False,separators=(',',':'))}}},")
out.append('};')
(root / 'js' / 'lines.js').write_text('\n'.join(out) + '\n', encoding='utf-8')
print('js/lines.js 已產生：', {k: len(D[k]) for k in META})
