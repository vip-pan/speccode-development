# tasks:commands/ → skills/ 全迁移

> 本清单已由 plan/2026-09-04-commands-to-skills-plan.md 接管:实现进度以 plan 的 checkbox 为准,本文件不再勾选,仅作意图索引。

## 迁移实现

1. `git mv` 24 个 `plugins/speccode/commands/<name>.md` → `plugins/speccode/skills/<name>/SKILL.md`(保 rename 历史;完成后 `ls plugins/speccode/` 无 commands/)
2. 重写 24 个 SKILL.md frontmatter:删 `category`/`tags` 行,只留 `description`(与 1 同一提交,design D4)
3. 命令正文内部引用:synccing 命令的 SKILL.md 中全仓 grep 清单里 `plugins/speccode/commands/` → `plugins/speccode/skills/`(1 处)
4. CLAUDE.md 更新:「3. 命令交互层」的路径 → `plugins/speccode/skills/<name>/SKILL.md`
5. 知识集同步:standards.md「命令 markdown 规范」行 + environment.md「组件(commands/bin 等)」措辞
6. 验证:全仓 grep `commands/` 仅允许命中 archive/、changes/ 与 CHANGELOG 历史小节;README×4 确认无路径引用
7. 全量测试保持全绿(引擎零波及确认)

## 发版与收尾

8. CHANGELOG `[0.6.0]` 小节(Changed + 英文 highlights)+ plugin.json `version: 0.6.0` 同一提交
9. code review(requesting-code-review)
10. syncing(delta 合并进主规格)→ archiving → finishing-worktree(测试门禁 + PR → trunk)
11. 合并后:tag `v0.6.0` + GitHub Release
12. 本机 `/plugin marketplace update` 后验证:VS Code 菜单 24 项形态 + skills 列表;顺带闭环 0.5.1 菜单回落验证
