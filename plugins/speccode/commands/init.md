---
name: "SpecCode: Init"
description: "初始化/更新 speccode 开发环境:探测远端、主干、知识库工具,配置 worktree 目录与 hooks,写 .speccode/config.json(config v2)"
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
3. **确认 worktree_prefix**:默认 `worktree-`,请用户确认(一般直接采用默认)。
4. **询问 worktree_dir**:worktree 存放的基础目录,默认 `.claude/worktrees`,请用户确认或自定义(相对项目根的路径)。
5. **探测知识库工具**:运行 `speccode.mjs detect-knowledge-tools --cwd .`。
   - 对返回的每个 `{id, kind, evidence}`,用 AskUserQuestion 逐项展示("探测到 <id>(<kind>: <evidence>),是否登记?")并询问是否登记进 `knowledge_tools`。
   - 仅被用户确认的项写入;一个都未确认则写 `"knowledge_tools": []`。
6. **询问 hooks(可选)**:告知用户可在 SDD 各节点挂 shell 命令(如 IM 通知),事件名固定 14 个:onExplored / onFeatureCreated / onWorktreeCreated / onProposed / onBrainstormed / onPlanned / onTaskCompleted / onCodeReviewRequested / onCodeReviewCompleted / onWorktreeFinished / onFeatureFinished / onPrOpened / onSynced / onArchived。
   - 用户选择配置 → 逐项询问「事件名 + shell 命令」,组装为 `hooks` 对象。
   - 用户跳过 → **不写入 `hooks` 字段**(缺失即无 hook)。
7. **组装 config v2** 并通过 `echo '<json>' | speccode.mjs write-config --cwd . --json-stdin` 写入:
   - `version: 2`、`initialized_at`(ISO 8601 UTC)、`trunk`、`remote`、`pr_tool`、`worktree_prefix`、`worktree_dir`、`knowledge_tools`;`hooks` 仅在用户配置时存在。
   - **不得**包含任何 v1 遗留字段。
8. 打印 config 摘要 + 下一步指引(`/speccode:exploring` 探索需求,或直接 `/speccode:creating-feature`)。

## 幂等流程(二次 init)

1. 备份现有 config(`backup-config` verb → `config.json.bak.<timestamp>`)。
2. 重新走全新流程的探测,得到"新值候选"。
3. 用 `diffFields` 逐字段比较旧/新:
   - 值未变 → 跳过。
   - 值变化 → 用 AskUserQuestion 展示 `[旧值] → [新值]`,询问"保持 / 改用新值 / 清除"。
4. **v1 → v2 迁移**:若旧 config `version` 为 1(或无 version):
   - `display` / `spec_tools` / `untracked_permanent` 三字段标记为「移除」列入 diff;
   - 若用户接受升级(`version: 2`),三字段 MUST 被移除,不存在混合态;
   - 若用户拒绝对 config 的任何修改 → 保持 v1 原样,整体不写入。
5. `state/` 目录 MUST 不动(不读、不改、不删)。
6. 用 `write-config --json-stdin` 写回,打印摘要。

## 约束
- 全程不修改 `.gitignore`,不删除任何本地文件。
- 写 config 一律通过 `write-config --json-stdin` verb(内部原子写),不由 AI 手写文件。
- 探测类结果(知识工具、pr_tool 猜测)一律经用户确认后才落盘——不确定就先询问,不猜测。
