---
description: "Tier 1 手动执行入口:按 tasks.md 勾选清单逐条实现(无 plan),条目勾选回填 + 簿记 commit,完成后必经 code review"
---

按 `tasks.md` 勾选清单逐条手动实现变更——不走 plan、不派子代理,适用于 proposing 产物已完全覆盖需求的极小型需求(Tier 1)。全程中文交互。**应在开发分支(`<type>/<slug>`、非 trunk)上运行**。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. **trunk 防护**:`git rev-parse --abbrev-ref HEAD` 必须为非 trunk 的 `<type>/<slug>` 形态分支;否则退出并提示「请在开发分支上运行本命令」。
3. 运行 `speccode reconcile --cwd .` 找到所属功能分支 F,计算 slug。
4. **准入检查(唯一准入 = tier 字段为 1 且无 plan)**,逐项过,不过即退出:
   - `speccode/changes/<slug>/propose/proposal.md` 不存在 → 报错「未找到变更文档,请先 `/speccode:proposing`」并退出(零文档直实现不被允许)。
   - 读 proposal.md 的 YAML frontmatter `tier:` 字段;缺失或取值非 `1|2|3` → 报错「tier 字段缺失或非法,请修复(重跑 proposing 定层或手动补字段)」并退出,MUST NOT 按默认层级继续。
   - `tier` 非 1:tier ≥ 2 且 `plan/` 不存在 → 报错「本变更定层为 Tier <N>,请先 `/speccode:writing-plans` 生成计划」并退出;tier 为 3 且 `brainstorm/` 不存在 → 报错并引导 `/speccode:brainstorming`;退出。
   - `speccode/changes/<slug>/plan/` 存在任何计划文件 → 报错「本变更已有 plan,请用 `/speccode:subagent-driven-development`(推荐)或 `/speccode:executing-plans` 执行」并退出。
   - `propose/tasks.md` 不存在 → 报错(tasks.md 是本命令唯一执行清单)并退出。
   - tasks.md 存在但全部条目已勾选 → 报告「清单已完成」,按「完成后」续跑:未做 code review 则补(BASE 从 git log 中首个实现 commit 的 parent 恢复),已 review 则继续写记忆与收尾路由。
5. **记录 BASE**:运行 `git rev-parse HEAD`,把输出记为本次实现的 BASE commit(requesting-code-review 的 base)。
6. **读记忆**:运行 `speccode read-memory --cwd . --branch <F>`;返回非 null 时把 memory 内容作为既有上下文参考。

## 知识库入口

1. 运行 `speccode read-knowledge --cwd . --index` 读 `_index.md`(恒读,便宜);`exists:false` → 静默跳过本节。
2. 判断本任务相关主题 → `speccode read-knowledge --cwd . --topic <名称>` 读对应 topic 文件;`exists:false` → 静默跳过该主题。
3. 读取失败或目录不存在 → 静默跳过,绝不阻断主流程(T0 兜底,永不报错)。

## 逐条实现

对 tasks.md 勾选清单的每一条未勾选条目(按依赖顺序):

1. 为本条建 todo,标记 in_progress。
2. 严格按条目内容实现;涉及代码的条目 MUST 遵循 test-driven-development(先写失败测试、确认失败、再实现转绿)。实现所需的完整细节以条目文本与 propose/ 文档为准。
3. 按条目自带验证方式验证;涉及代码的条目 MUST 跑全量测试确认不因本条变红。
4. **发现前序文档矛盾**(specs delta / proposal / design 与实际可行方案冲突)→ MUST 回写受影响文档使文档集一致,回写随本条 commit 落盘(回写范围不含 frontmatter 元数据)。
5. **勾选回填**:把该条 `- [ ]` 改为 `- [x]`(tasks.md 是文档,直接编辑;`tick-task` verb 面向 plan 的 `### Task N` 结构,MUST NOT 用于 tasks.md)。已勾选条目重跑时幂等跳过。
6. **簿记提交**(两个 commit,与 executing-plans 的进度节奏一致):
   本条无产出文件(如纯验证条目)时跳过第一个 commit,仅做勾选簿记提交,不硬跑 `git commit` 让 "nothing to commit" 以非零退出误报失败。
   ```bash
   git add <本条产出的文件> && git commit -m "<feat|fix|chore|refactor>: <条目语义>"
   git add speccode/changes/<slug>/propose/tasks.md && git commit -m "docs(speccode): tick tasks <N>"
   ```
7. 触发 onTaskCompleted 钩子(payload 条目序号):
   ```bash
   echo '{"command":"applying","feature_branch":"<F>","worktree_branch":"<W>","task":<N>}' | speccode run-hook --cwd . --event onTaskCompleted
   ```
   输出 `hook.ok=false` 或含 `warning` 时打印警告(含事件名与错误摘要),MUST NOT 阻断主流程。

## 完成后(必经 review,无商量余地)

1. **全量测试**:`node --test ./tests/*.test.mjs`(或项目等效全量测试命令),失败 → 停下修复,不得带病进 review。
2. **code review**:调用 `/speccode:requesting-code-review`,BASE 用前置第 5 步记录的 commit;审查反馈按 `/speccode:receiving-code-review` 核实处理。**review 未通过前 MUST NOT 进入 syncing。**
3. **写记忆**:把实现进度摘要(完成条目、验证结果、回写记录)追加到本 feature 的 memory:
   ```bash
   speccode write-memory --cwd . --branch <F> --json-stdin <<'EOF'
   {"mode":"append","content":"<摘要>"}
   EOF
   ```
4. **收尾路由**:依次 `/speccode:syncing` → `/speccode:archiving` → `/speccode:finishing-worktree`(syncing/archiving 需在开发分支上运行)。

**长会话主动记忆**:在以下时机 MUST 主动执行 write-memory(append),不等命令出入口:①每条完成且距上次写入已隔多条;②会话上下文显著增长(接近 compact 风险);③compact 恢复后继续工作的首条完成时。写入内容 MUST 是关键决策/进度/待办的摘要。

## 护栏

- 唯一准入 = tier 字段为 1 且无 plan;绝不绕过 review 进 syncing。
- tier 字段只读;缺失/非法报错退出,不猜默认值。
- tasks.md 勾选是文档编辑,不用 tick-task verb。
- 卡住(条目不可实现、验证反复失败、指令不清)就停下求助,不盲猜。
