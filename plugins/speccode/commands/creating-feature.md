---
name: "SpecCode: Creating Feature"
description: "从主干分支(trunk)切出功能分支并推送,登记 state"
category: Workflow
tags: [speccode, workflow, feature]
---

创建一个新的功能分支。全程中文交互。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. 校验当前 HEAD(`git rev-parse --abbrev-ref HEAD`)必须等于 `config.trunk`;不符 → 提示 `git checkout <trunk>` 后退出。

## 决定分支名

1. **参数直给**:若命令参数中已含 `<type>/<slug>` 形式的完整分支名,直接进入第 4 步校验;通过则采用,不询问、不推断。
2. **topic 选择与 type 推断**:参数未直给时,运行 `speccode.mjs list-memory --cwd .` 取既有探索 topic 清单;非空 → 用 AskUserQuestion 让用户选既有 topic(或新建/跳过),slug 预填所选 topic 名,随后运行 `speccode.mjs read-memory --cwd . --branch _exploring/<topic>` 读所选 topic 文件,从其内容推断 type(新功能 → `feature`;修 bug → `bugfix`;重构 → `refactor`;杂项 → `chore`);清单为空 → 直接进入第 3 步询问。参数直给时,slug 即探索 topic 名(slug=topic 约定),第 4 步按该约定查找承接;type 无推断来源时按第 3 步询问。
3. 用 AskUserQuestion 询问 type 与 slug;有推断结果时将其预置为推荐项——**推断 MUST NOT 静默生效,MUST 经用户确认才落分支名**。
4. **校验 slug**:必须匹配 `^[a-z0-9-]+$`;非法 → 拒绝并提示合法字符集。
   - 组合分支名 `<type>/<slug>`,再次确认恰好一个 `/`。

## 处理已存在

- `git rev-parse --verify <branch>` 命中(本地已存在)→ 询问切过去还是改名。
- `git ls-remote origin <branch>` 命中(远端已存在)→ 询问本地新建追踪还是拉取。

## 创建

1. `git checkout -b <branch>`(从 trunk)。
2. `git push -u origin <branch>`。
3. 写 state:通过 `echo '<json>' | speccode.mjs write-state --cwd . --branch <branch> --json-stdin`,内容含 `feature_branch`、`created_at`(ISO UTC)、`initial_branch`(= config.trunk)、`status:"in_progress"`、`worktrees:{}`。
4. **建立 memory 骨架(承接 exploring 结论)**:按 slug=topic 约定承接——运行 `speccode.mjs rename-memory --cwd . --branch _exploring/<slug> --to <branch> --json-stdin`(stdin 传 `{}`),按返回值分支:
   - `ok:true` → 探索结论已整体承接为该 feature 的 memory 文件;再以 write-memory(mode=append)补一行骨架头 `"- 创建于 <ISO UTC 时间>"`(MUST NOT replace 重写已承接内容);
   - `ok:false` 且 `error` 含 `not found` → 无同名 topic(用户改了 slug、或本就无探索结论):骨架按原方式建立(write-memory mode=replace,内容 `# <branch> 记忆\n- 创建于 <ISO UTC 时间>\n- exploring 结论:无`);
   - `ok:false` 且 `error` 含 `already exists` → 该 feature 已有 memory(重复创建场景):报告用户并跳过承接,仅 append 骨架头,MUST NOT 覆盖、MUST NOT 合并。
   用 heredoc 经 stdin 传 JSON(不用 `echo '<json>'`:zsh 会把 `\n` 解释成字面换行,内容含单引号也会破壳):
   ```bash
   speccode.mjs rename-memory --cwd . --branch _exploring/<slug> --to <branch> --json-stdin <<'EOF'
   {}
   EOF
   ```

5. 触发 onFeatureCreated 钩子:
   ```bash
   echo '{"command":"creating-feature","feature_branch":"<branch>"}' | speccode.mjs run-hook --cwd . --event onFeatureCreated
   ```
   输出 `hook.ok=false` 或含 `warning` 时打印警告(含事件名与错误摘要),MUST NOT 阻断主流程。
6. 打印:已创建 <branch>,下一步 `/speccode:creating-worktree`。

**长会话主动记忆**:在以下时机 MUST 主动执行 write-memory(append),不等命令出入口:①一个开发阶段/任务完成且距上次写入已隔多个阶段;②会话上下文显著增长(接近 compact 风险);③compact 恢复后继续工作的首个阶段完成时。写入内容 MUST 是关键决策/进度/待办的摘要,并经用户确认或遵循本命令内置判据。
