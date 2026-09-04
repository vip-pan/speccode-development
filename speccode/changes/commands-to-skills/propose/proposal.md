---
tier: 2
---

# commands/ → skills/ 全迁移(0.6.0)

## Why

0.5.1 删除 24 个命令 frontmatter 的非标 `name` 只是治标:`commands/` 本身是 Claude Code 官方不再主推的面,`category`/`tags` 仍是非标残留,VS Code 菜单把 name 误用为菜单条目只是这一整类「非标字段被客户端捡用」歧义的显例。官方对新插件明确建议使用 `skills/`,迁移到 skills/ 一次性消灭该类问题,并解锁 `paths`/`when_to_use`/`context` 等 skill 专有字段。

## What Changes

- 24 个 `plugins/speccode/commands/<name>.md` → `plugins/speccode/skills/<name>/SKILL.md`(git mv 保留历史;调用名 = 目录名,`/speccode:<name>` 不变)
- frontmatter 重写:只留 `description`;删非标遗留 `category`/`tags`(`name` 已于 0.5.1 删,不回填)
- 语义变化(用户已确认接受):skills 可被模型按 description 自动调用,不再仅限用户显式 `/speccode:<name>`;不设 `disable-model-invocation`
- 命令正文内部引用 1 处更新(syncing.md 全仓 grep 清单中的 `plugins/speccode/commands/`)
- `tests/cli.test.mjs` 6 处命令文件读路径更新为 skills/ 布局(执行期发现:路径为 `join(..., 'commands', '<name>.md')` 拼接形态,探索 grep 模式 `commands/` 带斜杠匹配不到;仅改路径,断言语义不变——2026-09-04 人类伙伴确认折入 Task 1 同一提交)
- CLAUDE.md 命令交互层表述更新(1 处)
- spec delta:plugin-packaging 布局/裸调/源码跟踪/命名空间 4 条 MODIFIED + skill frontmatter 契约 1 条 ADDED
- 知识集 standards.md / environment.md 对应行同步修正(现行快照被本变更证伪)
- CHANGELOG `[0.6.0]` 小节 + plugin.json `version: 0.6.0` 同一提交

## Capabilities

- `plugin-packaging`(修改:插件根目录布局、命令通过 bin/ PATH 裸调引擎、插件源码与运行时数据边界、命令命名空间;新增:skill frontmatter 契约)

## Impact

- 插件打包结构(skills/ 取代 commands/,目录式布局)
- 文档:CLAUDE.md、知识集、CHANGELOG
- **零波及**(2026-09-04 修正):引擎 lib/、bin/(零引用)、references/(命令正文全部经 `${CLAUDE_PLUGIN_ROOT}/references/...` 绝对引用)、README×4(无路径引用);tests/ 仅 `cli.test.mjs` 6 处读路径需随迁移更新(见 What Changes)
- 用户侧:安装 0.6.0 后 slash 菜单仍为 24 项 `/speccode:<name>` 形态;新增性能为模型自动调用
