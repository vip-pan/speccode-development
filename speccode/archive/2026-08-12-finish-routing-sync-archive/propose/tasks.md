# Tasks: 开发完成收尾路由修正

## 依赖组 1:命令 prose(无依赖)

- [ ] `subagent-driven-development.md` 收尾(:292):「调用 finishing-worktree」→ 条件化路由(有 `speccode/changes/<slug>/` → 先 syncing → archiving → 再 finishing-worktree;无 → 直接 finishing-worktree)+ 手动询问 / auto 自动衔接 syncing
- [ ] `subagent-driven-development.md` 流程图节点(:78/:107)改为条件分支(有文档→syncing→archiving→finishing-worktree;无→finishing-worktree)
- [ ] `subagent-driven-development.md` 示例工作流(:371)同步
- [ ] `executing-plans.md` 第 3 步(:58-59):「REQUIRED SUB-SKILL: finishing-worktree」→ 条件化路由 + 手动/auto
- [ ] `creating-worktree.md`(:53)暂不落地文档路径核对一致(无文档 → 直接 finishing-worktree)
- [ ] `finishing-worktree.md`:合并选项前新增 C 门——`test -d speccode/changes/<slug>/`(命令层,与标记文件探测先例一致)存在未归档 → warn-only「建议先 syncing + archiving」,不阻断

## 依赖组 2:spec delta(无依赖,与组 1 并行)

- [ ] `propose/specs/git-workflow-lifecycle/spec.md`:ADDED「开发完成收尾路由」+「finishing-worktree 未归档变更警告」(已就绪)

## 依赖组 3:验证(依赖组 1/2)

- [ ] 全量测试:`node --test ./plugins/speccode/tests/*.test.mjs` 绿(prose 改动不涉测试,137 基线不变)
- [ ] README EN/CN 核对:若命令表/流程描述涉收尾路由措辞,须双语同步;大概率零改动
