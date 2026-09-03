# Design: dev-flow-tiering(开发流程三层分级)

## Context

现有链路 `proposing→(brainstorming)→writing-plans→SDD/executing-plans→(syncing→archiving)` 把 writing-plans 当必经节点,但 dogfood 数据推翻了这个前提:30 个归档变更中 7 个无 plan(全部为小变更:release bump ×2、单行修复 ×3、清理 ×1、流程小改 ×1),其 tasks.md 就是执行清单(TDD 形态、勾选 4-6 条);0.3.0 release 则完全没走文档链。执行侧也早已承认分岔:SDD 决策树明写「no plan → Manual execution or brainstorm first」,但 manual 是无名出口,没有命令承载,tasks.md 的勾选回填处于无人负责的真空(归档里 6/7、4/6 的不完整勾选即证据)。tasks.md 与 plan 的关系被探索期证伪为「同一执行角色服务两个层级」:Tier 2 里 tasks.md 是过时前快照(执行不读、被 brainstorming 强制保鲜),Tier 1 里它是唯一执行工件。

## Goals

- 把实践里已存在的三条路显性化为契约,消除「作者凭手感选路」的状态
- 给 Tier 1 手动执行一个命令载体(applying),补上 tasks.md 勾选簿记 owner
- 堵死 Tier 0(零文档 vibe coding),保证任何代码变更可回溯
- tasks.md / plan / review 的职责单一化:任何时刻一份勾选清单、一条 review 不变量

## Non-Goals

- 不改引擎 lib/bin/tests(无新 verb,tasks.md 勾选是文档编辑,非结构化解析)
- 不改 SDD / executing-plans 的任务执行机制(只加 review 路由)
- 不重写 syncing 合并语义(按层校验输入即够,「归并」不长成新动作)
- 不处理业务知识蒸馏(知识集边界既有契约不变)

## Decisions

1. **三层分级而非单链路**。依据:7/30 无 plan + 0.3.0 无文档的实践先例;SDD 决策树已留 manual 出口。被否:移除 tasks.md(会牺牲 Tier 1 唯一执行工件与 archiving 唯一完成度信号,且强迫小变更走全量微步计划);保持现状(分岔持续无契约,新用户持续困惑)。
2. **tier 字段落 proposal.md frontmatter,否决 state 与目录派生**。state 是 untracked 运行时数据,分支收尾即消亡,而 tier 必须随 archive 永久可读(回溯是本需求的根目标);目录派生无法区分「Tier 1 终局」与「Tier 2 还没写 plan」。frontmatter 是 markdown 生态成熟元数据约定,结构上与内容隔离。tier 字段登记的不是推断状态而是用户确认过的意图——「派生优于登记」防的是启发式漂移,不适用于显式决策记录。
3. **applying 唯一准入不变量**:`tier = 1 且无 plan`。由此三层分岔逻辑闭合为一个不变量:有 plan 的执行入口只有 SDD/executing-plans;tier ≥ 2 无 plan → 引导 writing-plans;tier 3 无 brainstorm/ → 引导 brainstorming。被否:apply 命名(祈使式,破坏 -ing 家族一致性)。
4. **tasks.md 统一出生 + writing-plans 降级**。proposing 恒生成勾选版——它是拆解体检与定层评估的信号源;Tier 2/3 由 writing-plans 完成时降级(动作列表 + 接管标记)。被否:按层分叉模板(Tier 2 的 tasks.md 出生即无勾选语义,评估时拆解动作还没发生,信号源没了)。archiving 现状同时读 tasks.md 与 plan/,降级后自然只数 plan,该检查近乎零改动。
5. **tasks.md 勾选 = applying 直接文档编辑,不复用 tick-task verb**。tick-task 的 fence 感知 `### Task N` 区段解析面向 plan 结构;tasks.md 是平铺列表。「勾选 MUST 经引擎 verb 下沉」的约束针对 plan 的结构化解析安全(fence 误勾),不外溢到文档编辑——proposing/brainstorming 的 agent 直写文档是同一语义类。簿记 commit 纪律与 plan tick 对齐(`docs(speccode): tick tasks <N>`)。
6. **review 无条件化**(用户拍板,无商量余地):三条执行路径完成点全走 requesting-code-review;executing-plans 补终审路由(现状它是唯一无 review 的执行路径),applying 补完成审查(BASE = 开始实现前记录的 commit)。
7. **回写义务泛化**:从 brainstorming 个例升格为通用原则,成员 = brainstorming / writing-plans / applying;回写随本阶段落盘即提交 commit,保证一次变更文档集的内容语义原子性;范围 = 内容矛盾处,不含 frontmatter 元数据。
8. **定层 = 建议 + 用户确认**(非硬判),落点 = proposing 现有复杂度评估点,升级为三岔。
9. **蒸馏两层防御**:frontmatter 结构隔离(元数据/内容分离)+ 蒸馏命令排除一行(元数据不单独成块,仅作变更体量参考)。tier 对蒸馏是有用权重上下文(「坑来自 Tier 1 单行修复」vs「Tier 3 重构」),目标是可参考不蒸馏。老 archive 无该字段,天然区分,零迁移。
10. **applying 复用 onTaskCompleted 事件**(每条勾选时触发,载荷带条目序号),不扩 14 事件枚举。

## Risks

- **轻档蔓延**(非 chore 借口走轻档)→ 判据机械可查(specs/ 空),proposing 拒绝对空 delta 落笔 tier ≥ 2;applying/archiving 按 tier 字段拦截
- **tier 字段被下游误改** → 单写者纪律(children 单写者同款);回写义务明文排除元数据
- **Tier 1 无 SDD 双重审查的质量风险** → review 无条件化 + TDD/全量测试全层适用(tier 不降质写入 spec)
- **tier 字段缺失/非法** → 门禁报错要求修复,MUST NOT 静默猜测默认层级
