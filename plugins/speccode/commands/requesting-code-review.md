---
name: "SpecCode: Requesting Code Review"
description: "完成任务、实现重大功能或合并前,派发 code reviewer 子代理验证工作符合需求;BASE 用调用方记录的 commit"
category: Workflow
tags: [speccode, workflow, review]
---

# 请求代码审查(Requesting Code Review)

派发一个 code reviewer 子代理,在问题级联放大之前抓住它们。审查者拿到的是精确构造的评估上下文——绝不是你会话的历史。

**核心原则:** 早审查,常审查。

## 何时请求审查

**强制:**
- subagent 驱动开发(`/speccode:subagent-driven-development`)中的每个任务之后(任务审查与最后的整支终审都走本命令)
- 完成重大功能之后
- 合并进主干之前

**可选但有价值:**
- 卡住时(换一双新眼睛)
- 重构之前(基线检查)
- 修了复杂 bug 之后

## 如何请求

**1. 确定 BASE 与 HEAD:**

BASE 永远用**调用方记录的 BASE**——派发实现者/开始本段工作之前 `git rev-parse HEAD` 记下并存好的那个 commit(SDD 任务循环在派发实现者前记录它;整支终审用分支起点,如 `git merge-base <trunk> HEAD`)。MUST NOT 用相对引用反推 BASE——多 commit 的任务里,相对引用会悄悄丢掉除最后一个之外的所有 commit。

```bash
BASE_SHA=<调用方记录的 BASE>   # 开始本段工作前记录;不是相对引用
HEAD_SHA=$(git rev-parse HEAD)
```

**2. 派发 code reviewer 子代理:**

派发一个 `general-purpose` 子代理,填充 `${CLAUDE_PLUGIN_ROOT}/references/code-reviewer.md` 的模板

**占位符:**
- `{DESCRIPTION}` - 你构建的东西的简短小结
- `{PLAN_OR_REQUIREMENTS}` - 它应该做什么
- `{BASE_SHA}` - 起始 commit(调用方记录的 BASE)
- `{HEAD_SHA}` - 结束 commit

派发时触发 onCodeReviewRequested 钩子:

```bash
echo '{"command":"requesting-code-review","feature_branch":"<F>","worktree_branch":"<W>"}' | speccode.mjs run-hook --cwd . --event onCodeReviewRequested
```

输出 `hook.ok=false` 或含 `warning` 时打印警告(含事件名与错误摘要),MUST NOT 阻断主流程。

**3. 按反馈行动:**
- Critical 问题立即修
- Important 问题修复后再继续
- Minor 问题记下稍后处理
- 审查者错了就反驳(带上理由)

## 示例

```
[刚完成 Task 2: 添加验证函数]

你: 继续之前,先请求代码审查。

BASE_SHA=<派发 Task 2 实现者前记录的 BASE>(SDD 任务循环里已记下)
HEAD_SHA=$(git rev-parse HEAD)

[派发 code reviewer 子代理]
  DESCRIPTION: 添加了 verifyIndex() 和 repairIndex(),覆盖 4 种问题类型
  PLAN_OR_REQUIREMENTS: speccode/changes/<slug>/plan/ 中的 Task 2
  BASE_SHA: a7981ec
  HEAD_SHA: 3df7661

[子代理返回]:
  Strengths: 架构干净,真实测试
  Issues:
    Important: 缺少进度指示
    Minor: 魔法数字(100)作为上报间隔
  Assessment: 可以继续

你: [修复进度指示]
[继续 Task 3]
```

## 常见合理化借口(Common Rationalizations)

| 借口 | 现实 |
|--------|---------|
| 「我自己看一遍 diff 就行,不用派审查者」 | 你是协调者——在会话里内联审 diff 会烧掉你推进工作所需的上下文窗口。派一个审查者子代理:diff 和评估活在它的上下文里,只有发现回到你这里。 |
| 「审查者需要我整个会话历史才能理解这个改动」 | 给它精确构造的上下文,绝不是你会话的历史。这让审查者聚焦在工作产物上,而不是你的思考过程。 |

## 红旗(Red Flags)

**绝不:**
- 因为「很简单」跳过审查
- 无视 Critical 问题
- 带着未修复的 Important 问题继续前进
- 对站得住的技术反馈抬杠

**如果审查者错了:**
- 用技术理由反驳
- 展示证明它能工作的代码/测试
- 请求澄清

模板见: `${CLAUDE_PLUGIN_ROOT}/references/code-reviewer.md`
