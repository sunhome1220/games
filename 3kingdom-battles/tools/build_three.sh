#!/usr/bin/env bash
# 重新產生 vendor/three.min.js：只打包 js/render3d.js 用到的 Three.js 類別（tree-shaking）
# 用法：bash tools/build_three.sh [three 版本，預設 0.186.1]
#   需要 node 與 esbuild；可用 THREE_DIR=已下載的 three 套件資料夾（含 build/three.module.js）跳過 npm 下載
set -euo pipefail
VER=${1:-0.186.1}; HERE=$(cd "$(dirname "$0")/.." && pwd); TMP=$(mktemp -d); cd "$TMP"
if [ -z "${THREE_DIR:-}" ]; then npm pack "three@$VER" >/dev/null && tar xzf three-*.tgz && THREE_DIR="$TMP/package"; fi
ESB=$(command -v esbuild || true); [ -z "$ESB" ] && { npm i esbuild >/dev/null 2>&1; ESB=./node_modules/.bin/esbuild; }
NAMES=$(grep -o "T\.[A-Z][A-Za-z0-9]*" "$HERE/js/render3d.js" | sed 's/T\.//' | sort -u | paste -sd, -)
echo "export { $NAMES } from 'three';" > entry.js
"$ESB" entry.js --bundle --minify --format=esm --alias:three="$THREE_DIR/build/three.module.js" --outfile="$HERE/vendor/three.min.js" --log-level=warning
cp "$THREE_DIR/LICENSE" "$HERE/vendor/three.LICENSE"; echo "three → vendor/three.min.js ($(wc -c < "$HERE/vendor/three.min.js") bytes)"
