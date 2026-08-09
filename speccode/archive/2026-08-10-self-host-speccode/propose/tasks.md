# Tasks: self-host-speccode

- [x] 1. git mv 播种:openspec/specs → speccode/spec,openspec/changes/archive → speccode/archive;git rm openspec/config.yaml;openspec/ 空壳从 git 消失
- [x] 2. tracked 引用清除:CLAUDE.md(引言路径 + OpenSpec 工作流节改写 + 删除 Brainstorm 强制节)、根 README.md、plugin.json keywords、creating-feature.md 扫描路径
- [x] 3. syncing:合并本 delta 进 speccode/spec/plugin-packaging/spec.md
- [ ] 4. 勾选本文件 + archiving:changes/ 移入 speccode/archive/
- [ ] 5. finishing-worktree + finishing-feature:PR 合入 main
- [ ] 6. 合并后验证(134 测试、结构断言、grep 白名单)+ 本地 untracked 清理
