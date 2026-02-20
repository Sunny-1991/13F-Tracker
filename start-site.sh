#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${1:-9010}"

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "端口 $PORT 已被占用。"
  echo "请换一个端口，例如："
  echo "  ./start-site.sh 9010"
  echo "  ./start-site.sh 9020"
  exit 1
fi

echo "启动目录: $ROOT_DIR"
echo "访问地址: http://127.0.0.1:${PORT}"
echo "按 Ctrl+C 可停止服务"

exec /usr/bin/python3 -m http.server "$PORT" --directory "$ROOT_DIR"
