# knowledge 命令 trunk 化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 distilling-knowledge / recording-knowledge 从 trunk 运行,经轻量 `chore/knowledge-*` 分支 + 直通 PR 落盘,不再绑 feature/worktree state;维护摘要写 trunk 级 `_knowledge.md`。

**Architecture:** CLI 层放宽 memory 分支校验接受 `_knowledge` 保留键(lib 暴露常量列表);两条命令 markdown 重写「前置」(trunk 入口 + bootstrap)与「落盘」(_knowledge memory + 直通 PR)段,蒸馏/闸门/适配闸门内容逻辑不变;PR 创建镜像 finishing-feature §2 命令层 shell out。

**Tech Stack:** Node ≥ 24,纯 ESM、零第三方依赖(仅 `node:` 内置);无 `package.json`;测试用 `node --test`;命令层 markdown 指令 + CLI verb。

## Global Constraints

- Node ≥ 24;无 `package.json`;全量测试必须用 glob 形式:`node --test ./plugins/speccode/tests/*.test.mjs`(裸 `node --test plugins/speccode/tests/` 在 v24 报 MODULE_NOT_FOUND)。
- 零第三方依赖:仅 `node:` 内置模块,不得引入外部包。
- 确定性逻辑下沉 lib,命令 markdown 不重复实现逻辑;纯 git/gh 动作可写在命令层。
- 原子写:config/state/memory/knowledge 写入必须经 verb(write-config / write-state / write-memory / write-knowledge),命令层绝不手写 JSON 文件。
- 仓库根定位:主仓根用 `--git-common-dir`;memory/ 为 trunk 级共享(主仓 `.speccode/memory/`)。
- 多语言:根 README 与插件 README 各有中英两版,任何改动 MUST 同步全部语言版本;不硬编码版本号与测试数量。
- PR 创建:`pr_tool=none` MUST 打印等效命令并中止(不创 state、不调 finishing-feature),与 finishing-feature §2 一致。
- 命令层中文交互;命令 markdown 体内 prose 用中文。

---

### Task 1: CLI 接受 `_knowledge` trunk memory 键(TDD)

**Files:**
- Modify: `plugins/speccode/lib/memory.mjs`(顶部加导出常量)
- Modify: `plugins/speccode/bin/speccode.mjs:13`(import)+ `:205`(read-memory 校验)+ `:214`(write-memory 校验)
- Test: `plugins/speccode/tests/cli.test.mjs`(新增 `_knowledge` 用例,接在 `_exploring` 用例后)

**Interfaces:**
- Consumes: 现有 `validateBranch(branch)`(slug.mjs)、`readMemory`/`writeMemory`(memory.mjs)。
- Produces: `TRUNK_MEMORY_KEYS`(memory.mjs 导出,`['_exploring','_knowledge']`);read-memory/write-memory verb 接受 `--branch _knowledge`。

- [x] **Step 1: 写失败测试**

在 `tests/cli.test.mjs` 的 `test('write-memory accepts the _exploring sentinel branch', ...)` 用例之后追加(镜像其结构):

```javascript
test('write-memory accepts the _knowledge sentinel branch', () => {
  const repo = makeRepo();
  const w = spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', '_knowledge', '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ mode: 'replace', content: 'distilled\n' }), encoding: 'utf8' });
  assert.equal(w.status, 0);
  assert.ok(JSON.parse(w.stdout.trim()).ok);
  const r = runCli(repo, 'read-memory', '--cwd', repo, '--branch', '_knowledge');
  assert.equal(r.json.memory, 'distilled\n');
  rmSync(repo, { recursive: true, force: true });
});

test('read-memory accepts the _knowledge sentinel branch (returns null when absent)', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'read-memory', '--cwd', repo, '--branch', '_knowledge');
  assert.equal(code, 0);
  assert.deepEqual(json, { ok: true, memory: null });
  rmSync(repo, { recursive: true, force: true });
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test --test-name-pattern="_knowledge sentinel" plugins/speccode/tests/cli.test.mjs`
Expected: FAIL — `write-memory` 退出码 1,`assert.equal(w.status, 0)` 失败;stdout 含 `invalid branch name: _knowledge`(因 bin 现仅例外 `_exploring`)。

- [x] **Step 3: 写最小实现**

(a) `plugins/speccode/lib/memory.mjs`:在顶部 import 之后、`memoryDir` 之前加导出常量:

```javascript
// Trunk-level (non-feature) memory keys: no-slash keys that bypass the
// <type>/<slug> branch validation. `_exploring` = exploring conclusions before
// a feature exists; `_knowledge` = knowledge-command maintenance summaries
// (knowledge commands run from trunk, not bound to a feature).
export const TRUNK_MEMORY_KEYS = ['_exploring', '_knowledge'];
```

(b) `plugins/speccode/bin/speccode.mjs:13`:把 import 扩为含常量:

```javascript
import { readMemory, writeMemory, TRUNK_MEMORY_KEYS } from '../lib/memory.mjs';
```

(c) `bin/speccode.mjs` read-memory(约 205 行)与 write-memory(约 214 行)两处,把:

```javascript
    if (branch !== '_exploring' && !validateBranch(branch)) {
      return { ok: false, error: `invalid branch name: ${branch}` };
    }
```

改为(两处一致):

```javascript
    if (!TRUNK_MEMORY_KEYS.includes(branch) && !validateBranch(branch)) {
      return { ok: false, error: `invalid branch name: ${branch}` };
    }
```

(read-memory 处保留其后的 `return { ok: true, memory: readMemory(...) }`;write-memory 处保留其后的 mode/content 解析。只改那一个 `if` 条件。)

- [x] **Step 4: 运行确认通过**

Run: `node --test --test-name-pattern="_knowledge sentinel" plugins/speccode/tests/cli.test.mjs`
Expected: PASS — 两个新用例通过。
再跑全量回归:`node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS — 228(原 226 + 新 2)全绿,无回归。

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/lib/memory.mjs plugins/speccode/bin/speccode.mjs plugins/speccode/tests/cli.test.mjs
git commit -m "feat(memory): accept _knowledge trunk-level memory key"
```

---

### Task 2: 重写 distilling-knowledge.md(前置 + 落盘段)

**Files:**
- Modify: `plugins/speccode/commands/distilling-knowledge.md`(替换「## 前置」与「## 落盘」两段;「## 蒸馏」「## 闸门」「## 约束」段不变)

**Interfaces:**
- Consumes: Task 1 的 `_knowledge` memory 键;现有 verb `read-knowledge` / `write-knowledge` / `read-consumed-archives` / `write-consumed-archives`;`config.trunk`、`config.pr_tool`。
- Produces: 命令从 trunk 运行,bootstrap `chore/knowledge-*` 分支,直通 PR 回 trunk,memory 写 `_knowledge`。

说明:命令 markdown 是 prose 指令,无单元测试可写;以结构化 grep 锚点 + 全量回归作为验证。

- [x] **Step 1: 替换「## 前置」整段**

把当前「## 前置」第 1-9 条(以 `1. read-config 加载 config` 起、至 `9. 若 code_intel_tools...` 止)整段替换为:

```markdown
## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. **trunk 入口校验**:`git rev-parse --abbrev-ref HEAD` MUST 等于 `config.trunk`,或为 `chore/knowledge-*` 维护分支(续跑,见 §3)。HEAD 为 `worktree-` 前缀分支,或 `feature/`/`bugfix/`/`refactor/` 功能分支,或**不匹配 `chore/knowledge-` 的** `chore/` 功能分支 → 退出并提示「请在 trunk 上运行本命令(knowledge 维护从 trunk 跑,不经 worktree/feature)」。
3. **bootstrap 维护分支**:
   - 若 HEAD 已是 `chore/knowledge-*` 分支(续跑)→ 跳过本步,直接进入 §4。
   - 否则(在 trunk)检测本地未完成的 `chore/knowledge-*` 分支:`git for-each-ref --format='%(refname:short)' refs/heads/ | grep '^chore/knowledge-'`。有命中 → AskUserQuestion 询问「续跑(checkout 既有)/新建」;续跑 → `git checkout <既有分支>` 后进入 §4。
   - 无命中 → AskUserQuestion 确认新分支名(默认 `chore/knowledge-distill`);slug 须匹配 `^[a-z0-9-]+$`,组合为 `chore/knowledge-<slug>`。
   - `git checkout -b chore/knowledge-<slug>` + `git push -u origin chore/knowledge-<slug>`。
   - **不创建 speccode state、不运行 reconcile、不开 git worktree。**
4. 运行 `speccode.mjs read-knowledge --cwd .`(无 flag)获取现状:`files`(topic 清单)与 `index`(`_index.md` 内容,可能为 null)。
5. `speccode/knowledge/` 不存在 → 创建骨架:6 个初始 topic 空文件(development/architecture.md、development/standards.md、development/environment.md、development/integrations.md、development/pitfalls.md、development/security.md)+ `_index.md`,不创建 business/ 目录。机制:对 6 个文件逐个执行 `write-knowledge --rel <file> --json-stdin`(mode=replace,content 为空串),再执行 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries 为 development 一个空清单 section)创建索引——绝不 mkdir/touch/手写文件。
6. 读 `speccode/spec/`(各 capability 主规格,**全量**)。archive 改**增量读**:运行 `speccode.mjs read-consumed-archives --cwd .` 得 `{consumed, present, unconsumed, bootstrap}`——`bootstrap=true`(sidecar `_distilled.meta.json` 缺失)则首次引导,本次全量读 archive 全部归档包;否则只读 `unconsumed` 列出的归档包,`consumed` 包整包跳过(含其 propose/design/brainstorm 子文档)。`present` 是盘上归档包全集,留给闸门做 stale 判定。
7. 删 `_distilled.meta.json` 再跑即强制全量重读 + 全块重蒸 + 重种子,为蒸馏判据变更后的官方逃生口,不另设 `--full` flag。
8. 若 `code_intel_tools`(config)非空且其能力在会话中可用,读 spec/archive 时优先参考;不可用回退直接读文件,不报错。
```

- [x] **Step 2: 替换「## 落盘」整段**

把当前「## 落盘」第 1-5 条整段替换为:

```markdown
## 落盘

1. 各 topic 写入完成后更新 `_index.md`:为每个 topic 文件生成一行摘要(标题 + 文件 + 一句话摘要),组装 entries(实扫现有 topic 文件(跳过内容为空的 topic 文件),按顶层目录名分组为 sections,不硬编码固定 section 清单),经 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries=...)写入。
2. (新)登记消费:把本次读过的归档包目录名(含读了无产出的;首次引导时 = 本次全量读的全部归档包,即种子),经 `speccode.mjs write-consumed-archives --cwd . --json-stdin` 原子追记进 `_distilled.meta.json`:
   ```bash
   speccode.mjs write-consumed-archives --cwd . --json-stdin <<'EOF'
   {"add":["<归档目录名>",...]}
   EOF
   ```
   即使本次全部 topic 无变化(跳过 topic 写),本步骤仍 MUST 执行。
3. **memory(trunk 级)**:经 `speccode.mjs write-memory --cwd . --branch _knowledge --json-stdin`(mode=append)追加本次蒸馏摘要(哪些 topic 变化/无变化/新增):
   ```bash
   speccode.mjs write-memory --cwd . --branch _knowledge --json-stdin <<'EOF'
   {"mode":"append","content":"<摘要>"}
   EOF
   ```
4. 全部写入完成后 MUST 立即提交:
   ```bash
   git add speccode/knowledge/
   git commit -m "docs(knowledge): distill knowledge set"
   ```
5. **直通 PR**:先 `git push origin <维护分支>`(把 item 4 的提交推到远端,PR 创建前置;镜像 finishing-feature §2),再用 `pr_tool` 创建 PR(参数同 `createPrArgs`,base=`config.trunk`,head=当前 `chore/knowledge-*` 维护分支,title=`docs(knowledge): distill knowledge set`,body=topic 变化摘要)。`pr_tool=none` → 打印等效命令(如 `gh pr create --base <trunk> --head <维护分支> --title "docs(knowledge): distill knowledge set"`)并中止,且 MUST NOT 创建 speccode state 或经 finishing-feature。**不阻塞等待合并、不调用 finishing-feature/finishing-worktree。**
6. 报告:哪些 topic 变化/无变化/新增 + PR url(或等效命令)。
```

(「## 蒸馏」「## 闸门」「## 约束」三段保持不变——其内容逻辑未改;注意「## 约束」里「只写 speccode/knowledge/」与幂等语义不变。)

- [x] **Step 3: 验证结构锚点**

Run: `grep -cE 'trunk 入口校验|chore/knowledge-|_knowledge|直通 PR' plugins/speccode/commands/distilling-knowledge.md`
Expected: 命中数 ≥ 4(四处新锚点都在)。
Run: `grep -n 'worktree-\* 分支上运行' plugins/speccode/commands/distilling-knowledge.md`
Expected: 仅命中文件头 description 区(若顶部「**应在 worktree-* 分支上运行**」一句仍存,改为「**应在 trunk 分支上运行**」)。

- [x] **Step 4: 改文件头说明句**

把文件正文开头「全程中文交互。**应在 worktree-* 分支上运行**。」改为「全程中文交互。**应在 trunk 分支上运行**(`git rev-parse --abbrev-ref HEAD` 校验等于 `config.trunk`)。」

- [x] **Step 5: 全量回归**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS — 全绿(命令 markdown 不被测试覆盖,但须确认无其他回归)。

- [x] **Step 6: 提交**

```bash
git add plugins/speccode/commands/distilling-knowledge.md
git commit -m "refactor(distilling-knowledge): trunk entry + direct PR + _knowledge memory"
```

---

### Task 3: 重写 recording-knowledge.md(前置 + 落盘段,保留适配闸门)

**Files:**
- Modify: `plugins/speccode/commands/recording-knowledge.md`(替换「## 前置」与「## 落盘」两段;「## 收集内容」「## 闸门」(含适配判断)不变)

**Interfaces:**
- Consumes: Task 1 的 `_knowledge` 键;`config.trunk`、`config.pr_tool`;现有 `write-knowledge`。
- Produces: 命令从 trunk 运行,bootstrap `chore/knowledge-<topic>`,直通 PR,memory 写 `_knowledge`。

- [x] **Step 1: 替换「## 前置」整段**

把当前「## 前置」第 1-6 条整段替换为:

```markdown
## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. **trunk 入口校验**:`git rev-parse --abbrev-ref HEAD` MUST 等于 `config.trunk`,或为 `chore/knowledge-*` 维护分支(续跑,见 §3)。HEAD 为 `worktree-` 前缀分支,或 `feature/`/`bugfix/`/`refactor/` 功能分支,或**不匹配 `chore/knowledge-` 的** `chore/` 功能分支 → 退出并提示「请在 trunk 上运行本命令(knowledge 维护从 trunk 跑,不经 worktree/feature)」。
3. **bootstrap 维护分支**:
   - 若 HEAD 已是 `chore/knowledge-*` 分支(续跑)→ 跳过本步,直接进入 §4。
   - 否则(在 trunk)检测本地未完成的 `chore/knowledge-*` 分支:`git for-each-ref --format='%(refname:short)' refs/heads/ | grep '^chore/knowledge-'`。有命中 → AskUserQuestion 询问「续跑(checkout 既有)/新建」;续跑 → `git checkout <既有分支>` 后进入 §4。
   - 无命中 → AskUserQuestion 确认新分支名(默认 `chore/knowledge-<topic>`;topic 取自待记录内容的主题,无主题则 `chore/knowledge-record`);slug 须匹配 `^[a-z0-9-]+$`,组合为 `chore/knowledge-<slug>`。
   - `git checkout -b chore/knowledge-<slug>` + `git push -u origin chore/knowledge-<slug>`。
   - **不创建 speccode state、不运行 reconcile、不开 git worktree。**
4. 运行 `speccode.mjs read-knowledge --cwd .`(无 flag)获取现状(topic 清单 + 索引)。
5. `speccode/knowledge/` 不存在 → 创建骨架(同 distilling-knowledge 的 6 development topic 空文件 + `_index.md`,经 write-knowledge 创建,绝不手写)。
```

- [x] **Step 2: 替换「## 落盘」整段**

把当前「## 落盘」第 1-4 条整段替换为:

```markdown
## 落盘

1. `_index.md` 需更新时(新 topic、摘要变化、或索引缺失)→ 组装 entries(实扫现有 topic 文件(跳过内容为空的 topic 文件),按顶层目录名分组为 sections,不硬编码固定 section 清单),经 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries=...)写入。
2. **memory(trunk 级)**:经 `speccode.mjs write-memory --cwd . --branch _knowledge --json-stdin`(mode=append)追加本次记录摘要(写入位置 + topic):
   ```bash
   speccode.mjs write-memory --cwd . --branch _knowledge --json-stdin <<'EOF'
   {"mode":"append","content":"<摘要>"}
   EOF
   ```
3. MUST 立即提交:
   ```bash
   git add speccode/knowledge/
   git commit -m "docs(knowledge): record <topic>"
   ```
4. **直通 PR**:先 `git push origin <维护分支>`(把 item 3 的提交推到远端,PR 创建前置;镜像 finishing-feature §2),再用 `pr_tool` 创建 PR(参数同 `createPrArgs`,base=`config.trunk`,head=当前 `chore/knowledge-*` 维护分支,title=`docs(knowledge): record <topic>`,body=记录摘要)。`pr_tool=none` → 打印等效命令并中止,且 MUST NOT 创建 state 或经 finishing-feature。**不阻塞等待合并、不调用 finishing-feature/finishing-worktree。**
5. 报告:写入位置 + PR url(或等效命令)。
```

(「## 收集内容」「## 闸门」(含适配判断:业务知识建议进 RAG、过程知识建议落入 topic)保持不变;「## 约束」里「只写 hand-written 段」与「内容不得包含 `<!--` 或 `-->`」不变。)

- [x] **Step 3: 改文件头说明句**

把正文开头「全程中文交互。**应在 worktree-* 分支上运行**。」改为「全程中文交互。**应在 trunk 分支上运行**(`git rev-parse --abbrev-ref HEAD` 校验等于 `config.trunk`)。」

- [x] **Step 4: 验证结构锚点**

Run: `grep -cE 'trunk 入口校验|chore/knowledge-|_knowledge|直通 PR' plugins/speccode/commands/recording-knowledge.md`
Expected: 命中数 ≥ 4。
Run: `grep -n '适配判断\|业务知识\|RAG' plugins/speccode/commands/recording-knowledge.md`
Expected: 「## 闸门」的适配判断段仍在(未被误删)。

- [x] **Step 5: 全量回归**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS — 全绿。

- [x] **Step 6: 提交**

```bash
git add plugins/speccode/commands/recording-knowledge.md
git commit -m "refactor(recording-knowledge): trunk entry + direct PR + _knowledge memory"
```

---

### Task 4: 文档同步(README 中英 + CHANGELOG BREAKING)

**Files:**
- Modify: `plugins/speccode/README.md`(命令表 knowledge 两条约束列)
- Modify: `plugins/speccode/README_CN.md`(同上,中文)
- Modify: `plugins/speccode/CHANGELOG.md`(或仓库根 CHANGELOG,以实际文件为准——先定位)

**Interfaces:**
- Consumes: Task 2/3 的行为变更(knowledge 命令约束 `worktree-*` → `trunk`)。
- Produces: 文档与行为一致;CHANGELOG 标 BREAKING。

- [x] **Step 1: 定位 CHANGELOG 与命令表行**

Run: `grep -rn "distilling-knowledge\|recording-knowledge" plugins/speccode/README.md plugins/speccode/README_CN.md`
Expected: 各命中命令表两行(含约束列 `worktree-* branch`)。
Run: `ls plugins/speccode/CHANGELOG.md CHANGELOG.md 2>/dev/null`
Expected: 确认 CHANGELOG 实际路径。

- [x] **Step 2: 改 README 命令表约束列**

`plugins/speccode/README.md` 与 `plugins/speccode/README_CN.md` 命令表中 distilling-knowledge / recording-knowledge 两行的约束列,把 `worktree-* branch` 改为 `trunk branch`。两版结构一一对应,改动 MUST 同步。

- [x] **Step 3: CHANGELOG 加 BREAKING 条目**

在 CHANGELOG `[Unreleased]`(或对应版本段)加:

```markdown
### BREAKING
- `distilling-knowledge` / `recording-knowledge`:改为从 trunk 运行(不再要求 worktree 分支);trunk 上 bootstrap `chore/knowledge-*` 维护分支 + 直通 PR 回 trunk,不再绑 feature/worktree state;维护摘要改写 trunk 级 `.speccode/memory/_knowledge.md`。在 worktree/feature 分支运行会被拒(提示回 trunk)。
```

- [x] **Step 4: 验证**

Run: `grep -n "trunk branch" plugins/speccode/README.md plugins/speccode/README_CN.md`
Expected: 各 ≥ 2 处(两条命令)。
Run: `grep -n "BREAKING" <CHANGELOG 路径>`
Expected: 命中新条目。

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/README.md plugins/speccode/README_CN.md <CHANGELOG 路径>
git commit -m "docs(knowledge): trunk entry BREAKING — README + CHANGELOG"
```

---

### Task 5: 全量回归 + 自洽校验

**Files:**
- 无新文件;本任务是集成验证闸门。

**Interfaces:**
- Consumes: Task 1-4 全部交付。

- [x] **Step 1: 全量测试**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS — 全绿(228+,含 Task 1 新增 2 用例)。

- [x] **Step 2: 蒸馏/记录命令自洽 grep**

Run: `grep -rn "应在 worktree-\*\? 分支" plugins/speccode/commands/distilling-knowledge.md plugins/speccode/commands/recording-knowledge.md`
Expected: 无命中(旧 worktree 约束句已全删/改)。
Run: `grep -rn "reconcile --cwd\|read-memory --branch <F>\|write-memory --branch <F>" plugins/speccode/commands/distilling-knowledge.md plugins/speccode/commands/recording-knowledge.md`
Expected: 无命中(旧 feature 绑定已移除;`write-memory` 仅以 `--branch _knowledge` 形式出现)。

- [x] **Step 3: spec delta 与命令一致性**

确认 `speccode/changes/knowledge-trunk-bootstrap/propose/specs/knowledge-set/spec.md` 的 ADDED「知识维护分支与直通 PR」scenarios(trunk bootstrap / 续跑 / 续跑检测 / worktree 拒绝 / pr_tool=none / _knowledge memory)与 Task 2/3 命令行为一一对应(人工对读)。

- [x] **Step 4: 提交(若有 Step 2 修整)**

若 Step 2 发现残留旧句并修正:
```bash
git add plugins/speccode/commands/
git commit -m "docs(knowledge): remove residual worktree constraint phrasing"
```
否则跳过本步。

---

## 计划自查

1. **规格覆盖**:design 的 6 项 Decisions → Task 1(lite CLI 校验、_memory trunk 键)、Task 2/3(trunk bootstrap、直通 PR、砍 worktree 入口)、Task 4(BREAKING 文档);R1-R4 风险 → R1 三层拓扑例外由 knowledge-set ADDED requirement 表达(spec 已写)、R2 续跑检测(Task 2/3 §3)、R3 BREAKING(Task 4)、R4 pr_tool=none(Task 2/3 §落盘);Open Questions(business/ Non-Goal、git-workflow-lifecycle 放宽、PR title 规范)均标注为实现期/后续,不在本计划硬编码。无缺口。
2. **占位符扫描**:全文无 TBD/TODO/「稍后」/「适当处理」;所有代码步骤含真实代码块;PR title 已定稿(`docs(knowledge): distill knowledge set` / `record <topic>`)。
3. **类型一致性**:`TRUNK_MEMORY_KEYS` 在 Task 1 定义为 `['_exploring','_knowledge']`,Task 2/3 以 `--branch _knowledge` 引用,一致;`createPrArgs` 签名 `{base,head,title,body}` 在 Task 2/3 一致;`config.trunk` / `config.pr_tool` 全文一致。
