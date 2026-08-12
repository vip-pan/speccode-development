# speccode v2 · P1 拓扑收敛与改名 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 speccode 从四层拓扑(trunk/display/feature/worktree)收敛为三层(trunk/feature/worktree),完成 4 个命令改名与 finishing-worktree/finishing-feature 改写,引擎侧落地 normalizeState、query-pr(含 CONFLICTING)、reconcile prefix 配置化、`--json-stdin` 显式化,删除 docstrip/waitmerge。

**Architecture:** 对应 OpenSpec change `speccode-v2-sdd-flow` 的 P1 阶段(见 `openspec/changes/speccode-v2-sdd-flow/tasks.md`)。引擎改动全部 TDD(先测试后实现);命令 markdown 为 prose 改写,验证靠结构化 grep 与全量测试。本计划只做 P1;P2(init 增强/config v2 字段)、P3-P7(新命令/hooks/memory)、P8(文档与 sync)各自另有计划。

**Tech Stack:** Node ≥ 24,纯 ESM,零第三方依赖(仅 `node:` 内置模块),node:test,真实临时 git 仓库测试(tests/helpers/tmprepo.mjs)。

## Global Constraints

- 测试命令 MUST 用 glob 形式:`node --test ./plugins/speccode/tests/*.test.mjs`(裸目录形式在 Node v24 报 MODULE_NOT_FOUND)。
- 所有 `.speccode/` JSON 写入 MUST 走 `atomic.writeJsonAtomic`;命令层只能经 `write-config` / `write-state` verb,绝不手写 JSON 文件。
- 仓库根定位 MUST 用 `git rev-parse --path-format=absolute --git-common-dir` + dirname(不是 `--show-toplevel`)。
- 写 verb MUST 要求 `--json-stdin` 并从 stdin 读 JSON;未知 verb 或抛错 → `{ok:false}` + exit 1。
- 命令正文裸调 `speccode.mjs <verb> --cwd .`;命令 prose 全程中文;frontmatter 固定四字段 `name / description / category: Workflow / tags`。
- 新命令名:creating-feature / creating-worktree / finishing-worktree / finishing-feature;`pending_operation.command` 新写入只允许这两个值。
- worktree 状态枚举不变:`pending | in_progress | pr_open | completed`(state.mjs `WORKTREE_STATUS`)。
- 提交信息遵守仓库惯例(<type>: <summary>,如 `refactor:`/`feat:`/`test:`)。

## File Structure

**引擎(改):**
- `plugins/speccode/lib/state.mjs` — 新增 `normalizeState()`,`readState`/`listActiveFeatures` 双路径调用
- `plugins/speccode/lib/prtool.mjs` — `queryPrArgs` gh 加 `mergeable` 字段;`parsePrState` 产出五态(含 CONFLICTING);`queryPrState` 透传 cwd
- `plugins/speccode/lib/config.mjs` — 删除 `DEFAULT_UNTRACKED`
- `plugins/speccode/bin/speccode.mjs` — reconcile prefix 读 config(带兜底);新增 `query-pr` verb;write-config/write-state 强制 `--json-stdin`

**引擎(删):**
- `plugins/speccode/lib/docstrip.mjs`、`plugins/speccode/lib/waitmerge.mjs`

**测试(改/删):**
- `plugins/speccode/tests/state.test.mjs`(增 normalizeState 用例)
- `plugins/speccode/tests/prtool.test.mjs`(改 queryPrArgs 期望 + 增 CONFLICTING 用例)
- `plugins/speccode/tests/cli.test.mjs`(增 query-pr / --json-stdin 用例;两个 no-config reconcile 测试不动)
- `plugins/speccode/tests/config.test.mjs`(删 DEFAULT_UNTRACKED import 与专项测试)
- 删:`plugins/speccode/tests/docstrip.test.mjs`、`plugins/speccode/tests/waitmerge.test.mjs`

**命令(删 7 / 建 4 / 改 2):**
- 删:`commands/start.md`、`develop-start.md`、`develop-complete.md`、`finish.md`、`display-merge-trunk.md`、`display-rebase-trunk.md`、`display-reset-to-trunk.md`
- 建:`commands/creating-feature.md`、`creating-worktree.md`、`finishing-worktree.md`、`finishing-feature.md`
- 改:`commands/status.md`、`commands/reset.md`(仅改名引用;reset 字段清理重构在 P2)

---

### Task 1: state.mjs normalizeState(legacy pending_operation 规范化)

**Files:**
- Modify: `plugins/speccode/lib/state.mjs`
- Test: `plugins/speccode/tests/state.test.mjs`

**Interfaces:**
- Produces: `normalizeState(state) -> state`(纯函数,不改入参);`readState`/`listActiveFeatures` 返回值经规范化。后续所有命令(Task 6-9)与 reconcile(Task 3)依赖规范化后的 `pending_operation.command` 新值。

- [ ] **Step 1: 写失败测试** — 追加到 `plugins/speccode/tests/state.test.mjs`(import 行加 `normalizeState`):

```js
test('normalizeState maps legacy pending_operation.command (finish)', () => {
  const s = normalizeState({
    feature_branch: 'feature/p',
    pending_operation: { command: 'finish', phase: 'waiting_trunk_pr', pr_number: 7 },
  });
  assert.equal(s.pending_operation.command, 'finishing-feature');
  assert.equal(s.pending_operation.phase, 'waiting_trunk_pr');
});

test('normalizeState maps develop-complete and keeps waiting_display_pr phase untouched', () => {
  const s = normalizeState({
    feature_branch: 'feature/p',
    pending_operation: { command: 'develop-complete', phase: 'waiting_display_pr', pr_number: 3 },
  });
  assert.equal(s.pending_operation.command, 'finishing-worktree');
  assert.equal(s.pending_operation.phase, 'waiting_display_pr');
});

test('normalizeState passes through states without pending_operation or with new names', () => {
  const plain = { feature_branch: 'feature/p', worktrees: {} };
  assert.deepEqual(normalizeState(plain), plain);
  const fresh = { feature_branch: 'feature/p', pending_operation: { command: 'finishing-feature', phase: 'waiting_trunk_pr' } };
  assert.deepEqual(normalizeState(fresh), fresh);
  assert.equal(normalizeState(null), null);
});

test('readState normalizes legacy pending_operation.command', () => {
  const dir = tmp();
  writeState(dir, 'feature/p', {
    feature_branch: 'feature/p',
    pending_operation: { command: 'finish', phase: 'waiting_trunk_pr', pr_number: 7 },
  });
  assert.equal(readState(dir, 'feature/p').pending_operation.command, 'finishing-feature');
  rmSync(dir, { recursive: true, force: true });
});

test('listActiveFeatures normalizes legacy pending_operation.command', () => {
  const dir = tmp();
  writeState(dir, 'feature/p', {
    feature_branch: 'feature/p',
    pending_operation: { command: 'develop-complete', phase: 'waiting_worktree_pr', pr_number: 9 },
  });
  const [s] = listActiveFeatures(dir);
  assert.equal(s.pending_operation.command, 'finishing-worktree');
  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test --test-name-pattern="normalizeState|readState normalizes|listActiveFeatures normalizes" plugins/speccode/tests/state.test.mjs`
Expected: FAIL(`normalizeState is not a function` / import 报错)

- [ ] **Step 3: 实现** — `plugins/speccode/lib/state.mjs` 在 `WORKTREE_STATUS` 后新增,并改 `readState`/`listActiveFeatures`:

```js
const LEGACY_COMMAND_NAMES = {
  'develop-complete': 'finishing-worktree',
  finish: 'finishing-feature',
};

// Normalize legacy (v0.1) state shapes on read. waiting_display_pr is kept
// as-is: the command layer reports it as non-resumable (see finishing-feature.md).
export function normalizeState(state) {
  if (!state || typeof state !== 'object') return state;
  const po = state.pending_operation;
  if (po && typeof po === 'object' && LEGACY_COMMAND_NAMES[po.command]) {
    return { ...state, pending_operation: { ...po, command: LEGACY_COMMAND_NAMES[po.command] } };
  }
  return state;
}
```

```js
export function readState(speccodeDir, branch) {
  return normalizeState(readJson(stateFilePath(speccodeDir, branch)));
}
```

```js
    .map((f) => normalizeState(readJson(join(dir, f))))
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test plugins/speccode/tests/state.test.mjs`
Expected: PASS(12 个测试)

- [ ] **Step 5: Commit**

```bash
git add plugins/speccode/lib/state.mjs plugins/speccode/tests/state.test.mjs
git commit -m "feat(state): normalize legacy pending_operation command names on read"
```

### Task 2: prtool.mjs CONFLICTING 五态 + cwd 透传

**Files:**
- Modify: `plugins/speccode/lib/prtool.mjs`
- Test: `plugins/speccode/tests/prtool.test.mjs`

**Interfaces:**
- Consumes: 无(独立模块)。
- Produces: `parsePrState(tool, jsonStdout) -> 'MERGED'|'OPEN'|'CLOSED'|'CONFLICTING'|'UNKNOWN'`;`queryPrState(tool, ref, opts)` 其中 `opts.run(cmd,args)->{code,stdout}`、`opts.cwd` 可选。Task 3 的 `query-pr` verb 与 reconcile 的 advance-pr 依赖此签名。

- [ ] **Step 1: 改/加失败测试** — `plugins/speccode/tests/prtool.test.mjs`:

(a) `queryPrArgs` 期望更新(gh 加 mergeable 字段):

```js
test('queryPrArgs for gh and glab', () => {
  assert.deepEqual(queryPrArgs('gh', 'feature/x'),
    ['pr', 'view', 'feature/x', '--json', 'state,mergedAt,mergeCommit,mergeable']);
  assert.deepEqual(queryPrArgs('glab', 'feature/x'),
    ['mr', 'view', 'feature/x', '--output', 'json']);
});
```

(b) 既有两个 `queryPrState` 注入测试里的 args 断言同步加 `,mergeable'`(gh 那个)。

(c) 新增 CONFLICTING 用例:

```js
test('parsePrState gh maps OPEN + mergeable=CONFLICTING to CONFLICTING', () => {
  assert.equal(parsePrState('gh', '{"state":"OPEN","mergeable":"CONFLICTING"}'), 'CONFLICTING');
  assert.equal(parsePrState('gh', '{"state":"OPEN","mergeable":"MERGEABLE"}'), 'OPEN');
  assert.equal(parsePrState('gh', '{"state":"MERGED","mergeable":"CONFLICTING"}'), 'MERGED');
});

test('parsePrState glab maps opened + has_conflicts to CONFLICTING', () => {
  assert.equal(parsePrState('glab', '{"state":"opened","has_conflicts":true}'), 'CONFLICTING');
  assert.equal(parsePrState('glab', '{"state":"opened","has_conflicts":false}'), 'OPEN');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test plugins/speccode/tests/prtool.test.mjs`
Expected: FAIL(queryPrArgs 期望不匹配;CONFLICTING 断言得到 OPEN)

- [ ] **Step 3: 实现** — `plugins/speccode/lib/prtool.mjs` 三处:

```js
export function queryPrArgs(tool, head) {
  if (tool === 'gh') return ['pr', 'view', head, '--json', 'state,mergedAt,mergeCommit,mergeable'];
  if (tool === 'glab') return ['mr', 'view', head, '--output', 'json'];
  throw new Error(`unsupported pr_tool: ${tool}`);
}
```

```js
export function parsePrState(tool, jsonStdout) {
  let obj;
  try { obj = JSON.parse(jsonStdout); } catch { return 'UNKNOWN'; }
  const raw = String(obj.state ?? '').toUpperCase();
  if (tool === 'gh') {
    if (raw === 'MERGED') return 'MERGED';
    if (raw === 'CLOSED') return 'CLOSED';
    if (raw === 'OPEN') {
      return String(obj.mergeable ?? '').toUpperCase() === 'CONFLICTING' ? 'CONFLICTING' : 'OPEN';
    }
    return 'UNKNOWN';
  }
  if (tool === 'glab') {
    if (raw === 'MERGED') return 'MERGED';
    if (raw === 'CLOSED') return 'CLOSED';
    if (raw === 'OPENED') {
      return obj.has_conflicts === true ? 'CONFLICTING' : 'OPEN';
    }
    return 'UNKNOWN';
  }
  return 'UNKNOWN';
}
```

```js
export function queryPrState(tool, ref, opts = {}) {
  const { run, cwd } = opts;
  const args = queryPrArgs(tool, ref);
  const exec = run || ((cmd, a) => {
    const r = spawnSync(cmd, a, { encoding: 'utf8', ...(cwd ? { cwd } : {}) });
    return { code: r.status ?? 1, stdout: r.stdout ?? '' };
  });
  const { code, stdout } = exec(tool, args);
  if (code !== 0) return 'UNKNOWN';
  return parsePrState(tool, stdout);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test plugins/speccode/tests/prtool.test.mjs`
Expected: PASS(12 个测试)

- [ ] **Step 5: Commit**

```bash
git add plugins/speccode/lib/prtool.mjs plugins/speccode/tests/prtool.test.mjs
git commit -m "feat(prtool): five-state PR query with CONFLICTING and cwd pass-through"
```

### Task 3: bin — query-pr verb、reconcile prefix 配置化、--json-stdin 强制

**Files:**
- Modify: `plugins/speccode/bin/speccode.mjs`
- Test: `plugins/speccode/tests/cli.test.mjs`

**Interfaces:**
- Consumes: Task 2 的 `queryPrState(tool, ref, { cwd })`。
- Produces: verb `query-pr --number <N> --cwd .` → `{ok:true, state}` / `{ok:false, error}`;write verb 契约「缺 `--json-stdin` → `{ok:false}` exit 1」。后续所有命令(P1 Task 6-9 与 P2+)依赖。

- [ ] **Step 1: 写失败测试** — 追加到 `plugins/speccode/tests/cli.test.mjs`:

```js
test('query-pr requires --number', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'query-pr', '--cwd', repo);
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  rmSync(repo, { recursive: true, force: true });
});

test('query-pr returns ok:false when config missing', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'query-pr', '--cwd', repo, '--number', '42');
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  rmSync(repo, { recursive: true, force: true });
});

test('query-pr returns ok:false when pr_tool is none', () => {
  const repo = makeRepo();
  spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ version: 1, pr_tool: 'none' }), encoding: 'utf8' });
  const { code, json } = runCli(repo, 'query-pr', '--cwd', repo, '--number', '42');
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  rmSync(repo, { recursive: true, force: true });
});

test('write-config without --json-stdin returns ok:false and exit 1', () => {
  const repo = makeRepo();
  const r = spawnSync('node', [BIN, 'write-config', '--cwd', repo],
    { cwd: repo, input: JSON.stringify({ version: 1 }), encoding: 'utf8' });
  assert.equal(r.status, 1);
  const json = JSON.parse(r.stdout.trim());
  assert.equal(json.ok, false);
  assert.ok(json.error.includes('--json-stdin'));
  rmSync(repo, { recursive: true, force: true });
});

test('write-state without --json-stdin returns ok:false and exit 1', () => {
  const repo = makeRepo();
  const r = spawnSync('node', [BIN, 'write-state', '--cwd', repo, '--branch', 'feature/x'],
    { cwd: repo, input: JSON.stringify({}), encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stdout.trim()).ok, false);
  rmSync(repo, { recursive: true, force: true });
});

test('reconcile uses config worktree_prefix when present', () => {
  const repo = makeRepo();
  mkdirSync(join(repo, '.speccode', 'state', 'features'), { recursive: true });
  spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ version: 1, worktree_prefix: 'wt-' }), encoding: 'utf8' });
  const { code, json } = runCli(repo, 'reconcile', '--cwd', repo);
  assert.equal(code, 0);
  assert.ok(json.ok);
  rmSync(repo, { recursive: true, force: true });
});
```

注意:`cli.test.mjs` 头部已 import `mkdirSync`/`join`;两个既有 no-config reconcile 测试(lines 35-44、140-147)**不改动**——它们编码「对账不因缺 config 崩溃」的安全网语义。

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test plugins/speccode/tests/cli.test.mjs`
Expected: FAIL(`unknown verb: query-pr`;write-config 无 flag 时仍成功)

- [ ] **Step 3: 实现** — `plugins/speccode/bin/speccode.mjs` 三处:

(a) reconcile verb 改为(config 只读一次,prefix 带兜底):

```js
  reconcile: ({ cwd, 'advance-pr': advancePr }) => {
    const sc = speccodeDirOf(cwd);
    const cfg = loadConfig(sc);
    let queryPr;
    if (advancePr) {
      const tool = cfg && cfg.pr_tool;
      if (tool && tool !== 'none') {
        queryPr = (prNumber) => queryPrState(tool, String(prNumber), { cwd });
      }
    }
    const res = reconcile(sc, { prefix: cfg?.worktree_prefix ?? 'worktree-', cwd, queryPr });
    return { ok: true, orphans: res.orphans, conflicts: res.conflicts, advanced: res.advanced,
      features: res.features };
  },
```

(b) 两个写 verb 加强制:

```js
  'write-config': ({ cwd, 'json-stdin': jsonStdin }) => {
    if (!jsonStdin) return { ok: false, error: 'write-config requires --json-stdin (pipe JSON via stdin)' };
    const cfg = JSON.parse(readStdin());
    saveConfig(speccodeDirOf(cwd), cfg);
    return { ok: true };
  },
```

```js
  'write-state': ({ cwd, branch, 'json-stdin': jsonStdin }) => {
    if (!jsonStdin) return { ok: false, error: 'write-state requires --json-stdin (pipe JSON via stdin)' };
    const st = JSON.parse(readStdin());
    writeState(speccodeDirOf(cwd), branch, st);
    return { ok: true };
  },
```

(c) 新增 verb(放在 `feature-progress` 之后):

```js
  'query-pr': ({ cwd, number }) => {
    if (!number) return { ok: false, error: 'query-pr requires --number <N>' };
    const cfg = loadConfig(speccodeDirOf(cwd));
    if (!cfg) return { ok: false, error: 'no .speccode/config.json; run /speccode:init first' };
    const tool = cfg.pr_tool;
    if (!tool || tool === 'none') return { ok: false, error: 'pr_tool is none; cannot query PR state' };
    return { ok: true, state: queryPrState(tool, String(number), { cwd }) };
  },
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS(全部,含两个 no-config reconcile 既有测试)

- [ ] **Step 5: Commit**

```bash
git add plugins/speccode/bin/speccode.mjs plugins/speccode/tests/cli.test.mjs
git commit -m "feat(cli): add query-pr verb, config-driven reconcile prefix, enforce --json-stdin"
```

### Task 4: config.mjs 删除 DEFAULT_UNTRACKED

**Files:**
- Modify: `plugins/speccode/lib/config.mjs:6-8`
- Test: `plugins/speccode/tests/config.test.mjs:7,12-15`

**Interfaces:**
- Consumes: 无。Produces: 无新增;`DEFAULT_UNTRACKED` 导出消失(全仓 grep 确认仅 config.test.mjs 引用,init.md 的 prose 集合在 P2 处理)。

- [ ] **Step 1: 改测试(先删引用,让失败显性化)** — `config.test.mjs`:
  - import 行改为 `import { configPath, loadConfig, saveConfig, backupConfig, diffFields } from '../lib/config.mjs';`
  - 删除整个 `test('DEFAULT_UNTRACKED lists the permanent set', ...)` 块(lines 12-15)。

- [ ] **Step 2: 跑测试确认状态** — 此时测试应仍 PASS(export 尚在)。本任务的「失败验证」靠 Step 4 的全量绿 + grep:

Run: `node --test plugins/speccode/tests/config.test.mjs`
Expected: PASS(4 个测试)

- [ ] **Step 3: 实现** — 删除 `config.mjs` lines 6-8 的 `DEFAULT_UNTRACKED` 定义与导出。

- [ ] **Step 4: 验证**

Run: `node --test ./plugins/speccode/tests/*.test.mjs` → 全绿
Run: `git grep -n "DEFAULT_UNTRACKED" plugins/speccode` → 零命中
Expected: 两者成立(若 grep 有残留引用,先修引用再删)

- [ ] **Step 5: Commit**

```bash
git add plugins/speccode/lib/config.mjs plugins/speccode/tests/config.test.mjs
git commit -m "refactor(config): drop DEFAULT_UNTRACKED (untracked_permanent retired)"
```

### Task 5: 删除 docstrip/waitmerge 与 3 个 display 命令

**Files:**
- Delete: `plugins/speccode/lib/docstrip.mjs`、`plugins/speccode/lib/waitmerge.mjs`
- Delete: `plugins/speccode/tests/docstrip.test.mjs`、`plugins/speccode/tests/waitmerge.test.mjs`
- Delete: `plugins/speccode/commands/display-merge-trunk.md`、`display-rebase-trunk.md`、`display-reset-to-trunk.md`

**Interfaces:**
- Consumes/Produces: 无(均为死代码/下线命令;bin 从未暴露 docstrip/waitmerge 的 verb,已核实)。

- [ ] **Step 1: 删除前验证无引用**

Run: `git grep -n "docstrip\|waitmerge\|waitForPrMerge" plugins/speccode/lib plugins/speccode/bin plugins/speccode/tests -- ':!*docstrip*' ':!*waitmerge*'`
Expected: 零命中(有则先处理引用)

- [ ] **Step 2: git rm 七个文件**

```bash
git rm plugins/speccode/lib/docstrip.mjs plugins/speccode/lib/waitmerge.mjs \
  plugins/speccode/tests/docstrip.test.mjs plugins/speccode/tests/waitmerge.test.mjs \
  plugins/speccode/commands/display-merge-trunk.md \
  plugins/speccode/commands/display-rebase-trunk.md \
  plugins/speccode/commands/display-reset-to-trunk.md
```

- [ ] **Step 3: 全量测试**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor: retire docstrip/waitmerge and drop display-* commands"
```

### Task 6: creating-feature.md(改名 + 去 display 逻辑)

**Files:**
- Create: `plugins/speccode/commands/creating-feature.md`
- Delete: `plugins/speccode/commands/start.md`

**Interfaces:**
- Consumes: `read-config`、`write-state --json-stdin`。Produces: state 文件 `{feature_branch, created_at, initial_branch, status, worktrees:{}}`(字段名不变,P7 的 memory 骨架在 P7 计划接入)。

- [ ] **Step 1: 写新文件** — `plugins/speccode/commands/creating-feature.md` 完整内容:

````markdown
---
name: "SpecCode: Creating Feature"
description: "从主干分支(trunk)切出功能分支并推送,登记 state"
category: Workflow
tags: [speccode, workflow, feature]
---

创建一个新的功能分支。全程中文交互。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. 校验当前 HEAD(`git rev-parse --abbrev-ref HEAD`)必须等于 `config.trunk`;不符 → 提示 `git checkout <trunk>` 后退出。

## 决定分支名

1. 扫描 `openspec/changes/`(存在未 archive 的 change)与 `docs/superpowers/specs/`(最近 design),尝试从内容推断 type:
   - 新功能 → `feature`;修 bug → `bugfix`;重构 → `refactor`;杂项 → `chore`。
2. 若扫描不到,用 AskUserQuestion 询问 type 与 slug。
3. **校验 slug**:必须匹配 `^[a-z0-9-]+$`;非法 → 拒绝并提示合法字符集。
   - 组合分支名 `<type>/<slug>`,再次确认恰好一个 `/`。

## 处理已存在

- `git rev-parse --verify <branch>` 命中(本地已存在)→ 询问切过去还是改名。
- `git ls-remote origin <branch>` 命中(远端已存在)→ 询问本地新建追踪还是拉取。

## 创建

1. `git checkout -b <branch>`(从 trunk)。
2. `git push -u origin <branch>`。
3. 写 state:通过 `echo '<json>' | speccode.mjs write-state --cwd . --branch <branch> --json-stdin`,内容含 `feature_branch`、`created_at`(ISO UTC)、`initial_branch`(= config.trunk)、`status:"in_progress"`、`worktrees:{}`。
4. 打印:已创建 <branch>,下一步 `/speccode:creating-worktree`。
````

- [ ] **Step 2: 删旧文件并验证**

```bash
git rm plugins/speccode/commands/start.md
```

Run: `git grep -n "speccode:start\|display" plugins/speccode/commands/creating-feature.md`
Expected: 零命中

- [ ] **Step 3: Commit**

```bash
git add plugins/speccode/commands/creating-feature.md
git commit -m "feat(commands): rename start to creating-feature, trunk-only initial branch"
```

### Task 7: creating-worktree.md(改名,P1 仅最小改写)

**Files:**
- Create: `plugins/speccode/commands/creating-worktree.md`
- Delete: `plugins/speccode/commands/develop-start.md`

**Interfaces:**
- Consumes: `read-config`、`reconcile --advance-pr`、`write-state --json-stdin`。Produces: state `worktrees[<wt>] = { status: "in_progress" }`。worktree_dir 配置化/check-ignore/setup/基线测试/proposing 引导均在 P2 计划,本任务只做改名与引用更新。

- [ ] **Step 1: 写新文件** — `plugins/speccode/commands/creating-worktree.md` 完整内容:

````markdown
---
name: "SpecCode: Creating Worktree"
description: "从功能分支切出 worktree 开发分支(git worktree),登记 state"
category: Workflow
tags: [speccode, workflow, worktree]
---

创建开发用的 worktree 分支。全程中文交互。

## 前置

1. `read-config` 加载 config。
2. HEAD 必须在功能分支(`feature/` `bugfix/` `refactor/` `chore/` 之一);否则提示退出。
3. 运行 `speccode.mjs reconcile --cwd . --advance-pr`(带 `--advance-pr`,与 finishing-worktree/finishing-feature/status 一致,顺带推进已合并的 pr_open):
   - `conflicts` 非空 → 报告冲突,提示用户用 `worktree_overrides` 手动指定后退出。
   - `orphans` 非空 → 告知用户,但不阻断创建。

## 决定 worktree 名

1. 默认名:`worktree-` + 功能分支 slug 段(`feature/payment` → `worktree-payment`)。
2. 用 AskUserQuestion 让用户确认或改名(可加后缀区分多 worktree,如 `worktree-payment-api`)。
3. **校验**:必须以 `worktree-`(config.worktree_prefix)开头;否则拒绝重输。

## 创建

1. worktree 目录:`.claude/worktrees/<branch>`。
2. `git worktree add .claude/worktrees/<branch> -b <branch> <feature>`。
3. 更新 state:读当前 state(`read-config` 同级可加读 state,或直接由 reconcile 返回),把 `worktrees[<branch>] = { status: "in_progress" }` 后用 `write-state --branch <feature> --json-stdin` 原子写回。
4. 打印:worktree 已创建于 `.claude/worktrees/<branch>`,请 `cd` 过去开发,完成后 `/speccode:finishing-worktree`。
````

- [ ] **Step 2: 删旧文件并验证**

```bash
git rm plugins/speccode/commands/develop-start.md
git grep -n "develop-start\|develop-complete\|speccode:finish\b" plugins/speccode/commands/creating-worktree.md
```

Expected: 零命中

- [ ] **Step 3: Commit**

```bash
git add plugins/speccode/commands/creating-worktree.md
git commit -m "feat(commands): rename develop-start to creating-worktree"
```

### Task 8: finishing-worktree.md(改名 + D12 融合改写)

**Files:**
- Create: `plugins/speccode/commands/finishing-worktree.md`
- Delete: `plugins/speccode/commands/develop-complete.md`

**Interfaces:**
- Consumes: Task 3 的 `query-pr` verb、`reconcile --advance-pr`、`feature-progress`、`write-state --json-stdin`。Produces: `pending_operation{command:"finishing-worktree", phase:"waiting_worktree_pr", pr_number, updated_at}`;worktree 状态 `completed/pr_open`。P6 的 onWorktreeFinished/onPrOpened 接线在 P6 计划加入。

- [ ] **Step 1: 写新文件** — `plugins/speccode/commands/finishing-worktree.md` 完整内容:

````markdown
---
name: "SpecCode: Finishing Worktree"
description: "完成 worktree 开发并合并回功能分支(测试门禁 + PR 等待 / PR 不等待 / 本地 squash / 保留),更新 state"
category: Workflow
tags: [speccode, workflow, worktree, merge]
---

完成一个 worktree 的开发并合并回功能分支。全程中文交互。支持 `--resume`。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. HEAD 必须在 worktree 分支(以 `config.worktree_prefix` 开头,默认 `worktree-`);否则退出。
3. 运行 `speccode.mjs reconcile --cwd . --advance-pr`:
   - 用返回的 features 找到当前 worktree 所属的功能分支 F;找不到 → 报错"当前 worktree 无法关联任何 active feature,请先 /speccode:creating-feature",退出。
   - `conflicts` 非空 → 报告冲突并退出。
   - `--resume`:若该 feature 的 state 有 `pending_operation.command="finishing-worktree"`,从其 phase 续跑(legacy 旧值由引擎自动规范化,无需特判)。

## 全量测试门禁

1. 按标记文件探测测试命令:`package.json` → `npm test`;`Cargo.toml` → `cargo test`;`requirements.txt` / `pyproject.toml` → `pytest`;`go.mod` → `go test ./...`;均无 → 询问用户测试命令(用户可明确选择跳过)。
2. 在 worktree 内运行全量测试。**失败 → 展示失败摘要并停止,不呈现合并选项。**(早前通过的测试只证明当时那棵树;合并选项只在新鲜全绿后出现。)

## 询问合并方式(恰好四项)

用 AskUserQuestion:
1. **PR + 等待合并**(全自动化)
2. **PR + 不等待**(自己合并,后续对账推进)
3. **本地 squash**(快)
4. **保留 worktree**(不合并,保持现状)

丢弃**不在菜单**。仅当用户显式要求丢弃(如"丢弃这个 worktree")时进入「丢弃路径」。

## 路径 1/2:PR

1. **同步 base**:`git push origin <F>`;若 non-fast-forward → 中止并提示用户处理分叉。
2. `git push -u origin <worktree>`。
3. 用 pr_tool 创建 PR:参数同 `createPrArgs`(base=F, head=worktree)。`pr_tool=none` → 打印等效命令并中止。
4. **路径 1(等待)**:每 30s 调 `speccode.mjs query-pr --cwd . --number <N>`,超时 30min:
   - MERGED → 「清理」+ state 置 `completed` + `completed_at`。
   - CLOSED 或 CONFLICTING → 报错退出(PR 被关闭或存在合并冲突,需人工处理)。
   - TIMEOUT → 写 `pending_operation`(command=`finishing-worktree`, phase=`waiting_worktree_pr`, pr_number, updated_at),提示 `--resume`。
5. **路径 2(不等待)**:state 置 `pr_open` + 记 `pr_number`,**不清理** worktree,不阻塞。

## 路径 3:本地 squash

1. `git checkout <F>`。
2. `git merge --squash <worktree>`。
3. `git commit`(用户填 commit message,遵守 git 提交规范)。
4. **复测**:对合并后的 F 复跑全量测试(同门禁探测)。失败 → 停止,保留 worktree 与分支现场(未推送,可恢复),提示用户调查。
5. 「清理」+ state 置 `completed` + `completed_at`。

## 路径 4:保留 worktree

不合并、不清理、state 不动。打印:worktree 保留于 `<path>`(分支 `<worktree>`),可稍后重跑本命令合并。

## 丢弃路径(仅显式要求)

1. 展示:分支名、完整 commit 列表(`git log --oneline <F>..<worktree>`)、worktree 路径。
2. 要求用户**逐字输入 `discard`**;任何其他输入(包括"确认/删除/是的")→ 取消,不删任何东西。
3. 输入 `discard` 后:「清理」+ 从 state 的 `worktrees` 删除该条目(经 write-state 写回)。

## 清理(来源限定)

仅当该 worktree 满足「分支名带 `config.worktree_prefix` 且(路径位于 worktree 目录之下或在 state 中有登记)」时执行:
- `git worktree remove <path> --force` + `git branch -D <worktree>`;
- 询问是否删远端(`git push origin :<worktree>`);
- `git worktree prune`。
不满足 → 原样保留并打印原因(宿主环境创建的 worktree 不由 speccode 清理)。
注:本阶段 worktree 目录固定 `.claude/worktrees`;配置化(resolve-worktree-dir)随后续版本接入。

## 收尾

1. 用 `feature-progress --branch <F>` 取进度。
2. 打印状态报告:`<F> 进度 X/Y done` + 每个 worktree 状态;若全部 completed,建议 `/speccode:finishing-feature`。

> **状态写入约定**:本命令中所有"state 置 X"(completed / pr_open / pending_operation / 删除条目)MUST 通过 `write-state --cwd . --branch <F> --json-stdin` verb 完成——先取当前 state(reconcile 返回或 read),改字段后整体写回。绝不由 AI 手写 JSON 文件。
````

- [ ] **Step 2: 删旧文件并验证**

```bash
git rm plugins/speccode/commands/develop-complete.md
git grep -n "develop-complete\|speccode:finish\b\|speccode:start\b" plugins/speccode/commands/finishing-worktree.md
```

Expected: 零命中

- [ ] **Step 3: Commit**

```bash
git add plugins/speccode/commands/finishing-worktree.md
git commit -m "feat(commands): rename develop-complete to finishing-worktree with test gate and 4-option menu"
```

### Task 9: finishing-feature.md(改名 + 单 PR 简化)

**Files:**
- Create: `plugins/speccode/commands/finishing-feature.md`
- Delete: `plugins/speccode/commands/finish.md`

**Interfaces:**
- Consumes: `query-pr`、`reconcile --advance-pr`、`feature-progress`、`write-state`、`delete-state`。Produces: `pending_operation{command:"finishing-feature", phase:"waiting_trunk_pr"}`;完成时 delete-state。waiting_display_pr 的「不可续跑+手动指引」prose 落在此文件(不进引擎,见 design D13)。

- [ ] **Step 1: 写新文件** — `plugins/speccode/commands/finishing-feature.md` 完整内容:

````markdown
---
name: "SpecCode: Finishing Feature"
description: "收尾整个功能:单 PR → trunk(阻塞等合并)→ 删 state → 切回 trunk"
category: Workflow
tags: [speccode, workflow, finish]
---

完成整个功能的交付。全程中文交互。支持 `--resume`。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. HEAD 必须在功能分支(`feature/` `bugfix/` `refactor/` `chore/` 之一);否则退出。
3. **跑对账** `speccode.mjs reconcile --cwd . --advance-pr`(建立在真实 git 状态上,并推进已合并的 pr_open)。
4. **门禁检查**:用 `feature-progress --branch <F>`:
   - 存在任何 `pending` / `in_progress` / `pr_open` 的 worktree → 阻止,列出未完成项。
   - 对账 `orphans` 里若有本 feature 的残留 worktree → 提示先清理。
5. `--resume`:若 state 有 `pending_operation.command="finishing-feature"`,按 `phase` 续跑。
   - **若 `phase="waiting_display_pr"`(v0.1 遗留挂起态)→ 报错退出**:该挂起态依赖已下线的 display 分支流程,无法自动续跑。打印手动收尾指引:① 检查当时的 display PR 是否已合并;② 已合并则 `git checkout <trunk> && git pull`,手动创建 `<F> → <trunk>` 的 PR;③ 用 write-state 清除该 feature 的 `pending_operation` 后重新执行本命令。

## 单 PR 流程(feature → trunk)

1. `git push origin <F>`;若 non-fast-forward → 中止并提示用户处理分叉。
2. 用 pr_tool 创建 PR(base=`config.trunk`, head=F)。`pr_tool=none` → 打印等效命令(如 `gh pr create --base <trunk> --head <F> --title ...`)并中止。
3. 轮询等合并(每 30s 调 `speccode.mjs query-pr --cwd . --number <N>`,超时 30min):
   - MERGED → 进入收尾。
   - CLOSED 或 CONFLICTING → 报错退出。
   - TIMEOUT → 写 `pending_operation`(command=`finishing-feature`, phase=`waiting_trunk_pr`, pr_number, updated_at),提示 `--resume`。

全流程 MUST NOT 创建 `<F>-complete` 分支,MUST NOT 执行任何 `git rm --cached` 文档剥离操作——`speccode/` 文档随本 PR 一并进入 trunk。

## 收尾

1. 删 state:`speccode.mjs delete-state --cwd . --branch <F>`。
2. `git checkout <trunk>`(feature 分支保留,不删,作为历史)。
3. 打印:功能已交付,`<F>` 已合并进 `<trunk>`。

> **状态写入约定**:本命令中写 `pending_operation`(超时挂起)MUST 通过 `write-state --cwd . --branch <F> --json-stdin`(取当前 state → 加 `pending_operation` 字段 → 整体写回)。`--resume` 时读回该字段决定续跑阶段。绝不由 AI 手写 JSON 文件。
````

- [ ] **Step 2: 删旧文件并验证**

```bash
git rm plugins/speccode/commands/finish.md
git grep -n "display\|-complete\|rm --cached\|rm -r --cached" plugins/speccode/commands/finishing-feature.md
```

Expected: 仅 `waiting_display_pr` 报错指引一处含 "display" 字样(遗留态处理),无 -complete/剥离

- [ ] **Step 3: Commit**

```bash
git add plugins/speccode/commands/finishing-feature.md
git commit -m "feat(commands): rename finish to finishing-feature, single PR to trunk"
```

### Task 10: status.md / reset.md 引用更新

**Files:**
- Modify: `plugins/speccode/commands/status.md`
- Modify: `plugins/speccode/commands/reset.md`

**Interfaces:**
- Consumes: 无。Produces: 无行为变化(显示文案与引用更新;reset 的字段清理重构在 P2)。

- [ ] **Step 1: status.md 三处编辑**
  - 「流程」第 5 步:`末尾打印 config 摘要:\`trunk / display / pr_tool\`` → `末尾打印 config 摘要:\`trunk / pr_tool\``。
  - 输出示例中两行 `(from display)` → `(from master)`;`config: trunk=master display=display pr_tool=gh` → `config: trunk=master pr_tool=gh`。

- [ ] **Step 2: reset.md 两处编辑**
  - 前置第 2 步:`请先 /speccode:finish 完成所有功能` → `请先 /speccode:finishing-feature 完成所有功能`。
  - 执行第 5 步:`可 /speccode:init 重建或直接 /speccode:start` → `可 /speccode:init 重建或直接 /speccode:creating-feature`。

- [ ] **Step 3: 验证**

Run: `git grep -n "speccode:start\b\|speccode:finish\b\|speccode:develop" plugins/speccode/commands/`
Expected: 零命中

- [ ] **Step 4: Commit**

```bash
git add plugins/speccode/commands/status.md plugins/speccode/commands/reset.md
git commit -m "docs(commands): update cross-references to renamed commands"
```

### Task 11: P1 验收

**Files:** 无(纯验证)

- [ ] **Step 1: 全量测试**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: 全绿(66 个测试:62 存量 − 4 docstrip − 4 waitmerge + 5 state 新增 + 2 prtool 新增 + 6 cli 新增 − 1 config 删除 = 66;若数字不符以实际为准但 MUST 全绿)

- [ ] **Step 2: 回归断言**

```bash
git grep -n "display" plugins/speccode/lib plugins/speccode/bin          # 期望零命中
git grep -n "docstrip\|waitForPrMerge" plugins/speccode                  # 期望零命中
git grep -rn "develop-complete\|develop-start" plugins/speccode/commands # 期望零命中
ls plugins/speccode/commands/                                            # 期望 7 个文件:creating-feature / creating-worktree / finishing-worktree / finishing-feature / init / status / reset
```

- [ ] **Step 3: 勾选 tasks.md P1 任务**

把 `openspec/changes/speccode-v2-sdd-flow/tasks.md` 的 1.1–1.10 勾为 `- [x]`(1.2/1.3/1.4/1.5/1.6/1.7/1.7a/1.8/1.9/1.10 逐项对应本计划 Task 5/6-9/6/1/3+7 等,按实际完成勾选)。

- [ ] **Step 4: Commit**

```bash
git add openspec/changes/speccode-v2-sdd-flow/tasks.md
git commit -m "docs(openspec): check off P1 tasks of speccode-v2-sdd-flow"
```

---

## Self-Review 记录

- **Spec 覆盖**:本计划覆盖 tasks.md P1 全部任务(1.1→Task 5;1.2→Task 5;1.3→Task 6/7/8/9;1.4→Task 9;1.5→Task 6;1.6→Task 1;1.7→Task 3;1.7a→Task 2;1.8→Task 8;1.9→Task 1/3/4;1.10→Task 11)。P2+ 不在本计划(另出计划)。
- **Placeholder 扫描**:无 TBD/TODO;命令 markdown 为完整成稿;测试与实现代码均为完整代码块。
- **类型一致性**:`normalizeState(state)`(Task 1)= spec「legacy pending_operation 规范化」约定;`queryPrState(tool, ref, { run?, cwd? })`(Task 2)= bin `query-pr`(Task 3)与 reconcile advance-pr 调用形态一致;`pending_operation.command` 新值 `finishing-worktree`/`finishing-feature` 在 Task 1 映射、Task 8/9 写入、cli 断言三处一致。
- **既有测试兼容**:cli.test.mjs 两个 no-config reconcile 测试不动(Task 3 的 `cfg?.worktree_prefix ?? 'worktree-'` 兜底保证其仍绿);prtool 既有注入测试的 args 断言已在 Task 2 Step 1(b) 同步更新。
