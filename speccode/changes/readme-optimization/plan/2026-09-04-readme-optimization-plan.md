# readme-optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 门面四 README(EN/CN)回到 v3 双层拓扑现实并补齐优秀 README 结构(Install 前置 / Basic Workflow / Windows 行 / git clean 警告 / 计数去字面量 / BMAD 对比列),spec delta 由 syncing 合并。

**Architecture:** 纯 prose 改动,零代码。12 个任务 ≡ propose/tasks.md 的 T1-T12;每任务 = 「改 EN → 改 CN → 校验 → 提交」四步(EN/CN 同 commit 防半双语状态);文档任务无 TDD 红绿,以 grep 校验 + 全量测试回归代替。Task 1-9 顺序执行(同文件串行编辑);Task 10 独立文件;Task 11-12 收尾核对。

**Tech Stack:** Markdown;git;`node --test ./plugins/speccode/tests/*.test.mjs`(回归)。

## Global Constraints

- 双语锁步:每条内容改动 EN/CN 在同一 commit;根两版段落一一对应,插件两版 §1-14 节号节序不变。
- 门面计数零字面量:命令总数 / capability 总数 / 测试用例数不得出现在四 README;允许命中仅两类——`Node.js ≥ 24`(依赖下限,EN/CN 各一处)与 badge URL。
- 专名不意译:命令名(`/speccode:*`)、worktree / trunk / feature / spec / Tier / opt-in / syncing 等术语保留原文。
- 提交信息 conventional commits,前缀 `docs(readme):`(门面文件);不改 CLAUDE.md、不改插件 README §1-14 结构、§14 详文保留、不碰 lib / bin / skills / CI。
- 所有编辑以本计划给出的确切文案为准;根 README 现有段落除指明者外不重排。
- 工作目录:全部命令在 worktree 根执行(`/Users/game-netease/orca/workspaces/speccode-development/chore/readme-optimization`)。

---

### Task 1: hero 重排 + Install 节 + 命令速览标题去数(≡ T1)

**Files:**
- Modify: `README.md`(intro 段、badges 之后、`## 24 Commands at a Glance` 标题)
- Modify: `README_CN.md`(同位)

**Interfaces:**
- Produces: `## Install`(EN)/ `## 安装`(CN)节及其锚点 `#install` / `#安装`(Task 5 的 Quickstart 引用);命令速览标题 `## Commands at a Glance` / `## 命令速览`。

- [x] **Step 1: 改 EN——intro 段替换(第 3 行整段)**

将现有 `An end-to-end SDD ... own development.` 一整段(以 "An end-to-end" 开头至 "...own development." 结束的单段落)替换为:

````markdown
**An end-to-end SDD (Spec-Driven Development) and automated development system built on Claude Code** — parallel multi-requirement development, in-repo spec document hosting, and a standardized PR flow, crystallized into a default path by the full `/speccode:*` command set. This repo dogfoods all of it: the spec master, every archived change, and the workflow skills that automate the repo's own development live in-repo.
````

- [x] **Step 2: 改 EN——badges 行(第 7 行)之后插入 Install 节**

````markdown

## Install

```bash
/plugin marketplace add vip-pan/speccode-development
/plugin install speccode@speccode-development
```

Requires [Node.js ≥ 24](#prerequisites) and `git`. After installation, commands appear under the `/speccode:` prefix, e.g. `/speccode:init`, `/speccode:status`, `/speccode:finishing-worktree`.
````

- [x] **Step 3: 改 EN——命令速览标题**

`## 24 Commands at a Glance` → `## Commands at a Glance`(表格与后续两行不动)。

- [x] **Step 4: 改 CN——intro 段替换(第 3 行整段)**

将现有 `基于 Claude Code 的整套 SDD(规格驱动开发)与自动化开发体系——不只是插件,而是一套完整方法论:...` 整段替换为:

````markdown
**基于 Claude Code 的整套 SDD(规格驱动开发)与自动化开发体系** —— 多需求并行开发、spec 文档仓内托管、PR 流程标准化,由全套 `/speccode:*` 命令固化为默认路径。本仓库 dogfood 全部成果:规格主档、每次变更的归档、自动化仓库自身开发的开发工作流 skills,全部仓内托管。
````

- [x] **Step 5: 改 CN——badges 行之后插入安装节**

````markdown

## 安装

```bash
/plugin marketplace add vip-pan/speccode-development
/plugin install speccode@speccode-development
```

依赖 [Node.js ≥ 24](#前置依赖) 与 `git`。安装后命令以 `/speccode:` 前缀出现,如 `/speccode:init`、`/speccode:status`、`/speccode:finishing-worktree`。
````

- [x] **Step 6: 改 CN——命令速览标题**

`## 24 个命令速览` → `## 命令速览`。

- [x] **Step 7: 校验**

Run: `grep -n '24' README.md README_CN.md | grep -v 'Node.js ≥ 24' | grep -v 'Node.js **≥ 24**'`
Expected: 零输出(badge URL 与 Node 下限以外的「24」全部清零;CN 前置依赖行写作 `**Node.js ≥ 24**`,若 grep 语法未命中属正常,以人工过一遍剩余命中均为 URL/版本下限为准)。

- [x] **Step 8: 提交**

```bash
git add README.md README_CN.md
git commit -m "docs(readme): front-load install section, compress hero, drop count literals (EN/CN)"
```

---

### Task 2: Why 段修正——拓扑双层化 + 计数去字面量(≡ T2)

**Files:**
- Modify: `README.md`「## Why speccode」第 1、3 条
- Modify: `README_CN.md`「## 为什么用 speccode」第 1、3 条

**Interfaces:**
- Consumes: 无。Produces: Why 段双层拓扑表述(spec delta 元素「痛点(Why,拓扑表述为双层)」的落地)。

- [x] **Step 1: 改 EN 第 1 条**

旧:`- ✅ **Parallel multi-requirement development** — a three-layer trunk / feature / worktree topology; a reconciliation algorithm automatically assigns every worktree, so multiple features and worktrees proceed in parallel without interfering with each other.`

新:

````markdown
- ✅ **Parallel multi-requirement development** — a two-layer topology: development branches (`<type>/<slug>` git worktrees) cut straight from trunk in one step; a reconciliation algorithm automatically assigns every worktree, so multiple requirements proceed in parallel without interfering with each other.
````

- [x] **Step 2: 改 EN 第 3 条**

旧:`- ✅ **Standardized workflow** — 24 commands + hooks (14 lifecycle events) + cross-session memory turn team conventions into executable primitives.`

新:

````markdown
- ✅ **Standardized workflow** — the full `/speccode:*` command set + lifecycle hooks (closed enumeration) + cross-session memory turn team conventions into executable primitives.
````

- [x] **Step 3: 改 CN 第 1 条**

旧:`- ✅ **多需求并行** —— trunk / feature / worktree 三层拓扑,对账算法自动归属每个 worktree,多 feature、多 worktree 并行施工互不干扰。`

新:

````markdown
- ✅ **多需求并行** —— 双层拓扑:开发分支(`<type>/<slug>`,git worktree)从 trunk 一步直达;对账算法自动归属每个 worktree,多需求并行施工互不干扰。
````

- [x] **Step 4: 改 CN 第 3 条**

旧:`- ✅ **流程标准化** —— 24 命令 + hooks(14 个生命周期事件)+ 跨会话 memory,团队约定变成可执行原语。`

新:

````markdown
- ✅ **流程标准化** —— 全套 `/speccode:*` 命令 + 生命周期 hooks(封闭枚举)+ 跨会话 memory,团队约定变成可执行原语。
````

- [x] **Step 5: 校验**

Run: `grep -in 'three-layer\|三层拓扑\|24 commands\|24 命令\|14 lifecycle\|14 个生命周期' README.md README_CN.md`
Expected: 零输出。

- [x] **Step 6: 提交**

```bash
git add README.md README_CN.md
git commit -m "docs(readme): two-layer topology wording + count literals out of Why (EN/CN)"
```

---

### Task 3: 新增 The Basic Workflow 段(≡ T3)

**Files:**
- Modify: `README.md`(Why 段末尾与 `## See It in Action` 之间插入)
- Modify: `README_CN.md`(同位)

**Interfaces:**
- Produces: 锚点 `#the-basic-workflow` / `#基础工作流`(Task 5 的 Quickstart 引用)。

- [x] **Step 1: EN 插入块**

````markdown

## The Basic Workflow

1. **exploring** — clarify the requirement on trunk; the exit decides its shape (single / several independent / large).
2. **creating-worktree** — one step from trunk to a development branch in its own worktree, baseline tests green.
3. **proposing** — land proposal / design / specs / tasks documents; commits on save; the exit assigns a tier.
4. **applying** (tiny changes) or **writing-plans + subagent-driven-development / executing-plans** — implement.
5. **requesting-code-review** — dispatch a review subagent; process feedback technically.
6. **syncing → archiving** — merge the delta into the spec master, archive the change.
7. **finishing-worktree** — test gate, then PR → trunk. (Large requirements: squash into an opt-in integration branch, finale via finishing-feature.)
````

- [x] **Step 2: CN 插入块**

````markdown

## 基础工作流

1. **exploring** —— 在 trunk 上把需求聊清楚,出口判定形态(单需求 / 多个独立 / 大需求)。
2. **creating-worktree** —— 从 trunk 一步切出开发分支(git worktree),基线测试全绿。
3. **proposing** —— 落地 proposal / design / specs / tasks 四类文档,落盘即提交,出口定层。
4. **applying**(极小需求)或 **writing-plans + subagent-driven-development / executing-plans** —— 实现。
5. **requesting-code-review** —— 派发审查子代理,技术化处理反馈。
6. **syncing → archiving** —— delta 并入规格主档,归档本次变更。
7. **finishing-worktree** —— 测试门禁,PR → trunk。(大需求:本地 squash 汇入 opt-in 集成分支,终局 finishing-feature。)
````

- [x] **Step 3: 校验**

Run: `grep -c '^[0-9]\.' README.md README_CN.md`
Expected: 两文件各含 Basic Workflow 的 7 条 + 原有有序清单;人工确认两版新段各 7 步、段序一致(Why 之后、See It in Action / 看它干活 之前)。

- [x] **Step 4: 提交**

```bash
git add README.md README_CN.md
git commit -m "docs(readme): add The Basic Workflow numbered steps (EN/CN)"
```

---

### Task 4: demo 改演普通需求路径(≡ T4)

**Files:**
- Modify: `README.md`「## See It in Action」console 块整体替换
- Modify: `README_CN.md`「## 看它干活」console 块整体替换

**Interfaces:**
- Consumes: 无。Produces: 普通需求路径演示(spec delta「体验 demo(普通需求路径)」落地)。

- [x] **Step 1: EN console 块替换为**

````markdown
```console
$ /speccode:init                      # probe remote/trunk/code intelligence, write .speccode/config.json
✓ config ready: trunk=main, remote=origin, pr_tool=gh
$ /speccode:creating-worktree
✓ feature/demo-api checked out in its own worktree, baseline tests all pass
$ /speccode:proposing
✓ proposal/design/specs/tasks committed on save
$ /speccode:applying                  # Tier 1: implement tasks.md item-by-item
✓ tasks implemented, ticked, and committed
$ /speccode:requesting-code-review
✓ review passed
$ /speccode:finishing-worktree
✓ test gate passed, PR opened → trunk
```
````

- [x] **Step 2: CN console 块替换为**

````markdown
```console
$ /speccode:init                      # 探测远端/主干/代码智能工具,写 .speccode/config.json
✓ config 就绪: trunk=main, remote=origin, pr_tool=gh
$ /speccode:creating-worktree
✓ feature/demo-api 已切出到独立 worktree,基线测试全通过
$ /speccode:proposing
✓ proposal/design/specs/tasks 四类文档落盘即提交
$ /speccode:applying                  # Tier 1:按 tasks.md 逐条实现
✓ 条目实现、勾选、簿记提交完成
$ /speccode:requesting-code-review
✓ 审查通过
$ /speccode:finishing-worktree
✓ 测试门禁通过,PR 已开往 trunk
```
````

- [x] **Step 3: 校验**

Run: `grep -n 'creating-feature\|finishing-feature\|merged back into feature\|merged to trunk' README.md README_CN.md`
Expected: 零输出(demo 段不再含 opt-in 命令与 v2 文案;贡献段的 creating-feature 提及属 Task 8 处理,若此时仍命中,记录待 Task 8 清零)。

- [x] **Step 4: 提交**

```bash
git add README.md README_CN.md
git commit -m "docs(readme): demo plays the normal-requirement path (EN/CN)"
```

---

### Task 5: Prerequisites Windows 行 + Quickstart 重排(≡ T5)

**Files:**
- Modify: `README.md`「## Prerequisites」清单末尾 + 「## Quickstart (5-Minute Minimal Loop)」整体
- Modify: `README_CN.md`「## 前置依赖」+ 「## Quickstart (5 分钟最小闭环)」整体

**Interfaces:**
- Consumes: Task 1 的 `#install` / `#安装` 锚点;Task 3 的 `#the-basic-workflow` / `#基础工作流` 锚点。

- [x] **Step 1: EN Prerequisites 末尾追加一行**

````markdown
- **Windows is not supported** — macOS / Linux only
````

- [x] **Step 2: EN Quickstart 整节替换为**

````markdown
## Quickstart (5-Minute Minimal Loop)

1. [Install](#install) the plugin.
2. Run `/speccode:init` in your project to initialize configuration.
3. Run `/speccode:creating-worktree` to cut your first development branch (a git worktree) and get baseline tests green.
4. Run `/speccode:status` to see the whole picture.

For the full path from requirement to PR, see [The Basic Workflow](#the-basic-workflow).
````

- [x] **Step 3: CN 前置依赖末尾追加一行**

````markdown
- **Windows 暂不支持** —— 仅 macOS / Linux
````

- [x] **Step 4: CN Quickstart 整节替换为**

````markdown
## Quickstart (5 分钟最小闭环)

1. 先[安装](#安装)插件。
2. 在你的项目里运行 `/speccode:init` 初始化配置。
3. 运行 `/speccode:creating-worktree` 切出首个开发分支(git worktree),基线测试转绿。
4. 运行 `/speccode:status` 查看全貌。

从需求到 PR 的完整路径见[基础工作流](#基础工作流)。
````

- [x] **Step 5: 校验**

Run: `grep -n 'creating-feature' README.md README_CN.md | grep -v 'how we compare\|和谁比'`
Expected: Quickstart/Prerequisites 无 creating-feature(Creating 前的任务完成前,贡献段可能仍命中一次,Task 8 清零)。

- [x] **Step 6: 提交**

```bash
git add README.md README_CN.md
git commit -m "docs(readme): windows line in prerequisites, quickstart via creating-worktree (EN/CN)"
```

---

### Task 6: 拓扑节双层化(≡ T6)

**Files:**
- Modify: `README.md`「## Three-Layer Branch Topology」标题 + 代码块 + 「See [plugin README §3]」行
- Modify: `README_CN.md`「## 三层分支拓扑」同位

**Interfaces:**
- Consumes: 无。Produces: 双层拓扑图(spec delta「双层分支拓扑图」落地)。

- [x] **Step 1: EN 整节替换为**

`````markdown
## Two-Layer Branch Topology

```
normal requirement (default):
origin/trunk ──┬── feature/a  (dev branch = git worktree) ── finishing-worktree: test gate → PR → trunk
               ├── feature/b  (parallel)                    ── ─┘
               └── ...
     speccode/ spec documents are tracked on every branch and ride the PR chain up to trunk

large requirement (opt-in):
origin/trunk ── integration branch ──┬── feature/s1 ── finishing-worktree: local squash
                                     └── feature/s2 ── ─┘
                                          finishing-feature: children all completed → single PR → trunk
```

See [plugin README §3](./plugins/speccode/README.md) for the full topology and key points.
`````

- [x] **Step 2: CN 整节替换为**

`````markdown
## 双层分支拓扑

```
普通需求(默认):
origin/trunk ──┬── feature/a(开发分支 = git worktree)── finishing-worktree:测试门禁 → PR → trunk
               ├── feature/b(并行)                    ── ─┘
               └── ...
     speccode/ 规格文档在所有分支 tracked,随 PR 链路上 trunk

大需求(opt-in):
origin/trunk ── 集成分支 ──┬── feature/s1 ── finishing-worktree:本地 squash
                          └── feature/s2 ── ─┘
                               finishing-feature:children 全 completed → 单 PR → trunk
```

完整拓扑与要点见 [插件 README §3](./plugins/speccode/README_CN.md)。
`````

- [x] **Step 3: 校验**

Run: `grep -n 'Three-Layer\|三层分支拓扑\|worktree-a' README.md README_CN.md`
Expected: 零输出。

- [x] **Step 4: 提交**

```bash
git add README.md README_CN.md
git commit -m "docs(readme): two-layer topology section (EN/CN)"
```

---

### Task 7: 对比矩阵加 BMAD 列 + 行 1 双层化(≡ T7)

**Files:**
- Modify: `README.md`「## How We Compare」表格
- Modify: `README_CN.md`「## 和谁比」表格

**Interfaces:**
- Consumes: design.md D5 的 BMAD 保守标注(2026-09-04 基于其 README 主页核对)。

- [x] **Step 1: EN 表格替换为**

````markdown
| Capability | speccode | [superpowers](https://github.com/obra/superpowers) | [spec-kit](https://github.com/github/spec-kit) | [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) | ad-hoc |
|---|---|---|---|---|---|
| Two-layer branch topology + reconciliation (parallel worktrees) | ✅ | — | — | — | — |
| In-repo spec document hosting (tracked on all branches) | ✅ | — | partial | partial | — |
| Native Claude Code plugin | ✅ | ✅ | — (cross-agent CLI) | — (npx installer) | — |
| SDD methodology (explore / document / plan / execute / review) | ✅ (self-contained port) | ✅ (source) | — | ✅ (own system) | — |
| Lifecycle hooks + cross-session memory | ✅ | — | — | — | — |
| Standardized PR/MR flow | ✅ | — | — | — | — |
````

表格后原有收束句(`Where ad-hoc conventions leave ...`)不动。

- [x] **Step 2: CN 表格替换为**

````markdown
| 能力 | speccode | [superpowers](https://github.com/obra/superpowers) | [spec-kit](https://github.com/github/spec-kit) | [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) | 手工约定 |
|---|---|---|---|---|---|
| 双层分支拓扑 + 对账(多 worktree 并行) | ✅ | — | — | — | — |
| spec 文档仓内托管(全分支 tracked) | ✅ | — | 部分 | 部分 | — |
| Claude Code 原生插件 | ✅ | ✅ | —(跨 agent CLI) | —(npx 安装器) | — |
| SDD 方法论(探索/文档/计划/执行/评审) | ✅(自包含移植) | ✅(来源) | — | ✅(自有体系) | — |
| 生命周期 hooks + 跨会话 memory | ✅ | — | — | — | — |
| PR/MR 流程标准化 | ✅ | — | — | — | — |
````

表格后原有收束句(`手工约定把「文档放哪 / 从哪个分支切 / PR 谁开」留给人脑...`)不动。

- [x] **Step 3: 校验**

Run: `grep -n 'BMAD' README.md README_CN.md | wc -l` 与 `grep -n 'Three-layer branch topology\|三层分支拓扑 + 对账' README.md README_CN.md`
Expected: BMAD 每版 2 命中(列头链接 + 表格单元为空则 1 命中,以人工确认列头存在为准);行 1 旧措辞零输出。

- [x] **Step 4: 提交**

```bash
git add README.md README_CN.md
git commit -m "docs(readme): comparison matrix gains BMAD column, two-layer row (EN/CN)"
```

---

### Task 8: 文档地图与贡献段修正(≡ T8)

**Files:**
- Modify: `README.md`「## Documentation Map」两行 + 「## Contributing」流程链
- Modify: `README_CN.md`「## 文档地图」两行 + 「## 贡献」流程链

**Interfaces:**
- Consumes: 无。Produces: 无计数、双层表述的文档地图(spec delta 元素落地)。

- [x] **Step 1: EN 文档地图两行替换**

`| [Plugin README](./plugins/speccode/README.md) | 24-command reference, three-layer topology, R1-R13 risks, 0.1 → 0.2 migration (plugin design document) |` →
`| [Plugin README](./plugins/speccode/README.md) | Full command reference, two-layer topology, R1-R13 risks, 0.1 → 0.2 migration (plugin design document) |`

`| `speccode/spec/` · `speccode/archive/` | SDD spec master (11 capabilities) and archived change records — the system's own living documentation |` →
`| `speccode/spec/` · `speccode/archive/` | SDD spec master and archive of every change — the system's own living documentation |`

- [x] **Step 2: EN 贡献段流程链——已由上游修复,核对即跳过**

> 回写修订(执行期):上游 #50(fe1747e)已把贡献段链路改为普通链路(exploring → creating-worktree → … → finishing-worktree),本步骤原计划的替换(creating-feature 链 → 普通链)已无事可做,执行时核对现状并跳过,不再添加 opt-in 注记(上游已选详细链路表述,追加属范围蔓延)。

- [x] **Step 3: CN 文档地图两行替换**

`| [插件 README](./plugins/speccode/README_CN.md) | 24 命令详表、三层拓扑、R1-R13 风险、0.1→0.2 迁移(插件设计文档) |` →
`| [插件 README](./plugins/speccode/README_CN.md) | 全套命令详表、双层拓扑、R1-R13 风险、0.1→0.2 迁移(插件设计文档) |`

`| `speccode/spec/` · `speccode/archive/` | SDD 规格主档(11 个 capability)与变更归档——体系自身的活文档 |` →
`| `speccode/spec/` · `speccode/archive/` | SDD 规格主档与变更归档——体系自身的活文档 |`

- [x] **Step 4: CN 贡献段流程链——已由上游修复,核对即跳过**

> 回写修订(执行期):同 Step 2,CN 版贡献段链路已由上游 #50 修复,核对现状并跳过。

- [x] **Step 5: 校验**

Run: `grep -n '11 capabilit\|11 个 capability\|three-layer topology\|三层拓扑' README.md README_CN.md`
Expected: 零输出。

- [x] **Step 6: 提交**

```bash
git add README.md README_CN.md
git commit -m "docs(readme): doc map and contributing chain to two-layer reality (EN/CN)"
```

---

### Task 9: 新增 git clean 安全警告节(≡ T9)

**Files:**
- Modify: `README.md`(「## Documentation Map」与「## Contributing」之间插入)
- Modify: `README_CN.md`(「## 文档地图」与「## 贡献」之间插入)

**Interfaces:**
- Consumes: 插件 README §14 详文(保留不迁,仅指向)。Produces: spec delta「安全警告节」落地。

- [x] **Step 1: EN 插入块**(链接用文件级链接 + 「§14」文字,不用锚点——规避 emoji 标题锚点死链风险)

````markdown

## ⚠ Before You Run `git clean`

`.speccode/` is untracked by design and **not** added to `.gitignore` — `git clean -fdx` (and even `-fd`) will delete your speccode config, branch states, and session memory. Prefer a dry-run first (`git clean -n`) or exclude the path explicitly. See [plugin README §14](./plugins/speccode/README.md) for the full details.
````

- [x] **Step 2: CN 插入块**

````markdown

## ⚠ 执行 `git clean` 前必读

`.speccode/` 目录按设计不被 git 跟踪、**不会**被加入 `.gitignore` —— `git clean -fdx`(乃至 `-fd`)会删除你的 speccode 配置、分支状态与会话记忆。建议先 dry-run(`git clean -n`)或显式排除该路径。详见[插件 README §14](./plugins/speccode/README_CN.md)。
````

- [x] **Step 3: 校验**

Run: `grep -n 'git clean' README.md README_CN.md`
Expected: 各 3+ 命中(标题 + 正文 dry-run + 链接行),两版结构一致。

- [x] **Step 4: 提交**

```bash
git add README.md README_CN.md
git commit -m "docs(readme): front-load git clean safety warning (EN/CN)"
```

---

### Task 10: 插件 README 去数 + 知识行瘦身(≡ T10)

**Files:**
- Modify: `plugins/speccode/README.md`(ToC 第 2 条、§2 标题、知识两命令行)
- Modify: `plugins/speccode/README_CN.md`(同位)

**Interfaces:**
- Consumes: 无。Produces: 插件 README 计数零字面量(spec delta「全套命令表」落地);§1-14 节号节序不变。

- [x] **Step 1: EN 标题与 ToC**

`## 2. 24-Command Quick Reference` → `## 2. Command Quick Reference`
ToC 内 `2. [24-Command Quick Reference](#2-24-command-quick-reference)` → `2. [Command Quick Reference](#2-command-quick-reference)`

- [x] **Step 2: EN 知识两行替换(distilling-knowledge / recording-knowledge 两个表格行整行)**

````markdown
| `/speccode:distilling-knowledge` | Distill the `speccode/knowledge/` topic files from `spec/` (full read — the freshness anchor) + `archive/` (**incremental**, tracked via `knowledge/_distilled.meta.json`); distilled blocks are keyed by capability and upserted each run, every block freshness-audited against the current specs; human gate before write; commits on save | chore/knowledge-* worktree branch (unified creating-worktree entry, finishing-worktree finish) |
| `/speccode:recording-knowledge` | Record knowledge directly into hand-written sections (fit check: process knowledge stays, business knowledge is pointed to external RAG; draft → human gate → atomic `replace-hand` write, distilled blocks preserved byte-for-byte); also tidies the topic's existing hand-written section each run; commits on save | chore/knowledge-* worktree branch (unified entry/finish) |
````

- [x] **Step 3: CN 标题与 ToC**

`## 2. 24 个命令快速参考表` → `## 2. 命令快速参考表`
ToC 内 `2. [24 个命令快速参考表](#2-24-个命令快速参考表)` → `2. [命令快速参考表](#2-命令快速参考表)`

- [x] **Step 4: CN 知识两行替换**

````markdown
| `/speccode:distilling-knowledge` | 从 spec/(全量读——新鲜度锚点)+ archive/(**增量**,经 `knowledge/_distilled.meta.json` 追踪)蒸馏 knowledge/ 各 topic;蒸馏块以能力为键、每次运行 upsert,且逐块对照当前 spec 做新鲜度审查;人工闸门后落盘,落盘即提交 | chore/knowledge-* worktree 分支(creating-worktree 统一入口、finishing-worktree 统一收尾)|
| `/speccode:recording-knowledge` | 知识直接记录进 hand-written 段(适配判断:过程知识收录,业务知识建议进外部 RAG;草稿 → 人工闸门 → 经 `replace-hand` 原子整写,distilled 块逐字节保留;每次运行同时整理该 topic 既有 hand-written 段),落盘即提交 | chore/knowledge-* worktree 分支(统一入口/收尾)|
````

- [x] **Step 5: 校验**

Run: `grep -n '24-Command\|24 个命令\|24 commands' plugins/speccode/README.md plugins/speccode/README_CN.md`
Expected: 零输出。另:`grep -c '^## ' plugins/speccode/README.md` 确认 §1-14 共 15 个二级标题(含文档头注记行以外的节),两版节号一致。

- [x] **Step 6: 提交**

```bash
git add plugins/speccode/README.md plugins/speccode/README_CN.md
git commit -m "docs(readme): plugin readme count literals out, knowledge rows trimmed (EN/CN)"
```

---

### Task 11: 双语对齐 + 互链点检(≡ T11,不改内容)

**Files:**
- Verify: `README.md` / `README_CN.md` / `plugins/speccode/README.md` / `plugins/speccode/README_CN.md`

**Interfaces:**
- Consumes: Task 1-10 的全部产出。

- [x] **Step 1: 段落一一对应**

Run: `grep -c '^## ' README.md README_CN.md && grep -n '^## ' README.md | sed 's/^[0-9]*:## //' && echo --- && grep -n '^## ' README_CN.md | sed 's/^[0-9]*:## //'`
Expected: 两版 `## ` 数量一致;逐行人工比对段序:Why speccode(为什么用 speccode)→ The Basic Workflow(基础工作流)→ See It in Action(看它干活)→ Prerequisites(前置依赖)→ Quickstart → Commands at a Glance(命令速览)→ Two-Layer Branch Topology(双层分支拓扑)→ How We Compare(和谁比)→ Philosophy(理念)→ Documentation Map(文档地图)→ ⚠ git clean(⚠ 执行 git clean 前必读)→ Contributing(贡献)→ License;外加 EN 的 Install 与 CN 的 安装。

- [x] **Step 2: 互链矩阵 4 组点检**

Run: `head -6 README.md README_CN.md plugins/speccode/README.md plugins/speccode/README_CN.md | grep -n 'README'` 与 `grep -n 'plugins/speccode/README' README.md README_CN.md | grep -v '#'`
Expected: 根 EN↔CN 语言切换互链、插件 EN↔CN 互链、根 EN→插件 EN / 根 CN→插件 CN、插件→根同语言指针,四组均指向存在文件(`test -e` 抽查)。

- [x] **Step 3: 提交(无内容变更则跳过)**

Expected: `git status --porcelain` 为空 → 本任务零提交;非空(如顺手修正的死链)→ 一并提交 `docs(readme): fix bilingual/link nits from verification (EN/CN)`。

---

### Task 12: 全局终扫 + 基线测试(≡ T12,不改内容)

**Files:**
- Verify: 全部门面文件

- [ ] **Step 1: 计数与 v2 措辞终扫**

Run: `grep -in 'three-layer\|三层拓扑\|24 commands\|24 个命令\|24-Command\|24 命令\|11 capabilit\|11 个 capability\|merged back into feature\|worktree-a' README.md README_CN.md plugins/speccode/README.md plugins/speccode/README_CN.md`
Expected: 零输出。允许命中逐条豁免并记录(预期仅 `Node.js ≥ 24` 与 badge URL)。

- [ ] **Step 2: 基线测试回归**

Run: `node --test ./plugins/speccode/tests/*.test.mjs 2>&1 | tail -4`
Expected: `pass 279`,`fail 0`。

- [ ] **Step 3: 提交(无内容变更则跳过)**

Expected: 零提交(纯验证);若终扫发现残留,回到对应任务修复后重跑本任务。
