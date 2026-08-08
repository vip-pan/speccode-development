---
name: "SpecCode: Finishing Feature"
description: "收尾整个功能:单 PR → trunk(阻塞等合并)→ 删 state → 切回 trunk"
category: Workflow
tags: [speccode, workflow, finish]
---

完成整个功能的交付。全程中文交互。支持 `--resume`。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. HEAD 必须在功能分支(`feature/` `bugfix/` `refactor/` `chore/` 之一);否则退出。
3. **跑对账** `speccode.mjs reconcile --cwd . --advance-pr`(建立在真实 git 状态上,并推进已合并的 pr_open)。
4. **门禁检查**:用 `feature-progress --branch <F>`:
   - 存在任何 `pending` / `in_progress` / `pr_open` 的 worktree → 阻止,列出未完成项。
   - 对账 `orphans` 里若有本 feature 的残留 worktree → 提示先清理。
5. `--resume`:若 state 有 `pending_operation.command="finishing-feature"`,按 `phase` 续跑。
   - **若 `phase="waiting_display_pr"`(v0.1 遗留挂起态)→ 报错退出**:该挂起态依赖已下线的 display 分支流程,无法自动续跑。打印手动收尾指引:① 检查当时的 display PR 是否已合并;② 已合并则 `git checkout <trunk> && git pull`,手动创建 `<F> → <trunk>` 的 PR;③ 用 write-state 清除该 feature 的 `pending_operation` 后重新执行本命令。
6. **读记忆**:运行 `speccode.mjs read-memory --cwd . --branch <F>`;返回非 null 时把 memory 内容作为既有上下文参考,再继续。

## 单 PR 流程(feature → trunk)

1. `git push origin <F>`;若 non-fast-forward → 中止并提示用户处理分叉。
2. 用 pr_tool 创建 PR(base=`config.trunk`, head=F)。`pr_tool=none` → 打印等效命令(如 `gh pr create --base <trunk> --head <F> --title ...`)并中止。
3. PR 创建成功后触发 onPrOpened 钩子(payload 带 `"pr_number": <N>`):
   ```bash
   echo '{"command":"finishing-feature","feature_branch":"<F>","pr_number":<N>}' | speccode.mjs run-hook --cwd . --event onPrOpened
   ```
   输出 `hook.ok=false` 或含 `warning` 时打印警告(含事件名与错误摘要),MUST NOT 阻断主流程。
4. 轮询等合并(每 30s 调 `speccode.mjs query-pr --cwd . --number <N>`,超时 30min):
   - MERGED → 进入收尾。
   - CLOSED 或 CONFLICTING → 报错退出。
   - UNKNOWN → 视为查询失败:连续 3 次 UNKNOWN 则中止轮询并报告(提示检查 gh/glab 认证与网络),不计入 30min 超时等待。
   - TIMEOUT → 写 `pending_operation`(command=`finishing-feature`, phase=`waiting_trunk_pr`, pr_number, updated_at),提示 `--resume`。

全流程 MUST NOT 创建 `<F>-complete` 分支,MUST NOT 执行任何 `git rm --cached` 文档剥离操作——`speccode/` 文档随本 PR 一并进入 trunk。

## 收尾

1. 删 state:`speccode.mjs delete-state --cwd . --branch <F>`。
2. 触发 onFeatureFinished 钩子:
   ```bash
   echo '{"command":"finishing-feature","feature_branch":"<F>","pr_number":<N>}' | speccode.mjs run-hook --cwd . --event onFeatureFinished
   ```
   输出 `hook.ok=false` 或含 `warning` 时打印警告(含事件名与错误摘要),MUST NOT 阻断主流程。
3. `git checkout <trunk>`(feature 分支保留,不删,作为历史)。
4. 打印:功能已交付,`<F>` 已合并进 `<trunk>`。
5. **写记忆**:把本命令产出的决策/进度摘要(交付结论、PR 号,经用户确认或按本命令内置判据)追加到本 feature 的 memory。用 heredoc 经 stdin 传 JSON(不用 `echo '<json>'`:zsh 会把 `\n` 解释成字面换行,摘要含单引号也会破壳):
   ```bash
   speccode.mjs write-memory --cwd . --branch <F> --json-stdin <<'EOF'
   {"mode":"append","content":"<摘要>"}
   EOF
   ```

**长会话主动记忆**:在以下时机 MUST 主动执行 write-memory(append),不等命令出入口:①一个开发阶段/任务完成且距上次写入已隔多个阶段;②会话上下文显著增长(接近 compact 风险);③compact 恢复后继续工作的首个阶段完成时。写入内容 MUST 是关键决策/进度/待办的摘要,并经用户确认或遵循本命令内置判据。

> **状态写入约定**:本命令中写 `pending_operation`(超时挂起)MUST 通过 `write-state --cwd . --branch <F> --json-stdin`(取当前 state → 加 `pending_operation` 字段 → 整体写回)。`--resume` 时读回该字段决定续跑阶段。绝不由 AI 手写 JSON 文件。
