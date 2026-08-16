# Proposal: knowledge 命令 trunk 化

## Why

distilling-knowledge 与 recording-knowledge 强制 worktree 分支,但实际几乎都在 trunk 跑;docs-only 改动却要扛全链 5 命令 + worktree 仪式(构建/基线测试对编辑 markdown 毫无用处)。更深的错配:distilling 跨所有 feature 产物(spec 全量 + archive 增量),却把 memory 绑到单个 feature F——没有任何 feature「拥有」一次跨 feature 蒸馏。

## What Changes

- **入口反转**:knowledge 命令(distilling/recording)改为从 **trunk** 运行(trunk 成为主入口,不再被拒);在 worktree/feature 分支上跑 → 提示回 trunk。砍掉旧的 worktree→feature 绑定路径。
- **轻量 bootstrap**:trunk 上经 AskUserQuestion 确认分支名(默认 `chore/knowledge-distill` / `chore/knowledge-<topic>`),`git checkout -b` + `push -u`。**不创建 speccode state、不跑 reconcile、不开 worktree**。HEAD 已是 `chore/knowledge-*`(续跑)→ 跳过 bootstrap。检测到未完成的 `chore/knowledge-*` → 询问续跑/新建。
- **直通 PR**:落盘 commit 后直接 `gh/glab pr create`(经 `prtool.createPrArgs`,base=trunk);`pr_tool=none` → 打印等效命令并中止。**不阻塞等合并、不跑 finishing-feature**。
- **memory 改 trunk 级**:维护摘要写 `.speccode/memory/_knowledge.md`(新增 trunk 级保留键,镜像 `_exploring.md`),不再绑 feature F。
- **CLI 校验放宽**:`bin/speccode.mjs` 的 read-memory/write-memory 分支校验例外从「仅 `_exploring`」扩到「`_exploring` 与 `_knowledge`」(`lib/memory.mjs` 无需改,no-slash 键已直通)。
- distilling 的蒸馏内容逻辑、增量读、闸门、write-consumed-archives **不变**;recording 的适配闸门(业务 vs 过程知识)**不变**。

## Capabilities

- **knowledge-set**:新增「知识维护分支与直通 PR」requirement(承载 trunk 入口 + bootstrap + 直通 PR + `_knowledge` memory + 拒绝 worktree/feature 语义)。
- **session-memory**:MODIFIED「memory 文件位置与命名」(加 `_knowledge.md` trunk 例外)、MODIFIED「read-memory / write-memory verb」(分支校验接受 `_knowledge`)。

## Impact

- 代码:`plugins/speccode/commands/distilling-knowledge.md`、`commands/recording-knowledge.md`(重写前置 + 落盘段);`plugins/speccode/bin/speccode.mjs`(read-memory/write-memory 校验例外,204-205 / 214 行);`plugins/speccode/lib/prtool.mjs` 已有 `createPrArgs`(复用,命令层 shell out)。
- 行为:**BREAKING**——knowledge 命令不再可在 worktree/feature 分支运行(需回 trunk);不再写 feature memory、不再经 finishing-feature。`/speccode:status` 不再跟踪 knowledge PR(docs,非 feature)。
- 测试:`tests/cli.test.mjs` 增 `_knowledge` memory + trunk-bootstrap / `pr_tool=none` / worktree 拒绝用例;依赖注入测 PR 创建(不依赖真实 `gh`)。
- 文档:插件 README 命令表两条(knowledge 命令约束列 `worktree-*` → `trunk`)+ 中英两版同步;CHANGELOG 标 BREAKING。
