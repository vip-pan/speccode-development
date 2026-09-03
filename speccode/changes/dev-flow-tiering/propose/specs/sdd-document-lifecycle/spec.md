# sdd-document-lifecycle Delta

## MODIFIED Requirements

### Requirement: proposing 文档生成

`/speccode:proposing` SHALL 在开发分支(`<type>/<slug>`、非 trunk)运行,基于 exploring 结论在 `speccode/changes/<slug>/propose/` 生成文档:标准档生成 `proposal.md`、`design.md`、`specs/<capability>/spec.md`、`tasks.md` 四类;轻档(delta 为空,见 development-flow-tiering)允许省略 design.md 且 specs/ 为空,proposal.md 与 tasks.md MUST 照常生成。生成完成后 MUST 输出定层建议并经用户三岔确认(Tier 1 / Tier 2 / Tier 3,AskUserQuestion 呈现,用户可改),确认结果 MUST 写入 proposal.md frontmatter `tier:` 字段(单写者;tier 只路由门禁,不豁免质量契约);Tier 2/3 建议 MUST 校验 specs/ 非空 delta。同一 feature 同一时刻 MUST 只允许一个活跃 `changes/<slug>/`:proposing 检测到该目录已存在且未归档时 MUST 询问用户(续写补充 / 先 archiving 再重建 / 取消),防止并行 worktree 写同一目录。

#### Scenario: 标准档四类文档落位
- **WHEN** 用户在开发分支执行 `/speccode:proposing` 且本次变更含 capability 语义变更
- **THEN** `speccode/changes/<slug>/propose/` 下 MUST 生成 proposal.md、design.md、tasks.md 与 specs/ 目录下的 capability delta spec

#### Scenario: 轻档落位
- **WHEN** 本次变更无任何 capability 语义变更(如版本发布类 chore)
- **THEN** propose/ 下 MUST 生成 proposal.md 与 tasks.md,design.md 可省略、specs/ 允许为空,tier MUST 定为 1

#### Scenario: 定层三岔经确认落笔
- **WHEN** proposing 完成文档生成
- **THEN** MUST 呈现 Tier 1/2/3 定层建议并经用户确认,确认结果 MUST 写入 proposal.md frontmatter `tier:` 字段

#### Scenario: 已存在未归档目录时询问
- **WHEN** `speccode/changes/<slug>/` 已存在且未归档(如上轮 proposing 后未走 syncing/archiving)
- **THEN** proposing MUST 询问用户选择「续写补充 / 先 archiving 再重建 / 取消」,MUST NOT 静默覆盖

### Requirement: writing-plans 输入优先级

`/speccode:writing-plans` SHALL 把实现计划写入 `speccode/changes/<slug>/plan/`;编写时 MUST 优先读取 `brainstorm/` 目录下的设计文档;`brainstorm/` 不存在时 MUST 回退读取 `propose/` 目录文档。入口 MUST 读取 proposal.md frontmatter `tier` 字段(缺失或非法 MUST 报错要求修复):tier 为 3 时 `brainstorm/` 必须已存在,缺失 MUST 报错并引导 `/speccode:brainstorming`,MUST NOT 跳过脑暴直接写计划;tier 为 1 时 MUST 提示确认(升档为有意行为,确认后建议经用户同意回写 tier 字段)。计划完成后 MUST 将 tasks.md 降级为无勾选的动作列表并附加指向 plan 文件的「plan 接管」标记(与计划簿记同一 commit 提交);writing-plans 发现前序文档矛盾时 MUST 回写受影响处(随本阶段 commit,见 development-flow-tiering 回写义务泛化)。

#### Scenario: 优先读取 brainstorm
- **WHEN** `speccode/changes/<slug>/brainstorm/` 与 `propose/` 同时存在
- **THEN** writing-plans MUST 以 brainstorm/ 文档为输入编写计划

#### Scenario: 回退读取 propose
- **WHEN** `brainstorm/` 目录不存在
- **THEN** writing-plans MUST 以 propose/ 文档为输入编写计划

#### Scenario: tier 3 缺 brainstorm 拒绝
- **WHEN** tier 字段为 3 且 `speccode/changes/<slug>/brainstorm/` 不存在
- **THEN** writing-plans MUST 报错并引导先执行 /speccode:brainstorming,MUST NOT 直接编写计划

#### Scenario: 计划完成后降级 tasks.md
- **WHEN** writing-plans 完成计划落盘
- **THEN** tasks.md MUST 被降级为无勾选动作列表并含指向 plan 文件的接管标记,随计划簿记 commit 一并提交

### Requirement: 命令衔接链

文档与执行命令的「下一步」引导 SHALL 构成分级链路。公共前段:exploring→creating-feature→creating-worktree→proposing(定层)。分层段:Tier 1 走 applying→requesting-code-review;Tier 2 走 writing-plans→subagent-driven-development 或 executing-plans;Tier 3 走 brainstorming→writing-plans(硬门禁)→subagent-driven-development 或 executing-plans。公共后段:(syncing→archiving)→finishing-worktree→finishing-feature。其中:writing-plans 完成后 MUST 引导二选一执行命令;三条执行路径(subagent-driven-development / executing-plans / applying)的完成点 MUST 走 requesting-code-review;systematic-debugging 的修复实现阶段 MUST 联动 test-driven-development 与 verification-before-completion。

#### Scenario: writing-plans 终态引导
- **WHEN** writing-plans 完成计划编写
- **THEN** 命令 MUST 呈现 `/speccode:subagent-driven-development`(推荐)与 `/speccode:executing-plans` 二选一引导

#### Scenario: SDD 整支审查走 requesting-code-review
- **WHEN** subagent-driven-development 全部 task 完成进入整支审查
- **THEN** MUST 按 requesting-code-review 的 reviewer 模板派发审查子代理

#### Scenario: executing-plans 完成点 review
- **WHEN** executing-plans 全部任务完成并验证
- **THEN** MUST 按 requesting-code-review 派发审查后才进入收尾(syncing/archiving/finishing-worktree)

#### Scenario: applying 完成 review
- **WHEN** applying 全部条目完成并验证
- **THEN** MUST 走 requesting-code-review 后才引导 syncing → archiving

#### Scenario: 调试联动 TDD 与验证
- **WHEN** systematic-debugging 进入修复实现阶段
- **THEN** MUST 先写失败测试(test-driven-development)并在修复后按 verification-before-completion 取证
