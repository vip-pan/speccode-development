---
tier: 2
---

# Proposal: dev-flow-tiering(开发流程三层分级)

## Why

单一文档链路假设「propose 后必有 plan」,但实践早已分岔:30 个归档变更中 7 个(23%)只有 propose/tasks.md 就完成了实现(release bump、单行修复、清理类),0.3.0 甚至完全没走文档链。契约只承认一层,导致 tasks.md 定位不清(执行不读、还要被强制保鲜)、小变更被过度仪式或滑向零文档 vibe coding。

## What Changes

- 新增「开发流程三层分级」:Tier 1(极小,applying 手动实现)/ Tier 2(中小型,大部分场景,plan + SDD/executing-plans)/ Tier 3(大型或仍有不明确、寻求更优解,brainstorming → plan 硬门禁)
- 新增 `/speccode:applying` 命令(第 24 个命令):Tier 1 专属执行入口,唯一准入 = tier 字段为 1 且无 plan;前置检查封堵零文档直实现
- 定层机制:proposing 文档生成完成后输出定层建议并经用户三岔确认(建议 + 用户确认,可改),结果写 proposal.md frontmatter `tier:` 字段(单写者 = proposing;tier 只路由门禁,绝不豁免质量契约)
- 轻档 proposing:空 delta(specs/ 为空,如版本发布类 chore)专属 Tier 1——design.md 可省、specs/ 允许为空;Tier 2/3 资格由非空 delta 证明
- tasks.md 生命周期:proposing 统一出生勾选版(拆解体检 + 定层信号);Tier 2/3 由 writing-plans 完成时降级为无勾选动作列表 + 「plan 接管」标记;任何时刻只有一份勾选清单
- review 无条件化:三条执行路径(SDD / executing-plans / applying)完成点全部必经 requesting-code-review,不存在无 review 的合并
- 回写义务泛化:brainstorming(既有)、writing-plans(新增)、applying(新增)发现前序文档矛盾 MUST 回写受影响处,随本阶段 commit(保证一次 spec 开发内容语义原子性)
- Tier 0 封禁:applying 前置检查 + finishing-worktree 门禁(changes/ 缺失 → 警告,经确认才继续)双防线,不允许零文档 vibe coding

## Capabilities

- development-flow-tiering(新增:分级、定层与 tier 字段、轻档、applying、勾选唯一性、review 无条件化、回写泛化、Tier 0 封禁)
- sdd-document-lifecycle(MODIFIED:proposing 文档生成、writing-plans 输入优先级、命令衔接链)
- git-workflow-lifecycle(MODIFIED:命令清单、finishing-worktree 测试验证与选项菜单)
- session-memory(MODIFIED:命令读写时机——追加 applying)
- hook-event-integration(MODIFIED:run-hook verb 与调用节点——applying→onTaskCompleted)
- knowledge-set(MODIFIED:蒸馏命令——frontmatter 元数据不蒸馏)

## Impact

- 纯 prose 层:命令 markdown 7 处(含新建 applying.md)、spec delta 6 个文件、双语 README ×3 处(根/插件)、CLAUDE.md 命令数 23→24、skills/speccode-workflow/SKILL.md 发布节
- 引擎层(lib/bin/tests)零改动:无新 verb,tasks.md 勾选为文档编辑语义(不复用面向 plan 结构的 tick-task)
- BREAKING:无——现有命令行为向后兼容,新增的是分级、门禁与一个新命令
