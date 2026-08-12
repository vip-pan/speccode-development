## ADDED Requirements

### Requirement: 写 verb stdin 契约

引擎的写 verb(`write-config` / `write-state` / `write-memory`)MUST 要求显式 `--json-stdin` 标志并从 stdin 读取 JSON payload;缺少该标志时 MUST 返回 `{ok: false}` 并提示用法,MUST NOT 静默从 stdin 阻塞读或从 argv 读取超长 JSON。

#### Scenario: 缺 --json-stdin 报错
- **WHEN** 调用 `write-config --cwd .` 但不带 `--json-stdin`
- **THEN** verb MUST 返回 `{ok: false}` 与用法提示,不写任何文件

#### Scenario: 带标志正常写入
- **WHEN** 调用 `echo '<json>' | speccode.mjs write-state --cwd . --branch feature/x --json-stdin`
- **THEN** verb MUST 从 stdin 解析 JSON 并经原子写落盘

### Requirement: legacy pending_operation 规范化

引擎读取 state 时 MUST 经统一的 `normalizeState()` 规范化遗留数据:`pending_operation.command` 的旧值 `develop-complete` MUST 规范化为 `finishing-worktree`、`finish` MUST 规范化为 `finishing-feature`。`normalizeState()` MUST 被 `readState` 与 `listActiveFeatures` 共同调用,保证 reconcile 输出与单 feature 读取路径一致。`phase = "waiting_display_pr"` 的挂起态 MUST 原样保留在 state 中,命令层(finishing-feature)检测到该 phase 时 MUST 报错并打印手动收尾指引(该判定不进引擎)。

#### Scenario: readState 路径规范化
- **WHEN** state 文件含 `pending_operation.command = "finish"`,经 feature-progress 等 readState 路径读取
- **THEN** 输出中该值 MUST 为 `finishing-feature`

#### Scenario: listActiveFeatures 路径规范化
- **WHEN** state 文件含 `pending_operation.command = "develop-complete"`,经 reconcile(走 listActiveFeatures)读取
- **THEN** 输出中该值 MUST 为 `finishing-worktree`,`--resume` 按新命令名匹配 MUST 命中

#### Scenario: waiting_display_pr 不可续跑
- **WHEN** finishing-feature 检测到 `pending_operation.phase = "waiting_display_pr"`
- **THEN** 命令 MUST 报错退出并打印手动收尾指引(该挂起态依赖已删除的 display 分支,无法自动续跑)

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
- `knowledge_tools`: 数组,init 探测并经用户确认登记的代码知识库工具(可为空数组)

可选字段:`hooks`(事件名 → shell 命令字符串;缺失视为全部事件无 hook,见 hook-event-integration)。

`display`、`spec_tools`、`untracked_permanent` 三个 v1 字段 MUST NOT 出现在 `version: 2` 的 config 中。

#### Scenario: 首次 init 后字段齐备
- **WHEN** 用户执行 `/speccode:init` 并完成所有询问
- **THEN** `.speccode/config.json` MUST 存在,`version` 为 `2`,包含上述全部字段(hooks 仅在用户选择配置时存在)

#### Scenario: v1 升级 v2 的字段 diff
- **WHEN** v1 config(含 display/spec_tools/untracked_permanent)存在时二次执行 init
- **THEN** 命令 MUST 逐字段展示 diff:三个旧字段标记移除、三个新字段标记新增,经用户确认后写入

#### Scenario: 拒绝升级则整体保持 v1
- **WHEN** 二次 init 时用户拒绝对 config 的任何修改
- **THEN** config MUST 保持 v1 原样(`version: 1`);一旦接受升级(`version: 2`),三个旧字段 MUST 被移除,不存在「version: 2 但保留旧字段」的混合态

### Requirement: 对账算法

每个涉及 worktree 的命令(`/speccode:creating-worktree`、`/speccode:finishing-worktree`、`/speccode:finishing-feature`、`/speccode:status`)开头 MUST 执行「config ↔ git」对账,扫描 `git worktree list --porcelain` 与 `state/features/*.json`,自动补齐/标记不一致项,并推进 `pr_open` 的 worktree。对账使用的 worktree 前缀 MUST 读自 `config.worktree_prefix`,config 缺失时 MUST 回退默认值 `"worktree-"`,对账 MUST NOT 因 config 缺失而失败。

#### Scenario: worktree 在 git 中但不在 state 中
- **WHEN** git worktree list 含 `worktree-payment-api` 但 state 中无记录
- **THEN** 对账 MUST 自动补齐到对应 feature 的 worktrees,`status=in_progress`

#### Scenario: worktree 在 state 中但不在 git 中
- **WHEN** state 中有 `worktree-xxx` 但 git worktree list 不存在
- **THEN** 对账 MUST 标 `orphaned`,提示用户手动处理

#### Scenario: ancestor 判定自动关联
- **WHEN** git 存在 worktree 分支 W,任何 state 中都未登记,且 `git merge-base --is-ancestor F.feature_branch W` 对某个 feature F 成立
- **THEN** 对账 MUST 将 W 自动补到 F 的 worktrees

#### Scenario: 多 feature 冲突
- **WHEN** 同一 worktree 分支 W 同时是 feature/payment 与 feature/auth 的祖先
- **THEN** 对账 MUST 报错退出,要求用户通过 `worktree_overrides` 显式指定

#### Scenario: 对账推进 pr_open worktree
- **WHEN** 对账遇到状态为 `pr_open` 的 worktree,且查询其 `pr_number` 得到 MERGED
- **THEN** 对账 MUST 把该 worktree 推进为 `completed`(记 `completed_at`)并清理 worktree(remove + branch -D)

#### Scenario: 对账回退被关闭的 pr_open
- **WHEN** 对账遇到 `pr_open` 的 worktree,但其 PR 状态为 CLOSED(未合并)
- **THEN** 对账 MUST 把该 worktree 回退为 `in_progress` 并提示用户 PR 已关闭

#### Scenario: 无 config 时对账不崩溃
- **WHEN** `.speccode/config.json` 不存在
- **THEN** 对账 MUST 以默认前缀 `worktree-` 正常执行,不报错退出

### Requirement: worktree 状态枚举

`state/features/*.json` 中每个 worktree 的 `status` MUST ∈ `{pending, in_progress, pr_open, completed}`。`pr_open` 表示已创建 PR/MR 但尚未合并,此时 worktree 条目 MUST 记录 `pr_number`。

#### Scenario: PR 不等待模式置为 pr_open
- **WHEN** `finishing-worktree` 选择「PR 但不等待」路径并成功创建 PR
- **THEN** 该 worktree 状态 MUST 为 `pr_open`,且条目 MUST 含 `pr_number`

#### Scenario: completed 记录时间
- **WHEN** 某 worktree 合并完成
- **THEN** 其 `status` MUST 为 `completed` 且 MUST 含 `completed_at`(ISO 8601 UTC)

### Requirement: pending_operation 挂起状态

当长阻塞操作(等 PR 合并)超时或被中断时,命令 MUST 把挂起状态写入对应 feature state 文件的 `pending_operation` 字段,结构为 `{ command, phase, pr_number, updated_at }`,其中 `command` MUST ∈ `{finishing-worktree, finishing-feature}`,`phase` MUST ∈ `{waiting_worktree_pr, waiting_trunk_pr}`(新写入只允许这两个值;legacy 数据中的 `waiting_display_pr` 按「legacy pending_operation 规范化」处理,不属新写入枚举)。`--resume` MUST 从该字段恢复。

#### Scenario: finishing-feature 超时写入挂起状态
- **WHEN** `/speccode:finishing-feature` 等待 PR→trunk 合并超时
- **THEN** feature state 文件 MUST 含 `pending_operation.command = "finishing-feature"`、`phase = "waiting_trunk_pr"` 及对应 `pr_number`

#### Scenario: resume 从挂起状态续跑
- **WHEN** 用户执行 `/speccode:finishing-feature --resume` 且该 feature 存在 `pending_operation`
- **THEN** 命令 MUST 从 `phase` 指示的步骤继续,不重复已完成的阶段

#### Scenario: 成功完成清除挂起状态
- **WHEN** finishing-feature 或 finishing-worktree 全部成功完成
- **THEN** `pending_operation` 字段 MUST 被清除(或随 feature state 文件删除而消失)
