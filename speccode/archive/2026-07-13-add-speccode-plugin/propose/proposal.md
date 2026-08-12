## Why

在多需求并行开发场景下,团队在分支策略、spec 工具(OpenSpec、Superpowers)文档的归属与同步、PR/MR 流程的标准化上长期依赖人工约定,容易出现"spec 文档被错误推到主干"、"display 分支 reset 时误删历史文档"、"worktree 合并历史混乱"等问题。speccode 插件把这些约定固化为可执行的 Claude Code slash 命令,让 AI 模型在执行每一步时都有明确的语义边界和文件级兜底。

## What Changes

- 新增 10 个 `/speccode:*` slash 命令:`init`、`start`、`develop-start`、`develop-complete`、`finish`、`status`、`display-merge-trunk`、`display-rebase-trunk`、`display-reset-to-trunk`、`reset`
- 引入 `.speccode/` 配置目录,包含静态全局配置 (`config.json`)、按 feature 维度的活跃状态文件 (`state/features/<type>__<slug>.json`)、本地文档备份区 (`backup/`)
- 实现"对账算法":每次涉及 worktree 的命令(`develop-start` / `develop-complete` / `finish` / `status`)开头扫描 `git worktree list` 与 `state/features/`,自动补齐/标记不一致的工作分支,并把 `pr_open` 的 worktree 推进为 `completed`
- 实现 `wait_for_pr_merge` 共享原语:每 30 秒轮询 PR/MR 状态,默认 30 分钟超时;超时/中断时把挂起状态写入 feature 的 `pending_operation` 字段,供 `--resume` 续跑
- 实现"文档剥离四步走":在 `display-reset-to-trunk` 中,先备份到 `.speccode/backup/`,再 `git rm -r --cached` 提交 untrack,然后 `git reset --hard`,最后重新 `git add` 恢复 tracked —— 杜绝 reset 误删文档
- 实现 finish 阶段的 `git commit --amend` 折叠剥离动作,保证 trunk 上的功能提交是"单一语义 commit";finish 的两个 PR(→display、→trunk)都阻塞等合并,trunk PR 合并后自动回收 `<feature>-complete` 临时分支
- 统一 spec 文档在 feature 分支上为 tracked(无论从 display 还是 trunk 切),保证无 display 模式下文档也能随 feature 分支在 git 中留存
- 探测 GitHub / GitLab remote,自动选择 `gh` / `glab` CLI,无 CLI 时降级为"打印等效命令"

## Capabilities

### New Capabilities

- `git-workflow-lifecycle`: speccode 10 个命令的端到端工作流,包括 init 配置、feature/worktree 创建、squash 合并、状态总览、display 同步、trunk 收尾
- `speccode-config-management`: `.speccode/config.json` 与 `state/features/*.json` 的读写策略、备份机制、字段级幂等、对账算法、`pending_operation` 挂起状态、slug 命名与文件名规则
- `spec-docs-tracking-control`: OpenSpec / Superpowers 文档目录在 display 跟踪、在 trunk 不跟踪的语义实现,包括 `git rm --cached`、amend 折叠、本地备份兜底
- `pr-tool-integration`: gh / glab CLI 的探测与封装,PR/MR 创建、状态查询、阻塞等合并

### Modified Capabilities

<!-- 当前仓库无现有 spec,此节留空 -->

## Impact

- **新增文件**:`.claude/commands/speccode/` 下 10 个命令定义文件(每个命令一个 `.md`),可能还需要配套的 `references/` 文档或脚本
- **新增目录**:`.speccode/` 及其子目录(`state/features/`、`backup/`)—— 这些目录是 untracked 状态,不会被 git 跟踪;worktree 目录默认放 `.claude/worktrees/<branch>`
- **依赖**:外部依赖 `gh` CLI(GitHub)或 `glab` CLI(GitLab),init 时探测并写入 `config.json`
- **命令入口**:通过 `.claude/commands/speccode/` 暴露,与现有 `.claude/commands/opsx/` 命名空间并列
- **平台差异**:Windows / macOS / Linux 路径处理差异需在实现时统一;当前设计以 macOS / Linux 为主
- **风险**(完整登记与缓解见 design.md 的 Risks 段 R1-R10):
  - R1: `git commit --amend` 改写 commit hash,可能触发 PR review 工具的 force-push 警告
  - R2: ancestor 判定在 cherry-pick 跨 feature 场景下会误判,`worktree_overrides` 显式覆盖兜底
  - R3: init 逐字段幂等时,用户可能误改 trunk/display 字段,需显示 `[旧值]→[新值]` diff
  - R4: `.speccode/` 不在 `.gitignore`,`git clean -fdx` 会丢配置 —— 文档化警告,不在命令层面强制保护
  - R9: `pr_open` 的 worktree 依赖对账推进,若用户在 PR 合并后从不再跑任何 speccode 命令,状态不会自动更新(`status` / `finish` 会触发推进)
  - R10: finish 两个 PR 串行阻塞,总耗时可能较长;超时由 `pending_operation` + `--resume` 兜底
