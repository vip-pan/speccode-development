---
description: "opt-in(大需求):从 trunk 切出集成分支并推送,登记父实体 state;普通需求直接用 creating-worktree"
---

创建大需求的集成分支与父实体。**opt-in 命令**:仅当 exploring 形态确认判定为大需求(整体上线)时使用;普通需求直接 `/speccode:creating-worktree`。全程中文交互。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. 校验 HEAD 必须等于 `config.trunk`;不符 → 提示切回后退出。

## 决定分支名

同普通需求命名规则:`<type>/<slug>` 校验;参数直给(合法则采用)→ `list-memory` 选 topic(slug 预填,type 推断)→ 询问;推断 MUST NOT 静默生效。

## 创建

1. `git checkout -b <branch>`(从 trunk);`git push -u origin <branch>`。
2. 写父实体 state:经 `write-state --branch <branch> --json-stdin`,内容 `{branch, type, kind: "integration", children: [], status: "in_progress", created_at, initial_branch: config.trunk}`(**MUST NOT 含 worktree 字段**)。
3. **承接父 topic**(slug=topic 命中):`rename-memory --branch _exploring/<slug> --to <branch> --json-stdin`(stdin `{}`);ok → append 骨架头(创建时间);`not found` → 骨架 replace「无」;`already exists` → 报告跳过。三分支契约同既述。
4. 触发 onFeatureCreated 钩子。
5. 打印:大需求模式已建立,集成分支 `<branch>`;子需求经 `/speccode:creating-worktree` 从本分支切出;终局用 `/speccode:finishing-feature`。
