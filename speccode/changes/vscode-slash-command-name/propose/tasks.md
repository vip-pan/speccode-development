# Tasks: vscode-slash-command-name

- [ ] 1. 删除 `plugins/speccode/commands/*.md` 全部 24 个文件 frontmatter 的 `name: "SpecCode: …"` 行(仅 name 行;`category:`/`tags:` 不动;`speccode/archive/**` 不动)。验证:`rg -n '^name:' plugins/speccode/commands/` 零命中
- [ ] 2. `speccode/knowledge/development/standards.md`:「命令 markdown 规范」行改为现行约定(frontmatter 仅 `description`;`name`/`category`/`tags` 已于 0.5.1 移除——官方文档明文 commands/*.md 忽略 name 且 VS Code 扩展会误用为菜单条目),出处追加本变更归档包 `archive/<YYYY-MM-DD>-vscode-slash-command-name`(包名以 archiving 实际为准;归档先于合并,合并时该路径已存在)
- [ ] 3. `CHANGELOG.md`:新增 `[0.5.1] - <日期>` 小节,顶部 `> EN:` highlights 一行;Fixed:命令 frontmatter 移除非标 `name` 字段,修复 VS Code slash 菜单误显示 `/speccode:SpecCode: …` 且选中报 Unknown command(官方文档:commands/*.md 忽略 name,调用名=文件名)
- [ ] 4. `plugins/speccode/.claude-plugin/plugin.json`:version `0.5.0` → `0.5.1`,与 CHANGELOG 同一提交:`git add CHANGELOG.md plugins/speccode/.claude-plugin/plugin.json && git commit -m "chore: release 0.5.1"`
- [ ] 5. 全量测试:`node --test ./plugins/speccode/tests/*.test.mjs` 全绿(基线 279)
- [ ] 6. requesting-code-review(Tier 1 完成点必经,无绕过)
- [ ] 7. archiving(本分支归档包)→ finishing-worktree(单 PR 上 trunk)
- [ ] 8. 合并后:tag `v0.5.1` 打在 main 合并 commit 上 + GitHub Release(notes 摘自 CHANGELOG [0.5.1]);本机 `/plugin marketplace update` 后在 VS Code 验证 slash 菜单回落 `/speccode:exploring` 形态
