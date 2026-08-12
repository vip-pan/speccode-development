## Why

speccode 当前以"散落在 `.claude/` 下的源码 + 命令"形态存在，只能靠手动复制 `.claude/commands/speccode/` 与 `.claude/speccode/` 到目标项目来"安装"，无法版本化、无法更新、无法被 Claude Code 的插件机制识别。需要把仓库重组成标准的 Claude Code marketplace + plugin 结构，使其能通过 `/plugin marketplace add` + `/plugin install` 安装、随版本更新、命令自动获得 `/speccode:` 命名空间。

## What Changes

- **新增 marketplace 结构**：仓库根放 `.claude-plugin/marketplace.json`（name `speccode-development`），插件源码收拢进 `plugins/speccode/` 子目录。
- **新增插件 manifest**：`plugins/speccode/.claude-plugin/plugin.json`，name `speccode`、version `0.1.0`、补全 description/author/license/homepage/repository/keywords。
- **目录搬移**：`.claude/commands/speccode/*.md`(10) → `plugins/speccode/commands/`；`.claude/speccode/bin/`+`lib/`+`README.md` → `plugins/speccode/{bin,lib,README.md}`；`tests/` → `plugins/speccode/tests/`。
- **命令调用方式改造**：命令正文从 `node .claude/speccode/bin/speccode.mjs <verb> --cwd .` 改为依赖插件 `bin/` 进 PATH 的裸调 `speccode.mjs <verb> --cwd .`（含 `echo '<json>' | speccode.mjs ... --json-stdin` 管道写法）。`speccode.mjs` 已具备 shebang `#!/usr/bin/env node` 与 `+x` 位。
- **测试路径解耦**：`cli.test.mjs` 用 `import.meta.url`+`fileURLToPath` 定位 BIN，不再依赖 `process.cwd()`；11 个测试文件 import 路径从 `../.claude/speccode/lib|bin/*` 改为 `../lib|bin/*`。
- **文档三层拆分**：根 `README.md` = marketplace 索引（项目描述 + 插件列表 + 安装方式）；`plugins/speccode/README.md` = 用户文档（10 命令表 / 拓扑图 / R1-R10，整体搬移）；`CLAUDE.md` 重写为开发视角（三层架构、测试命令、OpenSpec、marketplace 结构，路径全部更新）。
- **新增 `.gitignore`**：仓库根忽略 `.speccode/`（dogfood 运行时数据）、`.idea/`。
- **settings.local.json 重写**：清掉指向旧 `.claude/speccode/bin/speccode.mjs` 绝对路径的 permission，只保留通配 permission（`Bash(node *)` 已覆盖裸调）。
- **BREAKING（仓库自身）**：根目录 `coding/` 改名为 `speccode-development/`；GitHub 仓库名同步改为 `speccode-development`。此为仓库层重命名，不影响插件对外行为，但任何写死 `coding` 路径的外部引用（IDE 配置、shell 别名）需同步。
- **保留不动**：`.claude/commands/opsx/`(9)、`.claude/skills/openspec-*/`(9) 留在 `.claude/` 不打包，作为本仓库自用工具；`openspec/`、`docs/` 保留；引擎 9 个 lib 模块 + bin 内部逻辑零改动。
- **与历史归档的关系**：本 change 推翻 archived change `2026-07-13-add-speccode-plugin` 的 D10 决策（`.claude/commands/speccode/` 布局），但按 OpenSpec 归档语义不修改归档文件本身——归档是历史快照，仅在本 proposal 文字层面声明该决策已被取代。
- **不在本 change 范围**：hooks 自动 reconcile、`--cwd` 默认值优化、`commands/`→`skills/` 迁移，均记录为后续独立 change。

## Capabilities

### New Capabilities
- `plugin-packaging`: speccode 作为 Claude Code 插件的打包结构契约——marketplace 仓 + plugin 子目录布局、plugin.json/marketplace.json 字段、命令通过 `bin/` PATH 裸调引擎的引用方式、插件源码与运行时数据 `.speccode/` 的边界、安装与命名空间机制。

### Modified Capabilities
<!-- 无。本次为包络层重组，不改 git-workflow-lifecycle / pr-tool-integration / spec-docs-tracking-control / speccode-config-management 任何一个 requirement 的 spec 级行为。引擎逻辑零改动。 -->

## Impact

- **目录结构**：仓库根新增 `.claude-plugin/`、`plugins/speccode/`、`.gitignore`、根 `README.md`；`.claude/commands/speccode/` 与 `.claude/speccode/` 清空（内容搬走）；`tests/` 从根移入 `plugins/speccode/tests/`。
- **命令正文**：10 个 `.md` 文件 ~17 处 `node .claude/speccode/bin/speccode.mjs` 调用改为 `speccode.mjs` 裸调（含 2 处 stdin 管道）。
- **测试**：11 个测试文件 import 路径更新；`cli.test.mjs` BIN 定位改 `import.meta.url`。`tests/helpers/tmprepo.mjs` 不依赖 cwd，零改动。
- **文档**：根 `README.md`（新）、`plugins/speccode/README.md`（搬移）、`CLAUDE.md`（重写）。
- **配置**：`.claude/settings.local.json` 重写。
- **仓库层**：根目录改名 `coding → speccode-development`；GitHub 仓库改名（手动）。
- **引擎**：`bin/speccode.mjs` + `lib/*.mjs` 内部 `import` 全为 `./` 或 `../lib/` 相对路径，随目录一起搬移后零改动；`speccodeDirOf`/`repoRoot` 逻辑不动。
- **依赖**：零第三方依赖不变（纯 `node:` 内置模块）。
