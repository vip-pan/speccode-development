# hook-event-integration Delta

## MODIFIED Requirements

### Requirement: run-hook verb 与调用节点

引擎 SHALL 暴露 `run-hook --event <name>` verb(事件载荷片段经 stdin 传入,引擎补齐 envelope 字段)。各命令 MUST 在对应生命周期节点调用:exploring→onExplored、creating-feature→onFeatureCreated、creating-worktree→onWorktreeCreated、proposing→onProposed、brainstorming→onBrainstormed、writing-plans→onPlanned、applying 每条 tasks.md 条目完成→onTaskCompleted、SDD/executing-plans 每个 task 完成→onTaskCompleted、requesting-code-review→onCodeReviewRequested、receiving-code-review→onCodeReviewCompleted、finishing-worktree→onWorktreeFinished(PR 创建后另触发 onPrOpened)、finishing-feature→onFeatureFinished(及 onPrOpened)、syncing→onSynced、archiving→onArchived。

#### Scenario: 命令在节点触发对应事件
- **WHEN** creating-feature 成功创建功能分支并登记 state
- **THEN** 命令 MUST 以 event=onFeatureCreated 调用 run-hook

#### Scenario: PR 创建后触发 onPrOpened
- **WHEN** finishing-worktree 或 finishing-feature 成功创建 PR
- **THEN** 命令 MUST 以 event=onPrOpened、载荷含 pr_number 调用 run-hook

#### Scenario: SDD 每个 task 完成触发 onTaskCompleted
- **WHEN** subagent-driven-development 或 executing-plans 中一个 task 完成
- **THEN** 命令 MUST 以 event=onTaskCompleted、载荷含 task 编号调用 run-hook

#### Scenario: applying 每条完成触发 onTaskCompleted
- **WHEN** applying 完成并勾选 tasks.md 的一条条目
- **THEN** 命令 MUST 以 event=onTaskCompleted、载荷含条目序号调用 run-hook
