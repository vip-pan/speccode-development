---
name: speccode-workflow
description: 本仓库(speccode 插件)自身的开发工作流与发布纪律——原生链路顺序、dogfood 约定、版本发布时 CHANGELOG 同步规则。在本仓库做开发或发布时加载。
---

# speccode 仓库开发工作流

## v2 原生链路(dogfood)

本仓库自身的开发由 speccode 自托管(dogfood),不依赖任何外部 spec/方法论工具。变更走 v2 原生链路:

```
/speccode:exploring → /speccode:creating-feature → /speccode:creating-worktree
→ /speccode:proposing(复杂需求要再执行 /speccode:brainstorming，将变更内容落地后回写 proposing 文档)
→ /speccode:writing-plans → 执行 → /speccode:syncing(delta 合并进 speccode/spec/)
→ /speccode:archiving → /speccode:finishing-worktree → /speccode:finishing-feature(单 PR 直通 trunk)
```

- 规格主档在 `speccode/spec/`,归档在 `speccode/archive/`。
- 脑暴文档由 brainstorming 原生落到 `speccode/changes/<slug>/brainstorm/`,落盘即提交。

## 发布纪律

bump `plugins/speccode/.claude-plugin/plugin.json` `version` 的提交**必须同步更新** `CHANGELOG.md` 对应版本小节(见 `speccode/spec/plugin-packaging/spec.md`「版本发布纪律」)。

release bump 类 chore 走 proposing 轻档(空 delta,design.md/specs/ 可省)→ `/speccode:applying` → syncing → archiving 链路,不再零文档直提。

