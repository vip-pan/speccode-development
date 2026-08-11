# Tasks: release-0-2-2

- [x] 1. `plugin.json`:`"version": "0.2.1"` → `"0.2.2"`(其余字段不动)
- [x] 2. `CHANGELOG.md`:在 `## [0.2.1]` 之前插入 `## [0.2.2] - 2026-08-11` 小节(Fixed×4:R4 推断来源/R5 orphan 豁免/R6 append 边界/R7 scheme 门禁;Changed:死 CSS、三处规格演进、版本断言不变量化);底部链接区加 `[0.2.2]: .../compare/v0.2.1...v0.2.2`
- [x] 3. syncing 合并 delta(MODIFIED ×2:版本断言不变量化)——注意顺序:先 bump+CHANGELOG,再 sync,使「version 与 CHANGELOG 最新小节一致」在合并后立即为真
- [x] 4. 验证:plugin.json 合法 JSON 且 version=0.2.2 且与 CHANGELOG 最新小节一致;全量 137 绿;勾选本文件 + archiving
- [ ] 5. finishing-worktree + finishing-feature(PR 合入 main)
- [ ] 6. 合并后主干:`git tag v0.2.2` + `git push origin v0.2.2` + `gh release create v0.2.2`(notes 摘自 0.2.2 小节);提示用户更新本地插件
