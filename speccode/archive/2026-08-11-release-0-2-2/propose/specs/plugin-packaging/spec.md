# plugin-packaging Delta

## MODIFIED Requirements

### Requirement: plugin.json 元数据

`plugins/speccode/.claude-plugin/plugin.json` SHALL 声明 `name: "speccode"`(提供 `/speccode:` 命名空间)、`version`(MUST 为合法语义化版本,且与根 `CHANGELOG.md` 最新版本小节一致——规格 MUST NOT 把 version 钉死为字面量,否则每次发版必然制造规格漂移)、`description`、`author`(含 `name`)、`license`,并 SHOULD 声明 `homepage`、`repository`、`keywords`(含 `"sdd"`、`"tdd"`、`"hooks"`、`"memory"` 等)。

#### Scenario: plugin.json 必填与推荐字段
- **WHEN** 读取 `plugins/speccode/.claude-plugin/plugin.json`
- **THEN** `name` 为 `speccode`;`version` 匹配 `^\d+\.\d+\.\d+$` 且与 `CHANGELOG.md` 最新版本小节的版本号一致;存在 `description`、`author.name`、`license`;`homepage` 与 `repository` 指向 `speccode-development` 仓库

#### Scenario: 版本号控制更新
- **WHEN** 用户已安装某版本且仓库将 `version` 提升为新版本(如 BREAKING 升级 0.1.0 → 0.2.0)
- **THEN** 用户侧 MUST 触发更新检测;未 bump version 的调试 commit MUST NOT 触发更新

### Requirement: 命令命名空间

speccode 的 21 个 slash 命令 SHALL 通过 `plugin.json` 的 `name: "speccode"` 自动获得 `/speccode:` 前缀命名空间,命令 markdown 位于 `plugins/speccode/commands/`(扁平 `.md`),SHALL NOT 通过 `commands/speccode/` 子目录前缀实现命名空间。

#### Scenario: 安装后命令命名空间
- **WHEN** 用户安装 speccode 插件后列出可用命令
- **THEN** 21 个命令以 `/speccode:` 前缀形式出现:`init`、`exploring`、`creating-feature`、`creating-worktree`、`proposing`、`brainstorming`、`writing-plans`、`executing-plans`、`subagent-driven-development`、`dispatching-parallel-agents`、`test-driven-development`、`systematic-debugging`、`requesting-code-review`、`receiving-code-review`、`verification-before-completion`、`syncing`、`archiving`、`finishing-worktree`、`finishing-feature`、`status`、`reset`

#### Scenario: 旧命令名不再出现
- **WHEN** 用户安装 0.2.x 后列出可用命令
- **THEN** `/speccode:start`、`/speccode:develop-start`、`/speccode:develop-complete`、`/speccode:finish`、`/speccode:display-merge-trunk`、`/speccode:display-rebase-trunk`、`/speccode:display-reset-to-trunk` MUST NOT 出现
