# Tasks: memory-append-newline

- [x] 1. 写失败用例(TDD 红):`tests/memory.test.mjs` 新增 2 个——「缺边界补一个换行」(`first` + append `- second` → `first\n- second`)、「边界已存在不重复补」(`first\n` + append `\n- second` → `first\n\n- second`)
- [x] 2. 运行确认失败:`node --test --test-name-pattern="boundary" plugins/speccode/tests/memory.test.mjs`
- [x] 3. 实现(TDD 绿):`lib/memory.mjs` append 路径加分隔判定与单次 `appendFileSync(p, sep + content)`(保留 O_APPEND 并发注释并补分隔符判定说明)
- [x] 4. 全量测试:135 → 137 绿(既有 append/replace 用例全部保持)
- [x] 5. CLAUDE.md 计数 135 → 137;提交
- [x] 6. syncing 合并 delta(MODIFIED「memory 原子写」)+ 勾选本文件 + archiving
- [ ] 7. finishing-worktree + finishing-feature,PR 合入 main
