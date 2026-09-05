#!/usr/bin/env bash
# Install the speccode CLI shim onto PATH: symlinks bin/speccode (the
# symlink-safe wrapper) into a PATH directory so non-Claude-Code hosts can
# run `speccode <verb>` directly. Claude Code does not need this — the plugin
# mechanism puts the plugin's bin/ on PATH automatically.
#
# Usage: bash scripts/install-shim.sh [--dest <dir>]
#   --dest <dir>   install target (default: ~/.local/bin)
# On failure prints the equivalent manual command and exits non-zero.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC="$REPO_ROOT/bin/speccode"

if [ ! -x "$SRC" ]; then
  echo "错误: 未找到可执行的 $SRC(请在本插件仓库根运行本脚本)"
  exit 1
fi

DEST=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dest)
      [ $# -ge 2 ] || { echo "--dest 需要一个目录参数"; exit 1; }
      DEST="$2"; shift 2 ;;
    --dest=*) DEST="${1#--dest=}"; shift ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

if [ -z "$DEST" ]; then
  DEST="${HOME:-}/.local/bin"
fi

if mkdir -p "$DEST" 2>/dev/null && ln -sfn "$SRC" "$DEST/speccode" 2>/dev/null; then
  echo "shim installed: $DEST/speccode -> $SRC"
  case ":$PATH:" in
    *":$DEST:"*) : ;;
    *) echo "注意: $DEST 不在当前 PATH 中 —— 请把它加入你的 shell 配置后重开终端" ;;
  esac
  exit 0
fi

echo "无法安装 shim(目标目录 $DEST 不可用或已存在同名非链接项)。请手动执行:"
echo "  ln -sfn \"$SRC\" \"$DEST/speccode\""
exit 1
