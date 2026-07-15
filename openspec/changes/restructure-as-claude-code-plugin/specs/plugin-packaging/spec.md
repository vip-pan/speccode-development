## ADDED Requirements

### Requirement: Marketplace 仓库结构

speccode 的开发库仓库 SHALL 作为 Claude Code marketplace 仓：仓库根 MUST 含 `.claude-plugin/marketplace.json`，其 `name` 字段为 `speccode-development`，`plugins` 数组 MUST 包含一个条目指向 `./plugins/speccode` 作为 speccode 插件的 source。

#### Scenario: marketplace.json 字段齐全
- **WHEN** 读取仓库根 `.claude-plugin/marketplace.json`
- **THEN** 其 `name` 为 `speccode-development`，`owner` 含 `name`，`plugins[0].name` 为 `speccode`，`plugins[0].source` 为 `./plugins/speccode`

#### Scenario: marketplace 可被本地添加
- **WHEN** 执行 `/plugin marketplace add <仓库根绝对路径>`
- **THEN** Claude Code 成功注册名为 `speccode-development` 的 marketplace，且能枚举出 speccode 插件

### Requirement: 插件根目录布局

speccode 插件根 SHALL 位于仓库的 `plugins/speccode/`，并 MUST 含 `.claude-plugin/plugin.json`（manifest）、`commands/`（slash 命令 markdown）、`bin/speccode.mjs`（CLI 引擎入口）、`lib/`（引擎纯逻辑模块）、`tests/`（单测）。插件根 MUST NOT 把组件放在 `.claude-plugin/` 目录内部。

#### Scenario: 插件根目录树
- **WHEN** 列出 `plugins/speccode/` 内容
- **THEN** 存在 `.claude-plugin/plugin.json`、`commands/`、`bin/speccode.mjs`、`lib/`、`tests/`、`README.md`，且 `.claude-plugin/` 下只有 `plugin.json` 一个文件

#### Scenario: 引擎源码随插件搬移后内部 import 不变
- **WHEN** 检查 `plugins/speccode/bin/speccode.mjs` 与 `plugins/speccode/lib/*.mjs` 的 import 语句
- **THEN** 全部为 `node:` 内置模块或 `./`、`../lib/` 相对路径，无对 `.claude/speccode/` 旧路径的引用

### Requirement: plugin.json 元数据

`plugins/speccode/.claude-plugin/plugin.json` SHALL 声明 `name: "speccode"`（提供 `/speccode:` 命名空间）、`version: "0.1.0"`（语义化版本，控制用户更新检测）、`description`、`author`（含 `name`）、`license`，并 SHOULD 声明 `homepage`、`repository`、`keywords`。

#### Scenario: plugin.json 必填与推荐字段
- **WHEN** 读取 `plugins/speccode/.claude-plugin/plugin.json`
- **THEN** `name` 为 `speccode`，`version` 为 `0.1.0`，存在 `description`、`author.name`、`license`；`homepage` 与 `repository` 指向 `speccode-development` 仓库

#### Scenario: 版本号控制更新
- **WHEN** 用户已安装 `0.1.0` 且仓库未 bump version
- **THEN** 用户侧不会因仓库的后续调试 commit 触发更新；仅当 `version` 被提升时才触发更新检测

### Requirement: 命令通过 bin/ PATH 裸调引擎

命令正文 SHALL 通过裸调 `speccode.mjs <verb> --cwd .` 引擎（依赖插件 `bin/` 在启用期间被加入 Bash 工具 PATH），而非写死 `node <绝对或相对路径>/speccode.mjs`。`speccode.mjs` MUST 具备 `#!/usr/bin/env node` shebang 与可执行位。stdin 管道写法（`echo '<json>' | speccode.mjs <verb> --json-stdin`）MUST 保持兼容。

#### Scenario: 命令正文裸调形态
- **WHEN** 检查 `plugins/speccode/commands/*.md`
- **THEN** 引擎调用写作 `speccode.mjs <verb> --cwd .`，不存在 `node .claude/speccode/bin/speccode.mjs` 或 `node ${CLAUDE_PLUGIN_ROOT}` 形态的引用

#### Scenario: stdin 管道写法兼容
- **WHEN** 命令需写入 config/state
- **THEN** 写作 `echo '<json>' | speccode.mjs <verb> --cwd . --json-stdin`，shebang 负责以 node 执行，管道数据正常进入 stdin

#### Scenario: speccode.mjs 可执行性
- **WHEN** 检查 `plugins/speccode/bin/speccode.mjs` 文件权限与首行
- **THEN** 首行为 `#!/usr/bin/env node`，文件具备可执行位（`+x`）

### Requirement: 插件源码与运行时数据边界

插件源码（`plugins/speccode/`、`.claude-plugin/`、`commands/`、`bin/`、`lib/`）SHALL 被 git 跟踪。speccode 在目标项目产生的运行时数据 `.speccode/`（config + state）SHALL 落在目标项目仓库根（由引擎 `repoRoot` + `speccodeDirOf` 定位），与插件安装位置解耦；引擎 SHALL NOT 把状态写入 `${CLAUDE_PLUGIN_ROOT}` 或 `${CLAUDE_PLUGIN_DATA}`。

#### Scenario: 运行时数据落目标项目根
- **WHEN** 在任意目标项目执行 speccode 命令
- **THEN** `.speccode/config.json` 与 `state/features/*.json` 写入该目标项目的仓库根，与 speccode 插件装在何处无关

#### Scenario: 插件源码不混入运行时数据
- **WHEN** 检查 `plugins/speccode/` 目录
- **THEN** 不含 `.speccode/`、`config.json`、`state/` 等运行时数据；这些只出现在目标项目根

### Requirement: 命令正文手写路径与引擎一致

命令正文里手写的 `.speccode/` 相对路径（`display-reset-to-trunk` 的 `.speccode/backup/...`、`reset` 的 `rm -rf .speccode/state/`、`init` 的 `untracked_permanent` 默认集合含 `.speccode`）SHALL 以 `--cwd` 指向的项目根为基准，与引擎 `speccodeDirOf(cwd)` 解析的目录一致。这保证裸调方案下命令正文的手写路径与引擎写入路径落在同一 `.speccode/` 目录。

#### Scenario: 手写路径与引擎写入路径一致
- **WHEN** 命令正文执行 `rm -rf .speccode/state/`（reset）或 `.speccode/backup/...`（display-reset-to-trunk），且 `--cwd .` 指向目标项目根
- **THEN** 这些手写路径解析到的目录与 `speccode.mjs resolve-speccode-dir --cwd .` 返回的 `speccodeDir` 相同（均为 `<repoRoot>/.speccode`），不会因裸调方式改变基准

### Requirement: 命令命名空间

speccode 的 10 个 slash 命令 SHALL 通过 `plugin.json` 的 `name: "speccode"` 自动获得 `/speccode:` 前缀命名空间，命令 markdown 位于 `plugins/speccode/commands/`（扁平 `.md`），SHALL NOT 通过 `commands/speccode/` 子目录前缀实现命名空间。

#### Scenario: 安装后命令命名空间
- **WHEN** 用户安装 speccode 插件后列出可用命令
- **THEN** 10 个命令以 `/speccode:init`、`/speccode:start`、`/speccode:develop-start`、`/speccode:develop-complete`、`/speccode:finish`、`/speccode:status`、`/speccode:reset`、`/speccode:display-merge-trunk`、`/speccode:display-rebase-trunk`、`/speccode:display-reset-to-trunk` 形式出现

### Requirement: 测试路径解耦 cwd

`plugins/speccode/tests/` 下的测试 SHALL 通过 `import.meta.url` + `fileURLToPath` 定位 `bin/speccode.mjs` 与 `lib/*.mjs`，SHALL NOT 依赖 `process.cwd()` 定位插件内部文件。这保证测试从任意 cwd 执行均通过。

#### Scenario: cli 测试定位 BIN 不依赖 cwd
- **WHEN** 从非仓库根目录执行 `node --test plugins/speccode/tests/cli.test.mjs`
- **THEN** 测试通过，BIN 路径由 `import.meta.url` 解析为 `tests/../bin/speccode.mjs`，不依赖当前工作目录

#### Scenario: 测试 import 路径更新
- **WHEN** 检查 `plugins/speccode/tests/*.test.mjs` 的 import 语句
- **THEN** 引用 `../lib/*.mjs` 与 `../bin/speccode.mjs`，不存在 `../.claude/speccode/` 旧路径

### Requirement: 文档三层分离

仓库 SHALL 维护三层文档：根 `README.md` 作为 marketplace 索引（项目描述 + 插件列表 + 安装方式）；`plugins/speccode/README.md` 作为用户文档（10 命令表 / 分支拓扑图 / R1-R10 风险）；`CLAUDE.md` 作为开发文档（三层引擎架构、测试约定、OpenSpec 工作流、marketplace 结构，路径全部指向 `plugins/speccode/`）。

#### Scenario: 三层文档各司其职
- **WHEN** 检查仓库根 README.md、plugins/speccode/README.md、CLAUDE.md
- **THEN** 根 README 含 marketplace 描述与插件列表；插件 README 含命令表与拓扑图；CLAUDE.md 含引擎三层架构与测试命令，且无对 `.claude/speccode/` 旧路径的引用

### Requirement: 仓库层重命名

仓库根目录 SHALL 从 `coding` 改名为 `speccode-development`，与 marketplace name、GitHub 仓库名三层统一。此重命名 SHALL NOT 改变 git 跟踪内容，SHALL NOT 影响插件对外行为；任何写死 `coding` 路径的外部引用（IDE 配置、shell 别名、CI）需由维护者同步更新。

#### Scenario: 三层命名统一
- **WHEN** 确认仓库根目录名、marketplace.json name、GitHub 仓库名
- **THEN** 三者均为 `speccode-development`（插件 name 仍为 `speccode`）

#### Scenario: 重命名不破坏 git
- **WHEN** 根目录从 `coding` 改名为 `speccode-development`
- **THEN** `git status` 与 `git log` 内容不变，git 跟踪的是文件内容而非目录名

### Requirement: 不打包本仓自用工具

`.claude/commands/opsx/`(9 个命令) 与 `.claude/skills/openspec-*/`(9 个 skills) SHALL 留在仓库 `.claude/` 下作为本仓自用工具，SHALL NOT 打包进 speccode 插件目录。`.claude/settings.local.json` SHALL 重写为只含通配 permission（`Bash(node *)` 已覆盖 `speccode.mjs` 裸调），删除所有指向旧 `.claude/speccode/bin/speccode.mjs` 绝对路径的条目。

#### Scenario: opsx/openspec 不进插件
- **WHEN** 检查 `plugins/speccode/`
- **THEN** 不含 opsx 命令与 openspec skills；它们仍保留在仓库 `.claude/commands/opsx/` 与 `.claude/skills/`

#### Scenario: settings 清理绝对路径 permission
- **WHEN** 读取 `.claude/settings.local.json`
- **THEN** 不存在指向 `.../coding/.claude/speccode/bin/speccode.mjs` 的绝对路径 permission 条目；保留 `Bash(node *)` 等通配条目
