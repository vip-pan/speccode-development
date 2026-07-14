---
name: "SpecCode: Init"
description: "初始化 speccode 开发环境:探测远端、主干、标的分支、spec 工具,写 .speccode/config.json"
category: Workflow
tags: [speccode, workflow, init]
---

初始化或更新 speccode 配置。全程用中文与用户交互。

## 前置

运行 `node .claude/speccode/bin/speccode.mjs resolve-speccode-dir --cwd .` 获取 `speccodeDir`。
运行 `node .claude/speccode/bin/speccode.mjs read-config --cwd .` 判断是否已初始化:
- `config` 为 null → 全新 init(走"全新流程")
- `config` 非 null → 二次 init(走"幂等流程")

## 全新流程

1. **探测远端与 pr_tool**:运行 `speccode.mjs detect-remote --cwd .`,得到 `prToolGuess` 与 `installed`。
   - 若 `installed=false` 且 `prToolGuess≠none`:告知用户"探测到应使用 <tool>,但未检测到该 CLI",询问是否降级为 `none`。
   - 用 AskUserQuestion 确认最终 `pr_tool`(gh / glab / none)。
2. **探测主干分支**:运行 `git symbolic-ref refs/remotes/origin/HEAD`(失败则回退询问);默认填 `trunk`,请用户确认。
3. **询问标的分支**:是否需要 display?
   - 否 → `display = { enabled: false, branch: null }`。
   - 是 → 询问分支名(默认 `display`)。按 spec `display 分支的四态`处理:
     - 远端已存在且已关联 → `git fetch` + `git checkout <d>` + `git pull`。
     - 远端已存在未关联 → checkout + 合并主干。
     - 不存在 → 从主干 `git checkout -b <d>` + `git push -u origin <d>`。
4. **询问 spec 工具**:多选 openspec / superpowers;每个启用项询问 `doc_dir`(默认 openspec→`openspec`,superpowers→`docs/superpowers`)。
5. **询问 untracked_permanent**:展示默认集合 `.claude .agent .opencode .speccode CLAUDE.md AGENTS.md`,允许增删。
6. **组装 config** 并写入:字段含 `version:1`、`initialized_at`(用 `speccode.mjs` 无此 verb 时可让 AI 生成 ISO 时间,或直接由用户确认后写)、`trunk`、`remote`、`display`、`pr_tool`、`spec_tools`、`untracked_permanent`、`worktree_prefix:"worktree-"`。
   - 把组装好的 config JSON 通过 `echo '<json>' | node .claude/speccode/bin/speccode.mjs write-config --cwd . --json-stdin` 写入(该 verb 内部用 `saveConfig` 原子写到 `<root>/.speccode/config.json`,自动满足"临时文件 + mv")。
7. 打印 config 摘要 + 下一步指引(`/speccode:start`)。

## 幂等流程(二次 init)

1. 备份现有 config(`config.json.bak.<timestamp>`)。
2. 重新走全新流程的探测,得到"新值候选"。
3. 用 `diffFields` 逐字段比较旧/新:
   - 值未变 → 跳过。
   - 值变化 → 用 AskUserQuestion 展示 `[旧值] → [新值]`,询问"保持 / 改用新值 / 清除"。
4. `state/` 目录 MUST 不动(不读、不改、不删)。
5. 备份(`backup-config` verb),再用 `write-config --json-stdin` 写回,打印摘要。

## 约束
- 全程不修改 `.gitignore`,不删除任何本地文件。
- 写 config / state 一律通过 CLI 的 `write-config` / `write-state` verb(内部原子写),不由 AI 手写文件。
