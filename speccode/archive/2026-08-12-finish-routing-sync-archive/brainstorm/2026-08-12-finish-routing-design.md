# Design: 开发完成收尾路由修正(brainstorm 定稿)

> 2026-08-12 · feature: feature/finish-routing-sync-archive · 前置 proposing 四文档见 `propose/`

## 问题

`/speccode:subagent-driven-development` 与 `/speccode:executing-plans` 完成后直接引导 `/speccode:finishing-worktree`,跳过 syncing 与 archiving。**硬约束**:syncing/archiving 的 trunk 防护要求 worktree-* 分支,而 finishing-worktree 会 `git worktree remove` 移除 worktree——sync/archive 只能在 finishing-worktree 之前执行。当前引导把 sync/archive 逼进死路,与实际开发流程初衷(先同步规格、归档变更,再收尾 worktree)不符。

## 方案(已批准)

条件化收尾路由 + warn-only 安全网,全部为命令 prose 改动(无 lib/逻辑改动):

```
开发完成(subagent-driven / executing-plans)
  → 有 speccode/changes/<slug>/ ?(落地文档)
      ├─ 是 → 手动询问 / auto 自动衔接 /speccode:syncing → archiving → finishing-worktree
      └─ 否 → 直接 finishing-worktree

finishing-worktree 合并选项前 → test -d speccode/changes/<slug> ? → 是 → warn-only(不阻断)→ 呈现选项
```

### 关键决策

- **条件化基于 `speccode/changes/<slug>/` 是否存在**(否决:一律走 syncing/archiving)——syncing/archiving 在无需求目录时报错退出,「暂不落地文档」路径必须直接 finish。
- **手动询问 / auto 自动衔接 syncing**(对齐 creating-worktree 后续引导先例)。
- **C 门 warn-only 不阻断**——安全网而非强制。
- **C 门实现 = `test -d` 命令层**(否决:reconcile 透出 `has_unarchived_changes` 字段)——与 creating-worktree 标记文件探测(`test -f package.json`)先例一致;slug 已由 reconcile 提供;为朴素 fs 检查扩展核心对账算法属过度设计。

## 架构与组件(改动面)

| 文件 | 位置 | 改动 |
|---|---|---|
| `commands/subagent-driven-development.md` | :292 收尾 | 直跳 → 条件化路由 + 手动/auto |
| 〃 | :78/:107 流程图 | 节点改条件分支 |
| 〃 | :371 示例 | 同步 |
| `commands/executing-plans.md` | :58-59 第3步 | REQUIRED SUB-SKILL → 条件化路由 + 手动/auto |
| `commands/finishing-worktree.md` | 合并选项前 | 新增 C 门:`test -d speccode/changes/<slug>` → warn-only |
| `commands/creating-worktree.md` | :53 | 核对无文档路径直接 finish(已一致) |
| `propose/specs/git-workflow-lifecycle/spec.md` | — | ADDED ×2(开发完成收尾路由 / finishing-worktree 未归档变更警告) |

## 错误处理

- C 门 warn-only 永不断流。
- 无文档路径不调用 syncing/archiving → 不会触发其「未找到需求目录」报错。
- auto 衔接 syncing 时,其「无 delta」优雅短路。

## 测试

- prose 改动不涉逻辑 → 全量 137 基线保持绿,无新增测试。
- spec delta 由 `/speccode:syncing` 合并验证。
- README EN/CN 核对收尾路由措辞,大概率零改动。

## 非目标

- 不改变 syncing/archiving 自身行为与 trunk 防护。
- 不自动执行 archiving 内部操作。
- 不强制 finishing-worktree(C 门 warn-only)。
