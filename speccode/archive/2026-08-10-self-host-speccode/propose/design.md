# Design: self-host-speccode

## Context

设计脑暴已固化于 `docs/superpowers/specs/2026-08-10-openspec-superpowers-to-speccode-design.md`(superpowers 时代最后一份强制节文档),四项关键决策(D1 迁移后删除 / D2 docs/superpowers 保留为历史 / D3 迁移即首个 dogfood feature / D4 原样播种 + delta 流程改内容)经用户逐项确认。本文件为其执行视图。

## Goals

- `speccode/spec/` 持有 8 个 capability 主规格,`openspec/` 从 git 删除
- tracked 文档不再把 openspec/superpowers 描述为现行工具
- 全链路 dogfood:proposing → syncing → archiving → finishing 在真实变更上跑通

## Non-Goals

- 不改写任何历史:CHANGELOG、docs/superpowers/、迁入的归档内容、移植出处注释(README L9 / CLAUDE.md L7 / sdd.mjs L32)
- 不发布新版本插件(plugin.json keywords 与 creating-feature.md 修正随本 PR 落地,发版另行按发布纪律评估)
- 不卸载用户级 openspec CLI 与 superpowers 插件(仅仓库侧解引用,收尾时提醒用户)

## Decisions

- **逐字播种而非改写**:openspec 与 speccode 主规格格式逐字兼容,`git mv` 保历史;内容修正(仅 plugin-packaging 2 条)走 delta,使 speccode/spec/ 每处内容都有 delta 出处
- **「不打包本仓自用工具」改写方向**:自用工具反转为 speccode 自身命令集,插件纯度属性保留;不点名 OpenSpec(避免主规格出现工具名,验证 grep 白名单不加新条目)
- **被拒绝的备选**:保留 openspec/ 只读(双规格源必漂移);搬家时顺手改内容(首轮 dogfood 验证不到规格生命周期)

## Risks

- v2 命令手动驱动出错 → 每命令严格按前置校验(reconcile 归属、trunk 防护),关键步骤有验证命令
- PR 等待超时 → `pending_operation` + `--resume` 续跑(v2 既有机制)

## Open Questions

无。
