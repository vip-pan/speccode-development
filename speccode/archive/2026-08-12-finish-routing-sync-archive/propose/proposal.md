# Proposal: 开发完成收尾路由修正(sync → archive → finish)

## Why

`/speccode:subagent-driven-development` 与 `/speccode:executing-plans` 完成后直接引导 `/speccode:finishing-worktree`,跳过 syncing 与 archiving。但 syncing/archiving 的 trunk 防护要求 worktree-* 分支,而 finishing-worktree 会 `git worktree remove` 移除 worktree——sync/archive 只能在 finishing-worktree **之前**执行。当前引导把 sync/archive 逼进死路,与实际开发流程初衷(先同步规格、归档变更,再收尾 worktree)不符。

## What Changes

- `subagent-driven-development.md`:收尾(:292)改为条件化路由——有落地文档(`speccode/changes/<slug>/` 存在)→ 先 syncing → archiving → 再 finishing-worktree;无 → 直接 finishing-worktree;流程图节点(:78/:107)与示例(:371)同步;手动询问 / auto 自动衔接 syncing。
- `executing-plans.md`:第 3 步完成开发(:58-59)改为同样条件化路由 + 手动/auto。
- `finishing-worktree.md`:合并选项前新增 warn-only 检查——`speccode/changes/<slug>/` 存在未归档 → 警告「建议先执行 /speccode:syncing 与 /speccode:archiving」,不阻断。
- `creating-worktree.md`:暂不落地文档路径(:53)核对与 A 一致(无文档 → 直接 finishing-worktree)。
- spec:`git-workflow-lifecycle` ADDED 2 个 requirement(开发完成收尾路由 / finishing-worktree 未归档变更警告)。

## Capabilities

- `git-workflow-lifecycle`(ADDED requirements ×2)

## Impact

- 命令(纯 prose):`subagent-driven-development.md`、`executing-plans.md`、`finishing-worktree.md`、`creating-worktree.md`
- spec:`git-workflow-lifecycle`(开发完成收尾路由 + 未归档变更警告)
- 用户:开发完成后按正确顺序收到引导;误跳过 sync/archive 时收到 warn 提醒(不阻断)。
- 无 BREAKING。
