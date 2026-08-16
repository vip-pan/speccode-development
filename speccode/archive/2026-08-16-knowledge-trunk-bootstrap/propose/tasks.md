# Tasks: knowledge 命令 trunk 化

按依赖排序分组。

## lib / CLI

- [x] `bin/speccode.mjs`:read-memory(~204-205)、write-memory(~214)的 `branch !== '_exploring'` 例外改为接受 `_exploring` 与 `_knowledge`(推广到 `_`-prefixed trunk 键亦可)。验证 `write-memory --branch _knowledge` 落 `.speccode/memory/_knowledge.md`、`read-memory --branch _knowledge` 可读。

## 命令重写

- [x] `commands/distilling-knowledge.md` 前置段:trunk 入口校验(HEAD==trunk)、`chore/knowledge-*` bootstrap(AskUserQuestion 分支名默认 `chore/knowledge-distill` + `git checkout -b` + `push -u`)、续跑检测(已有未完成 `chore/knowledge-*` → 询问续跑/新建)、HEAD 已在 `chore/knowledge-*` 跳过 bootstrap、worktree/feature 分支拒绝并提示回 trunk。删 reconcile 绑 F、删 `read-memory --branch F`。
- [x] `commands/distilling-knowledge.md` 落盘段:commit 后直接 `gh`/`glab pr create`(经 `prtool.createPrArgs`,base=`config.trunk`),`pr_tool=none` 打印等效命令中止;不调 finishing-feature、不阻塞等合并;维护摘要写 `_knowledge` memory。保留 write-consumed-archives 步骤不变。
- [x] `commands/recording-knowledge.md`:前置段 + 落盘段同 distilling 的 trunk-bootstrap + 直通 PR + `_knowledge` memory;**保留适配闸门(业务 vs 过程知识)不变**。

## PR 创建辅助

- [x] 确认命令层 shell out `gh`/`glab` 的写法(镜像 `finishing-feature.md §2` / `finishing-worktree.md §3`);若需 spawn 辅助则加到 `lib/prtool.mjs` 或命令内联,不引入新 verb。

## 测试

- [x] `tests/cli.test.mjs`:`_knowledge` write-memory/read-memory 用例(接受 + 落 `_knowledge.md`)。
- [ ] distilling/recording 的 trunk-bootstrap + `pr_tool=none` 行为加依赖注入单测(注入 spawn/run,不依赖真实 `gh`)。 — **descoped(终审确认:prose 命令行为无单元测试,与仓库一致;bootstrap/PR 创建/入口拒绝均 agent+shell 层,无 verb 可注入,plan 刻意不伪造)**
- [ ] worktree/feature 分支运行被拒的用例。 — **descoped(同上,入口拒绝是 agent 层 `git rev-parse` 校验,无 verb 可测)**

## 文档

- [x] 插件 `README.md` / `README_CN.md` 命令表两条(knowledge 命令约束列 `worktree-*` → `trunk`),中英两版同步。
- [x] `CHANGELOG` 标 BREAKING。

## 自测

- [x] worktree 内跑全量测试 `node --test ./plugins/speccode/tests/*.test.mjs` 全绿。
