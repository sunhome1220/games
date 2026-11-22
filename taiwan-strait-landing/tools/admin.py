#!/usr/bin/env python3
"""管理者開關：改 status.json（對外關閉／重新開放、設定管理者密碼）。改完要 commit 並推到 main，GitHub Pages 約 1～2 分鐘後生效。
用法：
  python3 tools/admin.py status            顯示目前狀態
  python3 tools/admin.py close [訊息]      對外關閉（訊息是給訪客看的文字）
  python3 tools/admin.py open              重新開放
  python3 tools/admin.py passwd            設定管理者密碼（輸入時不顯示；只存 SHA-256 雜湊，密碼本身不進倉庫）
管理者進入關閉中的遊戲：網址加 ?admin=你的密碼（只需一次，這台裝置會記住）；?admin=logout 登出。
★軟性關閉：程式碼是公開的，擋得住一般訪客，擋不住自己下載程式碼的人。要真的全部下線：GitHub 倉庫 Settings → Pages → Unpublish，或把倉庫改為私人。"""
import hashlib, json, os, sys, getpass
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'status.json')
def load():
    try:
        with open(P, encoding='utf-8') as f: return json.load(f)
    except FileNotFoundError:
        return {'open': True, 'message': '', 'adminHash': ''}
def save(d):
    with open(P, 'w', encoding='utf-8') as f: json.dump(d, f, ensure_ascii=False, indent=2); f.write('\n')
def main(a):
    if not a or a[0] in ('-h', '--help', 'help'): print(__doc__); return 0
    d = load(); c = a[0]
    if c == 'status':
        print('狀態：' + ('開放中' if d.get('open', True) else '已對外關閉') + '；訊息：' + (d.get('message') or '（預設）') + '；管理者密碼：' + ('已設定' if d.get('adminHash') else '尚未設定'))
    elif c == 'close':
        if not d.get('adminHash'): print('提醒：還沒設定管理者密碼（passwd），關閉後你自己也進不去。')
        d['open'] = False; d['message'] = ' '.join(a[1:]); save(d); print('已設為對外關閉。commit 並推到 main 後生效。')
    elif c == 'open':
        d['open'] = True; save(d); print('已設為開放。commit 並推到 main 後生效。')
    elif c == 'passwd':
        p = getpass.getpass('管理者密碼（至少 16 個字元的隨機字串較安全）：')
        if len(p) < 12: print('密碼太短（至少 12 字元）。'); return 1
        if getpass.getpass('再輸入一次：') != p: print('兩次不一致。'); return 1
        d['adminHash'] = hashlib.sha256(('tsl-admin:' + p).encode()).hexdigest(); save(d); print('已寫入 adminHash（舊密碼與所有已登入的裝置即刻失效）。')
    else: print(__doc__); return 1
    return 0
sys.exit(main(sys.argv[1:]))
