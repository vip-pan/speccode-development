---
tier: 1
---

# Proposal: vscode-slash-command-name(修复 VS Code slash 菜单误显示)

## Why

24 个命令 markdown 的 frontmatter 带非标 `name: "SpecCode: <Title>"` 字段。官方文档明文 `commands/*.md` 忽略 `name`(调用名 = 文件名),但 VS Code 扩展违规捡用为菜单条目,导致用户 slash 菜单显示 `/speccode:SpecCode: Exploring` 这类不存在的命令,选中即报 Unknown command。0.5.0 新增 `applying` 时照抄了该 frontmatter 模式(24/24 全带),实证该模式会继续复制扩散,越晚修扩散越多。

## What Changes

- 删除 `plugins/speccode/commands/*.md`(全部 24 个)frontmatter 的 `name:` 行(仅此一行;`category:`/`tags:` 同为非标字段但无证据参与症状,留待需求② skills 迁移时一并清理;`speccode/archive/**` 历史文档保持原样)。
- `speccode/knowledge/development/standards.md`:修正「命令 markdown 规范」行——现行快照记载的四字段 frontmatter(name/description/category/tags)被本变更证伪,同步改为现行约定并追加出处(知识集是现行状态快照,规格未变故蒸馏新鲜度审查不会自动抓到,必须随变更手工修正)。
- `CHANGELOG.md`:新增 `[0.5.1]` 小节(Fixed)。
- `plugins/speccode/.claude-plugin/plugin.json`:version → `0.5.1`(与 CHANGELOG 同一提交,版本发布纪律)。
- 合并后:tag `v0.5.1` + GitHub Release。

## Capabilities

无(空 delta——主规格 `plugin-packaging` 对命令 markdown frontmatter 零约束,其 `name:` 条款指 plugin.json 元数据;删字段不触任何 capability 契约)。

## Impact

- 受影响文件:`plugins/speccode/commands/*.md` ×24(每文件删 1 行)、`speccode/knowledge/development/standards.md`(1 行)、`CHANGELOG.md`、`plugins/speccode/.claude-plugin/plugin.json`
- 用户可见效果:插件更新到 0.5.1 后,VS Code slash 菜单回落 `/speccode:exploring` 等正确形态——这是对「菜单回落文件名」机制假设的单变量验证;若菜单仍异常,假设需修正,`git revert` 即回退,不影响其他面
- 不影响:引擎 lib / tests(零触碰 `commands/`,基线 279)、命令调用名(文件名未动)、`references/` 层、插件自带 hooks 层
- 需求②(`commands/` → `skills/` 全迁移,0.6.0)已另行立项(见 `bugfix__vscode-slash-command-name.md` 记忆),不在本变更内
