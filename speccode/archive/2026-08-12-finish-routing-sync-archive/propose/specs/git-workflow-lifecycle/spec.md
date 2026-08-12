## ADDED Requirements

### Requirement: 开发完成收尾路由

`/speccode:subagent-driven-development` 与 `/speccode:executing-plans` 完成开发后 MUST 依据是否存在落地文档(`speccode/changes/<slug>/` 是否存在)路由收尾:
- 存在落地文档 → MUST 引导用户先执行 `/speccode:syncing` 合并规格,再 `/speccode:archiving` 归档,最后 `/speccode:finishing-worktree`;该顺序为硬约束——syncing/archiving 的 trunk 防护要求 worktree-* 分支,而 finishing-worktree 会移除 worktree,故 sync/archive 只能在 finishing-worktree 之前执行;
- 不存在落地文档 → MUST 直接引导 `/speccode:finishing-worktree`,不引导 syncing/archiving。

路由引导 MUST 遵循手动/auto 模式约定:手动模式 MUST 用 AskUserQuestion 询问;auto 模式 MUST 自动衔接执行 `/speccode:syncing`;判断依据不充分时 MUST 默认询问。

#### Scenario: 有落地文档的完整收尾
- **WHEN** 开发完成且 `speccode/changes/<slug>/` 存在
- **THEN** 命令 MUST 引导用户依次执行 `/speccode:syncing` → `/speccode:archiving` → `/speccode:finishing-worktree`

#### Scenario: 无落地文档直接收尾
- **WHEN** 开发完成且 `speccode/changes/<slug>/` 不存在
- **THEN** 命令 MUST 直接引导 `/speccode:finishing-worktree`,不引导 syncing/archiving

#### Scenario: auto 模式自动衔接
- **WHEN** 开发完成、落地文档存在且当前处于 auto 模式
- **THEN** 命令 MUST 自动衔接执行 `/speccode:syncing`

### Requirement: finishing-worktree 未归档变更警告

`/speccode:finishing-worktree` 在呈现合并选项之前 MUST 检查当前 feature 是否仍有未归档的落地文档(`speccode/changes/<slug>/` 是否存在);存在 → MUST 打印 warn-only 警告「建议先执行 /speccode:syncing 与 /speccode:archiving」,然后 MUST 继续呈现合并选项,警告 MUST NOT 阻断流程。

#### Scenario: 存在未归档变更
- **WHEN** 执行 finishing-worktree 时 `speccode/changes/<slug>/` 仍存在
- **THEN** 命令 MUST 打印警告「建议先 syncing + archiving」并继续呈现合并选项

#### Scenario: 无未归档变更
- **WHEN** 执行 finishing-worktree 时 `speccode/changes/<slug>/` 不存在(已归档或从未落地)
- **THEN** 命令 MUST 不打印该警告,直接进入合并选项
