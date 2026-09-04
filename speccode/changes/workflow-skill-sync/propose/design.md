# 设计:workflow skill 对齐 0.6.0 + support/ 目录迁移

## Context

- SKILL.md 上次实质更新停 #42(dev-flow-tiering);#45(能力键知识集)/#46(蒸馏)/#49(0.6.0 skills 迁移)未回写。主链路图与 0.6.0 契约 5 处错位(proposal What Changes 所列)。
- 现行命令衔接链权威出处:knowledge `development/architecture.md`(cap/development-flow-tiering 块「命令衔接链(双层版)」)。
- 根目录 `scripts/`(仅 `install-skills.sh`)与 `skills/`(仅 `speccode-workflow/`)各只有一个条目;收拢为 `support/`。
- 本机 `.claude/skills/speccode-workflow/` 安装副本已漂移(缺 #42 发布段),收尾重装。
- CONTRIBUTING.md 与双语 README 的贡献段写死旧链路(`exploring → creating-feature → … → finishing-feature`)与 v2 字样;spec「社区贡献文件」requirement 正文同样写死旧链路与旧路径。

## Goals

- workflow skill 描述与 0.6.0 契约逐条一致;全仓活文档零旧路径 / 旧链路 / v2 字样残留
- `support/` 平铺布局落地,installer 安装判据收紧
- 双语同步纪律生效(README 两版同提交内逐段对照)

## Non-Goals

- 不改 `plugins/speccode/`(插件命令、lib、tests 零触点)
- 不动 CHANGELOG 与 `speccode/archive/`(历史叙事不改写)
- 不手改 `speccode/spec/` 主规格(delta 由 syncing 合并)

## Decisions

1. **平铺 support/**——`support/install-skills.sh` + `support/speccode-workflow/SKILL.md`。被否:嵌套 `support/scripts/` + `support/skills/`(多一层无信息量);用户原话「内容放到 support 目录中」即平铺语义。installer SRC=`$REPO_ROOT/support`,安装判据从「目录即 skill」收紧为「含 SKILL.md 的目录才装」——防 support/ 未来混入非 skill 目录被误装。
2. **去版本化命名**「原生链路(双层拓扑)」。被否:写 v3——版本号入活文档会重演「v2」漂移;knowledge 既有表述亦用「双层版」。
3. **git mv 迁移**保留 rename 历史(standards:文件移动用 git mv)。
4. **CONTRIBUTING / README 旧链路表述一并修**——与安装路径同句簇、同 drift 类;spec「社区贡献文件」requirement 正文同时写死旧链路与旧路径,一个 MODIFIED delta 覆盖两处。
5. **frontmatter 去 `name:` 字段**——对齐 0.6.0 命令 markdown 规范(frontmatter 只含 description;name 致 VS Code 菜单歧义,0.5.1 根因相同)。
6. **installer 仓库根定位保持 `SCRIPT_DIR/..` 不改**——`support/` 与原 `scripts/` 同为仓库根下一层;DST `.claude/skills/` 不变。

## 新 SKILL.md 蓝图(逐节,实现时按此落地)

1. frontmatter:仅 `description`(沿用现文案,无版本号字样)。
2. 标题:`# speccode 仓库开发工作流`。
3. `## 原生链路(双层拓扑)(dogfood)`:链路图 = exploring(形态确认三岔)→ **creating-worktree**(普通需求唯一入口,`<type>/<slug>` 从 trunk 切出)→ **proposing(定层 Tier 1/2/3)**→ [Tier 3: brainstorming(硬门禁)]→ [Tier 2/3: writing-plans → subagent-driven-development 或 executing-plans 二选一;Tier 1: applying 按 tasks.md 逐条]→ (有落地文档:syncing → archiving,硬顺序)→ **finishing-worktree**(按 merge_target 路由:trunk → 单 PR;集成分支 → 本地 squash 汇入);**大需求 opt-in**:两端加 creating-feature(集成分支 + 父实体)与 finishing-feature(children 全 completed 门禁,集成分支 → trunk 终局单 PR)。落点三行:规格主档 `speccode/spec/`、归档 `speccode/archive/`、知识集 `speccode/knowledge/`;脑暴文档落 `speccode/changes/<slug>/brainstorm/`。
4. `## 知识集维护`(新增):`speccode/knowledge/` 与 spec/changes/archive 平级(tracked);`distilling-knowledge`(全量重蒸)/ `recording-knowledge`(直写)经人工闸门落盘;统一入口 = state 登记的 `chore/knowledge-*` worktree 分支(经 creating-worktree / finishing-worktree,无特权形态)。
5. `## 发布纪律`:bump `plugins/speccode/.claude-plugin/plugin.json` version 的提交必须同步 CHANGELOG 对应版本小节(锚 `speccode/spec/plugin-packaging/spec.md`「版本发布纪律」);发版打 `v<version>` tag 并建 GitHub Release(notes 摘自 CHANGELOG);syncing 顺序 = 先 bump+CHANGELOG 再 sync;空 delta 轻档专属 Tier 1(release chore 走 proposing 轻档 → applying → syncing → archiving 链路)。

## CONTRIBUTING「Making a change」新链路(六步)

1. `/speccode:exploring` — think on trunk; conclusions land in session memory
2. `/speccode:creating-worktree` — cut a `<type>/<slug>` worktree branch from `main` (the single entry for normal requirements)
3. `/speccode:proposing` — proposal docs + tier (1/2/3)
4. Tier 1: `/speccode:applying`;Tier 2/3: `/speccode:writing-plans` → `/speccode:executing-plans` (or `subagent-driven-development`); Tier 3 adds `/speccode:brainstorming` before writing-plans
5. `/speccode:requesting-code-review` → `/speccode:receiving-code-review`
6. `/speccode:syncing` → `/speccode:archiving` → `/speccode:finishing-worktree` (single PR to `main`; large requirements opt in via `/speccode:creating-feature` / `/speccode:finishing-feature` at both ends)

## Risks

- 双语漂移(README 两版)→ 同一提交内逐段对照改,结构对齐为锚
- 残留旧路径 / 旧链路引用 → 收尾全仓 grep 校验(禁区:活文档;豁免:CHANGELOG、`speccode/archive/`、`.ua/`)
- spec MODIFIED 名称不一致 → delta requirement 名逐字对照主规格「社区贡献文件」

## Open Questions

(无)
