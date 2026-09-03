---
tier: 2
---

# Proposal: knowledge-compact(知识集快照化改造)

## Why

知识集当前以「来源」(archive 归档包)为块身份,为此演化出 carry-forward / stale-by-source / superseded-by-package 三个特设机制对抗「来源消失、被取代、已消费」——把知识集当历史台账维护,机制复杂度随归档量线性增长;而手写段字节冻结使知识集只能长、不能修。定位应回归「当前态快照 + 长青准则」。

## What Changes

1. **身份模型改为能力键制**(BREAKING,写侧):蒸馏块 marker 从 `distilled-from: <source>` 改为 `distilled-from: cap/<slug>`(slug 匹配 `^[a-z0-9-]+$`,文件内唯一);出处(archive 包名 / spec capability)以纯文本记在块 body 内,不参与身份;按能力键 upsert,同能力演进以覆盖表达、不累积。
2. **compact 每次运行**:distilling 对全部蒸馏目标 topic 的全部既有蒸馏块做新鲜度审查,真值锚 = `speccode/spec/` 主规格;archive 保持增量读、降级为纯读成本控制。
3. **机制退役**:stale-by-source、superseded-by-package、carry-forward 全部退役;`consumed_archives` sidecar 保留但降级为纯读成本控制(不再承担块存废判定)。
4. **手写段可改**:字节冻结 → 闸门驱动可改;recording 新增对本次写入 topic 手写段的整理(权威 = 在场用户);lib/bin 新增 `replace-hand` 写模式(与 replace-distilled 对称)。
5. **闸门纪律**:删除/合并 MUST 附理由;diff 只展示变化块;布局规范 = 手写段在前、蒸馏块在后(存量文件首次写入归位,手写字节保留、仅位置重排)。
6. **存量迁移零工具**:旧 `archive/*` / `spec/*` source 块解析照常,首次新规则运行经闸门映射进能力键(distiller 逐块提议、用户确认);不做迁移脚本。
7. **定位声明**:知识退役即删、不留墓碑;历史叙事归 archive/ 与 CHANGELOG。

## Capabilities

- `knowledge-set`(修改):来源标记、蒸馏命令、蒸馏消费追踪、记录命令四条 requirement 重写。

## Impact

- `plugins/speccode/lib/knowledge.mjs`:+能力键校验、+replaceHandBlocks、replaceDistilledBlocks 布局归位、注释语义更新
- `plugins/speccode/bin/speccode.mjs`:write-knowledge 新增 mode=replace-hand
- `plugins/speccode/tests/`:knowledge / cli 测试更新与新增
- `plugins/speccode/commands/distilling-knowledge.md`、`recording-knowledge.md`:重写机制段
- `speccode/spec/knowledge-set/spec.md`:经 syncing 按本次 delta 重写
- `speccode/knowledge/`(本仓 dogfood):首次新规则运行完成存量块能力键迁移 + 布局归位
- README×4(根中英 + 插件中英)、CHANGELOG(发布时)
