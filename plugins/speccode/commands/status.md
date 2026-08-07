---
name: "SpecCode: Status"
description: "只读总览:所有 active feature 的 worktree 进度、pending_operation、config 摘要"
category: Workflow
tags: [speccode, workflow, status]
---

显示 speccode 当前全局状态。纯只读(除对账自愈外无副作用)。

## 流程

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. 跑 `speccode.mjs reconcile --cwd . --advance-pr`(顺便自愈状态漂移、查询 PR 状态并推进已合并的 pr_open)。
3. 用返回的 `features` 汇总:
   - 每个 feature:`<branch>(from <initial>) X/Y done`。
   - 每个 worktree 一行:状态图标 + 名称 + status。
   - 若该 feature 有 `pending_operation`,单独一行:`⏸ pending: <command>(<phase>, PR #<n>)`。
4. 报告 `orphans` / `conflicts`(若有),提示如何处理。
5. 末尾打印 config 摘要:`trunk / pr_tool`。
6. 若无 active feature:打印"当前无 active feature",仅显示 config 摘要。

## 输出示例(供格式参考)

```
speccode — 2 active features
● feature/payment (from master) 2/3 done
    ✓ worktree-payment           completed
    ✓ worktree-payment-api       completed
    ○ worktree-payment-dashboard in_progress
● feature/auth (from master) 0/1 done
    ⧗ worktree-auth              pr_open (PR #51)
config: trunk=master pr_tool=gh
```
