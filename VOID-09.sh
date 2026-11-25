#!/usr/bin/env bash
set -e

OS_NAME="$(uname -s 2>/dev/null || true)"
UNAME_OUT="$(uname -a 2>/dev/null || true)"

if echo "$UNAME_OUT" | grep -qiE "android|termux"; then
  echo "ACCESS DENIED: VOID-09 is not supported on Android."
  exit 1
fi

case "$OS_NAME" in
  Darwin|Linux) ;;
  *)
    echo "ACCESS DENIED: Only Desktop, Apple (macOS) and Linux are allowed."
    exit 1
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if command -v npm >/dev/null 2>&1; then
  if [ ! -d "node_modules/electron" ]; then
    echo "Installing VOID-09 Desktop runtime..."
    npm install
  fi
  npm start
elif command -v python3 >/dev/null 2>&1; then
  (sleep 1 && (xdg-open "http://127.0.0.1:4173/" 2>/dev/null || open "http://127.0.0.1:4173/" 2>/dev/null || true)) &
  python3 -m http.server 4173 --bind 127.0.0.1
else
  xdg-open "$SCRIPT_DIR/index.html" 2>/dev/null || open "$SCRIPT_DIR/index.html" 2>/dev/null || true
fi