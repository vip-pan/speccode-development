# proposal: readme-docs-overhaul

## Why

仓库作为 Claude Code marketplace 的用户第一站是 GitHub 首页,但当前根 README 仅 1KB、缺定位/体验/Quickstart,且硬编码版本已漂移(0.2.0 vs plugin.json 0.2.2);插件 README 被错当门面(纯设计文档,依赖要求埋 §14);声明 MIT 却无 LICENSE 文件。同类项目(spec-kit 126k⭐ / OpenSpec 65k⭐ / BMAD 52k⭐)已形成「hero+体验 demo+命令走查式 Quickstart+哲学前置+License」的成熟模式,本项目未跟进。

## What Changes

- **根 README.md 重构**(BREAKING 对文档结构):marketplace 用户门面——定位标语 + badges + 痛点(Why) + 模拟 AI 会话 demo + Quickstart 最小闭环 + 21 命令速览 + 三层拓扑图 + 对比定位(vs superpowers/spec-kit)+ 理念 + 文档地图 + 贡献(dogfood 自托管链路)+ License 节
- **LICENSE 文件新增**:MIT 全文,与 plugin.json `license` 声明一致
- **plugin README**:顶部加「用户门面见根 README」指针;§14 依赖要求前置到文档前部;补 visual-companion 一句提及;维持设计文档定位
- **CLAUDE.md 微创**:去「137 个用例」硬编码;加两 README 分工说明;加发布纪律指针(version bump 同步 CHANGELOG);补 marketplace 事实
- **spec delta**:`plugin-packaging` — MODIFIED「文档三层分离」+ ADDED「文档版本信息不漂移」+ ADDED「许可证文件」

## Capabilities

- `plugin-packaging`(MODIFIED 1 + ADDED 2)

## Impact

- 文件:根 `README.md`、`LICENSE`(新)、`plugins/speccode/README.md`、`CLAUDE.md`、`speccode/spec/plugin-packaging/spec.md`(经 syncing 合并)
- 无引擎代码、无命令 markdown、无行为变化;版本发布流程不受影响
- 测试:无需新增单测;回归 137/137
