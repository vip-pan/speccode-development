# design: readme-docs-overhaul

## Context

- 仓库 = Claude Code marketplace(根 README 是 GitHub 首页,用户第一站);插件 = `plugins/speccode`
- 现有三层文档(见 plugin-packaging「文档三层分离」):根 README(marketplace 索引)/ 插件 README(用户文档)/ CLAUDE.md(开发文档)
- 实测缺口:根 README 1KB、硬编码版本 0.2.0(已漂移)、无 LICENSE 文件、插件 README 依赖要求埋 §14、visual-companion 零提及、docs/(superpowers 时代归档)无说明、CLAUDE.md 硬编码「137 个用例」
- 调研基线(2026-08 活数据):spec-kit 126k⭐(hero+7 步命令走查+视频+中英切换)、OpenSpec 65k⭐(模拟 AI 会话代码块 demo+哲学前置+prose 式对比)、BMAD 52k⭐(SVG 流程图+单行 npx 安装+深度外包 docs 站)、superpowers(纯叙事 How-it-works+11 harness 安装节+哲学 4 条;其 CLAUDE.md 实为 AI 贡献劝退书——启示:CLAUDE.md 第一读者是 agent,要写 agent 最常踩的坑)

## Goals

1. 根 README 成为合格的 marketplace 用户门面:第一屏有定位与体验,5 分钟内可跑通「安装 → 首个命令」最小闭环
2. 消除文档硬编码漂移(版本号/用例数量)
3. 补 LICENSE 文件,与 plugin.json 声明一致
4. CLAUDE.md 补齐分工与纪律指针,保持其「写 agent 最常踩的坑」的既有质量

## Non-Goals

- 英文版 README(语言决策:先纯中文做对结构,英文版留作后续 feature)
- visual-companion 功能完善
- docs/(superpowers 时代归档)目录迁移(仅加一句说明)
- CHANGELOG.md 重写
- 插件 README 整体重构为用户文档(维持设计文档定位)

## Decisions

1. **根 README 重构为用户门面**(而非只修补):marketplace 模型下 GitHub 首页是用户第一站;四家标杆一致在首屏放「体验」。被否:最小修补(仅版本列改链接)——治标不治本。**brainstorm 确认:采用「门面速览+深链」方案(~2.5KB,21 命令详表与 R1-R13 保留在插件 README,两处互链)。**
2. **demo 用 OpenSpec 式「模拟 AI 会话代码块」**:零素材成本,终端工具的会话即产品。被否:GIF 录屏(成本高、需维护素材);视频(更重)。**brainstorm 确认:展示全链路闭环(init→creating-feature→creating-worktree→proposing→finishing-worktree→finishing-feature,约 12 行);demo 与 badges 不含版本号、基线测试不写用例数字(防漂移)。**
3. **版本/数量信息去硬编码、以链接引用**:消除 0.2.0 vs 0.2.2 类漂移,与 plugin-packaging 既有「version 不钉字面量」规格哲学一致。被否:shields.io dynamic badge(需常驻 JSON 端点,引入外部依赖)。
4. **plugin README 维持设计文档 + 门面指针**:spec「文档三层分离」已将其定位为用户文档,但内容主体(风险表/迁移)是设计文档性质——本 feature 只做指针与依赖前置,不推翻定位。被否:整体重构为营销页(丢失 R1-R13/迁移的维护价值,与既有 spec 冲突)。
5. **对比节 vs superpowers/spec-kit**:差异化卖点 = worktree 级并行 + 对账算法(独门)、spec 文档仓内托管随 PR 走、hooks/memory、零依赖 Node 引擎、GitHub+GitLab 双支持。
6. **贡献节 = dogfood 自托管链路**:「本仓库由 speccode 自托管开发,贡献即走同一条 workflow」是别家说不出口的真实卖点。
7. **语言先纯中文**:受众与维护成本未证实前不做双语。被否:直接双语(维护成本翻倍)。
8. **badges = license + 平台(macOS/Linux)+ 星标**:不含版本号(shields 静态 version 需手工同步,重新引入漂移)。被否:仅 license(太保守)。

## Risks

- **R1 根 README 膨胀**:命令表/拓扑图全量搬入会超 3KB。→ 缓解:根 README 只放速览与链接,21 命令表与拓扑图保留在插件 README,两处互链。
- **R2 spec delta 与实现不同步**:「文档三层分离」的 MODIFIED 若在 syncing 前实现漂移。→ 缓解:delta 落盘即提交,实现按 tasks 顺序走,syncing 是本 feature 内步骤。
- **R3 文档大改致 agent 信息抓取变难**:21 命令表/拓扑图不删只移动位置,信息不丢失。
- **R4 LICENSE 新增文件**:无法律风险(MIT 声明已存在),仅补齐文本。

## Open Questions

无(探索阶段已确认全部方向决策)。
