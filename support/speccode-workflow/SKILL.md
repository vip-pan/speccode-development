---
description: 本仓库(speccode 插件)自身的开发工作流与发布纪律——原生链路顺序、dogfood 约定、版本发布时 CHANGELOG 同步规则。在本仓库做开发或发布时加载。
---

# speccode 仓库开发工作流

## 原生链路(双层拓扑)(dogfood)

本仓库自身的开发由 speccode 自托管(dogfood),不依赖任何外部 spec/方法论工具。变更走原生链路:

```
/speccode:exploring(形态确认三岔:单普通需求 / 多个独立普通需求 / 大需求)
→ /speccode:creating-worktree(普通需求唯一入口,<type>/<slug> 从 trunk 切出)
→ /speccode:proposing(落四类文档,并定层 Tier 1/2/3 写入 proposal.md frontmatter)
→ [Tier 3:/speccode:brainstorming,硬门禁,结论回写 propose/]
→ [Tier 2/3:/speccode:writing-plans → /speccode:subagent-driven-development 或 /speccode:executing-plans 二选一
   | Tier 1:/speccode:applying 按 tasks.md 逐条实现]
→ (有落地文档:/speccode:syncing(delta 合并进 speccode/spec/)→ /speccode:archiving,顺序硬约束)
→ /speccode:finishing-worktree(按 merge_target 路由:trunk 目标 → 单 PR 直通 trunk;集成分支目标 → 本地 squash 汇入)
```

- **大需求 opt-in**:两端加 `/speccode:creating-feature`(切集成分支 + 登记父实体 state)与 `/speccode:finishing-feature`(children 全 completed 门禁,集成分支 → trunk 终局单 PR);普通需求不经过这两个命令。
- 「单 PR 直通 trunk」是 finishing-worktree 按 merge_target 路由的行为,不是 finishing-feature 的;finishing-feature 只服务大需求终局。
- 规格主档在 `speccode/spec/`,归档在 `speccode/archive/`,知识集在 `speccode/knowledge/`。
- 脑暴文档由 brainstorming 原生落到 `speccode/changes/<slug>/brainstorm/`,落盘即提交。

## 知识集维护

`speccode/knowledge/` 与 spec/changes/archive 平级(git tracked),按主题组织 topic 文件 + `_index.md` 实扫索引;认知型命令(exploring/proposing/brainstorming/writing-plans/executing-plans/subagent-driven-development/systematic-debugging/requesting-code-review/receiving-code-review)入口自动按需读知识集,失败静默跳过。维护走两条命令,候选经人工闸门才落盘:

- `/speccode:distilling-knowledge` — 从 spec/ 与 archive/ 全量重蒸蒸馏段(能力键制,同键覆盖不累积)
- `/speccode:recording-knowledge` — 手写知识直写

统一入口 = state 登记的 `chore/knowledge-*` worktree 分支(与其他开发分支同一 creating-worktree / finishing-worktree 链路,无特权形态)。

## 发布纪律

bump `plugins/speccode/.claude-plugin/plugin.json` `version` 的提交**必须同步更新** `CHANGELOG.md` 对应版本小节(见 `speccode/spec/plugin-packaging/spec.md`「版本发布纪律」);发版打 `v<version>` tag 并建 GitHub Release(notes 摘自 CHANGELOG);syncing 顺序 = 先 bump+CHANGELOG 再 sync,使「version 与 CHANGELOG 最新小节一致」合并后立即为真。

release bump 类 chore 走 proposing 轻档(空 delta,design.md/specs/ 可省;空 delta 轻档专属 Tier 1)→ `/speccode:applying` → syncing → archiving 链路,不再零文档直提。
