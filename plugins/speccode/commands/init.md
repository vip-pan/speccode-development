---
name: "SpecCode: Init"
description: "初始化/更新 speccode 开发环境:探测远端、主干、代码智能工具,配置 worktree 目录与 hooks,写 .speccode/config.json(config v3)"
category: Workflow
tags: [speccode, workflow, init]
---

初始化或更新 speccode 配置。全程用中文与用户交互。

## 前置

运行 `speccode.mjs resolve-speccode-dir --cwd .` 获取 `speccodeDir`。
运行 `speccode.mjs read-config --cwd .` 判断是否已初始化:
- `config` 为 null → 全新 init(走"全新流程")
- `config` 非 null → 二次 init(走"幂等流程")

## 全新流程

1. **探测远端与 pr_tool**:运行 `speccode.mjs detect-remote --cwd .`,得到 `prToolGuess` 与 `installed`。
   - 若 `installed=false` 且 `prToolGuess≠none`:告知用户"探测到应使用 <tool>,但未检测到该 CLI",询问是否降级为 `none`。
   - 用 AskUserQuestion 确认最终 `pr_tool`(gh / glab / none)。
2. **探测主干分支**:运行 `git symbolic-ref refs/remotes/origin/HEAD`(失败则回退询问);默认填 `trunk`,请用户确认。
3. **询问 worktree_dir**:worktree 存放的基础目录,默认 `.claude/worktrees`,请用户确认或自定义(相对项目根的路径)。
4. **探测代码智能工具**:运行 `speccode.mjs detect-code-intel-tools --cwd .`。
   - 对返回的每个 `{id, available: {value, evidence}, integrated: {value, evidence}}`:
     - 仅当 `available.value && integrated.value` 时才登记该工具,展示「探测到 <id>(可用: <available.evidence>, 已集成: <integrated.evidence>),是否登记?」经确认写入。
     - `available.value === true && integrated.value === false`(可用但项目未集成)→ 展示为「<id> 本机可用但本项目未集成」,MUST NOT 登记,不询问登记。
     - `integrated.value === true && available.value === false`(项目有集成痕迹但工具不可用)→ 展示告警,不登记。
     - `available.value === false && integrated.value === false`(两者皆 false,常态)→ 不展示、不询问、不登记(静默跳过)。
   - 一个都未确认则写 `"code_intel_tools": []`。
5. **询问 hooks(可选)**:告知用户可在 SDD 各节点挂 shell 命令(如 IM 通知),事件名固定 14 个:onExplored / onFeatureCreated / onWorktreeCreated / onProposed / onBrainstormed / onPlanned / onTaskCompleted / onCodeReviewRequested / onCodeReviewCompleted / onWorktreeFinished / onFeatureFinished / onPrOpened / onSynced / onArchived。
   - 用户选择配置 → 逐项询问「事件名 + shell 命令」,组装为 `hooks` 对象。
   - 用户跳过 → **不写入 `hooks` 字段**(缺失即无 hook)。
6. **组装 config v3** 并通过 `echo '<json>' | speccode.mjs write-config --cwd . --json-stdin` 写入:
   - `version: 3`、`initialized_at`(ISO 8601 UTC)、`trunk`、`remote`、`pr_tool`、`worktree_dir`、`code_intel_tools`;`hooks` 仅在用户配置时存在。
   - **不得**包含任何 v1 遗留字段与 v2 的 `worktree_prefix`。
7. **state 迁移(检测到 `state/features/` 时)**:展示迁移预览(逐文件 v2→v3 转换说明;`worktrees` 多于一条的文件将跳过并报告「请先按 v2 流程收尾」),经用户确认后运行 `echo '{}' | speccode.mjs migrate-state --cwd . --json-stdin`(该 verb 收 `--json-stdin` 但不消费 payload,stdin `{}` 即可——通道一致性同其他写 verb),随后跑 `reconcile` 验证 migrated 结果;拒绝 → `state/features/` 保持 v2 原样(v2 流程继续可用;config 此时已为 v3,双格式运行——v2 state 文件按 v2 语义原样读写)。
8. **squash 探测**:init 完成 config 写入后运行 `speccode.mjs repo-merge-config --cwd .`;`squashOnly:false` → 打印警告「建议在仓库设置启用 squash-only 合并」+ 设置指引(不阻断);`config:null`(glab/none/失败)→ 静默跳过。
9. 打印 config 摘要 + 下一步指引(`/speccode:exploring` 探索需求,或直接 `/speccode:creating-worktree`)。

## 幂等流程(二次 init)

1. 备份现有 config(`backup-config` verb → `config.json.bak.<timestamp>`)。
2. 重新走全新流程的探测,得到"新值候选"。
3. 用 `diffFields` 逐字段比较旧/新:
   - 值未变 → 跳过。
   - 值变化 → 用 AskUserQuestion 展示 `[旧值] → [新值]`,询问"保持 / 改用新值 / 清除"。
   - 对 config 中已登记、但本次探测判定为 `integrated.value === false` 的工具,在 diff 中标记「建议移除」(项目未集成),经用户确认后才移除——绝不静默删除。
   - 旧 config 含 v2 遗留的 `worktree_prefix` → 在 diff 中标记「移除」(v3 不再使用;既有 v1→v2 升级同款机制:经用户确认后才移除,绝不静默删除)。
4. **v1/v2 → v3 迁移**:若旧 config `version` 低于 3:
   - `version` 为 1(或无 version)时,`display` / `spec_tools` / `untracked_permanent` 三字段标记为「移除」列入 diff;
   - 若用户接受升级(`version: 3`),遗留字段(v1 三字段与 v2 的 `worktree_prefix`)MUST 被移除,不存在混合态;
   - 若用户拒绝对 config 的任何修改 → 保持原版本原样,整体不写入。
5. `state/` 目录 MUST 不动(不读、不改、不删);唯一例外:检测到 v2 遗留 `state/features/` 时,按「全新流程」第 7 步的「state 迁移」提供一次性迁移(经用户确认,拒绝 → `state/features/` 保持 v2 原样)。
6. 用 `write-config --json-stdin` 写回;随后同全新流程第 8 步跑 `repo-merge-config` squash 探测,打印摘要。

## 约束
- 全程不修改 `.gitignore`,不删除任何本地文件。
- 写 config 一律通过 `write-config --json-stdin` verb(内部原子写),不由 AI 手写文件。
- 探测类结果(代码智能工具、pr_tool 猜测)一律经用户确认后才落盘——不确定就先询问,不猜测。
