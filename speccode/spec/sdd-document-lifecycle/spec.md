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

`/speccode:exploring` SHALL 在 trunk 上运行,对需求进行学习/探索/提问澄清;MUST NOT 写任何文档文件(产出仅存在于会话上下文;「文档文件」指 `speccode/` 下的需求文档,`.speccode/memory/` 运行时记忆不在此列,按 session-memory 规则承接);项目中配置了代码智能工具(config.code_intel_tools)且其在会话中可用时 MUST 优先用其探索代码,不可用时 MUST 回退到 Grep/Glob/Read;完成后 MUST 引导用户衔接 `/speccode:creating-feature` 与 `/speccode:creating-worktree`(手动模式询问,auto 模式自动执行)。

#### Scenario: 不生产文档
- **WHEN** 用户执行 `/speccode:exploring` 并完成探索
- **THEN** 工作区 MUST NOT 新增任何 speccode 文档文件,探索结论仅存在于会话上下文

#### Scenario: 代码智能工具优先与回退
- **WHEN** `config.code_intel_tools` 含 understand-anything 且其能力在会话中可用
- **THEN** 探索代码时 MUST 优先使用该工具;若不可用,MUST 回退到 Grep/Glob/Read 且不报错

#### Scenario: 完成后衔接引导
- **WHEN** exploring 结束且当前非 auto 模式
- **THEN** 命令 MUST 询问用户是否执行 `/speccode:creating-feature` 与 `/speccode:creating-worktree`

#### Scenario: auto 模式自动衔接
- **WHEN** exploring 结束且当前处于 auto 模式(按 Claude Code / Codex 等工具的会话执行模式判断)
- **THEN** 命令 MUST 自动衔接执行 creating-feature 与 creating-worktree;判断依据不充分时 MUST 默认询问而非自动衔接

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

### Requirement: brainstorming 回写一致性

`/speccode:brainstorming` SHALL 通过苏格拉底式提问精化设计,把设计文档写入 `speccode/changes/<slug>/brainstorm/`;且 MUST 把结论性变更回写到 `propose/` 下受影响的文档,保证两处内容不矛盾。

#### Scenario: 设计文档落位 brainstorm 目录
- **WHEN** 用户完成 brainstorming 的设计确认
- **THEN** 设计文档 MUST 写入 `speccode/changes/<slug>/brainstorm/`

#### Scenario: 回写 propose 文档
- **WHEN** brainstorming 产出了与 propose/ 文档不一致的结论(如方案替换、范围调整)
- **THEN** 命令 MUST 同步修改 propose/ 下对应文档,使两处保持一致

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

引擎 SHALL 提供 `sdd-workspace` / `task-brief` / `review-package` / `tick-task` 四个 verb。`task-brief` MUST 按 `Task N` 标题做 fence 感知的精确抽取(`Task 1` MUST NOT 误配 `Task 10`,代码块内的标题文本 MUST 被忽略);`review-package` MUST 以调用方记录的 BASE(禁止 HEAD~1 等相对引用)生成 commit 列表 + `diff --stat` + `-U10` diff,写入按 range 命名的文件;`tick-task --plan <P> --task <N>` MUST 把 plan 中 Task N 区段内 fence 外的 `- [ ]` 勾选为 `- [x]`,经原子写落盘,输出 SHALL 含 `ticked`(本次真正勾选的 step 行)与 `already`(此前已是 `[x]` 的行),本次无勾选时 MUST NOT 改写 plan 文件,Task N 不存在时 MUST 返回 `{ok:false,error}` 且不修改 plan 文件。

`task-brief` 与 `tick-task` MUST 共用同一套 plan 区段扫描,保证抽取与勾选看到相同的区段:fence 按 CommonMark 长度规则闭合(开栏的 K 个反引号只能被 `>=` K 个反引号且其后无内容的行闭合),嵌套或加长 fence(如 ````markdown 块内含 ```bash)MUST NOT 在块内翻转 fence 状态;`Task N` 区段 MUST 止于下一个同级或更高级标题(下一个 `### Task M`,或 `## 禁止占位符自检` / `## 收尾` 等尾部章节),MUST NOT 蔓延到尾部非 Task 章节。

#### Scenario: task-brief 精确匹配
- **WHEN** plan 文件含 Task 1 与 Task 10,执行 `task-brief --task 1`
- **THEN** 输出 MUST 仅含 Task 1 的内容,不含 Task 10 的任何行

#### Scenario: fence 内标题忽略
- **WHEN** plan 文件中某代码块内出现 `### Task 99` 文本
- **THEN** task-brief MUST NOT 将其识别为任务标题,`tick-task --task 99` MUST 报 task 不存在且不修改 plan 文件

#### Scenario: 嵌套 fence 不翻转状态
- **WHEN** plan 文件中一个 ````markdown 块内含未缩进的 ```bash 内层 fence 与 `- [ ]` 文本
- **THEN** 内层 fence MUST NOT 闭合外层块——块内 `- [ ]` MUST NOT 被 tick-task 勾选,块后的 `### Task M` 标题 MUST 仍被识别为任务标题

#### Scenario: 任务区段止于同级或更高级标题
- **WHEN** plan 的最后一个 `### Task N` 之后跟着 `## 收尾` / `## Self-Review` 等尾部章节,章节内含 `- [ ]`
- **THEN** tick-task MUST NOT 勾选这些尾部章节的 checkbox,task-brief MUST NOT 把它们纳入该任务的 brief

#### Scenario: review-package 按 range 命名
- **WHEN** 执行 `review-package --base <B> --head <H>`
- **THEN** 输出文件 MUST 命名为 `review-<B前7位>..<H前7位>.diff`,内容含 commit 列表、`--stat` 与 `-U10` diff

#### Scenario: tick-task 勾选 Task N 且 fence 内不误勾
- **WHEN** 对含 fence 代码块的 plan 执行 `tick-task --task <N>`
- **THEN** 仅 Task N 区段内 fence 外的 `- [ ]` MUST 被改为 `- [x]`,fence 内的 `- [ ]` 与其他 Task 的 checkbox MUST 保持不变

#### Scenario: tick-task 幂等
- **WHEN** 对同一 Task N 重复执行 `tick-task`
- **THEN** 已 `[x]` 的 checkbox MUST 保持不变,输出 `ticked` 为空、`already` 列出全部已勾选项,plan 文件 MUST NOT 被改写(内容逐字节不变)

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

### Requirement: plan 执行进度勾选

`executing-plans` 与 `subagent-driven-development` SHALL 在每个 task 完成点(审查通过、ledger 写 complete 行之后)调用 `tick-task` verb 把 plan 文档(`speccode/changes/<slug>/plan/*.md`)中该 Task N 下所有 `- [ ]` step checkbox 勾选为 `- [x]`;勾选 MUST 经引擎 verb 下沉,命令层 MUST NOT 用 sed/awk 在 prose 内直接改 plan。verb 输出 `ticked` 非空时命令 MUST 随同簿记点 commit(`docs(speccode): tick task <N>`);`ticked` 为空(幂等重跑,plan 未被改写)时 MUST 跳过 commit,MUST NOT 硬跑 `git commit` 让 "nothing to commit" 以非零退出误报失败。勾选 commit MUST 落在审查通过之后,不进入 `review-package` 的 base..head diff;ledger(`progress.md`)MUST 保持为崩溃恢复的唯一权威,plan checkbox 仅作完成态的派生视图,MUST NOT 参与恢复判断。

#### Scenario: task 完成点勾选并 commit
- **WHEN** subagent-driven-development 某任务审查干净、ledger 写入 `Task <N>: complete` 行
- **THEN** 命令 MUST 调用 `tick-task --task <N>` 勾选 plan 中 Task N 的 step checkbox,并在 `ticked` 非空时 commit `docs(speccode): tick task <N>`

#### Scenario: 幂等重跑跳过 commit
- **WHEN** 恢复后对已勾选完的 Task N 重跑 `tick-task`,输出 `ticked` 为空、`already` 列出全部
- **THEN** 命令 MUST 跳过 `git commit`(无变化可提),MUST NOT 因 "nothing to commit" 的非零退出判定任务失败

#### Scenario: 勾选 commit 不污染审查 diff
- **WHEN** tick-task 的 commit 产生于审查通过之后
- **THEN** review-package 的 base..head diff MUST NOT 包含该勾选 commit(它在 head 之后)

#### Scenario: ledger 仍为恢复权威
- **WHEN** 控制器从崩溃恢复,读取进度
- **THEN** 恢复判断 MUST 仅依据 ledger(`progress.md`)的 complete 行,plan 的 `[x]` MUST NOT 作为恢复信号
