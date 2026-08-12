# 2026-08-12 readme-docs-overhaul 设计

来源:exploring → proposing → brainstorming 三段收敛。本文档是 root README 重构与 CLAUDE.md 优化的权威设计;propose/ 文档为前置背景,两者经回写保持一致。

## Context

- 仓库 = Claude Code marketplace(根 README 是 GitHub 首页,用户第一站);插件 = `plugins/speccode`;21 个 `/speccode:*` 命令。
- 三层文档现状:根 README(1KB,marketplace 索引,硬编码版本 0.2.0 已漂移)、插件 README(260 行设计文档,依赖要求埋 §14)、CLAUDE.md(7.8KB 开发文档,硬编码「137 个用例」)。
- 实锤缺口:无 LICENSE 文件(plugin.json 声明 MIT);visual-companion 零提及;docs/(superpowers 时代归档)无说明。
- 调研基线(2026-08 活数据):spec-kit 126k⭐(hero+7 步走查+视频+中英切换)、OpenSpec 65k⭐(模拟会话 demo+哲学前置+prose 对比)、BMAD 52k⭐(SVG 图+单行安装+docs 外包)、superpowers(纯叙事+11 harness 安装;CLAUDE.md 是 AI 贡献劝退书)。
- 四家铁律:①第一屏放体验 demo ②Quickstart 是命令叙事走查 ③哲学节前置 ④License 节+文件。

## Goals

1. 根 README 成为合格 marketplace 用户门面:第一屏有定位与体验,5 分钟可跑通最小闭环
2. 消除文档硬编码漂移(版本号/用例数量)
3. 补 LICENSE 文件
4. CLAUDE.md 补齐分工与纪律指针

## Non-Goals

- 英文版 README(先纯中文,英文留作后续 feature)
- visual-companion 功能完善;docs/ 目录迁移(仅一句说明)
- CHANGELOG 重写;插件 README 整体重构

## Decisions

### D1 根 README 采用「门面速览+深链」(方案甲,~2.5KB)

用户确认。21 命令详表、R1-R13、迁移指南保留在插件 README;根 README 只放速览与链接,两处互链。被否:乙(全量自包含,~5KB,双份维护漂移)、丙(极简门面,~0.8KB,违背「第一屏给体验」共识)。

结构(自上而下):定位标语 → badges → 为什么(3 痛点)→ 看它干活(模拟会话 demo)→ Quickstart 最小闭环 → 21 命令速览(三组一行式)→ 简化三层拓扑图 → 和谁比(prose)→ 理念(5 条)→ 文档地图 → 贡献(dogfood 链路)→ License。

### D2 demo 用模拟 AI 会话块,展示全链路闭环

用户确认。命令序列:`init → creating-feature → creating-worktree → proposing → finishing-worktree → finishing-feature`,约 12 行代码块,含 ✓ 反馈行。被否:GIF 录屏(素材成本)、视频(更重)。
**防漂移纪律**:demo 中基线测试写「全通过」,**不写 137/137**;badges 不含版本号。

### D3 badges = license + 平台 + 星标

用户确认。license(MIT shields)、平台(macOS/Linux)、GitHub 星标;不含版本号(shields 静态 version 需手工同步,重新引入漂移)。被否:仅 license(太保守)、含版本号(漂移风险)。

### D4 插件 README 维持设计文档 + 三处调整

- 标题下第一行门面指针:「用户门面见根 README;本文档是插件设计文档」
- 依赖要求(现 §14)前置为文首无编号依赖块,删除原 §14,交叉引用(§13「见 R8 与第 14 节」、§15)同步改指
- 第 5 节补 visual-companion 一句提及
被否:整体重构为营销页(丢 R1-R13/迁移价值,与 spec 冲突)。

### D5 CLAUDE.md 四处微创

1. 去「137 个用例」→「数量以 tests/ 目录为准」
2. 开头加两 README 分工说明
3. 常用命令后加发布纪律指针(version bump 同步 CHANGELOG)
4. 补 marketplace 事实(.claude-plugin/marketplace.json)

### D6 LICENSE 新增

MIT 全文,`Copyright (c) 2026 speccode`(与 plugin.json author.name 对齐)。

### D7 语言先纯中文

被否:直接双语(维护成本翻倍,受众未证实)。

## 根 README 骨架(定稿)

按 D1 结构列表自上而下,要点:

- 定位标语:一句话(多需求并行 + spec 托管 + PR 标准化 + SDD 方法论,21 命令固化)
- badges:license + 平台 + 星标(D3)
- 为什么:3 条痛点(并行分支归属/文档散落/流程靠口头约定)
- 看它干活:模拟会话 demo,命令序列 init→creating-feature→creating-worktree→proposing→finishing-worktree→finishing-feature,约 12 行,✓ 反馈行,基线测试表述为「全通过」(D2)
- Quickstart:安装 2 命令 → /speccode:init → 首 feature 最小闭环,5 分钟
- 21 命令速览:生命周期/文档流/方法论三组一行式,详表互链插件 README
- 简化三层拓扑图:trunk → feature → worktree(ASCII,完整版在插件 README)
- 和谁比:prose,vs superpowers(上游)/vs spec-kit(品类)/vs 手工约定
- 理念:5 条(测试驱动/系统化/降复杂度/证据优先/不自信先问)
- 文档地图:根 README(门面)/插件 README(设计文档)/CHANGELOG(发布记录)/CLAUDE.md(开发);docs/ 一句带过(superpowers 时代归档)
- 贡献:dogfood 自托管链路
- License:MIT,链接 LICENSE 文件

与 propose/ 的一致性:proposal.md What Changes 第 1 条即「根 README 重构」,本条为其展开。

## 与 propose/ 的回写一致性

- propose/design.md Decisions 已同步(D1-D3 呈现层选择、demo 序列、badges 集)
- specs delta 无需变更(「文档三层分离」的 MODIFIED 已覆盖门面指针与依赖前置语义)
- tasks.md 无需变更

## Risks

- R1 根 README 膨胀:速览+链接控制,命令表不搬入
- R2 spec delta 与实现漂移:syncing 为本 feature 内步骤
- R3 文档大改致 agent 抓取变难:信息只移动不删除
- R4 §14 删除后的引用链:实现时全文检索「第 14 节」交叉引用逐一改指

## Open Questions

无。
