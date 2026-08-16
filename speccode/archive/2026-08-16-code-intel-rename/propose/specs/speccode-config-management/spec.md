# speccode-config-management Delta

> 本 delta 只修正 config 字段名 `knowledge_tools` → `code_intel_tools` 与其描述措辞,字段语义、可选性与其余字段均不变。requirement 标题与正文与主规格逐字对齐后改名。

## MODIFIED Requirements

### Requirement: config.json 字段集

`.speccode/config.json` MUST 包含以下字段:
- `version: 2`
- `initialized_at`: ISO 8601 UTC 时间戳
- `trunk`: 主干分支名,默认 `"master"`
- `remote`: git remote 名,默认 `"origin"`
- `pr_tool`: `"gh" | "glab" | "none"`
- `worktree_prefix`: 默认 `"worktree-"`
- `worktree_dir`: worktree 基础目录,默认 `".claude/worktrees"`
- `code_intel_tools`: 数组,init 探测并经用户确认登记的代码智能工具(可为空数组)

可选字段:`hooks`(事件名 → shell 命令字符串;缺失视为全部事件无 hook,见 hook-event-integration)。

`display`、`spec_tools`、`untracked_permanent` 三个 v1 字段 MUST NOT 出现在 `version: 2` 的 config 中。
