---
name: "SpecCode: Finish"
description: "收尾整个功能:PR→display(等合并)→ 剥离文档 → PR→trunk(等合并)→ 回收 -complete → 切回 display"
category: Workflow
tags: [speccode, workflow, finish]
---

完成整个功能的交付。全程中文交互。支持 `--resume`。

## 前置

1. `read-config` 加载 config。
2. HEAD 必须在功能分支;否则退出。
3. **跑对账** `reconcile --cwd .`(finish 也对账,建立在真实 git 状态上)。
4. **门禁检查**:用 `feature-progress --branch <F>`:
   - 存在任何 `pending` / `in_progress` / `pr_open` 的 worktree → 阻止,列出未完成项。
   - 对账 `orphans` 里若有本 feature 的残留 worktree → 提示先清理。
5. **未跟踪文档检查**:对 `enabledDocDirs(config)` 逐个查是否 tracked;若工作区存在但未 tracked → 警告"检测到未纳入 git 的 spec 文档,finish 后不会留存,是否先提交?"由用户决定(speccode 不主动 add/commit)。
6. `--resume`:若 state 有 `pending_operation.command="finish"`,按 `phase` 跳到对应阶段续跑。

## 判定路径

- `display.enabled=true` → 路径 A(双 PR)。
- 否则 → 路径 B(单 PR 到 trunk)。

## 路径 A(有 display)

**阶段 1 — PR→display(阻塞等合并)**
1. `git push origin <F>`。
2. pr_tool 创建 PR(base=display, head=F)。`pr_tool=none` → 打印等效命令并中止。
3. 轮询等合并(30s / 30min):
   - MERGED → 记录 display 上的 merge commit,进入阶段 2。
   - CLOSED/CONFLICTING → 报错退出。
   - TIMEOUT → 写 `pending_operation`(phase=waiting_display_pr),提示 `--resume`。

**阶段 2 — 建 -complete + 剥离文档**
4. `git checkout -b <F>-complete <display-merge-commit>`。
5. 剥离:对 `enabledDocDirs` 执行 `git rm -r --cached <doc_dir>`(仅 tracked 的)。
6. `git commit --amend --no-edit`(折叠进功能 commit)。
7. `git push -f origin <F>-complete`。

**阶段 3 — PR→trunk(阻塞等合并)**
8. pr_tool 创建 PR(base=trunk, head=<F>-complete)。
9. 轮询等合并:
   - MERGED → 进入收尾。
   - TIMEOUT → 写 `pending_operation`(phase=waiting_trunk_pr),提示 `--resume`。

## 路径 B(无 display)

从"阶段 2"开始(直接建 `<F>-complete`,base=trunk),阶段 3 的 PR 目标为 trunk。

## 收尾

1. 回收 `-complete`:`git branch -D <F>-complete` + `git push origin :<F>-complete`。
2. 删 state:`node .claude/speccode/bin/speccode.mjs delete-state --cwd . --branch <F>`。
3. `git checkout display`(存在)或 `git checkout trunk`(feature 分支保留,不删)。
4. 打印:功能已交付;若有 display,建议 `/speccode:display-merge-trunk` 同步。

> **状态写入约定**:本命令中写 `pending_operation`(超时挂起)MUST 通过 `write-state --cwd . --branch <F> --json-stdin`(取当前 state → 加 `pending_operation` 字段 → 整体写回)。`--resume` 时读回该字段决定续跑阶段。绝不由 AI 手写 JSON 文件。
