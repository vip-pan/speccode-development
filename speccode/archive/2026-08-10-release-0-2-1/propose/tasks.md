# Tasks: release-0-2-1

- [x] 1. `plugins/speccode/.claude-plugin/plugin.json`:`"version": "0.2.0"` → `"0.2.1"`(其余字段不动)
- [x] 2. `CHANGELOG.md`:在 `## [0.2.0]` 之前插入 `## [0.2.1] - 2026-08-10` 小节(Fixed/Changed 两组,覆盖两轮插件面变更);底部链接区在 `[0.2.0]` 行之前加 `[0.2.1]: https://github.com/vip-pan/speccode-development/compare/v0.2.0...v0.2.1`
- [x] 3. 验证:plugin.json 合法 JSON 且 version=0.2.1;CHANGELOG 新小节位置/分组/链接正确;全量 134 测试绿
- [x] 4. syncing(预期「无 delta 可同步」短路)+ 勾选本文件 + archiving
- [ ] 5. finishing-worktree + finishing-feature(PR 合入 main)
- [ ] 6. 合并后主干:`git tag v0.2.1` + `git push origin v0.2.1` + `gh release create v0.2.1`(notes 摘自 0.2.1 小节);提示用户更新本地插件安装
