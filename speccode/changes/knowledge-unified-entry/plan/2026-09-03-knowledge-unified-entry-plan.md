# knowledge-unified-entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 distilling-knowledge / recording-knowledge 从特权维护机制迁到 v3 统一入口(state 登记的 chore/knowledge-* worktree 分支 + finishing-worktree 收尾)。

**Architecture:** 纯命令层 prose 重写:两命令的入口/续跑/收尾段替换为「state 查询 + 引导 creating-worktree + 引导 finishing-worktree」;README ×2 同步运行位置描述。lib 零改动,复用现有 verb(reconcile / creating-worktree / finishing-worktree 命令既有流程)。

**Tech Stack:** Markdown 命令文件(交互层 prose);验证靠 grep 锚点 + 全量测试基线(无 lib 行为变化,无新增测试)。

## Global Constraints

- 命令 markdown 全程中文;frontmatter 保留四字段(name/description/category/tags),name 与 category 不变。
- 确定性逻辑绝不写进命令 markdown——本计划无任何新增逻辑实现,只引用既有命令与 verb。
- 判定依据 MUST 基于 state 查询(reconcile 输出的 features),MUST NOT 出现 `git branch --no-merged` / merge 状态判定。
- README 双语结构一一对应;两版不得硬编码版本号与测试数量。
- 本计划不改:plugin.json 版本、CHANGELOG(发版时另行)、speccode/spec/ 主规格(由 syncing 从 delta 合并)、任何 lib/tests 文件。
- 裸调 `speccode.mjs <verb> --cwd .`;写 verb 必须 `--json-stdin`。
- 全量测试命令必须 glob 形式:`node --test ./plugins/speccode/tests/*.test.mjs`。

---

### Task 1: 重写 distilling-knowledge.md 入口与收尾段

**Files:**
- Modify: `plugins/speccode/commands/distilling-knowledge.md`(§前置 2-3、§落盘 4-5、首行正文)

**Interfaces:**
- Consumes: 既有命令 `/speccode:creating-worktree`、`/speccode:finishing-worktree`;既有 verb `reconcile`(输出 `features[]`,字段 `branch/worktree/status`)、`write-memory`(`_knowledge` 保留键)。
- Produces: distilling-knowledge 命令的新前置(§2-3)与新收尾(§落盘 4-5)文本;Task 2 按同构语义独立重写(不共享文本)。

- [x] **Step 1: 重写首行运行位置声明**

将首段末尾的:

```markdown
**应在 trunk 分支上运行**(`git rev-parse --abbrev-ref HEAD` 校验等于 `config.trunk`)。
```

替换为:

```markdown
**应在 state 登记的 `chore/knowledge-*` worktree 分支上运行**(trunk 上运行时由本命令引导建分支,见 §3)。
```

- [x] **Step 2: 重写前置 §2-3(删除特权 bootstrap,改为 state 引导)**

将前置 §2(trunk 入口校验,锚点「`git rev-parse --abbrev-ref HEAD` MUST 等于 `config.trunk`」)与 §3(bootstrap 维护分支,锚点「`git branch --list 'chore/knowledge-*' --no-merged`」)两段整体替换为:

```markdown
2. **运行位置校验**:运行 `git rev-parse --abbrev-ref HEAD` 取当前分支,并运行 `speccode.mjs reconcile --cwd .` 取 `features`:
   - HEAD 为 `chore/knowledge-*` 且 `features` 中存在该分支的 state 登记(status ∈ {pending, in_progress, pr_open})→ 直接进入 §4(在本 knowledge worktree 中执行)。
   - HEAD 为 `config.trunk` → 走 §3「分支引导」。
   - 其他(非 trunk、非 state 登记的 `chore/knowledge-*`)→ 退出并提示「知识维护请在 chore/knowledge-* worktree 分支上进行:回 trunk 运行本命令引导建分支,或 cd 到既有 knowledge worktree」。
3. **分支引导(仅 trunk 上运行时)**:从 §2 的 reconcile `features` 输出筛选 `branch` 匹配 `^chore/knowledge-` 且 `status ∈ {pending, in_progress, pr_open}` 的条目:
   - 有命中 → AskUserQuestion 询问「续跑(cd 到该分支 worktree)/ 新建」;续跑 → `cd <该条目的 worktree>` 后进入 §4;新建 → 按无命中流程另起 slug(不得复用同一分支名,该分支仍有未完成 state)。
   - 无命中 → AskUserQuestion 确认 slug(默认 `knowledge-distill`;须匹配 `^[a-z0-9-]+$`),引导执行 `/speccode:creating-worktree chore/knowledge-<slug>`(type=`chore`,基点 trunk,登记 state)→ 建成后 `cd <worktree>` 进入 §4。
   - 「未完成」判定 MUST 基于 state 查询(reconcile 输出),MUST NOT 依赖 `git branch --no-merged` 等 git merge 判定(squash-only 合并下对已合并分支永真,会把已收尾分支误判为未完成)。
```

删除原 §3 中的全部特权机制语句,包括但不限于:`git checkout -b` 裸建分支、`push -u`、「**不创建 speccode state、不运行 reconcile、不开 git worktree**」、`feature-progress` 登记校验整段。原前置 §4-§8(read-knowledge / 骨架创建 / 读 spec/archive / sidecar / code-intel)内容不变,仅编号随段落合并顺延。

- [x] **Step 3: 重写落盘段(直通 PR → finishing-worktree 引导)**

将落盘段 item 4(**直通 PR**,锚点「创建前 MUST **查重**」)整段替换为:

```markdown
4. **收尾**:全部写入与提交完成后,引导执行 `/speccode:finishing-worktree` 收尾(测试门禁 + 按 `merge_target` 的 PR 路由 + squash-only 探测 + 切回 merge_target);建议在 PR 菜单选「PR 不等待」(知识维护不阻塞日常开发)。从 finishing-worktree 的输出取得 PR url(或 `pr_tool=none` 时的等效命令)。
```

将原 item 5(memory)中的触发条件句「PR 创建/复用(或 `pr_tool=none` 打印等效命令)**之后**」改为「finishing-worktree 收尾取得 PR url(或等效命令)**之后**」,其余(_knowledge 追加、顺序不可调换)不变。原 item 6(报告)中「PR url(或等效命令)」来源同步改为 finishing-worktree 输出。

- [x] **Step 4: 校验特权条款零残留**

Run: `grep -n "no-merged\|不阻塞\|MUST NOT 创建\|checkout -b\|不运行 reconcile\|不开 git worktree\|不调用 finishing" plugins/speccode/commands/distilling-knowledge.md`
Expected: 零命中(exit 1)

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/commands/distilling-knowledge.md
git commit -m "docs(knowledge): distilling-knowledge adopts unified worktree entry"
```

### Task 2: 重写 recording-knowledge.md 入口与收尾段

**Files:**
- Modify: `plugins/speccode/commands/recording-knowledge.md`(§前置 2-3、§落盘 3-5、首行正文)

**Interfaces:**
- Consumes: 同 Task 1(creating-worktree / finishing-worktree / reconcile / write-memory)。
- Produces: recording-knowledge 命令的新前置与新收尾文本(slug 默认值与 distilling 不同)。

- [x] **Step 1: 重写首行运行位置声明**

将首段末尾的:

```markdown
**应在 trunk 分支上运行**(`git rev-parse --abbrev-ref HEAD` 校验等于 `config.trunk`)。
```

替换为:

```markdown
**应在 state 登记的 `chore/knowledge-*` worktree 分支上运行**(trunk 上运行时由本命令引导建分支,见 §3)。
```

- [x] **Step 2: 重写前置 §2-3(state 引导,slug 默认值不同)**

将前置 §2(锚点「`git rev-parse --abbrev-ref HEAD` MUST 等于 `config.trunk`」)与 §3(锚点「`git branch --list 'chore/knowledge-*' --no-merged`」)整体替换为:

```markdown
2. **运行位置校验**:运行 `git rev-parse --abbrev-ref HEAD` 取当前分支,并运行 `speccode.mjs reconcile --cwd .` 取 `features`:
   - HEAD 为 `chore/knowledge-*` 且 `features` 中存在该分支的 state 登记(status ∈ {pending, in_progress, pr_open})→ 直接进入 §4(在本 knowledge worktree 中执行)。
   - HEAD 为 `config.trunk` → 走 §3「分支引导」。
   - 其他(非 trunk、非 state 登记的 `chore/knowledge-*`)→ 退出并提示「知识维护请在 chore/knowledge-* worktree 分支上进行:回 trunk 运行本命令引导建分支,或 cd 到既有 knowledge worktree」。
3. **分支引导(仅 trunk 上运行时)**:从 §2 的 reconcile `features` 输出筛选 `branch` 匹配 `^chore/knowledge-` 且 `status ∈ {pending, in_progress, pr_open}` 的条目:
   - 有命中 → AskUserQuestion 询问「续跑(cd 到该分支 worktree)/ 新建」;续跑 → `cd <该条目的 worktree>` 后进入 §4;新建 → 按无命中流程另起 slug(不得复用同一分支名,该分支仍有未完成 state)。
   - 无命中 → AskUserQuestion 确认 slug(默认取待记录内容的主题命名 `knowledge-<主题>`,无主题时 `knowledge-record`;须匹配 `^[a-z0-9-]+$`),引导执行 `/speccode:creating-worktree chore/knowledge-<slug>`(type=`chore`,基点 trunk,登记 state)→ 建成后 `cd <worktree>` 进入 §4。
   - 「未完成」判定 MUST 基于 state 查询(reconcile 输出),MUST NOT 依赖 `git branch --no-merged` 等 git merge 判定(squash-only 合并下对已合并分支永真,会把已收尾分支误判为未完成)。
```

删除原 §3 全部特权机制语句(范围同 Task 1 Step 2)。原前置 §4-§5(read-knowledge / 骨架创建)内容不变,编号顺延。

- [x] **Step 3: 重写落盘段(直通 PR → finishing-worktree 引导)**

将落盘段 item 3(**直通 PR**,锚点「创建前 MUST **查重**」)整段替换为:

```markdown
3. **收尾**:落盘提交完成后,引导执行 `/speccode:finishing-worktree` 收尾(测试门禁 + 按 `merge_target` 的 PR 路由 + squash-only 探测 + 切回 merge_target);建议在 PR 菜单选「PR 不等待」。从 finishing-worktree 的输出取得 PR url(或 `pr_tool=none` 时的等效命令)。
```

将原 item 4(memory)触发条件句「PR 创建/复用(或 `pr_tool=none` 打印等效命令)**之后**」改为「finishing-worktree 收尾取得 PR url(或等效命令)**之后**」,其余不变;原 item 5(报告)同步改来源。

- [x] **Step 4: 校验特权条款零残留**

Run: `grep -n "no-merged\|不阻塞\|MUST NOT 创建\|checkout -b\|不运行 reconcile\|不开 git worktree\|不调用 finishing" plugins/speccode/commands/recording-knowledge.md`
Expected: 零命中(exit 1)

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/commands/recording-knowledge.md
git commit -m "docs(knowledge): recording-knowledge adopts unified worktree entry"
```

### Task 3: README ×2 运行位置描述同步

**Files:**
- Modify: `plugins/speccode/README.md:67-68,220`
- Modify: `plugins/speccode/README_CN.md:67-68,219`

**Interfaces:**
- Consumes: Task 1/2 确定的新运行模型(state 登记的 chore/knowledge-* worktree + 统一收尾)。
- Produces: 双语一致的命令表与 memory 段描述。

- [ ] **Step 1: EN 命令表两行的运行位置列**

`README.md:67` 行尾 `| trunk branch |` → `| chore/knowledge-* worktree branch (unified creating-worktree entry, finishing-worktree finish) |`;`README.md:68` 行尾 `| trunk branch |` → `| chore/knowledge-* worktree branch (unified entry/finish) |`。

- [ ] **Step 2: EN memory 例外段**

`README.md:220` 末句:

```markdown
The knowledge commands also run from trunk, so their maintenance summaries go into `memory/_knowledge.md`.
```

替换为:

```markdown
The knowledge commands run on `chore/knowledge-*` worktree branches via the standard creating-worktree entry and finishing-worktree finish; their maintenance summaries still go into `memory/_knowledge.md`.
```

- [ ] **Step 3: CN 对应行镜像同步**

`README_CN.md:67` 行尾 `| trunk 分支 |` → `| chore/knowledge-* worktree 分支(creating-worktree 统一入口、finishing-worktree 统一收尾)|`;`README_CN.md:68` 行尾 `| trunk 分支 |` → `| chore/knowledge-* worktree 分支(统一入口/收尾)|`。

`README_CN.md:219` 末句:

```markdown
knowledge 系列命令同样从 trunk 跑,其维护摘要写入 `memory/_knowledge.md`。
```

替换为:

```markdown
knowledge 系列命令经 creating-worktree 统一入口在 `chore/knowledge-*` worktree 分支上运行、经 finishing-worktree 统一收尾,其维护摘要仍写入 `memory/_knowledge.md`。
```

- [ ] **Step 4: 双语一致性校验**

Run: `grep -c "trunk branch\|trunk 分支" plugins/speccode/README.md plugins/speccode/README_CN.md; grep -n "版本\|tests" plugins/speccode/README.md plugins/speccode/README_CN.md | grep -v "CHANGELOG\|测试门禁" | head -5`
Expected: 两文件对「trunk branch / trunk 分支」的残留命中为 0(该列已全部替换);无版本号/测试数量硬编码新增

- [ ] **Step 5: 提交**

```bash
git add plugins/speccode/README.md plugins/speccode/README_CN.md
git commit -m "docs(knowledge): README x2 sync knowledge command run location"
```

### Task 4: 门禁与收尾

**Files:**
- 无新改动(验证 + 收尾命令序列)

**Interfaces:**
- Consumes: Task 1-3 全部提交;delta 位于 `speccode/changes/knowledge-unified-entry/propose/specs/knowledge-set/spec.md`。
- Produces: 已同步的主规格、已归档的变更目录、已路由的 PR。

- [ ] **Step 1: 全量测试基线**

Run: `node --test ./plugins/speccode/tests/*.test.mjs 2>&1 | tail -4`
Expected: `pass 266` / `fail 0`(纯 prose 改动,基线保持)

- [ ] **Step 2: 执行 `/speccode:syncing`**

把 delta 合并进 `speccode/spec/knowledge-set/spec.md`(MODIFIED「知识维护分支与直通 PR」),落盘即提交。

- [ ] **Step 3: 执行 `/speccode:archiving`**

`speccode/changes/knowledge-unified-entry/` 移入 `speccode/archive/2026-09-03-knowledge-unified-entry/`,落盘即提交。

- [ ] **Step 4: 执行 `/speccode:finishing-worktree`**

按 merge_target=main 路由:测试门禁 → PR 菜单(建议「PR 不等待」)→ state 推进 → 切回 trunk。`_knowledge` 维护摘要不在本次范围(那是蒸馏/记录运行时行为)。
