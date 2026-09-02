---
name: "SpecCode: Reset"
description: "重置 speccode 开发环境:清 state 与 worktree,按字段询问是否清理 config(要求无任何 active 分支)"
category: Workflow
tags: [speccode, workflow, reset]
---

重置 speccode 环境。全程中文。不接受 `--force`。

## 前置

1. `resolve-speccode-dir` 得 speccodeDir。
2. 扫描 `state/`(`branches/` 与 `features/`):存在状态 ∉ {completed} 的 state 文件 → 报错"检测到 active 分支,请先 /speccode:finishing-worktree(大需求用 /speccode:finishing-feature)完成并清理",退出;全部为 completed(或无 state)→ 允许,reset 执行时将 state 文件一并清理。

## 逐字段询问清理

用 AskUserQuestion 逐个询问是否清理(是则清空该字段,否则保留):
- `trunk` / `remote` / `pr_tool` / `worktree_dir` / `code_intel_tools` / `hooks`(若存在)。
- 提示:清空 `trunk` 后 `/speccode:creating-feature` 将无法执行,需重编辑 config 或重新 init。
- 若 config 仍含 v1 遗留字段(`display` / `spec_tools` / `untracked_permanent`)→ 一并询问是否移除(建议移除,config v2 已不再使用)。

## 执行

1. 备份:运行 `speccode.mjs backup-config --cwd .`(config.json.bak.<timestamp>)。
2. 清理 worktree:`git worktree list --porcelain` 中,仅处理满足「路径位于 `resolve-worktree-dir` 解析目录之下 或 曾在 state 中登记」的 worktree → 逐个 `git worktree remove <path> --force` + `git branch -D <branch>`;其余(宿主环境自建)原样保留并说明。
3. 询问是否整体清理 `.speccode/memory/`、`.speccode/sdd/` 与 `.speccode/brainstorm/`(visual companion 产物)三个目录(按目录整体粒度,不提供按 feature 挑选;用户确认才 `rm -rf`)。
4. `rm -rf .speccode/state/`。
5. 用 `write-config --json-stdin` 写回 config(仅保留用户确认保留的字段)。
6. 打印:reset 完成,保留字段列表;可 `/speccode:init` 重建或直接 `/speccode:exploring`。
