---
description: "把知识直接记录进知识集:经人工闸门写入 speccode/knowledge/ 的 hand-written 段"
category: Workflow
tags: [speccode, workflow, knowledge]
---

把用户/agent 提供的知识直接记录进 `speccode/knowledge/`(hand-written 段),经人工闸门落盘。全程中文交互。**应在 state 登记的 `chore/knowledge-*` worktree 分支上运行**(trunk 上运行时由本命令引导建分支,见 §3)。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. **运行位置校验**:运行 `git rev-parse --abbrev-ref HEAD` 取当前分支,并运行 `speccode.mjs reconcile --cwd .` 取 `features`:
   - HEAD 为 `chore/knowledge-*` 且 `features` 中存在该分支的 state 登记(status ∈ {pending, in_progress, pr_open})→ 直接进入 §4(在本 knowledge worktree 中执行)。
   - HEAD 为 `config.trunk` → 走 §3「分支引导」。
   - 其他(非 trunk、非 state 登记的 `chore/knowledge-*`)→ 退出并提示「知识维护请在 chore/knowledge-* worktree 分支上进行:回 trunk 运行本命令引导建分支,或 cd 到既有 knowledge worktree」。
3. **分支引导(仅 trunk 上运行时)**:从 §2 的 reconcile `features` 输出筛选 `branch` 匹配 `^chore/knowledge-` 且 `status ∈ {pending, in_progress, pr_open}` 的条目:
   - 有命中 → AskUserQuestion 询问「续跑(cd 到该分支 worktree)/ 新建」;续跑 → `cd <该条目的 worktree>` 后进入 §4;新建 → 按无命中流程另起 slug(不得复用同一分支名,该分支仍有未完成 state)。
   - 无命中 → AskUserQuestion 确认 slug(默认取待记录内容的主题命名 `knowledge-<主题>`,无主题时 `knowledge-record`;须匹配 `^[a-z0-9-]+$`),引导执行 `/speccode:creating-worktree chore/knowledge-<slug>`(type=`chore`,基点 trunk,登记 state)→ 建成后 `cd <worktree>` 进入 §4。若 creating-worktree 检测到大需求父实体并提议从集成分支切出,MUST 坚持基点为 `config.trunk`(知识维护不挂在任何大需求下),不接受其集成基点提议。
   - 「未完成」判定 MUST 基于 state 查询(reconcile 输出),MUST NOT 依赖 `git branch --no-merged` 等 git merge 判定(squash-only 合并下对已合并分支永真,会把已收尾分支误判为未完成)。
4. 运行 `speccode.mjs read-knowledge --cwd .`(无 flag)获取现状(topic 清单 + 索引)。
5. `speccode/knowledge/` 不存在 → 创建骨架(同 distilling-knowledge 的 6 development topic 空文件 + `_index.md`,经 write-knowledge 创建,绝不手写)。

## 收集内容

向用户询问(选择题优先):
- 主题:映射到现有 topic(如「开发准则」→ development/standards.md);无合适 topic → 询问是否新建 topic 文件(落在 `development/` 下,文件名小写连字符,`.md` 结尾,如 `development/ops.md`——distilling-knowledge 的蒸馏目标只含 development/ 下自建 topic,根级文件无法分组且会被日落)。
- 内容:用户/agent 给出的知识文本。

## 闸门

1. **适配判断**:先对内容做归类陈述——属于 SDD 过程知识(开发守则、架构、环境、对接、坑与评审共识、安全等)→ 建议落入的 topic;属于业务知识(领域术语、业务流程、业务历史等)→ 陈述「更像业务知识,建议进外部 RAG 而非知识集」。归类是建议不是硬拦:用户坚持写入时,允许其指定既有 topic 或新建 topic(新建落在 `development/` 下,文件名小写连字符,`.md` 结尾)。pitfalls 语义含评审中反复出现的问题模式与团队评审共识,不单列 review topic。
2. 展示草稿(写入位置 + 内容 + 归类陈述)→ AskUserQuestion 确认:
   - 确认 → 收集「新内容 + 整理后的既有手写段」为完整手写区文本,经 `write-knowledge --rel <topic路径> --json-stdin`(mode=replace-hand,content=完整手写区文本)原子写(手写区整体替换,蒸馏块字节级保留,布局归位为手写段在前);
   - 坚持写入(被建议进 RAG 时)→ 按用户指定的 topic 写入;
   - 修改 → 按反馈调整后重展示。

## 手写段整理

每次运行对**本次写入 topic** 的既有 hand-written 段做整理:
- 动作限于:合并重复条目、删除过时条目、收紧表述;权威是在场用户——MUST NOT 以 `speccode/spec/` 为真值改写用户知识,不读 spec 做判定;
- 每个删除/合并项 MUST 附一句理由,与写入草稿一并展示,经闸门确认后随本次写入一并落盘(经 replace-hand 一次写入);
- 整理不触碰蒸馏块(marker 内内容),不把整理结果写成蒸馏块。

## 落盘

1. `_index.md` 需更新时(新 topic、摘要变化、或索引缺失)→ 组装 entries(实扫现有 topic 文件(跳过内容为空的 topic 文件),按顶层目录名分组为 sections,不硬编码固定 section 清单),经 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries=...)写入。
2. MUST 立即提交:
   ```bash
   git add speccode/knowledge/
   git commit -m "docs(knowledge): record <topic>"
   ```
3. **收尾**:落盘提交完成后,引导执行 `/speccode:finishing-worktree` 收尾(测试门禁 + 按 `merge_target` 的 PR 路由 + squash-only 探测 + 切回 merge_target);建议在 PR 菜单选「PR+不等待」。从 finishing-worktree 的输出取得 PR url(或 `pr_tool=none` 时的等效命令)。
4. **memory(trunk 级)**:finishing-worktree 收尾取得 PR url(或等效命令)**之后**,经 `speccode.mjs write-memory --cwd . --branch _knowledge --json-stdin`(mode=append)追加本次记录摘要(写入位置 + topic)**+ PR url**(`pr_tool=none` 时记等效命令与维护分支名):
   ```bash
   speccode.mjs write-memory --cwd . --branch _knowledge --json-stdin <<'EOF'
   {"mode":"append","content":"<摘要 + PR url>"}
   EOF
   ```
   顺序不可调换:摘要必须含 PR url,所以只能在 PR 之后写。`.speccode/memory/` 自忽略,在 item 2 的 `git add speccode/knowledge/` 之后写不会影响提交内容。
5. 报告:写入位置 + finishing-worktree 输出的 PR url(或等效命令)。

## 约束

- 只维护 hand-written 段(写入与整理均经 replace-hand,不写 marker);写蒸馏块是 distilling-knowledge 的职责,蒸馏块字节级保留。
- 内容不得包含 `<!--` 或 `-->` 字符串。
