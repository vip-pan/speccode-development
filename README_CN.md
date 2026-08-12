# speccode

让 Claude Code 按工程纪律干活——多需求并行开发、spec 文档托管、PR 流程标准化,21 个 `/speccode:*` 命令把 SDD 方法论(探索/文档/计划/子代理执行/评审)固化成默认路径。

[English](README.md) | [简体中文](README_CN.md)

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![platform: macOS/Linux](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)]() [![GitHub stars](https://img.shields.io/github/stars/vip-pan/speccode-development)]()

## 为什么用 speccode

- **多需求并行**:trunk / feature / worktree 三层拓扑,对账算法自动归属每个 worktree,多 feature、多 worktree 并行施工互不干扰。
- **文档仓内托管**:spec 文档(`speccode/changes → spec/ → archive/`)所有分支 tracked、落盘即提交,随 PR 链路上 trunk。
- **流程标准化**:21 命令 + hooks(14 个生命周期事件)+ 跨会话 memory,团队约定变成可执行原语。

## 看它干活

```console
$ /speccode:init                      # 探测远端/主干/知识库工具,写 .speccode/config.json
✓ config 就绪: trunk=main, remote=origin, pr_tool=gh
$ /speccode:creating-feature chore/payment-api
✓ 功能分支已建并推送,state 已登记
$ /speccode:creating-worktree
✓ worktree 已切出,基线测试全通过
$ /speccode:proposing
✓ proposal/design/specs/tasks 四类文档落盘即提交
$ /speccode:finishing-worktree
✓ 测试门禁通过,成果合并回 feature
$ /speccode:finishing-feature
✓ 单 PR → trunk 已合并,回到 main
```

## Quickstart(5 分钟最小闭环)

1. 安装插件:

   ```bash
   /plugin marketplace add vip-pan/speccode-development
   /plugin install speccode@speccode-development
   ```

2. 运行 `/speccode:init` 初始化配置。
3. `/speccode:creating-feature` 建首个功能分支,`/speccode:creating-worktree` 切出开发 worktree。
4. `/speccode:status` 查看全貌。

安装后命令以 `/speccode:` 前缀出现,如 `/speccode:init`、`/speccode:status`、`/speccode:finishing-feature`。

## 21 个命令速览

| 组 | 命令 |
|---|---|
| 生命周期 | `init` `exploring` `creating-feature` `creating-worktree` `finishing-worktree` `finishing-feature` `status` `reset` |
| 文档流 | `proposing` `brainstorming` `writing-plans` `syncing` `archiving` |
| 方法论 | `subagent-driven-development` `executing-plans` `dispatching-parallel-agents` `test-driven-development` `systematic-debugging` `requesting-code-review` `receiving-code-review` `verification-before-completion` |

各命令作用与前置条件见 [插件 README §2 命令表](./plugins/speccode/README_CN.md)。

## 三层分支拓扑

```
origin/trunk ── feature/<slug> ──┬── worktree-a(并行施工)
                                 └── worktree-b(并行施工)
spec 文档在所有分支 tracked,随 PR 链路上 trunk
```

完整拓扑与要点见 [插件 README §3](./plugins/speccode/README_CN.md)。

## 和谁比

- **vs [superpowers](https://github.com/obra/superpowers)**:方法论命令自包含移植自 superpowers,并在此基础上多了分支拓扑与对账算法、spec 文档仓内托管、hooks / memory、PR/MR 流程标准化。
- **vs [spec-kit](https://github.com/github/spec-kit)**:spec-kit 是跨 agent 的 CLI 工具链;speccode 是 Claude Code 原生插件,worktree 级并行开发与自动化对账是独门能力。
- **vs 手工约定**:文档放哪、从哪个分支切、PR 谁来开——speccode 把这三类反复纠结的问题固化为默认路径,不靠人脑。

## 理念

测试驱动 · 系统化优于临时发挥 · 降低复杂度 · 证据优于断言 · 不要过度自信(不确定先询问)

## 文档地图

| 文档 | 内容 |
|---|---|
| [插件 README](./plugins/speccode/README_CN.md) | 21 命令详表、三层拓扑、R1-R13 风险、0.1→0.2 迁移(插件设计文档) |
| [CHANGELOG](./CHANGELOG.md) | 版本发布记录(Keep a Changelog,全中文) |
| [CLAUDE.md](./CLAUDE.md) | 开发文档:引擎三层架构、测试约定、speccode 工作流 |

## 贡献

本仓库由 speccode 自托管开发——spec 变更走 `speccode/changes/` 工作流,贡献即走同一条 workflow(exploring → creating-feature → … → finishing-feature)。欢迎用 speccode 给 speccode 提 PR。

## License

MIT,见 [LICENSE](./LICENSE)。
