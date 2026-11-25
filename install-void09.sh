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
    echo "ACCESS DENIED: Unsupported platform ($OS_NAME). Only Desktop, Apple (macOS) & Linux are allowed."
    exit 1
    ;;
esac

TARGET_DIR="${1:-$HOME/red-protocol-void-09}"
REPO_URL="${2:-https://github.com/kavinmusicc-code/-red-protocol-void-09.git}"

echo "=== VOID-09 INSTALLER ($OS_NAME) ==="

if ! command -v git >/dev/null 2>&1; then
  echo "Git is required. Please install Git first."
  exit 1
fi

if [ -d "$TARGET_DIR/.git" ]; then
  echo "Updating existing VOID-09 repository..."
  git -C "$TARGET_DIR" pull origin main
else
  echo "Downloading VOID-09 repository..."
  git clone "$REPO_URL" "$TARGET_DIR"
fi

echo "Done! VOID-09 ready at: $TARGET_DIR"