---
name: "SpecCode: Proposing"
description: "把探索结论落地为 proposal/design/specs/tasks 四类文档(speccode/changes/<slug>/propose/),落盘即提交"
category: Workflow
tags: [speccode, workflow, propose, specs]
---

根据 exploring 的结论,通过提问完善粗略想法、探索需求漏洞,把需求落地为结构化文档。全程中文交互。**应在 worktree-* 分支上运行**(`git rev-parse --abbrev-ref HEAD` 校验,且该 worktree 必须能归属到某个 active feature)。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. 运行 `speccode.mjs reconcile --cwd . --advance-pr`,用返回的 features 找到当前 worktree 所属的功能分支 F;找不到 → 报错"当前 worktree 无法关联任何 active feature",退出。
3. 计算 slug = F 的 slug 段(`feature/payment-api` → `payment-api`)。
4. **冲突检查**:若 `speccode/changes/<slug>/` 已存在且未归档 → 用 AskUserQuestion 询问:「续写补充 / 先 archiving 再重建 / 取消」。取消 → 退出;先归档 → 引导用户先执行 `/speccode:archiving` 后重跑本命令;续写 → 在既有内容上增量修改。
5. **知识库工具咨询**:若 `knowledge_tools` 非空且其能力在会话中可用,参考代码时优先使用;不可用回退 Grep/Glob/Read,不报错。
6. **读记忆**:运行 `speccode.mjs read-memory --cwd . --branch <F>`;返回非 null 时把 memory 内容作为既有上下文参考,再继续。

## 需求澄清(提问环节)

在写文档前,先把探索结论对齐成可落地的需求:
- 从会话上下文集锦 exploring 结论;上下文不足时,一次一个问题地询问(目的、约束、成功标准),优先选择题。
- 主动探索需求漏洞:边界场景、错误处理、与既有功能的交互。
- **复杂度评估**:若需求跨多模块、存在多种可行方案、或有明显不确定性 → 告知用户"复杂度较高,建议先用 `/speccode:brainstorming` 精化设计",由用户决定先脑暴还是继续直接写文档。

## 生成四类文档

在 `speccode/changes/<slug>/propose/` 下生成(目录不存在则创建):

1. **proposal.md** — Why(1-2 句问题/机会)/ What Changes(具体改动点列表,BREAKING 标注)/ Capabilities(新增或修改的能力清单,kebab-case)/ Impact(受影响的代码、系统)。
2. **design.md** — Context(现状与约束)/ Goals / Non-Goals / Decisions(关键技术选择,含被否备选与理由)/ Risks(风险 → 缓解)/ Open Questions(可无)。内容简单时允许精简,但 Decisions 不得为空壳。
3. **specs/\<capability\>/spec.md** — 每个受影响能力一个 delta 文件,四段式:
   - `## ADDED Requirements` / `## MODIFIED Requirements` / `## REMOVED Requirements` / `## RENAMED Requirements`(FROM:/TO: 格式)
   - 每条 requirement:`### Requirement: <名称>` + 含 SHALL/MUST 的正文 + 至少一个 `#### Scenario:`(WHEN/THEN 可验证)
   - MODIFIED/REMOVED 的名称必须与既有主规格(`speccode/spec/<capability>/spec.md`,若存在)逐字一致
   - 新增 capability(主规格尚不存在)的 delta SHOULD 带 `## Purpose` 段,供 syncing 播种新建主规格;修改既有 capability 的 delta 不带。
4. **tasks.md** — 实现步骤清单,`- [ ]` 复选框,按依赖排序分组。

每写完一个文件展示一行进度("已创建 proposal.md")。全部写完后展示摘要:需求目录路径、四类文档清单、复杂度评估结论。

## 落盘即提交(必须)

文档生成完成后 MUST 立即:
```bash
git add speccode/changes/<slug>/
git commit -m "docs(speccode): propose <slug>"
```

commit 成功后触发 onProposed 钩子:

```bash
echo '{"command":"proposing","feature_branch":"<F>","worktree_branch":"<W>"}' | speccode.mjs run-hook --cwd . --event onProposed
```

输出 `hook.ok=false` 或含 `warning` 时打印警告(含事件名与错误摘要),MUST NOT 阻断主流程。

**写记忆**:把本命令产出的决策/进度摘要(经用户确认或按本命令内置判据)追加到本 feature 的 memory。用 heredoc 经 stdin 传 JSON(不用 `echo '<json>'`:zsh 会把 `\n` 解释成字面换行,摘要含单引号也会破壳):

```bash
speccode.mjs write-memory --cwd . --branch <F> --json-stdin <<'EOF'
{"mode":"append","content":"<摘要>"}
EOF
```

**长会话主动记忆**:在以下时机 MUST 主动执行 write-memory(append),不等命令出入口:①一个开发阶段/任务完成且距上次写入已隔多个阶段;②会话上下文显著增长(接近 compact 风险);③compact 恢复后继续工作的首个阶段完成时。写入内容 MUST 是关键决策/进度/待办的摘要,并经用户确认或遵循本命令内置判据。

## 下一步引导

- 复杂度高的需求:建议 `/speccode:brainstorming` 精化设计(会回写本目录文档保持一致)。
- 复杂度可控:建议 `/speccode:writing-plans` 直接编写实现计划。

## 护栏

- 文档是 delta 不是主规格;不直接改 `speccode/spec/`(那是 syncing 的职责)。
- 提问优先选择题;一次一个问题;不确定就先问,不盲目猜测。
- 冲突检查未过不写文档;落盘必提交,不把未提交的文档留给下一命令。
