## ADDED Requirements

### Requirement: pr_tool 探测
`/speccode:init` MUST 通过 `git remote get-url origin` 探测远端类型,匹配规则:
- URL 含 `github.com` → 默认 `pr_tool = "gh"`
- URL 含 `gitlab` → 默认 `pr_tool = "glab"`
- 其他 → 默认 `pr_tool = "none"`

#### Scenario: GitHub 远端探测
- **WHEN** `git remote get-url origin` 输出 `git@github.com:foo/bar.git`
- **THEN** 默认 `pr_tool` MUST 为 `"gh"`

#### Scenario: GitLab 远端探测
- **WHEN** `git remote get-url origin` 输出 `https://gitlab.com/foo/bar.git`
- **THEN** 默认 `pr_tool` MUST 为 `"glab"`

#### Scenario: 未知远端
- **WHEN** `git remote get-url origin` 输出 `git@bitbucket.org/foo/bar.git`
- **THEN** 默认 `pr_tool` MUST 为 `"none"`,并在 init 询问时建议用户确认

### Requirement: pr_tool 安装校验
`/speccode:init` 在确定 pr_tool 后 MUST 探测该 CLI 是否已安装(`command -v gh` / `command -v glab`),未安装则降级为 `"none"` 并提示用户。

#### Scenario: gh 未安装
- **WHEN** 探测结果应为 `gh` 但 `command -v gh` 退出码非 0
- **THEN** `config.pr_tool` MUST 被写为 `"none"`,init 输出 MUST 包含"建议安装 gh CLI"的提示

#### Scenario: glab 已安装
- **WHEN** 探测结果应为 `glab` 且 `command -v glab` 退出码为 0
- **THEN** `config.pr_tool` MUST 写为 `"glab"`

### Requirement: PR/MR 创建
`/speccode:develop-complete` 与 `/speccode:finish` 在 `config.pr_tool != "none"` 时 MUST 用对应 CLI 创建 PR/MR。

#### Scenario: 使用 gh 创建 PR
- **WHEN** `config.pr_tool = "gh"` 且需创建 PR (head=worktree-x, base=feature-y)
- **THEN** 命令 MUST 触发 `gh pr create --base feature-y --head worktree-x --title <title> --body <body>`

#### Scenario: 使用 glab 创建 MR
- **WHEN** `config.pr_tool = "glab"` 且需创建 MR
- **THEN** 命令 MUST 触发 `glab mr create --target-branch feature-y --source-branch worktree-x --title <title> --description <body>`

### Requirement: PR base 同步
`/speccode:develop-complete` 在创建 PR/MR 前 MUST 先 `git push origin <feature>`,保证 PR/MR 的 base 分支(feature)在远端为最新,避免多 worktree 串行时 base 过期导致 diff 混入他人成果。

#### Scenario: 开 PR 前同步 feature
- **WHEN** develop-complete 走 PR 路径,本地 feature 领先 origin/feature(如上一个 worktree 已本地合入)
- **THEN** 命令 MUST 先 `git push origin <feature>` 再创建 PR,使 base 含最新成果

#### Scenario: feature 远端分叉
- **WHEN** `git push origin <feature>` 遇到 non-fast-forward(feature 被 rebase/amend 过)
- **THEN** 命令 MUST 中止并提示用户处理分叉,不强推 feature

### Requirement: PR 不等待模式置 pr_open
`/speccode:develop-complete` 选择"PR 但不等待"(路径 2)时 MUST 创建 PR 后立即返回,把对应 worktree 状态置为 `pr_open` 并记录 `pr_number`,不清理 worktree,不阻塞。

#### Scenario: PR 不等待返回
- **WHEN** 用户选择路径 2 且 PR 成功创建
- **THEN** worktree 状态 MUST 为 `pr_open`,worktree 目录与分支 MUST 保留(等后续对账推进)

### Requirement: wait_for_pr_merge 轮询
`wait_for_pr_merge` MUST 每 30 秒轮询一次 PR/MR 状态,默认 30 分钟超时(约 60 次查询);`--resume` 续跑时 MUST 使用相同轮询间隔。

#### Scenario: 轮询间隔
- **WHEN** `wait_for_pr_merge` 处于等待中
- **THEN** 相邻两次状态查询的间隔 MUST 约为 30 秒,以避免触发平台 API rate limit

#### Scenario: 超时中止
- **WHEN** 达到 30 分钟仍未 MERGED
- **THEN** MUST 中止并把挂起状态写入 feature state 的 `pending_operation` 字段

### Requirement: PR 状态查询
`wait_for_pr_merge` MUST 按 pr_tool 调用对应查询命令获取 PR 状态。

#### Scenario: gh 查询 PR 状态
- **WHEN** `pr_tool = "gh"`
- **THEN** MUST 调用 `gh pr view <head> --json state,mergedAt,mergeCommit` 并解析返回 JSON

#### Scenario: glab 查询 MR 状态
- **WHEN** `pr_tool = "glab"`
- **THEN** MUST 调用 `glab mr view <head> --output json` 并解析返回 JSON

### Requirement: pr_tool=none 降级
当 `config.pr_tool = "none"` 时,`/speccode:finish` 与 `/speccode:develop-complete` MUST 不实际创建 PR,而是打印等效的 `gh` / `glab` 命令让用户手动执行。

#### Scenario: 降级输出
- **WHEN** `config.pr_tool = "none"` 且 finish 进入 PR 创建步骤
- **THEN** 命令 MUST 在终端输出形如 `请手动执行: gh pr create --base master --head feature/payment --title "..."` 的提示,并中止 finish 流程

### Requirement: 本地 merge 模式
`/speccode:develop-complete` 在用户选择"本地 squash merge"模式时 MUST 不调用任何 pr_tool 命令,直接 `git merge --squash` + `git commit` 完成合并。

#### Scenario: 本地 squash
- **WHEN** 用户选择路径 3(本地 squash merge),`<wt_path>` 为该 worktree 的目录路径
- **THEN** 命令 MUST `git checkout <feature>; git merge --squash <worktree>; git commit -m "<msg>"; git worktree remove <wt_path> --force; git branch -D <worktree>`,不调用 pr_tool
