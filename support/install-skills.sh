#!/usr/bin/env bash
# 把项目根 support/ 下的 skill 安装(复制)到 .claude/skills/,供 Claude Code 懒加载。
#
# 真源在 support/<name>/（进 git,含 SKILL.md 的目录才算 skill）,安装产物在 .claude/skills/（untracked,本机生成）。
# 这样既保持真源独立于 plugins/、随仓库版本化,又让 Claude Code 从标准路径加载。
# 修改 support/ 后重跑本脚本即可同步。
#
# 用法:bash support/install-skills.sh [--dest <dir>] [--check]
#   --dest <dir>  安装目标目录(缺省 <repo根>/.claude/skills;多宿主安装时指向对应宿主的 skills 目录)
#   --check       只检查 support/ 下各 skill 与目标目录是否一致,不实际复制(退出码 0=一致,1=不一致)

set -euo pipefail

# 定位仓库根(脚本在 support/ 下)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SRC="$REPO_ROOT/support"
DST="$REPO_ROOT/.claude/skills"
CHECK=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dest)
      [ $# -ge 2 ] || { echo "--dest 需要一个目录参数"; exit 1; }
      DST="$2"; shift 2 ;;
    --dest=*) DST="${1#--dest=}"; shift ;;
    --check) CHECK=1; shift ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

# 安装判据:support/ 下含 SKILL.md 的目录才装(其余文件/目录不参与)

# --check 模式:逐 skill 比较源与产物是否一致(只比 SKILL.md 目录,support/ 内其余条目不参与)
if [ "$CHECK" -eq 1 ]; then
  if [ ! -d "$SRC" ]; then echo "FAIL: 源目录 $SRC 不存在"; exit 1; fi
  rc=0
  for skill_dir in "$SRC"/*/; do
    [ -d "$skill_dir" ] || continue
    [ -f "$skill_dir/SKILL.md" ] || continue
    skill_name="$(basename "$skill_dir")"
    if diff -rq "$skill_dir" "$DST/$skill_name" >/dev/null 2>&1; then
      echo "  ok: $skill_name"
    else
      echo "DRIFTED: $skill_name 与 $DST/$skill_name 不一致,重跑 install-skills.sh"
      rc=1
    fi
  done
  if [ "$rc" -eq 0 ]; then echo "OK: skills 已同步"; exit 0; else exit 1; fi
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
  [ -f "$skill_dir/SKILL.md" ] || continue
  skill_name="$(basename "$skill_dir")"
  # 幂等:先清掉旧产物目录,再复制
  rm -rf "$DST/$skill_name"
  cp -R "$skill_dir" "$DST/$skill_name"
  echo "  installed: $skill_name"
  installed=$((installed + 1))
done

if [ "$installed" -eq 0 ]; then
  echo "support/ 下无含 SKILL.md 的 skill 目录"
else
  echo "完成:安装 $installed 个 skill 到 $DST(宿主会话重启后生效)"
fi
