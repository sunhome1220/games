#!/usr/bin/env python3
"""把維基百科「淡水信義線／板南線／松山新店線／文湖線」條目的 wikitext 車站表解析成 JSON。
用法：python3 parse_stations.py <wikitext 檔> > out.json
取得 wikitext：curl -A "<識別>" "https://zh.wikipedia.org/w/index.php?title=板南線&action=raw"
只擷取：編號、站名、站體（高架／地面／地下）、月台形式、與前一站站距（公里）、交會路線。"""
import re, sys, json

def clean(s):
    s = re.sub(r'<ref[^>]*?/>|<ref.*?</ref>', '', s, flags=re.S)
    s = re.sub(r'\{\{Stl\|[^|]*\|([^}|]*)[^}]*\}\}', r'\1', s)
    s = re.sub(r'\{\{台北捷運車站編號\|([^}|]*)[^}]*\}\}', r'\1', s)
    s = re.sub(r'\{\{Lang\|en\|([^}]*)\}\}', r'\1', s)
    s = re.sub(r'\{\{Dts\|([^}]*)\}\}', r'\1', s)
    s = re.sub(r'\[\[File:[^\]]*\]\]', '', s)
    s = re.sub(r'\{\{Ric\|台北捷運\|([A-Z]+)[^}]*\}\}', r'\1', s)
    s = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', s)
    s = re.sub(r'\{\{N/A\}\}|\{\{Dim\|', '', s)
    s = re.sub(r'<[^>]+>|\}\}|\{\{[^}]*\}\}', '', s)
    return s.strip()

def parse_table(txt):
    m0 = re.search(r'^!\s*(?:[^|\n]*\|)?\s*站體\s*$', txt, flags=re.M)   # 表頭儲存格「站體」（不是正文中的字樣）
    if not m0: raise SystemExit('找不到站體欄')
    start = m0.start()
    tb0 = txt.rfind('{|', 0, start); tb1 = txt.find('\n|}', start)
    body = txt[tb0:tb1]
    rows = re.split(r'\n\|-+[^\n]*', body)
    grid, carry, out = [], {}, []
    for row in rows[1:]:
        cells = []
        for m in re.finditer(r'^[|!](?!\+)(.*?)(?=^[|!]|\Z)', row, flags=re.M | re.S):
            raw = m.group(1)
            attrs = ''
            mm = re.match(r'\s*((?:[a-z]+="[^"]*"\s*)+)\|(?!\|)(.*)', raw, flags=re.S)
            if mm: attrs, raw = mm.group(1), mm.group(2)
            rs = int((re.search(r'rowspan="(\d+)"', attrs) or [0, 1])[1]); cs = int((re.search(r'colspan="(\d+)"', attrs) or [0, 1])[1])
            cells.append((clean(raw), rs, cs))
        full, ci, it = [], 0, iter(cells)
        while True:
            if ci in carry and carry[ci][1] > 0:
                full.append(carry[ci][0]); carry[ci][1] -= 1; ci += 1; continue
            c = next(it, None)
            if c is None: break
            txtc, rs, cs = c
            for k in range(cs):
                full.append(txtc)
                if rs > 1: carry[ci] = [txtc, rs - 1]
                ci += 1
        grid.append(full)
    for r in grid:
        if len(r) >= 9 and re.match(r'^[A-Z]{1,3}\d{2}[A-Z]?$', r[0]):
            out.append({'code': r[0], 'zh': r[1], 'en': r[2], 'structure': r[3], 'platform': r[4],
                        'dist_prev': r[-4] if False else None, 'raw': r})
    return out

if __name__ == '__main__':
    rows = parse_table(open(sys.argv[1], encoding='utf-8').read())
    json.dump(rows, sys.stdout, ensure_ascii=False, indent=1)
