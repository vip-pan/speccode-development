# dev-flow-tiering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把开发流程三层分级(含新命令 applying、tier 字段、轻档 proposing、review 无条件化、Tier 0 封禁)落地为命令 markdown 与门面文档,spec delta 已在 propose/ 落盘(commit ff2cc1a)。

**Architecture:** 纯 prose 层变更:7 处命令 markdown + 4 个门面文档 + 1 个 SKILL。引擎(lib/bin/tests/hooks)零改动——无新 verb,tasks.md 勾选是文档编辑语义。真源 = `speccode/changes/dev-flow-tiering/propose/specs/` 的 6 个 delta(以下称「delta 真源」),所有命令文本的准入口径 MUST 与其一致。

**Tech Stack:** Markdown(prose);验证 = 结构化 grep + `node --test`(全量,纯回归)。

## Global Constraints

[以下每条隐含包含在每个任务中]

- 纯 prose 变更:MUST NOT 修改 `plugins/speccode/lib|bin|tests|hooks/` 下任何文件;MUST NOT 新增 verb。
- **双语同步**:根 `README.md`(EN)与 `README_CN.md`(zh)、插件 `plugins/speccode/README.md`(EN)与 `README_CN.md`(zh)每处改动 MUST 两版同改、结构一一对应;MUST NOT 硬编码版本号与测试数量。
- **MODIFIED 名称逐字一致**:delta 中 `### Requirement: <名称>` 与主规格既有标题逐字一致(已核对,执行时不得改动 delta 标题)。
- spec 用语语义化:SHALL(能力)/ MUST(硬约束)/ SHOULD(建议)/ MAY(可选);每条 requirement 至少一个 `#### Scenario:`。
- 命令 markdown frontmatter 规范:`name: "SpecCode: <Name>"`、`description:`、`category: Workflow`、`tags: [speccode, ...]`;正文全程中文交互;含「护栏」段。
- applying 的准入口径与 delta 真源逐字一致:唯一准入 = `tier` 字段为 1 且 `plan/` 不存在。
- 提交信息文档类用 `docs(speccode): ...`;每个任务以 commit 收尾。
- 工作目录 = 本 worktree(分支 `feature/dev-flow-tiering`);验证命令均在 worktree 根执行。

---

### Task 1: 新建 applying 命令

**Files:**
- Create: `plugins/speccode/commands/applying.md`

**Interfaces:**
- Consumes: delta 真源「applying 手动执行命令」requirement;`speccode:proposing` 的四类文档(tier 字段、tasks.md);`speccode:requesting-code-review`(BASE 契约:调用方记录的 commit)。
- Produces: Tier 1 执行入口;后续 Task 2/4/11(命名各计划任务号)引用其准入口径。

- [x] **Step 1: 写入以下完整内容到 `plugins/speccode/commands/applying.md`**

````markdown
---
name: "SpecCode: Applying"
description: "Tier 1 手动执行入口:按 tasks.md 勾选清单逐条实现(无 plan),条目勾选回填 + 簿记 commit,完成后必经 code review"
category: Workflow
tags: [speccode, workflow, applying, tier1]
---

按 `tasks.md` 勾选清单逐条手动实现变更——不走 plan、不派子代理,适用于 proposing 产物已完全覆盖需求的极小型需求(Tier 1)。全程中文交互。**应在开发分支(`<type>/<slug>`、非 trunk)上运行**。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. **trunk 防护**:`git rev-parse --abbrev-ref HEAD` 必须为非 trunk 的 `<type>/<slug>` 形态分支;否则退出并提示「请在开发分支上运行本命令」。
3. 运行 `speccode.mjs reconcile --cwd .` 找到所属功能分支 F,计算 slug。
4. **准入检查(唯一准入 = tier 字段为 1 且无 plan)**,逐项过,不过即退出:
   - `speccode/changes/<slug>/propose/proposal.md` 不存在 → 报错「未找到变更文档,请先 `/speccode:proposing`」并退出(零文档直实现不被允许)。
   - 读 proposal.md 的 YAML frontmatter `tier:` 字段;缺失或取值非 `1|2|3` → 报错「tier 字段缺失或非法,请修复(重跑 proposing 定层或手动补字段)」并退出,MUST NOT 按默认层级继续。
   - `tier` 非 1:tier ≥ 2 且 `plan/` 不存在 → 报错「本变更定层为 Tier <N>,请先 `/speccode:writing-plans` 生成计划」并退出;tier 为 3 且 `brainstorm/` 不存在 → 报错并引导 `/speccode:brainstorming`;退出。
   - `speccode/changes/<slug>/plan/` 存在任何计划文件 → 报错「本变更已有 plan,请用 `/speccode:subagent-driven-development`(推荐)或 `/speccode:executing-plans` 执行」并退出。
   - `propose/tasks.md` 不存在或无 `- [ ]` 未勾选条目 → 报错(tasks.md 是本命令唯一执行清单)并退出。
5. **记录 BASE**:运行 `git rev-parse HEAD`,把输出记为本次实现的 BASE commit(requesting-code-review 的 base)。
6. **读记忆**:运行 `speccode.mjs read-memory --cwd . --branch <F>`;返回非 null 时把 memory 内容作为既有上下文参考。

## 知识库入口

1. 运行 `speccode.mjs read-knowledge --cwd . --index` 读 `_index.md`(恒读,便宜);`exists:false` → 静默跳过本节。
2. 判断本任务相关主题 → `speccode.mjs read-knowledge --cwd . --topic <名称>` 读对应 topic 文件;`exists:false` → 静默跳过该主题。
3. 读取失败或目录不存在 → 静默跳过,绝不阻断主流程(T0 兜底,永不报错)。

## 逐条实现

对 tasks.md 勾选清单的每一条未勾选条目(按依赖顺序):

1. 为本条建 todo,标记 in_progress。
2. 严格按条目内容实现;涉及代码的条目 MUST 遵循 test-driven-development(先写失败测试、确认失败、再实现转绿)。实现所需的完整细节以条目文本与 propose/ 文档为准。
3. 按条目自带验证方式验证;涉及代码的条目 MUST 跑全量测试确认不因本条变红。
4. **发现前序文档矛盾**(specs delta / proposal / design 与实际可行方案冲突)→ MUST 回写受影响文档使文档集一致,回写随本条 commit 落盘(回写范围不含 frontmatter 元数据)。
5. **勾选回填**:把该条 `- [ ]` 改为 `- [x]`(tasks.md 是文档,直接编辑;`tick-task` verb 面向 plan 的 `### Task N` 结构,MUST NOT 用于 tasks.md)。已勾选条目重跑时幂等跳过。
6. **簿记提交**(两个 commit,与 executing-plans 的进度节奏一致):
   ```bash
   git add <本条产出的文件> && git commit -m "<feat|fix|chore|refactor>: <条目语义>"
   git add speccode/changes/<slug>/propose/tasks.md && git commit -m "docs(speccode): tick tasks <N>"
   ```
7. 触发 onTaskCompleted 钩子(payload 条目序号):
   ```bash
   echo '{"command":"applying","feature_branch":"<F>","worktree_branch":"<W>","task":<N>}' | speccode.mjs run-hook --cwd . --event onTaskCompleted
   ```
   输出 `hook.ok=false` 或含 `warning` 时打印警告(含事件名与错误摘要),MUST NOT 阻断主流程。

## 完成后(必经 review,无商量余地)

1. **全量测试**:`node --test ./plugins/speccode/tests/*.test.mjs`(或项目等效全量测试命令),失败 → 停下修复,不得带病进 review。
2. **code review**:调用 `/speccode:requesting-code-review`,BASE 用前置第 5 步记录的 commit;审查反馈按 `/speccode:receiving-code-review` 核实处理。**review 未通过前 MUST NOT 进入 syncing。**
3. **写记忆**:把实现进度摘要(完成条目、验证结果、回写记录)追加到本 feature 的 memory:
   ```bash
   speccode.mjs write-memory --cwd . --branch <F> --json-stdin <<'EOF'
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
````

- [x] **Step 2: 验证**

Run: `rg -c "唯一准入 = tier 字段为 1 且无 plan" plugins/speccode/commands/applying.md && rg -c "^#### " plugins/speccode/commands/applying.md`
Expected: 前者 ≥ 1;后者 ≥ 4(前置/逐条实现/完成后/护栏各节存在由整体阅读复核)

- [x] **Step 3: 提交**

```bash
git add plugins/speccode/commands/applying.md && git commit -m "docs(speccode): add applying command (tier 1 manual executor)"
```

### Task 2: proposing.md 定层与轻档改造

**Files:**
- Modify: `plugins/speccode/commands/proposing.md`

**Interfaces:**
- Consumes: delta 真源「proposing 文档生成」「轻档 proposing」「定层与 tier 字段」。
- Produces: frontmatter `tier:` 字段的唯一写点;Task 1/3 读取该字段。

- [x] **Step 1: 生成四类文档段改造**——「## 生成四类文档」节:
  - 节首句后插入标准档/轻档分支说明:「标准档(delta 非空)生成以下四类;轻档(本次变更无任何 capability 语义变更,如版本发布类 chore)允许省略 design.md 且 specs/ 为空,proposal.md 与 tasks.md 照常生成。」
  - 在第 4 条 tasks.md 说明之后追加第 5 点:「5. **frontmatter `tier:` 字段**——proposal.md 头部 YAML frontmatter 写入定层确认结果(取值 1|2|3);该字段单写者 = 本命令,其余命令 MUST NOT 修改;tier 只路由流程门禁,不豁免任何质量契约(TDD、code review、全量测试全层适用)。」
- [x] **Step 2: 复杂度评估段升级为定层三岔**——「## 需求澄清(提问环节)」中「**复杂度评估**」一条替换为:

  「**定层(建议 + 用户确认)**:文档生成完成后,按复杂度输出三岔定层建议并经 AskUserQuestion 确认(用户可改):**Tier 1**(极小,proposing 产物足以覆盖需求,无 plan 跟进,后续 applying 手动实现)/ **Tier 2**(中小型,大部分场景,后续 writing-plans → SDD 或 executing-plans)/ **Tier 3**(大型或仍有不明确、寻求更优解,后续 brainstorming → writing-plans 硬门禁)。Tier 2/3 建议 MUST 校验 specs/ 下存在非空 delta,否则拒绝该定层(提示降为 Tier 1 或补充 delta)。确认结果写入 proposal.md frontmatter `tier:` 字段。」

- [x] **Step 3: 下一步引导按层**——「## 下一步引导」替换为:

  「- Tier 3:建议 `/speccode:brainstorming` 精化设计(会回写本目录文档保持一致;brainstorm 后 MUST writing-plans)。
  - Tier 2:建议 `/speccode:writing-plans` 编写实现计划。
  - Tier 1:建议 `/speccode:applying` 按 tasks.md 逐条手动实现(完成后必经 requesting-code-review)。」

- [x] **Step 4: 护栏追加**——「## 护栏」加一条:「tier 字段是本命令的唯一写点;轻档判定依据是 specs/ 是否为空,MUST NOT 凭主观体量判断。」

- [x] **Step 5: 验证**

Run: `rg -c "定层|Tier 1|Tier 2|Tier 3|tier:" plugins/speccode/commands/proposing.md`
Expected: 各关键词均 ≥ 1;整体阅读确认三岔确认 + 轻档分支 + frontmatter 落笔三点齐全

- [x] **Step 6: 提交**

```bash
git add plugins/speccode/commands/proposing.md && git commit -m "docs(speccode): proposing tiering (tier field, light mode)"
```

### Task 3: writing-plans.md tier 门禁与降级改造

**Files:**
- Modify: `plugins/speccode/commands/writing-plans.md`

**Interfaces:**
- Consumes: delta 真源「writing-plans 输入优先级」「勾选清单唯一性」;proposing 落笔的 tier 字段。
- Produces: 降级后的 tasks.md 形态契约;Task 5 archiving 按层检查的输入。

- [x] **Step 1: 前置加 tier 读取**——「## 前置」第 3 条(读输入文档)之后插入:

  「3b. **tier 门禁**:读 `speccode/changes/<slug>/propose/proposal.md` 的 frontmatter `tier:` 字段(缺失或非法 → 报错要求修复并退出):tier 为 3 时 `brainstorm/` 必须已存在,缺失 → 报错「Tier 3 必须先脑暴:请先 `/speccode:brainstorming`」并退出;tier 为 1 → 提示「本变更定层为 Tier 1,通常无需 plan;确认升档为有意行为?」,用户确认后继续并建议同步更新 tier 字段(经用户同意,本命令不擅自改)。」

- [x] **Step 2: 新增降级与回写义务段**——「## 保存与提交(必须)」的落盘条目后插入:

  「- **tasks.md 降级(勾选清单唯一性)**:计划落盘后 MUST 把 `propose/tasks.md` 降级为无勾选的动作列表(所有 `- [ ] `/`- [x] ` 前缀去掉)并在标题下加接管标记行:「> 本清单已由 plan/<计划文件名> 接管:实现进度以 plan 的 checkbox 为准,本文件不再勾选,仅作意图索引。」降级与计划同一簿记 commit 提交。降级后 tasks.md MUST NOT 再被任何命令勾选,archiving 完成度检查只数 plan/。
  - **回写义务**:编写计划中发现前序文档(propose/ 或 brainstorm/)与本计划矛盾(方案错误、范围偏差、决策变更)→ MUST 回写受影响处使文档集一致,随本阶段 commit 落盘(范围不含 frontmatter 元数据)。」

- [x] **Step 3: 验证**

Run: `rg -c "tier 门禁|tasks.md 降级|回写义务" plugins/speccode/commands/writing-plans.md`
Expected: ≥ 3

- [x] **Step 4: 提交**

```bash
git add plugins/speccode/commands/writing-plans.md && git commit -m "docs(speccode): writing-plans tier gate and tasks downgrade"
```

### Task 4: 两条执行路径的 review 路由

**Files:**
- Modify: `plugins/speccode/commands/executing-plans.md`
- Modify: `plugins/speccode/commands/subagent-driven-development.md`

**Interfaces:**
- Consumes: delta 真源「review 无条件化」「命令衔接链」;requesting-code-review 的 BASE 契约。
- Produces: 三条执行路径一致的 review 终点。

- [x] **Step 1: executing-plans.md**——「### 第 3 步:完成开发」中「写记忆」之前插入:

  「- **code review(必经)**:全部任务完成并验证后 MUST 调用 `/speccode:requesting-code-review` 派发审查(BASE 用第 1 步加载 plan 前记录的 commit;开始执行时未记录则用 plan 簿记 commit 之前的 head);审查反馈按 `/speccode:receiving-code-review` 核实处理。**review 未通过前 MUST NOT 进入收尾路由(syncing/archiving)。**」

- [x] **Step 2: subagent-driven-development.md**——「## 何时使用」决策树中 `"Manual execution or brainstorm first"` 相关说明处补充:无 plan 的出口在 speccode 分级体系下 = Tier 1 的 `/speccode:applying`(准入:tier 字段为 1 且无 plan)或 Tier 3 的先 `/speccode:brainstorming`;文字与图节点 label 都要体现(图节点可改为 "applying (tier 1) or brainstorm first")。

- [x] **Step 3: 验证**

Run: `rg -c "requesting-code-review" plugins/speccode/commands/executing-plans.md && rg -c "applying" plugins/speccode/commands/subagent-driven-development.md`
Expected: 前者 ≥ 1,后者 ≥ 1

- [x] **Step 4: 提交**

```bash
git add plugins/speccode/commands/executing-plans.md plugins/speccode/commands/subagent-driven-development.md && git commit -m "docs(speccode): review routing for executing-plans, sdd no-plan exit to applying"
```

### Task 5: Tier 0 门禁与按层收尾

**Files:**
- Modify: `plugins/speccode/commands/finishing-worktree.md`
- Modify: `plugins/speccode/commands/archiving.md`

**Interfaces:**
- Consumes: delta 真源「Tier 0 封禁」「勾选清单唯一性」「轻档 proposing(空 delta 归档友好)」。
- Produces: 零文档合并的警告防线;与降级形态兼容的完成度检查。

- [ ] **Step 1: finishing-worktree.md**——合并路径开始处(测试门禁之前)插入:

  「**变更文档存在性检查(Tier 0 防线)**:检查 `speccode/changes/<slug>/` 是否存在(本分支的变更文档);缺失 → 警告「本分支疑似未走文档链(vibe coding),成果将无法回溯」并用 AskUserQuestion 询问是否继续,用户确认才继续,警告不硬阻断。」

- [ ] **Step 2: archiving.md**——「## 归档前检查」第 1 条改造为:

  「1. **任务完成检查(按现存勾选清单计数)**:tasks.md 仍有勾选语义(存在 `- [ ]`)→ 数它的未完成条目;tasks.md 已被 plan 接管(无勾选、含接管标记)或 plan/ 存在 → 数 plan/ 下计划的未完成 step。两处都无勾选语义 → 跳过该检查。有未完成 → 展示数量并询问是否继续归档;用户确认才继续。」

  并在第 2 条 sync 状态评估的「已全部合并 → 直接进入移动」前补一句:「`propose/specs/` 为空(轻档,无 delta)→ 判定「无 delta,已同步」,直接进入移动。」

- [ ] **Step 3: 验证**

Run: `rg -c "vibe coding" plugins/speccode/commands/finishing-worktree.md && rg -c "plan 接管|无 delta" plugins/speccode/commands/archiving.md`
Expected: 均 ≥ 1

- [ ] **Step 4: 提交**

```bash
git add plugins/speccode/commands/finishing-worktree.md plugins/speccode/commands/archiving.md && git commit -m "docs(speccode): tier0 gate in finishing-worktree, layered archiving checks"
```

### Task 6: 门面与自述文档(双语同步)

**Files:**
- Modify: `README.md`, `README_CN.md`(根)
- Modify: `plugins/speccode/README.md`, `plugins/speccode/README_CN.md`(插件)
- Modify: `CLAUDE.md`
- Modify: `skills/speccode-workflow/SKILL.md`

**Interfaces:**
- Consumes: Global Constraints 双语同步规则;最终命令清单(24 个,含 applying)。
- Produces: 用户可见的分级说明;SKILL.md 发布纪律与新链路衔接。

- [ ] **Step 1: 根 README ×2**——`README.md:59` 与 `README_CN.md:59` 的 Document flow/文档流 表行追加 `applying`(置于 writing-plans 与 executing 之间语义位:`proposing` `brainstorming` `writing-plans` `applying` `syncing` `archiving`);25 行 quick-start 附近如有命令枚举,同步加 applying;两版对应位置同改。补充一句分级说明(EN/CN 对应):极小需求可走 Tier 1(applying 手动实现),中小型走 writing-plans + SDD/executing-plans,复杂需求先 brainstorming。
- [ ] **Step 2: 插件 README ×2**——`plugins/speccode/README.md:57` 与 `README_CN.md:57` 命令表加 `/speccode:applying` 行(EN:「Manual executor for Tier-1 changes: implement tasks.md item-by-item (no plan), tick + bookkeeping commit, mandatory code review | a `<type>/<slug>` development branch」;CN 对应);`README_CN.md:92` 流程图行与 `:133`/`:135` 步骤枚举、`:150` 目录布局注释(补「轻档时 design.md/specs/ 可省」)、`:163` 落盘即 commit 命令清单加 applying——EN 版对应行全部同改。
- [ ] **Step 3: CLAUDE.md**——44 行「23 个 slash 命令」改「24 个」;「常用命令」表加一行 applying 用途;双层拓扑段落补一句:「proposing 定层(Tier 1/2/3)路由后续链路,tier 字段落 proposal.md frontmatter」。
- [ ] **Step 4: SKILL.md**——「## 发布纪律」节加一行:「release bump 类 chore 走 proposing 轻档(空 delta,design.md/specs/ 可省)→ `/speccode:applying` → syncing → archiving 链路,不再零文档直提。」
- [ ] **Step 5: 验证(双语对称)**

Run: `rg -c "applying" README.md README_CN.md plugins/speccode/README.md plugins/speccode/README_CN.md CLAUDE.md skills/speccode-workflow/SKILL.md`
Expected: 六个文件均 ≥ 1;成对文件计数语义对应(EN 与 CN 同改)

- [ ] **Step 6: 提交**

```bash
git add README.md README_CN.md plugins/speccode/README.md plugins/speccode/README_CN.md CLAUDE.md skills/speccode-workflow/SKILL.md && git commit -m "docs: facades for tiered flow (applying, tier field, light proposing)"
```

### Task 7: 结构化校验 + 全量测试

**Files:**
- 无产出(纯验证;发现问题则修复后并入本任务 commit)

**Interfaces:**
- Consumes: 全部前序任务产出;propose/ delta 真源。
- Produces: 完成态验证证据。

- [ ] **Step 1: MODIFIED 名称逐字一致**——对 5 个 MODIFIED capability,逐一比对 delta 与主规格的需求标题:

Run: `rg -n "^### Requirement:" speccode/spec/{sdd-document-lifecycle,git-workflow-lifecycle,session-memory,hook-event-integration,knowledge-set}/spec.md | rg "proposing 文档生成|writing-plans 输入优先级|命令衔接链|命令清单|finishing-worktree 测试验证与选项菜单|命令读写时机|run-hook verb 与调用节点|蒸馏命令"`
Expected: 8 条全部命中且与 delta 标题逐字一致

- [ ] **Step 2: delta 结构完整性**——每个 delta 文件每条 requirement 至少一个 Scenario:

Run: `for f in speccode/changes/dev-flow-tiering/propose/specs/*/spec.md; do echo "$f: $(rg -c '^### Requirement:' $f) req / $(rg -c '^#### Scenario:' $f) scenarios"; done`
Expected: 每个文件 scenarios ≥ requirements(逐文件核对)

- [ ] **Step 3: 准入口径一致性**——applying.md / writing-plans.md / proposing.md 三处 tier 语义互洽:

Run: `rg -n "tier" plugins/speccode/commands/{applying,writing-plans,proposing}.md | rg -i "准入|门禁|单写者|唯一写"`
Expected: 三处口径与 delta 真源一致(1 准入 / 2 路由 / 3 单写者)

- [ ] **Step 4: 命令数 = 24**

Run: `ls plugins/speccode/commands/*.md | wc -l`
Expected: 24

- [ ] **Step 5: 全量测试**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: 全部 pass,0 fail(prose 变更纯回归)

- [ ] **Step 6: 有修复则提交**

```bash
git add -A && git commit -m "docs(speccode): verify tiered flow consistency"
```
(无修复则跳过,不硬跑 commit)

---

## 禁止占位符自检

- 每个任务的文件路径均为精确路径;applying.md 为完整文本,其余为锚点 + 精确插入文本。
- 验证步骤均为可执行命令与可判定期望值。
- 无「TBD / 稍后补充 / 与任务 N 类似」。

## 收尾

全部任务完成并验证后,按 delta 真源「review 无条件化」:本 plan 的执行由 dispatch 方(subagent-driven-development 终审 / executing-plans review 路由)收口,随后 syncing → archiving → finishing-worktree。
