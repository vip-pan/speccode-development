---
name: "SpecCode: Promote Knowledge"
description: "从 spec/ 与 archive/ 蒸馏知识集:全量重蒸 promoted 段,经人工闸门落盘 speccode/knowledge/"
category: Workflow
tags: [speccode, workflow, knowledge]
---

从 `speccode/spec/` 与 `speccode/archive/` 蒸馏知识集,全量重蒸 `speccode/knowledge/` 各 topic 文件的 promoted 段,经人工闸门落盘。全程中文交互。**应在 worktree-* 分支上运行**。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. **trunk 防护**:`git rev-parse --abbrev-ref HEAD` 必须以 `config.worktree_prefix`(默认 `worktree-`)开头;否则退出并提示"请在 worktree 分支上运行本命令"(防止直提 trunk)。
3. **绑定功能分支**:运行 `speccode.mjs reconcile --cwd .`,用返回的 features 找到当前 worktree 所属的功能分支 F;找不到 → 报错"当前 worktree 无法关联任何 active feature",退出。
4. 运行 `speccode.mjs read-memory --cwd . --branch <F>` 读取本 feature 记忆作为既有上下文参考。
5. 运行 `speccode.mjs read-knowledge --cwd .`(无 flag)获取现状:`files`(topic 清单)与 `index`(`_index.md` 内容,可能为 null)。
6. `speccode/knowledge/` 不存在 → 本命令创建骨架:9 个初始 topic 空文件(business/domain.md、business/workflows.md、business/lineage.md、development/architecture.md、development/standards.md、development/environment.md、development/integrations.md、development/pitfalls.md、development/security.md)+ `_index.md`。创建机制:对 9 个文件逐个执行 `write-knowledge --rel <file> --json-stdin`(mode=replace,content 为空串)创建空文件,再执行 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries 为业务方向/开发方向两个空清单 section)创建索引——绝不 mkdir/touch/手写文件(命令层绝不手写 knowledge/,一律经 verb)。
7. 读 `speccode/spec/`(各 capability 主规格)与 `speccode/archive/`(全部归档 change)。
8. 若 `knowledge_tools`(config)非空且其能力在会话中可用,读 spec/archive 时优先参考;不可用回退直接读文件,不报错。

## 蒸馏

1. 逐 topic 蒸馏,先取现状:`speccode.mjs read-knowledge --cwd . --topic <topic名> --blocks` 返回该 topic 现有 promoted 块(`blocks: [{source, body}]`),作为候选 diff 的现状侧。
2. 从 spec/ 与 archive/ 提炼「该主题下值得长期记住的事实/准则/坑」,生成该 topic 的 promoted 块集合:
   - 块粒度:每个来源一个块;source 格式固定——archive 来源用 `archive/<归档目录名>/`,spec 来源用 `spec/<capability 目录名>/`;
   - 现有 hand-written 段作为蒸馏参考上下文,可引用其事实,但不得把其中内容复制为 promoted 块(手写段原样保留在文件中);
   - 无内容可蒸且该 topic 此前也无 promoted 块 → 产出空 blocks 数组(文件保持现状);该 topic 已有 promoted 块时,blocks 为空意味着其现有 promoted 块将被删除(全量重建语义)。
   - promoted 块 body 不得包含 `<!--` 或 `-->` 字符串。
3. 汇总候选:对每个 topic 列出 `blocks: [{source, body}]`,与现状 diff 展示(新增/变化/删除的 promoted 块;现有 source 不在新列表中的块将被删除)。

## 闸门

用 AskUserQuestion 逐 topic 确认(提供「全部确认」选项):
- 确认 → 该 topic 经 `write-knowledge --rel <topic路径> --json-stdin`(mode=replace-promoted,blocks=候选)原子写;
- 拒绝/修改 → 按用户反馈调整后重展示。

source 指向的 archive 或 spec capability 已不存在 → 该块标 stale,闸门内展示给用户,选项:删除该块 / 改 source 后保留。

## 落盘

1. 各 topic 写入完成后更新 `_index.md`:为每个 topic 文件生成一行摘要(标题 + 文件 + 一句话摘要),组装 entries(业务方向 section + 开发方向 section),经 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries=...)写入。
2. 经 `speccode.mjs write-memory --cwd . --branch <F> --json-stdin`(mode=append)追加本次晋升摘要(哪些 topic 变化/无变化/新增)。
3. 全部写入完成后 MUST 立即提交:
   ```bash
   git add speccode/knowledge/
   git commit -m "docs(knowledge): promote knowledge set"
   ```
4. 报告:哪些 topic 变化/无变化/新增。

## 约束

- 只写 `speccode/knowledge/`,绝不写 `speccode/spec/`(那是 syncing 的职责)。
- 幂等:某 topic 蒸馏结果与现状无差异 → 跳过写,报告「无变化」。
- marker 解析失败(报错)→ 停下报告给用户,不猜测修复。
