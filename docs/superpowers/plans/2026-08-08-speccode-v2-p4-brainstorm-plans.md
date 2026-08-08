# speccode v2 · P4 brainstorming + writing-plans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建 brainstorming 与 writing-plans 两个命令(superpowers 同名 skill 的近逐字移植 + speccode 适配:文档落 `speccode/changes/<slug>/{brainstorm,plan}/`、回写 propose/、落盘即 commit),并把 visual companion 完整移植进 `plugins/speccode/references/`(路径硬编码 `.superpowers/brainstorm/` → `.speccode/brainstorm/`)。

**Architecture:** 对应 OpenSpec change `speccode-v2-sdd-flow` 的 P4 阶段。移植源:`/Users/game-netease/.claude/plugins/cache/claude-plugins-official/superpowers/6.2.0/skills/brainstorming/`(SKILL.md 151 行、visual-companion.md 298 行、scripts/ 5 文件)与 `.../skills/writing-plans/SKILL.md`。**hooks(onBrainstormed/onPlanned)与 memory 接线不在本阶段**(P6/P7 统一),命令文件不得引用 run-hook/read-memory/write-memory。

**Tech Stack:** 命令为 markdown prose;references 为文件拷贝 + 定点改行(仅 start-server.sh 与 visual-companion.md 有路径改动)。

## Global Constraints

- 命令 prose 全程中文;frontmatter 恰好四字段 `name / description / category: Workflow / tags`。
- ** tuned prose 保真**:HARD-GATE、Red Flags/Rationalizations 类表格、一次一问、分段呈现、self-review、user review gate 等行为塑造内容近逐字保留(可中文化,结构语义不变)。
- 路径重映射(逐字):设计文档 → `speccode/changes/<slug>/brainstorm/YYYY-MM-DD-<topic>-design.md`;计划 → `speccode/changes/<slug>/plan/YYYY-MM-DD-<feature>-plan.md`;companion 产物 → `.speccode/brainstorm/`(目标项目 `.speccode/` 按约定 untracked,无需 .gitignore 提醒);companion 引用 → `${CLAUDE_PLUGIN_ROOT}/references/...`。
- **回写规则(D11)**:brainstorming 落盘设计文档时,MUST 把结论性变更回写 `propose/` 下受影响文档(若 propose/ 存在),保持两处不矛盾。
- **输入优先级(spec「writing-plans 输入优先级」)**:writing-plans MUST 优先读 `brainstorm/`,不存在回退 `propose/`;两者都无 → 报错引导先 proposing/brainstorming。
- 落盘即 commit:两个命令的文档产出 MUST `git add speccode/changes/<slug>/` + commit。
- 分支前置:两命令均 MUST 校验 HEAD 以 `config.worktree_prefix` 开头(同 P3 的 trunk 防护写法),否则退出。
- 本阶段命令 MUST NOT 引用 run-hook/read-memory/write-memory;交叉引用 MUST 用 `/speccode:X` 形式,不得残留 `superpowers:` 引用。
- 不移植:spec-document-reviewer-prompt.md、plan-document-reviewer-prompt.md(legacy,现行 superpowers 已改 inline self-review)。
- 提交信息遵守仓库惯例。

## File Structure

- Create `plugins/speccode/commands/brainstorming.md`
- Create `plugins/speccode/commands/writing-plans.md`
- Create `plugins/speccode/references/visual-companion.md`(拷贝改 5 处)
- Create `plugins/speccode/references/visual-companion-scripts/{server.cjs,start-server.sh,stop-server.sh,helper.js,frame-template.html}`(仅 start-server.sh 改 4 处,其余逐字拷贝)
- Modify `openspec/changes/speccode-v2-sdd-flow/tasks.md`(P4 勾选,验收任务内)

---

### Task 1: brainstorming.md(苏格拉底式设计精化 + 回写)

**Files:**
- Create: `plugins/speccode/commands/brainstorming.md`

**Interfaces:**
- Consumes: `read-config`、`reconcile --advance-pr`(归属 F 与 slug)。Produces: `speccode/changes/<slug>/brainstorm/YYYY-MM-DD-<topic>-design.md` + propose/ 回写 + git commit;spec 锚点「brainstorming 回写一致性」「命令衔接链」(终态引导 writing-plans)。

- [ ] **Step 1: 写新文件** — `plugins/speccode/commands/brainstorming.md` 完整内容:

````markdown
---
name: "SpecCode: Brainstorming"
description: "苏格拉底式设计精化:一次一问、多方案权衡、分段呈现确认;设计落 brainstorm/ 并回写 propose/,落盘即提交"
category: Workflow
tags: [speccode, workflow, brainstorm, design]
---

把想法通过自然协作对话打磨成完整设计。先理解项目现状,再一次一个问题地精化;理解清楚后分段呈现设计并获得用户批准。全程中文交互。

<HARD-GATE>
在呈现设计并获得用户批准之前,禁止调用任何实现类命令、写任何代码、搭建任何脚手架、或采取任何实现动作。对任何项目都一样,无论看起来多简单。
</HARD-GATE>

## 反模式:「这太简单了不需要设计」

每个项目都走这个流程——todo 列表、单函数工具、配置变更,全都是。「简单」项目最容易因未检验的假设浪费工作。设计可以很短(真正简单的项目几句话就够),但 MUST 呈现并获得批准。

## 前置

1. **分支校验**:`git rev-parse --abbrev-ref HEAD` 必须以 `config.worktree_prefix`(默认 `worktree-`)开头;否则退出(`read-config` 先跑,为 null → 提示先 `/speccode:init` 并退出)。
2. 运行 `speccode.mjs reconcile --cwd .`,用返回的 features 找到当前 worktree 所属的功能分支 F;找不到 → 报错退出。计算 slug = F 的 slug 段。
3. **读既有文档**:若 `speccode/changes/<slug>/propose/` 存在,读其中的 proposal/design/specs/tasks 作为脑暴起点;不存在 → 本命令将从零产出设计(简单场景可不经 proposing 直接使用本命令)。
4. **知识库工具咨询**:若 `knowledge_tools` 非空且其能力在会话中可用,参考代码时优先使用;不可用回退 Grep/Glob/Read,不报错。

## 检查清单

你 MUST 为下列每一项创建任务并按序完成:

1. **探索项目上下文** — 文件、文档、近期 commit、propose/ 既有文档
2. **just-in-time 提供 visual companion** — 不是一开始就给。第一次遇到「展示比描述更清楚」的问题时才提供(独立消息);批准后才打开浏览器标签。若全程没有可视化问题,就从不提供。见文末 Visual Companion 节。
3. **澄清问题** — 一次一个,理解目的/约束/成功标准
4. **提出 2-3 个方案** — 带权衡分析和你的推荐
5. **呈现设计** — 分段、每段详略随复杂度,每段后确认
6. **写设计文档** — 落到 `speccode/changes/<slug>/brainstorm/YYYY-MM-DD-<topic>-design.md`
7. **回写 propose/** — 若 propose/ 存在,把结论性变更写回受影响文档,保持两处一致
8. **落盘即提交** — `git add speccode/changes/<slug>/` + `git commit -m "docs(speccode): brainstorm <slug>"`
9. **规格自查** — 占位符/内部一致性/范围/歧义四项 inline 检查(见下)
10. **用户审阅** — 请用户审阅写好的设计文档
11. **衔接实现计划** — 调用 `/speccode:writing-plans`

## 过程

**理解想法:**
- 先看项目当前状态(文件、文档、近期 commit)
- 先评估范围:若需求描述多个独立子系统(如"一个带聊天、文件存储、计费、分析的平台"),立即指出——先帮用户拆成子项目(各子项目各走一轮 文档→计划→实现),再对第一个子项目走正常设计流程
- 规模合适的项目:一次一个问题地精化;优先选择题,开放式也行;一个话题要深挖就拆成多个问题
- 聚焦理解:目的、约束、成功标准

**探索方案:**
- 提出 2-3 个不同方案,带权衡;对话式呈现,先给推荐和理由
- 无情地 YAGNI——从每个方案和设计中删掉不必要的特性

**呈现设计:**
- 理解够了就呈现设计;每段详略随复杂度(简单的几句话,微妙处 200-300 字);每段后问"这部分看起来对吗"
- 覆盖:架构、组件、数据流、错误处理、测试
- 哪里说不通就回去继续澄清

**为隔离与清晰而设计:**
- 把系统拆成更小单元:单一目的、接口明确、可独立理解与测试;每个单元能回答:做什么、怎么用、依赖什么
- 不读内部实现能否理解一个单元?改内部会不会破坏调用方?做不到就是边界要重修
- 文件变大通常是"做太多"的信号

**在既有代码库中工作:**
- 先探索现有结构,跟随既有模式
- 既有代码中影响本工作的问题(文件过大、边界不清、职责纠缠),把针对性改进纳入设计——像好开发者改善自己工作的代码那样
- 不做无关重构,聚焦服务当前目标

## 设计定稿后

**文档与回写:**
- 把验证过的设计写入 `speccode/changes/<slug>/brainstorm/YYYY-MM-DD-<topic>-design.md`
- **回写 propose/**:设计结论与 `propose/` 文档不一致之处(方案替换、范围调整、决策变更),MUST 同步修改 propose/ 下对应文档(proposal.md 的 What Changes、design.md 的 Decisions、specs delta、tasks.md 受影响处),保证两处不矛盾
- 落盘即提交:`git add speccode/changes/<slug>/` + `git commit -m "docs(speccode): brainstorm <slug>"`

**规格自查(写完后以新鲜眼光过一遍,inline 修复):**
1. **占位符扫描**:有没有 TBD、TODO、未完成小节、模糊要求?修掉。
2. **内部一致性**:各节互相矛盾吗?架构与特性描述一致吗?与 propose/ 文档一致吗(回写后)?
3. **范围检查**:聚焦到够一个实现计划吗,还是要再拆?
4. **歧义检查**:任何要求会有两种解读吗?有就选定一种写明确。

**用户审阅门:**
> "设计文档已写好并提交到 `<path>`。请审阅,如需修改告诉我,然后我们再开始写实现计划。"

等用户回复。有修改就改并重跑自查。批准后才继续。

**衔接实现:**
- 调用 `/speccode:writing-plans` 创建详细实现计划。这是唯一终态——MUST NOT 直接开始实现。

## Visual Companion

一个浏览器伴侣,用于脑暴中展示 mockup、图表和可视化选项。它是工具,不是模式——接受它意味着可视化问题可以走浏览器,不代表每个问题都走浏览器。

**提供时机(just-in-time):** 不要一开始提供。等到某个问题 genuinely 展示比描述更清楚时(真实的 mockup/布局/图表问题,不只是 UI 话题),再用**一条独立消息**提供:
> "接下来的部分可能看比听更清楚——我可以在浏览器标签里做 mockup、图表和并排对比。这功能较新且可能耗 token。要开吗?"

**这条提供 MUST 是独立消息**,不含其他内容。等用户回复。接受 → 用 `--open` 启动(浏览器自动打开);拒绝 → 继续纯文本,用户不提就不再提供。

**逐问题决策:** 即使已接受,每个问题都要判断走浏览器还是终端。判据:**用户看比读更好理解吗?** mockup/线框/布局对比/架构图/并排视觉设计 → 浏览器;需求问题、概念选择、权衡列表、A/B/C/D 文字选项、范围决策 → 终端。UI 话题不自动等于可视化问题。

用户同意后,先读详细指南再操作:`${CLAUDE_PLUGIN_ROOT}/references/visual-companion.md`。启动命令:`bash ${CLAUDE_PLUGIN_ROOT}/references/visual-companion-scripts/start-server.sh --project-dir <项目根> --open`(产物持久化到 `.speccode/brainstorm/`)。
````

- [ ] **Step 2: 验证**

Run: `git grep -n "superpowers:\|run-hook\|read-memory\|write-memory\|docs/superpowers" plugins/speccode/commands/brainstorming.md`
Expected: 零命中
Run: `git grep -c "回写\|brainstorm/\|git commit" plugins/speccode/commands/brainstorming.md`
Expected: ≥4

- [ ] **Step 3: Commit**

```bash
git add plugins/speccode/commands/brainstorming.md
git commit -m "feat(commands): add brainstorming (socratic design, propose write-back, commit-on-write)"
```

### Task 2: visual companion 移植(references/)

**Files:**
- Create: `plugins/speccode/references/visual-companion.md`
- Create: `plugins/speccode/references/visual-companion-scripts/server.cjs`
- Create: `plugins/speccode/references/visual-companion-scripts/start-server.sh`
- Create: `plugins/speccode/references/visual-companion-scripts/stop-server.sh`
- Create: `plugins/speccode/references/visual-companion-scripts/helper.js`
- Create: `plugins/speccode/references/visual-companion-scripts/frame-template.html`

**Interfaces:**
- Consumes: superpowers 源目录 `/Users/game-netease/.claude/plugins/cache/claude-plugins-official/superpowers/6.2.0/skills/brainstorming/`。Produces: brainstorming.md(Task 1)引用的指南与脚本;产物目录 `.speccode/brainstorm/`。

- [ ] **Step 1: 拷贝五个脚本文件**

```bash
SRC="/Users/game-netease/.claude/plugins/cache/claude-plugins-official/superpowers/6.2.0/skills/brainstorming"
mkdir -p plugins/speccode/references/visual-companion-scripts
cp "$SRC/scripts/server.cjs" "$SRC/scripts/stop-server.sh" "$SRC/scripts/helper.js" "$SRC/scripts/frame-template.html" plugins/speccode/references/visual-companion-scripts/
cp "$SRC/scripts/start-server.sh" plugins/speccode/references/visual-companion-scripts/
cp "$SRC/visual-companion.md" plugins/speccode/references/visual-companion.md
chmod +x plugins/speccode/references/visual-companion-scripts/start-server.sh plugins/speccode/references/visual-companion-scripts/stop-server.sh
```

- [ ] **Step 2: start-server.sh 改 4 处**(`.superpowers/brainstorm` → `.speccode/brainstorm`):
  - line 9 注释:`Store session files under <path>/.superpowers/brainstorm/` → `.../.speccode/brainstorm/`
  - line 117:`SESSION_DIR="${PROJECT_DIR}/.superpowers/brainstorm/${SESSION_ID}"` → `.speccode/brainstorm/...`
  - line 120:`BRAINSTORM_PORT_FILE="${PROJECT_DIR}/.superpowers/brainstorm/.last-port"` → `.speccode/...`
  - line 121:`BRAINSTORM_TOKEN_FILE=...` 同上

- [ ] **Step 3: visual-companion.md 改 5 处**:
  - line 42-43(启动 JSON 示例):`.superpowers/brainstorm/` → `.speccode/brainstorm/`
  - line 56(查找连接信息):`check \`<project>/.superpowers/brainstorm/\`` → `.speccode/brainstorm/`
  - line 58(Note):`--project-dir` 说明里的 `.superpowers/brainstorm/` → `.speccode/brainstorm/`;**gitignore 提醒改为**:「`.speccode/` 按 speccode 约定保持 untracked,无需加 .gitignore」
  - line 293(结束清理):`.superpowers/brainstorm/` → `.speccode/brainstorm/`
  - 其余内容(含 superpowers 出处品牌)保留不动

- [ ] **Step 4: 验证**

Run: `git grep -rn "\.superpowers" plugins/speccode/references/`
Expected: 零命中(server.cjs 的 `SUPERPOWERS_BRAND_IMAGE_URL` 与品牌链接是 URL/注释,不含 `.superpowers` 路径——若 grep 命中的是 URL 大写形式 `SUPERPOWERS_` 不计;用小写路径模式 `\.superpowers/` 核对)
Run: `bash -n plugins/speccode/references/visual-companion-scripts/start-server.sh && echo syntax-ok`
Expected: syntax-ok

- [ ] **Step 5: Commit**

```bash
git add plugins/speccode/references/
git commit -m "feat(references): port visual companion (paths remapped to .speccode/brainstorm)"
```

### Task 3: writing-plans.md(输入优先级 + 计划落盘)

**Files:**
- Create: `plugins/speccode/commands/writing-plans.md`

**Interfaces:**
- Consumes: `read-config`、`reconcile`(归属与 slug);`brainstorm/` 或 `propose/` 文档。Produces: `speccode/changes/<slug>/plan/YYYY-MM-DD-<feature>-plan.md` + git commit;spec 锚点「writing-plans 输入优先级」「命令衔接链」(终态二选一引导)。

- [ ] **Step 1: 写新文件** — `plugins/speccode/commands/writing-plans.md` 完整内容:

````markdown
---
name: "SpecCode: Writing Plans"
description: "把批准的设计转化为细粒度实现计划(每任务 2-5 分钟步,精确文件路径/完整代码/验证步骤),落 plan/ 并提交"
category: Workflow
tags: [speccode, workflow, plan]
---

编写一份面向「零上下文工程师」的实现计划:他们需要的一切——每个任务动哪些文件、代码、测试、怎么验证——都写进去。拆成一口大小的任务。DRY、YAGNI、TDD、频繁提交。全程中文交互。

**开始时宣布:**"我在用 writing-plans 编写实现计划。"

## 前置

1. **分支校验**:`git rev-parse --abbrev-ref HEAD` 必须以 `config.worktree_prefix` 开头;否则退出(`read-config` 先跑,为 null → 提示先 `/speccode:init` 并退出)。
2. 运行 `speccode.mjs reconcile --cwd .` 找到所属功能分支 F,计算 slug。
3. **读输入文档(优先级固定)**:先读 `speccode/changes/<slug>/brainstorm/`(存在则以其为输入);不存在 → 回退读 `speccode/changes/<slug>/propose/`;两者都不存在 → 报错"未找到设计或需求文档,请先 `/speccode:proposing` 或 `/speccode:brainstorming`",退出。

## 范围检查

若设计覆盖多个独立子系统,应在脑暴阶段已拆成子项目。没拆的话,建议拆成多份计划——一个子系统一份。每份计划都应独立产出可工作、可测试的软件。

## 文件结构

先映射要创建/修改哪些文件、各自职责——分解决策在此锁定:
- 单元边界清晰、接口明确;一个文件一个职责
- 你对能整体装进上下文的代码推理最好;文件变大通常是做太多的信号
- 一起改的文件放在一起;按职责分,不按技术分层
- 既有代码库跟随现有模式;要改的文件已经太臃肿时,可以把拆分纳入计划

## 任务粒度

**一个任务 = 自带测试循环、值得一次独立评审的最小单元。** 任务边界:搭建/配置/脚手架/文档步骤折进需要它的任务;只有「评审者可以有理有据地否决任务 A 却通过任务 B」时才拆分。每个任务以可独立测试的交付物收尾。

**每步一个动作(2-5 分钟):**「写失败测试」是一步;「运行确认失败」是一步;「写最小实现」是一步;「运行确认通过」是一步;「提交」是一步。

## 计划文档头(每份计划 MUST 以此开头)

```markdown
# [特性名] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [一句话目标]
**Architecture:** [2-3 句方法]
**Tech Stack:** [关键技术]

## Global Constraints
[项目级要求——版本下限、依赖限制、命名与文案规则、平台要求——每行一条,
精确值从设计文档逐字拷贝。每个任务的要求隐含包含本节。]
---
```

**Global Constraints 是下游的承重件**:执行时它会被逐字拷进每个任务评审者的派发提示,作为评审的注意力透镜。

## 任务结构

````markdown
### Task N: [组件名]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

**Interfaces:**
- Consumes: [本任务用到前序任务的什么——精确签名]
- Produces: [后续任务依赖什么——精确函数名、参数与返回类型;
  实现者只看得到自己的任务,这一块是他们了解相邻任务命名与类型的唯一途径]

- [ ] **Step 1: 写失败测试**      <真实测试代码块>
- [ ] **Step 2: 运行确认失败**    Run: <cmd>  Expected: FAIL with "..."
- [ ] **Step 3: 写最小实现**      <真实代码块>
- [ ] **Step 4: 运行确认通过**    Run: <cmd>  Expected: PASS
- [ ] **Step 5: 提交**            <git add + git commit -m>
````

TDD 烙进步骤模板本身——每个任务都是「红-绿-提交」循环;步骤 2-5 分钟;`- [ ]` 复选框是执行时的跟踪机制。

## 禁止占位符

以下都是**计划失败**——绝不许写:
- "TBD"、"TODO"、"稍后实现"、"补充细节"
- "加适当的错误处理"、"加校验"、"处理边界情况"
- "为上述写测试"(不给真实测试代码)
- "与任务 N 类似"(重复写代码——任务可能被乱序阅读)
- 只描述做什么不展示怎么做的步骤(代码步骤必须有代码块)
- 引用任何任务都未定义的类型/函数/方法

## 计划自查(写完以新鲜眼光过一遍,inline 修复)

1. **规格覆盖**:扫设计文档每节——每条要求能指到具体任务吗?列出缺口并补任务。
2. **占位符扫描**:对照上表搜全文。修掉。
3. **类型一致性**:后文用的类型/方法签名/属性名与前文定义一致吗?(Task 3 的 `clearLayers()` 到 Task 7 变 `clearFullLayers()` 就是 bug。)

## 保存与提交(必须)

- 计划写到 `speccode/changes/<slug>/plan/YYYY-MM-DD-<feature>-plan.md`。
- 落盘即提交:`git add speccode/changes/<slug>/` + `git commit -m "docs(speccode): plan <slug>"`。

## 执行交接

保存后提供二选一:

**"计划已完成并保存到 `<path>`。两种执行方式:**
**1. Subagent-Driven(推荐)** — 每个任务派发全新子代理,任务间双重审查,快速迭代
**2. Inline 执行** — 用 executing-plans 在本会话分批执行,带人工检查点
**选哪个?"**

- 选 1 → 调用 `/speccode:subagent-driven-development`
- 选 2 → 调用 `/speccode:executing-plans`
````

- [ ] **Step 2: 验证**

Run: `git grep -n "superpowers:\|run-hook\|read-memory\|write-memory\|docs/superpowers" plugins/speccode/commands/writing-plans.md`
Expected: 零命中
Run: `git grep -c "brainstorm/\|propose/\|plan/\|speccode:subagent-driven-development\|speccode:executing-plans" plugins/speccode/commands/writing-plans.md`
Expected: ≥5

- [ ] **Step 3: Commit**

```bash
git add plugins/speccode/commands/writing-plans.md
git commit -m "feat(commands): add writing-plans (brainstorm-first input, plan-on-write commit)"
```

### Task 4: P4 验收

**Files:**
- Modify: `openspec/changes/speccode-v2-sdd-flow/tasks.md`(勾选 P4)

- [ ] **Step 1: 全量测试(无引擎改动,必须保绿)**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: 82/82 绿

- [ ] **Step 2: 结构断言**

```bash
ls plugins/speccode/commands/ | wc -l                     # 期望 13
ls plugins/speccode/references/ plugins/speccode/references/visual-companion-scripts/  # 期望 visual-companion.md + 5 脚本
git grep -rn "\.superpowers/" plugins/speccode/           # 期望零命中
git grep -ln "superpowers:" plugins/speccode/commands/    # 期望无输出
bash -n plugins/speccode/references/visual-companion-scripts/start-server.sh && echo ok
test -x plugins/speccode/references/visual-companion-scripts/start-server.sh && echo exec-ok
```

- [ ] **Step 3: 勾选 tasks.md P4**

把 4.1–4.5 勾为 `- [x]`;4.4(不移植 legacy reviewer-prompt)按 Task 清单复核后勾选;4.2 行尾注「(路径已重映射 .speccode/brainstorm/)」;hooks/memory 接线仍属 P6/P7(在 4.5 行尾注「(hooks/memory 接线在 P6/P7 统一完成)」)。

- [ ] **Step 4: Commit**

```bash
git add openspec/changes/speccode-v2-sdd-flow/tasks.md
git commit -m "docs(openspec): check off P4 tasks of speccode-v2-sdd-flow"
```

---

## Self-Review 记录

- **Spec 覆盖**:sdd-document-lifecycle「brainstorming 回写一致性」→ T1(检查清单第 7 项 + 设计定稿后回写段 + 落盘即提交);「writing-plans 输入优先级」→ T3(前置第 3 条优先级与回退、双缺报错);「命令衔接链」(writing-plans 终态二选一)→ T3 执行交接;「文档阶段落盘即 commit」→ T1/T3;knowledge-tool-integration「命令咨询行为」→ T1 前置第 4 条。
- **Placeholder 扫描**:无 TBD;两个命令为完整成稿;references 拷贝源路径与改行行号精确给出。
- **一致性**:slug/归属判定与 P3 命令同构;`speccode/changes/<slug>/{brainstorm,plan}/` 命名与 spec 目录布局逐字一致;companion 启动路径 `${CLAUDE_PLUGIN_ROOT}/references/visual-companion-scripts/` 在 T1 与 T2 一致。
- **移植保真**:HARD-GATE/反模式/检查清单/过程/自查/审阅门/just-in-time offer 文案/逐问题决策判据均保留;writing-plans 的 header 模板、任务结构、No Placeholders、Self-Review、Execution Handoff 全保留,REQUIRED SUB-SKILL 改 `/speccode:` 形式;legacy 两个 reviewer-prompt 显式不移植。
