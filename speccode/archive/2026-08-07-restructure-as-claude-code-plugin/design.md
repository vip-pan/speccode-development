## Context

speccode 当前以"散落在 `.claude/` 下的源码 + 命令"形态存在：`.claude/commands/speccode/*.md`(10 命令)、`.claude/speccode/{bin,lib}/`(引擎)、`tests/`(11 测试)。命令正文写死 `node .claude/speccode/bin/speccode.mjs`，测试用 `process.cwd()` 定位 BIN。引擎本身（9 lib + bin）内部全为 `./`、`../lib/` 相对 import，与外部包络解耦良好。

Claude Code 插件机制（v2.1.x，2026 中）的官方结构要求：插件根放 `.claude-plugin/plugin.json`，组件（commands/skills/bin/...）在插件根而非 `.claude-plugin/` 内；marketplace 仓根放 `.claude-plugin/marketplace.json`；`bin/` 内容在插件启用期间被加入 Bash 工具 PATH；命令命名空间由 `plugin.json` 的 `name` 提供；`${CLAUDE_PLUGIN_ROOT}` 变量可引用插件安装目录但每次更新会变（ephemeral），不可存状态。

约束：零第三方依赖（纯 `node:` 内置模块）、Node ≥ 24、纯 ESM、无 package.json。`.speccode/` 运行时数据是 speccode 对外契约的一部分，落目标项目根。

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
- 不把 `commands/` 迁移成 `skills/`（命令本就是用户显式触发的流程编排，不应模型自动触发）。
- 不打包 opsx/openspec 工具（本仓自用，非 speccode 插件内容）。
- 不改 GitHub 仓库本身（网页操作，本 change 只产本地结构与文档）。

## Decisions

### D1: marketplace 仓 + 插件子目录，而非仓库根即插件根

**选择**：仓库根 = marketplace（`.claude-plugin/marketplace.json`），插件 = `plugins/speccode/` 子目录，`marketplace.json` 的 `source: "./plugins/speccode"` 指向它。

**备选**：仓库根直接当插件根（不建 marketplace）。

**理由**：用户选了"本地路径 + git 仓库"双来源。Claude Code 没有 `/plugin install <local-path>` 直接装法——本地持久安装必须走 marketplace（`/plugin marketplace add <path>` + `/plugin install speccode@name`），git 远端同理。所以 marketplace 是两种来源的公共机制，必建。marketplace 仓里用子目录放插件，未来加第二个插件不用重构。`marketplace.json` 的 `source` 支持 `./plugins/speccode` 相对路径，天然支持本地与 git 两种来源。

### D2: 命令裸调 `speccode.mjs`（方案 B），不用 `${CLAUDE_PLUGIN_ROOT}`

**选择**：命令正文写 `speccode.mjs <verb> --cwd .`，依赖插件 `bin/` 进 PATH。

**备选 A**：`node "${CLAUDE_PLUGIN_ROOT}/bin/speccode.mjs" <verb>`（显式变量，最保守）。
**备选 C**：`node speccode.mjs`（保留 node 前缀 + PATH）。

**理由**：`speccode.mjs` 已具备 `#!/usr/bin/env node` shebang 与 `+x` 位——这两样是为裸调准备的，走 `node` 调用等于浪费。裸调让命令正文从"调用深路径脚本"变成"调用一等 CLI"（像 `git`/`gh`），可读性显著提升。机械改动量与备选 A 相同（都是 10 文件 ~17 处 + 2 处 stdin 管道），但改完是减重而非增重。`echo '<json>' | speccode.mjs ... --json-stdin` 管道完全兼容（shebang 负责 `env node`，stdin 正常透传）。

**已知限制**：PATH 仅插件启用时生效；手动终端调试需用全路径 `node plugins/speccode/bin/speccode.mjs`——记入 CLAUDE.md。Windows 纯 cmd 不识别 shebang，但 Claude Code 的 Bash 工具走 git-bash/WSL，可忽略。

**G1 验证结论（修订 1）**：`bin/speccode.mjs` 末尾守卫 `if (process.argv[1].endsWith('speccode.mjs')) main()` 在裸调下安全。文件名固定为 `speccode.mjs`（带 `.mjs`），PATH 解析成绝对路径 / 裸名 / symlink 均 `endsWith('speccode.mjs')` 成立，`main()` 正常触发。唯一不触发的是无扩展名的 `speccode`，但那不是本插件文件名。**无需改代码**，方案 B 命门通过。

### D3: plugin.json 设 `version: "0.1.0"`

**选择**：显式 `version: "0.1.0"`。

**备选**：不设 version（fallback 到 git commit SHA，每次 commit 自动更新）。

**理由**：用户在 `feat/speccode-plugin` 分支会频繁 commit 调试，不设 version 会让每次 commit 触发用户侧更新。显式 version 让 bump = 明确发版，更新可控。`0.x` 语义下 minor bump 可含破坏性改动，符合"插件结构未定稿"现状。结构冻结后 bump `1.0.0` 正式发布。

### D4: 测试用 `import.meta.url` + `fileURLToPath` 定位 BIN

**选择**：`cli.test.mjs` 用 `dirname(fileURLToPath(import.meta.url))` 解析 BIN 路径为 `tests/../bin/speccode.mjs`。

**备选**：保留 `join(process.cwd(), 'plugins/speccode/bin/speccode.mjs')`。

**理由**：`process.cwd()` 依赖执行命令时的目录。搬到 `plugins/speccode/tests/` 后，从仓库根跑 `node --test plugins/speccode/tests/*.test.mjs` 时 cwd 恰好是仓库根能凑巧工作，但从其他目录跑或 IDE 单文件运行就会断。`import.meta.url` 相对测试文件自身定位，从任意 cwd 跑都对，纯收益。`tests/helpers/tmprepo.mjs` 的 `cwd` 是传入的临时仓库路径、不定位自身，零改动。

### D5: 运行时数据保持目标项目根，引擎零改动

**选择**：`speccodeDirOf(cwd)` = `join(repoRoot(cwd), '.speccode')` 逻辑不动。

**备选**：改用 `${CLAUDE_PLUGIN_DATA}` 或用户提的 `dist/`。

**理由**：`.speccode/` 是 speccode 对外契约（README R4、命令层都假设它）。引擎按目标项目 repoRoot 算，与插件装在哪无关——dogfood 时落本仓库根，别人装了在别的仓库跑就落那个仓库根。改成 `${CLAUDE_PLUGIN_DATA}` 会把多项目的状态混到一个全局目录，破坏"按 feature 维度隔离、多项目独立"语义；且 `${CLAUDE_PLUGIN_ROOT}` 每次更新会变，存状态会丢。用户提的 `dist/` 会改变插件对外行为（别人装了也落 dist/），已与用户确认放弃，改用 `.gitignore` 忽略本仓库 dogfood 产生的 `.speccode/`。

### D6: 三层命名统一 `speccode-development`

**选择**：根目录 `coding → speccode-development`；marketplace name `speccode-development`；GitHub 仓库改名 `speccode-development`；插件 name 保持 `speccode`。

**备选**：保留 `coding` 目录名，仅 marketplace 用新名。

**理由**：三层统一让 `/plugin marketplace add <owner>/speccode-development` 的 repo 名与 marketplace name 对得上，降低用户认知负担。git 跟踪文件内容而非目录名，`mv` 不破坏 git 历史。GitHub 改名为网页手动操作，本 change 只产本地结构与文档引用更新。

### D7: opsx/openspec 留 `.claude/` 不打包

**选择**：`.claude/commands/opsx/`、`.claude/skills/openspec-*/` 原地保留，不搬进 `plugins/speccode/`。

**备选**：打包进 speccode 插件 / 搬成第二个插件。

**理由**：用户明确只做 speccode 一个插件。opsx/openspec 是本仓自用的 OpenSpec 工具链，与 speccode 流程编排是两回事。原地保留零成本，且它们本就在 `.claude/` 下被本仓库的 Claude Code 会话加载使用。

## Risks / Trade-offs

- **[R1] 裸调依赖 PATH 仅插件启用时生效** → 缓解：命令 markdown 只在 Claude Code 内被模型执行，此场景 PATH 必生效；手动调试用全路径，记入 CLAUDE.md。不构成运行时风险。
- **[R2] 根目录改名 `coding → speccode-development` 破坏写死路径的外部引用**（IDE `.idea/`、shell 别名、其他工具） → 缓解：本 change 在 tasks 标注"需手动同步外部引用"；`.idea/` 已加入 `.gitignore` 不跟踪。git 内容不受影响。
- **[R3] GitHub 仓库改名导致旧 URL 失效** → 缓解：GitHub 自动保留旧名重定向一段时间；本 change 在 tasks 标注"手动在 GitHub 改名 + 更新本地 remote url"。
- **[R4] `version: 0.1.0` 下用户不自动收到调试期更新** → 缓解：开发期 dogfooding 用本地 marketplace（`/plugin marketplace add <path>` 指向本地，每次重载即最新）；发布期 bump version 触发更新。这是预期行为，非缺陷。
- **[R5] 测试搬到 `plugins/speccode/tests/` 后 `node --test ./tests/*.test.mjs` 旧命令失效** → 缓解：CLAUDE.md 测试命令同步更新为 `node --test ./plugins/speccode/tests/*.test.mjs`。
- **[R6] settings.local.json 重写可能误删有用 permission** → 缓解：重写只删指向旧 speccode.mjs 绝对路径的条目，保留 `Bash(node *)`、`Bash(git *)`、`Bash(gh *)` 等通配条目；重写前审查现有清单。
- **[R7] marketplace.json 的 source 相对路径在 git 远端安装时解析差异** → 缓解：Claude Code 官方支持 `./plugins/speccode` 相对路径 source，本地与 git 两种来源解析一致；落地后用 `/plugin marketplace add` 实测验证。
- **[R8] 双份设计文档（superpowers spec + OpenSpec artifact）漂移** → 缓解：修订时双向同步。superpowers spec 位于 `docs/superpowers/specs/2026-07-14-restructure-as-claude-code-plugin-design.md`，头部声明与本 OpenSpec change 的对应关系；任一处修订必须同步另一处。

## Migration Plan

1. **建结构**：新建 `plugins/speccode/` 子树（`.claude-plugin/`、`commands/`、`bin/`、`lib/`、`tests/`、`README.md`）与根 `.claude-plugin/marketplace.json`、根 `.gitignore`、根 `README.md`。
2. **搬移**：`git mv` 把 commands(10)/bin/lib/README/tests 从旧位置移到 `plugins/speccode/` 对应位置（保留 git 历史）。
3. **改路径**：命令正文裸调化（10 文件）；测试 import + BIN 定位（11 文件）。
4. **写文档**：根 README（marketplace 索引）、CLAUDE.md 重写、插件 README 确认搬移到位。
5. **清理**：settings.local.json 重写；删空的 `.claude/commands/speccode/`、`.claude/speccode/` 目录。
6. **验证**：`node --test ./plugins/speccode/tests/*.test.mjs` 全绿；`openspec validate` 通过；`/plugin marketplace add <path>` + `/plugin install speccode@speccode-development` 实测安装成功、`/speccode:status` 可跑。
7. **仓库层（手动）**：根目录 `mv coding speccode-development`；GitHub 网页改名；`git remote set-url` 更新。
8. **回滚**：所有改动在 `feat/speccode-plugin` 分支，未合并前可 `git reset` 回退；目录搬移用 `git mv` 保留可逆性。

## Open Questions

无。所有决策已在 explore 阶段与用户确认收敛：
- 插件边界（只做 speccode）、安装来源（marketplace 本地+git）、运行时数据落点（项目根）——已定。
- 9 个优化点全部定稿（方案 B、version 0.1.0、补元数据、import.meta.url、.gitignore、文档三层拆分、不做 --cwd 默认值、hooks 留后续、不做 skills 迁移）——已定。
- marketplace name（speccode-development）、README 拆法（根索引+插件用户文档）、settings 重写——已定。
