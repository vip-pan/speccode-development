# Design: 开发完成收尾路由修正

## Context

- dev-completion 命令(`subagent-driven-development` / `executing-plans`)收尾直接引导 `finishing-worktree`。
- **硬约束**:syncing/archiving 的 trunk 防护要求 worktree-* 分支,而 finishing-worktree 会移除 worktree → sync/archive 只能在 finishing-worktree 之前执行。
- syncing → archiving → finishing-worktree 的链在中间命令已接对(syncing 引导 archiving、archiving 引导 finishing-worktree),缺口仅在 dev-completion 命令的直跳。

## Goals

- dev-completion 收尾按硬约束路由:有文档(`speccode/changes/<slug>/`)→ syncing → archiving → finishing-worktree;无文档 → 直接 finishing-worktree。
- 手动询问 / auto 自动衔接(与 creating-worktree 后续引导先例一致)。
- finishing-worktree 提供安全网:未归档变更 warn-only 提醒。
- 路由规格化,防回归。

## Non-Goals

- 不改变 syncing/archiving 自身行为与 trunk 防护。
- 不自动执行 archiving 内部操作(archiving 保持独立命令,有确认流程)。
- 不强制 finishing-worktree——C 门是 warn-only,用户可跳过。

## Decisions

1. **条件化路由基于 `speccode/changes/<slug>/` 是否存在**(否决:一律先走 syncing/archiving)。理由:syncing/archiving 在无需求目录时报错退出,「暂不落地文档」路径必须直接 finishing-worktree。
2. **手动询问 / auto 自动衔接 syncing**(对齐 creating-worktree 后续引导先例)。理由:与既有命令行为一致,判断依据不充分时默认询问。
3. **C 门 warn-only 不阻断**(用户确认)。理由:安全网而非强制;用户明确跳过时保留自主权。

## Risks

- dev-completion 引导被跳过 → C 门兜底 warn。
- 条件判断(有无文档)误判 → `test -d` 简单且路径确定(`speccode/changes/<slug>/`),误判风险低。
- 多 worktree 场景:某 worktree 已 sync/archive、另一 worktree 仍在开发 → C 门对未归档的 feature 警告,提示其余 worktree 完成前先归档。

## Open Questions

- 无(brainstorm 已定夺:C 门实现 = `test -d` 命令层,与 creating-worktree 标记文件探测先例一致;否决 reconcile 透出字段)。
