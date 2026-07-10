---
name: "SpecCode: Develop Start"
description: "从功能分支切出 worktree 开发分支(git worktree),登记 state"
category: Workflow
tags: [speccode, workflow, worktree]
---

创建开发用的 worktree 分支。全程中文交互。

## 前置

1. `read-config` 加载 config。
2. HEAD 必须在功能分支(`feature/` `bugfix/` `refactor/` `chore/` 之一);否则提示退出。
3. 运行 `reconcile --cwd .`:
   - `conflicts` 非空 → 报告冲突,提示用户用 `worktree_overrides` 手动指定后退出。
   - `orphans` 非空 → 告知用户,但不阻断创建。

## 决定 worktree 名

1. 默认名:`worktree-` + 功能分支 slug 段(`feature/payment` → `worktree-payment`)。
2. 用 AskUserQuestion 让用户确认或改名(可加后缀区分多 worktree,如 `worktree-payment-api`)。
3. **校验**:必须以 `worktree-`(config.worktree_prefix)开头;否则拒绝重输。

## 创建

1. worktree 目录:`.claude/worktrees/<branch>`。
2. `git worktree add .claude/worktrees/<branch> -b <branch> <feature>`。
3. 更新 state:读当前 state(`read-config` 同级可加读 state,或直接由 reconcile 返回),把 `worktrees[<branch>] = { status: "in_progress" }` 后用 `write-state --branch <feature> --json-stdin` 原子写回。
4. 打印:worktree 已创建于 `.claude/worktrees/<branch>`,请 `cd` 过去开发,完成后 `/speccode:develop-complete`。
