---
name: "SpecCode: Finishing Worktree"
description: "完成 worktree 开发并合并回功能分支(测试门禁 + PR 等待 / PR 不等待 / 本地 squash / 保留),更新 state"
category: Workflow
tags: [speccode, workflow, worktree, merge]
---

完成一个 worktree 的开发并合并回功能分支。全程中文交互。支持 `--resume`。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. HEAD 必须在 worktree 分支(以 `config.worktree_prefix` 开头,默认 `worktree-`);否则退出。
3. 运行 `speccode.mjs reconcile --cwd . --advance-pr`:
   - 用返回的 features 找到当前 worktree 所属的功能分支 F;找不到 → 报错"当前 worktree 无法关联任何 active feature,请先 /speccode:creating-feature",退出。
   - `conflicts` 非空 → 报告冲突并退出。
   - `--resume`:若该 feature 的 state 有 `pending_operation.command="finishing-worktree"`,从其 phase 续跑(legacy 旧值由引擎自动规范化,无需特判)。
4. **读记忆**:运行 `speccode.mjs read-memory --cwd . --branch <F>`;返回非 null 时把 memory 内容作为既有上下文参考,再继续。

## 全量测试门禁

1. 按标记文件探测测试命令:`package.json` → `npm test`;`Cargo.toml` → `cargo test`;`requirements.txt` / `pyproject.toml` → `pytest`;`go.mod` → `go test ./...`;均无 → 询问用户测试命令(用户可明确选择跳过)。
2. 在 worktree 内运行全量测试。**失败 → 展示失败摘要并停止,不呈现合并选项。**(早前通过的测试只证明当时那棵树;合并选项只在新鲜全绿后出现。)

## 未归档变更检查(warn-only)

合并选项呈现前,检查 `speccode/changes/<slug>/` 是否存在:
- 存在(有未归档的落地文档)→ 打印警告「建议先执行 /speccode:syncing 与 /speccode:archiving,再回来收尾 worktree」,MUST NOT 阻断,继续呈现合并选项。
- 不存在 → 静默,直接进入合并选项。

## 询问合并方式(恰好四项)

用 AskUserQuestion:
1. **PR + 等待合并**(全自动化)
2. **PR + 不等待**(自己合并,后续对账推进)
3. **本地 squash**(快)
4. **保留 worktree**(不合并,保持现状)

丢弃**不在菜单**。仅当用户显式要求丢弃(如"丢弃这个 worktree")时进入「丢弃路径」。

## 路径 1/2:PR

1. **同步 base**:`git push origin <F>`;若 non-fast-forward → 中止并提示用户处理分叉。
2. `git push -u origin <worktree>`。
3. 用 pr_tool 创建 PR:参数同 `createPrArgs`(base=F, head=worktree)。`pr_tool=none` → 打印等效命令并中止。
4. PR 创建成功后触发 onPrOpened 钩子(payload 带 `"pr_number": <N>`):
   ```bash
   echo '{"command":"finishing-worktree","feature_branch":"<F>","worktree_branch":"<worktree>","pr_number":<N>}' | speccode.mjs run-hook --cwd . --event onPrOpened
   ```
   输出 `hook.ok=false` 或含 `warning` 时打印警告(含事件名与错误摘要),MUST NOT 阻断主流程。
5. **路径 1(等待)**:每 30s 调 `speccode.mjs query-pr --cwd . --number <N>`,超时 30min:
   - MERGED → 「清理」+ state 置 `completed` + `completed_at`。
   - CLOSED 或 CONFLICTING → 报错退出(PR 被关闭或存在合并冲突,需人工处理)。
   - UNKNOWN → 视为查询失败:连续 3 次 UNKNOWN 则中止轮询并报告(提示检查 gh/glab 认证与网络),不计入 30min 超时等待。
   - TIMEOUT → 写 `pending_operation`(command=`finishing-worktree`, phase=`waiting_worktree_pr`, pr_number, updated_at),提示 `--resume`。
6. **路径 2(不等待)**:state 置 `pr_open` + 记 `pr_number`,**不清理** worktree,不阻塞。

## 路径 3:本地 squash

主仓操作一律用 `git -C <主仓根>` 执行(主仓根 = `speccode.mjs resolve-speccode-dir --cwd .` 返回的 speccodeDir 的父目录);当前 cwd 保持在 worktree 内,**不切换当前 worktree 的 HEAD**。

1. 确认主仓 checkout 在 F:`git -C <主仓根> rev-parse --abbrev-ref HEAD`;不是 F → 先 `git -C <主仓根> checkout <F>`。
2. `git -C <主仓根> merge --squash <worktree>`。
3. `git -C <主仓根> commit`(用户填 commit message,遵守 git 提交规范)。
4. **复测**:在「主仓根的 F」上对合并后的结果复跑全量测试(同门禁探测)。失败 → 停止,保留 worktree 与分支现场(未推送,可恢复),提示用户调查。
5. 「清理」+ state 置 `completed` + `completed_at`。

## 路径 4:保留 worktree

不合并、不清理、state 不动。打印:worktree 保留于 `<path>`(分支 `<worktree>`),可稍后重跑本命令合并。

## 丢弃路径(仅显式要求)

1. 展示:分支名、完整 commit 列表(`git log --oneline <F>..<worktree>`)、worktree 路径。
2. 要求用户**逐字输入 `discard`**;任何其他输入(包括"确认/删除/是的")→ 取消,不删任何东西。
3. 输入 `discard` 后:「清理」+ 从 state 的 `worktrees` 删除该条目(经 write-state 写回)。

## 清理(来源限定)

仅当该 worktree 满足「分支名带 `config.worktree_prefix` 且(路径位于 `resolve-worktree-dir` 解析目录之下或在 state 中有登记)」时执行。操作顺序:**先离开被清理的 worktree**(`cd <主仓根>`,或全程用 `git -C <主仓根>` 不切换 cwd;主仓根 = `speccode.mjs resolve-speccode-dir --cwd .` 返回的 speccodeDir 的父目录),再执行删除——绝不在被删的 worktree 内删它自己:
- `git -C <主仓根> worktree remove <path> --force` + `git -C <主仓根> branch -D <worktree>`;
- 询问是否删远端(`git -C <主仓根> push origin :<worktree>`);
- `git -C <主仓根> worktree prune`。
不满足 → 原样保留并打印原因(宿主环境创建的 worktree 不由 speccode 清理)。

## 收尾

1. 用 `feature-progress --branch <F>` 取进度。
2. 本 worktree 开发完成(路径 1 MERGED / 路径 2 已开 PR / 路径 3 squash 完成)时,触发 onWorktreeFinished 钩子。有 PR 时(路径 1/2)载荷附带 `"pr_number": <N>`:
   ```bash
   echo '{"command":"finishing-worktree","feature_branch":"<F>","worktree_branch":"<worktree>","pr_number":<N>}' | speccode.mjs run-hook --cwd . --event onWorktreeFinished
   ```
   无 PR 时(路径 3 本地 squash)省略 `pr_number` 字段:
   ```bash
   echo '{"command":"finishing-worktree","feature_branch":"<F>","worktree_branch":"<worktree>"}' | speccode.mjs run-hook --cwd . --event onWorktreeFinished
   ```
   输出 `hook.ok=false` 或含 `warning` 时打印警告(含事件名与错误摘要),MUST NOT 阻断主流程。
3. 打印状态报告:`<F> 进度 X/Y done` + 每个 worktree 状态;若全部 completed,建议 `/speccode:finishing-feature`。
4. **写记忆**:把本命令产出的决策/进度摘要(合并方式、PR 号、state 变化,经用户确认或按本命令内置判据)追加到本 feature 的 memory。用 heredoc 经 stdin 传 JSON(不用 `echo '<json>'`:zsh 会把 `\n` 解释成字面换行,摘要含单引号也会破壳):
   ```bash
   speccode.mjs write-memory --cwd . --branch <F> --json-stdin <<'EOF'
   {"mode":"append","content":"<摘要>"}
   EOF
   ```

**长会话主动记忆**:在以下时机 MUST 主动执行 write-memory(append),不等命令出入口:①一个开发阶段/任务完成且距上次写入已隔多个阶段;②会话上下文显著增长(接近 compact 风险);③compact 恢复后继续工作的首个阶段完成时。写入内容 MUST 是关键决策/进度/待办的摘要,并经用户确认或遵循本命令内置判据。

> **状态写入约定**:本命令中所有"state 置 X"(completed / pr_open / pending_operation / 删除条目)MUST 通过 `write-state --cwd . --branch <F> --json-stdin` verb 完成——先取当前 state(reconcile 返回或 read),改字段后整体写回。绝不由 AI 手写 JSON 文件。
