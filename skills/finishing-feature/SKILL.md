---
description: "opt-in 大需求终局:集成分支 → trunk 单 PR(children 全 completed 门禁,阻塞等合并),删父实体 state 后切回 trunk"
---

大需求终局:集成分支 → trunk 单 PR。**opt-in 命令**,仅父实体(kind:integration)使用。全程中文交互。支持 `--resume`。

## 前置

1. `read-config`;为 null → 提示 init。
2. HEAD 必须在功能分支(`<type>/<slug>`);否则退出。
3. `reconcile --cwd . --advance-pr`;orphans 中有本父实体残留 → 提示先清理。
4. 读父实体 state:必须 `kind:"integration"`;否则报错「本命令仅适用于大需求集成分支,普通分支用 finishing-worktree」并退出。

## 门禁(children 全 completed,派生读取)

1. 对 `children` 中每个 slug 读其子分支 state;任一状态 ∈ `{pending, in_progress, pr_open}` → 阻止,列出未完成项(pr_open 附 PR 号)。
2. children 有 slug 但无对应子 state → 视为 `pending`(计划未开工),同样阻止。
3. 全部 completed → 放行。

## 单 PR 流程(integration → trunk)

1. `git push origin <branch>`;non-fast-forward → 中止。
2. 建 PR 前探测 `repo-merge-config`(squashOnly:false → 警告 + 指路,不阻断)。
3. pr_tool 建 PR(base=trunk, head=集成分支);`pr_tool=none` → 打印等效命令并中止。
4. onPrOpened 钩子。
5. 阻塞等待(每 30s query-pr,超时 30min):MERGED → 收尾;CLOSED/CONFLICTING → 报错退出;UNKNOWN 连续 3 次中止;TIMEOUT → 写 `pending_operation{command:"finishing-feature", phase:"waiting_trunk_pr", pr_number}` 提示 `--resume`。

## 收尾

1. `delete-state --branch <集成分支>`(父实体 state;子分支 state 已随各自 finishing-worktree 完成/清理)。
2. onFeatureFinished 钩子。
3. `git checkout <config.trunk>` + `fetch & pull`(集成分支与子分支保留作历史,speccode 不删)。
4. 打印:大需求已交付,`<branch>` 已合并进 trunk。
5. 写记忆(经用户确认或内置判据)。
