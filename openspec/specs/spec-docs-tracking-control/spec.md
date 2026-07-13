## Purpose

OpenSpec / Superpowers 文档目录的跟踪语义:在 display / feature 分支 tracked、在 trunk 分支 untracked;finish 的 `git rm --cached` + amend 剥离、display-reset 四步走保护文档不丢、未启用工具的目录保护。

## Requirements

### Requirement: spec 文档跟踪语义
OpenSpec / Superpowers 文档目录 SHALL 满足"在 display 分支 tracked、在 feature 分支 tracked、在 trunk 分支 untracked"语义。无论 feature 从 display 还是从 trunk 切出,其上的 spec 文档最终 MUST 为 tracked,以保证无 display 模式下文档也能随 feature 分支在 git 中留存。

#### Scenario: display 上文档是 tracked
- **WHEN** `display.enabled = true` 且 display 分支当前状态正常
- **THEN** `config.spec_tools.*.doc_dir` 列出的目录 MUST 处于 git tracked 状态

#### Scenario: trunk 上文档是 untracked
- **WHEN** trunk 分支当前状态正常
- **THEN** `config.spec_tools.*.doc_dir` 列出的目录 MUST 处于 git untracked 状态(或不存在)

#### Scenario: feature 上文档最终 tracked
- **WHEN** feature 从 trunk 切出(继承 untracked),开发中生成了 spec 文档并经用户 commit
- **THEN** 该文档在 feature 分支上 MUST 为 tracked,finish 剥离时有实际效果

#### Scenario: 无 display 时文档留存于 feature
- **WHEN** `display.enabled = false` 且 feature 分支已 tracked spec 文档
- **THEN** finish 不删 feature 分支,文档 MUST 在 feature 分支历史中留存(不依赖本地工作区)

### Requirement: finish 文档剥离
`/speccode:finish` 在创建 `<feature>-complete` 分支后 MUST 对 `config.spec_tools` 中每个 `enabled=true` 的工具执行 `git rm -r --cached <doc_dir>`,并通过 `git commit --amend` 将剥离动作折叠进最近的功能 commit。

#### Scenario: 多个文档目录同时剥离
- **WHEN** config 中 openspec 与 superpowers 都 enabled,且功能分支上两个目录都被 tracked
- **THEN** `-complete` 分支上的剥离 commit MUST 同时移除两个目录的 tracking,本地文件 MUST 保留

#### Scenario: amend 折叠
- **WHEN** `-complete` 分支剥离文档后
- **THEN** `git log` MUST 显示为单次 commit,`-complete` 分支的 HEAD MUST 是带剥离的同一 hash

#### Scenario: 本地文件保留
- **WHEN** 文档被 `git rm --cached` 后
- **THEN** 工作区 MUST 仍存在该文档目录,文件未被物理删除

### Requirement: finish 前检查未跟踪文档
`/speccode:finish` 开头对账后 MUST 检查工作区:若存在启用工具的 spec 文档目录却未被 git tracked,MUST 警告用户"检测到未纳入 git 的 spec 文档,finish 后将不会留存,是否先提交",由用户决定。speccode MUST NOT 主动替用户 `git add`/`commit` 该文档。

#### Scenario: 检测到游离文档
- **WHEN** finish 时工作区存在 `openspec/`(openspec 已 enabled)但该目录未 tracked
- **THEN** finish MUST 警告用户并等待用户决定,不自动提交

#### Scenario: 文档已 tracked 则静默通过
- **WHEN** finish 时 spec 文档目录已全部 tracked
- **THEN** finish MUST 不产生该警告,继续正常流程

### Requirement: display-reset 四步走
`/speccode:display-reset-to-trunk` MUST 按"备份 + 剥离 commit + 硬重置 + 重新 add commit"四步顺序执行,文档不丢。

#### Scenario: 备份到 backup 目录
- **WHEN** display 分支上存在 spec 文档目录
- **THEN** 命令开始时 MUST 将这些目录 cp 到 `.speccode/backup/display-reset-<timestamp>/`

#### Scenario: 第一阶段 commit untrack
- **WHEN** 备份完成后
- **THEN** 命令 MUST `git rm -r --cached <doc_dir>` 并 commit,提交信息为 `chore: untrack spec docs (pre-trunk-reset)`

#### Scenario: 硬重置
- **WHEN** untrack commit 完成
- **THEN** 命令 MUST `git reset --hard origin/<trunk>`

#### Scenario: 第二阶段 commit 重新 tracked
- **WHEN** 硬重置完成
- **THEN** 命令 MUST `git add <doc_dir>` 并 commit,提交信息为 `chore: re-track spec docs on display`

#### Scenario: 强推确认
- **WHEN** 两阶段 commit 完成
- **THEN** 命令 MUST 在执行 `git push -f origin display` 前向用户确认

#### Scenario: 备份清理询问
- **WHEN** 整个 reset 流程完成
- **THEN** 命令 MUST 询问用户是否清理 `.speccode/backup/display-reset-<timestamp>/`

### Requirement: spec 工具类型
speccode MUST 支持 openspec 与 superpowers 两种 spec 工具,且 MUST 可通过 config 扩展其他工具(key 为工具名,`doc_dir` 为文档目录路径)。

#### Scenario: 默认工具存在
- **WHEN** 用户在 init 时选择启用 openspec
- **THEN** `config.spec_tools.openspec.enabled` MUST 为 `true` 且 `doc_dir` 默认为 `"openspec"`

#### Scenario: doc_dir 自定义
- **WHEN** 用户在 init 时为 superpowers 指定 doc_dir 为 `docs/specs`
- **THEN** `config.spec_tools.superpowers.doc_dir` MUST 为 `"docs/specs"` 而非默认 `docs/superpowers`

### Requirement: 未启用工具的目录保护
若 `config.spec_tools.<tool>.enabled = false` 或 config 中不存在该 key,MUST 不对该工具的文档目录执行任何剥离/重跟踪操作。

#### Scenario: 关闭工具不被剥离
- **WHEN** `config.spec_tools.openspec.enabled = false` 但工作区存在 `openspec/` 目录
- **THEN** finish / display-reset MUST 不尝试 `git rm --cached openspec/`
