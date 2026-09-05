# speccode-config-management Delta

## MODIFIED Requirements

### Requirement: config.json 字段集

`.speccode/config.json` MUST 包含以下字段:
- `version: 3`
- `initialized_at`: ISO 8601 UTC 时间戳
- `trunk`: 主干分支名,默认 `"main"`
- `remote`: git remote 名,默认 `"origin"`
- `pr_tool`: `"gh" | "glab" | "none"`
- `worktree_dir`: worktree 基础目录,默认 `".speccode/worktrees"`
- `code_intel_tools`: 数组,init 探测并经用户确认登记的代码智能工具(可为空数组)

可选字段:`hooks`(事件名 → shell 命令字符串;缺失视为全部事件无 hook,见 hook-event-integration);`host`(宿主身份,枚举 `claude-code | codex | zcode | opencode | pi | kimi-code | generic`,由 init 探测并经用户确认写入;缺失视为未记录,走与 `claude-code` 相同的全量探测,见 host-detection)。

`display`、`spec_tools`、`untracked_permanent` 三个 v1 字段与 `worktree_prefix` v2 字段 MUST NOT 出现在 `version: 3` 的 config 中(v2 读兼容见「state v2 兼容读取与迁移」)。

#### Scenario: 首次 init 后字段齐备
- **WHEN** 用户执行 `/speccode:init` 并完成所有询问
- **THEN** `.speccode/config.json` MUST 存在,`version` 为 `3`,包含上述全部字段(hooks 仅在用户选择配置时存在;host 为探测并经用户确认的枚举值),MUST NOT 含 `worktree_prefix`

#### Scenario: v2 升级 v3 的字段 diff
- **WHEN** v2 config(含 worktree_prefix)存在时二次执行 init
- **THEN** 命令 MUST 逐字段展示 diff:`worktree_prefix` 标记移除,经用户确认后写入 `version: 3`

#### Scenario: 拒绝升级则整体保持 v2
- **WHEN** 二次 init 时用户拒绝对 config 的任何修改
- **THEN** config MUST 保持 v2 原样(`version: 2`);一旦接受升级(`version: 3`),`worktree_prefix` MUST 被移除,不存在「version: 3 但保留该字段」的混合态

#### Scenario: worktree_dir 缺省中性
- **WHEN** config 存在但不含 `worktree_dir` 字段(或字段被手删)
- **THEN** `speccode resolve-worktree-dir --cwd .` 返回 `dir: ".speccode/worktrees"`、`source: "default"`;对账与创建命令按同一缺省解析

### Requirement: 对账算法

每个涉及分支的命令(`/speccode:creating-worktree`、`/speccode:finishing-worktree`、`/speccode:finishing-feature`、`/speccode:status`)开头 MUST 执行「state ↔ git」对账,扫描 `git worktree list --porcelain` 与 `state/branches/*.json`(及 v2 遗留 `state/features/`),自动补齐/标记不一致项,并推进 `pr_open` 的分支。管辖识别 MUST 为路径识别:路径位于 `config.worktree_dir` 之下的 worktree 为 speccode 管辖;worktree_dir 缺失时 MUST 回退默认值 `".speccode/worktrees"`(相对路径按仓库根解析;与 `resolve-worktree-dir` 的缺省同源单常量),对账 MUST NOT 因 config 缺失而失败。分支名前缀与 ancestry 判定 MUST NOT 参与识别(v3 中 worktree↔state 为 1:1);父实体(无 worktree 的集成分支)MUST 由 state 侧识别。

#### Scenario: worktree 在 git 中但不在 state 中
- **WHEN** git worktree list 含路径位于 worktree_dir 之下的 worktree,但 state 中无记录
- **THEN** 对账 MUST 将其计入 orphans 并提示用户处理(半截创建),MUST NOT 静默补齐

#### Scenario: worktree 在 state 中但不在 git 中
- **WHEN** state 中有非 `completed` 分支但 git worktree list 不存在对应 worktree
- **THEN** 对账 MUST 标 `orphaned`,提示用户手动处理

#### Scenario: 对账推进 pr_open 分支
- **WHEN** 对账遇到状态为 `pr_open` 的分支,且查询其 `pr_number` 得到 MERGED
- **THEN** 对账 MUST 把该分支推进为 `completed`(记 `completed_at`),清理动作由命令层执行

#### Scenario: 对账回退被关闭的 pr_open
- **WHEN** 对账遇到 `pr_open` 的分支,但其 PR 状态为 CLOSED(未合并)
- **THEN** 对账 MUST 把该分支回退为 `in_progress` 并提示用户 PR 已关闭

#### Scenario: 无 config 时对账不崩溃
- **WHEN** `.speccode/config.json` 不存在
- **THEN** 对账 MUST 以默认 `worktree_dir: ".speccode/worktrees"` 正常执行,不报错退出

#### Scenario: merge_target 缺失计入 orphan
- **WHEN** 某分支 state 的 `merge_target` 指向的集成分支在 git 中不存在
- **THEN** 对账 MUST 将其计入 orphans 并报告
