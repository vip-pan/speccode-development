# tasks: readme-docs-overhaul

## 文档实现

- [ ] 根 README.md 重构为用户门面:定位标语 + badges + 为什么 + 模拟会话 demo + Quickstart 最小闭环 + 命令速览 + 拓扑图 + 对比定位 + 理念 + 文档地图 + 贡献 + License 节
- [ ] 新增 LICENSE 文件(MIT 全文,与 plugin.json `license` 一致)
- [ ] plugins/speccode/README.md:顶部加门面指针、依赖要求前置、补 visual-companion 一句提及
- [ ] CLAUDE.md:去「137 个用例」硬编码;加两 README 分工说明;加发布纪律指针;补 marketplace 事实

## 规格同步

- [ ] spec delta 已就位(changes/readme-docs-overhaul/propose/specs/plugin-packaging/spec.md)
- [ ] syncing 将 delta 合并入 speccode/spec/plugin-packaging/spec.md

## 验证

- [ ] 全量测试回归:`node --test ./plugins/speccode/tests/*.test.mjs` 137/137
- [ ] 根 README 无 0.2.x 硬编码版本号;CLAUDE.md 无「137」字面量
- [ ] LICENSE 与 plugin.json `license` 声明一致
- [ ] 两 README 互链成立(根 README ↔ 插件 README)
