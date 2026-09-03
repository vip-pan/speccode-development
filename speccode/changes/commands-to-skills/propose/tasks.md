# tasks:commands/ → skills/ 全迁移

## 迁移实现

- [ ] 1. `git mv` 24 个 `plugins/speccode/commands/<name>.md` → `plugins/speccode/skills/<name>/SKILL.md`(先建目录再 mv,保 rename 历史;完成后 `ls plugins/speccode/` 无 commands/)
- [ ] 2. 重写 24 个 SKILL.md frontmatter:删 `category`/`tags` 行,只留 `description`(逐文件核对 frontmatter 无其他字段;正文零改动)
- [ ] 3. 命令正文内部引用:synccing 命令的 SKILL.md 中全仓 grep 清单里 `plugins/speccode/commands/` → `plugins/speccode/skills/`(1 处)
- [ ] 4. CLAUDE.md 更新:「3. 命令交互层」的路径 `plugins/speccode/commands/*.md` → `plugins/speccode/skills/<name>/SKILL.md`,并同步该段措辞(slash 命令表述不变)
- [ ] 5. 知识集同步(现行快照被本变更证伪,随变更改):`speccode/knowledge/development/standards.md`「命令 markdown 规范」行改为 skill 布局 + frontmatter 只含 description;`speccode/knowledge/development/environment.md`「组件(commands/bin 等)」→「组件(skills/bin 等)」
- [ ] 6. 验证:全仓 grep `commands/` 仅允许命中 `speccode/archive/`、`speccode/changes/`(本变更自身)与 CHANGELOG 历史小节;README×4 确认无路径引用(已复核,重验防漂移)
- [ ] 7. 全量测试保持全绿(引擎零波及确认;数量以 tests/ 为准,不硬编码)

## 发版与收尾

- [ ] 8. CHANGELOG `[0.6.0]` 小节(Changed 分组 + 英文 highlights 块)+ `plugins/speccode/.claude-plugin/plugin.json` `version: 0.6.0`,同一提交
- [ ] 9. code review(requesting-code-review,BASE 为本分支首提交前)
- [ ] 10. syncing(delta 合并进主规格)→ archiving → finishing-worktree(测试门禁 + PR → trunk)
- [ ] 11. 合并后:tag `v0.6.0` + GitHub Release(notes 摘自 CHANGELOG)
- [ ] 12. 本机 `/plugin marketplace update` 后验证:VS Code `/speccode:` 菜单 24 项 `/speccode:<name>` 形态不变 + 会话 skills 列表出现 `speccode:*`;顺带闭环 0.5.1 的菜单回落验证(此前未回报)
