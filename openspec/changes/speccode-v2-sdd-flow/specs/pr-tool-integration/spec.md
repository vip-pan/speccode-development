## ADDED Requirements

### Requirement: query-pr 单次查询 verb

引擎 SHALL 暴露 `query-pr --number <N> --cwd .` verb,返回 `{ok: true, state}`,其中 `state` MUST ∈ `{MERGED, OPEN, CLOSED, CONFLICTING, UNKNOWN}`;`config.pr_tool = "none"` 或 config 缺失时 MUST 返回 `{ok: false}` 并提示原因(缺 config 时提示先执行 `/speccode:init`)。引擎 MUST NOT 提供阻塞式等待 verb——PR 等待轮询 MUST 留在命令层,以 `query-pr` 单次查询为基础实现。

#### Scenario: 单次查询返回状态
- **WHEN** `pr_tool = "gh"` 且 PR #42 已合并
- **THEN** `query-pr --number 42` MUST 返回 `{ok: true, state: "MERGED"}`

#### Scenario: 冲突状态映射
- **WHEN** `pr_tool = "gh"` 且 PR 存在合并冲突(`mergeable` 为 `CONFLICTING`)
- **THEN** `query-pr` MUST 返回 `state: "CONFLICTING"`(glab 以其对应冲突标记映射)

#### Scenario: pr_tool=none 报错
- **WHEN** `config.pr_tool = "none"`
- **THEN** `query-pr` MUST 返回 `{ok: false}` 及原因说明

#### Scenario: config 缺失报错
- **WHEN** `.speccode/config.json` 不存在
- **THEN** `query-pr` MUST 返回 `{ok: false}` 并提示先执行 `/speccode:init`

#### Scenario: 引擎无阻塞等待 verb
- **WHEN** 检查引擎 verb 清单
- **THEN** MUST NOT 存在任何阻塞等待 PR 合并的 verb(轮询循环只出现在命令 prose 中)

## MODIFIED Requirements

### Requirement: PR/MR 创建

`/speccode:finishing-worktree` 与 `/speccode:finishing-feature` 在 `config.pr_tool != "none"` 时 MUST 用对应 CLI 创建 PR/MR。

#### Scenario: 使用 gh 创建 PR
- **WHEN** `config.pr_tool = "gh"` 且需创建 PR (head=worktree-x, base=feature-y)
- **THEN** 命令 MUST 触发 `gh pr create --base feature-y --head worktree-x --title <title> --body <body>`

#### Scenario: 使用 glab 创建 MR
- **WHEN** `config.pr_tool = "glab"` 且需创建 MR
- **THEN** 命令 MUST 触发 `glab mr create --target-branch feature-y --source-branch worktree-x --title <title> --description <body>`

### Requirement: PR base 同步

`/speccode:finishing-worktree` 在创建 PR/MR 前 MUST 先 `git push origin <feature>`,保证 PR/MR 的 base 分支(feature)在远端为最新,避免多 worktree 串行时 base 过期导致 diff 混入他人成果。

#### Scenario: 开 PR 前同步 feature
- **WHEN** finishing-worktree 走 PR 路径,本地 feature 领先 origin/feature(如上一个 worktree 已本地合入)
- **THEN** 命令 MUST 先 `git push origin <feature>` 再创建 PR,使 base 含最新成果

#### Scenario: feature 远端分叉
- **WHEN** `git push origin <feature>` 遇到 non-fast-forward(feature 被 rebase/amend 过)
- **THEN** 命令 MUST 中止并提示用户处理分叉,不强推 feature

### Requirement: PR 不等待模式置 pr_open

`/speccode:finishing-worktree` 选择「PR 但不等待」路径时 MUST 创建 PR 后立即返回,把对应 worktree 状态置为 `pr_open` 并记录 `pr_number`,不清理 worktree,不阻塞。

#### Scenario: PR 不等待返回
- **WHEN** 用户选择 PR 不等待路径且 PR 成功创建
- **THEN** worktree 状态 MUST 为 `pr_open`,worktree 目录与分支 MUST 保留(等后续对账推进)

### Requirement: wait_for_pr_merge 轮询

PR 等待轮询 MUST 在命令层以引擎 `query-pr` verb 单次查询为基础实现:每 30 秒轮询一次 PR/MR 状态,默认 30 分钟超时(约 60 次查询);`--resume` 续跑时 MUST 使用相同轮询间隔。(v1 的阻塞式 `wait_for_pr_merge` 引擎函数已随 `lib/waitmerge.mjs` 删除,本 requirement 标题保留,语义迁移为命令层轮询。)

#### Scenario: 轮询间隔
- **WHEN** 命令处于 PR 等待中
- **THEN** 相邻两次 `query-pr` 查询的间隔 MUST 约为 30 秒,以避免触发平台 API rate limit

#### Scenario: 超时中止
- **WHEN** 达到 30 分钟仍未 MERGED
- **THEN** MUST 中止并把挂起状态写入 feature state 的 `pending_operation` 字段

### Requirement: PR 状态查询

`query-pr` verb 与命令层轮询 MUST 按 pr_tool 调用对应查询命令获取 PR 状态,并解析为 MERGED / OPEN / CLOSED / CONFLICTING / UNKNOWN。`--number` 与按 head ref 查询 MUST 都被支持(gh/glab 均支持按编号查询)。

#### Scenario: gh 查询 PR 状态
- **WHEN** `pr_tool = "gh"`
- **THEN** MUST 调用 `gh pr view <number-or-head> --json state,mergedAt,mergeCommit,mergeable` 并解析返回 JSON(含 mergeable → CONFLICTING 映射)

#### Scenario: glab 查询 MR 状态
- **WHEN** `pr_tool = "glab"`
- **THEN** MUST 调用 `glab mr view <number-or-head> --output json` 并解析返回 JSON(含冲突标记 → CONFLICTING 映射)

### Requirement: pr_tool=none 降级

当 `config.pr_tool = "none"` 时,`/speccode:finishing-feature` 与 `/speccode:finishing-worktree` MUST 不实际创建 PR,而是打印等效的 `gh` / `glab` 命令让用户手动执行。

#### Scenario: 降级输出
- **WHEN** `config.pr_tool = "none"` 且 finishing-feature 进入 PR 创建步骤
- **THEN** 命令 MUST 在终端输出形如 `请手动执行: gh pr create --base master --head feature/payment --title "..."` 的提示,并中止流程

### Requirement: 本地 merge 模式

`/speccode:finishing-worktree` 在用户选择「本地 squash merge」模式时 MUST 不调用任何 pr_tool 命令,直接 `git merge --squash` + `git commit` 完成合并。

#### Scenario: 本地 squash
- **WHEN** 用户选择本地 squash merge 路径,`<wt_path>` 为该 worktree 的目录路径
- **THEN** 命令 MUST `git checkout <feature>; git merge --squash <worktree>; git commit -m "<msg>"; git worktree remove <wt_path> --force; git branch -D <worktree>`,不调用 pr_tool
