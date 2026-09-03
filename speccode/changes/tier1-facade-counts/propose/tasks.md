# Tasks: tier1-facade-counts

- [x] 1. 根 README.md:102 与 README_CN.md:102:「9 capabilities」/「9 个 capability」→ 11(双语同步,一处一行)
- [x] 2. speccode/spec/git-workflow-lifecycle/spec.md「命令清单」requirement:枚举补 `distilling-knowledge`、`recording-knowledge`(archiving 之后、finishing-worktree 之前),「22 个」→「24 个」,scenario「上述全部 22 个命令」→ 24,并补归属说明一句(行为契约在 knowledge-set,此处仅登记)
- [ ] 3. 验证:`grep -rn "9 个 capability\|9 capabilities" README.md README_CN.md` 零命中;`grep -c "24 个 slash 命令" speccode/spec/git-workflow-lifecycle/spec.md` = 1;`ls plugins/speccode/commands/*.md | wc -l` = 24;全量测试 `node --test ./plugins/speccode/tests/*.test.mjs` 全绿
- [ ] 4. 落盘提交:`docs(speccode): align facade counts (11 capabilities, 24 commands)`
