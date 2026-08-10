# Changelog

本文件记录 speccode 插件的所有重要变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/),版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

纪律:bump `plugin.json` version 的提交必须同步更新本文件对应版本小节(见 `speccode/spec/plugin-packaging/spec.md`「版本发布纪律」)。

## [0.2.0] - 2026-08-09

v2 全量迭代:四层拓扑收敛为三层、SDD 方法论与文档生命周期命令自包含内置、新增 hooks 与 memory 机制。含多项 BREAKING 变更,0.1 用户请按 `plugins/speccode/README.md`「从 0.1 迁移」节升级。

### ⚠ BREAKING

- **三层拓扑收敛**:删除 display 分支与 `<feature>-complete` 临时分支;`display-merge-trunk` / `display-rebase-trunk` / `display-reset-to-trunk` 三个命令下线;`finishing-feature` 简化为单 PR 直通 trunk。
- **docstrip 机制退休**:spec 文档(目标项目 `speccode/` 目录)在包括 trunk 在内的所有分支一律 git tracked;`git rm --cached` 剥离、`commit --amend` 折叠、display-reset 四步走全部移除。
- **4 个命令改名,无别名**:`start`→`creating-feature`、`develop-start`→`creating-worktree`、`develop-complete`→`finishing-worktree`、`finish`→`finishing-feature`。
- **config v2**:删除 `display`、`spec_tools`、`untracked_permanent` 字段;新增 `hooks`、`knowledge_tools`、`worktree_dir`;`version` 升 2,需重新 `/speccode:init` 升级。

### Added

- 新增 14 个命令(总数 10 → 21):文档生命周期 6 个(`exploring` / `proposing` / `brainstorming` / `writing-plans` / `syncing` / `archiving`)+ 执行方法论 8 个(`executing-plans` / `subagent-driven-development` / `dispatching-parallel-agents` / `test-driven-development` / `systematic-debugging` / `requesting-code-review` / `receiving-code-review` / `verification-before-completion`)。superpowers 能力自包含移植,目标项目零外部依赖。
- 目标项目 SDD 文档布局:`speccode/changes/<slug>/{propose,brainstorm,plan}/`、`speccode/spec/`、`speccode/archive/<YYYY-MM-DD>-<slug>/`;所有文档命令「落盘即 commit」。
- hooks(配置驱动事件点):14 个固定生命周期事件,hook 进程经 stdin 收单行 JSON,warn-only 失败语义(30s 超时,`run-hook` 永远 exit 0)。
- memory(feature 级跨会话记忆):主仓 `.speccode/memory/<type>__<slug>.md`,原子写;命令入口读/出口写,内置「超大会话主动书写」判据。
- `init` 探测代码知识库工具(understand-anything / CodeGraph / Graphify / CodeMap / LightRAG)并逐项确认登记;新增 `worktree_dir` 询问与写回。
- `creating-worktree` 融合 using-git-worktrees:worktree 目录可配置、`git check-ignore` 校验、新项目依赖 setup、基线测试、完成后引导 `proposing`。
- `finishing-worktree` 融合 finishing-a-development-branch:合并前跑全量测试、四选菜单(PR 等待 / PR 不等待 / 本地 squash / 保留)、丢弃需逐字输入 `discard`。
- 引擎新增 9 个 verb:`run-hook` / `read-memory` / `write-memory` / `detect-knowledge-tools` / `resolve-worktree-dir` / `query-pr` / `sdd-workspace` / `task-brief` / `review-package`;PR 状态查询支持 CONFLICTING 五态。

### Changed

- PR 等待从阻塞式 `wait_for_pr_merge` 改为 `query-pr` 单次查询 + 命令层轮询(30s / 30min,超时写 `pending_operation` 供 `--resume` 续跑)。
- 写 verb 强制 `--json-stdin`(从 stdin 读 JSON,缺 flag 返回 `{ok:false}`)。
- `reconcile` 的 worktree 前缀改读 `config.worktree_prefix`(带 `'worktree-'` 兜底)。
- `plugin.json` keywords 扩充(`sdd` / `tdd` / `hooks` / `memory` 等)。

### Removed

- 删除 `lib/docstrip.mjs`、`lib/waitmerge.mjs` 及对应测试。
- 移除 `spec-docs-tracking-control` capability(其「文档永远 tracked」语义并入 `sdd-document-lifecycle`)。

## [0.1.0] - 2026-07-14

首个可用版本:多需求并行开发 + spec 文档托管 + PR/MR 流程标准化的 10 命令工作流。

### Added

- 10 个 `/speccode:*` slash 命令:`init`、`start`、`develop-start`、`develop-complete`、`finish`、`status`、`display-merge-trunk`、`display-rebase-trunk`、`display-reset-to-trunk`、`reset`。
- trunk / display / feature / worktree 四层分支拓扑;spec 文档在 display 与 feature 分支 tracked、在 trunk 不跟踪。
- `.speccode/` 配置目录:`config.json` 静态全局配置、`state/features/<type>__<slug>.json` 按 feature 状态文件、`backup/` 本地文档备份区。
- 对账算法:涉及 worktree 的命令入口扫描 `git worktree list` ↔ `state/features/`,自动补齐/标记不一致,并把 `pr_open` 推进为 `completed`。
- `wait_for_pr_merge` 共享原语:30s 轮询 PR/MR,30min 超时;超时/中断写 `pending_operation` 供 `--resume` 续跑。
- 「文档剥离四步走」与 finish 阶段 `commit --amend` 折叠:保证 trunk 上功能提交为单一语义 commit,display reset 不误删文档。
- GitHub / GitLab remote 探测,自动选择 `gh` / `glab` CLI,无 CLI 时降级为打印等效命令。

[0.2.0]: https://github.com/vip-pan/speccode-development/compare/99797ad...v0.2.0
[0.1.0]: https://github.com/vip-pan/speccode-development/commit/99797ad
