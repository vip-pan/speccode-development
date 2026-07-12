---
name: "SpecCode: Develop Complete"
description: "把 worktree 成果合并到功能分支(PR 等待 / PR 不等待 / 本地 squash),更新 state"
category: Workflow
tags: [speccode, workflow, worktree, merge]
---

完成一个 worktree 的开发并合并回功能分支。全程中文交互。支持 `--resume`。

## 前置

1. `read-config` 加载 config。
2. HEAD 必须在 worktree 分支(以 `worktree-` 开头);否则退出。
3. 运行 `node .claude/speccode/bin/speccode.mjs reconcile --cwd . --advance-pr`:
   - 用返回的 features 找到当前 worktree 所属的功能分支 F;找不到 → 报错"当前 worktree 无法关联任何 active feature,请先 /speccode:start",退出。
   - `--resume`:若该 feature 的 state 有 `pending_operation.command="develop-complete"`,从其 phase 续跑。

## 询问合并方式(1 轮三选一)

用 AskUserQuestion:
1. **PR + 等待合并**(全自动化)
2. **PR + 不等待**(自己合并,后续对账推进)
3. **本地 squash merge**(快)

## 路径 1/2:PR

1. **同步 base**:`git push origin <F>`;若 non-fast-forward → 中止并提示用户处理分叉。
2. `git push -u origin <worktree>`。
3. 用 pr_tool 创建 PR:参数同 `createPrArgs`(base=F, head=worktree)。`pr_tool=none` → 打印等效命令并中止。
4. **路径 1(等待)**:轮询(`queryPrArgs` + `parsePrState`,每 30s,超时 30min):
   - MERGED → 清理:`git worktree remove .claude/worktrees/<worktree> --force` + `git branch -D <worktree>` + 询问是否删远端(`git push origin :<worktree>`);state 置 `completed` + `completed_at`。
   - CLOSED/CONFLICTING → 报错退出。
   - TIMEOUT → 写 `pending_operation`(command=develop-complete, phase=waiting_worktree_pr, pr_number),提示 `--resume`。
5. **路径 2(不等待)**:state 置 `pr_open` + 记 `pr_number`,**不清理** worktree,不阻塞。

## 路径 3:本地 squash

1. `git checkout <F>`。
2. `git merge --squash <worktree>`。
3. `git commit`(用户填 commit message,遵守 git 提交规范)。
4. `git worktree remove .claude/worktrees/<worktree> --force` + `git branch -D <worktree>`。
5. state 置 `completed` + `completed_at`。

## 收尾

1. 用 `feature-progress --branch <F>` 取进度。
2. 打印状态报告:`<F> 进度 X/Y done` + 每个 worktree 状态;若全部 completed,建议 `/speccode:finish`。

> **状态写入约定**:本命令中所有"state 置 X"(completed / pr_open / pending_operation)MUST 通过 `write-state --cwd . --branch <F> --json-stdin` verb 完成——先取当前 state(reconcile 返回或 read),改字段后整体写回。绝不由 AI 手写 JSON 文件。
