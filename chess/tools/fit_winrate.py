#!/usr/bin/env python3
"""用 tools/selfplay.js 產生的 d_*.json 校準勝率權重（js/surrender.js 的 HINT_W）。
用法：python3 chess/tools/fit_winrate.py 資料夾　（需要 numpy）
輸出：權重（貼回 HINT_W）與訓練／驗證集各勝率區間的「預測 vs 實際」對照。"""
import json, glob, math, random, sys
import numpy as np
folder = sys.argv[1] if len(sys.argv) > 1 else '.'
X, Y, G = [], [], []
for f in sorted(glob.glob(folder + '/d_*.json')):
    for gi, g in enumerate(json.load(open(f))):
        w = g['winner']
        for s in g['samples']:
            f_, side = s['f'], s['side']
            y = 1.0 if w == side else (0.0 if w in (0, 1) else 0.5)   # 和局／打滿回合算 0.5
            m, k, a, c, h = f_['mat'], f_['k'], f_['atk'], f_['cross'], f_['hit']
            X.append([1, math.log((m[0] + 1) / (m[1] + 1)), k[0] - k[1], (a[0] - a[1]) / 4, (c[0] - c[1]) / 3, (h[0] - h[1]) / 15])   # 要和 hintFeatureVec 一致
            Y.append(y); G.append(f'{f}-{gi}')
X, Y = np.array(X), np.array(Y)
games = sorted(set(G)); random.seed(1); random.shuffle(games); val = set(games[:len(games) // 5])
tr = np.array([g not in val for g in G])
def fit(X, Y, l2=1e-3, it=4000, lr=0.5):
    w = np.zeros(X.shape[1])
    for _ in range(it):
        w -= lr * (X.T @ (1 / (1 + np.exp(-X @ w)) - Y) / len(Y) + l2 * w)
    return w
w = fit(X[tr], Y[tr])
print('HINT_W =', [round(float(x), 2) for x in w])
for name, m in (('訓練', tr), ('驗證', ~tr)):
    p = 1 / (1 + np.exp(-X[m] @ w)); y = Y[m]
    print(name, 'n =', int(m.sum()))
    for lo, hi in ((0, .02), (.02, .05), (.05, .1), (.1, .3), (.3, .7), (.7, .9), (.9, 1.01)):
        b = (p >= lo) & (p < hi)
        if b.sum(): print(f'  預測 [{lo:.2f},{hi:.2f})：n={int(b.sum())} 實際勝率 {y[b].mean():.3f}（預測平均 {p[b].mean():.3f}）')
