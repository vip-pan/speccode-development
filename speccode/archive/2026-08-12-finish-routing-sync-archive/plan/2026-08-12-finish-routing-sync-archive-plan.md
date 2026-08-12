# 开发完成收尾路由修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 dev-completion 命令(subagent-driven-development / executing-plans)的收尾引导从「直跳 finishing-worktree」改为「条件化路由:有落地文档 → syncing → archiving → finishing-worktree;无 → 直接 finishing-worktree」,并在 finishing-worktree 加 warn-only 未归档变更检查。

**Architecture:** 全部为命令 prose 改动(无 lib/逻辑改动)。4 个命令文件:subagent-driven-development.md(收尾/流程图/示例)、executing-plans.md(第3步)、creating-worktree.md(暂不落地路径核对)、finishing-worktree.md(新增 C 门 `test -d speccode/changes/<slug>/` → warn-only)。spec delta(ADDED ×2)已在 propose/specs/git-workflow-lifecycle/spec.md 就绪,由 syncing 合并。

**Tech Stack:** 纯 markdown prose、node:test 全量验证。

## Global Constraints

- 收尾路由顺序硬约束:有落地文档(`speccode/changes/<slug>/` 存在)→ syncing → archiving → finishing-worktree;无 → 直接 finishing-worktree。原因:syncing/archiving 的 trunk 防护要求 worktree-* 分支,finishing-worktree 会移除 worktree
- 手动模式 → 用 AskUserQuestion 询问;auto 模式 → 自动衔接执行 `/speccode:syncing`;判断依据不充分时 MUST 默认询问
- C 门 warn-only,不阻断、不强制
- 命令层(prose)只引导,不实现逻辑
- 全量测试用 glob:`node --test ./plugins/speccode/tests/*.test.mjs`
- 提交消息末尾带 `Co-Authored-By: Claude <noreply@anthropic.com>`
- 每个任务只动本任务 Files 列出的文件
- README 若涉收尾路由措辞改动 MUST EN/CN 双语同步

---

### Task 1: subagent-driven-development.md 收尾路由

**Files:**
- Modify: `plugins/speccode/commands/subagent-driven-development.md:292`(收尾)
- Modify: `plugins/speccode/commands/subagent-driven-development.md:78`(流程图节点)
- Modify: `plugins/speccode/commands/subagent-driven-development.md:107`(流程图边)
- Modify: `plugins/speccode/commands/subagent-driven-development.md:371`(示例)

**Interfaces:**
- Consumes: 无
- Produces: 收尾路由文案与流程图条件分支(其余任务引用同一套路由语义)

- [ ] **Step 1: 修改收尾引导(:292)**

把:
```markdown
调用 `/speccode:finishing-worktree`。
```
替换为:
```markdown
**收尾路由**:
- 若 `speccode/changes/<slug>/` 存在(有落地文档):手动模式 → 用 AskUserQuestion 询问是否执行 `/speccode:syncing`;auto 模式 → 自动衔接执行 `/speccode:syncing`。判断依据不充分时 MUST 默认询问而非自动衔接。随后依次执行 `/speccode:archiving` → `/speccode:finishing-worktree`(顺序硬约束:syncing/archiving 需在 worktree-* 分支上运行,而 finishing-worktree 会移除 worktree)。
- 若 `speccode/changes/<slug>/` 不存在(未落地文档):直接执行 `/speccode:finishing-worktree`,不引导 syncing/archiving。
```

- [ ] **Step 2: 修改流程图节点(:78)**

把:
```dot
    "Use /speccode:finishing-worktree" [shape=box style=filled fillcolor=lightgreen];
```
替换为:
```dot
    "Route completion: docs? sync+archive+finish : direct finish" [shape=diamond];
    "Use /speccode:finishing-worktree" [shape=box style=filled fillcolor=lightgreen];
```

- [ ] **Step 3: 修改流程图边(:107)**

把:
```dot
    "Final review clean: delete this plan's workspace" -> "Use /speccode:finishing-worktree";
```
替换为:
```dot
    "Final review clean: delete this plan's workspace" -> "Route completion: docs? sync+archive+finish : direct finish";
    "Route completion: docs? sync+archive+finish : direct finish" -> "Use /speccode:finishing-worktree";
```

- [ ] **Step 4: 修改示例工作流(:371)**

把:
```markdown
完成!调用 /speccode:finishing-worktree。
```
替换为:
```markdown
完成!若有落地文档,先 /speccode:syncing → /speccode:archiving,再 /speccode:finishing-worktree;否则直接 /speccode:finishing-worktree。
```

- [ ] **Step 5: 校验**

Run: `grep -n "finishing-worktree\|Route completion" plugins/speccode/commands/subagent-driven-development.md`
Expected: 收尾段出现「收尾路由」与条件化文案;流程图出现 "Route completion: docs? sync+archive+finish : direct finish";无残留「调用 `/speccode:finishing-worktree`。」孤行

- [ ] **Step 6: 提交**

```bash
git add plugins/speccode/commands/subagent-driven-development.md
git commit -m "docs(speccode): subagent-driven 收尾条件化路由" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 2: executing-plans.md 收尾路由

**Files:**
- Modify: `plugins/speccode/commands/executing-plans.md:58-60`

**Interfaces:**
- Consumes: Task 1 的收尾路由语义(同一套条件化文案)
- Produces: 无

- [ ] **Step 1: 修改第 3 步完成开发(:58-60)**

把:
```markdown
- 宣布:"我在用 finishing-worktree 完成这项工作。"
- **REQUIRED SUB-SKILL:** 使用 `/speccode:finishing-worktree`
- 按该命令验证测试、呈现选项、执行选择
```
替换为:
```markdown
- **收尾路由**:若 `speccode/changes/<slug>/` 存在(有落地文档)→ 手动模式用 AskUserQuestion 询问、auto 模式自动衔接执行 `/speccode:syncing`,判断依据不充分时 MUST 默认询问而非自动衔接,随后依次 `/speccode:archiving` → `/speccode:finishing-worktree`(顺序硬约束:syncing/archiving 需 worktree-* 分支,finishing-worktree 会移除 worktree);若不存在 → 直接执行 `/speccode:finishing-worktree`。
- **REQUIRED SUB-SKILL:** 按上述收尾路由执行(`/speccode:finishing-worktree` 为最终收尾)
- 按该命令验证测试、呈现选项、执行选择
```

- [ ] **Step 2: 校验**

Run: `grep -n "收尾路由\|REQUIRED SUB-SKILL" plugins/speccode/commands/executing-plans.md`
Expected: 第 3 步出现「收尾路由」条件化文案;无「宣布:"我在用 finishing-worktree 完成这项工作。"」残留

- [ ] **Step 3: 提交**

```bash
git add plugins/speccode/commands/executing-plans.md
git commit -m "docs(speccode): executing-plans 收尾条件化路由" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 3: creating-worktree.md 暂不落地文档路径核对

**Files:**
- Modify: `plugins/speccode/commands/creating-worktree.md:53`

**Interfaces:**
- Consumes: 无
- Produces: 无

- [ ] **Step 1: 修改「用户暂不落地文档」提示(:53)**

把:
```markdown
- 用户暂不落地文档 → 提示:开发完成后执行 `/speccode:finishing-worktree`。
```
替换为:
```markdown
- 用户暂不落地文档 → 提示:开发完成后,若有落地文档先 `/speccode:syncing` → `/speccode:archiving` 再 `/speccode:finishing-worktree`;否则直接 `/speccode:finishing-worktree`。
```

- [ ] **Step 2: 校验**

Run: `grep -n "暂不落地文档" plugins/speccode/commands/creating-worktree.md`
Expected: 该行含条件化路由(有文档→sync/archive/finish;无→直接 finish)

- [ ] **Step 3: 提交**

```bash
git add plugins/speccode/commands/creating-worktree.md
git commit -m "docs(speccode): creating-worktree 暂不落地文档提示一致化" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 4: finishing-worktree.md 未归档变更检查(C 门)

**Files:**
- Modify: `plugins/speccode/commands/finishing-worktree.md:24`(在「## 询问合并方式」之前插入)

**Interfaces:**
- Consumes: slug(由本命令前置的 reconcile 得到的 feature 分支派生)
- Produces: warn-only 未归档检查(命令层 `test -d`,与标记文件探测先例一致)

- [ ] **Step 1: 插入未归档变更检查节**

在 `## 询问合并方式(恰好四项)` 之前插入:
```markdown
## 未归档变更检查(warn-only)

合并选项呈现前,检查 `speccode/changes/<slug>/` 是否存在:
- 存在(有未归档的落地文档)→ 打印警告「建议先执行 /speccode:syncing 与 /speccode:archiving,再回来收尾 worktree」,MUST NOT 阻断,继续呈现合并选项。
- 不存在 → 静默,直接进入合并选项。
```

- [ ] **Step 2: 校验**

Run: `grep -n "未归档变更检查\|test -d speccode/changes" plugins/speccode/commands/finishing-worktree.md`
Expected: 新节出现在测试门禁之后、询问合并方式之前;含 `test -d speccode/changes/<slug>/` 检查描述

- [ ] **Step 3: 提交**

```bash
git add plugins/speccode/commands/finishing-worktree.md
git commit -m "docs(speccode): finishing-worktree 未归档变更 warn 门" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 5: 验证(spec delta + 全量绿 + README)

**Files:**
- Verify: `speccode/changes/finish-routing-sync-archive/propose/specs/git-workflow-lifecycle/spec.md`
- Verify: `plugins/speccode/README.md` 与 `plugins/speccode/README_CN.md`(仅核对)

**Interfaces:**
- Consumes: Tasks 1-4 全部完成
- Produces: 无

- [ ] **Step 1: 核对 spec delta 就绪**

Run: `grep -c "开发完成收尾路由\|finishing-worktree 未归档变更警告" speccode/changes/finish-routing-sync-archive/propose/specs/git-workflow-lifecycle/spec.md`
Expected: 2(两个 ADDED requirement 标题各命中 1 次)

- [ ] **Step 2: 全量测试**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS — 137 用例,0 fail(prose 改动不涉代码)

- [ ] **Step 3: README EN/CN 核对**

检查 `plugins/speccode/README.md` 与 `plugins/speccode/README_CN.md`:命令表/流程描述是否涉收尾路由措辞。预期零改动;若需改 MUST 双语同步,并提交。

- [ ] **Step 4: 若有改动才提交**

仅当 Step 3 发现措辞需改时提交(预期跳过):
```bash
git add plugins/speccode/README.md plugins/speccode/README_CN.md
git commit -m "docs(speccode): 收尾路由措辞" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```
