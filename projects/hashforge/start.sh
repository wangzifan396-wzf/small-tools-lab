#!/usr/bin/env bash
# Start Hashforge Playground and open it in the browser.
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "  没有找到 Node.js，请先安装 Node 18+：https://nodejs.org"
  echo ""
  exit 1
fi

URL="http://localhost:4173"
(
  sleep 2
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
  elif command -v open >/dev/null 2>&1; then open "$URL"
  fi
) >/dev/null 2>&1 &

echo ""
echo "  正在启动 Hashforge Playground  →  $URL"
echo "  按 Ctrl+C 退出。"
echo ""

exec node playground/serve.js
