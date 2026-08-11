# Design: orphan-false-alarm

## Context

R2-R4 三轮 squash 路径实测:finishing-feature 前置对账报出 `orphans: ['worktree-<刚完成的 worktree>']`。机制:reconcile 规则 3(reconcile.mjs:20-24)不区分状态,凡「state 有、git 无」即 orphan;而 completed 条目的 git 侧清理是 finishing-worktree 的设计动作(PR 合并与 squash 两路径均删 worktree+分支),state 侧的 completed 记录则必须保留到 finishing-feature 完成进度核算与门禁判断。四个各自正确的决策拼出一个虚警。勘探确认:state 侧 orphan 规则从未进过主规格(唯一 orphan scenario 是「非标准前缀」git 侧条款,L71-73);现有用例 `marks orphan when state worktree absent in git`(reconcile.test.mjs:38)用的是 in_progress,本修复不影响它。

## Goals

- orphan 语义精确化:只报真异常(登记与 git 背离且未完成)
- state 侧 orphan 判定进入主规格契约
- TDD:新行为先有用例锚定

## Non-Goals

- 不改 git 侧 orphan(非标准前缀)判定
- 不改 finishing-feature/creating-worktree 的 orphan 提示文案(输入变准后文案自然正确)
- 不做 CLAUDE.md 其他手维计数的防漂移改造(M4,另议)
- 不发版(攒入后续 0.2.2 评估)

## Decisions

- **方案 A(引擎层豁免,用户已在探索确认)**:规则 3 加 `status !== completed` 判据。被否备选:B 命令层过滤(finishing-feature 门禁处打补丁——orphan 定义本身错了,下游补丁治标不治本,status 命令等其他消费面仍会虚警)
- **豁免语义覆盖 PR 合并与 squash 两路径**:两者完成后 git 侧均删除 worktree+分支,completed + git 缺失在两路径下同为正常终态
- **spec 用 ADDED 而非塞进既有条款**:state 侧 orphan 规则此前无契约;「worktree 前缀硬约定」是 git 侧前缀条款,语义不合——新增「对账 orphan 判定」一条,把基础规则与豁免一次钉全
- **CLAUDE.md 计数顺手同步**:134→135(本 change 新增 1 用例);手维计数防漂移(M4)不在本范围

## Risks

- 误豁免真异常:completed 条目的 git 侧若因异常丢失而非流程清理 → 判定淡化。评估:completed 只在 finishing-worktree 成功后写入,彼时清理是流程动作;手动删 worktree 的异常场景由 state 仍在轨的事实兜底(finishing-feature 收尾 delete-state 清理)
- 既有用例回归 → TDD 全程:新用例先红,改后全量绿(含既有 in_progress orphan 用例)

## Open Questions

无。
