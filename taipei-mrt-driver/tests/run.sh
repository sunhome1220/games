#!/bin/bash
# 一鍵跑全部瀏覽器測試。用法：bash taipei-mrt-driver/tests/run.sh [測試名...]（不給名稱就全跑）
# 需求：Node.js 與 playwright（require('playwright') 要找得到，且有 Chromium）、python3。
# 測試用 http://localhost:8765/taipei-mrt-driver/index.html，這支腳本會在倉庫根目錄自己啟動伺服器（已在跑就沿用）。
# 任何一項 FAIL、或某個測試一項 PASS 都沒有（通常是伺服器沒起來），整體就是失敗（結束碼 1）。
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PORT=8765
URL="http://localhost:$PORT/taipei-mrt-driver/index.html"
started=""
if ! curl -s -o /dev/null "$URL"; then
  (cd "$ROOT" && python3 -m http.server $PORT >/dev/null 2>&1 &) ; started=1
  for i in 1 2 3 4 5 6 7 8 9 10; do sleep 0.5; curl -s -o /dev/null "$URL" && break; done
fi
curl -s -o /dev/null "$URL" || { echo "伺服器沒有起來：$URL"; exit 1; }
cd "$ROOT"
ALL="atp e1 t7 t8 r1 b1 tap name share ped fb lever map ui gp sig soak"
LIST="${@:-$ALL}"
bad=0
for t in $LIST; do
  f="$HERE/$t.cjs"; [ -f "$f" ] || { echo "$t: 找不到測試"; bad=1; continue; }
  # ui 要看「第一次使用」的真實狀態，不能預先略過教學／展開進階設定；其他測試用 pre.cjs 略過
  pre="-r $HERE/pre.cjs"; [ "$t" = ui ] && pre=""
  out=$(timeout 600 node $pre "$f" 2>&1)
  case "$t" in
    sig)  n=$(echo "$out" | grep -c '"ok":true'); st=$(echo "$out" | grep -c '"stuck"'); echo "$t: 完成 $n 組，卡住 $st"; { [ "$n" -gt 0 ] && [ "$st" -eq 0 ]; } || bad=1;;
    soak) n=$(echo "$out" | grep -c '^ok'); fl=$(echo "$out" | grep -c '^FAIL'); echo "$t: 完成 $n 組，失敗 $fl"; { [ "$n" -gt 0 ] && [ "$fl" -eq 0 ] && echo "$out" | grep -q 'ALL COMPLETED'; } || bad=1;;
    *)    p=$(echo "$out" | grep -c '^PASS'); f2=$(echo "$out" | grep -c '^FAIL'); echo "$t: PASS $p FAIL $f2"
          echo "$out" | grep '^FAIL'
          echo "$out" | grep -E 'errors \[.+\]' | grep -v 'errors \[\]'
          { [ "$p" -gt 0 ] && [ "$f2" -eq 0 ]; } || bad=1;;
  esac
done
[ -n "$started" ] && pkill -f "http.server $PORT" 2>/dev/null
[ $bad -eq 0 ] && echo "== 全部通過" || echo "== 有失敗（或沒有任何 PASS）"
exit $bad
