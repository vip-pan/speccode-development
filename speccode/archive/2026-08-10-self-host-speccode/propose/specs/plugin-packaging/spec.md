# plugin-packaging Delta

## MODIFIED Requirements

### Requirement: 文档三层分离

仓库 SHALL 维护三层文档:根 `README.md` 作为 marketplace 索引(项目描述 + 插件列表 + 安装方式);`plugins/speccode/README.md` 作为用户文档(21 命令表 / 三层分支拓扑图 / R1-R13 风险 / 0.1→0.2 迁移对照表);`CLAUDE.md` 作为开发文档(三层引擎架构、测试约定、speccode 工作流、marketplace 结构,路径全部指向 `plugins/speccode/`)。

#### Scenario: 三层文档各司其职
- **WHEN** 检查仓库根 README.md、plugins/speccode/README.md、CLAUDE.md
- **THEN** 根 README 含 marketplace 描述与插件列表;插件 README 含 21 命令表与三层拓扑图;CLAUDE.md 含引擎三层架构与测试命令,且无对 `.claude/speccode/` 旧路径的引用

#### Scenario: 用户文档与 v2 一致
- **WHEN** 检查 `plugins/speccode/README.md`
- **THEN** 命令表 MUST 为 21 个新命令,拓扑图 MUST 为 trunk/feature/worktree 三层,且 MUST 含 0.1→0.2 迁移对照表,不存在 display / `-complete` 分支的现行行为描述

### Requirement: 不打包本仓自用工具

本仓(speccode-development)的自用开发工具 SHALL 为 speccode 自身命令集——spec 变更走 `speccode/changes/` 工作流,SHALL NOT 依赖插件自身以外的 spec 管理工具;仓库 `.claude/` 下的任何本仓自用工具(命令、skills)SHALL NOT 打包进 speccode 插件目录。`.claude/settings.local.json` SHALL 只含通配 permission(`Bash(node *)` 已覆盖 `speccode.mjs` 裸调),不得出现指向旧 `.claude/speccode/bin/speccode.mjs` 绝对路径的条目。

#### Scenario: 自用工具不进插件
- **WHEN** 检查 `plugins/speccode/` 与仓库 `.claude/`
- **THEN** 插件目录不含任何本仓自用工具命令与 skills,两者内容无重叠

#### Scenario: settings 清理绝对路径 permission
- **WHEN** 读取 `.claude/settings.local.json`
- **THEN** 不存在指向 `.../coding/.claude/speccode/bin/speccode.mjs` 的绝对路径 permission 条目;保留 `Bash(node *)` 等通配条目
