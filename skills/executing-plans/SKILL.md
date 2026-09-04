---
description: "在当前会话分批执行实现计划,带人工检查点;子代理可用时优先 subagent-driven-development"
---

# Executing Plans(执行计划)

## 概览

加载 plan,批判性审查,执行所有任务,完成后报告。

**开始时宣布:**"我在用 executing-plans 执行这个 plan。"

**注意:** 告诉人类伙伴,有子代理可用时执行效果好得多(Claude Code、Codex CLI、Codex App、Copilot CLI、Gemini CLI 都满足子代理可用条件)。如果子代理可用,改用 `/speccode:subagent-driven-development`,而不是本命令。

## 知识库入口

1. 运行 `speccode.mjs read-knowledge --cwd . --index` 读 `_index.md`(恒读,便宜);`exists:false` → 静默跳过本节。
2. 判断本任务相关主题 → `speccode.mjs read-knowledge --cwd . --topic <名称>` 读对应 topic 文件;`exists:false` → 静默跳过该主题。
3. 读取失败或目录不存在 → 静默跳过,绝不阻断主流程(T0 兜底,永不报错)。

## 流程

### 入口绑定(第 1 步之前)

1. 确认已在 speccode worktree 中(否则先 `/speccode:creating-worktree`);未经用户明确同意,MUST NOT 在 main/master 上开始
2. **绑定功能分支**:运行 `speccode.mjs reconcile --cwd .`,用返回的 features 找到当前 worktree 所属的功能分支 F;找不到 → 报错"当前 worktree 无法关联任何 active feature",退出。
3. **读记忆**:运行 `speccode.mjs read-memory --cwd . --branch <F>`;返回非 null 时把 memory 内容作为既有上下文参考,再继续——memory 上下文 MUST 参与第 1 步的批判性审查。
4. **记录 BASE**:开始执行前 MUST 运行 `git rev-parse HEAD` 记录当前 commit,完成后 code review 以它为 BASE。

### 第 1 步:加载并审查 Plan

1. 读 plan 文件(通常在 `speccode/changes/<slug>/plan/`)
2. 批判性审查——找出 plan 中任何疑问或顾虑
3. 有顾虑:开始前向人类伙伴提出
4. 无顾虑:为 plan 各项建 todo,继续

### 第 2 步:执行任务

对每个任务:
1. 标记为 in_progress
2. 严格按各步执行(plan 的步是一口大小的)
3. 按规定运行验证
4. 标记为 completed
5. 触发 onTaskCompleted 钩子(每个 task 完成时,payload 带 `"task": <N>`):
   ```bash
   echo '{"command":"executing-plans","feature_branch":"<F>","worktree_branch":"<W>","task":<N>}' | speccode.mjs run-hook --cwd . --event onTaskCompleted
   ```
   输出 `hook.ok=false` 或含 `warning` 时打印警告(含事件名与错误摘要),MUST NOT 阻断主流程。
6. **同步勾选 plan 进度**:运行
   ```bash
   speccode.mjs tick-task --cwd . --plan <PLAN_FILE> --task <N>
   ```
   把 plan 中 Task N 的 step checkbox 勾选为 `[x]`。verb 输出 `ticked`(本次真正勾选的 step 行)与 `already`(此前已是 `[x]` 的行),二者共同表达幂等:重跑同一 task 时 `ticked` 为空、`already` 列出全部,plan 文件不被改写。
   - `ticked` **非空**:把勾选 diff 折进本簿记点提交
     ```bash
     git add <PLAN_FILE> && git commit -m "docs(speccode): tick task <N>"
     ```
   - `ticked` **为空**(全在 `already`):MUST 跳过 commit——没有变化可提,`git commit` 会以 "nothing to commit" 非零退出,误导控制器判定失败。

   plan 是 tracked 设计文档,进度随 PR 上 trunk;ledger 仍是崩溃恢复的唯一权威,checkbox 仅作完成态派生视图。`<PLAN_FILE>` 为本命令加载的 plan 路径(第 1 步)。

### 第 3 步:完成开发

所有任务完成并验证后:
- **code review(必经)**:全部任务完成并验证后 MUST 调用 `/speccode:requesting-code-review` 派发审查(BASE 用入口绑定第 4 步记录的 commit;未记录则用分支起点 `git merge-base <trunk> HEAD`);审查反馈按 `/speccode:receiving-code-review` 核实处理。**review 未通过前 MUST NOT 进入收尾路由(syncing/archiving)。**
- **写记忆**:把本命令产出的执行进度摘要(完成的任务、验证结果,经用户确认或按本命令内置判据)追加到本 feature 的 memory。用 heredoc 经 stdin 传 JSON(不用 `echo '<json>'`:zsh 会把 `\n` 解释成字面换行,摘要含单引号也会破壳):
  ```bash
  speccode.mjs write-memory --cwd . --branch <F> --json-stdin <<'EOF'
  {"mode":"append","content":"<摘要>"}
  EOF
  ```

**长会话主动记忆**:在以下时机 MUST 主动执行 write-memory(append),不等命令出入口:①每个 task 完成时;②会话上下文显著增长(接近 compact 风险);③compact 恢复后继续工作的首个阶段完成时。写入内容 MUST 是关键决策/进度/待办的摘要,并经用户确认或遵循本命令内置判据。

- **收尾路由**:若 `speccode/changes/<slug>/` 存在(有落地文档)→ 手动模式用 AskUserQuestion 询问、auto 模式自动衔接执行 `/speccode:syncing`,判断依据不充分时 MUST 默认询问而非自动衔接,随后依次 `/speccode:archiving` → `/speccode:finishing-worktree`(顺序硬约束:syncing/archiving 需在开发分支(`<type>/<slug>`、非 trunk)上运行,finishing-worktree 会移除 worktree);若不存在 → 直接执行 `/speccode:finishing-worktree`。
- **REQUIRED SUB-SKILL:** 按上述收尾路由执行(`/speccode:finishing-worktree` 为最终收尾)
- 按该命令验证测试、呈现选项、执行选择

## When to Stop and Ask for Help(何时停下求助)

**立即 STOP 执行,当:**
- 遇到阻塞(依赖缺失、测试失败、指令不清)
- plan 有导致无法开始的关键缺口
- 不理解某条指令
- 验证反复失败

**宁可请求澄清,不要猜测。**

## When to Revisit Earlier Steps(何时回到先前步骤)

**返回审查(第 1 步),当:**
- 伙伴根据你的反馈更新了 plan
- 基本方法需要重新考虑

**不要硬闯阻塞**——停下来问。

## 记住

- 先批判性审查 plan
- 严格按 plan 步骤执行
- 不要跳过验证
- plan 要求时引用对应命令
- 卡住就停,不要猜
- 未经用户明确同意,绝不在 main/master 分支上开始实现
