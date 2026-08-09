# openspec / superpowers → speccode 自托管转换 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把本仓的开发工作流从 OpenSpec + superpowers 整体切换到 speccode v2 原生流程,转换本身作为首个 dogfood feature(`chore/self-host-speccode`)走完全链路。

**Architecture:** 先在 main 上初始化 speccode(untracked config),再按 v2 流程切 feature/worktree;worktree 内依次完成 proposing 四类文档、`git mv` 原样播种 openspec 规格与归档、tracked 文件引用清除、syncing 合并 2 条 MODIFIED delta、archiving 归档;最后 finishing-worktree → finishing-feature 单 PR 合入 main,合并后做本地 untracked 清理。

**Tech Stack:** git / `node plugins/speccode/bin/speccode.mjs`(CLI verbs)/ gh / `node --test`

**设计依据:** `docs/superpowers/specs/2026-08-10-openspec-superpowers-to-speccode-design.md`(已批准,D1-D4 决策在案)

## Global Constraints

- 全程中文交互与中文文档。
- 本会话加载的插件是 v0.1 命令集,**一律手动驱动 v2 命令文件**,引擎调用形式:`node plugins/speccode/bin/speccode.mjs <verb> --cwd .`(下文简写 `speccode.mjs`);写 verb 必须 `--json-stdin` + heredoc,不用 argv 传 JSON。
- 全量测试命令(必须用 glob 形式):`node --test ./plugins/speccode/tests/*.test.mjs`,预期 **134 通过**;裸目录形式在 Node v24 会 MODULE_NOT_FOUND,禁止用。
- tracked 文件改动只发生在 worktree 分支(`worktree-self-host-speccode`)上;init 的 config、state、memory 均为 untracked,不产生 commit。
- **不修改 `.gitignore`**;不碰 `docs/superpowers/`、`CHANGELOG.md`、迁入后的 `speccode/archive/` 历史内容、`plugins/speccode/lib/sdd.mjs:32` 注释、`plugins/speccode/README.md:9` 与 `CLAUDE.md:7` 的移植出处句(均为事实陈述)。
- 每个 hook 调用在 config 无 `hooks` 字段时是 no-op(返回 `ok:true`),仍按命令文件执行以保流程完整。
- 分支/命名:feature = `chore/self-host-speccode`,worktree = `worktree-self-host-speccode`,changes 目录 = `speccode/changes/self-host-speccode/`,归档 = `speccode/archive/2026-08-10-self-host-speccode/`(若跨日以实际日期为准)。

---

### Task 1: speccode init(main 上,写 untracked config)

**Files:**
- Create: `.speccode/config.json`(untracked,仅经 write-config verb 原子写)

**Interfaces:**
- Produces: config v2 `{version, initialized_at, trunk:"main", remote:"origin", pr_tool:"gh", worktree_prefix:"worktree-", worktree_dir:".claude/worktrees", knowledge_tools:[]}`(无 hooks 字段),后续所有任务依赖。

- [ ] **Step 1: 确认在 main 且工作区干净**

```bash
git rev-parse --abbrev-ref HEAD   # 预期 main
git status --porcelain            # 预期空(plan 文档已先行提交)
```

- [ ] **Step 2: 探测(结果已向用户展示确认,设计 §6 已批准参数)**

```bash
node plugins/speccode/bin/speccode.mjs resolve-speccode-dir --cwd .
node plugins/speccode/bin/speccode.mjs read-config --cwd .        # 预期 config 为 null(全新 init)
node plugins/speccode/bin/speccode.mjs detect-remote --cwd .      # 预期 prToolGuess=gh, installed=true
git symbolic-ref refs/remotes/origin/HEAD                          # 预期 refs/remotes/origin/main → trunk=main
node plugins/speccode/bin/speccode.mjs detect-knowledge-tools --cwd .  # 预计空;有输出则逐项与用户确认
```

- [ ] **Step 3: 写 config(heredoc + --json-stdin;`<ISO>` 填当前 UTC 时间,如 2026-08-10T02:00:00.000Z)**

```bash
node plugins/speccode/bin/speccode.mjs write-config --cwd . --json-stdin <<'EOF'
{"version":2,"initialized_at":"<ISO>","trunk":"main","remote":"origin","pr_tool":"gh","worktree_prefix":"worktree-","worktree_dir":".claude/worktrees","knowledge_tools":[]}
EOF
```

- [ ] **Step 4: 验证**

```bash
node plugins/speccode/bin/speccode.mjs read-config --cwd .   # 预期返回上述 config,version=2
git status --porcelain                                        # 预期仍空(.speccode/ 被 gitignore)
```

### Task 2: creating-feature `chore/self-host-speccode`(main 上)

**Files:**
- Create: `.speccode/state/features/chore__self-host-speccode.json`(untracked,仅经 write-state verb)
- Create: `.speccode/memory/chore__self-host-speccode.md`(untracked,仅经 write-memory verb)

**Interfaces:**
- Consumes: Task 1 的 config(`trunk=main`)
- Produces: 本地+远端分支 `chore/self-host-speccode`;state `{feature_branch, created_at, initial_branch:"main", status:"in_progress", worktrees:{}}`

- [ ] **Step 1: 前置校验 + 分支不存在校验**

```bash
git rev-parse --abbrev-ref HEAD                              # 预期 main(= config.trunk)
git rev-parse --verify chore/self-host-speccode              # 预期失败(不存在)
git ls-remote origin chore/self-host-speccode                # 预期空
```

(type/slug 已定为 chore/self-host-speccode,跳过扫描推断;slug 匹配 `^[a-z0-9-]+$` ✓,分支名恰好一个 `/` ✓)

- [ ] **Step 2: 创建并推送**

```bash
git checkout -b chore/self-host-speccode
git push -u origin chore/self-host-speccode
```

- [ ] **Step 3: 写 state(`<ISO>` 同上)**

```bash
node plugins/speccode/bin/speccode.mjs write-state --cwd . --branch chore/self-host-speccode --json-stdin <<'EOF'
{"feature_branch":"chore/self-host-speccode","created_at":"<ISO>","initial_branch":"main","status":"in_progress","worktrees":{}}
EOF
```

- [ ] **Step 4: memory 骨架(先读 `_exploring`;预期 null → 骨架填「无」,且跳过清空步骤)**

```bash
node plugins/speccode/bin/speccode.mjs read-memory --cwd . --branch _exploring
node plugins/speccode/bin/speccode.mjs write-memory --cwd . --branch chore/self-host-speccode --json-stdin <<'EOF'
{"mode":"replace","content":"# chore/self-host-speccode 记忆\n- 创建于 <ISO>\n- exploring 结论:无(设计依据 docs/superpowers/specs/2026-08-10-openspec-superpowers-to-speccode-design.md)"}
EOF
```

- [ ] **Step 5: onFeatureCreated 钩子(no-op)**

```bash
echo '{"command":"creating-feature","feature_branch":"chore/self-host-speccode"}' | node plugins/speccode/bin/speccode.mjs run-hook --cwd . --event onFeatureCreated
```

- [ ] **Step 6: 验证**

```bash
node plugins/speccode/bin/speccode.mjs reconcile --cwd .   # features 含 chore/self-host-speccode,无 conflicts
git branch --show-current                                   # 预期 chore/self-host-speccode
```

### Task 3: creating-worktree `worktree-self-host-speccode`(feature 分支上)

**Files:**
- Create: `.claude/worktrees/worktree-self-host-speccode/`(git worktree,untracked)
- Modify: `.speccode/state/features/chore__self-host-speccode.json`(加 worktrees 条目,经 write-state)

**Interfaces:**
- Consumes: Task 2 的 feature 分支与 state
- Produces: worktree 分支 `worktree-self-host-speccode`;state `worktrees["worktree-self-host-speccode"]={status:"in_progress"}`;Task 4-9 全部在该 worktree 内执行

- [ ] **Step 1: 前置(当前 HEAD 在 chore/self-host-speccode;对账无冲突)**

```bash
node plugins/speccode/bin/speccode.mjs reconcile --cwd . --advance-pr   # 预期 conflicts/orphans 空
node plugins/speccode/bin/speccode.mjs resolve-worktree-dir --cwd .     # 预期 source=config, dir=.claude/worktrees
git check-ignore -q .claude/worktrees && echo ignored                   # 预期 ignored(.claude 已忽略,silent 通过)
```

- [ ] **Step 2: 创建 worktree**

```bash
git worktree add .claude/worktrees/worktree-self-host-speccode -b worktree-self-host-speccode chore/self-host-speccode
```

- [ ] **Step 3: setup 探测 + 基线测试**

无任何标记文件(无 package.json/Cargo.toml/requirements.txt/pyproject.toml/go.mod)→ setup 跳过。基线测试命令(设计 §7 已定,代替运行时询问):

```bash
cd .claude/worktrees/worktree-self-host-speccode && node --test ./plugins/speccode/tests/*.test.mjs
```

预期:134 pass。失败 → 停止并调查,不继续。

- [ ] **Step 4: 更新 state(先读后写,整体写回;`<ISO>` 同 Task 2 取值)**

```bash
node plugins/speccode/bin/speccode.mjs write-state --cwd . --branch chore/self-host-speccode --json-stdin <<'EOF'
{"feature_branch":"chore/self-host-speccode","created_at":"<ISO>","initial_branch":"main","status":"in_progress","worktrees":{"worktree-self-host-speccode":{"status":"in_progress"}}}
EOF
```

- [ ] **Step 5: onWorktreeCreated 钩子(no-op)+ 打印引导**

```bash
echo '{"command":"creating-worktree","feature_branch":"chore/self-host-speccode","worktree_branch":"worktree-self-host-speccode"}' | node plugins/speccode/bin/speccode.mjs run-hook --cwd . --event onWorktreeCreated
```

后续 Task 4-9 的 cwd 均为 `.claude/worktrees/worktree-self-host-speccode`(命令引擎用 `--cwd .`,git 用当前目录)。

### Task 4: proposing 四类文档(worktree 内)

**Files:**
- Create: `speccode/changes/self-host-speccode/propose/proposal.md`
- Create: `speccode/changes/self-host-speccode/propose/design.md`
- Create: `speccode/changes/self-host-speccode/propose/specs/plugin-packaging/spec.md`
- Create: `speccode/changes/self-host-speccode/propose/tasks.md`

**Interfaces:**
- Consumes: Task 3 的 worktree;`docs/superpowers/specs/2026-08-10-openspec-superpowers-to-speccode-design.md`(在分支树内)
- Produces: delta 源,Task 7 syncing 消费;`tasks.md` 供 Task 8 归档前勾选

- [ ] **Step 1: 前置校验**

```bash
cd .claude/worktrees/worktree-self-host-speccode
git rev-parse --abbrev-ref HEAD   # 预期 worktree-self-host-speccode
node plugins/speccode/bin/speccode.mjs reconcile --cwd . --advance-pr   # 归属 chore/self-host-speccode
test ! -d speccode/changes/self-host-speccode && echo no-conflict       # 冲突检查
node plugins/speccode/bin/speccode.mjs read-memory --cwd . --branch chore/self-host-speccode   # 读骨架记忆
```

- [ ] **Step 2: 写 `speccode/changes/self-host-speccode/propose/proposal.md`**

```markdown
# Proposal: self-host-speccode

## Why

本仓目前用 OpenSpec(opsx 命令 + openspec skills + openspec/ 目录)与 superpowers(脑暴强制节 + docs/superpowers/)管理自身开发;speccode v0.2.0 已把二者能力自包含收编(21 命令 + speccode/ delta 模型),继续依赖外部工具违背「目标项目零外部依赖」的设计定位,也无法 dogfood。

## What Changes

- `openspec/specs/` 8 个 capability 主规格原样迁入 `speccode/spec/`;`openspec/changes/archive/` 4 个归档迁入 `speccode/archive/`;删除 `openspec/` 目录与 config.yaml
- plugin-packaging 主规格 2 条 requirement 经 delta 修正:「文档三层分离」「不打包本仓自用工具」(去除 OpenSpec 作为现行工具的描述)
- CLAUDE.md:「OpenSpec 工作流」节改为「speccode 工作流」,删除「Brainstorm 文档落地(强制)」节,引言路径更新
- 根 README.md、plugin.json keywords、creating-feature.md type 推断扫描路径清除 openspec/superpowers 现行引用
- 初始化 `.speccode/config.json`(untracked),本仓后续开发全部由 speccode 自托管
- 无 BREAKING(插件对外行为不变;creating-feature.md 扫描路径修正属 v2 命令文档的内部修正)

## Capabilities

- modified: `plugin-packaging`

## Impact

- 代码:`plugins/speccode/commands/creating-feature.md`、`plugins/speccode/.claude-plugin/plugin.json`(文档/元数据级,无 lib 逻辑改动)
- 文档:`CLAUDE.md`、`README.md`、`speccode/spec/`(迁入)、`speccode/archive/`(迁入)
- 仓库结构:删除 `openspec/`;本地 untracked 清理 `.claude/commands/opsx/`、`.claude/skills/openspec-*`(合并后进行)
```

- [ ] **Step 3: 写 `speccode/changes/self-host-speccode/propose/design.md`**

```markdown
# Design: self-host-speccode

## Context

设计脑暴已固化于 `docs/superpowers/specs/2026-08-10-openspec-superpowers-to-speccode-design.md`(superpowers 时代最后一份强制节文档),四项关键决策(D1 迁移后删除 / D2 docs/superpowers 保留为历史 / D3 迁移即首个 dogfood feature / D4 原样播种 + delta 流程改内容)经用户逐项确认。本文件为其执行视图。

## Goals

- `speccode/spec/` 持有 8 个 capability 主规格,`openspec/` 从 git 删除
- tracked 文档不再把 openspec/superpowers 描述为现行工具
- 全链路 dogfood:proposing → syncing → archiving → finishing 在真实变更上跑通

## Non-Goals

- 不改写任何历史:CHANGELOG、docs/superpowers/、迁入的归档内容、移植出处注释(README L9 / CLAUDE.md L7 / sdd.mjs L32)
- 不发布新版本插件(plugin.json keywords 与 creating-feature.md 修正随本 PR 落地,发版另行按发布纪律评估)
- 不卸载用户级 openspec CLI 与 superpowers 插件(仅仓库侧解引用,收尾时提醒用户)

## Decisions

- **逐字播种而非改写**:openspec 与 speccode 主规格格式逐字兼容,`git mv` 保历史;内容修正(仅 plugin-packaging 2 条)走 delta,使 speccode/spec/ 每处内容都有 delta 出处
- **「不打包本仓自用工具」改写方向**:自用工具反转为 speccode 自身命令集,插件纯度属性保留;不点名 OpenSpec(避免主规格出现工具名,验证 grep 白名单不加新条目)
- **被拒绝的备选**:保留 openspec/ 只读(双规格源必漂移);搬家时顺手改内容(首轮 dogfood 验证不到规格生命周期)

## Risks

- v2 命令手动驱动出错 → 每命令严格按前置校验(reconcile 归属、trunk 防护),关键步骤有验证命令
- PR 等待超时 → `pending_operation` + `--resume` 续跑(v2 既有机制)

## Open Questions

无。
```

- [ ] **Step 4: 写 `speccode/changes/self-host-speccode/propose/specs/plugin-packaging/spec.md`(delta;两条 MODIFIED 全文如下)**

````markdown
# plugin-packaging Delta

## MODIFIED Requirements

### Requirement: 文档三层分离

仓库 SHALL 维护三层文档:根 `README.md` 作为 marketplace 索引(项目描述 + 插件列表 + 安装方式);`plugins/speccode/README.md` 作为用户文档(21 命令表 / 三层分支拓扑图 / R1-R13 风险 / 0.1→0.2 迁移对照表);`CLAUDE.md` 作为开发文档(三层引擎架构、测试约定、speccode 工作流、marketplace 结构,路径全部指向 `plugins/speccode/`)。

#### Scenario: 三层文档各司其职
- **WHEN** 检查仓库根 README.md、plugins/speccode/README.md、CLAUDE.md
- **THEN** 根 README 含 marketplace 描述与插件列表;插件 README 含 21 命令表与三层拓扑图;CLAUDE.md 含引擎三层架构与测试命令,且无对 `.claude/speccode/` 旧路径的引用

#### Scenario: 用户文档与 v2 一致
- **WHEN** 检查 `plugins/speccode/README.md`
- **THEN** 命令表 MUST 为 21 个新命令,拓扑图 MUST 为 trunk/feature/worktree 三层,且 MUST 含 0.1→0.2 迁移对照表,不存在 display / `-complete` 分支的现行行为描述

### Requirement: 不打包本仓自用工具

本仓(speccode-development)的自用开发工具 SHALL 为 speccode 自身命令集——spec 变更走 `speccode/changes/` 工作流,SHALL NOT 依赖插件自身以外的 spec 管理工具;仓库 `.claude/` 下的任何本仓自用工具(命令、skills)SHALL NOT 打包进 speccode 插件目录。`.claude/settings.local.json` SHALL 只含通配 permission(`Bash(node *)` 已覆盖 `speccode.mjs` 裸调),不得出现指向旧 `.claude/speccode/bin/speccode.mjs` 绝对路径的条目。

#### Scenario: 自用工具不进插件
- **WHEN** 检查 `plugins/speccode/` 与仓库 `.claude/`
- **THEN** 插件目录不含任何本仓自用工具命令与 skills,两者内容无重叠

#### Scenario: settings 清理绝对路径 permission
- **WHEN** 读取 `.claude/settings.local.json`
- **THEN** 不存在指向 `.../coding/.claude/speccode/bin/speccode.mjs` 的绝对路径 permission 条目;保留 `Bash(node *)` 等通配条目
````

- [ ] **Step 5: 写 `speccode/changes/self-host-speccode/propose/tasks.md`**

```markdown
# Tasks: self-host-speccode

- [ ] 1. git mv 播种:openspec/specs → speccode/spec,openspec/changes/archive → speccode/archive;git rm openspec/config.yaml;openspec/ 空壳从 git 消失
- [ ] 2. tracked 引用清除:CLAUDE.md(引言路径 + OpenSpec 工作流节改写 + 删除 Brainstorm 强制节)、根 README.md、plugin.json keywords、creating-feature.md 扫描路径
- [ ] 3. syncing:合并本 delta 进 speccode/spec/plugin-packaging/spec.md
- [ ] 4. 勾选本文件 + archiving:changes/ 移入 speccode/archive/
- [ ] 5. finishing-worktree + finishing-feature:PR 合入 main
- [ ] 6. 合并后验证(134 测试、结构断言、grep 白名单)+ 本地 untracked 清理
```

- [ ] **Step 6: 落盘即提交 + onProposed 钩子 + 写记忆**

```bash
git add speccode/changes/self-host-speccode/
git commit -m "docs(speccode): propose self-host-speccode"
echo '{"command":"proposing","feature_branch":"chore/self-host-speccode","worktree_branch":"worktree-self-host-speccode"}' | node plugins/speccode/bin/speccode.mjs run-hook --cwd . --event onProposed
node plugins/speccode/bin/speccode.mjs write-memory --cwd . --branch chore/self-host-speccode --json-stdin <<'EOF'
{"mode":"append","content":"- proposing 完成:proposal/design/specs(plugin-packaging 2 条 MODIFIED)/tasks 四类文档落盘并提交;下一步 git mv 播种 + 引用清除"}
EOF
```

### Task 5: git mv 播种 + openspec 删除(worktree 内)

**Files:**
- Rename: `openspec/specs/` → `speccode/spec/`(8 个 capability 目录)
- Rename: `openspec/changes/archive/` → `speccode/archive/`(4 个日期目录)
- Delete: `openspec/config.yaml`

**Interfaces:**
- Consumes: Task 4 已建 `speccode/changes/`(故 `speccode/` 已存在,`spec`/`archive` 子路径不存在,git mv 不覆盖)
- Produces: `speccode/spec/plugin-packaging/spec.md` 等 8 个主规格,Task 7 syncing 的合并目标

- [ ] **Step 1: 执行迁移**

```bash
cd .claude/worktrees/worktree-self-host-speccode
git mv openspec/specs speccode/spec
git mv openspec/changes/archive speccode/archive
git rm -q openspec/config.yaml
```

- [ ] **Step 2: 验证(纯 rename,无内容变化;openspec 从索引消失)**

```bash
git status --porcelain          # 预期全部 R(rename)+ D(config.yaml)
git ls-files openspec/          # 预期空
ls speccode/spec | wc -l        # 预期 8
ls speccode/archive | wc -l     # 预期 4
diff <(git show HEAD:openspec/specs/plugin-packaging/spec.md) speccode/spec/plugin-packaging/spec.md && echo identical   # 逐字播种
```

- [ ] **Step 3: 提交**

```bash
git commit -m "chore(speccode): 迁移 openspec 规格与归档至 speccode/(原样播种,格式兼容)"
```

### Task 6: tracked 引用清除(worktree 内)

**Files:**
- Modify: `CLAUDE.md`(L9、L73-79 两节)
- Modify: `README.md`(L29)
- Modify: `plugins/speccode/.claude-plugin/plugin.json`(keywords)
- Modify: `plugins/speccode/commands/creating-feature.md`(L17)

**Interfaces:**
- Consumes: 无(独立文件编辑)
- Produces: Task 11 的 grep 白名单验证能通过

- [ ] **Step 1: CLAUDE.md 引言路径(L9)**

old:
```
完整设计文档见 `plugins/speccode/README.md`(定位、21 命令表、三层分支拓扑图、风险 R1-R13)。规格已归档在 `openspec/specs/`(8 个 capability,74 requirements)与 `openspec/changes/archive/`。
```
new:
```
完整设计文档见 `plugins/speccode/README.md`(定位、21 命令表、三层分支拓扑图、风险 R1-R13)。规格主档在 `speccode/spec/`(8 个 capability,74 requirements),归档在 `speccode/archive/`。
```

- [ ] **Step 2: CLAUDE.md「OpenSpec 工作流」节 → 「speccode 工作流」节(L73-75 整节替换)**

old:
```
## OpenSpec 工作流

本仓库自身用 OpenSpec 管理变更(`openspec/`)。规格改动走 change 流程:`/opsx:propose` → 实现 → `/opsx:sync`(delta specs 同步到 `openspec/specs/`)→ `/opsx:archive`。`openspec validate <spec> --strict` 校验;`openspec list` 看 active changes。
```
new:
```
## speccode 工作流

本仓库自身的开发由 speccode 自托管(dogfood),不依赖任何外部 spec/方法论工具。变更走 v2 原生链路:`/speccode:creating-feature` → `/speccode:creating-worktree` → `/speccode:proposing`(复杂需求先 `/speccode:brainstorming`)→ `/speccode:writing-plans` → 执行 → `/speccode:syncing`(delta 合并进 `speccode/spec/`)→ `/speccode:archiving` → `/speccode:finishing-worktree` → `/speccode:finishing-feature`(单 PR 直通 trunk)。规格主档在 `speccode/spec/`,归档在 `speccode/archive/`;脑暴文档由 brainstorming 原生落到 `speccode/changes/<slug>/brainstorm/`,落盘即提交。
```

- [ ] **Step 3: CLAUDE.md 删除「Brainstorm 文档落地(强制)」整节(含标题,L77-79,连同其后空行)**

old(整节删除):
```
## Brainstorm 文档落地(强制)

每次执行 brainstorming(脑暴/查漏补缺/设计精化)后,**无论是否已存在 openspec 文档**,MUST 把脑暴结论落地为独立文档:`docs/superpowers/specs/YYYY-MM-DD-<topic>-brainstorm.md`(含背景、方法、发现/决策、处置结果),并提交 git。openspec 工件是规格契约,brainstorm 文档是思考过程记录,二者不可互相替代。
```

- [ ] **Step 4: 根 README.md L29 措辞**

old:`（开发视角：引擎三层架构、测试约定、OpenSpec 工作流）`
new:`（开发视角：引擎三层架构、测试约定、speccode 工作流）`

- [ ] **Step 5: plugin.json keywords**

old:`"keywords": ["workflow", "git", "worktree", "pr", "openspec", "sdd", "tdd", "hooks", "memory"]`
new:`"keywords": ["workflow", "git", "worktree", "pr", "sdd", "tdd", "hooks", "memory"]`

- [ ] **Step 6: creating-feature.md L17 扫描路径**

old:`1. 扫描 \`openspec/changes/\`(存在未 archive 的 change)与 \`docs/superpowers/specs/\`(最近 design),尝试从内容推断 type:`
new:`1. 扫描 \`speccode/changes/\`(存在未 archive 的 change),尝试从内容推断 type:`

- [ ] **Step 7: 验证 + 提交**

```bash
grep -n "openspec\|OpenSpec\|superpowers" CLAUDE.md README.md plugins/speccode/.claude-plugin/plugin.json plugins/speccode/commands/creating-feature.md
# 预期仅剩:CLAUDE.md:7 的「移植自 superpowers(v6.2.0)」出处句
git add CLAUDE.md README.md plugins/speccode/.claude-plugin/plugin.json plugins/speccode/commands/creating-feature.md
git commit -m "chore: 清除 openspec/superpowers 现行工具引用,切换为 speccode 自托管"
```

### Task 7: syncing 合并 delta(worktree 内)

**Files:**
- Modify: `speccode/spec/plugin-packaging/spec.md`(2 个 requirement 块替换)

**Interfaces:**
- Consumes: Task 4 的 delta(`speccode/changes/self-host-speccode/propose/specs/plugin-packaging/spec.md`)、Task 5 播种的主规格
- Produces: 更新后的主规格;Task 8 archiving 的 sync 状态评估依据

- [ ] **Step 1: 前置 + 读 delta 与主规格**

```bash
cd .claude/worktrees/worktree-self-host-speccode
git rev-parse --abbrev-ref HEAD   # 预期 worktree- 前缀
test -f speccode/changes/self-host-speccode/propose/specs/plugin-packaging/spec.md && echo delta-ok
```

读 `speccode/spec/plugin-packaging/spec.md`,按名称逐字定位「文档三层分离」(L109-119)与「不打包本仓自用工具」(L133-143)两个 requirement 块。

- [ ] **Step 2: 应用 2 条 MODIFIED(整块替换为 Task 4 Step 4 的 delta 全文;其余内容一字不动)**

用 Edit 工具分别以旧块全文为 old_string、delta 中对应新块全文为 new_string 替换。主规格 MUST NOT 出现 ADDED/MODIFIED 操作头。

- [ ] **Step 3: 验证 + 空变更短路检查**

```bash
grep -n "OpenSpec\|openspec" speccode/spec/plugin-packaging/spec.md   # 预期无输出
grep -c "### Requirement:" speccode/spec/plugin-packaging/spec.md      # 预期与播种前一致(12)
git status --porcelain speccode/                                       # 预期只有主规格 1 个 M
```

- [ ] **Step 4: 提交 + onSynced 钩子**

```bash
git add speccode/spec/ speccode/changes/self-host-speccode/
git commit -m "docs(speccode): sync self-host-speccode into main specs"
echo '{"command":"syncing","feature_branch":"chore/self-host-speccode","worktree_branch":"worktree-self-host-speccode"}' | node plugins/speccode/bin/speccode.mjs run-hook --cwd . --event onSynced
```

(syncing 为只读记忆命令,不写 memory。)

### Task 8: 勾选 tasks.md + archiving(worktree 内)

**Files:**
- Modify: `speccode/changes/self-host-speccode/propose/tasks.md`(1-3 勾选;4 在归档提交中一并勾选)
- Rename: `speccode/changes/self-host-speccode/` → `speccode/archive/2026-08-10-self-host-speccode/`

**Interfaces:**
- Consumes: Task 4-7 的产出
- Produces: 归档目录;Task 9 finishing-worktree 的前置(工作区无未提交变更)

- [ ] **Step 1: 勾选 tasks.md 1-3(4-6 属后续任务,归档警告检查时说明)**

把 `- [ ] 1.`/`- [ ] 2.`/`- [ ] 3.` 改为 `- [ x] ...` 对应项,提交:

```bash
cd .claude/worktrees/worktree-self-host-speccode
git add speccode/changes/self-host-speccode/propose/tasks.md
git commit -m "docs(speccode): tick self-host-speccode 迁移任务完成"
```

- [ ] **Step 2: 归档前检查**

- 任务完成检查:tasks.md 余 3 项未勾(4=本归档、5=finishing、6=合并后清理,均为归档后步骤)→ 向用户展示并确认继续(预期确认,设计已批准该链)。
- sync 状态评估:逐 capability 对照——plugin-packaging 的 2 条 MODIFIED 已在 Task 7 应用(主规格 grep 无 openspec,requirement 计数 12 不变);无其他 delta → 已全部合并,直接进入移动。
- 目标已存在检查:`test ! -d speccode/archive/2026-08-10-self-host-speccode && echo ok`。

- [ ] **Step 3: 执行归档 + 提交 + 钩子 + 写记忆**

```bash
mv speccode/changes/self-host-speccode speccode/archive/2026-08-10-self-host-speccode
git add speccode/changes/self-host-speccode speccode/archive/
git commit -m "docs(speccode): archive self-host-speccode"
echo '{"command":"archiving","feature_branch":"chore/self-host-speccode","worktree_branch":"worktree-self-host-speccode"}' | node plugins/speccode/bin/speccode.mjs run-hook --cwd . --event onArchived
node plugins/speccode/bin/speccode.mjs write-memory --cwd . --branch chore/self-host-speccode --json-stdin <<'EOF'
{"mode":"append","content":"- 迁移实施+sync+归档完成:speccode/spec 8 主规格(含 plugin-packaging 2 条修正),openspec/ 已删,归档至 speccode/archive/2026-08-10-self-host-speccode/;待 finishing-worktree"}
EOF
```

- [ ] **Step 4: 全量测试(归档后工作区终态)**

```bash
node --test ./plugins/speccode/tests/*.test.mjs   # 预期 134 pass
```

### Task 9: finishing-worktree(worktree 内)

**Files:**
- Modify: `.speccode/state/features/chore__self-host-speccode.json`(终态 completed 或 pr_open,经 write-state)

**Interfaces:**
- Consumes: Task 8 的干净工作区
- Produces: 成果回到 `chore/self-host-speccode`;Task 10 的前置(feature-progress 全 completed)

- [ ] **Step 1: 前置 + 全量测试门禁**

```bash
cd .claude/worktrees/worktree-self-host-speccode
node plugins/speccode/bin/speccode.mjs reconcile --cwd . --advance-pr   # 归属确认,无 conflicts
node plugins/speccode/bin/speccode.mjs read-memory --cwd . --branch chore/self-host-speccode
node --test ./plugins/speccode/tests/*.test.mjs                          # 预期 134 pass;失败则停止
```

- [ ] **Step 2: 用 AskUserQuestion 询问合并方式(恰好四项:PR+等待 / PR+不等待 / 本地 squash / 保留;推荐「PR + 等待合并」——dogfood 首轮完整跑通 prtool + 轮询路径)**

- [ ] **Step 3A(选 PR 路径):推送 + 建 PR + 等合并**

```bash
git push origin chore/self-host-speccode                      # 同步 base;non-fast-forward 则中止
git push -u origin worktree-self-host-speccode
gh pr create --base chore/self-host-speccode --head worktree-self-host-speccode --title "chore: openspec/superpowers → speccode 自托管转换(worktree 成果)" --body "首个 speccode dogfood feature 的 worktree 成果:propose 文档、openspec→speccode 播种迁移、引用清除、sync 合并、归档。"
echo '{"command":"finishing-worktree","feature_branch":"chore/self-host-speccode","worktree_branch":"worktree-self-host-speccode","pr_number":<N>}' | node plugins/speccode/bin/speccode.mjs run-hook --cwd . --event onPrOpened
```

每 30s:`node plugins/speccode/bin/speccode.mjs query-pr --cwd . --number <N>`,超时 30min。MERGED → 清理 + state 置 completed;TIMEOUT → 写 pending_operation(command=finishing-worktree, phase=waiting_worktree_pr, pr_number=N, updated_at)后提示 `--resume` 续跑。

- [ ] **Step 3B(选本地 squash):主仓合并(不切换本 worktree HEAD)**

```bash
git -C /Users/game-netease/workspaces/plugin/speccode-development checkout chore/self-host-speccode   # 已在则跳过
git -C /Users/game-netease/workspaces/plugin/speccode-development merge --squash worktree-self-host-speccode
git -C /Users/game-netease/workspaces/plugin/speccode-development commit -m "chore: openspec/superpowers → speccode 自托管转换(worktree squash)"
cd /Users/game-netease/workspaces/plugin/speccode-development && node --test ./plugins/speccode/tests/*.test.mjs   # 复测 134 pass;失败则停止保留现场
```

- [ ] **Step 4: 清理 worktree(先回主仓根,再删)+ state 置 completed**

```bash
cd /Users/game-netease/workspaces/plugin/speccode-development
git worktree remove .claude/worktrees/worktree-self-host-speccode --force
git branch -D worktree-self-host-speccode
# 询问用户是否删远端分支:git push origin :worktree-self-host-speccode
git worktree prune
```

write-state 写回:`worktrees["worktree-self-host-speccode"]={status:"completed", completed_at:"<ISO>"}`(先读后写整体写回;PR 路径已删 worktree 分支时分支已不存在的报错可忽略,以 state 为准)。

- [ ] **Step 5: onWorktreeFinished 钩子 + feature-progress + 写记忆**

```bash
echo '{"command":"finishing-worktree","feature_branch":"chore/self-host-speccode","worktree_branch":"worktree-self-host-speccode","pr_number":<N>}' | node plugins/speccode/bin/speccode.mjs run-hook --cwd . --event onWorktreeFinished   # 路径3B 省略 pr_number 字段
node plugins/speccode/bin/speccode.mjs feature-progress --cwd . --branch chore/self-host-speccode   # 预期 1/1 done
node plugins/speccode/bin/speccode.mjs write-memory --cwd . --branch chore/self-host-speccode --json-stdin <<'EOF'
{"mode":"append","content":"- finishing-worktree 完成(合并方式:<PR#/squash>);state completed;待 finishing-feature 开 PR 到 main"}
EOF
```

### Task 10: finishing-feature(feature 分支,PR → main)

**Files:**
- Delete: `.speccode/state/features/chore__self-host-speccode.json`(经 delete-state verb)

**Interfaces:**
- Consumes: Task 9 的 completed state
- Produces: main 含全部转换成果;Task 11 在 main 上验证

- [ ] **Step 1: 主仓切到 feature 分支 + 前置门禁**

```bash
cd /Users/game-netease/workspaces/plugin/speccode-development
git checkout chore/self-host-speccode
node plugins/speccode/bin/speccode.mjs reconcile --cwd . --advance-pr
node plugins/speccode/bin/speccode.mjs feature-progress --cwd . --branch chore/self-host-speccode   # 预期无 pending/in_progress/pr_open
node plugins/speccode/bin/speccode.mjs read-memory --cwd . --branch chore/self-host-speccode
```

- [ ] **Step 2: 推送 + 建 PR(base=main)+ onPrOpened**

```bash
git push origin chore/self-host-speccode
gh pr create --base main --head chore/self-host-speccode --title "chore: openspec/superpowers → speccode 自托管转换" --body "首个 speccode dogfood feature。openspec/ 8 主规格 + 4 归档迁入 speccode/(原样播种 + plugin-packaging 2 条 delta 修正),openspec/ 删除;CLAUDE.md/README/plugin.json/creating-feature.md 清除 openspec/superpowers 现行引用;.speccode/config.json 已初始化(untracked)。设计:docs/superpowers/specs/2026-08-10-openspec-superpowers-to-speccode-design.md"
echo '{"command":"finishing-feature","feature_branch":"chore/self-host-speccode","pr_number":<N>}' | node plugins/speccode/bin/speccode.mjs run-hook --cwd . --event onPrOpened
```

- [ ] **Step 3: 等合并(用户在 GitHub/gh 合并;每 30s query-pr,超时 30min;TIMEOUT 写 pending_operation phase=waiting_trunk_pr 后 `--resume` 续跑)**

- [ ] **Step 4: MERGED 后收尾**

```bash
node plugins/speccode/bin/speccode.mjs delete-state --cwd . --branch chore/self-host-speccode
echo '{"command":"finishing-feature","feature_branch":"chore/self-host-speccode","pr_number":<N>}' | node plugins/speccode/bin/speccode.mjs run-hook --cwd . --event onFeatureFinished
git checkout main && git pull
node plugins/speccode/bin/speccode.mjs write-memory --cwd . --branch chore/self-host-speccode --json-stdin <<'EOF'
{"mode":"append","content":"- finishing-feature 完成:PR #<N> 已合入 main;state 已删除;自托管转换交付"}
EOF
```

(feature 分支保留不删,作为历史。)

### Task 11: 合并后验证 + 本地 untracked 清理(main 上)

**Files:**
- Delete(untracked,不进 git):`.claude/commands/opsx/`、`.claude/skills/openspec-*/`
- Modify(untracked):`.claude/settings.local.json`

**Interfaces:**
- Consumes: Task 10 合并后的 main
- Produces: 转换完成态

- [ ] **Step 1: 全量测试 + 结构断言**

```bash
cd /Users/game-netease/workspaces/plugin/speccode-development
node --test ./plugins/speccode/tests/*.test.mjs          # 预期 134 pass
test ! -d openspec && echo openspec-gone                 # 预期 openspec-gone
ls speccode/spec | wc -l                                  # 预期 8
ls speccode/archive                                       # 预期 4 个历史归档 + 2026-08-10-self-host-speccode
node plugins/speccode/bin/speccode.mjs reconcile --cwd .  # 预期无 active features(已交付)
```

- [ ] **Step 2: grep 白名单验证(tracked 现行引用清零)**

```bash
grep -rn "openspec\|OpenSpec\|superpowers" --include="*.md" --include="*.json" --include="*.mjs" --include="*.yaml" . \
  | grep -v "^\./CHANGELOG.md" | grep -v "^\./docs/superpowers/" | grep -v "^\./speccode/archive/" \
  | grep -v "^\./plugins/speccode/lib/sdd.mjs" | grep -v "^\./\.claude/" | grep -v "^\./\.superpowers/" | grep -v "^\./\.speccode/"
```

预期仅剩 2 行移植出处:`plugins/speccode/README.md:9` 与 `CLAUDE.md:7`(均含「移植自 superpowers(v6.2.0)」字样)。

- [ ] **Step 3: 本地 untracked 清理**

```bash
rm -rf .claude/commands/opsx .claude/skills/openspec-apply-change .claude/skills/openspec-explore .claude/skills/openspec-verify-change .claude/skills/openspec-new-change .claude/skills/openspec-archive-change .claude/skills/openspec-propose .claude/skills/openspec-bulk-archive-change .claude/skills/openspec-continue-change .claude/skills/openspec-sync-specs
```

settings.local.json 删除 openspec 权限条目——old:`"Bash(python3 *)",` + 换行 + `      "Bash(openspec list *)"`;new:`"Bash(python3 *)"`。`.superpowers/` 为用户本地数据,不动。

- [ ] **Step 4: 向用户展示收尾提醒**

1. 本会话插件为 v0.1 命令集;新会话请更新本地插件安装到 0.2.0(`/plugin marketplace update speccode-development` 后重装),即可获得 `/speccode:proposing` 等 21 个 v2 命令。
2. 全局 openspec CLI(1.7.0)本仓已不再需要,可自行卸载。
3. superpowers 插件本仓已不再引用,是否保留由你决定。
4. `creating-feature.md` 扫描路径修正与 plugin.json keywords 属插件面变更,建议后续按发布纪律评估 0.2.1(单独 feature,不在本转换范围)。

## Self-Review 记录

- **Spec 覆盖**:设计 §2 执行链 → Task 1-10;§3 迁移映射 → Task 5;§4 delta 修正 → Task 4 Step 4 + Task 7;§5 清除清单 → Task 6 + Task 11 Step 3;§6 init 参数 → Task 1;§7 验证 → Task 8 Step 4 / Task 9 Step 1 / Task 11 Step 1-2。无缺口。
- **占位符扫描**:`<ISO>`、`<N>` 为运行时取值(时间戳/PR 号),属合法运行时参数,非占位符;所有文档全文已给出。
- **类型一致**:分支名/目录名/state 字段名/write-state 载荷跨任务一致(chore/self-host-speccode、worktree-self-host-speccode、speccode/changes/self-host-speccode、speccode/archive/2026-08-10-self-host-speccode)。
