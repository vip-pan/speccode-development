---
name: "SpecCode: Distilling Knowledge"
description: "从 spec/ 与 archive/ 蒸馏知识集:全量重蒸 distilled 段,经人工闸门落盘 speccode/knowledge/"
category: Workflow
tags: [speccode, workflow, knowledge]
---

从 `speccode/spec/` 与 `speccode/archive/` 蒸馏知识集,全量重蒸 `speccode/knowledge/` 各 topic 文件的蒸馏段,经人工闸门落盘。全程中文交互。**应在 worktree-* 分支上运行**。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. **trunk 防护**:`git rev-parse --abbrev-ref HEAD` 必须以 `config.worktree_prefix`(默认 `worktree-`)开头;否则退出并提示"请在 worktree 分支上运行本命令"(防止直提 trunk)。
3. **绑定功能分支**:运行 `speccode.mjs reconcile --cwd .`,用返回的 features 找到当前 worktree 所属的功能分支 F;找不到 → 报错"当前 worktree 无法关联任何 active feature",退出。
4. 运行 `speccode.mjs read-memory --cwd . --branch <F>` 读取本 feature 记忆作为既有上下文参考。
5. 运行 `speccode.mjs read-knowledge --cwd .`(无 flag)获取现状:`files`(topic 清单)与 `index`(`_index.md` 内容,可能为 null)。
6. `speccode/knowledge/` 不存在 → 本命令创建骨架:6 个初始 topic 空文件(development/architecture.md、development/standards.md、development/environment.md、development/integrations.md、development/pitfalls.md、development/security.md)+ `_index.md`,不创建 business/ 目录(知识集只策展 SDD 过程知识,业务知识归外部 RAG)。创建机制:对 6 个文件逐个执行 `write-knowledge --rel <file> --json-stdin`(mode=replace,content 为空串)创建空文件,再执行 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries 为 development 一个空清单 section)创建索引——绝不 mkdir/touch/手写文件(命令层绝不手写 knowledge/,一律经 verb)。
7. 读 `speccode/spec/`(各 capability 主规格,**全量**)。archive 改**增量读**:运行 `speccode.mjs read-consumed-archives --cwd .` 得 `{consumed, present, unconsumed, bootstrap}`——`bootstrap=true`(sidecar `_distilled.meta.json` 缺失)则首次引导,本次全量读 archive 全部归档包;否则只读 `unconsumed` 列出的归档包,`consumed` 包整包跳过(含其 propose/design/brainstorm 子文档)。`present` 是盘上归档包全集,留给闸门做 stale 判定。
8. 删 `_distilled.meta.json` 再跑即强制全量重读 + 全块重蒸 + 重种子,为蒸馏判据变更后的官方逃生口,不另设 `--full` flag。
9. 若 `knowledge_tools`(config)非空且其能力在会话中可用,读 spec/archive 时优先参考;不可用回退直接读文件,不报错。

## 蒸馏

1. 逐 topic 蒸馏,先取现状:`speccode.mjs read-knowledge --cwd . --topic <topic名> --blocks` 返回该 topic 现有蒸馏块(`blocks: [{source, body}]`),作为候选 diff 的现状侧。
2. 蒸馏目标 = 6 个骨架 development topic ∪ `development/` 下用户自建 topic;蒸馏内容限于 SDD 过程知识(架构、准则、环境、对接、坑与评审共识、安全)——spec/archive 中的业务知识(领域术语、业务流程、业务历史)不蒸馏。从 spec/ 与 archive/ 提炼「该主题下值得长期记住的事实/准则/坑」,生成每个目标 topic 的蒸馏块集合:
   - 块粒度:每个来源一个块;source 格式固定——archive 来源用 `archive/<归档目录名>/`,spec 来源用 `spec/<capability 目录名>/`;
   - **carry-forward**:已消费包(本次未读、source 包仍在)的既有蒸馏块,取自步骤 1 的 `read-knowledge --blocks` 现状侧,**原样**保留进候选列表(不重蒸)——归档包不可变,重蒸仅得相同内容,无信息损失;其 source 在候选列表 → `replaceDistilledBlocks` 保留,不误删。
   - **supersession**:若新读的归档包知识取代某既有块(source 包仍在),在候选列表里**省略**该旧块(→ 删除)或**更新**其 body;闸门标「superseded by <新包名>」,与 stale(source 包已删)区分,用户确认。
   - 现有 hand-written 段作为蒸馏参考上下文,可引用其事实,但不得把其中内容复制为蒸馏块(手写段原样保留在文件中);
   - 无内容可蒸且该 topic 此前也无蒸馏块 → 产出空 blocks 数组(文件保持现状);该 topic 已有蒸馏块时,blocks 为空意味着其现有蒸馏块将被删除(全量重建语义)。(carry-forward 的已消费包块始终在候选列表内,不受本条影响。)
   - 蒸馏块 body 不得包含 `<!--` 或 `-->` 字符串。
3. **通用日落**:蒸馏目标之外既存的 topic 文件(如存量 business/*),用 `read-knowledge --topic <topic名> --blocks` 取其现有蒸馏块,逐块标记为「建议移除(该 topic 不在蒸馏目标内;若属业务知识,建议归外部 RAG)」,并入候选进入闸门;其 hand-written 段不进入候选、绝不自动修改。
4. 汇总候选:对每个 topic 列出 `blocks: [{source, body}]`,与现状 diff 展示(新增/变化/删除的蒸馏块;现有 source 不在新列表中的块将被删除)。

## 闸门

用 AskUserQuestion 逐 topic 确认(提供「全部确认」选项):
- 确认 → 该 topic 经 `write-knowledge --rel <topic路径> --json-stdin`(mode=replace-distilled,blocks=候选)原子写;
- 日落块确认移除 → 该 topic 经 `write-knowledge --rel <topic路径> --json-stdin`(mode=replace-distilled,blocks=[])写入(删除全部蒸馏块,hand-written 段字节保留);用户拒绝 → 块保留原样;
- 拒绝/修改 → 按用户反馈调整后重展示。

source 指向的 archive 或 spec capability 已不存在 → 该块标 **stale**(自动检测),选项:删除该块 / 改 source 后保留。archive 来源的 stale 判定 MUST 基于前置 §7 `read-consumed-archives` 返回的 `present`(盘上归档包名):把块 source 的 `archive/<name>/` 剥成 `<name>` 与 `present` 比对,不在其中即 stale——**carry-forward 的已消费包块同样要过这一关**(其包已被删时,`consumed` 里的残留条目不代表包还在)。source 包仍在但其知识被新归档包取代 → 该块标 **superseded by <新包名>**(非 stale;distiller 提议、用户确认),选项:删除该块 / 更新 body / 改 source。两种"块被移除"语义 MUST 区分标注。

## 落盘

1. 各 topic 写入完成后更新 `_index.md`:为每个 topic 文件生成一行摘要(标题 + 文件 + 一句话摘要),组装 entries(实扫现有 topic 文件(跳过内容为空的 topic 文件——日落后被清空的存量文件不再收录),按顶层目录名分组为 sections,如 development;不硬编码固定 section 清单),经 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries=...)写入。
2. (新)登记消费:把本次读过的归档包目录名(含读了无产出的;首次引导时 = 本次全量读的全部归档包,即种子),经 `speccode.mjs write-consumed-archives --cwd . --json-stdin` 原子追记进 `_distilled.meta.json`(verb 内部读旧∪新去重):
   ```bash
   speccode.mjs write-consumed-archives --cwd . --json-stdin <<'EOF'
   {"add":["<归档目录名>",...]}
   EOF
   ```
   即使本次全部 topic 无变化(跳过 topic 写),本步骤仍 MUST 执行——首次引导尤其:sidecar 未建则下次仍全量读(增量永不生效,legacy marker 迁移也被挡住);读过无产出的归档包也须登记。
3. 经 `speccode.mjs write-memory --cwd . --branch <F> --json-stdin`(mode=append)追加本次蒸馏摘要(哪些 topic 变化/无变化/新增)。
4. 全部写入完成后 MUST 立即提交:
   ```bash
   git add speccode/knowledge/
   git commit -m "docs(knowledge): distill knowledge set"
   ```
5. 报告:哪些 topic 变化/无变化/新增。

## 约束

- 只写 `speccode/knowledge/`,绝不写 `speccode/spec/`(那是 syncing 的职责)。
- 幂等:某 topic 蒸馏结果与现状无差异 → 跳过写,报告「无变化」。
- marker 解析失败(报错)→ 停下报告给用户,不猜测修复。
