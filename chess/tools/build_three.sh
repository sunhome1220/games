#!/usr/bin/env bash
# 重新產生 vendor/three.min.js：只打包 js/render3d.js 用到的 Three.js 類別（tree-shaking，約 0.5 MB）
# 用法：bash tools/build_three.sh [three 版本，預設 0.186.1]   需要 node、npm 與網路
set -euo pipefail
VER=${1:-0.186.1}; HERE=$(cd "$(dirname "$0")/.." && pwd); TMP=$(mktemp -d); cd "$TMP"
npm pack "three@$VER" >/dev/null && tar xzf three-*.tgz && npm i esbuild >/dev/null 2>&1
NAMES=$(grep -o "T\.[A-Z][A-Za-z0-9]*" "$HERE/js/render3d.js" | sed 's/T\.//' | sort -u | paste -sd, -)
echo "export { $NAMES } from 'three';" > entry.js
./node_modules/.bin/esbuild entry.js --bundle --minify --format=esm --alias:three=./package/build/three.module.js --outfile="$HERE/vendor/three.min.js"
cp package/LICENSE "$HERE/vendor/three.LICENSE"; echo "three@$VER → vendor/three.min.js"
