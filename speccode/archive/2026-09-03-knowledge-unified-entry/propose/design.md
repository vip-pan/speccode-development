# Design: knowledge-unified-entry

## Context

v3(0.3.0)确立「普通需求从 trunk 直接切 `<type>/<slug>` worktree 分支 + 统一收尾」的宗旨;知识写入(0.2.5 起)保留特权机制:trunk 裸 bootstrap `chore/knowledge-*` 分支(无 state、无 worktree),内置独立的 bootstrap/续跑(`git branch --no-merged`)/登记校验/PR 查重/直通 PR。本仓库已开启 squash-only 合并,`--no-merged` 对 squash 合并过的分支永真——每条已合并维护分支都会被误判「未完成」,缺陷 imminent。两命令机制段 ~80% 重复,维护成本翻倍。

## Goals

- 知识写入与普通需求共用统一入口(creating-worktree)与统一收尾(finishing-worktree)。
- 消灭三缺陷:squash 炸弹、主工作区被 checkout、跑完不回 trunk。
- 两命令瘦身:机制段删除,命令专注知识本体(蒸馏判据 / 记录闸门)。

## Non-Goals

- 不改知识集格式、marker、`_distilled.meta.json` sidecar、蒸馏判据。
- 不改 `_knowledge` trunk 级 memory 摘要机制(仍写,含 PR url)。
- 不改 creating-worktree / finishing-worktree 命令本体(零改动复用)。
- 不引入新 verb / 不改 lib(预期;若实现中发现必要,回到本设计补决策)。

## Decisions

- **D1 命令引用命令,不内联复刻**:入口引导与收尾直接在 prose 中引用 `/speccode:creating-worktree` / `/speccode:finishing-worktree`。被否:①命令内联复刻机制(第三套实现,重蹈 80% 重复覆辙);②下沉 lib(命令编排属交互层,非确定性逻辑,下沉违反分层)。先例:收尾路由统一时命令引用 syncing/archiving/finishing-worktree。
- **D2 续跑判定 = state 查询**:「未完成」= reconcile/state 中 `chore/knowledge-*` 且 status ∈ {pending, in_progress, pr_open}。被否:git `--no-merged`(squash-only 下永真,即本次要消灭的缺陷)。squash 合并后 finishing-worktree 已把 state 推进/删除,判定自然正确。
- **D3 收尾 = finishing-worktree 全流程**:PR 等待策略交给 finishing-worktree 既有菜单(等待/不等待/保留),prose 中建议知识维护选「PR 不等待」(维持蒸馏不阻塞的习惯,但不再作为机制强制)。被否:保留命令内置直通 PR(特权机制本体,三缺陷之源)。
- **D4 slug 约定沿用**:`chore/knowledge-<topic>`(distill 默认 `knowledge-distill`,record 默认 `knowledge-<内容主题>`,无主题 `knowledge-record`)。与既有历史分支命名兼容,state 文件名 `chore__knowledge-*.json` 无歧义。
- **D5 入口形态**:保留「trunk 一键」体验——trunk 上运行 → state 查既有未完成 knowledge 分支(有则询问续跑:cd 到其 worktree / 新建)→ 无则 AskUserQuestion 确认 slug 后引导走 creating-worktree 建分支再继续。被否:强制用户先手动跑 creating-worktree 再跑知识命令(两步,丢掉一键体验;且「入口检测」本就是知识命令自己的事)。

## Risks

- **worktree 中 verb 的 speccodeDir 定位** → 缓解:既有设计已解决(repoRoot 用 `--git-common-dir` 定位,worktree 内跑 verb 仍解析主仓 `.speccode/`;`speccode/knowledge/` 是 tracked 文档,写的是 worktree 内副本,随分支 PR 上 trunk)。
- **蒸馏读 archive/spec 的完整性** → 缓解:worktree 基于最新 trunk 切出,spec/archive 与 trunk 一致;开发周期长时 finishing-worktree 前可 rebase(既有流程覆盖)。
- **PR url 获取**:finishing-worktree 的 PR 菜单输出含 PR url,`_knowledge` 摘要从该输出取;`pr_tool=none` 时 finishing-worktree 已有等效命令降级,摘要在该情形记录等效命令(既有口径)。
- **用户习惯迁移**:蒸馏从「不阻塞」变「过门禁 + 收尾菜单」→ 缓解:prose 建议默认「PR 不等待」;门禁是全量测试(纯 docs 改动即绿)。

## Open Questions

- 无(实现中发现新问题回到 proposing 补录)。
