# git-workflow-lifecycle Delta

## ADDED Requirements

### Requirement: 对账 orphan 判定

对账算法(reconcile)判定 orphan 时,对「state 有登记但 git 缺失」的 worktree 条目 MUST 按状态区分:status 为 `pending`、`in_progress` 或 `pr_open` 的条目 MUST 计为 orphan(登记与真实 git 状态背离,属异常);status 为 `completed` 的条目 MUST NOT 计为 orphan——worktree 完成后其 git 侧被清理(finishing-worktree 的 PR 合并与本地 squash 路径均如此)是设计的正常终态,state 保留 completed 记录供进度核算,直至 finishing-feature 删除 state。

#### Scenario: 未完成且 git 缺失计 orphan
- **WHEN** state 登记某 worktree 为 `in_progress`,而 `git worktree list` 中不存在对应分支
- **THEN** 对账 MUST 把该 worktree 计入 orphans

#### Scenario: completed 且 git 已清理不计 orphan
- **WHEN** state 登记某 worktree 为 `completed`,且其 git 侧 worktree 与分支已被 finishing-worktree 清理
- **THEN** 对账 MUST NOT 把该 worktree 计入 orphans,finishing-feature 门禁 MUST NOT 对其提示「先清理」
