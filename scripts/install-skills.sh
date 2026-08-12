#!/usr/bin/env bash
# 把项目根 skills/ 下的 skill 安装(复制)到 .claude/skills/,供 Claude Code 懒加载。
#
# 真源在 skills/（进 git）,安装产物在 .claude/skills/（untracked,本机生成）。
# 这样既保持真源独立于 plugins/、随仓库版本化,又让 Claude Code 从标准路径加载。
# 修改 skills/ 后重跑本脚本即可同步。
#
# 用法:bash scripts/install-skills.sh [--check]
#   --check  只检查 skills/ 与 .claude/skills/ 是否一致,不实际复制(退出码 0=一致,1=不一致)

set -euo pipefail

# 定位仓库根(脚本在 scripts/ 下)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SRC="$REPO_ROOT/skills"
DST="$REPO_ROOT/.claude/skills"

# --check 模式:比较源与产物是否一致
if [ "${1:-}" = "--check" ]; then
  if [ ! -d "$SRC" ]; then echo "FAIL: 源目录 $SRC 不存在"; exit 1; fi
  # 用 diff 递归比较(源目录 vs 安装产物)
  # 先同步目录结构再 diff 内容
  diff -rq "$SRC" "$DST" >/dev/null 2>&1 && { echo "OK: skills 已同步"; exit 0; } || { echo "DRIFTED: skills 与 .claude/skills/ 不一致,重跑 install-skills.sh"; exit 1; }
fi

# 实际安装
if [ ! -d "$SRC" ]; then
  echo "源目录 $SRC 不存在,无 skill 可安装"
  exit 0
fi

mkdir -p "$DST"

# 复制每个 skill 目录(覆盖旧产物)
installed=0
for skill_dir in "$SRC"/*/; do
  [ -d "$skill_dir" ] || continue
  skill_name="$(basename "$skill_dir")"
  # 幂等:先清掉旧产物目录,再复制
  rm -rf "$DST/$skill_name"
  cp -R "$skill_dir" "$DST/$skill_name"
  echo "  installed: $skill_name"
  installed=$((installed + 1))
done

if [ "$installed" -eq 0 ]; then
  echo "skills/ 下无 skill 目录"
else
  echo "完成:安装 $installed 个 skill 到 .claude/skills/(重启 Claude Code 会话后生效)"
fi
