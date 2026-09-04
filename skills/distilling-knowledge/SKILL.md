---
description: "从 spec/ 与 archive/ 蒸馏知识集:全量重蒸 distilled 段,经人工闸门落盘 speccode/knowledge/"
---

从 `speccode/spec/` 与 `speccode/archive/` 蒸馏知识集,全量重蒸 `speccode/knowledge/` 各 topic 文件的蒸馏段,经人工闸门落盘。全程中文交互。**应在 state 登记的 `chore/knowledge-*` worktree 分支上运行**(trunk 上运行时由本命令引导建分支,见 §3)。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. **运行位置校验**:运行 `git rev-parse --abbrev-ref HEAD` 取当前分支,并运行 `speccode.mjs reconcile --cwd .` 取 `features`:
   - HEAD 为 `chore/knowledge-*` 且 `features` 中存在该分支的 state 登记(status ∈ {pending, in_progress, pr_open})→ 直接进入 §4(在本 knowledge worktree 中执行)。
   - HEAD 为 `config.trunk` → 走 §3「分支引导」。
   - 其他(非 trunk、非 state 登记的 `chore/knowledge-*`)→ 退出并提示「知识维护请在 chore/knowledge-* worktree 分支上进行:回 trunk 运行本命令引导建分支,或 cd 到既有 knowledge worktree」。
3. **分支引导(仅 trunk 上运行时)**:从 §2 的 reconcile `features` 输出筛选 `branch` 匹配 `^chore/knowledge-` 且 `status ∈ {pending, in_progress, pr_open}` 的条目:
   - 有命中 → AskUserQuestion 询问「续跑(cd 到该分支 worktree)/ 新建」;续跑 → `cd <该条目的 worktree>` 后进入 §4;新建 → 按无命中流程另起 slug(不得复用同一分支名,该分支仍有未完成 state)。
   - 无命中 → AskUserQuestion 确认 slug(默认 `knowledge-distill`;须匹配 `^[a-z0-9-]+$`),引导执行 `/speccode:creating-worktree chore/knowledge-<slug>`(type=`chore`,基点 trunk,登记 state)→ 建成后 `cd <worktree>` 进入 §4。若 creating-worktree 检测到大需求父实体并提议从集成分支切出,MUST 坚持基点为 `config.trunk`(知识维护不挂在任何大需求下),不接受其集成基点提议。
   - 「未完成」判定 MUST 基于 state 查询(reconcile 输出),MUST NOT 依赖 `git branch --no-merged` 等 git merge 判定(squash-only 合并下对已合并分支永真,会把已收尾分支误判为未完成)。
4. 运行 `speccode.mjs read-knowledge --cwd .`(无 flag)获取现状:`files`(topic 清单)与 `index`(`_index.md` 内容,可能为 null)。
5. `speccode/knowledge/` 不存在 → 创建骨架:6 个初始 topic 空文件(development/architecture.md、development/standards.md、development/environment.md、development/integrations.md、development/pitfalls.md、development/security.md)+ `_index.md`,不创建 business/ 目录。机制:对 6 个文件逐个执行 `write-knowledge --rel <file> --json-stdin`(mode=replace,content 为空串),再执行 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries 为 development 一个空清单 section)创建索引——绝不 mkdir/touch/手写文件。
6. 读 `speccode/spec/`(各 capability 主规格,**全量**——这是新鲜度审查的真值锚)。archive 保持**增量读**(纯读成本控制):运行 `speccode.mjs read-consumed-archives --cwd .` 得 `{consumed, unconsumed, present, bootstrap}`——`bootstrap=true`(sidecar `_distilled.meta.json` 缺失)则首次引导,本次全量读 archive 全部归档包;否则只读 `unconsumed` 列出的归档包,`consumed` 包整包跳过(含其 propose/design/brainstorm 子文档)。sidecar 只决定本次读哪些包,不参与任何蒸馏块存废判定。
7. 删 `_distilled.meta.json` 再跑即强制全量重读归档包 + 重种子,为读成本控制失准后的官方逃生口,不另设 `--full` flag。(重蒸本就每次全量:既有块的新鲜度审查不依赖是否重读其来源包。)
8. 若 `code_intel_tools`(config)非空且其能力在会话中可用,读 spec/archive 时优先参考;不可用回退直接读文件,不报错。

## 蒸馏

1. 逐 topic 蒸馏,先取现状:`speccode.mjs read-knowledge --cwd . --topic <topic名> --blocks` 返回该 topic 现有蒸馏块(`blocks: [{source, body}]`),作为候选 diff 的现状侧。
2. 蒸馏目标 = 6 个骨架 development topic ∪ `development/` 下用户自建 topic;蒸馏内容限于 SDD 过程知识(架构、准则、环境、对接、坑与评审共识、安全)——spec/archive 中的业务知识(领域术语、业务流程、业务历史)不蒸馏。从 spec/(真值锚)与本次读到的归档包提炼「该主题下值得长期记住的当前态事实/准则/坑」,生成每个目标 topic 的蒸馏块集合:
   - **块身份 = 能力键**:每个块 marker 用 `cap/<slug>`(slug 匹配 `^[a-z0-9-]+$`,同文件唯一);块的出处(archive 归档包名 / spec capability 目录名)以纯文本(如括注「出自 archive/<包名>」)记在 body 内。能力键命名优先对齐既有 `speccode/spec/` capability 目录名(如 `cap/git-workflow-lifecycle`);无对应 capability 的主题用稳定 kebab 主题词(如 `cap/documentation-facade`)。
   - **upsert**:同 topic 文件内同能力键只保留一个块——后续知识覆盖/合并先前内容,不累积历史;知识退役即删,不留墓碑块(历史叙事归 archive/ 与 CHANGELOG)。
   - **新鲜度审查(每次运行)**:对全部蒸馏目标 topic 的**全部既有蒸馏块**(含来源包本次未读的)逐块审查:真值锚 = spec/ 主规格。内容仍真 → 保留(可并入同能力键新块);过时/被取代 → 提议改写或删除(附理由);已描述退役机制的知识块(如 stale/superseded 机制本身)→ 建议删除(附理由)。
   - **存量块映射(首次运行)**:既有块的旧 source 值(`archive/<名>/`、`spec/<名>/`)解析照常;为每块提议能力键映射(优先按块内容所属能力对齐 capability 目录名;同文件多块映射到同一能力键时合并为一块,后到覆盖/并入先前),闸门逐块确认。未映射的旧 source 块无法经写侧校验直写(引擎强制迁移必经闸门)。
   - 现有 hand-written 段作为蒸馏参考上下文,可引用其事实,但不得把其中内容复制为蒸馏块(手写段经 replace-hand 由 recording-knowledge 维护);
   - 无内容可蒸且该 topic 此前也无蒸馏块 → 产出空 blocks 数组(文件保持现状);该 topic 已有蒸馏块时,blocks 为空意味着其现有蒸馏块将被删除(全量重建语义)。
   - 蒸馏块 body 不得包含 `<!--` 或 `-->` 字符串。
3. **通用日落**:蒸馏目标之外既存的 topic 文件(如存量 business/*),用 `read-knowledge --topic <topic名> --blocks` 取其现有蒸馏块,逐块标记为「建议移除(该 topic 不在蒸馏目标内;若属业务知识,建议归外部 RAG)」,并入候选进入闸门;其 hand-written 段不进入候选、绝不自动修改。
4. 汇总候选:对每个 topic 列出 `blocks: [{source, body}]`,与现状 diff 展示——**只展示变化块**(新增/改写/删除/映射),无变化块不进入展示;每个删除或合并项 MUST 附一句理由。

## 闸门

用 AskUserQuestion 逐 topic 确认(提供「全部确认」选项):
- 确认 → 该 topic 经 `write-knowledge --rel <topic路径> --json-stdin`(mode=replace-distilled,blocks=候选)原子写;
- 日落块确认移除 → 该 topic 经 `write-knowledge --rel <topic路径> --json-stdin`(mode=replace-distilled,blocks=[])写入(删除全部蒸馏块,hand-written 段字节保留);用户拒绝 → 块保留原样;
- 拒绝/修改 → 按用户反馈调整后重展示。

source 指向的 archive 或 spec capability 已不存在**不再构成独立处置语义**(stale/superseded/carry-forward 机制已退役):块的存废一律由新鲜度审查提议、闸门按「附理由的删除/合并/改写」确认。存量旧 source 块经映射确认后写入;映射拒绝 = 换一个能力键再提议(映射本身不可避免——写侧只接受能力键)。

## 落盘

1. 各 topic 写入完成后更新 `_index.md`:为每个 topic 文件生成一行摘要(标题 + 文件 + 一句话摘要),组装 entries(实扫现有 topic 文件(跳过内容为空的 topic 文件),按顶层目录名分组为 sections,不硬编码固定 section 清单),经 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries=...)写入。
   写入后文件布局自动归位为「手写段在前、蒸馏块在后」(引擎保证,幂等)。
2. (新)登记消费:把本次读过的归档包目录名(含读了无产出的;首次引导时 = 本次全量读的全部归档包,即种子),经 `speccode.mjs write-consumed-archives --cwd . --json-stdin` 原子追记进 `_distilled.meta.json`:
   ```bash
   speccode.mjs write-consumed-archives --cwd . --json-stdin <<'EOF'
   {"add":["<归档目录名>",...]}
   EOF
   ```
   即使本次全部 topic 无变化(跳过 topic 写),本步骤仍 MUST 执行。
3. 全部写入完成后 MUST 立即提交:
   ```bash
   git add speccode/knowledge/
   git commit -m "docs(knowledge): distill knowledge set"
   ```
4. **收尾**:全部写入与提交完成后,引导执行 `/speccode:finishing-worktree` 收尾(测试门禁 + 按 `merge_target` 的 PR 路由 + squash-only 探测 + 切回 merge_target);建议在 PR 菜单选「PR+不等待」(知识维护不阻塞日常开发)。从 finishing-worktree 的输出取得 PR url(或 `pr_tool=none` 时的等效命令)。
5. **memory(trunk 级)**:finishing-worktree 收尾取得 PR url(或等效命令)**之后**,经 `speccode.mjs write-memory --cwd . --branch _knowledge --json-stdin`(mode=append)追加本次蒸馏摘要(哪些 topic 变化/无变化/新增)**+ PR url**(`pr_tool=none` 时记等效命令与维护分支名):
   ```bash
   speccode.mjs write-memory --cwd . --branch _knowledge --json-stdin <<'EOF'
   {"mode":"append","content":"<摘要 + PR url>"}
   EOF
   ```
   顺序不可调换:摘要必须含 PR url,所以只能在 PR 之后写。`.speccode/memory/` 自忽略,在 item 3 的 `git add speccode/knowledge/` 之后写不会影响提交内容。
6. 报告:哪些 topic 变化/无变化/新增 + finishing-worktree 输出的 PR url(或等效命令)。

## 约束

- 只写 `speccode/knowledge/`,绝不写 `speccode/spec/`(那是 syncing 的职责)。
- 幂等:某 topic 蒸馏结果与现状无差异 → 跳过写,报告「无变化」。
- marker 解析失败(报错)→ 停下报告给用户,不猜测修复。
