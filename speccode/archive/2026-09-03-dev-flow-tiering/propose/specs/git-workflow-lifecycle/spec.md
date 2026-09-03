# git-workflow-lifecycle Delta

## MODIFIED Requirements

### Requirement: 命令清单

speccode SHALL 暴露以下 22 个 slash 命令:`init`、`exploring`、`creating-feature`、`creating-worktree`、`proposing`、`brainstorming`、`writing-plans`、`applying`、`executing-plans`、`subagent-driven-development`、`dispatching-parallel-agents`、`test-driven-development`、`systematic-debugging`、`requesting-code-review`、`receiving-code-review`、`verification-before-completion`、`syncing`、`archiving`、`finishing-worktree`、`finishing-feature`、`status`、`reset`。其中 `creating-feature` 与 `finishing-feature` SHALL 为大需求 opt-in 命令(创建/收尾集成分支),普通需求路径 SHALL 只经 `creating-worktree` 与 `finishing-worktree`;`applying` SHALL 为 Tier 1(极小型)变更的手动执行入口,准入契约见 development-flow-tiering。

#### Scenario: 命令全部可用
- **WHEN** speccode 已正确初始化(`.speccode/config.json` 存在)
- **THEN** 用户 MUST 能通过 `/speccode:<name>` 形式调用上述全部 22 个命令

#### Scenario: 旧命令不复存在
- **WHEN** 检查命令清单
- **THEN** `start`、`develop-start`、`develop-complete`、`finish`、`display-merge-trunk`、`display-rebase-trunk`、`display-reset-to-trunk` MUST NOT 出现在可用命令中

### Requirement: finishing-worktree 测试验证与选项菜单

`/speccode:finishing-worktree` 在执行任何合并路径前 MUST 检查当前分支 `speccode/changes/<slug>/` 的存在性:缺失 MUST 警告(该分支疑似未走文档链,成果无法回溯)并经用户确认才继续,警告不硬阻断。随后 MUST 运行全量测试,测试失败 MUST 停止且不呈现合并选项。合并路径 MUST 按 state 的 `merge_target` 路由:`merge_target` 为非 trunk 分支(集成分支)时 MUST 走本地 squash 路径(合并到该集成分支、复跑全量测试、本分支 state 置 `completed`——父实体 children 仅身份登记 MUST NOT 被写、收尾切到该分支 `fetch & pull`),MUST NOT 呈现 PR 菜单;`merge_target` 为 trunk 时菜单 MUST 恰好为三项:「PR + 等待合并」「PR + 不等待」「保留 worktree」。丢弃路径 MUST NOT 出现在菜单中,仅当用户显式要求丢弃时进入,且 MUST 先展示分支名、完整 commit 列表与 worktree 路径,再要求用户逐字输入 `discard` 确认。本地 squash 路径在合并完成后 MUST 对合并结果复跑全量测试,失败 MUST 停止(此时未推送,现场可恢复)。

#### Scenario: 变更文档缺失警告
- **WHEN** finishing-worktree 检测到当前分支的 speccode/changes/<slug>/ 不存在
- **THEN** MUST 警告并询问用户是否继续合并,用户确认才继续;MUST NOT 静默合并

#### Scenario: 测试失败即停
- **WHEN** 全量测试存在失败
- **THEN** 命令 MUST 展示失败并停止,不呈现合并选项

#### Scenario: trunk 目标菜单三项
- **WHEN** state 的 `merge_target` 为 trunk 且测试通过
- **THEN** 菜单 MUST 恰好含「PR + 等待合并」「PR + 不等待」「保留 worktree」三个选项,MUST NOT 含「本地 squash」

#### Scenario: 集成目标自动路由
- **WHEN** state 的 `merge_target` 为集成分支且测试通过
- **THEN** 命令 MUST 直接执行本地 squash 合并到集成分支并复测,MUST NOT 询问 PR 模式;合并完成后本分支 state MUST 置 `completed`(父实体 children 仅身份登记,MUST NOT 被写)

#### Scenario: 丢弃需逐字确认
- **WHEN** 用户显式要求丢弃该 worktree 成果
- **THEN** 命令 MUST 展示分支名、commit 列表与 worktree 路径,且仅在用户逐字输入 `discard` 后才执行删除

#### Scenario: 本地合并后复测
- **WHEN** 本地 squash 合并提交完成
- **THEN** 命令 MUST 对合并后的集成分支复跑全量测试;失败 MUST 停止并保留 worktree 与分支现场

#### Scenario: 保留后状态不变
- **WHEN** 用户选择「保留 worktree」
- **THEN** 该分支的 state MUST 保持原状态(不新增状态值),status 命令按既有枚举正常展示
