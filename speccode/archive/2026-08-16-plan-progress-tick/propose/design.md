# plan-progress-tick Design

## Context

plan 文档(`speccode/changes/<slug>/plan/*.md`)是 tracked 设计文档,随 PR 上 trunk;每个 Task N 下含多个 `- [ ]` step checkbox。`writing-plans` 声明 checkbox 是"执行时的跟踪机制"。现状:执行命令的进度记录在会话 todo(易失)与 `.speccode/sdd/<plan>/progress.md` ledger(untracked 草稿,恢复用),plan checkbox 从不被回写。

ledger 已是成熟的恢复地图(记录 fix round、commit range)。引入 plan checkbox 勾选是为补 tracked 层的高层进度可视化,不取代 ledger。

## Goals

- plan 文档在执行过程中维护自身 checkbox 进度(task 级)。
- 勾选逻辑经引擎 verb 下沉,命令层纯 prose 调用,配单测。
- 不改变现有审查与恢复语义:review-package 的 diff 不被勾选 commit 污染;ledger 仍为唯一恢复权威。

## Non-Goals

- 不做 step 级勾选(subagent-driven 无 step 级事件锚点,且控制器不感知子代理内部步骤)。
- 不向上游 `tasks.md`(proposing 产出)同步进度(上游,可降级)。
- 不让 plan checkbox 参与崩溃恢复判断(避免双源不一致)。
- 不改 plan 文档的 step 结构或 `writing-plans` 的产出格式。

## Decisions

### D1: 勾选粒度 = task 级

plan 的 checkbox 是 step 级,但所有现有进度机制(todo / ledger / onTaskCompleted payload)是 task 级。Task N 完成时把其下所有 step checkbox 批量勾选。降级理由:无 step 级事件锚点,且 step 级收益不抵复杂度。

### D2: commit 策略 = B1 单独 commit 折进簿记点

每个 task 完成点本就有"写 ledger complete 行 + onTaskCompleted"簿记动作;在此点顺手 tick-task + commit(`docs(speccode): tick task <N>`)是同类动作延伸。否决 B2(实现者子代理改 plan,跨职责,且实现者看不到全局 task 编号语义)、B3(留脏不 commit,违背 plan 随 PR 反映进度且 worktree remove 即丢)。

### D3: 谁改 = 控制器(C1)

`subagent-driven-development` 的"控制器不亲自改文件"铁律针对代码实现(会跳过审查、污染上下文)。勾选 checkbox 是进度簿记,与写 ledger 同类、同点。控制器做。否决 C2(子代理跨职责)。

### D4: 主从 = ledger 恢复权威,plan checkbox 派生视图

勾选 = "ledger complete 行的投影"。恢复仍只读 ledger(有 fix round / commit range 细节,checkbox 只有完成态)。不让 checkbox 入恢复判断,避免"勾了 [x] 但 ledger 未写就崩溃"的不一致窗口。

### D5: 复用 extractTaskBrief 的 fence 状态机

`extractTaskBrief` 已有成熟状态机:` ``` ` fence 切换、fence 外识别 `Task N` 标题(`Task 1` 不误配 `Task 10`)。`tickTask` 复用同一思路:定位 Task N 范围,只改范围内 fence 外的 `- [ ]`。fence 内代码块里的 `- [ ]` 注释行不被误勾选。该逻辑 prose 写不了,必须下沉 lib(铁律)。

### D6: checkbox 格式匹配

匹配 `^(\s*)- \[ \](.+)$` → 替换为 `$1- [x]$2`,保留前导缩进。只勾 `[ ]`→`[x]`,不动其他状态(如 `[x]` 不回退)。幂等:已勾的不动。

### D7: 勾选 commit 时序 = 审查通过后(完成点)

在 subagent-driven 里 review-package 用实现 commit 的 base..head diff。勾选 commit 必须落在审查干净、ledger 写 complete 之后(完成点),永远在 review 范围之外,不污染任务审查者 diff。与 `onTaskCompleted` 触发位置天然吻合。`executing-plans` 同理(标记 completed 之后)。

## Risks

- **R1 commit 噪音**:每个 task 多一个 tick commit。缓解:D2 折进现有簿记点,commit message 统一;这些 commit 在 PR diff 里是进度可视化,reviewer 能看到推进轨迹,非纯噪音。
- **R2 fence 误勾**:若不复用 fence 状态机会把代码块里 `- [ ]` 误勾。缓解:D5 复用现有状态机 + 单测覆盖 fence 内代码行。
- **R3 双源不一致**:plan `[x]` 与 ledger 不一致。缓解:D4 明确 ledger 为唯一恢复权威,checkbox 不入恢复;勾选顺序为"先 ledger 后 tick"。
- **R4 幂等**:崩溃恢复重跑同一 task。缓解:D6 只改 `[ ]`→`[x]`,已勾不动,重跑安全。

## Open Questions

无(exploring 已充分澄清)。
