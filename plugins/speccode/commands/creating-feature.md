---
name: "SpecCode: Creating Feature"
description: "从主干分支(trunk)切出功能分支并推送,登记 state"
category: Workflow
tags: [speccode, workflow, feature]
---

创建一个新的功能分支。全程中文交互。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. 校验当前 HEAD(`git rev-parse --abbrev-ref HEAD`)必须等于 `config.trunk`;不符 → 提示 `git checkout <trunk>` 后退出。

## 决定分支名

1. 扫描 `openspec/changes/`(存在未 archive 的 change)与 `docs/superpowers/specs/`(最近 design),尝试从内容推断 type:
   - 新功能 → `feature`;修 bug → `bugfix`;重构 → `refactor`;杂项 → `chore`。
2. 若扫描不到,用 AskUserQuestion 询问 type 与 slug。
3. **校验 slug**:必须匹配 `^[a-z0-9-]+$`;非法 → 拒绝并提示合法字符集。
   - 组合分支名 `<type>/<slug>`,再次确认恰好一个 `/`。

## 处理已存在

- `git rev-parse --verify <branch>` 命中(本地已存在)→ 询问切过去还是改名。
- `git ls-remote origin <branch>` 命中(远端已存在)→ 询问本地新建追踪还是拉取。

## 创建

1. `git checkout -b <branch>`(从 trunk)。
2. `git push -u origin <branch>`。
3. 写 state:通过 `echo '<json>' | speccode.mjs write-state --cwd . --branch <branch> --json-stdin`,内容含 `feature_branch`、`created_at`(ISO UTC)、`initial_branch`(= config.trunk)、`status:"in_progress"`、`worktrees:{}`。
4. 打印:已创建 <branch>,下一步 `/speccode:creating-worktree`。
