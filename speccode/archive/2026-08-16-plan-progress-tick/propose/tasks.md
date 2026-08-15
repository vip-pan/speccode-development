# plan-progress-tick Tasks

> 实现步骤清单。下游 `writing-plans` 会基于本清单与本目录 proposal/design 细化为带 step 代码的 plan。

## 引擎层

- [x] Task 1: 在 `plugins/speccode/lib/sdd.mjs` 实现 `tickTask(planFile, n, cwd)` —— 复用 `extractTaskBrief` 的 fence 状态机定位 Task N 范围,把范围内 fence 外 `- [ ]` 改 `- [x]`,`atomic.writeTextAtomic` 落盘,返回 `{ticked, already}`
- [x] Task 2: 为 `tickTask` 写单测(`tests/sdd.test.mjs` 或新建 `tests/tick-task.test.mjs`,用 tmprepo helpers 建 plan),覆盖:范围正确勾选 / fence 内 `- [ ]` 不误改 / 幂等 / Task N 不存在报错

## CLI 层

- [x] Task 3: 在 `plugins/speccode/bin/speccode.mjs` 注册 `tick-task --plan <P> --task <N>` verb(VERBS 表 + dispatch),输出 `{ok,plan,task,ticked,already}`;在 `tests/cli.test.mjs` 加端到端测(spawnSync)

## 命令层

- [x] Task 4: 在 `plugins/speccode/commands/executing-plans.md` 第 2 步"标记 completed"后加 prose:调用 `tick-task` + commit `docs(speccode): tick task <N>`
- [x] Task 5: 在 `plugins/speccode/commands/subagent-driven-development.md` 第 5 步"完成"(ledger complete 行后)加 prose:调用 `tick-task` + commit,说明时序(审查通过后,不进 review-package diff)

## 验证

- [x] Task 6: 全量测试 `node --test ./plugins/speccode/tests/*.test.mjs` 全绿
