---
name: "SpecCode: Memorize"
description: "把知识直接写进知识集:经人工闸门写入 speccode/knowledge/ 的 hand-written 段"
category: Workflow
tags: [speccode, workflow, knowledge]
---

把用户/agent 提供的知识直接写进 `speccode/knowledge/`(hand-written 段),经人工闸门落盘。全程中文交互。**应在 worktree-* 分支上运行**。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. **trunk 防护**:`git rev-parse --abbrev-ref HEAD` 必须以 `config.worktree_prefix`(默认 `worktree-`)开头;否则退出并提示"请在 worktree 分支上运行本命令"(防止直提 trunk)。
3. **绑定功能分支**:运行 `speccode.mjs reconcile --cwd .`,用返回的 features 找到当前 worktree 所属的功能分支 F;找不到 → 报错"当前 worktree 无法关联任何 active feature",退出。
4. 运行 `speccode.mjs read-memory --cwd . --branch <F>` 读取本 feature 记忆作为既有上下文参考。
5. 运行 `speccode.mjs read-knowledge --cwd .`(无 flag)获取现状(topic 清单 + 索引)。
6. `speccode/knowledge/` 不存在 → 创建骨架:9 个初始 topic 空文件(business/domain.md、business/workflows.md、business/lineage.md、development/architecture.md、development/standards.md、development/environment.md、development/integrations.md、development/pitfalls.md、development/security.md)+ `_index.md`。创建机制:对 9 个文件逐个执行 `write-knowledge --rel <file> --json-stdin`(mode=replace,content 为空串)创建空文件,再执行 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries 为业务方向/开发方向两个空清单 section)创建索引——绝不 mkdir/touch/手写文件(命令层绝不手写 knowledge/,一律经 verb)。

## 收集内容

向用户询问(选择题优先):
- 主题:映射到现有 topic(如「开发准则」→ development/standards.md);无合适 topic → 询问是否新建 topic 文件(文件名小写连字符,`.md` 结尾)。
- 内容:用户/agent 给出的知识文本。

## 闸门

展示草稿(写入位置 + 内容)→ AskUserQuestion 确认:
- 确认 → `write-knowledge --rel <topic路径> --json-stdin`(mode=append-hand,content=内容)原子写(追加为 hand-written 段,不带 marker);
- 修改 → 按反馈调整后重展示。

## 落盘

1. `_index.md` 需更新时(新 topic、摘要变化、或索引缺失——read-knowledge 返回 index 为 null 但 topic 文件存在)→ 组装 entries(业务方向 section + 开发方向 section),经 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries=...)写入新索引内容。
2. 经 `speccode.mjs write-memory --cwd . --branch <F> --json-stdin`(mode=append)追加本次 memorize 摘要(写入位置 + topic)。
3. MUST 立即提交:
   ```bash
   git add speccode/knowledge/
   git commit -m "docs(knowledge): memorize <topic>"
   ```
4. 报告写入位置。

## 约束

- 只写 hand-written 段(不写 marker);写 promoted 块是 promote-knowledge 的职责。
- 内容不得包含 `<!--` 或 `-->` 字符串。
