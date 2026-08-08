---
name: "SpecCode: Executing Plans"
description: "在当前会话分批执行实现计划,带人工检查点;子代理可用时优先 subagent-driven-development"
category: Workflow
tags: [speccode, workflow, plan, execute]
---

# Executing Plans(执行计划)

## 概览

加载 plan,批判性审查,执行所有任务,完成后报告。

**开始时宣布:**"我在用 executing-plans 执行这个 plan。"

**注意:** 告诉人类伙伴,有子代理可用时执行效果好得多(Claude Code、Codex CLI、Codex App、Copilot CLI、Gemini CLI 都满足子代理可用条件)。如果子代理可用,改用 `/speccode:subagent-driven-development`,而不是本命令。

## 流程

### 第 1 步:加载并审查 Plan

1. 确认已在 speccode worktree 中(否则先 `/speccode:creating-worktree`);未经用户明确同意,MUST NOT 在 main/master 上开始
2. 读 plan 文件(通常在 `speccode/changes/<slug>/plan/`)
3. 批判性审查——找出 plan 中任何疑问或顾虑
4. 有顾虑:开始前向人类伙伴提出
5. 无顾虑:为 plan 各项建 todo,继续

### 第 2 步:执行任务

对每个任务:
1. 标记为 in_progress
2. 严格按各步执行(plan 的步是一口大小的)
3. 按规定运行验证
4. 标记为 completed

### 第 3 步:完成开发

所有任务完成并验证后:
- 宣布:"我在用 finishing-worktree 完成这项工作。"
- **REQUIRED SUB-SKILL:** 使用 `/speccode:finishing-worktree`
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
