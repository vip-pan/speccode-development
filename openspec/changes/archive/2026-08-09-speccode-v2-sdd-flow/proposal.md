# Proposal: speccode-v2-sdd-flow

## Why

speccode v1 的 trunk/display/feature/worktree 四层拓扑中,display 与 `<feature>-complete` 分支承载的「文档在 display/feature 跟踪、trunk 不跟踪」语义是插件最大的复杂度与事故源(finish 双 PR 串行阻塞、`git rm --cached` + amend 改写历史、display-reset 四步走)。同时,superpowers 方法论(TDD、SDD、systematic-debugging 等)与 opsx 文档流(propose/sync/archive)在 v1 中完全缺位,用户只能手工拼合外部插件;跨会话长任务无记忆机制;外部系统(IM 通知等)无生命周期挂点。v2 一次性收敛拓扑、补齐文档生命周期与方法论命令、落地 hooks 与 memory。

## What Changes

- **BREAKING: 三层拓扑收敛** — 删除 display 分支与 `<feature>-complete` 临时分支;下线 `display-merge-trunk` / `display-rebase-trunk` / `display-reset-to-trunk` 三个命令;finishing-feature 简化为「单 PR → trunk」。
- **BREAKING: docstrip 机制退休** — 文档(目标项目 `speccode/` 目录)在包括 trunk 在内的所有分支一律 git tracked;`git rm --cached` 剥离、amend、四步走全部删除;`lib/docstrip.mjs` 物理删除。
- **BREAKING: 4 个命令改名,无别名** — `start`→`creating-feature`、`develop-start`→`creating-worktree`、`develop-complete`→`finishing-worktree`、`finish`→`finishing-feature`;旧命令文件删除;state 中遗留 `pending_operation.command` 旧值由引擎规范化(readState/listActiveFeatures 双路径)。
- **BREAKING: config v2** — 删除 `display`、`spec_tools`、`untracked_permanent`;新增 `hooks`(事件→shell 命令)、`knowledge_tools`(探测结果登记)、`worktree_dir`(默认 `.claude/worktrees`);version 升 2。
- **新增 14 个命令** — 文档生命周期 6 个(exploring / proposing / brainstorming / writing-plans / syncing / archiving)+ 执行方法论 8 个(executing-plans / subagent-driven-development / dispatching-parallel-agents / test-driven-development / systematic-debugging / requesting-code-review / receiving-code-review / verification-before-completion)。superpowers 能力完整拷贝进 speccode(自包含,含 visual companion 脚本群);opsx 文档流改造为纯 agent 驱动(不依赖 openspec CLI)。
- **文档目录布局(目标项目)** — `speccode/changes/<slug>/{propose,brainstorm,plan}/`、`speccode/spec/`、`speccode/archive/<YYYY-MM-DD>-<slug>/`;所有文档命令「落盘即 commit」。
- **init 增强** — 探测代码知识库工具(understand-anything / CodeGraph / Graphify / CodeMap / LightRAG;插件目录/MCP 配置/CLI/项目配置目录四类启发式)并逐项确认登记;询问并写入 `worktree_dir`(配置键被删时下次 creating-worktree 重问并写回)。
- **creating-worktree 增强** — 融合 superpowers using-git-worktrees:worktree 目录可配置、创建前 `git check-ignore` warn-only 校验、新项目 setup(按标记文件探测 npm/cargo/pip 等)、完成后引导 proposing(auto 模式自动衔接)。
- **finishing-worktree 增强** — 融合 finishing-a-development-branch:合并前跑全量测试(失败即停);菜单 = PR等待 / PR不等待 / 本地squash / 保留;丢弃路径需逐字输入 `discard`;worktree 清理仅限「resolve-worktree-dir 之下且带配置前缀」。
- **hooks(配置驱动事件点)** — 14 个固定事件(onExplored/onFeatureCreated/onWorktreeCreated/onProposed/onBrainstormed/onPlanned/onTaskCompleted/onCodeReviewRequested/onCodeReviewCompleted/onWorktreeFinished/onFeatureFinished/onPrOpened/onSynced/onArchived);hook 进程经 stdin 收单行 JSON;warn-only 失败语义(30s 超时,run-hook 永远 exit 0)。
- **memory(feature 级跨会话记忆)** — 主仓 `.speccode/memory/<type>__<slug>.md`,untracked,writeTextAtomic 原子写;命令入口读/出口写;命令 prose 内置「主动发现超大会话」触发判据(阶段完成/上下文显著增长/compact 恢复后主动书写)。
- **引擎 verb 面** — 新增 9 个:run-hook / read-memory / write-memory / detect-knowledge-tools / resolve-worktree-dir / query-pr / sdd-workspace / task-brief / review-package;删除 `lib/waitmerge.mjs`(阻塞 30min 与 Bash 超时模型不兼容,从未接线;改为 query-pr 单次查询 + 命令层轮询);`--json-stdin` 显式化(写 verb 缺 flag 报 `{ok:false}`);reconcile prefix 改读 `config.worktree_prefix`(带 `'worktree-'` 兜底)。

## Capabilities

### New Capabilities

- `sdd-document-lifecycle`: speccode 自有文档生命周期——exploring/proposing/brainstorming/writing-plans/syncing/archiving 六个文档命令、`speccode/` 目录布局、文档全分支 tracked 语义、落盘即 commit 节奏、SDD 执行工件(工作区/task-brief/review-package)的引擎契约。
- `hook-event-integration`: 配置驱动的生命周期事件钩子——hooks 配置字段、14 个固定事件枚举、stdin JSON payload、warn-only 失败语义、run-hook verb 与各命令接线节点。
- `session-memory`: feature 级跨会话记忆——文件位置与命名、writeTextAtomic 原子写、read-memory/write-memory verb、命令读写时机、超大会话主动发现与书写指引。
- `knowledge-tool-integration`: 代码知识库工具的探测、登记与 advisory 咨询;worktree_dir 配置项的询问/解析/重问写回。

### Modified Capabilities

- `git-workflow-lifecycle`: 四层拓扑改三层(移除 display/-complete 相关 3 条);命令清单 10→21;finish 双 PR 流程改 finishing-feature 单 PR;finishing-worktree 增加测试验证/选项菜单/typed-discard/清理来源限定;creating-worktree 增加后续引导;PR 等待改 query-pr 轮询表述。
- `speccode-config-management`: config 字段集升 v2(删 3 增 3);pending_operation command 枚举值改名;新增 legacy pending_operation 规范化要求。
- `pr-tool-integration`: 各 requirement 中旧命令名引用改名;新增 query-pr 单次查询 verb 要求。
- `plugin-packaging`: 命令命名空间 requirement 更新为 21 命令;plugin.json 元数据 version 0.1.0→0.2.0;文档三层分离中「10 命令表」表述更新;命令正文手写路径与引擎一致中已删命令/字段的用例替换(restructure-as-claude-code-plugin 已归档、主 spec 已落地,4 条 MODIFIED 直接作用于主 spec)。

### Removed Capabilities

- `spec-docs-tracking-control`: 整体移除(6 条 requirement 全部 REMOVED)。该 capability 全部锚定在被删除的 docstrip/display 机制上;残余正面语义(文档永远 tracked)并入 `sdd-document-lifecycle`。sync 后物理删除 `openspec/specs/spec-docs-tracking-control/` 目录(主 spec 空壳过不了 `requirements.min(1)` 校验;本 change 的 sync/archive 必须走 `/opsx:sync` + `/opsx:archive` agent 流,不能用裸 `openspec archive`)。

## Impact

- **命令层**:`plugins/speccode/commands/` 删 7(start/develop-start/develop-complete/finish/display-\*×3)、改写 7(init/creating-feature/creating-worktree/finishing-worktree/finishing-feature/status/reset)、新增 14;新增 `plugins/speccode/references/` 伴侣文件目录(SDD prompt 模板、debugging 技术文档、TDD 写作指南、visual companion 全套)。
- **引擎**:`plugins/speccode/lib/` 新增 hooks/memory/detect/sdd 四模块,修改 atomic(+writeTextAtomic)/state(+normalizeState 双路径调用)/config(删 DEFAULT_UNTRACKED);删除 docstrip.mjs、waitmerge.mjs;`bin/speccode.mjs` 新增 9 verb、`--json-stdin` 显式化、reconcile prefix 读 config(带兜底)。
- **测试**:新增 hooks/memory/detect/sdd 四个测试文件;修改 cli/state/config 测试(两个 no-config reconcile cli 测试保留不动;config.test.mjs 删 DEFAULT_UNTRACKED 引用)。
- **文档**:`plugins/speccode/README.md` 全量重写(三层拓扑图、21 命令表、R1–R13 风险修订、0.1→0.2 迁移对照表);`CLAUDE.md` 更新;`plugins/speccode/.claude-plugin/plugin.json` version 0.1.0→0.2.0。
- **specs**:4 个新 capability spec、4 个修改、1 个移除(目录物理删除)。
- **迁移**:0.1 用户需重新 `/speccode:init` 升级 config v2;旧命令名无别名;遗留 display 分支与 `waiting_display_pr` 挂起态需按指引手动收尾。
- **外部依赖**:保持零第三方依赖(纯 `node:` 内置模块);目标项目无需安装 openspec CLI 或 superpowers 插件。
