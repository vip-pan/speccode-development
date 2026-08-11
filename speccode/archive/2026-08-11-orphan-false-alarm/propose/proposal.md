# Proposal: orphan-false-alarm

## Why

reconcile 规则 3 把「state 登记但 git 缺失」的 worktree 一律计为 orphan,不区分状态。但 completed 条目的 git 侧被清理是设计的正常终态(PR 合并/squash 路径都如此),state 保留 completed 记录供进度核算——于是每次 squash 后、finishing-feature 前,门禁对一个已清理的 worktree 提示"先清理"(R2/R3 实测虚警:`orphans: ['worktree-rebrand-visual-companion']` 等)。

## What Changes

- `lib/reconcile.mjs` 规则 3:仅当条目 status ≠ `completed` 且 git 缺失时计 orphan(completed + git 缺失 = 正常终态,不计)
- `tests/reconcile.test.mjs` 新增用例:completed + git 缺失 → 不计 orphan(既有 in_progress 用例保持)
- spec delta:git-workflow-lifecycle ADDED「对账 orphan 判定」(state 侧 orphan 规则首次入契约,含 completed 豁免)
- `CLAUDE.md` 测试计数 134 → 135(新增 1 用例,保持文档诚实)
- 无 BREAKING(orphans 输出收窄为真异常;finishing-feature/creating-worktree 的 orphan 提示只对真残留触发)

## Capabilities

- modified: `git-workflow-lifecycle`

## Impact

- 代码:`plugins/speccode/lib/reconcile.mjs`(1 处条件)、`plugins/speccode/tests/reconcile.test.mjs`(1 新用例)
- 文档:`speccode/spec/git-workflow-lifecycle/spec.md`(经 syncing)、`CLAUDE.md`(计数)
- 行为:`/speccode:status`、finishing-feature 门禁不再对已完成 worktree 报 orphan/提示清理
