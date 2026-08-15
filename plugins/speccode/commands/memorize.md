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
6. `speccode/knowledge/` 不存在 → 创建骨架:6 个初始 topic 空文件(development/architecture.md、development/standards.md、development/environment.md、development/integrations.md、development/pitfalls.md、development/security.md)+ `_index.md`,不创建 business/ 目录(知识集只策展 SDD 过程知识,业务知识归外部 RAG)。创建机制:对 6 个文件逐个执行 `write-knowledge --rel <file> --json-stdin`(mode=replace,content 为空串)创建空文件,再执行 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries 为 development 一个空清单 section)创建索引——绝不 mkdir/touch/手写文件(命令层绝不手写 knowledge/,一律经 verb)。

## 收集内容

向用户询问(选择题优先):
- 主题:映射到现有 topic(如「开发准则」→ development/standards.md);无合适 topic → 询问是否新建 topic 文件(落在 `development/` 下,文件名小写连字符,`.md` 结尾,如 `development/ops.md`——promote 的蒸馏目标只含 development/ 下自建 topic,根级文件无法分组且会被日落)。
- 内容:用户/agent 给出的知识文本。

## 闸门

1. **适配判断**:先对内容做归类陈述——属于 SDD 过程知识(开发守则、架构、环境、对接、坑与评审共识、安全等)→ 建议落入的 topic;属于业务知识(领域术语、业务流程、业务历史等)→ 陈述「更像业务知识,建议进外部 RAG 而非知识集」。归类是建议不是硬拦:用户坚持写入时,允许其指定既有 topic 或新建 topic(新建落在 `development/` 下,文件名小写连字符,`.md` 结尾)。pitfalls 语义含评审中反复出现的问题模式与团队评审共识,不单列 review topic。
2. 展示草稿(写入位置 + 内容 + 归类陈述)→ AskUserQuestion 确认:
   - 确认 → `write-knowledge --rel <topic路径> --json-stdin`(mode=append-hand,content=内容)原子写(追加为 hand-written 段,不带 marker);
   - 坚持写入(被建议进 RAG 时)→ 按用户指定的 topic 写入;
   - 修改 → 按反馈调整后重展示。

## 落盘

1. `_index.md` 需更新时(新 topic、摘要变化、或索引缺失——read-knowledge 返回 index 为 null 但 topic 文件存在)→ 组装 entries(实扫现有 topic 文件(跳过内容为空的 topic 文件——日落后被清空的存量文件不再收录),按顶层目录名分组为 sections,如 development;不硬编码固定 section 清单),经 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries=...)写入新索引内容。
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
