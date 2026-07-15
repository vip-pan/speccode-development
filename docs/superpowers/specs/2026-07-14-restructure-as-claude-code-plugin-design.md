# Design: Restructure speccode as a Claude Code Plugin

**Date**: 2026-07-14
**Status**: Draft (pending user review; includes 5 revisions from brainstorming self-review)
**Companion OpenSpec change**: `openspec/changes/restructure-as-claude-code-plugin/`

> 本文档是 superpowers brainstorming 产出的设计 spec，与 OpenSpec change `restructure-as-claude-code-plugin` 保持一致。两者描述同一设计；修订时必须双向同步。OpenSpec artifact 是可被 `/opsx:apply` 执行的契约，本文档是设计推理的完整记录。

## Context

speccode 当前以"散落在 `.claude/` 下的源码 + 命令"形态存在：`.claude/commands/speccode/*.md`(10 命令)、`.claude/speccode/{bin,lib}/`(引擎)、`tests/`(11 测试)。命令正文写死 `node .claude/speccode/bin/speccode.mjs`，测试用 `process.cwd()` 定位 BIN。引擎本身（9 lib + bin）内部全为 `./`、`../lib/` 相对 import，与外部包络解耦良好。

Claude Code 插件机制（v2.1.x，2026 中）的官方结构要求：插件根放 `.claude-plugin/plugin.json`，组件在插件根而非 `.claude-plugin/` 内；marketplace 仓根放 `.claude-plugin/marketplace.json`；`bin/` 内容在插件启用期间被加入 Bash 工具 PATH；命令命名空间由 `plugin.json` 的 `name` 提供；`${CLAUDE_PLUGIN_ROOT}` 可引用插件安装目录但每次更新会变（ephemeral），不可存状态。

约束：零第三方依赖（纯 `node:` 内置模块）、Node ≥ 24、纯 ESM、无 package.json。`.speccode/` 运行时数据是 speccode 对外契约，落目标项目根。

## Goals / Non-Goals

**Goals:**
- 仓库重组成标准 Claude Code marketplace + plugin 结构，支持 `/plugin marketplace add` + `/plugin install` 安装。
- 命令自动获得 `/speccode:` 命名空间。
- 引擎逻辑零改动（纯包络层重组）。
- 测试从任意 cwd 执行均通过（解耦 `process.cwd()`）。
- 三层文档清晰分离：marketplace 索引 / 用户文档 / 开发文档。
- 三层命名统一：根目录 = marketplace name = GitHub 仓库名 = `speccode-development`。

**Non-Goals:**
- 不改任何 spec 级行为（git-workflow-lifecycle / pr-tool-integration / spec-docs-tracking-control / speccode-config-management 的 35 个 requirement 全不动）。
- 不引入 hooks（自动 reconcile 留作后续独立 change）。
- 不做 `--cwd` 默认值优化（引擎层改动，留后续）。
- 不把 `commands/` 迁移成 `skills/`（命令本就是用户显式触发的流程编排）。
- 不打包 opsx/openspec 工具（本仓自用，非 speccode 插件内容）。
- 不改 GitHub 仓库本身（网页操作，本 change 只产本地结构与文档）。

## Decisions

### D1: marketplace 仓 + 插件子目录，而非仓库根即插件根

仓库根 = marketplace（`.claude-plugin/marketplace.json`，name `speccode-development`），插件 = `plugins/speccode/` 子目录，`marketplace.json` 的 `source: "./plugins/speccode"` 指向它。

**备选**：仓库根直接当插件根（不建 marketplace）。**否决理由**：Claude Code 没有 `/plugin install <local-path>` 直接装法——本地持久安装必须走 marketplace，git 远端同理。marketplace 是两种来源的公共机制，必建。子目录布局为未来加第二个插件留扩展位。

### D2: 命令裸调 `speccode.mjs`（方案 B），不用 `${CLAUDE_PLUGIN_ROOT}`

命令正文写 `speccode.mjs <verb> --cwd .`，依赖插件 `bin/` 进 PATH。

**备选 A**：`node "${CLAUDE_PLUGIN_ROOT}/bin/speccode.mjs"`。**备选 C**：`node speccode.mjs`。**否决理由**：`speccode.mjs` 已具备 `#!/usr/bin/env node` shebang 与 `+x` 位，走 `node` 调用等于浪费。裸调让命令正文从"调用深路径脚本"变成"调用一等 CLI"，可读性显著提升。机械改动量与备选 A 相同，但改完是减重。`echo '<json>' | speccode.mjs ... --json-stdin` 管道完全兼容。

**G1 验证结论（修订 1）**：`bin/speccode.mjs` 末尾守卫 `if (process.argv[1].endsWith('speccode.mjs')) main()` 在裸调下安全。文件名固定为 `speccode.mjs`（带 `.mjs`），PATH 解析成绝对路径 / 裸名 / symlink 均 `endsWith` 成立，`main()` 正常触发。唯一不触发的是无扩展名的 `speccode`，但那不是本插件文件名。**无需改代码**。

**已知限制**：PATH 仅插件启用时生效；手动终端调试需用全路径 `node plugins/speccode/bin/speccode.mjs`——记入 CLAUDE.md。

### D3: plugin.json 设 `version: "0.1.0"`

显式 `version: "0.1.0"`。**备选**：不设 version（fallback 到 git commit SHA）。**否决理由**：开发期频繁 commit 不应触发用户侧更新。显式 version 让 bump = 明确发版。`0.x` 语义下 minor bump 可含破坏性改动，符合"插件结构未定稿"现状。

### D4: 测试用 `import.meta.url` + `fileURLToPath` 定位 BIN

`cli.test.mjs` 用 `dirname(fileURLToPath(import.meta.url))` 解析 BIN 为 `tests/../bin/speccode.mjs`。**备选**：保留 `process.cwd()`。**否决理由**：`process.cwd()` 依赖执行目录，从非仓库根跑或 IDE 单文件运行会断。`import.meta.url` 相对测试文件自身定位，从任意 cwd 跑都对。`tests/helpers/tmprepo.mjs` 的 `cwd` 是传入的临时仓库路径、不定位自身，零改动。

### D5: 运行时数据保持目标项目根，引擎零改动

`speccodeDirOf(cwd)` = `join(repoRoot(cwd), '.speccode')` 逻辑不动。**备选**：改用 `${CLAUDE_PLUGIN_DATA}` 或 `dist/`。**否决理由**：`.speccode/` 是 speccode 对外契约。引擎按目标项目 repoRoot 算，与插件装在哪无关。改成 `${CLAUDE_PLUGIN_DATA}` 会把多项目状态混到全局目录，破坏"按 feature 维度隔离、多项目独立"语义；`${CLAUDE_PLUGIN_ROOT}` 每次更新会变，存状态会丢。`dist/` 会改变插件对外行为，已放弃，改用 `.gitignore` 忽略本仓库 dogfood 产生的 `.speccode/`。

### D6: 三层命名统一 `speccode-development`

根目录 `coding → speccode-development`；marketplace name `speccode-development`；GitHub 仓库改名 `speccode-development`；插件 name 保持 `speccode`。**备选**：保留 `coding` 目录名。**否决理由**：三层统一让 `/plugin marketplace add <owner>/speccode-development` 的 repo 名与 marketplace name 对得上。git 跟踪文件内容而非目录名，`mv` 不破坏历史。

### D7: opsx/openspec 留 `.claude/` 不打包

`.claude/commands/opsx/`、`.claude/skills/openspec-*/` 原地保留。**备选**：打包进 speccode / 搨成第二个插件。**否决理由**：用户明确只做 speccode 一个插件。opsx/openspec 是本仓自用 OpenSpec 工具链，与 speccode 流程编排是两回事。原地保留零成本。

## Brainstorming 自审查发现的缺口与修订

### 修订 1 — G1：bin main() 守卫已验证（见 D2）

裸调下 `process.argv[1].endsWith('speccode.mjs')` 安全，无需改代码。design/openspec design 补验证结论。

### 修订 2 — G2：旧 plan 标注废弃

`docs/superpowers/plans/2026-07-10-speccode-plugin.md` 文件头加 DEPRECATED 说明：标注为历史实现计划、路径已过时、当前结构以 `openspec/changes/restructure-as-claude-code-plugin/` 与 `plugins/speccode/` 为准。不删除、不改正文。tasks 第 6 组新增一条。

### 修订 3 — G3：`.speccode/` 手写路径不变量（spec 补 requirement）

命令正文里手写的 `.speccode/` 相对路径（`display-reset-to-trunk` 的 `.speccode/backup/...`、`reset` 的 `rm -rf .speccode/state/`、`init` 的 `untracked_permanent` 默认集合含 `.speccode`）SHALL 以 `--cwd` 指向的项目根为基准，与引擎 `speccodeDirOf` 解析结果一致。spec 新增一条 requirement + 1 场景。

### 修订 4 — G4：与历史归档的关系（proposal 补说明）

本 change 推翻 archived change `2026-07-13-add-speccode-plugin` 的 D10 决策（`.claude/commands/speccode/` 布局），但按 OpenSpec 归档语义不修改归档文件本身。proposal 的 What Changes 末尾加此说明。

### 修订 5 — G5：URL 校准顺序（tasks 明确）

plugin.json 初次写入时 homepage/repository 用占位（`https://github.com/<owner>/speccode-development`，owner 待定），GitHub 改名（tasks 8.2）后再回填校准（tasks 8.4）。task 1.2 与 8.4 各补顺序说明。

## Risks / Trade-offs

- **[R1] 裸调依赖 PATH 仅插件启用时生效** → 缓解：命令 markdown 只在 Claude Code 内被模型执行，PATH 必生效；手动调试用全路径，记入 CLAUDE.md。
- **[R2] 根目录改名破坏写死路径的外部引用**（IDE `.idea/`、shell 别名） → 缓解：tasks 标注"需手动同步外部引用"；`.idea/` 已加入 `.gitignore`。git 内容不受影响。
- **[R3] GitHub 仓库改名导致旧 URL 失效** → 缓解：GitHub 自动保留旧名重定向；tasks 标注手动改名 + 更新 remote。
- **[R4] `version: 0.1.0` 下用户不自动收到调试期更新** → 缓解：开发期 dogfooding 用本地 marketplace（每次重载即最新）；发布期 bump version。预期行为。
- **[R5] 测试搬移后旧测试命令失效** → 缓解：CLAUDE.md 测试命令同步更新为 `node --test ./plugins/speccode/tests/*.test.mjs`。
- **[R6] settings.local.json 重写误删有用 permission** → 缓解：只删指向旧 speccode.mjs 绝对路径的条目，保留通配条目；重写前审查。
- **[R7] marketplace.json source 相对路径在 git 远端解析差异** → 缓解：官方支持 `./plugins/speccode` 相对路径，本地与 git 解析一致；落地后实测验证。
- **[R8] 双份文档（superpowers spec + OpenSpec artifact）漂移** → 缓解：修订时双向同步；本文档头部明确声明与 OpenSpec change 的对应关系，任一处修订必须同步另一处。

## Migration Plan

1. **建结构**：新建 `plugins/speccode/` 子树与根 `.claude-plugin/marketplace.json`、`.gitignore`、根 `README.md`。
2. **搬移**：`git mv` 把 commands(10)/bin/lib/README/tests 从旧位置移到 `plugins/speccode/`（保留 git 历史）。
3. **改路径**：命令正文裸调化（10 文件）；测试 import + BIN 定位（11 文件）。
4. **写文档**：根 README（marketplace 索引）、CLAUDE.md 重写、插件 README 确认搬移、旧 plan 标注废弃。
5. **清理**：settings.local.json 重写；删空目录。
6. **验证**：测试全绿；`openspec validate` 通过；`/plugin marketplace add` + `/plugin install` 实测。
7. **仓库层（手动）**：根目录改名；GitHub 改名；更新 remote；校准 plugin.json URL。
8. **回滚**：所有改动在 `feat/speccode-plugin` 分支，未合并前可 `git reset`；目录搬移用 `git mv` 保留可逆性。

## Open Questions

无。所有决策与 5 处修订已确认收敛。
