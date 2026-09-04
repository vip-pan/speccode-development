# plugin-packaging Delta:commands/ → skills/ 全迁移

## MODIFIED Requirements

### Requirement: 插件根目录布局

speccode 插件根 SHALL 位于仓库的 `plugins/speccode/`，并 MUST 含 `.claude-plugin/plugin.json`（manifest）、`skills/`（skill markdown，`<name>/SKILL.md` 目录式布局）、`bin/speccode.mjs`（CLI 引擎入口）、`lib/`（引擎纯逻辑模块）、`tests/`（单测）。插件根 MUST NOT 把组件放在 `.claude-plugin/` 目录内部，MUST NOT 存在遗留的 `commands/` 目录。

#### Scenario: 插件根目录树

- **WHEN** 列出 `plugins/speccode/` 内容
- **THEN** 存在 `.claude-plugin/plugin.json`、`skills/`、`bin/speccode.mjs`、`lib/`、`tests/`、`README.md`，且 `.claude-plugin/` 下只有 `plugin.json` 一个文件，且不存在 `commands/` 目录

#### Scenario: skill 目录式布局

- **WHEN** 列出 `plugins/speccode/skills/` 内容
- **THEN** 每个 skill 为一个目录，目录内含 `SKILL.md`（如 `skills/exploring/SKILL.md`），不存在扁平 `.md` 文件形态

#### Scenario: 引擎源码随插件搬移后内部 import 不变

- **WHEN** 检查 `plugins/speccode/bin/speccode.mjs` 与 `plugins/speccode/lib/*.mjs` 的 import 语句
- **THEN** 全部为 `node:` 内置模块或 `./`、`../lib/` 相对路径，无对 `.claude/speccode/` 旧路径的引用

### Requirement: 命令通过 bin/ PATH 裸调引擎

命令正文 SHALL 通过裸调 `speccode.mjs <verb> --cwd .` 引擎（依赖插件 `bin/` 在启用期间被加入 Bash 工具 PATH），而非写死 `node <绝对或相对路径>/speccode.mjs`。`speccode.mjs` MUST 具备 `#!/usr/bin/env node` shebang 与可执行位。stdin 管道写法（`echo '<json>' | speccode.mjs <verb> --json-stdin`）MUST 保持兼容。

#### Scenario: 命令正文裸调形态

- **WHEN** 检查 `plugins/speccode/skills/*/SKILL.md`
- **THEN** 引擎调用写作 `speccode.mjs <verb> --cwd .`，不存在 `node .claude/speccode/bin/speccode.mjs` 或 `node ${CLAUDE_PLUGIN_ROOT}` 形态的引用

#### Scenario: stdin 管道写法兼容

- **WHEN** 命令需写入 config/state
- **THEN** 写作 `echo '<json>' | speccode.mjs <verb> --cwd . --json-stdin`，shebang 负责以 node 执行，管道数据正常进入 stdin

#### Scenario: speccode.mjs 可执行性

- **WHEN** 检查 `plugins/speccode/bin/speccode.mjs` 文件权限与首行
- **THEN** 首行为 `#!/usr/bin/env node`，文件具备可执行位（`+x`）

### Requirement: 插件源码与运行时数据边界

插件源码（`plugins/speccode/`、`.claude-plugin/`、`skills/`、`bin/`、`lib/`）SHALL 被 git 跟踪。speccode 在目标项目产生的运行时数据 `.speccode/`（config + state）SHALL 落在目标项目仓库根（由引擎 `repoRoot` + `speccodeDirOf` 定位），与插件安装位置解耦；引擎 SHALL NOT 把状态写入 `${CLAUDE_PLUGIN_ROOT}` 或 `${CLAUDE_PLUGIN_DATA}`。

#### Scenario: 运行时数据落目标项目根

- **WHEN** 在任意目标项目执行 speccode 命令
- **THEN** `.speccode/config.json` 与 `state/features/*.json` 写入该目标项目的仓库根，与 speccode 插件装在何处无关

#### Scenario: 插件源码不混入运行时数据

- **WHEN** 检查 `plugins/speccode/` 目录
- **THEN** 不含 `.speccode/`、`config.json`、`state/` 等运行时数据；这些只出现在目标项目根

### Requirement: 命令命名空间

speccode 的全部 slash 命令 SHALL 通过 `plugin.json` 的 `name: "speccode"` 自动获得 `/speccode:` 前缀命名空间,skill markdown 位于 `plugins/speccode/skills/<name>/SKILL.md`(一 skill 一目录,调用名 = 目录名),SHALL NOT 通过 `commands/speccode/` 或 `skills/speccode/` 子目录前缀实现命名空间。

#### Scenario: 安装后命令命名空间

- **WHEN** 用户安装 speccode 插件后列出可用命令
- **THEN** 24 个命令以 `/speccode:` 前缀形式出现:`init`、`exploring`、`creating-feature`、`creating-worktree`、`proposing`、`brainstorming`、`writing-plans`、`applying`、`executing-plans`、`subagent-driven-development`、`dispatching-parallel-agents`、`test-driven-development`、`systematic-debugging`、`requesting-code-review`、`receiving-code-review`、`verification-before-completion`、`syncing`、`archiving`、`finishing-worktree`、`finishing-feature`、`status`、`reset`、`recording-knowledge`、`distilling-knowledge`

#### Scenario: 旧知识命令名不再出现

- **WHEN** 用户安装含本变更的版本后列出可用命令
- **THEN** `/speccode:memorize`、`/speccode:promote-knowledge` MUST NOT 出现

#### Scenario: 旧命令名不再出现

- **WHEN** 用户安装 0.2.x 后列出可用命令
- **THEN** `/speccode:start`、`/speccode:develop-start`、`/speccode:develop-complete`、`/speccode:finish`、`/speccode:display-merge-trunk`、`/speccode:display-rebase-trunk`、`/speccode:display-reset-to-trunk` MUST NOT 出现

## ADDED Requirements

### Requirement: skill frontmatter 契约

`plugins/speccode/skills/<name>/SKILL.md` 的 frontmatter SHALL 只含 `description`(中文,含触发时机语义,同时作为模型自动调用的匹配面);MUST NOT 含 `name`(调用名回落目录名)、`category`、`tags` 等非 commands 时代遗留或非标字段。skill SHALL 保持模型可自动调用(MUST NOT 设 `disable-model-invocation`),用户显式 `/speccode:<name>` 调用语义不变。

#### Scenario: frontmatter 只含 description

- **WHEN** 检查 24 个 `plugins/speccode/skills/<name>/SKILL.md` 的 frontmatter
- **THEN** 每个仅含 `description` 一个字段,无 `name`/`category`/`tags` 残留

#### Scenario: 调用名不变

- **WHEN** 用户显式输入 `/speccode:<name>`(如 `/speccode:exploring`)
- **THEN** 调用目录名为 `<name>` 的 skill,与迁移前 command 的调用名一致

#### Scenario: 模型自动调用可用

- **WHEN** Claude 会话中出现匹配某 skill description 触发时机的任务(如实现功能时匹配 test-driven-development)
- **THEN** 该 skill 可被模型自动调用,且用户显式调用路径不受影响
