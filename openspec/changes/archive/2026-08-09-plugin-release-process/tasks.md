# Tasks: plugin-release-process

## P1 spec 与文档

- [x] 1.1 创建 change 脚手架(proposal / tasks / plugin-packaging delta);`openspec validate plugin-release-process --strict` 通过
- [x] 1.2 写根 `CHANGELOG.md`:全中文 + Keep a Changelog 骨架;`[0.2.0] - 2026-08-09`(BREAKING 分组置顶:三层拓扑收敛/命令改名无别名/config v2/docstrip 退休;Added/Changed/Removed 分组)+ `[0.1.0] - 2026-07-14`(首个可用版,10 命令、四层拓扑、对账算法、文档剥离四步走)
- [x] 1.3 根 `README.md` 加 CHANGELOG 链接;`plugins/speccode/README.md`「从 0.1 迁移」扩充为升级指引(动作链:`/plugin marketplace update` → version 检测 → install/update;注意事项:命令改名无别名/重跑 init 升 config v2/遗留 display 分支与 `waiting_display_pr` 手动收尾/legacy command 名自动规范化/`.speccode/memory`、`sdd/` 按需自建)并加 CHANGELOG 链接
- [x] 1.4 写 `docs/superpowers/specs/2026-08-09-plugin-release-process-brainstorm.md`(背景/方法/决策 4 条/处置结果)

## P2 校验与归档

- [x] 2.1 `openspec validate plugin-release-process --strict` 复跑;`node --test ./plugins/speccode/tests/*.test.mjs` 冒烟(134 用例全绿;顺带修复 detect.test.mjs 中 codemap 目录的过时断言)
- [x] 2.2 `/opsx:sync` 合入 delta 到主 spec(版本发布纪律,11 → 12 条)
- [x] 2.3 `/opsx:archive` 归档到 `openspec/changes/archive/2026-08-09-plugin-release-process/`
- [ ] 2.4 git commit(CHANGELOG + README + brainstorm 文档 + openspec 工件 + detect 测试修正)

## P3 发版(需用户确认后执行)

- [ ] 3.1 `git tag v0.2.0 && git push origin main --tags`
- [ ] 3.2 `gh release create v0.2.0 --notes <摘自 CHANGELOG 0.2.0 节>`;`gh release view v0.2.0` 验证
