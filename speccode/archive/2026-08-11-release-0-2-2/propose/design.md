# Design: release-0-2-2

## Context

发布纪律要求 version bump 与 CHANGELOG 同 PR、主干打 tag、Release 摘自 CHANGELOG。R7 实施时发现「plugin.json 元数据」规格(body L35 + scenario L39/L42)与「命令命名空间」scenario(L94)把 `0.2.0` 钉为字面量——0.2.1 已使其过时,0.2.2 会再次加深。规格钉版本字面量 = 每次发版必然制造规格漂移,与「版本发布纪律」自身冲突,本轮一并修。

## Goals

- 0.2.2 按纪律发布(bump + CHANGELOG 同 PR;合并后 tag + Release)
- 规格中的版本断言改为不随发版漂移的不变量

## Non-Goals

- 不改 README 迁移对照表中的 0.1.0→0.2.0 叙述(历史事实,保留)
- 不做 minor/major(四项修复 + 防御加固,无新能力、无 BREAKING)
- 不动 marketplace.json(无 version 字段)

## Decisions

- **patch 而非 minor**:R4-R7 全部为修复与小变更。被否备选:minor(夸大变更面)
- **版本断言不变量化(本轮回填 R7 发现)**:`version` 的规格约束 = 「合法语义化版本 + 与 CHANGELOG.md 最新版本小节一致」;「版本号控制更新」scenario 的具体版本改为括号内示例性质;「旧命令名不再出现」WHEN 改 `0.2.x`。被否备选:每次发版同步改规格字面量(正是漂移根源,纪律上不可持续)
- **CHANGELOG 条目口径**:Fixed 四条对应 R4-R7 的修复项;Changed 收录死 CSS 清理与三处规格演进;发版本轮的规格去字面量也列入 Changed(对用户可读的契约变化)

## Risks

- CHANGELOG 漏条目 → 对照 R4-R7 四个 squash commit(1c10c19 / d968a65 / 3d1f789 / cdb3929)逐一核对
- 不变量措辞过松 → scenario 保留可机械化验证的断言(semver 正则 + CHANGELOG 最新小节比对)

## Open Questions

无。
