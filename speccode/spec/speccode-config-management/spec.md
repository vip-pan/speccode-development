## Purpose

`.speccode/config.json` 与 `state/branches/*.json` 的读写策略:字段集、按分支维度隔离、原子写、备份、init 字段级幂等与 v2→v3 迁移、路径识别对账、worktree 状态枚举、pending_operation 挂起态、ISO 8601 时间戳。

## Requirements

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

### Requirement: state/branches 文件隔离

每条 active 分支 MUST 有独立的 `.speccode/state/branches/<type>__<slug>.json` 文件,文件名格式 MUST 为 `<type>__<slug>`(type 与 slug 之间用双下划线 `__` 分隔;slug 内的连字符保留)。普通分支 state MUST 含 `branch`(全名)、`type`、`worktree`(worktree 绝对路径;唯一例外:迁移自 v2 且无在册 worktree 的分支允许为 `null`,见「state v2 兼容读取与迁移」)、`merge_target`(恒写:普通分支 MUST 写 config.trunk,集成分支的子分支 MUST 写其集成分支名)、`status`、`created_at`、`initial_branch`;父实体 state MUST 含 `branch`、`kind: "integration"`、`children`(数组,条目仅 `{slug}` 纯身份登记——状态不存于父实体,唯一真源为各子分支 state)、`status`、`created_at`、`initial_branch`,MUST NOT 含 `worktree`。

#### Scenario: 并行多个分支
- **WHEN** 用户并行开发 feature/payment 与 feature/auth
- **THEN** `.speccode/state/branches/` 下 MUST 存在 `feature__payment.json` 与 `feature__auth.json` 两个独立文件

#### Scenario: 父实体不含 worktree 字段
- **WHEN** 集成分支 `feature/mkt-req` 的父实体 state 被读取
- **THEN** 该 state MUST 含 `kind: "integration"` 与 `children` 数组,MUST NOT 含 `worktree` 字段

#### Scenario: slug 含连字符不撞名
- **WHEN** 用户开发 feature/pay-ment
- **THEN** state 文件 MUST 为 `feature__pay-ment.json`,双下划线保证 type 与 slug 分隔无歧义

### Requirement: state v2 兼容读取与迁移

引擎 MUST 双格式运行:`state/features/` 下的 v2 遗留文件(含 `feature_branch`、`worktrees{}`、`worktree_overrides` 字段)MUST 按 **v2 语义原样读写**(既有行为不变,旧命令继续可用;`normalizeState()` 按目录与字段形态识别格式,v2 侧既有 legacy command 规范化保留),v3 命令只读写 `state/branches/`;v2 数据 MUST NOT 被实时翻译为 v3 形状。迁移 MUST 仅发生在 `/speccode:init`:检测到 `state/features/` 存在时 MUST 展示迁移预览(逐文件的 v2→v3 转换说明)并经用户确认,确认后经 `migrate-state` verb 逐文件转换为 v3 格式移入 `state/branches/`、清空原目录,并经 reconcile 验证;用户拒绝时 MUST 保持 v2 原样且读路径继续兼容。静默自动迁移 MUST NOT 发生;迁移前 config 备份机制照常适用。迁移跳过规则:worktrees 多于一条、单 worktree 状态非 completed(在途)、缺 `feature_branch`、或 v3 目标文件已存在的文件 MUST 跳过并报告;迁移产物 `worktree: null`。

#### Scenario: 双格式运行
- **WHEN** `state/features/`(v2)与 `state/branches/`(v3)同时存在
- **THEN** v2 命令流 MUST 按 v2 语义读写旧文件,v3 命令流 MUST 按 v3 语义读写新文件,互不干扰,均不报错

#### Scenario: init 一次性迁移
- **WHEN** init 检测到 `state/features/` 目录且用户确认迁移
- **THEN** 可迁移文件 MUST 被转换为 v3 格式移入 `state/branches/`,跳过文件 MUST 保留并报告(在途/多 worktree/畸形/目标已存在),迁移结果 MUST 经 reconcile 验证

#### Scenario: 在途 feature 被跳过
- **WHEN** 某 v2 文件含单个 status 为 `in_progress` 的 worktree 条目
- **THEN** 迁移 MUST 跳过该文件并报告(其 worktree 状态与 PR 号不得被静默丢弃)

#### Scenario: 拒绝迁移保持 v2
- **WHEN** init 提供迁移而用户拒绝
- **THEN** `state/features/` MUST 原样保留,读路径 MUST 继续按 v2 语义兼容工作

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

### Requirement: worktree 状态枚举

`state/branches/*.json` 中每条分支(含父实体 `children` 清单条目)的 `status` MUST ∈ `{pending, in_progress, pr_open, completed}`。`pr_open` 表示已创建 PR/MR 但尚未合并,此时 state MUST 记录 `pr_number`。

#### Scenario: PR 不等待模式置为 pr_open
- **WHEN** `finishing-worktree` 选择「PR 但不等待」路径并成功创建 PR
- **THEN** 该分支状态 MUST 为 `pr_open`,且 state MUST 含 `pr_number`

#### Scenario: completed 记录时间
- **WHEN** 某分支合并完成
- **THEN** 其 state `status` MUST 为 `completed` 且 MUST 含 `completed_at`(ISO 8601 UTC);父实体 `children` 仅身份登记,MUST NOT 被写(状态由子 state 派生)

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

### Requirement: 时间戳格式
所有时间字段(`initialized_at`、`created_at`、`completed_at`) MUST 使用 ISO 8601 UTC 格式(如 `2026-07-08T12:34:56Z`)。

#### Scenario: 时间格式校验
- **WHEN** 任何时间字段被写入
- **THEN** 该字段值 MUST 能被 `Date.parse()` 解析为合法日期

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
