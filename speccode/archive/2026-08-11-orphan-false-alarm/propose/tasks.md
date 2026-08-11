# Tasks: orphan-false-alarm

- [x] 1. 写失败用例(TDD 红):`tests/reconcile.test.mjs` 新增「completed worktree absent in git → 不计 orphan」(仿照 L38 既有用例构造,status 改 completed)
- [x] 2. 运行确认失败:`node --test --test-name-pattern="completed" plugins/speccode/tests/reconcile.test.mjs`
- [x] 3. 实现(TDD 绿):`lib/reconcile.mjs` 规则 3 加 `status !== WORKTREE_STATUS.COMPLETED` 判据(WORKTREE_STATUS 已在 L1 导入)
- [x] 4. 全量测试:既有 in_progress orphan 用例保持通过,总数 134 → 135
- [x] 5. CLAUDE.md 测试计数 134 → 135;提交
- [x] 6. syncing 合并 delta(ADDED「对账 orphan 判定」,13 → 14 条)+ 勾选本文件 + archiving
- [ ] 7. finishing-worktree + finishing-feature,PR 合入 main
