# development-flow-tiering Specification

## Purpose

开发流程三层分级:按变更体量与不确定性把 proposing 之后的链路分为 Tier 1(极小)、Tier 2(中小型,大部分场景)、Tier 3(大型或仍有不明确/寻求更优解)三级;定义定层机制(proposing 建议 + 用户确认)、tier 字段契约(proposal.md frontmatter,单写者)、轻档 proposing(空 delta 专属 Tier 1)、`applying` 手动执行命令(Tier 1 专属执行入口)、勾选清单唯一性、review 无条件化、回写义务泛化与 Tier 0 封禁(不允许零文档 vibe coding)。

## Requirements

### Requirement: 三层流程分级

speccode SHALL 把 proposing 之后的开发链路分为三级:Tier 1(极小型)走 `proposing → applying → requesting-code-review → syncing → archiving`;Tier 2(中小型,大部分场景)走 `proposing → writing-plans → subagent-driven-development 或 executing-plans(完成点 requesting-code-review)→ syncing → archiving`;Tier 3(大型或仍有不明确、寻求更优解)走 `proposing → brainstorming → writing-plans → subagent-driven-development 或 executing-plans(完成点 requesting-code-review)→ syncing → archiving`。凡执行过 brainstorming 的变更 MUST 生成 plan(MUST NOT 绕过 writing-plans 直接手动实现)。archiving 按层归并归档:Tier 1 收 propose/(轻档时无 design.md 且 specs/ 为空)、Tier 2 收 propose/ + plan/、Tier 3 收 propose/ + brainstorm/ + plan/ 全部。

#### Scenario: Tier 1 链路
- **WHEN** 定层为 Tier 1 的变更完成 proposing
- **THEN** 后续链路 MUST 为 applying → requesting-code-review → syncing → archiving,MUST NOT 要求生成 plan

#### Scenario: Tier 3 brainstorm 后必须 plan
- **WHEN** Tier 3 变更完成 brainstorming
- **THEN** 后续 MUST 执行 writing-plans 生成 plan,MUST NOT 出现 brainstorming 后绕过 writing-plans 直接手动实现的情况

#### Scenario: 按层归并归档
- **WHEN** Tier 3 变更执行 syncing → archiving
- **THEN** 归档 MUST 收 propose/ 与 brainstorm/ 与 plan/ 全部文档;Tier 2 不要求 brainstorm/ 存在;Tier 1 仅 propose/(轻档时无 design.md 且 specs/ 为空)

### Requirement: 定层与 tier 字段

proposing SHALL 在文档生成完成后输出定层建议并经用户三岔确认(Tier 1 / Tier 2 / Tier 3,AskUserQuestion 呈现,用户可改);确认结果 MUST 写为 proposal.md 的 YAML frontmatter 字段 `tier:`(取值 1|2|3)。`tier` 字段 MUST 为单写者:唯一写者 = proposing 的定层确认点,其余任何命令 MUST NOT 修改该字段。tier 只路由流程门禁(是否要求 plan / brainstorm、勾选哪份清单、轻档资格),MUST NOT 豁免任何质量契约(TDD、requesting-code-review、全量测试门禁在所有层级一律适用)。下游命令读取 `tier` 字段遇缺失或非法值 MUST 报错要求修复,MUST NOT 按默认层级静默继续。

#### Scenario: 定层建议经确认落笔
- **WHEN** proposing 完成文档生成
- **THEN** 命令 MUST 呈现三岔定层建议并经用户确认,确认结果 MUST 写入 proposal.md frontmatter `tier:` 字段

#### Scenario: 单写者
- **WHEN** brainstorming / writing-plans / applying / syncing 等命令处理变更文档
- **THEN** 任何命令 MUST NOT 修改 `tier` 字段(回写义务的范围不含 frontmatter 元数据)

#### Scenario: 字段缺失不猜测
- **WHEN** applying 或 writing-plans 读取 proposal.md 发现 `tier` 字段缺失或取值非法
- **THEN** 命令 MUST 报错并提示修复(重跑 proposing 定层或手动补字段),MUST NOT 按默认层级静默继续

#### Scenario: tier 不降质
- **WHEN** Tier 1 变更进入实现
- **THEN** TDD、requesting-code-review、全量测试门禁 MUST 与 Tier 2/3 同样适用,MUST NOT 因 tier 低而豁免

### Requirement: 轻档 proposing

specs/ delta 为空(本次变更不产生任何 capability 语义变更,如版本发布类 chore)时,proposing SHALL 允许轻档:design.md 可省略、specs/ 目录允许为空,proposal.md 与 tasks.md 勾选清单 MUST 照常生成;空 delta 专属 Tier 1。Tier 2 / Tier 3 的资格由非空 delta 证明:specs/ 下无任何 capability delta 文件时 MUST NOT 定层为 Tier 2 或 Tier 3。轻档与标准档共用同一条后续链路(applying → requesting-code-review → syncing → archiving);syncing 对空 delta MUST 幂等无操作,archiving 对空 delta MUST 判定「已同步」。

#### Scenario: 空 delta 走轻档
- **WHEN** 某版本发布类 chore 的 proposing 判定本次无任何 capability 语义变更
- **THEN** proposing MAY 省略 design.md 且 specs/ 为空,MUST 定层为 Tier 1,proposal.md 与 tasks.md MUST 照常生成

#### Scenario: Tier 2/3 必须有 delta
- **WHEN** 定层建议为 Tier 2 或 Tier 3 且 specs/ 下无任何 delta 文件
- **THEN** proposing MUST 拒绝该定层(提示降为 Tier 1 或补充 delta),MUST NOT 落笔 tier ≥ 2

#### Scenario: 空 delta 归档友好
- **WHEN** 轻档变更执行 syncing 与 archiving
- **THEN** syncing MUST 幂等无操作,archiving 的 sync 状态评估 MUST 判定「无 delta,已同步」直接进入移动

### Requirement: applying 手动执行命令

speccode SHALL 暴露 `/speccode:applying` 命令作为 Tier 1 变更的手动执行入口;其唯一准入 = proposal.md `tier` 字段为 1 且 `speccode/changes/<slug>/plan/` 不存在。tier ≥ 2 且无 plan → MUST 报错并引导 `/speccode:writing-plans`;tier 为 3 且 `brainstorm/` 不存在 → MUST 引导 `/speccode:brainstorming`;plan/ 存在 → MUST 拒绝并引导 subagent-driven-development 或 executing-plans;`changes/<slug>/propose/proposal.md` 不存在 → MUST 报错并引导先 `/speccode:proposing`(封堵零文档直实现)。applying SHALL 逐条实现 tasks.md 勾选清单条目:每完成一条并验证通过 MUST 勾选对应 `- [ ]` 为 `- [x]` 并随簿记 commit(`docs(speccode): tick tasks <N>` 形式)落盘;实现 MUST 遵循 TDD(test-driven-development),发现前序文档矛盾 MUST 回写(见「回写义务泛化」);全部条目完成并验证后 MUST 路由 `requesting-code-review`(BASE 取开始实现前记录的 commit),审查通过后才引导 syncing → archiving。applying 在开发分支(`<type>/<slug>`、非 trunk)上运行。tasks.md 的勾选为文档编辑语义,MUST NOT 复用面向 plan 结构的 tick-task verb;对已勾选条目的重跑 MUST 幂等跳过。

#### Scenario: tier 2 未写 plan 时拒绝
- **WHEN** 用户对 `tier` 字段为 2 且 plan/ 不存在的变更执行 applying
- **THEN** 命令 MUST 报错并引导 /speccode:writing-plans,MUST NOT 开始实现

#### Scenario: 存在 plan 时拒绝
- **WHEN** speccode/changes/<slug>/plan/ 存在任何计划文件
- **THEN** applying MUST 拒绝执行并引导 subagent-driven-development 或 executing-plans

#### Scenario: 无 propose 文档时拒绝
- **WHEN** speccode/changes/<slug>/propose/proposal.md 不存在
- **THEN** applying MUST 报错并引导先 /speccode:proposing,MUST NOT 直接开始写代码

#### Scenario: 逐条勾选与簿记 commit
- **WHEN** applying 完成清单中的一条并验证通过
- **THEN** MUST 将该条 `- [ ]` 勾选为 `- [x]` 并 commit 簿记提交;重跑对已勾选条目 MUST 幂等跳过

#### Scenario: 完成后 review
- **WHEN** applying 全部条目完成且验证通过
- **THEN** MUST 按 requesting-code-review 派发审查(BASE 为开始实现前记录的 commit),审查通过后才引导 syncing → archiving

### Requirement: 勾选清单唯一性

任何时刻一次变更 MUST 只有唯一一份勾选清单:Tier 1 = tasks.md(勾选语义存续);Tier 2/3 = plan 文件(tasks.md 由 writing-plans 完成时降级为无勾选的动作列表并附加指向 plan 文件的「plan 接管」标记)。降级 MUST 随计划落盘的簿记 commit 一并提交;降级后 tasks.md MUST NOT 再被任何命令勾选,archiving 的任务完成检查 MUST 仅按现存勾选清单计数(tasks.md 有勾选语义时数 tasks.md,否则数 plan/)。

#### Scenario: writing-plans 降级 tasks.md
- **WHEN** Tier 2/3 变更的 writing-plans 完成计划落盘
- **THEN** tasks.md MUST 被降级为无勾选的动作列表并含指向 plan 文件的接管标记,与计划簿记同一 commit 提交

#### Scenario: 降级后不再勾选 tasks.md
- **WHEN** Tier 2/3 变更处于执行阶段
- **THEN** 任何命令 MUST NOT 勾选 tasks.md(进度只勾 plan);archiving 完成度检查 MUST 只数 plan 的未勾选项

### Requirement: review 无条件化

凡产生代码变更的执行路径 MUST 在终点经过 requesting-code-review:subagent-driven-development 的整支终审(既有)、executing-plans 全部任务完成后(新增路由)、applying 全部条目完成后(新增路由)。MUST NOT 存在绕过 review 的合并路径;review 未通过前 MUST NOT 进入 syncing。

#### Scenario: executing-plans 完成后 review
- **WHEN** executing-plans 全部任务完成并验证
- **THEN** MUST 路由 requesting-code-review(BASE 为开始执行前记录的 commit)后才进入收尾

#### Scenario: 无 review 不合并
- **WHEN** 某执行路径试图在未 requesting-code-review 的情况下进入 syncing
- **THEN** MUST 阻止并先补 review

### Requirement: 回写义务泛化

凡生成下游文档或代码的命令——brainstorming(既有)、writing-plans、applying——发现前序文档(propose/ 或 brainstorm/ 下的文档)与本阶段将要产出的内容存在矛盾(方案错误、范围偏差、决策变更)时,MUST 回写受影响的前序文档,使同一变更的文档集内容语义一致(原子性);回写 MUST 随本阶段的落盘即提交 commit 一并落盘;回写范围 = 内容矛盾处,不含 frontmatter 元数据。

#### Scenario: writing-plans 回写
- **WHEN** writing-plans 编写计划时发现 design.md 的某个决策无法实现需要调整
- **THEN** MUST 修改 design.md 受影响处(及 tasks.md 受影响条目)并随计划 commit 一并提交

#### Scenario: applying 回写
- **WHEN** applying 实现中发现 specs delta 与实际可行方案矛盾
- **THEN** MUST 回写 specs delta(必要时 proposal/design/tasks 受影响处)并随簿记 commit 落盘

### Requirement: Tier 0 封禁

speccode MUST NOT 允许零文档直接实现(vibe coding):任何产生代码变更的开发分支 MUST 存在 `speccode/changes/<slug>/propose/proposal.md`。防线一 = applying 前置检查(见「applying 手动执行命令」);防线二 = finishing-worktree 在执行任何合并路径前检查 `speccode/changes/<slug>/` 存在性,缺失 MUST 警告(该分支疑似未走文档链)并经用户确认才继续,警告不硬阻断。

#### Scenario: finishing-worktree 门禁警告
- **WHEN** finishing-worktree 检测到当前分支的 speccode/changes/<slug>/ 不存在
- **THEN** MUST 警告并询问用户是否继续合并,用户确认才继续;MUST NOT 静默合并
