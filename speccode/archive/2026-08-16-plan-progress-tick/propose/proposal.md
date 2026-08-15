# plan-progress-tick Proposal

## Why

`writing-plans` 在 plan 文档里用 `- [ ]` checkbox 声明"执行时的跟踪机制",但 `executing-plans` 与 `subagent-driven-development` 在执行时只更新会话 todo 与 untracked ledger,从不回写 plan 的 checkbox。导致 plan 文档始终停留在"全未完成"的僵尸状态,进度只活在易失(todo)/草稿(ledger)场所,tracked 设计文档无法反映执行进度。

## What Changes

- **引擎层**:`sdd.mjs` 新增 `tickTask(planFile, n, cwd)`,复用 `extractTaskBrief` 的 fence 状态机,把 Task N 范围内 fence 外的 `- [ ]` 勾选为 `- [x]`,经 `atomic.writeTextAtomic` 落盘,天然幂等。
- **CLI 层**:`bin/speccode.mjs` 新增 `tick-task --plan <P> --task <N>` verb,输出 `{ok,plan,task,ticked:[...],already:[...]}`。
- **命令层**:`executing-plans` 第 2 步标记 completed 后、`subagent-driven-development` 第 5 步写 ledger complete 行后,各调用 `tick-task` 并 commit(`docs(speccode): tick task <N>`),折进现有簿记点。
- **测试**:tmprepo 建 plan(含 fence 内 `- [ ]` 代码块)→ 跑 tick-task,断言范围正确勾选 / fence 内不误改 / 幂等 / Task N 不存在报错。

## Capabilities

- `sdd-document-lifecycle`(新增 plan 执行进度勾选行为 + `tick-task` verb 契约)

## Impact

- **代码**:`plugins/speccode/lib/sdd.mjs`(新增函数)、`plugins/speccode/bin/speccode.mjs`(新增 verb + VERBS 表)、`plugins/speccode/commands/executing-plans.md`、`plugins/speccode/commands/subagent-driven-development.md`(各加 prose 段)、`plugins/speccode/tests/`(新增 tick 测试)。
- **行为**:两条执行命令在 task 完成点多一个 tracked commit(plan 勾选),不改变审查/恢复语义(ledger 仍为恢复权威,勾选 commit 不进 review-package diff)。
