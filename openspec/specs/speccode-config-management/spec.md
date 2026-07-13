## Purpose

`.speccode/config.json` 与 `state/features/*.json` 的读写策略:字段集、按 feature 维度隔离、原子写、备份、init 字段级幂等、对账算法、worktree_overrides、worktree 状态枚举、pending_operation 挂起态、ISO 8601 时间戳。

## Requirements

### Requirement: config.json 字段集
`.speccode/config.json` MUST 包含以下字段:
- `version: 1`
- `initialized_at`: ISO 8601 UTC 时间戳
- `trunk`: 主干分支名,默认 `"master"`
- `remote`: git remote 名,默认 `"origin"`
- `display`: `{ enabled: boolean, branch: string | null }`
- `pr_tool`: `"gh" | "glab" | "none"`
- `spec_tools`: `{ openspec: { enabled, doc_dir }, superpowers: { enabled, doc_dir } }`,key 可选
- `untracked_permanent`: 字符串数组
- `worktree_prefix`: 默认 `"worktree-"`

#### Scenario: 首次 init 后字段齐备
- **WHEN** 用户执行 `/speccode:init` 并完成所有询问
- **THEN** `.speccode/config.json` MUST 存在并包含上述所有字段

### Requirement: state/features 文件隔离
每个 active feature MUST 有独立的 `.speccode/state/features/<type>__<slug>.json` 文件,文件名格式 MUST 为 `<type>__<slug>`(type 与 slug 之间用双下划线 `__` 分隔;slug 内的连字符保留)。

#### Scenario: 并行多个 feature
- **WHEN** 用户并行开发 feature/payment 与 feature/auth
- **THEN** `.speccode/state/features/` 下 MUST 存在 `feature__payment.json` 与 `feature__auth.json` 两个独立文件

#### Scenario: slug 含连字符不撞名
- **WHEN** 用户开发 feature/pay-ment
- **THEN** state 文件 MUST 为 `feature__pay-ment.json`,双下划线保证 type 与 slug 分隔无歧义,不与其他分支撞名

### Requirement: 写文件原子性
任何对 `.speccode/config.json` 或 `state/features/*.json` 的写入 MUST 采用"写临时文件 + `mv` 覆盖"模式,避免半写半旧。

#### Scenario: 写入过程异常退出
- **WHEN** AI 进程在写入 config.json 时被 kill
- **THEN** `config.json` MUST 保持写入前的完整旧内容(由 `mv` 原子性保证),不留半写状态

### Requirement: 备份机制
`/speccode:init` 与 `/speccode:reset` 在覆盖 `config.json` 前 MUST 生成 `config.json.bak.<timestamp>` 备份。

#### Scenario: init 二次执行触发备份
- **WHEN** `.speccode/config.json` 已存在且用户再次执行 `/speccode:init`
- **THEN** 现有 config MUST 被备份为 `config.json.bak.<timestamp>`,再写新内容

#### Scenario: reset 触发备份
- **WHEN** 用户执行 `/speccode:reset`
- **THEN** 当前 config MUST 被备份为 `config.json.bak.<timestamp>`,再清空用户选择清理的字段

### Requirement: init 字段级幂等
`/speccode:init` 二次执行时 MUST 按字段逐个询问 `[旧值]→[新值]` diff,而非整体覆盖。`state/` 目录在二次 init 时 MUST 不被清空。

#### Scenario: 字段未变化
- **WHEN** 二次 init 时某字段值与之前一致
- **THEN** 命令 MUST 跳过该字段,不写入

#### Scenario: 字段值变化
- **WHEN** 二次 init 时 `trunk` 字段从 `"master"` 变为 `"main"`
- **THEN** 命令 MUST 显示 diff 并询问用户确认是否更新,只有用户确认后才写入

#### Scenario: 二次 init 不影响 state
- **WHEN** 二次 init 时 `.speccode/state/features/feature__payment.json` 存在
- **THEN** 该文件 MUST 在 init 过程中不被读取、修改或删除

### Requirement: 对账算法
每个涉及 worktree 的命令(`/speccode:develop-start`、`/speccode:develop-complete`、`/speccode:finish`、`/speccode:status`)开头 MUST 执行"config ↔ git"对账,扫描 `git worktree list --porcelain` 与 `state/features/*.json`,自动补齐/标记不一致项,并推进 `pr_open` 的 worktree。

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

### Requirement: worktree_overrides 显式覆盖
state 文件 MUST 支持 `worktree_overrides: { [worktree_name]: feature_branch }` 字段,显式覆盖 ancestor 判定。

#### Scenario: override 优先于 ancestor
- **WHEN** `state.worktree_overrides["worktree-legacy"] = "feature/payment"` 且 W 也是 feature/auth 的祖先
- **THEN** 对账 MUST 把 W 关联到 feature/payment,不是 feature/auth

### Requirement: worktree 状态枚举
`state/features/*.json` 中每个 worktree 的 `status` MUST ∈ `{pending, in_progress, pr_open, completed}`。`pr_open` 表示已创建 PR/MR 但尚未合并,此时 worktree 条目 MUST 记录 `pr_number`。

#### Scenario: PR 不等待模式置为 pr_open
- **WHEN** `develop-complete` 选择"PR 但不等待"路径并成功创建 PR
- **THEN** 该 worktree 状态 MUST 为 `pr_open`,且条目 MUST 含 `pr_number`

#### Scenario: completed 记录时间
- **WHEN** 某 worktree 合并完成
- **THEN** 其 `status` MUST 为 `completed` 且 MUST 含 `completed_at`(ISO 8601 UTC)

### Requirement: pending_operation 挂起状态
当长阻塞操作(等 PR 合并)超时或被中断时,命令 MUST 把挂起状态写入对应 feature state 文件的 `pending_operation` 字段,结构为 `{ command, phase, pr_number, complete_branch?, updated_at }`。`--resume` MUST 从该字段恢复。

#### Scenario: finish 超时写入挂起状态
- **WHEN** `/speccode:finish` 等待 PR→trunk 合并超时
- **THEN** feature state 文件 MUST 含 `pending_operation.command = "finish"`、`phase = "waiting_trunk_pr"` 及对应 `pr_number`、`complete_branch`

#### Scenario: resume 从挂起状态续跑
- **WHEN** 用户执行 `/speccode:finish --resume` 且该 feature 存在 `pending_operation`
- **THEN** 命令 MUST 从 `phase` 指示的步骤继续,不重复已完成的阶段

#### Scenario: 成功完成清除挂起状态
- **WHEN** finish 或 develop-complete 全部成功完成
- **THEN** `pending_operation` 字段 MUST 被清除(或随 feature state 文件删除而消失)

### Requirement: 时间戳格式
所有时间字段(`initialized_at`、`created_at`、`completed_at`) MUST 使用 ISO 8601 UTC 格式(如 `2026-07-08T12:34:56Z`)。

#### Scenario: 时间格式校验
- **WHEN** 任何时间字段被写入
- **THEN** 该字段值 MUST 能被 `Date.parse()` 解析为合法日期
