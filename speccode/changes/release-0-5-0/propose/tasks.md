# Tasks: release-0-5-0

- [x] 1. `CHANGELOG.md`:填 `[0.5.0] - <日期>` 小节——顶部 `> EN:` highlights 一行;BREAKING ×3(能力键制 `cap/<slug>` 写侧拒旧 source + 存量块升级指引 / `append-hand` 退役 `unknown mode` / 布局归位重排);Added(dev-flow-tiering:Tier 1/2/3 + `applying` 第 24 命令 + frontmatter `tier:` + 轻档 + review 无条件化);Changed(三机制退役→新鲜度审查真值锚 spec/、recording 手写段整理、门面与 spec 计数对齐)。素材:探索结论草案 + 4 个 PR 的归档 proposal(`speccode/archive/2026-09-03-*`)
- [x] 2. `plugins/speccode/.claude-plugin/plugin.json`:version `0.4.0` → `0.5.0`,与 CHANGELOG 同一提交:`git add CHANGELOG.md plugins/speccode/.claude-plugin/plugin.json && git commit -m "chore: release 0.5.0"`
- [x] 3. 全量测试:`node --test ./plugins/speccode/tests/*.test.mjs` 全绿(基线 279)
- [ ] 4. requesting-code-review(Tier 1 完成点必经,无绕过)
- [ ] 5. archiving(本分支归档包)→ finishing-worktree(单 PR 上 trunk)
- [ ] 6. 合并后:tag `v0.5.0` 打在 main 合并 commit 上 + GitHub Release(notes 摘自 CHANGELOG [0.5.0])
