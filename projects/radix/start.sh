#!/usr/bin/env bash
# Launch the ctxcalc playground on a local static server.
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[X] Node.js not found. Install Node 18+ from https://nodejs.org/" >&2
  exit 1
fi

PORT="${PORT:-4173}"
SERVE=""
[ -f server.js ] && SERVE=server.js
[ -z "$SERVE" ] && [ -f serve.js ] && SERVE=serve.js
[ -z "$SERVE" ] && [ -f playground/serve.js ] && SERVE=playground/serve.js

if [ -n "$SERVE" ]; then
  ( sleep 1; (command -v xdg-open >/dev/null && xdg-open "http://localhost:$PORT/") || (command -v open >/dev/null && open "http://localhost:$PORT/") ) >/dev/null 2>&1 &
  exec node "$SERVE" "$PORT"
else
  echo "Starting 'npx serve' on port $PORT ..."
  exec npx --yes serve . -l "$PORT"
fi
