# remove-feature-layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** feature 中间层退役——双层拓扑(普通直达 / 大需求 opt-in 集成)、`state/branches/` v3(双格式兼容)、reconcile C 路径识别重写、合并路由与 squash 探测、形态确认三岔。

**Architecture:** 确定性逻辑全部下沉 lib(state 双格式读写与迁移、reconcile 路径识别、prtool 探测);bin 只做 flag 校验与透传(reconcile opts 改 worktreeDir、新 `repo-merge-config` verb);命令 markdown 全部 prose 重写或改块。children 状态派生不存储;v2 数据双格式原样保留,迁移仅 init 显式。

**Tech Stack:** Node ≥ 24 纯 ESM,`node:` 内置(`node:fs`/`node:child_process`),`node:test` + `node:assert/strict`,tmprepo 真实 git 仓测试 + DI 测试(prtool)。

## Global Constraints

- Node ≥ 24;纯 ESM;零第三方依赖(仅 `node:` 内置模块)
- 全量测试必须 glob 形式:`node --test ./plugins/speccode/tests/*.test.mjs`(裸目录在 Node v24 报 MODULE_NOT_FOUND)
- 错误返回契约:`{ok:false, error}` + exit 1;锚点文案 `invalid branch` / `not found` / `already exists` / `unknown verb` 逐字保持
- state v3 schema:普通分支 `{branch, type, worktree, merge_target?, status, pending_operation?, created_at, initial_branch}`(worktree 仅迁移遗留允许 null);父实体 `{branch, kind:"integration", children:[{slug}], status, created_at, initial_branch}`;状态枚举 `{pending, in_progress, pr_open, completed}` 不变
- 双格式纪律:`state/features/` v2 文件按 v2 语义原样读写(格式跟随既有文件),新写入恒 v3;**不做内存翻译**;迁移仅 init 显式(预览→确认→转换→reconcile 验证)
- children 纪律:父实体 children 仅 `{slug}`;**任何命令 MUST NOT 写父实体的 children 状态**;状态渲染/门禁一律派生自子 state
- reconcile 纪律:管辖识别 = 路径位于 `config.worktree_dir` 之下(缺省 `.claude/worktrees`);分支名/ancestry/overrides 不参与;completed 豁免;输出保持 `{features, orphans, conflicts, advanced}` 形状(conflicts 恒 `[]`,API 兼容)
- squash 探测纪律:仅 gh 支持完整探测;glab/none/失败一律返 `null`(warn-only,不警告不阻断);`isSquashOnly` = squash true 且 merge/rebase 均 false
- 命令 markdown 全程中文交互;frontmatter 四字段不动;裸调 `speccode.mjs <verb> --cwd .` 不变;写 verb 强制 `--json-stdin`
- 文档不硬编码版本号/测试数量/命令总数
- 提交信息 conventional commits,每任务至少一个提交;每个 bash 命令先 `cd` 到 worktree(见下)

**Worktree 路径(所有命令的工作目录,shell cwd 每次调用会复位到主仓,MUST 显式 cd):**
`/Users/game-netease/orca/workspaces/speccode-development/worktree-remove-feature-layer`

---

### Task 1: lib/state.mjs — v3 双格式基座 + 迁移

**Files:**
- Modify: `plugins/speccode/lib/state.mjs`(全文重写,57 行 → ~110 行)
- Test: `plugins/speccode/tests/state.test.mjs`(追加用例)

**Interfaces:**
- Consumes: `atomic.mjs` 的 `readJson(path)`(缺失返 null)/`writeJsonAtomic`;`slug.mjs` 的 `branchToStateName`
- Produces(Task 2/4 依赖,签名逐字):
  - `branchesDir(speccodeDir)` → `state/branches` 路径
  - `readState(speccodeDir, branch)` → v3 文件优先,其次 v2 文件,均缺失返 null(格式跟随既有文件)
  - `writeState(speccodeDir, branch, state)` → v2 文件已存在则原位写 v2 路径,否则写 v3 路径
  - `deleteState(speccodeDir, branch)` → 两个路径都删(存在才删)
  - `listActiveFeatures(speccodeDir)` → `[...v3 条目, ...v2 条目]`(原样,含两种形态)
  - `migrateStateV2toV3(speccodeDir)` → `{migrated: string[], skipped: string[]}`(v2 目录缺失时 `{migrated:[],skipped:[]}`;多 worktree 或缺 `feature_branch` 的文件跳过不迁)

- [x] **Step 1: 写失败测试**

`plugins/speccode/tests/state.test.mjs` 现有用例全部保留;文件末尾追加(顶部已 import 的 `test/assert/join/mkdtempSync/rmSync/writeJsonAtomic` 等按该文件现状复用,缺的补 import;`readJson` 如未引入则从 `../lib/atomic.mjs` 引入):

```js
// ---- v3 dual-format ----

test('writeState defaults to state/branches, readState round-trips v3 schema', () => {
  const root = tmp();
  const sc = join(root, '.speccode');
  writeState(sc, 'feature/payment', {
    branch: 'feature/payment', type: 'feature', worktree: '/wt/payment',
    status: 'in_progress', created_at: '2026-09-02T00:00:00.000Z', initial_branch: 'main',
  });
  assert.equal(existsSync(join(sc, 'state', 'branches', 'feature__payment.json')), true);
  assert.equal(readState(sc, 'feature/payment').branch, 'feature/payment');
  rmSync(root, { recursive: true, force: true });
});

test('writeState preserves a pre-existing v2 file in place (format follows file)', () => {
  const root = tmp();
  const sc = join(root, '.speccode');
  const v2path = join(sc, 'state', 'features', 'feature__legacy.json');
  mkdirSync(join(sc, 'state', 'features'), { recursive: true });
  writeJsonAtomic(v2path, {
    feature_branch: 'feature/legacy', created_at: '2026-09-01T00:00:00.000Z',
    initial_branch: 'main', status: 'in_progress',
    worktrees: { 'worktree-legacy': { status: 'in_progress' } },
  });
  writeState(sc, 'feature/legacy', readState(sc, 'feature/legacy'));
  assert.equal(existsSync(join(sc, 'state', 'branches', 'feature__legacy.json')), false);
  assert.equal(readState(sc, 'feature/legacy').feature_branch, 'feature/legacy');
  rmSync(root, { recursive: true, force: true });
});

test('listActiveFeatures returns v3 then v2 entries as-is (no translation)', () => {
  const root = tmp();
  const sc = join(root, '.speccode');
  mkdirSync(join(sc, 'state', 'features'), { recursive: true });
  writeJsonAtomic(join(sc, 'state', 'features', 'feature__old.json'), {
    feature_branch: 'feature/old', status: 'in_progress', worktrees: {},
  });
  writeState(sc, 'feature/new', { branch: 'feature/new', type: 'feature', worktree: null,
    status: 'pending', created_at: '2026-09-02T00:00:00.000Z', initial_branch: 'main' });
  const all = listActiveFeatures(sc);
  assert.equal(all.length, 2);
  assert.equal(all[0].branch, 'feature/new');
  assert.equal(all[1].feature_branch, 'feature/old');
  rmSync(root, { recursive: true, force: true });
});

test('migrateStateV2toV3 converts clean features, skips multi-worktree and malformed', () => {
  const root = tmp();
  const sc = join(root, '.speccode');
  mkdirSync(join(sc, 'state', 'features'), { recursive: true });
  writeJsonAtomic(join(sc, 'state', 'features', 'feature__clean.json'), {
    feature_branch: 'feature/clean', created_at: '2026-09-01T00:00:00.000Z',
    initial_branch: 'main', status: 'pending', worktrees: {},
  });
  writeJsonAtomic(join(sc, 'state', 'features', 'feature__busy.json'), {
    feature_branch: 'feature/busy', created_at: '2026-09-01T00:00:00.000Z',
    initial_branch: 'main', status: 'in_progress',
    worktrees: { 'worktree-a': { status: 'in_progress' }, 'worktree-b': { status: 'completed' } },
  });
  writeJsonAtomic(join(sc, 'state', 'features', 'feature__bad.json'), { status: 'in_progress' });
  const res = migrateStateV2toV3(sc);
  assert.deepEqual(res.migrated, ['feature__clean.json']);
  assert.deepEqual(res.skipped.sort(), ['feature__bad.json', 'feature__busy.json']);
  const clean = readState(sc, 'feature/clean');
  assert.equal(clean.branch, 'feature/clean');
  assert.equal(clean.worktree, null);
  assert.equal(existsSync(join(sc, 'state', 'features', 'feature__clean.json')), false);
  assert.equal(existsSync(join(sc, 'state', 'features', 'feature__busy.json')), true);
  rmSync(root, { recursive: true, force: true });
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test --test-name-pattern="dual-format|migrateStateV2toV3|listActiveFeatures returns v3" plugins/speccode/tests/state.test.mjs`
Expected: FAIL — `migrateStateV2toV3` 未导出 / `state/branches` 不存在

- [x] **Step 3: 写最小实现**

`plugins/speccode/lib/state.mjs` 全文替换为:

```js
import { readdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeJsonAtomic } from './atomic.mjs';
import { branchToStateName } from './slug.mjs';

export const WORKTREE_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  PR_OPEN: 'pr_open',
  COMPLETED: 'completed',
};

const LEGACY_COMMAND_NAMES = {
  'develop-complete': 'finishing-worktree',
  finish: 'finishing-feature',
};

// Normalize legacy (v0.1) state shapes on read. waiting_display_pr is kept
// as-is: the command layer reports it as non-resumable (see finishing-feature.md).
export function normalizeState(state) {
  if (!state || typeof state !== 'object') return state;
  const po = state.pending_operation;
  if (po && typeof po === 'object' && Object.hasOwn(LEGACY_COMMAND_NAMES, po.command)) {
    return { ...state, pending_operation: { ...po, command: LEGACY_COMMAND_NAMES[po.command] } };
  }
  return state;
}

export function branchesDir(speccodeDir) {
  return join(speccodeDir, 'state', 'branches');
}

// v2 legacy location — kept for dual-format read/write compat only.
export function featuresDir(speccodeDir) {
  return join(speccodeDir, 'state', 'features');
}

function stateFilePathIn(dir, branch) {
  return join(dir, `${branchToStateName(branch)}.json`);
}

function readStateAt(dir, branch) {
  const raw = readJson(stateFilePathIn(dir, branch));
  return raw === null ? null : normalizeState(raw);
}

// Format follows the existing file: a v2-era file keeps v2 semantics in place
// (old flows keep working, no in-memory translation); new writes land in
// state/branches/ (v3).
export function readState(speccodeDir, branch) {
  return readStateAt(branchesDir(speccodeDir), branch)
    ?? readStateAt(featuresDir(speccodeDir), branch);
}

export function writeState(speccodeDir, branch, state) {
  const v2Path = stateFilePathIn(featuresDir(speccodeDir), branch);
  const target = existsSync(v2Path) ? v2Path : stateFilePathIn(branchesDir(speccodeDir), branch);
  writeJsonAtomic(target, state);
}

export function deleteState(speccodeDir, branch) {
  for (const dir of [branchesDir(speccodeDir), featuresDir(speccodeDir)]) {
    const p = stateFilePathIn(dir, branch);
    if (existsSync(p)) rmSync(p);
  }
}

function readDirStates(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => normalizeState(readJson(join(dir, f))))
    .filter((s) => s !== null);
}

// v3 entries first, then untouched v2 entries (dual-format, no translation).
export function listActiveFeatures(speccodeDir) {
  return [
    ...readDirStates(branchesDir(speccodeDir)),
    ...readDirStates(featuresDir(speccodeDir)),
  ];
}

// One-time v2→v3 conversion for init. Multi-worktree v2 features cannot map
// 1:1 onto per-branch v3 state — they are skipped (reported) and left in place
// for manual finishing under the v2 flow before upgrading. Converted branches
// have worktree: null (the v2 file never stored the path).
export function migrateStateV2toV3(speccodeDir) {
  const dir = featuresDir(speccodeDir);
  if (!existsSync(dir)) return { migrated: [], skipped: [] };
  const migrated = [];
  const skipped = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const raw = readJson(join(dir, f));
    const branch = raw && typeof raw === 'object' ? raw.feature_branch : undefined;
    const worktrees = raw && typeof raw === 'object' ? Object.entries(raw.worktrees || {}) : [];
    if (typeof branch !== 'string' || !branch.includes('/') || worktrees.length > 1) {
      skipped.push(f);
      continue;
    }
    const v3 = {
      branch,
      type: branch.split('/')[0],
      worktree: null,
      status: raw.status ?? 'pending',
      created_at: raw.created_at,
      initial_branch: raw.initial_branch,
    };
    if (raw.pending_operation !== undefined) v3.pending_operation = raw.pending_operation;
    writeJsonAtomic(stateFilePathIn(branchesDir(speccodeDir), branch), v3);
    rmSync(join(dir, f));
    migrated.push(f);
  }
  return { migrated, skipped };
}
```

- [x] **Step 4: 运行确认通过**

Run: `node --test plugins/speccode/tests/state.test.mjs`(既有用例 + 新用例全绿;若既有用例断言 `state/features` 写入路径,把该用例改为经 v2 兼容断言或迁移到 v3 断言——逐字记录改动到报告)

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS(reconcile/cli 既有用例若因 featuresDir→v3 失败,记录失败清单——它们在 Task 2/4 修复,本任务末允许这两个文件红,但 MUST 列入报告)

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/lib/state.mjs plugins/speccode/tests/state.test.mjs
git commit -m "feat: state/branches v3 schema with dual-format v2 compat and migration"
```

---

### Task 2: lib/reconcile.mjs — C 路径识别重写

**Files:**
- Modify: `plugins/speccode/lib/reconcile.mjs`(全文重写,83 行 → ~80 行)
- Test: `plugins/speccode/tests/reconcile.test.mjs`(重构 + 追加)

**Interfaces:**
- Consumes: Task 1 的 `listActiveFeatures`(双格式)与 `writeState`(格式跟随);`git.mjs` 的 `worktreeList(cwd)`(返回 `{path, branch}` 数组)与 `git(args, {cwd, allowFail})`;`detect.mjs` 的 `isPathInside(root, target)`(注意参数序:root 在前);`timestamp.mjs` 的 `nowIso`
- Produces(Task 4 依赖): `reconcile(speccodeDir, opts)` — opts 从 `{prefix, cwd, queryPr}` 改为 **`{cwd, worktreeDir, queryPr}`**;返回形状不变 `{features, orphans, conflicts, advanced}`(conflicts 恒 `[]`);仅处理 v3 形态条目(`branch` 字段为字符串),v2 条目原样透传不修改

- [x] **Step 1: 写失败测试**

`plugins/speccode/tests/reconcile.test.mjs` 中**删除** ancestry 归属、overrides、prefix 识别、conflicts 的既有用例(保留 pr_open 推进/回退与 completed 豁免的用例骨架,按下方新代码改造);文件末尾追加(顶部补 `import { writeState } from '../lib/state.mjs';`、`import { mkdirSync, writeJsonAtomic } from 'node:fs'` 等按现状):

```js
// ---- v3 path identification ----

function writeV3Branch(sc, branch, extra = {}) {
  writeState(sc, branch, {
    branch, type: branch.split('/')[0], worktree: null,
    status: 'in_progress', created_at: '2026-09-02T00:00:00.000Z', initial_branch: 'main',
    ...extra,
  });
}

function addWorktree(repo, dir, branch) {
  const r = spawnSync('git', ['worktree', 'add', dir, '-b', branch], { cwd: repo, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return dir;
}

test('v3 reconcile: managed = worktree under worktreeDir, branch name irrelevant', () => {
  const repo = makeRepo();
  const sc = join(repo, '.speccode');
  const wtdir = join(repo, 'wts');
  mkdirSync(wtdir, { recursive: true });
  writeV3Branch(sc, 'feature/payment');
  addWorktree(repo, join(wtdir, 'feature__payment'), 'feature/payment');
  const res = reconcile(sc, { cwd: repo, worktreeDir: wtdir });
  assert.deepEqual(res.orphans, []);
  assert.deepEqual(res.conflicts, []);
  rmSync(repo, { recursive: true, force: true });
});

test('v3 reconcile: worktree outside worktreeDir is invisible (host-owned)', () => {
  const repo = makeRepo();
  const sc = join(repo, '.speccode');
  const wtdir = join(repo, 'wts');
  mkdirSync(wtdir, { recursive: true });
  writeV3Branch(sc, 'feature/payment');
  addWorktree(repo, join(repo, 'outside-wt'), 'feature/payment'); // 在 wtdir 之外
  const res = reconcile(sc, { cwd: repo, worktreeDir: wtdir });
  assert.deepEqual(res.orphans, []);
  rmSync(repo, { recursive: true, force: true });
});

test('v3 reconcile: unregistered worktree under worktreeDir is an orphan', () => {
  const repo = makeRepo();
  const sc = join(repo, '.speccode');
  const wtdir = join(repo, 'wts');
  mkdirSync(wtdir, { recursive: true });
  addWorktree(repo, join(wtdir, 'stray'), 'feature/stray');
  const res = reconcile(sc, { cwd: repo, worktreeDir: wtdir });
  assert.ok(res.orphans.length === 1 && res.orphans[0].includes('stray'));
  rmSync(repo, { recursive: true, force: true });
});

test('v3 reconcile: non-completed branch missing from git is an orphan; completed exempt', () => {
  const repo = makeRepo();
  const sc = join(repo, '.speccode');
  const wtdir = join(repo, 'wts');
  mkdirSync(wtdir, { recursive: true });
  writeV3Branch(sc, 'feature/gone');
  writeV3Branch(sc, 'feature/done', { status: 'completed', completed_at: '2026-09-02T00:00:00.000Z' });
  const res = reconcile(sc, { cwd: repo, worktreeDir: wtdir });
  assert.deepEqual(res.orphans, ['feature/gone']);
  rmSync(repo, { recursive: true, force: true });
});

test('v3 reconcile: merge_target pointing to a missing branch is an orphan', () => {
  const repo = makeRepo();
  const sc = join(repo, '.speccode');
  const wtdir = join(repo, 'wts');
  mkdirSync(wtdir, { recursive: true });
  writeV3Branch(sc, 'feature/child', { merge_target: 'feature/no-such-integration' });
  const res = reconcile(sc, { cwd: repo, worktreeDir: wtdir });
  assert.ok(res.orphans.includes('feature/child'));
  rmSync(repo, { recursive: true, force: true });
});

test('v3 reconcile: v2 entries pass through untouched', () => {
  const repo = makeRepo();
  const sc = join(repo, '.speccode');
  mkdirSync(join(sc, 'state', 'features'), { recursive: true });
  writeJsonAtomic(join(sc, 'state', 'features', 'feature__old.json'), {
    feature_branch: 'feature/old', status: 'in_progress', worktrees: {},
  });
  const res = reconcile(sc, { cwd: repo, worktreeDir: join(repo, 'wts') });
  const old = res.features.find((f) => f.feature_branch === 'feature/old');
  assert.ok(old);
  assert.deepEqual(old.worktrees, {});
  rmSync(repo, { recursive: true, force: true });
});

test('v3 reconcile: pr_open advances to completed via queryPr (unchanged semantics)', () => {
  const repo = makeRepo();
  const sc = join(repo, '.speccode');
  const wtdir = join(repo, 'wts');
  mkdirSync(wtdir, { recursive: true });
  writeV3Branch(sc, 'feature/pr', { status: 'pr_open', pr_number: 7 });
  const res = reconcile(sc, { cwd: repo, worktreeDir: wtdir, queryPr: () => 'MERGED' });
  assert.deepEqual(res.advanced, [{ branch: 'feature/pr', from: 'pr_open', to: 'completed' }]);
  assert.equal(readState(sc, 'feature/pr').status, 'completed');
  rmSync(repo, { recursive: true, force: true });
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test --test-name-pattern="v3 reconcile" plugins/speccode/tests/reconcile.test.mjs`
Expected: FAIL — opts 无 `worktreeDir` 时全部 worktree 不可见/误判

- [x] **Step 3: 写最小实现**

`plugins/speccode/lib/reconcile.mjs` 全文替换为:

```js
import { listActiveFeatures, writeState, WORKTREE_STATUS } from './state.mjs';
import { worktreeList, git } from './git.mjs';
import { isPathInside } from './detect.mjs';
import { nowIso } from './timestamp.mjs';

// v3 reconcile: managed worktrees are those whose path is inside
// config.worktree_dir — branch names, ancestry and overrides play no part
// (worktree ↔ branch state is 1:1). v2-era entries pass through untouched.
// children statuses are derived downstream; parents are never written here.
export function reconcile(speccodeDir, opts = {}) {
  const { cwd, worktreeDir, queryPr } = opts;
  const root = worktreeDir ?? '.claude/worktrees';
  const all = listActiveFeatures(speccodeDir);
  const v3 = all.filter((b) => typeof b?.branch === 'string');
  const legacy = all.filter((b) => typeof b?.branch !== 'string');
  const dirty = new Set();

  const managed = worktreeList(cwd).filter((w) => w.path && isPathInside(root, w.path));
  const byBranch = new Map(v3.map((b) => [b.branch, b]));

  const orphans = [];
  const advanced = [];

  // 1) registered non-completed branches must exist in git (worktree or branch)
  for (const b of v3) {
    if (b.status === WORKTREE_STATUS.COMPLETED) continue;
    const present = managed.some((w) => w.branch === b.branch)
      || git(['rev-parse', '--verify', '--quiet', b.branch], { cwd, allowFail: true }).code === 0;
    if (!present && b.worktree) orphans.push(b.branch);
    // merge_target must exist unless it is trunk (trunk presence is git's own problem)
    if (b.merge_target
      && git(['rev-parse', '--verify', '--quiet', b.merge_target], { cwd, allowFail: true }).code !== 0) {
      orphans.push(b.branch);
    }
  }

  // 2) unregistered managed worktrees (half-created) are orphans
  for (const w of managed) {
    if (!byBranch.has(w.branch)) orphans.push(w.path);
  }

  // 3) pr_open advancement (v3 only)
  if (typeof queryPr === 'function') {
    for (const b of v3) {
      if (b.status === WORKTREE_STATUS.PR_OPEN && b.pr_number != null) {
        const s = queryPr(b.pr_number);
        if (s === 'MERGED') {
          b.status = WORKTREE_STATUS.COMPLETED;
          b.completed_at = nowIso();
          advanced.push({ branch: b.branch, from: 'pr_open', to: 'completed' });
          dirty.add(b.branch);
        } else if (s === 'CLOSED') {
          b.status = WORKTREE_STATUS.IN_PROGRESS;
          advanced.push({ branch: b.branch, from: 'pr_open', to: 'in_progress' });
          dirty.add(b.branch);
        }
      }
    }
  }

  for (const b of v3) {
    if (dirty.has(b.branch)) writeState(speccodeDir, b.branch, b);
  }

  return { features: [...v3, ...legacy], orphans, conflicts: [], advanced };
}
```

- [x] **Step 4: 运行确认通过**

Run: `node --test plugins/speccode/tests/reconcile.test.mjs`
Expected: PASS

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/lib/reconcile.mjs plugins/speccode/tests/reconcile.test.mjs
git commit -m "feat: reconcile identifies worktrees by path, drops feature-layer attribution"
```

---

### Task 3: lib/prtool.mjs — squash 设置探测 + bin verb

**Files:**
- Modify: `plugins/speccode/lib/prtool.mjs`(文件末尾追加)
- Modify: `plugins/speccode/bin/speccode.mjs`(import 行 + `reconcile` verb 调用点 + VERBS 表新增)
- Test: `plugins/speccode/tests/prtool.test.mjs`(追加用例)

**Interfaces:**
- Consumes: 既有 DI 模式(`opts.run(cmd, args) -> {code, stdout}`,默认真实 spawnSync,参照文件内 `queryPrState` 注释)
- Produces(Task 6 依赖,签名逐字):
  - `repoMergeConfig(tool, opts)` → `{ allowSquash, allowMerge, allowRebase }` 或 `null`(glab/none/失败/解析失败一律 null)
  - `isSquashOnly(cfg)` → `cfg !== null && cfg.allowSquash === true && cfg.allowMerge === false && cfg.allowRebase === false`
  - bin `repo-merge-config --cwd .` → `{ok:true, config: {...}|null, squashOnly: boolean}`

- [x] **Step 1: 写失败测试**

`plugins/speccode/tests/prtool.test.mjs` 末尾追加(复用该文件既有的 DI runner 写法;若无现成 helper,按下方内联):

```js
test('repoMergeConfig parses gh api fields; non-squash-only detected', () => {
  const calls = [];
  const cfg = repoMergeConfig('gh', { run: (cmd, args) => {
    calls.push([cmd, args]);
    return { code: 0, stdout: '{"allow_squash_merge":true,"allow_merge_commit":true,"allow_rebase_merge":false}' };
  } });
  assert.deepEqual(cfg, { allowSquash: true, allowMerge: true, allowRebase: false });
  assert.equal(isSquashOnly(cfg), false);
  assert.equal(calls[0][0], 'gh');
  assert.ok(calls[0][1][0] === 'api' && calls[0][1][1] === 'repos/{owner}/{repo}');
});

test('repoMergeConfig: squash-only true / failure null / glab null', () => {
  assert.equal(isSquashOnly(repoMergeConfig('gh', { run: () => ({ code: 0,
    stdout: '{"allow_squash_merge":true,"allow_merge_commit":false,"allow_rebase_merge":false}' }) })), true);
  assert.equal(repoMergeConfig('gh', { run: () => ({ code: 1, stdout: '' }) }), null);
  assert.equal(repoMergeConfig('gh', { run: () => ({ code: 0, stdout: 'not-json' }) }), null);
  assert.equal(repoMergeConfig('glab', { run: () => ({ code: 0, stdout: '{}' }) }), null);
  assert.equal(repoMergeConfig('none', {}), null);
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test --test-name-pattern="repoMergeConfig" plugins/speccode/tests/prtool.test.mjs`
Expected: FAIL — 未导出

- [x] **Step 3: 写最小实现**

`plugins/speccode/lib/prtool.mjs` 末尾追加:

```js
// Repo merge-settings probe for the trunk-protection squash check. Only gh
// exposes the fields we need; glab/none and any failure return null — the
// caller treats null as "cannot verify" and stays warn-only.
export function repoMergeConfig(tool, opts = {}) {
  if (tool !== 'gh') return null;
  const run = opts.run ?? ((cmd, args) => {
    const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: opts.cwd });
    return { code: r.status, stdout: r.stdout ?? '' };
  });
  const r = run('gh', ['api', 'repos/{owner}/{repo}']);
  if (!r || r.code !== 0) return null;
  try {
    const o = JSON.parse(r.stdout);
    return {
      allowSquash: o.allow_squash_merge === true,
      allowMerge: o.allow_merge_commit === true,
      allowRebase: o.allow_rebase_merge === true,
    };
  } catch {
    return null;
  }
}

export function isSquashOnly(cfg) {
  return cfg !== null && cfg.allowSquash === true && cfg.allowMerge === false && cfg.allowRebase === false;
}
```

`plugins/speccode/bin/speccode.mjs`:
1. prtool import 行加入 `repoMergeConfig, isSquashOnly`(与既有 `detectPrToolFromUrl, isInstalled, queryPrState` 同行)。
2. `reconcile` verb 内 `const res = reconcile(sc, { prefix: ..., cwd, queryPr })` 改为:

```js
    const res = reconcile(sc, { cwd, worktreeDir: cfg?.worktree_dir, queryPr });
```

3. VERBS 表新增(放在 `read-memory` 之前或任意相邻处):

```js
  'repo-merge-config': ({ cwd }) => {
    const cfg = loadConfig(speccodeDirOf(cwd));
    const tool = cfg?.pr_tool ?? 'none';
    const config = repoMergeConfig(tool, { cwd });
    return { ok: true, config, squashOnly: isSquashOnly(config) };
  },
```

- [x] **Step 4: 运行确认通过**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS(state/reconcile 新用例 + prtool 新用例;cli 既有用例若断言 reconcile 的 `prefix` 行为,按新语义修正断言并逐字记录)

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/lib/prtool.mjs plugins/speccode/bin/speccode.mjs plugins/speccode/tests/prtool.test.mjs plugins/speccode/tests/cli.test.mjs
git commit -m "feat: repo-merge-config verb and path-based reconcile wiring"
```

---

### Task 4: cli 端到端 — 双格式 state / 迁移 verb / 新拓扑行为

**Files:**
- Modify: `plugins/speccode/bin/speccode.mjs`(VERBS 表新增 `migrate-state`)
- Test: `plugins/speccode/tests/cli.test.mjs`(追加)

**Interfaces:**
- Consumes: Task 1 的 `migrateStateV2toV3`
- Produces: `migrate-state --cwd . --json-stdin`(stdin `{}`)→ `{ok:true, migrated:[], skipped:[]}`;cli 层双格式行为由 Task 1/2 的 lib 契约保证,这里端到端锁定

- [x] **Step 1: 写失败测试**

`plugins/speccode/tests/cli.test.mjs` 末尾追加:

```js
test('write-state lands in state/branches and feature-progress reads it back', () => {
  const repo = makeRepo();
  const w = spawnSync('node', [BIN, 'write-state', '--cwd', repo, '--branch', 'feature/x', '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ branch: 'feature/x', type: 'feature', worktree: null,
      status: 'pending', created_at: '2026-09-02T00:00:00.000Z', initial_branch: 'main' }), encoding: 'utf8' });
  assert.equal(w.status, 0);
  assert.ok(existsSync(join(repo, '.speccode', 'state', 'branches', 'feature__x.json')));
  const p = spawnSync('node', [BIN, 'feature-progress', '--cwd', repo, '--branch', 'feature/x'], { cwd: repo, encoding: 'utf8' });
  assert.equal(p.status, 0);
  assert.equal(JSON.parse(p.stdout.trim()).total, 1);
  rmSync(repo, { recursive: true, force: true });
});

test('migrate-state converts a v2 file end to end', () => {
  const repo = makeRepo();
  const v2 = join(repo, '.speccode', 'state', 'features');
  mkdirSync(v2, { recursive: true });
  writeJsonAtomic(join(v2, 'feature__old.json'), {
    feature_branch: 'feature/old', created_at: '2026-09-01T00:00:00.000Z',
    initial_branch: 'main', status: 'pending', worktrees: {},
  });
  const r = spawnSync('node', [BIN, 'migrate-state', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: '{}', encoding: 'utf8' });
  assert.equal(r.status, 0);
  const json = JSON.parse(r.stdout.trim());
  assert.deepEqual(json.migrated, ['feature__old.json']);
  assert.ok(existsSync(join(repo, '.speccode', 'state', 'branches', 'feature__old.json')));
  rmSync(repo, { recursive: true, force: true });
});
```

(顶部若缺 `existsSync/mkdirSync/writeJsonAtomic/join` import 则补。)

- [x] **Step 2: 运行确认失败**

Run: `node --test --test-name-pattern="migrate-state|feature__x" plugins/speccode/tests/cli.test.mjs`
Expected: FAIL — `migrate-state` unknown verb / `state/branches` 不存在

- [x] **Step 3: 写最小实现**

`bin/speccode.mjs`:state import 行加入 `migrateStateV2toV3`(与既有 `readState, writeState, deleteState, WORKTREE_STATUS` 同行);VERBS 表新增:

```js
  'migrate-state': ({ cwd }) => ({ ok: true, ...migrateStateV2toV3(speccodeDirOf(cwd)) }),
```

- [x] **Step 4: 运行确认通过**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS 全量

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/bin/speccode.mjs plugins/speccode/tests/cli.test.mjs
git commit -m "feat: migrate-state verb and v3 state cli coverage"
```

---

### Task 5: 命令 prose — creating-worktree 与 creating-feature 重写

**Files:**
- Modify: `plugins/speccode/commands/creating-worktree.md`(全文重写)
- Modify: `plugins/speccode/commands/creating-feature.md`(全文重写)

**Interfaces:**
- Consumes: Task 1-4 的引擎契约(write-state v3 schema、reconcile `{features,orphans,conflicts,advanced}`、rename-memory 三分支、`list-memory`)
- Produces: 无代码接口

两个文件均为全文重写,以下为完整新内容(frontmatter 保持原文件现值不动,只重写正文):

**`creating-worktree.md` 正文:**

````markdown
创建开发分支(worktree)。普通需求的唯一入口;大需求场景从集成分支切出子分支。全程中文交互。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. HEAD 必须在功能分支(`<type>/<slug>` 形态、非 trunk);否则提示退出。
3. 运行 `speccode.mjs reconcile --cwd . --advance-pr`:
   - `conflicts` 非空 → 报告冲突并退出(v3 中应为恒空,出现即异常,提示人工检查 state)。
   - `orphans` 非空 → 告知用户,但不阻断创建。
4. 运行 `speccode.mjs read-memory --cwd . --branch <当前功能分支>`(若有)作为上下文。

## 决定分支名与基点

1. **参数直给**:参数中已含 `<type>/<slug>` 形式完整分支名 → 直接采用;slug 即探索 topic 名(slug=topic 约定),按该约定查找承接。
2. **topic 选择**:参数未直给时,运行 `speccode.mjs list-memory --cwd .` 取既有探索 topic 清单;非空 → AskUserQuestion 选既有 topic(或新建/跳过),slug 预填 topic 名,type 从所选 topic 内容推断;清单为空 → 直接询问。推断 MUST NOT 静默生效。
3. **基点判定**(依 state 中的 `kind:"integration"` 父实体):
   - 0 个父实体 → 基点 = `config.trunk`(普通需求),打印「普通需求:从 <trunk> 切出」。
   - 恰好 1 个 → 打印「检测到父实体 <branch>(大需求),将从其集成 head 切出」并经用户确认。
   - ≥2 个 → AskUserQuestion 列出父实体供选;直给完整分支名时跳过本判定。
4. **校验 slug**:`^[a-z0-9-]+$`;非法 → 拒绝并提示合法字符集;确认恰好一个 `/`。

## 创建

1. `git worktree add <worktree_dir>/<branch> -b <branch> <基点>`(基点为 trunk 或集成分支;worktree_dir 经 `resolve-worktree-dir` 解析,gitignore 校验同既有三分支)。
2. **项目 setup 与基线测试**:按标记文件执行(setup 与基线失败询问,同既有契约)。
3. 写 state:经 `write-state --branch <branch> --json-stdin`,内容 `{branch, type, worktree: <绝对路径>, merge_target: <集成分支名;普通需求写 config.trunk>, status: "in_progress", created_at, initial_branch: <基点>}`(merge_target 恒写)。
4. **登记父实体**(存在父实体时):经 `write-state --branch <父分支> --json-stdin` 读后整写父实体,`children` 追加 `{slug: "<本分支 slug>"}`(**仅 slug,不写状态**——状态由本分支 state 派生)。
5. **承接探索结论**(slug=topic 命中):`rename-memory --branch _exploring/<slug> --to <branch> --json-stdin`(stdin `{}`);ok → append 骨架头;`not found` → 骨架 replace「无」;`already exists` → 报告跳过。三分支契约同 creating-feature 既有口径。
6. 触发 onWorktreeCreated 钩子(payload 同既有)。
7. 打印:worktree 已创建于 `<路径>`,请 `cd` 过去开发。

## 完成后引导

手动模式询问是否执行 `/speccode:proposing`;auto 模式自动衔接;判断不充分 MUST 询问(同既有)。
````

**`creating-feature.md` 正文:**

````markdown
创建大需求的集成分支与父实体。**opt-in 命令**:仅当 exploring 形态确认判定为大需求(整体上线)时使用;普通需求直接 `/speccode:creating-worktree`。全程中文交互。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. 校验 HEAD 必须等于 `config.trunk`;不符 → 提示切回后退出。

## 决定分支名

同普通需求命名规则:`<type>/<slug>` 校验;参数直给(合法则采用)→ `list-memory` 选 topic(slug 预填,type 推断)→ 询问;推断 MUST NOT 静默生效。

## 创建

1. `git checkout -b <branch>`(从 trunk);`git push -u origin <branch>`。
2. 写父实体 state:经 `write-state --branch <branch> --json-stdin`,内容 `{branch, type, kind: "integration", children: [], status: "in_progress", created_at, initial_branch: config.trunk}`(**MUST NOT 含 worktree 字段**)。
3. **承接父 topic**(slug=topic 命中):`rename-memory --branch _exploring/<slug> --to <branch> --json-stdin`(stdin `{}`);ok → append 骨架头(创建时间);`not found` → 骨架 replace「无」;`already exists` → 报告跳过。三分支契约同既述。
4. 触发 onFeatureCreated 钩子。
5. 打印:大需求模式已建立,集成分支 `<branch>`;子需求经 `/speccode:creating-worktree` 从本分支切出;终局用 `/speccode:finishing-feature`。
````

- [x] **Step 1: 应用两个文件的全文重写**(frontmatter 不动)

- [x] **Step 2: 全量回归**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS(prose 零行为面)

- [x] **Step 3: 提交**

```bash
git add plugins/speccode/commands/creating-worktree.md plugins/speccode/commands/creating-feature.md
git commit -m "docs: rewrite creating-worktree/creating-feature for two-layer topology"
```

---

### Task 6: 命令 prose — finishing-worktree 与 finishing-feature 重写

**Files:**
- Modify: `plugins/speccode/commands/finishing-worktree.md`(全文重写)
- Modify: `plugins/speccode/commands/finishing-feature.md`(全文重写)

**Interfaces:**
- Consumes: Task 1-4 契约(write-state 格式跟随、`repo-merge-config`、`query-pr`、pending_operation、delete-state)
- Produces: 无代码接口

**`finishing-worktree.md` 正文:**

````markdown
完成一个开发分支并按 `merge_target` 路由合并。全程中文交互。支持 `--resume`。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. HEAD 必须在功能分支(`<type>/<slug>`、非 trunk);否则退出。
3. `speccode.mjs reconcile --cwd . --advance-pr`;conflicts 非空 → 报告退出(v3 恒空,出现即异常);找到本分支 state,读取 `merge_target`(缺省语义 = trunk)。
4. 读记忆 `read-memory --branch <F>`。
5. `--resume`:state 的 `pending_operation.command="finishing-worktree"` 时按 phase 续跑。

## 全量测试门禁

按标记文件探测测试命令(既有探测表);均无 → 询问用户或明确跳过。worktree 内全量运行,失败 → 展示摘要并停止,不呈现合并选项。

## 未归档变更检查(warn-only)

`speccode/changes/<slug>/` 存在 → 警告「建议先 syncing + archiving」,不阻断。

## 路由(按 merge_target)

### merge_target 为集成分支(大需求子分支)——本地 squash 自动路径

1. 确认主仓 checkout 在 `merge_target`(`git -C <主仓根> rev-parse --abbrev-ref HEAD`);不是 → `git -C <主仓根> checkout <merge_target>`。
2. `git -C <主仓根> merge --squash <branch>`;commit(遵守规范)。
3. **复测**:在主仓的集成分支上复跑全量测试;失败 → 停止,保留现场,提示调查。
4. 子分支 state 置 `completed` + `completed_at`(经 write-state 读后整写;**父实体 MUST NOT 被写**——children 仅身份,状态派生)。
5. 收尾:主仓切到集成分支并 `fetch & pull`(失败仅警告)。
6. 「清理」(来源限定:路径在 worktree_dir 下 ∪ state 登记;先离开被清理目录;询问是否删远端;prune)。

### merge_target 缺省(trunk)——菜单恰好三项

1. 同步 base:`git push origin <config.trunk>`;non-fast-forward → 中止提示处理分叉。
2. 建 PR 前探测:运行 `speccode.mjs repo-merge-config --cwd .`;`squashOnly:false` → 打印警告「建议在仓库设置启用 squash-only 合并」+ 指路,不阻断;`config:null` → 静默(无法探测)。
3. `git push -u origin <branch>`;pr_tool 建 PR(base=trunk);`pr_tool=none` → 打印等效命令并中止。
4. onPrOpened 钩子(payload 带 pr_number)。
5. **PR+等待**:每 30s `query-pr`,超时 30min;MERGED → 清理 + state completed;CLOSED/CONFLICTING → 报错退出;UNKNOWN 连续 3 次中止;TIMEOUT → 写 `pending_operation{command:"finishing-worktree", phase:"waiting_worktree_pr", pr_number}` 提示 `--resume`。
6. **PR+不等待**:state 置 `pr_open` + pr_number,不清理不阻塞。
7. **保留 worktree**:不合并不清理,state 不动。
8. 任一合并完成路径(MERGED)后:切回 trunk 并 `fetch & pull`。

### 丢弃路径(仅显式要求)

展示分支名、完整 commit 列表、worktree 路径 → 用户逐字输入 `discard` → 清理 + 从 state 删除(write-state 读后整写;父实体 children 不动——slug 保留供重开)。

## 清理(来源限定)

仅处理「路径位于 resolve-worktree-dir 解析结果之下 或 state 有登记」的 worktree;先离开被清理目录(`cd <主仓根>` 或全程 `git -C`);`worktree remove --force` + `branch -D` + 询问删远端 + `worktree prune`。不满足 → 原样保留并说明。

## 收尾

1. `feature-progress --branch <所属父分支或本分支>` 取进度。
2. onWorktreeFinished 钩子(有 PR 带 pr_number)。
3. 状态报告:`<分支> 进度 X/Y done`;大需求场景按父实体 children 派生渲染;建议后续(finishing-feature / finishing-worktree 下一子分支)。
4. 写记忆(经用户确认或内置判据)。
````

**`finishing-feature.md` 正文:**

````markdown
大需求终局:集成分支 → trunk 单 PR。**opt-in 命令**,仅父实体(kind:integration)使用。全程中文交互。支持 `--resume`。

## 前置

1. `read-config`;为 null → 提示 init。
2. HEAD 必须在功能分支(`<type>/<slug>`);否则退出。
3. `reconcile --cwd . --advance-pr`;orphans 中有本父实体残留 → 提示先清理。
4. 读父实体 state:必须 `kind:"integration"`;否则报错「本命令仅适用于大需求集成分支,普通分支用 finishing-worktree」并退出。

## 门禁(children 全 completed,派生读取)

1. 对 `children` 中每个 slug 读其子分支 state;任一状态 ∈ `{pending, in_progress, pr_open}` → 阻止,列出未完成项(pr_open 附 PR 号)。
2. children 有 slug 但无对应子 state → 视为 `pending`(计划未开工),同样阻止。
3. 全部 completed → 放行。

## 单 PR 流程(integration → trunk)

1. `git push origin <branch>`;non-fast-forward → 中止。
2. 建 PR 前探测 `repo-merge-config`(squashOnly:false → 警告 + 指路,不阻断)。
3. pr_tool 建 PR(base=trunk, head=集成分支);`pr_tool=none` → 打印等效命令并中止。
4. onPrOpened 钩子。
5. 阻塞等待(每 30s query-pr,超时 30min):MERGED → 收尾;CLOSED/CONFLICTING → 报错退出;UNKNOWN 连续 3 次中止;TIMEOUT → 写 `pending_operation{command:"finishing-feature", phase:"waiting_trunk_pr", pr_number}` 提示 `--resume`。

## 收尾

1. `delete-state --branch <集成分支>`(父实体 state;子分支 state 已随各自 finishing-worktree 完成/清理)。
2. onFeatureFinished 钩子。
3. `git checkout <config.trunk>` + `fetch & pull`(集成分支与子分支保留作历史,speccode 不删)。
4. 打印:大需求已交付,`<branch>` 已合并进 trunk。
5. 写记忆(经用户确认或内置判据)。
````

- [x] **Step 1: 应用两个文件的全文重写**(frontmatter 不动)

- [x] **Step 2: 全量回归**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS

- [x] **Step 3: 提交**

```bash
git add plugins/speccode/commands/finishing-worktree.md plugins/speccode/commands/finishing-feature.md
git commit -m "docs: rewrite finishing commands for merge_target routing and parent-entity finish"
```

---

### Task 7: 命令 prose — exploring / status / 守卫 / reset / init

**Files:**
- Modify: `plugins/speccode/commands/exploring.md`
- Modify: `plugins/speccode/commands/status.md`
- Modify: `plugins/speccode/commands/syncing.md`、`archiving.md`、`brainstorming.md`、`dispatching-parallel-agents.md`、`writing-plans.md`(守卫)
- Modify: `plugins/speccode/commands/reset.md`、`init.md`

**Interfaces:** Consumes Task 1-6 全部契约;Produces 无。

- [x] **Step 1: exploring.md 两处**

① 前置第 1 条后插入:

```markdown
1b. 前置动作:先执行 `git fetch origin && git pull`(以 config.trunk 为当前分支时);失败(如离线)仅打印警告,MUST NOT 阻断。
```

② 前置第 2 条(trunk 校验)改为:

```markdown
2. 检查 HEAD:若不在 `config.trunk` 上,打印警告「exploring 应在 trunk 执行,当前在 <branch>,建议切回」——警告 MUST NOT 硬阻断(用户可能有意在分支上查看)。
```

③ 「完成后的衔接」段、写记忆之前插入形态确认小节:

```markdown
## 需求形态确认(出口,三岔)

探索结论成形后、写记忆之前,MUST 做形态确认并经用户选择:

1. agent 从探索内容找信号形成建议——**决定性信号**:「要么整体上线要么全不上线」的交付约束;辅助:工作可分解为多个子需求且共享同一次上线、子需求间依赖/共享基础设施、并行开发意图;**反例信号**:各部分可独立上线。
2. AskUserQuestion 三岔:**单普通需求**(引导 `/speccode:creating-worktree`)/ **多个独立普通需求**(逐个走普通流程,不建集成)/ **大需求(整体上线)**(引导 `/speccode:creating-feature`)。
3. 大需求确认后:父 slug 与子需求清单(语义化 slug)MUST 写入本探索 topic 的记忆内容;记忆写入的分支键:大需求 → `_exploring/<父 slug>`;各子需求如有独立探索 → 各自 topic。

形态判断 MUST NOT 静默生效;误判无破坏性(误建集成可留用,漏判可手动补建),但确认一步 MUST 不省。
```

- [x] **Step 2: status.md 渲染更新**

正文「汇总所有 active feature」相关句子改为:

```markdown
开头跑对账,汇总 `.speccode/state/branches/` 下所有 active 分支:普通分支渲染状态与 `pending_operation`;父实体(`kind:"integration"`)以树状渲染 `children`——各子分支的 status **实时读取对应子分支 state 派生**,children 有 slug 但无子 state 的渲染为 `pending`(计划未开工)。v2 遗留(`state/features/`)条目按原样列出并标注「v2 待迁移」。
```

- [x] **Step 3: 五处守卫改写**

`syncing.md:13`、`archiving.md:13`、`brainstorming.md:20`、`dispatching-parallel-agents.md:51` 的 trunk 防护(以及各自 frontmatter 下首段的「应在 worktree-* 分支上运行」表述)统一改为:

```markdown
**trunk 防护**:`git rev-parse --abbrev-ref HEAD` 必须为非 trunk 的 `<type>/<slug>` 形态分支;否则退出并提示「请在开发分支上运行本命令」(防止直提 trunk)。
```

`writing-plans.md` 的分支校验同款改写(其现文本亦引用 worktree_prefix)。

- [x] **Step 4: reset.md 与 init.md**

`reset.md`:「清理 worktree」判定改「路径位于 worktree_dir 之下 或 state 有登记」(去分支名前缀条件);「无 active feature」表述改「无 active 分支」;config 字段清单去 `worktree_prefix`。

`init.md`:① config 字段清单(`version: 3`)去 `worktree_prefix`;② 新增迁移步骤:

```markdown
N. **state 迁移(检测到 `state/features/` 时)**:展示迁移预览(逐文件 v2→v3 转换说明;`worktrees` 多于一条的文件将跳过并报告「请先按 v2 流程收尾」),经用户确认后运行 `echo '{}' | speccode.mjs migrate-state --cwd . --json-stdin`,随后跑 `reconcile` 验证 migrated 结果;拒绝 → 保持 v2 原样并提示 v2 流程继续可用。
```

③ 二次 init 字段级幂等询问中,`worktree_prefix` 出现为「标记移除」项(既有 v1→v2 升级同款机制)。

④ **squash 探测提示**:init 完成 config 写入后运行 `speccode.mjs repo-merge-config --cwd .`;`squashOnly:false` → 打印警告「建议在仓库设置启用 squash-only 合并」+ 设置指引(不阻断);`config:null`(glab/none/失败)→ 静默跳过。

- [x] **Step 5: 全仓清点**

Run: `grep -rn "worktree_prefix\|worktree-" plugins/speccode/commands/ plugins/speccode/lib/ plugins/speccode/bin/ plugins/speccode/hooks/ | grep -v "state/features"`
Expected: 仅命中 v2 兼容注释(`state.mjs`/`reconcile.mjs` 注释)与 `repoMergeConfig` 的 gh 字段(允许);其余 MUST 归零,残留逐一处理

- [x] **Step 6: 全量回归 + 提交**

Run: `node --test ./plugins/speccode/tests/*.test.mjs` → PASS

```bash
git add plugins/speccode/commands/
git commit -m "docs: two-layer guards, shape confirmation at exploring exit, status derivation"
```

---

### Task 8: 文档同步 + 收尾验证

**Files:**
- Modify: `plugins/speccode/README.md`、`plugins/speccode/README_CN.md`(拓扑图、命令表语义、前缀表述)
- Modify: `CLAUDE.md`(三层描述改双层;worktree 前缀表述移除)

**Interfaces:** 无。

- [x] **Step 1: CLAUDE.md 双层化**

「架构:三层,必须理解的分工」标题与首段改为双层(普通需求 trunk → `<type>/<slug>` worktree 直达;大需求 opt-in 集成分支+父实体);「关键不变量」中 worktree 前缀相关表述(`worktree-` 硬前缀、状态枚举条目)按 v3 改写:枚举保留,「worktree 分支硬前缀」条删除,增「路径识别 + state 登记」与「children 仅身份,状态派生」两条;命名规则条(`<type>/<slug>`、`type__slug` 双下划线)保留并注明适用于 worktree 分支;对账算法条按 C 路径识别改写。不硬编码任何数量。

- [x] **Step 2: README ×4 同步**

`README.md` 与 `README_CN.md`:三层拓扑图改双层(含大需求 opt-in 集成分支虚线);命令表中 creating-feature/finishing-feature 标注「opt-in(大需求)」;`worktree-` 前缀相关表述删除;memory 目录树注释不变(上一 feature 已是 topic 形态)。中英结构一一对应;不硬编码数字。

- [x] **Step 3: 全量回归 + 冒烟**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS 全量

Run(主仓临时目录冒烟,tmprepo 语义):
```bash
cd /tmp && rm -rf smk && mkdir smk && cd smk && git init -q . && git commit -q --allow-empty -m init
node /Users/game-netease/orca/workspaces/speccode-development/worktree-remove-feature-layer/plugins/speccode/bin/speccode.mjs write-state --cwd . --branch feature/smk --json-stdin <<< '{"branch":"feature/smk","type":"feature","worktree":null,"status":"pending","created_at":"2026-09-02T00:00:00.000Z","initial_branch":"main"}'
node /Users/game-netease/orca/workspaces/speccode-development/worktree-remove-feature-layer/plugins/speccode/bin/speccode.mjs reconcile --cwd .
node /Users/game-netease/orca/workspaces/speccode-development/worktree-remove-feature-layer/plugins/speccode/bin/speccode.mjs repo-merge-config --cwd .
rm -rf /tmp/smk
```
Expected: state 落 `state/branches/feature__smk.json`;reconcile 报 orphan(branch 无 worktree 且非 completed);repo-merge-config 返回真实探测或 null;清理干净。

- [x] **Step 4: 提交**

```bash
git add plugins/speccode/README.md plugins/speccode/README_CN.md CLAUDE.md
git commit -m "docs: two-layer topology in READMEs and CLAUDE.md"
```
