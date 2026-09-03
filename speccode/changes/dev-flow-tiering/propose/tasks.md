# Tasks: dev-flow-tiering

## 1. spec delta(6 个文件)

- [ ] 1. 新增 `specs/development-flow-tiering/spec.md` delta:Purpose + 8 条 ADDED requirement(三层分级 / 定层与 tier 字段 / 轻档 / applying / 勾选唯一性 / review 无条件化 / 回写泛化 / Tier 0 封禁)
- [ ] 2. `specs/sdd-document-lifecycle/spec.md` delta:MODIFIED「proposing 文档生成」(定层三岔 + 轻档 + frontmatter tier,顺带修正 worktree-* 残留表述)、「writing-plans 输入优先级」(tier 3 门禁 + 降级 + 回写)、「命令衔接链」(三层链路 + review 路由)
- [ ] 3. `specs/git-workflow-lifecycle/spec.md` delta:MODIFIED「命令清单」(21→22,插入 applying)、「finishing-worktree 测试验证与选项菜单」(changes/ 缺失警告门禁)
- [ ] 4. `specs/session-memory/spec.md` delta:MODIFIED「命令读写时机」(追加 applying 入口读出口写)
- [ ] 5. `specs/hook-event-integration/spec.md` delta:MODIFIED「run-hook verb 与调用节点」(applying 每条完成→onTaskCompleted)
- [ ] 6. `specs/knowledge-set/spec.md` delta:MODIFIED「蒸馏命令」(frontmatter 元数据不蒸馏)

## 2. 命令层(7 处)

- [ ] 7. 新建 `commands/applying.md`:前置门禁(tier=1 且无 plan;有 plan → 引导 SDD/executing;tier≥2 → 引导 writing-plans;无 proposal → 引导 proposing)、读记忆、逐条实现(TDD)+ 勾选 + 簿记 commit + onTaskCompleted、矛盾回写、完成后 requesting-code-review、收尾引导 syncing→archiving
- [ ] 8. 改 `commands/proposing.md`:复杂度评估点升级定层三岔(AskUserQuestion,建议+确认)、frontmatter `tier:` 落笔、轻档模板分支、下一步按层引导
- [ ] 9. 改 `commands/writing-plans.md`:入口读 tier(tier 3 缺 brainstorm → 报错引导;tier 1 → 提示升档确认)、计划完成后降级 tasks.md(动作列表 + 接管标记,随簿记 commit)、新增回写义务段
- [ ] 10. 改 `commands/executing-plans.md`:第 3 步完成开发处新增 requesting-code-review 路由(在 syncing 之前)
- [ ] 11. 改 `commands/subagent-driven-development.md`:决策树 no-plan 出口「Manual execution」改为指向 applying(附 tier 前提)
- [ ] 12. 改 `commands/finishing-worktree.md`:合并路径前 changes/<slug>/ 存在性检查(缺失警告 + 确认,不硬阻断)
- [ ] 13. 改 `commands/archiving.md`:完成度检查按层说明(tasks.md 有勾选语义时数 tasks.md,否则数 plan/;空 delta 判「已同步」)

## 3. 门面与自述文档

- [ ] 14. 根 `README.md` / `README_CN.md`:命令表加 applying、SDD 流程说明补三层分级(双语同步,不硬编码版本/测试数)
- [ ] 15. `plugins/speccode/README.md` / `README_CN.md`:命令快速参考表、目录布局图、链路描述补三层(双语同步)
- [ ] 16. `CLAUDE.md`:命令交互层 23→24、常用命令表加 applying、双层拓扑段落补分级一句话
- [ ] 17. `skills/speccode-workflow/SKILL.md`:发布节加一行「release 走 proposing 轻档 → applying 链路」

## 4. 验证与收尾

- [ ] 18. 结构化校验:MODIFIED requirement 名称与主规格逐字一致;每条 requirement 含 SHALL/MUST 正文 + 至少一个 Scenario;四段式段名规范;applying 准入/门禁口径在 spec 与命令间一致
- [ ] 19. 全量测试:`node --test ./plugins/speccode/tests/*.test.mjs` 全绿(prose 变更不应破坏任何测试)
- [ ] 20. syncing 合并 delta 进主规格 → archiving 归档 → finishing-worktree
