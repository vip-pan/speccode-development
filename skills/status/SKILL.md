---
description: "只读总览:所有 active 分支的进度与 pending_operation,父实体按 children 实时派生子分支状态,附 config 摘要"
---

显示 speccode 当前全局状态。纯只读(除对账自愈外无副作用)。

## 流程

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. 开头跑对账,汇总 `.speccode/state/branches/` 下所有 active 分支:普通分支渲染状态与 `pending_operation`;父实体(`kind:"integration"`)以树状渲染 `children`——各子分支的 status **实时读取对应子分支 state 派生**,children 有 slug 但无子 state 的渲染为 `pending`(计划未开工)。v2 遗留(`state/features/`)条目按原样列出并标注「v2 待迁移」。(对账 verb:`speccode reconcile --cwd . --advance-pr`,顺便自愈状态漂移、查询 PR 状态并推进已合并的 pr_open。)
3. 报告 `orphans` / `conflicts`(若有),提示如何处理。
4. 末尾打印 config 摘要:`trunk / pr_tool`。
5. 若无 active 分支:打印"当前无 active 分支",仅显示 config 摘要。

## 输出示例(供格式参考)

```
speccode — 4 active 分支
● feature/payment (from master) completed
● feature/auth (from master) in_progress
    ⏸ pending: finishing-worktree(waiting_worktree_pr, PR #51)
● feature/shop-rework (from master) in_progress(父实体)
    ✓ feature/shop-cart      completed
    ⧗ feature/shop-pay       pr_open (PR #52)
    · feature/shop-report    pending(计划未开工)
○ feature/legacy (from master) in_progress(v2 待迁移)
config: trunk=master pr_tool=gh
```
