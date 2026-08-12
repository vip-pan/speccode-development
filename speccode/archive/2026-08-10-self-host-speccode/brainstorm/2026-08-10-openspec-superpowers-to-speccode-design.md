# openspec / superpowers → speccode 自托管转换设计

日期:2026-08-10
状态:已获用户批准(2026-08-10)
执行方式:本转换即 speccode 首个 dogfood feature(`chore/self-host-speccode`)

> 本文档是 `docs/superpowers/specs/` 强制节(现行 CLAUDE.md)产出的**最后一份** superpowers 时代脑暴文档——其内容正是退役该强制节本身。后续脑暴文档由 speccode:brainstorming 原生落到 `speccode/changes/<slug>/brainstorm/`。

## 背景

本仓(speccode-development)此前用两套外部工具管理自身开发:

- **OpenSpec**(全局 CLI 1.7.0 + `.claude/commands/opsx/` 9 命令 + `.claude/skills/openspec-*` 9 skills):管理 `openspec/` 下的 8 个 capability 主规格(74 requirements)与 4 个归档 change。
- **superpowers**(用户级插件):SDD 方法论(brainstorming/writing-plans/executing-plans 等)与脑暴文档强制节,产物在 `docs/superpowers/`(3 specs + 11 plans)。

speccode v0.2.0 已把二者能力自包含收编:21 个 `/speccode:*` 命令覆盖 spec 变更生命周期(proposing/syncing/archiving,`speccode/` 目录 delta 模型)与 SDD 方法论(移植自 superpowers v6.2.0,目标项目零外部依赖)。用户决策:**本仓 openspec 与 superpowers 都转换为 speccode,后续由 speccode 自己开发和维护**。

## 方法

苏格拉底式脑暴:先勘探现状(命令清单、`.claude/` 内容、gitignore、规格内引用),再一次一个选择题锁定四项关键决策,最后分段呈现设计获批。

现状勘探的关键事实:

1. speccode v2 主规格格式(`# <capability> Specification` / `## Purpose` / `## Requirements`,requirement 含 SHALL/MUST + Scenario)与 OpenSpec 主规格格式**逐字兼容**,`openspec/specs/` 可原样播种进 `speccode/spec/`。
2. `.claude/` 与 `.speccode/` 均已被 `.gitignore` 忽略(R4 设计)——opsx/openspec 工具的清除是本地清理,不进 PR;`.gitignore` 中 `.speccode/` 条目注释已预见 dogfood。
3. 8 个主规格中仅 `plugin-packaging` 有两条 requirement 把 openspec 描述为现行工具(见「delta 内容修正」)。
4. 插件源码自身有 2 处遗留引用:`creating-feature.md:17` 的 type 推断扫描 `openspec/changes/` 与 `docs/superpowers/specs/`;`plugin.json` keywords 含 `"openspec"`。`lib/sdd.mjs:32` 是移植出处注释,属事实陈述,不动。
5. 本会话加载的 speccode 插件为 v0.1 命令集;v0.2.0 的 21 命令在仓库源码中。dogfood 期间按 v2 命令文件手动驱动 `node plugins/speccode/bin/speccode.mjs`,不依赖会话插件版本。

## 决策(用户逐项确认)

| # | 问题 | 决策 |
|---|---|---|
| D1 | openspec/ 内容处置 | **迁移后删除**:8 主规格原样迁入 `speccode/spec/`,4 归档迁入 `speccode/archive/`,随后删除 `openspec/` 与本地 opsx/openspec 工具 |
| D2 | docs/superpowers/ 处置 | **原样保留为历史**;CLAUDE.md 的「Brainstorm 文档落地(强制)」节删除 |
| D3 | 转换落地方式 | **迁移即首个 dogfood feature**:init → creating-feature → worktree → proposing → 实施 → syncing → archiving → finishing,PR 合入 main |
| D4 | 播种与内容修正组织 | **原样播种 + delta 流程改内容**:先 `git mv` 逐字播种,再把需改的规格条目写成本 feature 的 propose/ delta,走 syncing 合并 |

## 设计

### 完成定义

- `speccode/spec/` 持有 8 个 capability 主规格,`openspec/` 目录从 git 删除
- 今后变更走 proposing → (brainstorming) → writing-plans → 执行 → syncing → archiving 原生链路,随 feature PR 上 trunk
- tracked 文档不再把 openspec/superpowers 描述为现行工具(CHANGELOG、archive、docs/superpowers/ 等历史记录原样保留)
- `.speccode/config.json` 已初始化,134 测试保持绿

### dogfood 执行链

```
main 上:    /speccode:init(只写本地 untracked 的 .speccode/config.json)
main 上:    creating-feature  → chore/self-host-speccode(从 trunk 切出、推送、登记 state)
            creating-worktree → .claude/worktrees/<name>(分支 worktree-self-host-speccode)
worktree 内: proposing   → speccode/changes/self-host-speccode/propose/ 四类文档
worktree 内: 实施迁移(见下「迁移映射」「delta 内容修正」「引用清除清单」)
worktree 内: syncing     → delta 合并进 speccode/spec/
worktree 内: archiving   → changes/ 移入 speccode/archive/2026-08-10-self-host-speccode/
worktree 内: finishing-worktree → 成果回 feature 分支
main 侧:    finishing-feature → 单 PR 直通 main,等合并
合并后本地:  清理 untracked 的 .claude/commands/opsx/、.claude/skills/openspec-*/
```

### 迁移映射(原样播种,`git mv` 保历史)

| 源 | 目标 | 说明 |
|---|---|---|
| `openspec/specs/<8 个 capability>/spec.md` | `speccode/spec/<capability>/spec.md` | 逐字搬,格式兼容 |
| `openspec/changes/archive/<4 个日期目录>/` | `speccode/archive/<同名>/` | 冻结历史,内容不碰 |
| `openspec/config.yaml` | 删除 | speccode 不需要 |
| `openspec/`(空壳) | 删除 | |

### delta 内容修正(走 propose→sync 流程)

仅 `plugin-packaging` 一个 capability,两条 MODIFIED:

1. **「文档三层分离」**:CLAUDE.md 内容枚举中 "OpenSpec 工作流" 改为 speccode 原生工作流描述。
2. **「不打包本仓自用工具」**:前半句 "opsx/openspec-* SHALL 留在仓库作为自用工具" 反转——自用工具变为 speccode 自身命令;「不打包进插件」属性保留改写;settings.local.json 相关 scenario 保持(其断言的是无绝对路径条目,仍为真)。

其余 7 个 capability 零改动;archive 内历史 delta 不碰。

### tracked 文件引用清除清单

| 文件 | 改动 |
|---|---|
| `CLAUDE.md` | 「OpenSpec 工作流」节→「speccode 工作流」节(原生链路,无 openspec validate 步骤);「Brainstorm 文档落地(强制)」节删除;其余零星引用扫清 |
| 根 `README.md` | 开发节指针措辞更新 |
| `plugins/speccode/README.md` | 检查现行行为描述(0.1→0.2 对照表属历史,保留) |
| `plugins/speccode/.claude-plugin/plugin.json` | keywords 删 `"openspec"` |
| `plugins/speccode/commands/creating-feature.md:17` | type 推断扫描路径 `openspec/changes/` → `speccode/changes/`,去掉 `docs/superpowers/specs/` 提示 |
| `plugins/speccode/lib/sdd.mjs:32` | 不动(移植出处注释) |
| `CHANGELOG.md` / `docs/superpowers/` / archive | 一字不动(历史记录) |

本地 untracked 清理(不进 PR,合并后做):删除 `.claude/commands/opsx/`、`.claude/skills/openspec-*`;`settings.local.json` 去掉 `openspec list` 权限条目。`.superpowers/` 是用户本地数据,不动。全局 openspec CLI 与 superpowers 插件属用户级安装,是否卸载由用户决定(收尾时提醒)。

### init 参数(执行时逐项与用户确认)

`trunk=main`、`remote=origin`、`pr_tool=gh`、`worktree_prefix=worktree-`、`worktree_dir=.claude/worktrees`、knowledge_tools 按探测结果(预计为空)、hooks 不配置。

### 验证与风险

- 全量 `node --test ./plugins/speccode/tests/*.test.mjs` 保持 134 绿(迁移不动 lib 逻辑)
- 结构断言:`speccode/spec/` 恰 8 个 spec.md;`openspec/` 不存在;tracked 文件 grep 无 openspec/superpowers 现行引用(白名单:CHANGELOG、speccode/archive、docs/superpowers、sdd.mjs 注释、README 对照表)
- finishing-feature 等 PR 合并超时 → `pending_operation` + `--resume` 续跑(v2 既有机制)
- 流程性风险:v2 命令手动驱动期间严格按命令文件前置校验走(reconcile 归属、trunk 防护),不跳步

## 处置结果

- 本设计经用户逐节确认批准(2026-08-10)。
- 后续:writing-plans 编写实现计划 → 按 dogfood 执行链实施。
- 实施完成后,本仓不再依赖 openspec 与 superpowers;二者在本仓的全部职责由 speccode v0.2.0 的 21 个原生命令接管。
