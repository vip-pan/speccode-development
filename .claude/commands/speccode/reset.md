---
name: "SpecCode: Reset"
description: "重置 speccode 开发环境:清 state 与 worktree,按字段询问是否清理 config(拒绝有 active feature)"
category: Workflow
tags: [speccode, workflow, reset]
---

重置 speccode 环境。全程中文。不接受 `--force`。

## 前置

1. `resolve-speccode-dir` 得 speccodeDir。
2. 扫描 `state/features/*.json`:**任何文件存在** → 报错"检测到 active feature,请先 /speccode:finish 完成所有功能",退出。

## 逐字段询问清理

用 AskUserQuestion 逐个询问是否清理(是则清空该字段,否则保留):
- `trunk` / `remote` / `display` / `pr_tool` / `spec_tools.*`(逐工具)/ `untracked_permanent`。
- 提示:清空 `trunk` 后 `/speccode:start` 将无法执行,需重编辑 config 或重新 init。

## 执行

1. 备份:`backupConfig`(config.json.bak.<timestamp>)。
2. 清理 worktree:`git worktree list --porcelain` 过滤 `worktree-` 前缀 → 逐个 `git worktree remove <path> --force` + `git branch -D <branch>`。
3. `rm -rf .speccode/state/`。
4. 用 `write-config --json-stdin` 写回 config(仅保留用户确认保留的字段)。
5. 打印:reset 完成,保留字段列表;可 `/speccode:init` 重建或直接 `/speccode:start`。
