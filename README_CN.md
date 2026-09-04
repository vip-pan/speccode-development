# speccode

**基于 Claude Code 的整套 SDD(规格驱动开发)与自动化开发体系** —— 多需求并行开发、spec 文档仓内托管、PR 流程标准化,由全套 `/speccode:*` 命令固化为默认路径。本仓库 dogfood 全部成果:规格主档、每次变更的归档、自动化仓库自身开发的开发工作流 skills,全部仓内托管。

[English](README.md) | [简体中文](README_CN.md)

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![platform: macOS/Linux](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)]() [![version](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/vip-pan/speccode-development/main/plugins/speccode/.claude-plugin/plugin.json&query=$.version&label=version&color=blue)](https://github.com/vip-pan/speccode-development/releases) [![tests](https://github.com/vip-pan/speccode-development/actions/workflows/test.yml/badge.svg)](https://github.com/vip-pan/speccode-development/actions/workflows/test.yml) [![GitHub stars](https://img.shields.io/github/stars/vip-pan/speccode-development)]()

## 安装

```bash
/plugin marketplace add vip-pan/speccode-development
/plugin install speccode@speccode-development
```

依赖 [Node.js ≥ 24](#前置依赖) 与 `git`。安装后命令以 `/speccode:` 前缀出现,如 `/speccode:init`、`/speccode:status`、`/speccode:finishing-worktree`。

## 为什么用 speccode

- ✅ **多需求并行** —— 双层拓扑:开发分支(`<type>/<slug>`,git worktree)从 trunk 一步直达;对账算法自动归属每个 worktree,多需求并行施工互不干扰。
- ✅ **文档仓内托管** —— spec 文档(`speccode/changes → spec/ → archive/`)所有分支 tracked、落盘即提交,随 PR 链路上 trunk。
- ✅ **流程标准化** —— 全套 `/speccode:*` 命令 + 生命周期 hooks(封闭枚举)+ 跨会话 memory,团队约定变成可执行原语。
- ✅ **自托管自动化开发** —— 本仓库用 speccode 开发自身(dogfood):每次变更走完整 SDD 链路,规格主档与归档仓内托管,开发工作流 skills 自动化仓库自身流程。一个可运行的自动化开发体系样板,而不只是一个待安装的插件。

## 基础工作流

1. **exploring** —— 在 trunk 上把需求聊清楚,出口判定形态(单需求 / 多个独立 / 大需求)。
2. **creating-worktree** —— 从 trunk 一步切出开发分支(git worktree),基线测试全绿。
3. **proposing** —— 落地 proposal / design / specs / tasks 四类文档,落盘即提交,出口定层。
4. **applying**(极小需求)或 **writing-plans + subagent-driven-development / executing-plans** —— 实现。
5. **requesting-code-review** —— 派发审查子代理,技术化处理反馈。
6. **syncing → archiving** —— delta 并入规格主档,归档本次变更。
7. **finishing-worktree** —— 测试门禁,PR → trunk。(大需求:本地 squash 汇入 opt-in 集成分支,终局 finishing-feature。)

## 看它干活

```console
$ /speccode:init                      # 探测远端/主干/代码智能工具,写 .speccode/config.json
✓ config 就绪: trunk=main, remote=origin, pr_tool=gh
$ /speccode:creating-worktree
✓ feature/demo-api 已切出到独立 worktree,基线测试全通过
$ /speccode:proposing
✓ proposal/design/specs/tasks 四类文档落盘即提交
$ /speccode:applying                  # Tier 1:按 tasks.md 逐条实现
✓ 条目实现、勾选、簿记提交完成
$ /speccode:requesting-code-review
✓ 审查通过
$ /speccode:finishing-worktree
✓ 测试门禁通过,PR 已开往 trunk
```

## 前置依赖

- **Node.js ≥ 24** —— 引擎运行于 Node(纯 ESM、零第三方依赖)
- `git`
- `gh` CLI(GitHub)或 `glab` CLI(GitLab)—— 可选;未安装时 `pr_tool` 自动降级为 `none`,命令会打印等价命令供你手动执行

## Quickstart (5 分钟最小闭环)

1. 安装插件:

   ```bash
   /plugin marketplace add vip-pan/speccode-development
   /plugin install speccode@speccode-development
   ```

2. 运行 `/speccode:init` 初始化配置。
3. `/speccode:creating-feature` 建首个功能分支,`/speccode:creating-worktree` 切出开发 worktree。
4. `/speccode:status` 查看全貌。

安装后命令以 `/speccode:` 前缀出现,如 `/speccode:init`、`/speccode:status`、`/speccode:finishing-feature`。

## 命令速览

| 组 | 命令 |
|---|---|
| 生命周期 | `init` `exploring` `creating-feature` `creating-worktree` `finishing-worktree` `finishing-feature` `status` `reset` |
| 文档流 | `proposing` `brainstorming` `writing-plans` `applying` `syncing` `archiving` |
| 知识 | `distilling-knowledge` `recording-knowledge` |
| 方法论 | `subagent-driven-development` `executing-plans` `dispatching-parallel-agents` `test-driven-development` `systematic-debugging` `requesting-code-review` `receiving-code-review` `verification-before-completion` |

各命令作用与前置条件见 [插件 README §2 命令表](./plugins/speccode/README_CN.md)。

流程按需求体量分三层:极小需求可走 Tier 1(proposing 后由 `/speccode:applying` 按 tasks.md 逐条手动实现),中小型走 writing-plans + SDD/executing-plans,复杂需求先 brainstorming。

## 三层分支拓扑

```
origin/trunk ── feature/<slug> ──┬── worktree-a(并行施工)
                                 └── worktree-b(并行施工)
spec 文档在所有分支 tracked,随 PR 链路上 trunk
```

完整拓扑与要点见 [插件 README §3](./plugins/speccode/README_CN.md)。

## 和谁比

| 能力 | speccode | [superpowers](https://github.com/obra/superpowers) | [spec-kit](https://github.com/github/spec-kit) | 手工约定 |
|---|---|---|---|---|
| 三层分支拓扑 + 对账 | ✅ | — | — | — |
| spec 文档仓内托管(全分支 tracked) | ✅ | — | 部分 | — |
| Claude Code 原生插件 | ✅ | ✅ | —(跨 agent CLI) | — |
| SDD 方法论(探索/文档/计划/执行/评审) | ✅(自包含移植) | ✅(来源) | — | — |
| 生命周期 hooks + 跨会话 memory | ✅ | — | — | — |
| PR/MR 流程标准化 | ✅ | — | — | — |

手工约定把「文档放哪 / 从哪个分支切 / PR 谁开」留给人脑,speccode 把三者固化为默认路径。

## 理念

测试驱动 · 系统化优于临时发挥 · 降低复杂度 · 证据优于断言 · 不要过度自信(不确定先询问)

## 文档地图

| 文档 | 内容 |
|---|---|
| [插件 README](./plugins/speccode/README_CN.md) | 24 命令详表、三层拓扑、R1-R13 风险、0.1→0.2 迁移(插件设计文档) |
| [CHANGELOG](./CHANGELOG.md) | 版本发布记录(Keep a Changelog,全中文) |
| [CLAUDE.md](./CLAUDE.md) | 开发文档:引擎三层架构、测试约定、speccode 工作流 |
| `support/` | 开发工作流 skill(真源)与辅助脚本——`speccode-workflow` 经 `support/install-skills.sh` 安装到 `.claude/skills/`,供 Claude Code 懒加载 |
| `speccode/spec/` · `speccode/archive/` | SDD 规格主档(11 个 capability)与变更归档——体系自身的活文档 |

## 贡献

本仓库由 speccode 自托管开发——完整流程见 [CONTRIBUTING.md](./CONTRIBUTING.md)。spec 变更走 `speccode/changes/` 工作流,贡献即走同一条 workflow(exploring → creating-worktree → proposing → 实现 → 评审 → syncing → archiving → finishing-worktree)。欢迎用 speccode 给 speccode 提 PR。

clone 后运行 `bash support/install-skills.sh`,把本仓库的开发工作流 skill 安装到 `.claude/skills/`(让 `speccode-workflow` skill——双层原生链路、dogfood 约定、发布纪律——对本仓库的 Claude Code 会话可用)。

## License

MIT,见 [LICENSE](./LICENSE)。
