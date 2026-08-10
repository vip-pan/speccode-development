# Proposal: release-0-2-1

## Why

两轮 dogfood 已在插件面积累实质变更(visual-companion 品牌修复、creating-feature 扫描路径修正、plugin.json keywords 清理),按「版本发布纪律」应发 patch 版,让用户经 marketplace 更新机制拿到修复。

## What Changes

- `plugins/speccode/.claude-plugin/plugin.json`:`version` 0.2.0 → 0.2.1(patch:全是修复与小变更,无新命令/verb/行为面)
- `CHANGELOG.md`:新增 `[0.2.1]` 小节(Fixed/Changed 分组,全中文)+ 底部比较链接
- 无 spec delta(已核验主规格与两轮改动无冲突;visual-companion 约束已由「references 自包含与品牌中立」requirement 覆盖)
- 无 BREAKING

## Capabilities

- 无新增/修改(release chore 不改能力契约)

## Impact

- 插件元数据与发布物:plugin.json、CHANGELOG.md
- 合并后主干动作(不进 PR):tag `v0.2.1` + GitHub Release(notes 摘自 0.2.1 小节)
