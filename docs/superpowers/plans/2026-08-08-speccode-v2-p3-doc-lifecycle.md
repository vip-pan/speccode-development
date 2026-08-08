# speccode v2 · P3 文档生命周期命令 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建 4 个文档生命周期命令——exploring(纯探索,不产文档)、proposing(四类文档落地 speccode/changes/\<slug\>/propose/)、syncing(delta 合并进 speccode/spec/)、archiving(移入 speccode/archive/)——opsx 对应命令的 agent 驱动改造,全部落盘即 commit。

**Architecture:** 对应 OpenSpec change `speccode-v2-sdd-flow` 的 P3 阶段。opsx 源命令(`.claude/commands/opsx/{explore,propose,sync,archive}.md`)的所有 openspec CLI 依赖(store selection、`openspec new/status/instructions`)全部剥掉,改为纯 agent 驱动 + speccode/ 目录布局;模板与合并语义内嵌在命令 prose 里(不再有 CLI 提供 template/instructions)。**hooks(onExplored/onProposed/onSynced/onArchived)与 memory(read-memory/write-memory/_exploring.md)的接线不在本阶段**——tasks.md 既定分期为 P6(6.4 统一接线)与 P7(7.5 统一接入),本计划的命令文件刻意不含这些调用,评审时不得以此为缺失。

**Tech Stack:** 命令为 markdown prose(无引擎代码改动);speccode 命令 frontmatter 四字段。

## Global Constraints

- 命令 prose 全程中文;frontmatter 恰好四字段 `name / description / category: Workflow / tags`。
- 本阶段命令 MUST NOT 引用尚不存在的 verb(`run-hook`、`read-memory`、`write-memory`)——hooks/memory 接线统一在 P6/P7。
- 文档目录布局(逐字,spec「speccode 文档目录布局」):`speccode/changes/<slug>/{propose,brainstorm,plan}/`、`speccode/spec/`、`speccode/archive/<YYYY-MM-DD>-<slug>/`;slug = 所属 feature 分支的 slug 段。
- 落盘即 commit:proposing/syncing/archiving 的文档变更 MUST 以 `git add` + `git commit` 提交(syncing/archiving 在 worktree-* 分支上运行,绝不直提 trunk)。
- 知识库咨询段(exploring/proposing 共用语义):`read-config` 读 `knowledge_tools`;工具在会话中可用则优先、缺失回退 Grep/Glob/Read、永不报错(knowledge-tool-integration「命令咨询行为」)。
- auto 模式:按工具会话执行模式(Claude Code 自动接受/bypass、Codex auto 等)判断;判断依据不充分 MUST 默认询问(D15/D16)。
- proposing 检测到 `speccode/changes/<slug>/` 已存在且未归档时 MUST 询问(续写补充/先 archiving 再重建/取消),MUST NOT 静默覆盖。
- 提交信息遵守仓库惯例。

## File Structure

- Create `plugins/speccode/commands/exploring.md`
- Create `plugins/speccode/commands/proposing.md`
- Create `plugins/speccode/commands/syncing.md`
- Create `plugins/speccode/commands/archiving.md`
- Modify `openspec/changes/speccode-v2-sdd-flow/tasks.md`(P3 勾选,验收任务内)

---

### Task 1: exploring.md(纯探索命令)

**Files:**
- Create: `plugins/speccode/commands/exploring.md`

**Interfaces:**
- Consumes: `read-config`(读 knowledge_tools)。Produces: 无文件产出(会话上下文);spec 锚点「exploring 纯探索命令」。

- [ ] **Step 1: 写新文件** — `plugins/speccode/commands/exploring.md` 完整内容:

````markdown
---
name: "SpecCode: Exploring"
description: "探索需求:学习/探索/提问澄清,结论留在会话上下文,不写文档;完成后引导建分支"
category: Workflow
tags: [speccode, workflow, explore, thinking]
---

进入探索模式。深入思考,自由可视化,跟随对话的方向。**应在 trunk 分支上运行**(`git rev-parse --abbrev-ref HEAD` 校验,不符则提示切回)。

**重要:探索模式是用来思考的,不是用来实现的。** 你可以读文件、搜代码、调查代码库,但 MUST NOT 写代码或实现功能,也 MUST NOT 写任何文档文件——探索结论只存在于会话上下文(`.speccode/memory/` 运行时记忆不属于文档,其书写由后续阶段的统一接线负责,本命令当前版本不做)。如果用户让你直接实现,提醒他们先结束探索、走 creating-feature → creating-worktree → proposing 流程。

**这是一种姿态,不是一套流程。** 没有固定步骤、没有必需顺序、没有强制产出。你是帮助用户探索的思考伙伴。

**输入**:`/speccode:exploring` 之后的内容就是用户想思考的东西。可能是:一个模糊的想法、一个具体的问题、一个对比选型、或者什么都没说(只是进入探索模式)。

## 姿态

- **好奇,不说教** — 自然产生的问题就问,不按脚本走
- **开放线索,不是审讯** — 同时摆出多个有趣方向,让用户选择共鸣的那个;不要把用户漏斗进单一路径
- **可视化** — ASCII 图能帮助思考时大方使用(系统图、状态机、数据流、架构草图、依赖图、对比表)
- **适应性** — 跟随有趣的线索,新信息出现就转向
- **耐心** — 不急着下结论,让问题的形状自己浮现
- **落地** — 相关时探索真实代码库,不只空谈理论

## 你可能做的事

**探索问题空间**:问澄清问题、挑战假设、重构问题、找类比
**调查代码库**:映射相关架构、找集成点、识别已有模式、暴露隐藏的复杂度
**对比选项**:头脑风暴多个方案、建对比表、勾勒权衡、(被问到时)推荐路径
**暴露风险与未知**:什么地方可能出错、理解上有什么缺口、建议做哪些刺探

## 知识库工具咨询

开头运行 `speccode.mjs read-config --cwd .` 读取 config:
- 若 `knowledge_tools` 非空:逐项判断其能力在当前会话是否可用(对应 MCP server/agent/CLI 是否在场);可用 → 参考代码时 MUST 优先用它(减少代码索引的 token 消耗、更好理解项目);不可用 → 回退 Grep/Glob/Read。
- 若 `knowledge_tools` 为空或 config 缺失:静默使用基础工具。
- 任何情况下工具缺失或不可用 MUST NOT 导致报错。

## 你不必做的事

- 遵循脚本;每次问同样的问题;产出特定工件;必须得出结论;话题跑题但有价值就继续;简短(这是思考时间)

## 结束探索

没有必须的结束方式。探索可能:**流入建分支**("足够清晰了,要建功能分支吗?")、**只提供清晰**(用户拿到了想要的,继续前进)、**稍后继续**("随时可以接着聊")。事情明朗时可以主动给个总结——但这是可选项,有时思考本身就是价值。

## 完成后的衔接(必须)

当用户表示探索结束(或结论已明朗)时:
- **手动模式**:用 AskUserQuestion 询问是否执行 `/speccode:creating-feature` 创建功能分支,以及随后 `/speccode:creating-worktree` 创建开发分支。
- **auto 模式**(当前会话处于 Claude Code 自动接受/bypass、Codex auto 等自主执行模式):自动衔接执行 creating-feature 与 creating-worktree。判断依据不充分时 MUST 默认询问而非自动衔接。

## 护栏

- **不实现** — 不写代码、不实现功能、不写文档文件
- **不假装理解** — 不清楚就深挖
- **不催** — 探索是思考时间,不是任务时间
- **不强行结构化** — 让模式自然浮现
- **要可视化** — 一张好图胜过千言万语
- **要探索代码库** — 讨论落在事实上
- **要质疑假设** — 包括用户的和你自己的
- **不确定就先问** — 不盲目猜测
````

- [ ] **Step 2: 验证**

Run: `git grep -n "openspec\|run-hook\|read-memory\|write-memory" plugins/speccode/commands/exploring.md`
Expected: 零命中(无 openspec CLI 依赖、无未落地 verb)
Run: `git grep -c "speccode:creating-feature\|speccode:creating-worktree" plugins/speccode/commands/exploring.md`
Expected: ≥2(衔接引导存在)

- [ ] **Step 3: Commit**

```bash
git add plugins/speccode/commands/exploring.md
git commit -m "feat(commands): add exploring (opsx explore adaptation, no-doc stance)"
```

### Task 2: proposing.md(四类文档生成 + 复杂度评估 + 落盘即 commit)

**Files:**
- Create: `plugins/speccode/commands/proposing.md`

**Interfaces:**
- Consumes: `read-config`、`reconcile --advance-pr`(归属判定)。Produces: `speccode/changes/<slug>/propose/{proposal.md,design.md,specs/<capability>/spec.md,tasks.md}` + git commit;spec 锚点「proposing 文档生成」「文档阶段落盘即 commit」。

- [ ] **Step 1: 写新文件** — `plugins/speccode/commands/proposing.md` 完整内容:

````markdown
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
4. **tasks.md** — 实现步骤清单,`- [ ]` 复选框,按依赖排序分组。

每写完一个文件展示一行进度("已创建 proposal.md")。全部写完后展示摘要:需求目录路径、四类文档清单、复杂度评估结论。

## 落盘即提交(必须)

文档生成完成后 MUST 立即:
```bash
git add speccode/changes/<slug>/
git commit -m "docs(speccode): propose <slug>"
```

## 下一步引导

- 复杂度高的需求:建议 `/speccode:brainstorming` 精化设计(会回写本目录文档保持一致)。
- 复杂度可控:建议 `/speccode:writing-plans` 直接编写实现计划。

## 护栏

- 文档是 delta 不是主规格;不直接改 `speccode/spec/`(那是 syncing 的职责)。
- 提问优先选择题;一次一个问题;不确定就先问,不盲目猜测。
- 冲突检查未过不写文档;落盘必提交,不把未提交的文档留给下一命令。
````

- [ ] **Step 2: 验证**

Run: `git grep -n "openspec\|run-hook\|read-memory\|write-memory" plugins/speccode/commands/proposing.md`
Expected: 零命中
Run: `git grep -c "speccode/changes/\|git commit" plugins/speccode/commands/proposing.md`
Expected: ≥4(目录布局与落盘提交存在)

- [ ] **Step 3: Commit**

```bash
git add plugins/speccode/commands/proposing.md
git commit -m "feat(commands): add proposing (four doc types, complexity gate, commit-on-write)"
```

### Task 3: syncing.md(增量合并进 speccode/spec/,幂等,落盘即 commit)

**Files:**
- Create: `plugins/speccode/commands/syncing.md`

**Interfaces:**
- Consumes: `read-config`。Produces: `speccode/spec/<capability>/spec.md` 新建或合并 + git commit;spec 锚点「syncing 增量合并」(源契约、brainstorm 残余吸收、幂等、Purpose 权威)。

- [ ] **Step 1: 写新文件** — `plugins/speccode/commands/syncing.md` 完整内容:

````markdown
---
name: "SpecCode: Syncing"
description: "把 changes/<slug>/ 的 delta specs 智能合并进 speccode/spec/ 主规格(brainstorm 优先吸收),幂等,落盘即提交"
category: Workflow
tags: [speccode, workflow, sync, specs]
---

把本次变更的增量规格合并进主规格。这是 **agent 驱动的智能合并**——你直接读 delta 并编辑主规格(允许部分更新,如只加一个 scenario)。全程中文交互。**应在 worktree-* 分支上运行**。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. 确定 slug:从当前 worktree 所属 feature 分支取 slug 段(可用 `speccode.mjs reconcile --cwd .` 的 features 判定归属);`speccode/changes/<slug>/` 不存在 → 报错"未找到需求目录,请先 /speccode:proposing",退出。

## delta 源契约

- delta 源 = `speccode/changes/<slug>/propose/` 下的文档:`specs/<capability>/spec.md` 是必须源;proposal.md / design.md / tasks.md 用于理解意图。
- **brainstorm 残余吸收**:若 `speccode/changes/<slug>/brainstorm/` 存在,先读其中的设计文档,与 propose/ 文档对照:brainstorm 结论中**未回写**到 propose/ 的变更,先补入你对 delta 的理解(以 brainstorm 为更新的权威),再执行合并;已全部回写则直接进入合并。
- 找不到任何 delta spec(`propose/specs/` 为空或不存在)→ 报告"无 delta 可同步"并停止,不从其他工件臆测。

## 合并语义(对每个 capability delta)

读 delta 文件与对应主规格 `speccode/spec/<capability>/spec.md`(可能尚不存在),然后:

- **ADDED Requirements**:主规格没有 → 追加;已存在 → 更新为 delta 内容(视为隐式 MODIFIED)。
- **MODIFIED Requirements**:按名称(逐字)定位主规格中的 requirement,应用部分更新——可以只加 scenario、改 scenario、改正文;delta 未提及的既有内容 MUST 保留。
- **REMOVED Requirements**:从主规格删除整个 requirement 块。
- **RENAMED Requirements**:按 FROM 名称定位,改名为 TO。
- **`## Purpose`**:主规格已有 Purpose → 主规格的权威,不动;新建主规格 → 逐字复制 delta 的 `## Purpose` 正文(没有则写一句简短占位并提示用户补充)。
- **新建主规格**:capability 目录不存在 → 创建 `speccode/spec/<capability>/spec.md`,结构为 `# <capability> Specification` / `## Purpose` / `## Requirements`(MUST NOT 出现 ADDED/MODIFIED/REMOVED/RENAMED 操作头)。

## 要求

- **幂等**:重复执行 MUST 得到相同结果(按 requirement 标题/段落去重;合并后再跑一遍 MUST 无 diff)。
- 合并过程中向用户展示你在改什么(每个 capability 一行:新增/修改/删除/改名了哪些 requirement)。
- 主规格保持 Main Spec 格式;MUST NOT 把 delta 文件原样拷进主规格。

## 落盘即提交(必须)

```bash
git add speccode/spec/
git commit -m "docs(speccode): sync <slug> into main specs"
```

## 输出摘要

合并完成后展示:更新了哪些 capability、各做了什么(新增/修改/删除/改名)、哪些新建主规格的 Purpose 是占位待补。

## 护栏

- delta 源只来自 `speccode/changes/<slug>/`(propose 为主、brainstorm 残余吸收),不从会话记忆臆测。
- 主规格已有内容未被 delta 提及 MUST 原样保留。
- 有不清楚的地方先问用户,不猜测。
- syncing 只动 `speccode/spec/` 并提交;不归档(那是 archiving)、不改 changes/ 内容(brainstorm 残余吸收只影响合并理解,必要时可先把补充回写 propose/ 并一并提交)。
````

- [ ] **Step 2: 验证**

Run: `git grep -n "openspec\|artifactPaths\|run-hook\|read-memory\|write-memory" plugins/speccode/commands/syncing.md`
Expected: 零命中(单源语义已刻意不采用 artifactPaths)
Run: `git grep -c "幂等\|speccode/spec/\|brainstorm" plugins/speccode/commands/syncing.md`
Expected: ≥4(幂等、主规格路径、brainstorm 吸收都在)

- [ ] **Step 3: Commit**

```bash
git add plugins/speccode/commands/syncing.md
git commit -m "feat(commands): add syncing (delta merge into speccode/spec, brainstorm-aware, idempotent)"
```

### Task 4: archiving.md(移动归档 + 检查 + 落盘即 commit)

**Files:**
- Create: `plugins/speccode/commands/archiving.md`

**Interfaces:**
- Consumes: `read-config`、`reconcile`(归属)。Produces: `speccode/archive/<YYYY-MM-DD>-<slug>/` + git commit;spec 锚点「archiving 归档」(任务完成检查、sync 评估、日期不叠加、已存在报错+建议)。

- [ ] **Step 1: 写新文件** — `plugins/speccode/commands/archiving.md` 完整内容:

````markdown
---
name: "SpecCode: Archiving"
description: "归档本次需求变更:speccode/changes/<slug>/ 移入 speccode/archive/<YYYY-MM-DD>-<slug>/,落盘即提交"
category: Workflow
tags: [speccode, workflow, archive]
---

把已完成的需求变更归档。全程中文交互。**应在 worktree-* 分支上运行**(syncing 之后、finishing-worktree 之前)。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. 确定 slug:默认取当前 worktree 所属 feature 的 slug 段;用户也可在命令参数中显式指定。`speccode/changes/<slug>/` 不存在 → 报错退出。

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

## 输出摘要

展示:归档的需求、归档目标路径、sync 状态(已同步 / 用户选择跳过 / 无 delta)、警告(未完成任务数等)。

## 护栏

- 警告(未完成任务、未 sync)只提示与确认,不硬阻断;目标已存在是唯一的硬错误。
- 日期前缀不叠加;已存在不覆盖。
- 归档在当前 worktree 分支上提交,文档随既有 PR 链路上 trunk;绝不直提 trunk。
````

- [ ] **Step 2: 验证**

Run: `git grep -n "openspec\|run-hook\|read-memory\|write-memory" plugins/speccode/commands/archiving.md`
Expected: 零命中
Run: `git grep -c "YYYY-MM-DD\|git commit\|syncing" plugins/speccode/commands/archiving.md`
Expected: ≥4

- [ ] **Step 3: Commit**

```bash
git add plugins/speccode/commands/archiving.md
git commit -m "feat(commands): add archiving (dated move, sync assessment, commit-on-write)"
```

### Task 5: P3 验收

**Files:**
- Modify: `openspec/changes/speccode-v2-sdd-flow/tasks.md`(勾选 P3)

- [ ] **Step 1: 全量测试(引擎无改动,但必须保绿)**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: 全绿(82)

- [ ] **Step 2: 结构断言**

```bash
ls plugins/speccode/commands/ | wc -l   # 期望 11(7 + 4 新)
git grep -ln "openspec" plugins/speccode/commands/exploring.md plugins/speccode/commands/proposing.md plugins/speccode/commands/syncing.md plugins/speccode/commands/archiving.md   # 期望无输出
git grep -c "落盘即提交\|落盘即 commit" plugins/speccode/commands/proposing.md plugins/speccode/commands/syncing.md plugins/speccode/commands/archiving.md   # 每个文件 ≥1
```

- [ ] **Step 3: 勾选 tasks.md P3**

把 `openspec/changes/speccode-v2-sdd-flow/tasks.md` 的 3.1–3.5 勾为 `- [x]`。**注意**:3.1/3.2/3.4 行内的「触发 onExplored/onProposed/onArchived」与「入口 read-memory、出口 write-memory」属于 P6/P7 统一接线(6.4/7.5),本阶段未做是既定分期,勾选时在 3.5 行尾注「(hooks/memory 接线在 P6/P7 统一完成)」。

- [ ] **Step 4: Commit**

```bash
git add openspec/changes/speccode-v2-sdd-flow/tasks.md
git commit -m "docs(openspec): check off P3 tasks of speccode-v2-sdd-flow"
```

---

## Self-Review 记录

- **Spec 覆盖**:sdd-document-lifecycle 的「exploring 纯探索命令」→ T1(不产文档/知识库优先回退/衔接引导/auto 模式四 scenario 全覆盖);「proposing 文档生成」→ T2(四类文档/复杂度评估/冲突检查);「syncing 增量合并」→ T3(源契约/brainstorm 吸收/幂等/Purpose 权威/新建主规格);「archiving 归档」→ T4(任务检查/sync 评估/日期不叠加/已存在报错+建议/移动);「文档阶段落盘即 commit」→ T2/T3/T4 各自的 commit 段;knowledge-tool-integration「命令咨询行为」→ T1/T2 咨询段。
- **Placeholder 扫描**:无 TBD/TODO;四个命令为完整成稿。
- **一致性**:slug 推导(feature slug 段)在 T2/T3/T4 一致;「落盘即提交」段三文件同构;auto 模式措辞与 P2 creating-worktree 一致;均不含 P6/P7 才存在的 verb(验证 grep 保证)。
- **opsx 保真**:explore 的 stance/护栏近逐字;propose 的提问与"不确定先问"保留(CLI 驱动工件循环替换为内嵌四类文档规范);sync 的四段式合并语义/Purpose 权威/幂等/Main Spec 格式全保留(artifactPaths 单源改为 speccode/changes 契约,D11 已声明);archive 的警告不阻断/日期不叠加/已存在报错/inline sync 复验全保留。
