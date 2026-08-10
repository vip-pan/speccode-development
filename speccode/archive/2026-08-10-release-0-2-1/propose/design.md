# Design: release-0-2-1

## Context

0.2.0(2026-08-09)之后两轮 dogfood 落地:PR #4(openspec/superpowers → speccode 自托管转换)与 PR #5(visual-companion 品牌改写 + 文档修正)。发布纪律要求 version bump 与 CHANGELOG 同步、主干打 tag、GitHub Release 摘自 CHANGELOG;Release 不是更新检测机制(marketplace git 拉取 + plugin.json version 比对才是)。

## Goals

- plugin.json 升 0.2.1 且 CHANGELOG 小节同 PR 同步(纪律硬性)
- 小节内容覆盖两轮全部插件面变更,分组符合 Keep a Changelog

## Non-Goals

- 不做 spec delta(主规格与两轮改动无冲突,已 grep 核验)
- 不改 marketplace.json(无 version 字段)
- 不发 minor/major(无新能力、无 BREAKING)

## Decisions

- **patch 而非 minor**:两轮变更全部为修复(探路错误、过时扫描路径)与小变更(品牌文案、keywords、文档),无新命令/verb/行为面 —— 语义化版本归 patch。被否备选:minor(会夸大变更面,误导升级预期)
- **无 specs/ delta 目录**:本 change 不修改任何能力契约;syncing 将以「无 delta 可同步」短路,archiving 记录 sync 状态为「无 delta」。被否备选:为发版硬造 delta(违背 delta 模型语义)
- **跳过 writing-plans**:改动为 2 个文件的机械编辑且全文已在 tasks/本设计锁定,writing-plans 无增量信息;执行内联完成,验证先行(verification-before-completion)。被否备选:走完整计划文档(纯仪式)
- **tag/Release 在合并后的主干执行**:PR 内只含 version bump + CHANGELOG;tag `v0.2.1` 打主干合并点,Release notes 摘自 0.2.1 小节(纪律要求 notes 与小节一致或为摘录)

## Risks

- CHANGELOG 漏条目 → 写前对照两轮 PR 的 commit 清单逐条核对(PR #4 squash b10e072、PR #5 squash da6aca6 + 终审修复 2fa9fb7 已并入 squash)
- 比较链接写错 → 沿用既有 `[0.2.0]` 行的 compare URL 模式,仅换版本号

## Open Questions

无。
