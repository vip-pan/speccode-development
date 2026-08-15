# plugin-packaging Delta: knowledge-command-rename

## MODIFIED Requirements

### Requirement: 命令命名空间

speccode 的 23 个 slash 命令 SHALL 通过 `plugin.json` 的 `name: "speccode"` 自动获得 `/speccode:` 前缀命名空间,命令 markdown 位于 `plugins/speccode/commands/`(扁平 `.md`),SHALL NOT 通过 `commands/speccode/` 子目录前缀实现命名空间。

#### Scenario: 安装后命令命名空间

- **WHEN** 用户安装 speccode 插件后列出可用命令
- **THEN** 23 个命令以 `/speccode:` 前缀形式出现:`init`、`exploring`、`creating-feature`、`creating-worktree`、`proposing`、`brainstorming`、`writing-plans`、`executing-plans`、`subagent-driven-development`、`dispatching-parallel-agents`、`test-driven-development`、`systematic-debugging`、`requesting-code-review`、`receiving-code-review`、`verification-before-completion`、`syncing`、`archiving`、`finishing-worktree`、`finishing-feature`、`status`、`reset`、`recording-knowledge`、`distilling-knowledge`

#### Scenario: 旧知识命令名不再出现

- **WHEN** 用户安装含本变更的版本后列出可用命令
- **THEN** `/speccode:memorize`、`/speccode:promote-knowledge` MUST NOT 出现
