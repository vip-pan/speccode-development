# speccode v2 · P8 文档、校验与归档 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 v2 收尾:README 全量重写(21 命令/三层拓扑/R1–R13/迁移表/理念节)、CLAUDE.md 更新、plugin.json 0.2.0、各阶段 park 项的统一润色、`/opsx:sync` 合并全部 delta + 删除 spec-docs-tracking-control + 全量 validate、dogfood 走查、`/opsx:archive` 归档本 change。

**Architecture:** 对应 OpenSpec change `speccode-v2-sdd-flow` 的 P8 阶段。T1–T4 为文档与润色;T5 为 OpenSpec 收尾(agent 流 sync/archive,**不用裸 openspec archive**,见 design D2 注记);T6 为 dogfood。

**Tech Stack:** markdown 文档 + OpenSpec CLI(校验用)+ 既有引擎。

## Global Constraints

- 测试命令 MUST 用 glob 形式:`node --test ./plugins/speccode/tests/*.test.mjs`(P8 无引擎改动,但必须保持 131/131 绿)。
- README 事实基线(P1–P7 终审后的真实状态):21 个命令;12 个 lib 模块(atomic/config/detect/git/hooks/memory/prtool/reconcile/sdd/slug/state/timestamp);18 个 verb(9 旧 + query-pr/detect-knowledge-tools/resolve-worktree-dir/sdd-workspace/task-brief/review-package/run-hook/read-memory/write-memory);references/ 12 项;14 个 hook 事件;测试 131。
- README 风险表:R1(amend 改写)/R7(backup 增长)/R10(双 PR 串行)随 display/-complete 消亡**删除**;R2/R3/R4/R5/R8/R9 保留并更新到新命令名;R6 改为「worktree 目录可配置,默认 .claude/worktrees」;新增 R11(hook 失败 warn-only + 30s 超时;威胁模型:config.hooks 经 `sh -c` 以用户全权限执行,安全性来自 `.speccode/` 按约定 untracked 不经 PR/clone 传播 + payload 值受 slug.mjs 结构约束)、R12(memory last-writer-wins,缓解:出口写入前读入+用户确认)、R13(trunk 文档体积 churn,缓解:syncing 合并+archiving 移动)。
- 理念节五条逐字:测试驱动 / 系统化优于临时发挥 / 降低复杂度 / 证据优于断言 / 不要过度自信(不确定先询问)。
- 迁移对照表(0.1→0.2):start→creating-feature、develop-start→creating-worktree、develop-complete→finishing-worktree、finish→finishing-feature、display-\*×3 下线;config 重新 init 升 v2;遗留 display 分支/waiting_display_pr 手动收尾。
- CLAUDE.md 更新:12 lib 模块、21 命令、references/、18 verb、新不变量(run-hook 永远 exit 0;memory 走 writeTextAtomic;SDD 工作区 show-toplevel 与主仓定位有意差异;写 verb 必须 --json-stdin;hooks warn-only);删「finish 双 PR 顺序」不变量改「finishing-feature 单 PR」;测试约定里 waitmerge 引用删除;「这个仓库是什么」段更新为 v2 描述。
- 提交信息遵守仓库惯例。

## File Structure

- Rewrite `plugins/speccode/README.md`
- Modify `CLAUDE.md`、`plugins/speccode/.claude-plugin/plugin.json`
- Modify 润色点:`commands/proposing.md`(「集锦」→「梳理」)、`commands/syncing.md`(护栏首句与双路径 add 对齐 + brainstorm-only 时 propose/ 缺失的提示)、`commands/reset.md`(清理询问加 `.speccode/brainstorm/`)、`commands/brainstorming.md`(检查清单第 10 项标签时机)
- OpenSpec:`/opsx:sync` + `git rm -r openspec/specs/spec-docs-tracking-control/` + validate + `/opsx:archive`
- Modify `openspec/changes/speccode-v2-sdd-flow/tasks.md`(P8 勾选,验收任务内)

---

### Task 1: README.md 全量重写

**Files:**
- Modify: `plugins/speccode/README.md`(整文件替换)

**Interfaces:**
- Consumes: Global Constraints 的事实基线。Produces: plugin-packaging spec「文档三层分离」的用户文档层。

- [ ] **Step 1: 整文件重写** — 新结构(每节内容按下述要点成稿,中文;命令表逐字用下表):

1. **speccode 是什么**:Claude Code 流程编排插件,21 个 `/speccode:*` 命令固化「多需求并行开发 + spec 文档托管 + PR/MR 流程标准化」;v2 起内置完整 SDD 方法论(探索→文档→计划→子代理执行→评审→收尾)与 hooks/memory 能力;三层分支拓扑(trunk/feature/worktree);superpowers 方法论(v6.2.0)自包含移植,目标项目零外部依赖。
2. **21 个命令快速参考表**(三组;前置分支逐字):

生命周期:

| 命令 | 作用 | 前置(运行分支) |
|---|---|---|
| `/speccode:init` | 初始化/更新:探测远端、主干、知识库工具,配置 worktree 目录与 hooks,写 `.speccode/config.json`(config v2) | 任意分支(首次通常在 trunk) |
| `/speccode:exploring` | 探索需求(不产文档,结论在会话上下文;知识库工具优先) | trunk |
| `/speccode:creating-feature` | 从 trunk 切出功能分支并推送,登记 state,建 memory 骨架 | trunk |
| `/speccode:creating-worktree` | 从功能分支切出 worktree(worktree_dir 可配置、check-ignore 校验、项目 setup、基线测试) | feature/bugfix/refactor/chore 分支 |
| `/speccode:finishing-worktree` | 合并 worktree 成果回功能分支(测试门禁;PR 等待/PR 不等待/本地 squash/保留;丢弃需逐字 discard) | worktree-* 分支 |
| `/speccode:finishing-feature` | 收尾整个功能:单 PR → trunk(阻塞等合并)→ 删 state → 切回 trunk | 功能分支 |
| `/speccode:status` | 只读总览:所有 active feature 的 worktree 进度、pending_operation、config 摘要 | 任意分支 |
| `/speccode:reset` | 重置环境:清 state 与 worktree,按字段询问清理 config,询问清理 memory//sdd//brainstorm/(拒绝有 active feature 时执行) | 任意分支,且不能有 active feature |

文档流(均落盘即提交):

| 命令 | 作用 | 前置(运行分支) |
|---|---|---|
| `/speccode:proposing` | 落地 proposal/design/specs/tasks 四类文档到 `speccode/changes/<slug>/propose/`;复杂度评估建议 brainstorming | worktree-* 分支 |
| `/speccode:brainstorming` | 苏格拉底式设计精化,设计落 `brainstorm/` 并回写 propose/ 保持一致 | worktree-* 分支 |
| `/speccode:writing-plans` | 详细实现计划(brainstorm/ 优先,propose/ 兜底),落 `plan/` | worktree-* 分支 |
| `/speccode:syncing` | 增量变更合并进 `speccode/spec/` 主规格(brainstorm 残余吸收,幂等) | worktree-* 分支 |
| `/speccode:archiving` | 归档:changes/<slug>/ 移入 `speccode/archive/<YYYY-MM-DD>-<slug>/` | worktree-* 分支 |

方法论:

| 命令 | 作用 | 前置(运行分支) |
|---|---|---|
| `/speccode:subagent-driven-development` | 每任务派发全新子代理 + 双重审查 + 整支终审;ledger 恢复 | worktree-* 分支 |
| `/speccode:executing-plans` | 本会话分批执行计划,带人工检查点 | worktree-* 分支 |
| `/speccode:dispatching-parallel-agents` | 并发子代理工作流(独立失败域) | worktree-* 分支 |
| `/speccode:test-driven-development` | RED-GREEN-REFACTOR 循环(含铁律与反模式表) | worktree-* 分支 |
| `/speccode:systematic-debugging` | 4 阶段根因过程 + 防御纵深 + 条件等待技巧 | worktree-* 分支 |
| `/speccode:requesting-code-review` | 派发审查子代理(规格合规 + 代码质量) | worktree-* 分支 |
| `/speccode:receiving-code-review` | 技术化处理评审反馈(不表演式同意) | worktree-* 分支 |
| `/speccode:verification-before-completion` | 证据先于断言:宣布完成前必须跑验证 | worktree-* 分支 |

3. **三层分支拓扑图**:

```
origin/<trunk> (主干;spec 文档 tracked)
   │
   │  /speccode:creating-feature
   ▼
feature/<slug>  (功能分支;一个需求可拆多轮/多个 worktree)
   │
   │  /speccode:creating-worktree (可并行多个)
   ├──────────────┬──────────────┐
   ▼              ▼              ▼
worktree-a     worktree-b     worktree-c
   │  文档流(proposing→brainstorming→writing-plans→…→syncing→archiving)在此层进行
   └── /speccode:finishing-worktree(测试门禁 + PR/本地 squash)合并回 feature ──┘
   │
   │  /speccode:finishing-feature(单 PR → trunk,阻塞等合并)
   ▼
origin/<trunk>  (功能落地,feature 分支保留作历史)
```

要点:trunk 主干(默认 master,文档 tracked);feature 从 trunk 切出;worktree 硬前缀(默认 `worktree-`,可配置)从 feature 切出;**无 display 层、无 `<feature>-complete` 临时分支**;`speccode/` 文档在所有分支 tracked,随 PR 链路上 trunk。
4. **开发流程**(12 步,从需求到归档):exploring → creating-feature → creating-worktree → proposing →(复杂时 brainstorming)→ writing-plans → subagent-driven-development 或 executing-plans(内含 dispatching-parallel-agents/systematic-debugging/verification-before-completion/TDD)→ requesting-code-review → syncing → archiving → finishing-worktree → finishing-feature。
5. **文档目录**:`speccode/changes/<slug>/{propose,brainstorm,plan}/`、`speccode/spec/`、`speccode/archive/`;落盘即 commit;同 feature 多轮重建不冲突。
6. **`.speccode/` 目录结构**:`config.json`(v2 字段集)、`state/features/<type>__<slug>.json`、`memory/`(feature 级记忆 + `_exploring.md`,自忽略 .gitignore)、`sdd/`(SDD 工件,自忽略 .gitignore)、`backup/`(init/reset 的 config 备份);原子写策略说明。
7. **hooks**:config `hooks` 字段(事件名→shell 命令);14 个固定事件枚举(全列);payload(stdin 单行 JSON:event/timestamp/repo_root/cwd/command + 按可得性 feature_branch/worktree_branch/pr_number/task);warn-only(30s 超时、run-hook 永远 exit 0);用途示例(IM 通知 stub);威胁模型(见 R11)。
8. **memory**:feature 级 `.speccode/memory/<type>__<slug>.md`(untracked,多 worktree 共享);`_exploring.md` trunk 级例外;命令入口读/出口写;长会话主动书写三判据(阶段完成/上下文显著增长/compact 恢复)。
9. **知识库工具**:init 探测(understand-anything/CodeGraph/Graphify/CodeMap/LightRAG;插件/MCP/CLI/项目目录四类)逐项确认登记;exploring/proposing/brainstorming 优先咨询、缺失回退、永不报错。
10. **风险与缓解(R1–R13)**:按 Global Constraints 的清单成稿。
11. **从 0.1 迁移**:对照表 + config 重 init 升 v2 + 遗留 display/waiting_display_pr 手动收尾指引。
12. **理念**:五条逐字。
13. **未解决问题 / 跨平台说明 / ⚠ 重要警告**:OQ 更新(删 OQ2 spec_tools 相关——spec_tools 已删;保留 Windows OQ);跨平台与依赖节保留更新;重要警告节保留并扩到 memory//sdd/(`.speccode/` untracked,`git clean -fdx` 会摧毁 config/state;`git clean -fd` 因 sdd/memory 的自忽略 .gitignore 而不伤两者)。

- [ ] **Step 2: 验证**

Run: `git grep -n "display\|develop-start\|develop-complete\|speccode:start\b\|speccode:finish\b\|-complete" plugins/speccode/README.md`
Expected: 仅迁移对照表与「遗留 display 手动收尾」段命中
Run: `grep -c "speccode:" plugins/speccode/README.md`
Expected: ≥21

- [ ] **Step 3: Commit**

```bash
git add plugins/speccode/README.md
git commit -m "docs: rewrite README for v2 (21 commands, 3-layer topology, R1-R13, migration)"
```

### Task 2: CLAUDE.md 更新 + plugin.json 0.2.0

**Files:**
- Modify: `CLAUDE.md`
- Modify: `plugins/speccode/.claude-plugin/plugin.json`

**Interfaces:**
- Produces: plugin-packaging spec「plugin.json 元数据」「文档三层分离」的开发文档层。

- [ ] **Step 1: CLAUDE.md 编辑**(按 Global Constraints 的事实基线):
  - 「这个仓库是什么」段:10 命令 → 21 命令;四层 → 三层;补「方法论命令自包含移植 superpowers v6.2.0」「hooks/memory」。
  - 架构三层段:lib 模块清单改 12 个(atomic/config/detect/git/hooks/memory/prtool/reconcile/sdd/slug/state/timestamp);bin verb 面 18 个;commands 21 个;新增 references/ 层说明。
  - 关键不变量:删「finish 双 PR 顺序」改「finishing-feature 单 PR → trunk」;新增:run-hook 永远 exit 0(hook 失败 warn-only)、memory 走 writeTextAtomic、SDD 工作区 show-toplevel(与主仓定位的有意差异)、写 verb 必须 --json-stdin。
  - 测试约定:删 waitmerge 引用;测试数 131。
  - OpenSpec 工作流与 Brainstorm 文档落地节不动。

- [ ] **Step 2: plugin.json**:

```json
{
  "name": "speccode",
  "version": "0.2.0",
  "description": "多需求并行开发 + spec 文档托管 + PR/MR 流程标准化 + SDD 方法论(探索/文档/计划/子代理执行/评审)的 Claude Code 流程编排插件",
  "author": { "name": "speccode" },
  "license": "MIT",
  "homepage": "https://github.com/vip-pan/speccode-development",
  "repository": "https://github.com/vip-pan/speccode-development",
  "keywords": ["workflow", "git", "worktree", "pr", "openspec", "sdd", "tdd", "hooks", "memory"]
}
```

(homepage/repository 用当前 remote 的实际地址;先 `git remote -v` 核实,若不是 vip-pan/speccode-development 则以实际为准。)

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md plugins/speccode/.claude-plugin/plugin.json
git commit -m "docs: update CLAUDE.md for v2; plugin.json 0.2.0"
```

### Task 3: 润色包(各阶段 park 项)

**Files:**
- Modify: `plugins/speccode/commands/proposing.md`、`syncing.md`、`reset.md`、`brainstorming.md`

**Interfaces:**
- Consumes: P1–P7 ledger 的 park 项。Produces: 一致性收尾。

- [ ] **Step 1: 四处润色**:
  1. `proposing.md`:「从会话上下文集锦 exploring 结论」的「集锦」→「梳理」。
  2. `syncing.md`:护栏首句「syncing 只动 `speccode/spec/` 并提交」改为「syncing 的规格合并只动 `speccode/spec/`;brainstorm 残余吸收的回写落在 `speccode/changes/<slug>/`,一并提交」(与落盘段双路径 add 对齐)。
  3. `syncing.md`:delta 源契约段补一句——「`propose/` 不存在(纯 brainstorming 路径)时:若 `brainstorm/` 存在,以 brainstorm/ 文档提炼 delta 进行合并;若两者都不存在,报告无 delta 并停止」。
  4. `reset.md`:「执行」段第 3 步清理询问的目录清单加 `.speccode/brainstorm/`(visual companion 产物)。
  5. `brainstorming.md`:检查清单第 10 项标签「落盘即提交」→「批准后提交(落盘即 commit)」。

- [ ] **Step 2: 验证**

Run: `git grep -n "集锦" plugins/speccode/commands/` → 零命中
Run: `git grep -c "brainstorm/" plugins/speccode/commands/reset.md plugins/speccode/commands/syncing.md` → 各 ≥1

- [ ] **Step 3: Commit**

```bash
git add plugins/speccode/commands/
git commit -m "docs(commands): polish sweep from phased review ledgers"
```

### Task 4: OpenSpec sync + spec-docs-tracking-control 删除 + validate

**Files:**
- Modify: `openspec/specs/`(sync 产物)、`openspec/changes/speccode-v2-sdd-flow/`(不删,archive 在 T6 后)

**Interfaces:**
- Consumes: change 的 9 个 delta。Produces: 6 个主 spec 更新 + 4 个新主 spec + spec-docs-tracking-control 目录删除。

- [ ] **Step 1: 执行 `/opsx:sync speccode-v2-sdd-flow`**(agent 流;逐 capability 智能合并,含 plugin-packaging 四条 MODIFIED;Purpose 权威;REMOVED 逐字删除)
- [ ] **Step 2: 删除空壳主 spec**:

```bash
git rm -r openspec/specs/spec-docs-tracking-control/
```

(REMOVED-all 后主 spec 成空壳过不了 `requirements.min(1)` 校验,必须删目录——design D2 注记。)

- [ ] **Step 3: 全量校验**

```bash
openspec validate speccode-v2-sdd-flow --strict
for d in openspec/specs/*/; do openspec validate "$(basename $d)" --strict; done
ls openspec/specs/   # 期望 8 个:git-workflow-lifecycle / pr-tool-integration / speccode-config-management / plugin-packaging / sdd-document-lifecycle / hook-event-integration / session-memory / knowledge-tool-integration(无 spec-docs-tracking-control)
```

Expected: 全部 valid

- [ ] **Step 4: Commit**

```bash
git add openspec/
git commit -m "docs(openspec): sync speccode-v2-sdd-flow deltas; drop spec-docs-tracking-control"
```

### Task 5: dogfood 走查(scratch 仓)

**Files:** 无(scratch 仓在 tmp)

- [ ] **Step 1: 走查脚本化流程**(在 `mktemp -d` 的裸 git 仓里,用 `node plugins/speccode/bin/speccode.mjs` 手动驱动,覆盖):
  1. init 流:write-config 组装 v2 config(含 hooks.onSynced = `cat >> <tmp>/hook.log`)→ read-config 读回
  2. creating-feature 流:checkout -b feature/demo + write-state + write-memory 骨架 + run-hook onFeatureCreated(验 hook.log 落一行 JSON)
  3. creating-worktree 流:resolve-worktree-dir + git worktree add + write-state
  4. proposing 流(在 worktree 内):建 `speccode/changes/demo/propose/` 四类文档 + commit + run-hook onProposed
  5. writing-plans 流:建 plan/ 文档 + commit
  6. SDD 工件:sdd-workspace/task-brief(Task 1 vs Task 10 抽取)/review-package
  7. syncing 流:合并进 speccode/spec/ + commit;**再跑一遍验幂等(无变更短路)**;run-hook onSynced 验 hook.log
  8. archiving 流:mv 到 speccode/archive/2026-08-08-demo + commit
  9. finishing-worktree 流(本地 squash 路径):`git -C <主仓> merge --squash` + commit + 复测 + worktree remove + state completed
  10. finishing-feature 流:pr_tool=none → 打印等效命令降级路径;模拟 MERGED 后 delete-state + checkout trunk
  11. status / reset(reset 验 memory//sdd/ 清理询问的目录存在性)
- [ ] **Step 2: 记录走查结果**到 SDD workspace 的 dogfood 报告文件;任何一步失败 → BLOCKED 并报告。

### Task 6: P8 验收 + 归档本 change

**Files:**
- Modify: `openspec/changes/speccode-v2-sdd-flow/tasks.md`(勾选 P8)

- [ ] **Step 1: 全量测试 + 回归断言**

```bash
node --test ./plugins/speccode/tests/*.test.mjs   # 131 绿
git grep -n "display" plugins/speccode/lib plugins/speccode/bin   # 仅 state.mjs 的 waiting_display_pr 注释一处(spec 裁定豁免)
git grep -rn "develop-complete\|develop-start" plugins/speccode/commands plugins/speccode/README.md   # 仅 README 迁移对照表
openspec list --json   # 确认 change 状态
```

- [ ] **Step 2: 勾选 tasks.md P8**(8.1–8.10;8.10 的 archive 在本 Task Step 3 执行后勾)

- [ ] **Step 3: 执行 `/opsx:archive speccode-v2-sdd-flow`**(agent 流,不用裸 openspec archive;tasks 全部完成、specs 已 sync,走「Archive now」路径)

- [ ] **Step 4: Commit**

```bash
git add openspec/
git commit -m "docs(openspec): archive speccode-v2-sdd-flow"
```

---

## Self-Review 记录

- **Spec 覆盖**:plugin-packaging 四条 MODIFIED(命令命名空间/plugin.json 元数据/文档三层分离/命令正文手写路径)→ T1/T2;P8 全部 tasks 映射(8.1→T1,8.2→T2,8.3→T2,8.4 前提已满足、8.5/8.6/8.7→T4,8.8→T6 Step 1,8.9→T5,8.10→T6 Step 3)。
- **Placeholder 扫描**:README 成稿要点逐节给出(命令表逐字);润色四处为精确行级修改;sync/archive 走 agent 流程有既定命令承接。
- **一致性**:README 事实基线与 P1–P7 终审后状态核对过(21 命令/12 lib/18 verb/14 事件/131 测试);迁移表与改名清单一致;R 表增删与 design 风险节一致。
- **既有兼容**:无引擎改动;131 测试保持绿。
