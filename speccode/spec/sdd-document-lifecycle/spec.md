# sdd-document-lifecycle Specification

## Purpose

speccode 自有文档生命周期:exploring / proposing / brainstorming / writing-plans / syncing / archiving 六个文档命令的行为契约,目标项目 `speccode/` 目录布局,文档全分支 tracked 语义,落盘即 commit 节奏,以及 SDD 执行工件(工作区 / task-brief / review-package)的引擎契约。

## Requirements

### Requirement: speccode 文档目录布局

目标项目的 speccode 文档 SHALL 组织为:`speccode/changes/<slug>/{propose,brainstorm,plan}/`(活跃变更)、`speccode/spec/`(syncing 合并后的主规格)、`speccode/archive/<YYYY-MM-DD>-<slug>/`(归档)。`<slug>` MUST 等于所属 feature 分支的 slug 段。

#### Scenario: 三类目录各司其职
- **WHEN** 一个需求经历 proposing、syncing、archiving 全流程
- **THEN** 文档 MUST 依次出现在 `speccode/changes/<slug>/propose/`、`speccode/spec/`、`speccode/archive/<YYYY-MM-DD>-<slug>/`

#### Scenario: slug 与 feature 分支一致
- **WHEN** feature 分支为 `feature/payment-api`
- **THEN** 文档目录 MUST 为 `speccode/changes/payment-api/`(slug 段 `payment-api`)

#### Scenario: 同 feature 多轮开发重建 changes 目录
- **WHEN** 同一 feature 的第一轮变更已 archiving(目录已移走),第二轮 proposing 启动
- **THEN** MUST 重新创建 `speccode/changes/<slug>/`,与前一轮归档目录 `speccode/archive/<date>-<slug>/` 不冲突

### Requirement: 文档全分支 tracked 语义

`speccode/` 目录 SHALL 在包括 trunk 在内的所有分支上保持 git tracked;任何命令 MUST NOT 对文档目录执行 `git rm --cached` 类 untrack/剥离操作。

#### Scenario: trunk 上文档保持 tracked
- **WHEN** feature 经 PR 合并进 trunk
- **THEN** `speccode/spec/` 与 `speccode/archive/` 中的文档 MUST 在 trunk 上保持 tracked

#### Scenario: 禁止剥离操作
- **WHEN** 检查 speccode 全部命令的行为
- **THEN** MUST NOT 存在对 `speccode/` 目录的 `git rm --cached`、untrack、四步走等剥离操作

### Requirement: exploring 纯探索命令

`/speccode:exploring` SHALL 在 trunk 上运行,对需求进行学习/探索/提问澄清;MUST NOT 写任何文档文件(产出仅存在于会话上下文;「文档文件」指 `speccode/` 下的需求文档,`.speccode/memory/` 运行时记忆不在此列,按 session-memory 规则承接);项目中配置了知识库工具(config.knowledge_tools)且其在会话中可用时 MUST 优先用其探索代码,不可用时 MUST 回退到 Grep/Glob/Read;完成后 MUST 引导用户衔接 `/speccode:creating-feature` 与 `/speccode:creating-worktree`(手动模式询问,auto 模式自动执行)。

#### Scenario: 不生产文档
- **WHEN** 用户执行 `/speccode:exploring` 并完成探索
- **THEN** 工作区 MUST NOT 新增任何 speccode 文档文件,探索结论仅存在于会话上下文

#### Scenario: 知识库工具优先与回退
- **WHEN** `config.knowledge_tools` 含 understand-anything 且其能力在会话中可用
- **THEN** 探索代码时 MUST 优先使用该工具;若不可用,MUST 回退到 Grep/Glob/Read 且不报错

#### Scenario: 完成后衔接引导
- **WHEN** exploring 结束且当前非 auto 模式
- **THEN** 命令 MUST 询问用户是否执行 `/speccode:creating-feature` 与 `/speccode:creating-worktree`

#### Scenario: auto 模式自动衔接
- **WHEN** exploring 结束且当前处于 auto 模式(按 Claude Code / Codex 等工具的会话执行模式判断)
- **THEN** 命令 MUST 自动衔接执行 creating-feature 与 creating-worktree;判断依据不充分时 MUST 默认询问而非自动衔接

### Requirement: proposing 文档生成

`/speccode:proposing` SHALL 在 worktree-\* 分支运行,基于 exploring 结论在 `speccode/changes/<slug>/propose/` 生成 `proposal.md`、`design.md`、`specs/<capability>/spec.md`、`tasks.md` 四类文档;完成后 MUST 输出复杂度评估,复杂度高时建议用户使用 `/speccode:brainstorming` 增强。同一 feature 同一时刻 MUST 只允许一个活跃 `changes/<slug>/`:proposing 检测到该目录已存在且未归档时 MUST 询问用户(续写补充 / 先 archiving 再重建 / 取消),防止并行 worktree 写同一目录。

#### Scenario: 四类文档落位
- **WHEN** 用户在 worktree-\* 分支执行 `/speccode:proposing`
- **THEN** `speccode/changes/<slug>/propose/` 下 MUST 生成 proposal.md、design.md、tasks.md 与 specs/ 目录下的 capability delta spec

#### Scenario: 复杂度高时建议 brainstorming
- **WHEN** proposing 识别当前需求复杂度高(跨多模块、存在多种可行方案、需求有明显不确定性)
- **THEN** 命令 MUST 向用户反馈建议使用 `/speccode:brainstorming` 进行增强

#### Scenario: 已存在未归档目录时询问
- **WHEN** `speccode/changes/<slug>/` 已存在且未归档(如上轮 proposing 后未走 syncing/archiving)
- **THEN** proposing MUST 询问用户选择「续写补充 / 先 archiving 再重建 / 取消」,MUST NOT 静默覆盖

### Requirement: brainstorming 回写一致性

`/speccode:brainstorming` SHALL 通过苏格拉底式提问精化设计,把设计文档写入 `speccode/changes/<slug>/brainstorm/`;且 MUST 把结论性变更回写到 `propose/` 下受影响的文档,保证两处内容不矛盾。

#### Scenario: 设计文档落位 brainstorm 目录
- **WHEN** 用户完成 brainstorming 的设计确认
- **THEN** 设计文档 MUST 写入 `speccode/changes/<slug>/brainstorm/`

#### Scenario: 回写 propose 文档
- **WHEN** brainstorming 产出了与 propose/ 文档不一致的结论(如方案替换、范围调整)
- **THEN** 命令 MUST 同步修改 propose/ 下对应文档,使两处保持一致

### Requirement: writing-plans 输入优先级

`/speccode:writing-plans` SHALL 把实现计划写入 `speccode/changes/<slug>/plan/`;编写时 MUST 优先读取 `brainstorm/` 目录下的设计文档;`brainstorm/` 不存在时 MUST 回退读取 `propose/` 目录文档。

#### Scenario: 优先读取 brainstorm
- **WHEN** `speccode/changes/<slug>/brainstorm/` 与 `propose/` 同时存在
- **THEN** writing-plans MUST 以 brainstorm/ 文档为输入编写计划

#### Scenario: 回退读取 propose
- **WHEN** `brainstorm/` 目录不存在
- **THEN** writing-plans MUST 以 propose/ 文档为输入编写计划

### Requirement: syncing 增量合并

`/speccode:syncing` SHALL 把 change 的 delta specs(ADDED / MODIFIED / REMOVED / RENAMED 四段式)智能合并进 `speccode/spec/<capability>/spec.md`。delta 源契约 = `speccode/changes/<slug>/propose/` 四类文档;`brainstorm/` 存在时 MUST 先吸收其中未回写到 propose/ 的残余变更,再执行合并。整个操作 MUST 幂等(重复执行结果相同,按 requirement 标题/段落去重判定)。

#### Scenario: 模块首次变更创建主规格
- **WHEN** `speccode/spec/<capability>/` 尚不存在
- **THEN** syncing MUST 创建该目录并把本次变更整合进新建的 `spec.md`

#### Scenario: 增量变更合并进主规格
- **WHEN** `speccode/spec/<capability>/spec.md` 已存在且本次为增量变更
- **THEN** syncing MUST 按 ADDED 追加/MODIFIED 部分更新/REMOVED 删除/RENAMED 改标题的语义合并,保留 delta 未提及的既有内容

#### Scenario: brainstorm 残余吸收
- **WHEN** `brainstorm/` 存在且含有未回写到 propose/ 的变更结论
- **THEN** syncing MUST 先吸收这些变更,再合并 propose delta

#### Scenario: 幂等
- **WHEN** 对同一 change 连续执行两次 syncing
- **THEN** 第二次执行 MUST 不产生任何文件内容变化

#### Scenario: 主 spec Purpose 权威
- **WHEN** `speccode/spec/<capability>/spec.md` 已存在且含 Purpose 段,delta 也含 Purpose
- **THEN** syncing MUST 保留主 spec 既有 Purpose 不动(不覆盖);新建主 spec 时 MUST 复制 delta 的 Purpose(缺失时写简短占位)

### Requirement: 命令衔接链

文档与执行命令的「下一步」引导 SHALL 构成固定链路:exploring→creating-feature→creating-worktree→proposing→(brainstorming)→writing-plans→subagent-driven-development 或 executing-plans→(syncing→archiving)→finishing-worktree→finishing-feature。其中:writing-plans 完成后 MUST 引导二选一执行命令;subagent-driven-development 的最终整支审查 MUST 走 requesting-code-review;systematic-debugging 的修复实现阶段 MUST 联动 test-driven-development 与 verification-before-completion。

#### Scenario: writing-plans 终态引导
- **WHEN** writing-plans 完成计划编写
- **THEN** 命令 MUST 呈现 `/speccode:subagent-driven-development`(推荐)与 `/speccode:executing-plans` 二选一引导

#### Scenario: SDD 整支审查走 requesting-code-review
- **WHEN** subagent-driven-development 全部 task 完成进入整支审查
- **THEN** MUST 按 requesting-code-review 的 reviewer 模板派发审查子代理

#### Scenario: 调试联动 TDD 与验证
- **WHEN** systematic-debugging 进入修复实现阶段
- **THEN** MUST 先写失败测试(test-driven-development)并在修复后按 verification-before-completion 取证

### Requirement: archiving 归档

`/speccode:archiving` SHALL 将 `speccode/changes/<slug>/` 移动为 `speccode/archive/<YYYY-MM-DD>-<slug>/`;目录名已带日期前缀时 MUST NOT 叠加第二个日期;目标目录已存在时 MUST 报错且不覆盖,报错信息 MUST 给出可行动建议(改 slug 归档 / 次日归档 / 手动合并目录);归档前 MUST 检查 change 内 tasks 完成度与 sync 状态,tasks 未完成或未 sync 时 MUST 警告并向用户确认(警告不硬阻断,由用户决定)。

#### Scenario: 移动并添加日期前缀
- **WHEN** 用户执行 `/speccode:archiving` 且 changes/\<slug\>/ 已完成 sync
- **THEN** 该目录 MUST 被移动为 `speccode/archive/<YYYY-MM-DD>-<slug>/`(当日日期)

#### Scenario: 日期前缀不叠加
- **WHEN** 待归档目录名已以 `YYYY-MM-DD-` 开头
- **THEN** MUST 直接使用该名称,不叠加第二个日期前缀

#### Scenario: 目标已存在报错并给出建议
- **WHEN** `speccode/archive/<YYYY-MM-DD>-<slug>/` 已存在(如同一 feature 同日两轮归档)
- **THEN** archiving MUST 报错退出且不覆盖,报错信息 MUST 建议可行动作(如改用 `<slug>-round2` 类目录名、次日归档、或手动合并目录)

#### Scenario: 未 sync 时提示
- **WHEN** changes/\<slug\>/ 的 delta 尚未合并进 speccode/spec/
- **THEN** archiving MUST 提示用户先执行 `/speccode:syncing`,由用户决定是否继续

#### Scenario: tasks 未完成警告
- **WHEN** changes/\<slug\>/ 的 tasks.md 存在未勾选任务
- **THEN** archiving MUST 警告未完成任务数并向用户确认,警告 MUST NOT 硬阻断归档

### Requirement: SDD 工作区

subagent-driven-development 的执行期工件(task brief、report、review package、ledger)SHALL 由引擎写入**当前 worktree 根**(`git rev-parse --show-toplevel`)下的 `.speccode/sdd/<plan-basename>/`;MUST NOT 使用 `.git/` 内路径;不同 plan 的工作区目录 MUST 互相隔离。

#### Scenario: 工作区定位于当前 worktree 根
- **WHEN** 在 linked worktree 内执行 `sdd-workspace` verb
- **THEN** 返回的工作区路径 MUST 位于该 worktree 根目录下(而非主仓),随 `git worktree remove` 自动清理

#### Scenario: 不同 plan 互相隔离
- **WHEN** 两个 plan 文件 basename 不同
- **THEN** 二者的工作区 MUST 为 `.speccode/sdd/` 下两个独立目录,ledger 互不污染

### Requirement: SDD 工件生成 verb

引擎 SHALL 提供 `sdd-workspace` / `task-brief` / `review-package` 三个 verb。`task-brief` MUST 按 `Task N` 标题做 fence 感知的精确抽取(`Task 1` MUST NOT 误配 `Task 10`,代码块内的标题文本 MUST 被忽略);`review-package` MUST 以调用方记录的 BASE(禁止 HEAD~1 等相对引用)生成 commit 列表 + `diff --stat` + `-U10` diff,写入按 range 命名的文件。

#### Scenario: task-brief 精确匹配
- **WHEN** plan 文件含 Task 1 与 Task 10,执行 `task-brief --task 1`
- **THEN** 输出 MUST 仅含 Task 1 的内容,不含 Task 10 的任何行

#### Scenario: fence 内标题忽略
- **WHEN** plan 文件中某代码块内出现 `### Task 99` 文本
- **THEN** task-brief MUST NOT 将其识别为任务标题

#### Scenario: review-package 按 range 命名
- **WHEN** 执行 `review-package --base <B> --head <H>`
- **THEN** 输出文件 MUST 命名为 `review-<B前7位>..<H前7位>.diff`,内容含 commit 列表、`--stat` 与 `-U10` diff

### Requirement: 文档阶段落盘即 commit

proposing、brainstorming、writing-plans、syncing、archiving 五个命令在每次文档落盘后 MUST 执行 `git add` + `git commit`,保证每个文档阶段边界干净、工作区不携带未提交的中间文档变更进入下一阶段。

#### Scenario: proposing 落盘后提交
- **WHEN** proposing 生成四类文档完成
- **THEN** 命令 MUST 将这些文档 git add 并 commit 后再结束

#### Scenario: brainstorming 回写后提交
- **WHEN** brainstorming 完成设计文档写入与 propose/ 回写
- **THEN** 命令 MUST 将 brainstorm/ 新文档与 propose/ 的修改一并 git add 并 commit

#### Scenario: syncing / archiving 操作后提交
- **WHEN** syncing 合并完成或 archiving 移动完成
- **THEN** 命令 MUST 将变更 git add 并 commit(syncing/archiving 在 worktree-* 分支上运行,文档随既有 PR 链路上 trunk,MUST NOT 直提 trunk)
