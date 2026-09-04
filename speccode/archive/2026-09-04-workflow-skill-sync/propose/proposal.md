---
tier: 1
---

# 提案:workflow skill 对齐 0.6.0 + support/ 目录迁移

## Why

`skills/speccode-workflow/SKILL.md` 是本仓库 dogfood 工作流的真源,但主链路图停在旧代(always 集成、无 Tier 分级、无知识集层),自 #42 后未随 #45/#46/#49(0.6.0)回写;同时仓库根的 `scripts/` 与 `skills/` 各只承载一个条目,散落无归属。

## What Changes

- **BREAKING(贡献者安装命令路径变化,非插件 API;升级路径:改用 `bash support/install-skills.sh`)**:`scripts/install-skills.sh` → `support/install-skills.sh`;`skills/speccode-workflow/` → `support/speccode-workflow/`(git mv 保留历史)
- 重写 `support/speccode-workflow/SKILL.md`:链路图修 5 处错位(① creating-feature 转大需求 opt-in;② 单 PR 直通 trunk 归 finishing-worktree 按 merge_target 路由;③ proposing 承担定层 Tier 1/2/3;④ brainstorming = Tier 3 硬门禁;⑤ 执行三岔 applying | SDD/executing-plans + 收尾硬顺序);命名去版本化「原生链路(双层拓扑)」;新增知识集小节;发布节补发版 tag/GitHub Release、syncing 顺序、空 delta 轻档专属 Tier 1;frontmatter 去 `name:` 字段
- `install-skills.sh` 逻辑收紧:SRC 指 `support/`,安装判据从「目录即 skill」改为「含 SKILL.md 的目录才装」
- 引用同步(路径 + v2 字样 + 旧链路表述):CLAUDE.md、README.md 与 README_CN.md(双语同步)、CONTRIBUTING.md
- spec delta:plugin-packaging「社区贡献文件」MODIFIED(安装路径 + 贡献流程表述)

## Capabilities

- plugin-packaging(modify)

## Impact

- 受影响:2 处 git mv 迁移 + 1 份 SKILL.md 重写 + installer 逻辑收紧 + 4 个引用文档 + 1 个 spec delta
- 不动:`plugins/speccode/`(插件源码零触点)、CHANGELOG 与 `speccode/archive/`(历史叙事不改写)、`.ua/`(生成物)
- 运行时收尾:分支内重跑 `bash support/install-skills.sh`,修复本机 `.claude/skills/` 副本漂移(缺 #42 发布段)
