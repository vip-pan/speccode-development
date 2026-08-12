---
name: "SpecCode: Creating Worktree"
description: "从功能分支切出 worktree 开发分支(git worktree),登记 state"
category: Workflow
tags: [speccode, workflow, worktree]
---

创建开发用的 worktree 分支。全程中文交互。

## 前置

1. `read-config` 加载 config。
2. HEAD 必须在功能分支(`feature/` `bugfix/` `refactor/` `chore/` 之一);否则提示退出。
3. 运行 `speccode.mjs reconcile --cwd . --advance-pr`(带 `--advance-pr`,与 finishing-worktree/finishing-feature/status 一致,顺带推进已合并的 pr_open):
   - `conflicts` 非空 → 报告冲突,提示用户用 `worktree_overrides` 手动指定后退出。
   - `orphans` 非空 → 告知用户,但不阻断创建。

## 决定 worktree 名

1. 默认名:`worktree-` + 功能分支 slug 段(`feature/payment` → `worktree-payment`)。
2. 用 AskUserQuestion 让用户确认或改名(可加后缀区分多 worktree,如 `worktree-payment-api`)。
3. **校验**:必须以 `worktree-`(config.worktree_prefix)开头;否则拒绝重输。

## 创建

1. **解析 worktree 目录**:运行 `speccode.mjs resolve-worktree-dir --cwd .`。
   - `source="config"` → 用返回的 `dir`。
   - `source="default"`(config 缺少 worktree_dir 键,含被用户手动删除)→ 用 AskUserQuestion 询问 worktree 存放目录(默认 `.claude/worktrees`),然后经 `write-config --json-stdin` 把 `worktree_dir` 写回 config(读当前 config → 加字段 → 整体写回),再继续。
2. **gitignore 校验(warn-only)**:`git check-ignore -q <dir>`。
   - 未被忽略(退出码非 0,即该目录会被 git 跟踪)→ 警告"worktree 目录 <dir> 未被 .gitignore 忽略,worktree 元数据可能进入 git;建议先加入 .gitignore",询问用户是否继续。
   - 已被忽略 → 静默继续。
3. `git worktree add <dir>/<branch> -b <branch> <feature>`。
4. **项目 setup**:在 `<dir>/<branch>` 下按标记文件执行(存在多个时按序执行,均不存在则跳过并说明):
   - `package.json` → `npm install`
   - `Cargo.toml` → `cargo build`
   - `requirements.txt` → `pip install -r requirements.txt`
   - `pyproject.toml` → `poetry install`
   - `go.mod` → `go mod download`
5. **基线测试**:在新 worktree 内运行项目测试命令(同 finishing-worktree 的探测:`package.json`→`npm test`、`Cargo.toml`→`cargo test`、`requirements.txt`/`pyproject.toml`→`pytest`、`go.mod`→`go test ./...`;均无 → 询问用户测试命令或明确跳过)。
   - 失败 → 展示失败摘要,询问「继续开发还是先行调查」,不擅自继续。
6. 更新 state:读当前 state(由 reconcile 返回或 read),把 `worktrees[<branch>] = { status: "in_progress" }` 后用 `write-state --branch <feature> --json-stdin` 原子写回。
7. 触发 onWorktreeCreated 钩子:
   ```bash
   echo '{"command":"creating-worktree","feature_branch":"<feature>","worktree_branch":"<branch>"}' | speccode.mjs run-hook --cwd . --event onWorktreeCreated
   ```
   输出 `hook.ok=false` 或含 `warning` 时打印警告(含事件名与错误摘要),MUST NOT 阻断主流程。
8. 打印:worktree 已创建于 `<dir>/<branch>`,请 `cd` 过去开发。

## 完成后引导

- 手动模式:用 AskUserQuestion 询问是否执行 `/speccode:proposing` 把 exploring 结论落地为文档。
- **auto 模式**(当前会话处于 Claude Code 自动接受/bypass、Codex auto 等自主执行模式):自动衔接执行 `/speccode:proposing`。判断依据不充分时 MUST 默认询问而非自动衔接。
- 用户暂不落地文档 → 提示:开发完成后,若有落地文档先 `/speccode:syncing` → `/speccode:archiving` 再 `/speccode:finishing-worktree`;否则直接 `/speccode:finishing-worktree`。
