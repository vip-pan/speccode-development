## MODIFIED Requirements

### Requirement: 命令正文手写路径与引擎一致

命令正文里手写的 `.speccode/` 相对路径(`reset` 的 `rm -rf .speccode/state/`、`reset` 询问清理的 `.speccode/memory/` 与 `.speccode/sdd/` 等)SHALL 以 `--cwd` 指向的项目根为基准,与引擎 `speccodeDirOf(cwd)` 解析的目录一致。这保证裸调方案下命令正文的手写路径与引擎写入路径落在同一 `.speccode/` 目录。

#### Scenario: 手写路径与引擎写入路径一致
- **WHEN** 命令正文执行 `rm -rf .speccode/state/`(reset)或引用 `.speccode/memory/`、`.speccode/sdd/`(reset 清理询问、SDD 工作区),且 `--cwd .` 指向目标项目根
- **THEN** 这些手写路径解析到的目录与 `speccode.mjs resolve-speccode-dir --cwd .` 返回的 `speccodeDir` 相同(均为 `<repoRoot>/.speccode`),不会因裸调方式改变基准

#### Scenario: 不出现已删除机制的用例
- **WHEN** 检查本 requirement 的正文与 Scenario
- **THEN** MUST NOT 以 display-reset-to-trunk 命令、`untracked_permanent` 字段或 `.speccode/backup/` 等 v2 已删除的机制作为用例

### Requirement: plugin.json 元数据

`plugins/speccode/.claude-plugin/plugin.json` SHALL 声明 `name: "speccode"`(提供 `/speccode:` 命名空间)、`version: "0.2.0"`(语义化版本,控制用户更新检测;0.1.0 → 0.2.0 反映命令改名与 config v2 的 BREAKING 变更)、`description`、`author`(含 `name`)、`license`,并 SHOULD 声明 `homepage`、`repository`、`keywords`(含 `"sdd"`、`"tdd"`、`"hooks"`、`"memory"` 等)。

#### Scenario: plugin.json 必填与推荐字段
- **WHEN** 读取 `plugins/speccode/.claude-plugin/plugin.json`
- **THEN** `name` 为 `speccode`,`version` 为 `0.2.0`,存在 `description`、`author.name`、`license`;`homepage` 与 `repository` 指向 `speccode-development` 仓库

#### Scenario: 版本号控制更新
- **WHEN** 用户已安装 `0.1.0` 且仓库将 version 提升为 `0.2.0`
- **THEN** 用户侧 MUST 触发更新检测;未 bump version 的调试 commit MUST NOT 触发更新

### Requirement: 命令命名空间

speccode 的 21 个 slash 命令 SHALL 通过 `plugin.json` 的 `name: "speccode"` 自动获得 `/speccode:` 前缀命名空间,命令 markdown 位于 `plugins/speccode/commands/`(扁平 `.md`),SHALL NOT 通过 `commands/speccode/` 子目录前缀实现命名空间。

#### Scenario: 安装后命令命名空间
- **WHEN** 用户安装 speccode 插件后列出可用命令
- **THEN** 21 个命令以 `/speccode:` 前缀形式出现:`init`、`exploring`、`creating-feature`、`creating-worktree`、`proposing`、`brainstorming`、`writing-plans`、`executing-plans`、`subagent-driven-development`、`dispatching-parallel-agents`、`test-driven-development`、`systematic-debugging`、`requesting-code-review`、`receiving-code-review`、`verification-before-completion`、`syncing`、`archiving`、`finishing-worktree`、`finishing-feature`、`status`、`reset`

#### Scenario: 旧命令名不再出现
- **WHEN** 用户安装 0.2.0 后列出可用命令
- **THEN** `/speccode:start`、`/speccode:develop-start`、`/speccode:develop-complete`、`/speccode:finish`、`/speccode:display-merge-trunk`、`/speccode:display-rebase-trunk`、`/speccode:display-reset-to-trunk` MUST NOT 出现

### Requirement: 文档三层分离

仓库 SHALL 维护三层文档:根 `README.md` 作为 marketplace 索引(项目描述 + 插件列表 + 安装方式);`plugins/speccode/README.md` 作为用户文档(21 命令表 / 三层分支拓扑图 / R1-R13 风险 / 0.1→0.2 迁移对照表);`CLAUDE.md` 作为开发文档(三层引擎架构、测试约定、OpenSpec 工作流、marketplace 结构,路径全部指向 `plugins/speccode/`)。

#### Scenario: 三层文档各司其职
- **WHEN** 检查仓库根 README.md、plugins/speccode/README.md、CLAUDE.md
- **THEN** 根 README 含 marketplace 描述与插件列表;插件 README 含 21 命令表与三层拓扑图;CLAUDE.md 含引擎三层架构与测试命令,且无对 `.claude/speccode/` 旧路径的引用

#### Scenario: 用户文档与 v2 一致
- **WHEN** 检查 `plugins/speccode/README.md`
- **THEN** 命令表 MUST 为 21 个新命令,拓扑图 MUST 为 trunk/feature/worktree 三层,且 MUST 含 0.1→0.2 迁移对照表,不存在 display / `-complete` 分支的现行行为描述
