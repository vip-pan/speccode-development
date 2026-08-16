# Design: knowledge 命令 trunk 化

## Context

现状:distilling-knowledge / recording-knowledge 的前置要求 HEAD 以 `worktree-` 开头,并经 reconcile 绑定 feature F、写 feature memory、落盘后由 finishing-feature PR 回 trunk。原因有二:(1) trunk 防护(knowledge 是 tracked,需经 PR);(2) memory 绑定靠 worktree→feature ancestry(reconcile 只扫 `worktree-` 前缀分支)。

实际使用中 knowledge 维护几乎都在 trunk 做,且 distilling 本质是跨所有 feature 产物的周期性维护,绑单个 feature F 是类别错配。

## Goals

- knowledge 命令从 trunk 直接可用,一步进入「分支 + PR」轻量流程。
- docs-only 改动不再扛 worktree 仪式(构建/基线测试)。
- memory 归属语义正确:维护摘要进 trunk 级 `_knowledge.md`,不绑一次性 feature。
- 保留 trunk 防护(不直提 trunk,经 PR)。

## Non-Goals

- 不改 distilling 的蒸馏内容逻辑(增量读、carry-forward、stale/superseded 闸门、write-consumed-archives)。
- 不改 recording 的适配闸门(业务 vs 过程知识)。
- 不处理 `business/` topic 与规约的分歧(见 Open Questions)。
- 不为 knowledge PR 加阻塞等合并 / CI 门禁语义(docs PR 即开即走)。

## Decisions

1. **lite 而非 heavy**:不创建 speccode feature state、不跑 reconcile、不开 worktree。knowledge≠feature,不污染 feature 状态机;`/speccode:status` 不跟踪 knowledge PR(已接受)。被否备选:heavy(全套 creating-feature + finishing-feature)——保留 worktree 开销且 memory 绑一次性 feature,与「knowledge 是 trunk 维护」的洞察相悖。
2. **memory 改 trunk 级 `_knowledge.md`**:镜像 `_exploring.md`。被否:仍写 feature memory(语义拧,distilling 跨 feature 无单一归属)。
3. **CLI 校验例外扩为列表**:`bin/speccode.mjs` 的 `branch !== '_exploring'` 改为接受 `_exploring` 与 `_knowledge`(或推广到 `_`-prefixed trunk 键)。`lib/memory.mjs` 无需改(`memoryPath` 对无斜杠键已直通)。
4. **PR 创建镜像 finishing-feature §2**:命令层 shell out `gh`/`glab`,经 `prtool.createPrArgs` 拼参数;`pr_tool=none` 打印等效命令中止。不引入新 verb。
5. **续跑检测**:trunk 上若已有未完成的 `chore/knowledge-*` 分支 → AskUserQuestion 询问续跑(checkout 既有)/新建,镜像 creating-feature 的「已存在」处理。
6. **砍 worktree/feature 入口**:在 worktree/feature 分支跑 → 提示回 trunk。被否:三上下文保留(worktree/feature/trunk)——代码多且与「knowledge 非 feature」相悖。

## Risks

- **R-1 三层拓扑例外**:lite 流程绕过 feature/worktree state,是对三层分支拓扑不变量的例外。缓解:在 knowledge-set 新增 requirement 显式编码此例外,使不变量「所有 tracked 改动经 feature→trunk PR」的豁免对象明确为 knowledge 维护;git-workflow-lifecycle 的不变量表述若需同步放宽,列入后续(见 Open Questions)。
- **R-2 半成品分支堆积**:续跑检测降低但未消除(用户总选新建)。缓解:bootstrap 前检测未完成 `chore/knowledge-*` 并优先建议续跑;PR 合并后分支可手动删。
- **R-3 行为 BREAKING**:存量用户若依赖在 worktree 内跑 knowledge 命令,升级后需改流程。缓解:CHANGELOG 标 BREAKING;README 命令表更新约束列。
- **R-4 pr_tool=none 中止语义**:打印等效命令中止后,用户需手动开 PR;分支已 commit。缓解:打印完整等效命令 + 分支名,与 finishing-feature 一致。

## Open Questions

- **business/ 分歧**:distilling 规约要求不建 business/,但现状 `_index.md` 与 `knowledge/business/*` 存在。本次 Non-Goal;是否单开一次 distilling 日落处理,后续决定。
- **git-workflow-lifecycle 是否需正式放宽**:三层拓扑不变量是否要显式写明「knowledge 维护例外」,还是仅靠 knowledge-set 的 ADDED requirement 表达。倾向后者(局部表达足够),实现期再评估。
- **PR title/body 规范**:默认 title 用 commit message(`docs(knowledge): distill knowledge set` / `record <topic>`),body 附 topic 变化摘要。实现期定稿。
