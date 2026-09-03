---
tier: 1
---

# Proposal: release-0-5-0(发布 0.5.0)

## Why

0.4.0 后 main 已累积 6 个 PR(#41-#46,其中 #41/#46 为本仓 dogfood 蒸馏,用户不可感知、不记 CHANGELOG),其中 #45 knowledge-compact 含 BREAKING(能力键制写侧、append-hand 退役)——按版本发布纪律(bump 与 CHANGELOG 同一提交、tag + GitHub Release)出 0.5.0。

## What Changes

- `CHANGELOG.md`:填 `[0.5.0]` 小节(顶部 EN highlights 一行;BREAKING ×3 = 能力键制 marker + 升级指引 / append-hand 退役 / 布局归位;Added = dev-flow-tiering 全量;Changed = 知识集三机制退役→新鲜度审查、recording 手写段整理、门面与 spec 计数对齐)。
- `plugins/speccode/.claude-plugin/plugin.json`:version → `0.5.0`(与 CHANGELOG 同一提交)。
- 合并后:tag `v0.5.0` + GitHub Release(notes 摘自 CHANGELOG [0.5.0])。

## Capabilities

无(空 delta——发版不改任何 capability 契约;version 约束由 plugin-packaging 既有「版本发布纪律」requirement 覆盖)。

## Impact

- `CHANGELOG.md`、`plugins/speccode/.claude-plugin/plugin.json`
- GitHub tag `v0.5.0` + Release
- 升级用户:存量知识集旧 source 块读侧兼容、首次 distilling 运行经闸门映射(CHANGELOG BREAKING 条目内附指引)
