---
name: "SpecCode: Archiving"
description: "归档本次需求变更:speccode/changes/<slug>/ 移入 speccode/archive/<YYYY-MM-DD>-<slug>/,落盘即提交"
category: Workflow
tags: [speccode, workflow, archive]
---

把已完成的需求变更归档。全程中文交互。**应在开发分支(`<type>/<slug>`、非 trunk)上运行**(syncing 之后、finishing-worktree 之前)。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. **trunk 防护**:`git rev-parse --abbrev-ref HEAD` 必须为非 trunk 的 `<type>/<slug>` 形态分支;否则退出并提示「请在开发分支上运行本命令」(防止直提 trunk)。
3. 确定 slug:默认取当前 worktree 所属 feature 的 slug 段;用户也可在命令参数中显式指定。`speccode/changes/<slug>/` 不存在 → 报错退出。
4. **读记忆**:运行 `speccode.mjs read-memory --cwd . --branch <F>`;返回非 null 时把 memory 内容作为既有上下文参考,再继续。

## 归档前检查(警告不硬阻断)

1. **任务完成检查**:读 `speccode/changes/<slug>/propose/tasks.md`(及 plan/ 下计划,若存在),统计 `- [ ]` 未完成任务数。
   - 有未完成 → 展示数量并询问是否继续归档;用户确认才继续。
   - 无 tasks.md → 跳过该检查。
2. **sync 状态评估**:对照 `changes/<slug>/propose/specs/` 的 delta 与 `speccode/spec/` 主规格,判断是否还有未合并的变更(逐 capability:ADDED 是否都在、MODIFIED 是否已应用、REMOVED 是否已删、RENAMED 是否已改名)。
   - 有未合并 → 展示差异摘要,用 AskUserQuestion 提供:「先 syncing(推荐) / 不归档 / 仍然归档」。
     - 先 syncing → 按 `/speccode:syncing` 的流程**同步执行**(不后台化——移动目录会抽掉 syncing 正在读的文件),完成后 MUST 重新逐 capability 复验全部 delta(不只是 syncing 报告触碰的那些);复验不一致 → 报告并停止,不归档。
     - 不归档 → 退出。
     - 仍然归档 → 继续。
   - 已全部合并 → 直接进入移动。

## 执行归档

1. `mkdir -p speccode/archive`。
2. 目标名:目录名已以 `YYYY-MM-DD-` 开头 → 原样使用;否则加当天日期前缀 `YYYY-MM-DD-<slug>`。**绝不叠加第二个日期。**
3. **目标已存在检查**:`speccode/archive/<目标名>/` 已存在 → 报错退出,并给出可行动建议(改用 `<slug>-round2` 类目录名 / 次日归档 / 手动合并目录)。MUST NOT 覆盖。
4. `mv speccode/changes/<slug> speccode/archive/<目标名>`。

## 落盘即提交(必须)

```bash
git add speccode/changes/<slug> speccode/archive/
git commit -m "docs(speccode): archive <slug>"
```

(`git add` 同时写两个路径,让 git 记录为移动。)

commit 成功后触发 onArchived 钩子:

```bash
echo '{"command":"archiving","feature_branch":"<F>","worktree_branch":"<W>"}' | speccode.mjs run-hook --cwd . --event onArchived
```

输出 `hook.ok=false` 或含 `warning` 时打印警告(含事件名与错误摘要),MUST NOT 阻断主流程。

**写记忆**:把本命令产出的决策/进度摘要(归档路径、sync 状态,经用户确认或按本命令内置判据)追加到本 feature 的 memory。用 heredoc 经 stdin 传 JSON(不用 `echo '<json>'`:zsh 会把 `\n` 解释成字面换行,摘要含单引号也会破壳):

```bash
speccode.mjs write-memory --cwd . --branch <F> --json-stdin <<'EOF'
{"mode":"append","content":"<摘要>"}
EOF
```

**长会话主动记忆**:在以下时机 MUST 主动执行 write-memory(append),不等命令出入口:①一个开发阶段/任务完成且距上次写入已隔多个阶段;②会话上下文显著增长(接近 compact 风险);③compact 恢复后继续工作的首个阶段完成时。写入内容 MUST 是关键决策/进度/待办的摘要,并经用户确认或遵循本命令内置判据。

## 输出摘要

展示:归档的需求、归档目标路径、sync 状态(已同步 / 用户选择跳过 / 无 delta)、警告(未完成任务数等)。

## 下一步引导

- 归档完成并提交后,引导用户执行 `/speccode:finishing-worktree` 合并本 worktree 成果回功能分支。

## 护栏

- 警告(未完成任务、未 sync)只提示与确认,不硬阻断;目标已存在是唯一的硬错误。
- 日期前缀不叠加;已存在不覆盖。
- 归档在当前 worktree 分支上提交,文档随既有 PR 链路上 trunk;绝不直提 trunk。
