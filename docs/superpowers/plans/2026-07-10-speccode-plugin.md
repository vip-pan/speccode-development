# speccode 插件实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 speccode —— 一个用 10 个 `/speccode:*` slash 命令固化"多需求并行开发 + spec 文档托管 + PR/MR 标准化"工作流的 Claude Code 插件。

**Architecture:** 所有确定性逻辑(config/state 读写、原子写、对账、文档剥离、PR 轮询)实现为 `.claude/speccode/lib/` 下经单元测试的 Node.js ESM 模块,通过 `.claude/speccode/bin/speccode.mjs` 暴露为输出 JSON 的 CLI 子命令(verb);10 个 markdown 命令是交互层——只负责提问/确认/调用 verb/解析 JSON/报告。测试用 `node:test` 对真实临时 git 仓库运行,PR 相关逻辑通过依赖注入(注入 `queryPr`/`sleep`)做快速单测。

**Tech Stack:** Node.js ≥ 24(内置 `node:test`、`node:fs`、`node:child_process`);git;`gh`(GitHub)/ `glab`(GitLab)CLI;Claude Code slash command markdown。

## Global Constraints

- 所有写入 `.speccode/config.json` 与 `.speccode/state/features/*.json` 的操作 MUST 用"写临时文件 + `mv` 覆盖"原子策略(temp 路径含 `process.pid` 防并发碰撞)。
- 所有时间字段用 ISO 8601 UTC(`new Date().toISOString()`),MUST 能被 `Date.parse()` 解析。
- 功能分支 MUST 形如 `<type>/<slug>`,恰好一个 `/`;`type ∈ {feature, bugfix, refactor, chore}`;`slug` MUST 匹配 `/^[a-z0-9-]+$/`。
- state 文件名 MUST 为 `<type>__<slug>.json`(双下划线分隔 type 与 slug)。
- worktree 分支 MUST 以 `worktree-` 前缀(`config.worktree_prefix`,默认 `"worktree-"`)。
- worktree 状态枚举 MUST ∈ `{pending, in_progress, pr_open, completed}`;`pr_open` 时条目 MUST 含 `pr_number`。
- worktree 目录默认 `.claude/worktrees/<branch>`。
- `wait_for_pr_merge` 轮询间隔 30 秒,默认超时 1800 秒(30 分钟);超时写 `pending_operation` 供 `--resume`。
- 模块一律用 ESM(`.mjs`,`import`/`export`);不引入任何第三方依赖(仅 Node 内置)。
- 引擎代码位于 `.claude/speccode/`,在本仓库中被 git 跟踪(与 `.claude/commands/opsx/` 同例)。注意:这与 speccode **运行时**把用户项目里的 `.speccode/`(运行时数据目录)保持 untracked 是两回事——前者是插件源码,后者是插件在目标仓库产生的状态。

---

## 文件结构

```
.claude/speccode/
├── bin/
│   └── speccode.mjs          # CLI verb 分发,读 argv,调 lib,输出 JSON 到 stdout
├── lib/
│   ├── timestamp.mjs         # nowIso()
│   ├── atomic.mjs            # readJson() / writeJsonAtomic()
│   ├── slug.mjs              # validateSlug/validateBranch/branchToStateName/stateNameToBranch/TYPES
│   ├── config.mjs            # loadConfig/saveConfig/mergeConfigField/DEFAULT_UNTRACKED
│   ├── state.mjs             # readState/writeState/listActiveFeatures/WORKTREE_STATUS
│   ├── git.mjs               # git()/currentBranch()/worktreeList()/isAncestor()/branchExists()
│   ├── reconcile.mjs         # reconcile()
│   ├── prtool.mjs            # detectPrTool/isInstalled/createPr/queryPr
│   ├── waitmerge.mjs         # waitForPrMerge()
│   └── docstrip.mjs          # stripDocs/retrackDocs/backupDocs
└── README.md                 # 见 Task 15

.claude/commands/speccode/
├── init.md  start.md  develop-start.md  develop-complete.md  finish.md
├── status.md  display-merge-trunk.md  display-rebase-trunk.md
├── display-reset-to-trunk.md  reset.md

tests/
├── atomic.test.mjs  slug.test.mjs  state.test.mjs  git.test.mjs
├── reconcile.test.mjs  prtool.test.mjs  waitmerge.test.mjs
├── docstrip.test.mjs  config.test.mjs  cli.test.mjs
└── helpers/tmprepo.mjs        # 建临时 git 仓库的测试辅助
```

---

## Phase 1 — 引擎基础(lib + 单测)

### Task 1: 时间戳与原子 JSON 写入

**Files:**
- Create: `.claude/speccode/lib/timestamp.mjs`
- Create: `.claude/speccode/lib/atomic.mjs`
- Test: `tests/atomic.test.mjs`

**Interfaces:**
- Produces:
  - `nowIso(): string` — 返回 `new Date().toISOString()`
  - `readJson(path: string): object | null` — 文件不存在返回 `null`,存在则 `JSON.parse`
  - `writeJsonAtomic(path: string, obj: object): void` — 写 `${path}.${pid}.tmp` 后 `renameSync` 覆盖;自动 `mkdir -p` 父目录

- [ ] **Step 1: 写失败测试**

创建 `tests/atomic.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readJson, writeJsonAtomic } from '../.claude/speccode/lib/atomic.mjs';
import { nowIso } from '../.claude/speccode/lib/timestamp.mjs';

function tmp() { return mkdtempSync(join(tmpdir(), 'speccode-atomic-')); }

test('readJson returns null for missing file', () => {
  const dir = tmp();
  assert.equal(readJson(join(dir, 'nope.json')), null);
  rmSync(dir, { recursive: true, force: true });
});

test('writeJsonAtomic then readJson round-trips', () => {
  const dir = tmp();
  const p = join(dir, 'sub', 'a.json');
  writeJsonAtomic(p, { x: 1, y: 'hi' });
  assert.deepEqual(readJson(p), { x: 1, y: 'hi' });
  rmSync(dir, { recursive: true, force: true });
});

test('writeJsonAtomic leaves no .tmp file behind', () => {
  const dir = tmp();
  writeJsonAtomic(join(dir, 'a.json'), { ok: true });
  const leftover = readdirSync(dir).filter((f) => f.includes('.tmp'));
  assert.deepEqual(leftover, []);
  rmSync(dir, { recursive: true, force: true });
});

test('writeJsonAtomic overwrites existing content fully', () => {
  const dir = tmp();
  const p = join(dir, 'a.json');
  writeFileSync(p, '{"old":true,"stale":123}');
  writeJsonAtomic(p, { fresh: 1 });
  assert.deepEqual(readJson(p), { fresh: 1 });
  rmSync(dir, { recursive: true, force: true });
});

test('nowIso is parseable ISO 8601', () => {
  const s = nowIso();
  assert.ok(!Number.isNaN(Date.parse(s)));
  assert.match(s, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/atomic.test.mjs`
Expected: FAIL —— `Cannot find module '.../atomic.mjs'`

- [ ] **Step 3: 实现 timestamp.mjs**

创建 `.claude/speccode/lib/timestamp.mjs`:

```javascript
export function nowIso() {
  return new Date().toISOString();
}
```

- [ ] **Step 4: 实现 atomic.mjs**

创建 `.claude/speccode/lib/atomic.mjs`:

```javascript
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function writeJsonAtomic(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  renameSync(tmp, path);
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `node --test tests/atomic.test.mjs`
Expected: PASS —— 5 tests pass

- [ ] **Step 6: 提交**

```bash
git add .claude/speccode/lib/timestamp.mjs .claude/speccode/lib/atomic.mjs tests/atomic.test.mjs
git commit -m "feat(speccode): atomic JSON write + iso timestamp"
```

---

### Task 2: slug 校验与分支/文件名映射

**Files:**
- Create: `.claude/speccode/lib/slug.mjs`
- Test: `tests/slug.test.mjs`

**Interfaces:**
- Produces:
  - `TYPES: string[]` — `['feature', 'bugfix', 'refactor', 'chore']`
  - `validateSlug(slug: string): boolean` — `/^[a-z0-9-]+$/`
  - `validateBranch(branch: string): boolean` — 恰好一个 `/`,左段 ∈ TYPES,右段合法 slug
  - `branchToStateName(branch: string): string` — `feature/payment` → `feature__payment`
  - `stateNameToBranch(name: string): string` — `feature__payment` → `feature/payment`

- [ ] **Step 1: 写失败测试**

创建 `tests/slug.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TYPES, validateSlug, validateBranch, branchToStateName, stateNameToBranch,
} from '../.claude/speccode/lib/slug.mjs';

test('TYPES has the four branch types', () => {
  assert.deepEqual(TYPES, ['feature', 'bugfix', 'refactor', 'chore']);
});

test('validateSlug accepts lowercase alnum and hyphen', () => {
  assert.ok(validateSlug('payment'));
  assert.ok(validateSlug('pay-ment-api'));
  assert.ok(validateSlug('v2'));
});

test('validateSlug rejects illegal chars', () => {
  assert.ok(!validateSlug('Payment'));   // uppercase
  assert.ok(!validateSlug('pay_ment'));  // underscore
  assert.ok(!validateSlug('pay ment'));  // space
  assert.ok(!validateSlug('pay/ment'));  // slash
  assert.ok(!validateSlug(''));          // empty
});

test('validateBranch requires <type>/<slug> shape', () => {
  assert.ok(validateBranch('feature/payment'));
  assert.ok(validateBranch('bugfix/pay-ment'));
  assert.ok(!validateBranch('feature'));            // no slash
  assert.ok(!validateBranch('feature/pay/ment'));   // two slashes
  assert.ok(!validateBranch('wip/payment'));        // bad type
  assert.ok(!validateBranch('feature/Payment'));    // bad slug
});

test('branchToStateName uses double underscore', () => {
  assert.equal(branchToStateName('feature/payment'), 'feature__payment');
  assert.equal(branchToStateName('bugfix/pay-ment'), 'bugfix__pay-ment');
});

test('stateNameToBranch inverts branchToStateName', () => {
  assert.equal(stateNameToBranch('feature__payment'), 'feature/payment');
  assert.equal(stateNameToBranch('bugfix__pay-ment'), 'bugfix/pay-ment');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/slug.test.mjs`
Expected: FAIL —— module not found

- [ ] **Step 3: 实现 slug.mjs**

创建 `.claude/speccode/lib/slug.mjs`:

```javascript
export const TYPES = ['feature', 'bugfix', 'refactor', 'chore'];

const SLUG_RE = /^[a-z0-9-]+$/;

export function validateSlug(slug) {
  return typeof slug === 'string' && SLUG_RE.test(slug);
}

export function validateBranch(branch) {
  if (typeof branch !== 'string') return false;
  const parts = branch.split('/');
  if (parts.length !== 2) return false;
  const [type, slug] = parts;
  return TYPES.includes(type) && validateSlug(slug);
}

export function branchToStateName(branch) {
  const [type, slug] = branch.split('/');
  return `${type}__${slug}`;
}

export function stateNameToBranch(name) {
  const [type, slug] = name.split('__');
  return `${type}/${slug}`;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/slug.test.mjs`
Expected: PASS —— 6 tests pass

- [ ] **Step 5: 提交**

```bash
git add .claude/speccode/lib/slug.mjs tests/slug.test.mjs
git commit -m "feat(speccode): slug validation and branch/statename mapping"
```

---

### Task 3: state 模块(feature 状态文件读写)

**Files:**
- Create: `.claude/speccode/lib/state.mjs`
- Test: `tests/state.test.mjs`

**Interfaces:**
- Consumes: `atomic.readJson/writeJsonAtomic`(Task 1),`slug.branchToStateName/stateNameToBranch`(Task 2)
- Produces:
  - `WORKTREE_STATUS: { PENDING, IN_PROGRESS, PR_OPEN, COMPLETED }` — 值为 `'pending' | 'in_progress' | 'pr_open' | 'completed'`
  - `featuresDir(speccodeDir: string): string` — `<speccodeDir>/state/features`
  - `stateFilePath(speccodeDir, branch): string`
  - `readState(speccodeDir, branch): object | null`
  - `writeState(speccodeDir, branch, state): void`
  - `deleteState(speccodeDir, branch): void`
  - `listActiveFeatures(speccodeDir): object[]` — 读所有 `*.json`,返回 state 对象数组(空目录返回 `[]`)

- [ ] **Step 1: 写失败测试**

创建 `tests/state.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  WORKTREE_STATUS, stateFilePath, readState, writeState, deleteState, listActiveFeatures,
} from '../.claude/speccode/lib/state.mjs';

function tmp() { return mkdtempSync(join(tmpdir(), 'speccode-state-')); }

test('WORKTREE_STATUS enum values', () => {
  assert.deepEqual(WORKTREE_STATUS, {
    PENDING: 'pending', IN_PROGRESS: 'in_progress',
    PR_OPEN: 'pr_open', COMPLETED: 'completed',
  });
});

test('stateFilePath maps branch to double-underscore filename', () => {
  const p = stateFilePath('/x/.speccode', 'feature/payment');
  assert.equal(p, '/x/.speccode/state/features/feature__payment.json');
});

test('readState returns null when absent', () => {
  const dir = tmp();
  assert.equal(readState(dir, 'feature/none'), null);
  rmSync(dir, { recursive: true, force: true });
});

test('writeState then readState round-trips', () => {
  const dir = tmp();
  const state = {
    feature_branch: 'feature/payment',
    created_at: '2026-07-10T00:00:00.000Z',
    initial_branch: 'display',
    status: 'in_progress',
    worktrees: { 'worktree-payment': { status: 'in_progress' } },
  };
  writeState(dir, 'feature/payment', state);
  assert.deepEqual(readState(dir, 'feature/payment'), state);
  rmSync(dir, { recursive: true, force: true });
});

test('listActiveFeatures empty dir returns []', () => {
  const dir = tmp();
  assert.deepEqual(listActiveFeatures(dir), []);
  rmSync(dir, { recursive: true, force: true });
});

test('listActiveFeatures returns all feature states', () => {
  const dir = tmp();
  writeState(dir, 'feature/payment', { feature_branch: 'feature/payment', worktrees: {} });
  writeState(dir, 'bugfix/login', { feature_branch: 'bugfix/login', worktrees: {} });
  const branches = listActiveFeatures(dir).map((s) => s.feature_branch).sort();
  assert.deepEqual(branches, ['bugfix/login', 'feature/payment']);
  rmSync(dir, { recursive: true, force: true });
});

test('deleteState removes the file', () => {
  const dir = tmp();
  writeState(dir, 'feature/payment', { feature_branch: 'feature/payment', worktrees: {} });
  deleteState(dir, 'feature/payment');
  assert.equal(existsSync(stateFilePath(dir, 'feature/payment')), false);
  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/state.test.mjs`
Expected: FAIL —— module not found

- [ ] **Step 3: 实现 state.mjs**

创建 `.claude/speccode/lib/state.mjs`:

```javascript
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

export function featuresDir(speccodeDir) {
  return join(speccodeDir, 'state', 'features');
}

export function stateFilePath(speccodeDir, branch) {
  return join(featuresDir(speccodeDir), `${branchToStateName(branch)}.json`);
}

export function readState(speccodeDir, branch) {
  return readJson(stateFilePath(speccodeDir, branch));
}

export function writeState(speccodeDir, branch, state) {
  writeJsonAtomic(stateFilePath(speccodeDir, branch), state);
}

export function deleteState(speccodeDir, branch) {
  const p = stateFilePath(speccodeDir, branch);
  if (existsSync(p)) rmSync(p);
}

export function listActiveFeatures(speccodeDir) {
  const dir = featuresDir(speccodeDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson(join(dir, f)))
    .filter((s) => s !== null);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/state.test.mjs`
Expected: PASS —— 7 tests pass

- [ ] **Step 5: 提交**

```bash
git add .claude/speccode/lib/state.mjs tests/state.test.mjs
git commit -m "feat(speccode): feature state file read/write/list"
```

---

### Task 4: git 辅助模块 + 测试仓库辅助

**Files:**
- Create: `.claude/speccode/lib/git.mjs`
- Create: `tests/helpers/tmprepo.mjs`
- Test: `tests/git.test.mjs`

**Interfaces:**
- Produces (git.mjs):
  - `git(args: string[], opts?: { cwd?: string, allowFail?: boolean }): { code, stdout, stderr }` — 封装 `spawnSync('git', args)`;`allowFail=false`(默认)时非 0 退出码抛错
  - `currentBranch(cwd?): string` — `git rev-parse --abbrev-ref HEAD`
  - `branchExists(branch, cwd?): boolean` — `git rev-parse --verify --quiet <branch>`
  - `isAncestor(ancestor, descendant, cwd?): boolean` — `git merge-base --is-ancestor`,退出码 0 → true
  - `worktreeList(cwd?): { path: string, branch: string | null }[]` — 解析 `git worktree list --porcelain`,branch 去掉 `refs/heads/` 前缀,detached 为 `null`
- Produces (tmprepo.mjs):
  - `makeRepo(): string` — 建临时目录,`git init -b master`,配置 user,做一个初始 commit,返回仓库路径
  - `commitFile(repo, relpath, content, msg): void` — 写文件并 commit

- [ ] **Step 1: 写测试仓库辅助**

创建 `tests/helpers/tmprepo.mjs`:

```javascript
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

function run(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

export function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'speccode-repo-'));
  run(dir, 'init', '-b', 'master');
  run(dir, 'config', 'user.email', 'test@local');
  run(dir, 'config', 'user.name', 'test');
  writeFileSync(join(dir, 'README.md'), '# test\n');
  run(dir, 'add', '.');
  run(dir, 'commit', '-m', 'init');
  return dir;
}

export function commitFile(repo, relpath, content, msg) {
  const full = join(repo, relpath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  run(repo, 'add', '.');
  run(repo, 'commit', '-m', msg);
}
```

- [ ] **Step 2: 写失败测试**

创建 `tests/git.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeRepo, commitFile } from './helpers/tmprepo.mjs';
import {
  git, currentBranch, branchExists, isAncestor, worktreeList,
} from '../.claude/speccode/lib/git.mjs';

function g(repo, ...args) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}

test('currentBranch reads HEAD', () => {
  const repo = makeRepo();
  assert.equal(currentBranch(repo), 'master');
  rmSync(repo, { recursive: true, force: true });
});

test('branchExists true/false', () => {
  const repo = makeRepo();
  assert.ok(branchExists('master', repo));
  assert.ok(!branchExists('feature/nope', repo));
  rmSync(repo, { recursive: true, force: true });
});

test('isAncestor detects ancestry', () => {
  const repo = makeRepo();
  g(repo, 'checkout', '-b', 'feature/x');
  commitFile(repo, 'a.txt', 'a', 'add a');
  assert.ok(isAncestor('master', 'feature/x', repo));
  assert.ok(!isAncestor('feature/x', 'master', repo));
  rmSync(repo, { recursive: true, force: true });
});

test('worktreeList parses porcelain including linked worktrees', () => {
  const repo = makeRepo();
  g(repo, 'branch', 'feature/x');
  const wtPath = join(repo, '..', `wt-${Date.now()}`);
  g(repo, 'worktree', 'add', wtPath, 'feature/x');
  const list = worktreeList(repo);
  const branches = list.map((w) => w.branch).sort();
  assert.ok(branches.includes('master'));
  assert.ok(branches.includes('feature/x'));
  g(repo, 'worktree', 'remove', wtPath, '--force');
  rmSync(repo, { recursive: true, force: true });
});

test('git throws on failure by default, allowFail suppresses', () => {
  const repo = makeRepo();
  assert.throws(() => git(['rev-parse', '--verify', 'nope'], { cwd: repo }));
  const r = git(['rev-parse', '--verify', 'nope'], { cwd: repo, allowFail: true });
  assert.notEqual(r.code, 0);
  rmSync(repo, { recursive: true, force: true });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `node --test tests/git.test.mjs`
Expected: FAIL —— module not found

- [ ] **Step 4: 实现 git.mjs**

创建 `.claude/speccode/lib/git.mjs`:

```javascript
import { spawnSync } from 'node:child_process';

export function git(args, opts = {}) {
  const { cwd, allowFail = false } = opts;
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  const result = { code: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  if (!allowFail && result.code !== 0) {
    throw new Error(`git ${args.join(' ')} failed (${result.code}): ${result.stderr}`);
  }
  return result;
}

export function currentBranch(cwd) {
  return git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd }).stdout.trim();
}

export function branchExists(branch, cwd) {
  return git(['rev-parse', '--verify', '--quiet', branch], { cwd, allowFail: true }).code === 0;
}

export function isAncestor(ancestor, descendant, cwd) {
  return git(['merge-base', '--is-ancestor', ancestor, descendant], { cwd, allowFail: true }).code === 0;
}

export function worktreeList(cwd) {
  const out = git(['worktree', 'list', '--porcelain'], { cwd }).stdout;
  const entries = [];
  let cur = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (cur) entries.push(cur);
      cur = { path: line.slice('worktree '.length), branch: null };
    } else if (line.startsWith('branch ') && cur) {
      cur.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '');
    }
  }
  if (cur) entries.push(cur);
  return entries;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `node --test tests/git.test.mjs`
Expected: PASS —— 5 tests pass

- [ ] **Step 6: 提交**

```bash
git add .claude/speccode/lib/git.mjs tests/helpers/tmprepo.mjs tests/git.test.mjs
git commit -m "feat(speccode): git helpers + porcelain worktree parsing"
```

---

### Task 5: 对账算法(reconcile)

**Files:**
- Create: `.claude/speccode/lib/reconcile.mjs`
- Test: `tests/reconcile.test.mjs`

**Interfaces:**
- Consumes: `state.listActiveFeatures/writeState/WORKTREE_STATUS`(Task 3),`git.worktreeList/isAncestor`(Task 4)
- Produces:
  - `reconcile(speccodeDir, opts): { features, orphans, conflicts, advanced }` —
    - `opts.prefix: string`(worktree 前缀,默认 `'worktree-'`)
    - `opts.cwd?: string`(git 工作目录)
    - `opts.queryPr?: (prNumber) => 'MERGED'|'OPEN'|'CLOSED'`(注入;用于推进 `pr_open`。缺省则不推进)
    - 返回 `features`: 对账后的 state 数组;`orphans`: 无法归属的 worktree 分支名数组;`conflicts`: 同时属多 feature 的 `{ worktree, features[] }`;`advanced`: 被推进/回退的 `{ worktree, from, to }`
  - 纯计算 + 写回 state 文件(通过 writeState);不做 git 破坏性操作(推进时的 worktree 清理由调用方命令负责,reconcile 只改状态并在返回值里标记)

对账规则(实现要点):
1. 收集 git 中所有以 prefix 开头的 worktree 分支(来自 `worktreeList`)。
2. 收集所有 active feature 的 state。
3. 对每个 state 里已登记的 worktree:git 中不存在 → 标 `orphaned`(记入 orphans,不改其在 state 中的 status,交由命令层提示)。
4. 对每个 git 中的 prefix worktree,若未登记于任何 state:
   - 先查各 state 的 `worktree_overrides[branch]`,命中则归入该 feature。
   - 否则用 `isAncestor(feature_branch, worktreeBranch)` 找归属;命中 1 个 → 补入(status=in_progress);命中 ≥2 → 记 conflicts,不补。
5. 对每个 state 里 status=`pr_open` 且有 `pr_number` 的 worktree:若 `queryPr` 提供,查询:MERGED → 置 completed + completed_at(记 advanced from pr_open to completed);CLOSED → 回退 in_progress(记 advanced)。
6. 写回被修改的 state 文件。

- [ ] **Step 1: 写失败测试**

创建 `tests/reconcile.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeRepo, commitFile } from './helpers/tmprepo.mjs';
import { writeState, readState } from '../.claude/speccode/lib/state.mjs';
import { reconcile } from '../.claude/speccode/lib/reconcile.mjs';

function g(repo, ...args) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}

test('auto-attaches unregistered worktree via ancestry', () => {
  const repo = makeRepo();
  const sc = mkdtempSync(join(tmpdir(), 'sc-'));
  g(repo, 'checkout', '-b', 'feature/payment');
  commitFile(repo, 'a.txt', 'a', 'a');
  g(repo, 'checkout', 'master');
  writeState(sc, 'feature/payment', {
    feature_branch: 'feature/payment', initial_branch: 'master',
    status: 'in_progress', worktrees: {},
  });
  const wt = join(repo, '..', `wt-p-${Date.now()}`);
  g(repo, 'worktree', 'add', wt, '-b', 'worktree-payment', 'feature/payment');
  const res = reconcile(sc, { prefix: 'worktree-', cwd: repo });
  const st = readState(sc, 'feature/payment');
  assert.equal(st.worktrees['worktree-payment'].status, 'in_progress');
  assert.equal(res.orphans.length, 0);
  g(repo, 'worktree', 'remove', wt, '--force');
  rmSync(repo, { recursive: true, force: true });
  rmSync(sc, { recursive: true, force: true });
});

test('marks orphan when state worktree absent in git', () => {
  const repo = makeRepo();
  const sc = mkdtempSync(join(tmpdir(), 'sc-'));
  writeState(sc, 'feature/x', {
    feature_branch: 'feature/x', initial_branch: 'master', status: 'in_progress',
    worktrees: { 'worktree-x': { status: 'in_progress' } },
  });
  const res = reconcile(sc, { prefix: 'worktree-', cwd: repo });
  assert.ok(res.orphans.includes('worktree-x'));
  rmSync(repo, { recursive: true, force: true });
  rmSync(sc, { recursive: true, force: true });
});

test('worktree_overrides wins over ancestry', () => {
  const repo = makeRepo();
  const sc = mkdtempSync(join(tmpdir(), 'sc-'));
  // both features share ancestry with the worktree branch (branched from master)
  g(repo, 'branch', 'feature/a');
  g(repo, 'branch', 'feature/b');
  writeState(sc, 'feature/a', {
    feature_branch: 'feature/a', status: 'in_progress', worktrees: {},
    worktree_overrides: { 'worktree-shared': 'feature/a' },
  });
  writeState(sc, 'feature/b', {
    feature_branch: 'feature/b', status: 'in_progress', worktrees: {},
  });
  const wt = join(repo, '..', `wt-s-${Date.now()}`);
  g(repo, 'worktree', 'add', wt, '-b', 'worktree-shared', 'master');
  const res = reconcile(sc, { prefix: 'worktree-', cwd: repo });
  assert.ok(readState(sc, 'feature/a').worktrees['worktree-shared']);
  assert.ok(!readState(sc, 'feature/b').worktrees['worktree-shared']);
  assert.equal(res.conflicts.length, 0);
  g(repo, 'worktree', 'remove', wt, '--force');
  rmSync(repo, { recursive: true, force: true });
  rmSync(sc, { recursive: true, force: true });
});

test('advances pr_open to completed when queryPr returns MERGED', () => {
  const repo = makeRepo();
  const sc = mkdtempSync(join(tmpdir(), 'sc-'));
  writeState(sc, 'feature/p', {
    feature_branch: 'feature/p', status: 'in_progress',
    worktrees: { 'worktree-p': { status: 'pr_open', pr_number: 42 } },
  });
  const res = reconcile(sc, {
    prefix: 'worktree-', cwd: repo, queryPr: () => 'MERGED',
  });
  assert.equal(readState(sc, 'feature/p').worktrees['worktree-p'].status, 'completed');
  assert.equal(res.advanced[0].to, 'completed');
  rmSync(repo, { recursive: true, force: true });
  rmSync(sc, { recursive: true, force: true });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/reconcile.test.mjs`
Expected: FAIL —— module not found

- [ ] **Step 3: 实现 reconcile.mjs**

创建 `.claude/speccode/lib/reconcile.mjs`:

```javascript
import { listActiveFeatures, writeState, WORKTREE_STATUS } from './state.mjs';
import { worktreeList, isAncestor } from './git.mjs';
import { nowIso } from './timestamp.mjs';

export function reconcile(speccodeDir, opts = {}) {
  const { prefix = 'worktree-', cwd, queryPr } = opts;
  const features = listActiveFeatures(speccodeDir);
  const dirty = new Set();

  // git 中所有 prefix worktree 分支
  const gitWorktreeBranches = worktreeList(cwd)
    .map((w) => w.branch)
    .filter((b) => b && b.startsWith(prefix));
  const gitSet = new Set(gitWorktreeBranches);

  const orphans = [];
  const conflicts = [];
  const advanced = [];

  // 3. state 登记但 git 缺失 → orphan
  for (const st of features) {
    for (const wt of Object.keys(st.worktrees || {})) {
      if (!gitSet.has(wt)) orphans.push(wt);
    }
  }

  // 4. git 有但未登记 → override / ancestry 归属
  const registered = new Set(
    features.flatMap((st) => Object.keys(st.worktrees || {})),
  );
  for (const wt of gitWorktreeBranches) {
    if (registered.has(wt)) continue;

    const overrideOwner = features.find(
      (st) => st.worktree_overrides && st.worktree_overrides[wt],
    );
    if (overrideOwner) {
      overrideOwner.worktrees[wt] = { status: WORKTREE_STATUS.IN_PROGRESS };
      dirty.add(overrideOwner.feature_branch);
      registered.add(wt);
      continue;
    }

    const owners = features.filter((st) => isAncestor(st.feature_branch, wt, cwd));
    if (owners.length === 1) {
      owners[0].worktrees[wt] = { status: WORKTREE_STATUS.IN_PROGRESS };
      dirty.add(owners[0].feature_branch);
      registered.add(wt);
    } else if (owners.length >= 2) {
      conflicts.push({ worktree: wt, features: owners.map((o) => o.feature_branch) });
    } else {
      orphans.push(wt);
    }
  }

  // 5. pr_open 推进
  if (typeof queryPr === 'function') {
    for (const st of features) {
      for (const [wt, entry] of Object.entries(st.worktrees || {})) {
        if (entry.status === WORKTREE_STATUS.PR_OPEN && entry.pr_number != null) {
          const s = queryPr(entry.pr_number);
          if (s === 'MERGED') {
            entry.status = WORKTREE_STATUS.COMPLETED;
            entry.completed_at = nowIso();
            advanced.push({ worktree: wt, from: 'pr_open', to: 'completed' });
            dirty.add(st.feature_branch);
          } else if (s === 'CLOSED') {
            entry.status = WORKTREE_STATUS.IN_PROGRESS;
            advanced.push({ worktree: wt, from: 'pr_open', to: 'in_progress' });
            dirty.add(st.feature_branch);
          }
        }
      }
    }
  }

  // 6. 写回被修改的 state
  for (const st of features) {
    if (dirty.has(st.feature_branch)) writeState(speccodeDir, st.feature_branch, st);
  }

  return { features, orphans, conflicts, advanced };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/reconcile.test.mjs`
Expected: PASS —— 4 tests pass

- [ ] **Step 5: 提交**

```bash
git add .claude/speccode/lib/reconcile.mjs tests/reconcile.test.mjs
git commit -m "feat(speccode): reconcile algorithm (ancestry/override/orphan/pr_open advance)"
```

---

### Task 6: pr-tool 探测与封装

**Files:**
- Create: `.claude/speccode/lib/prtool.mjs`
- Test: `tests/prtool.test.mjs`

**Interfaces:**
- Produces:
  - `detectPrToolFromUrl(url: string): 'gh'|'glab'|'none'` — 纯函数,URL 含 `github.com`→gh,含 `gitlab`→glab,否则 none
  - `isInstalled(tool: string): boolean` — `command -v` 探测(spawnSync `sh -c`)
  - `createPrArgs(tool, { base, head, title, body }): string[]` — 返回给 gh/glab 的 argv(纯函数,便于测试)
  - `queryPrArgs(tool, head): string[]` — 返回查询 argv(纯函数)
  - `parsePrState(tool, jsonStdout): 'MERGED'|'OPEN'|'CLOSED'|'UNKNOWN'` — 解析 gh/glab JSON 输出为统一状态

- [ ] **Step 1: 写失败测试**

创建 `tests/prtool.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectPrToolFromUrl, createPrArgs, queryPrArgs, parsePrState,
} from '../.claude/speccode/lib/prtool.mjs';

test('detectPrToolFromUrl maps hosts', () => {
  assert.equal(detectPrToolFromUrl('git@github.com:foo/bar.git'), 'gh');
  assert.equal(detectPrToolFromUrl('https://gitlab.com/foo/bar.git'), 'glab');
  assert.equal(detectPrToolFromUrl('git@bitbucket.org:foo/bar.git'), 'none');
});

test('createPrArgs for gh', () => {
  const args = createPrArgs('gh', { base: 'display', head: 'feature/x', title: 'T', body: 'B' });
  assert.deepEqual(args, [
    'pr', 'create', '--base', 'display', '--head', 'feature/x', '--title', 'T', '--body', 'B',
  ]);
});

test('createPrArgs for glab', () => {
  const args = createPrArgs('glab', { base: 'display', head: 'worktree-x', title: 'T', body: 'B' });
  assert.deepEqual(args, [
    'mr', 'create', '--target-branch', 'display', '--source-branch', 'worktree-x',
    '--title', 'T', '--description', 'B',
  ]);
});

test('queryPrArgs for gh and glab', () => {
  assert.deepEqual(queryPrArgs('gh', 'feature/x'),
    ['pr', 'view', 'feature/x', '--json', 'state,mergedAt,mergeCommit']);
  assert.deepEqual(queryPrArgs('glab', 'feature/x'),
    ['mr', 'view', 'feature/x', '--output', 'json']);
});

test('parsePrState gh', () => {
  assert.equal(parsePrState('gh', '{"state":"MERGED","mergedAt":"2026-07-10T00:00:00Z"}'), 'MERGED');
  assert.equal(parsePrState('gh', '{"state":"OPEN","mergedAt":null}'), 'OPEN');
  assert.equal(parsePrState('gh', '{"state":"CLOSED","mergedAt":null}'), 'CLOSED');
});

test('parsePrState glab', () => {
  assert.equal(parsePrState('glab', '{"state":"merged"}'), 'MERGED');
  assert.equal(parsePrState('glab', '{"state":"opened"}'), 'OPEN');
  assert.equal(parsePrState('glab', '{"state":"closed"}'), 'CLOSED');
});

test('parsePrState unknown on garbage', () => {
  assert.equal(parsePrState('gh', 'not json'), 'UNKNOWN');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/prtool.test.mjs`
Expected: FAIL —— module not found

- [ ] **Step 3: 实现 prtool.mjs**

创建 `.claude/speccode/lib/prtool.mjs`:

```javascript
import { spawnSync } from 'node:child_process';

export function detectPrToolFromUrl(url) {
  if (typeof url !== 'string') return 'none';
  if (url.includes('github.com')) return 'gh';
  if (url.includes('gitlab')) return 'glab';
  return 'none';
}

export function isInstalled(tool) {
  if (tool === 'none') return false;
  const r = spawnSync('sh', ['-c', `command -v ${tool}`], { encoding: 'utf8' });
  return r.status === 0;
}

export function createPrArgs(tool, { base, head, title, body }) {
  if (tool === 'gh') {
    return ['pr', 'create', '--base', base, '--head', head, '--title', title, '--body', body];
  }
  if (tool === 'glab') {
    return ['mr', 'create', '--target-branch', base, '--source-branch', head,
      '--title', title, '--description', body];
  }
  throw new Error(`unsupported pr_tool: ${tool}`);
}

export function queryPrArgs(tool, head) {
  if (tool === 'gh') return ['pr', 'view', head, '--json', 'state,mergedAt,mergeCommit'];
  if (tool === 'glab') return ['mr', 'view', head, '--output', 'json'];
  throw new Error(`unsupported pr_tool: ${tool}`);
}

export function parsePrState(tool, jsonStdout) {
  let obj;
  try { obj = JSON.parse(jsonStdout); } catch { return 'UNKNOWN'; }
  const raw = String(obj.state ?? '').toUpperCase();
  if (tool === 'gh') {
    if (raw === 'MERGED') return 'MERGED';
    if (raw === 'OPEN') return 'OPEN';
    if (raw === 'CLOSED') return 'CLOSED';
    return 'UNKNOWN';
  }
  if (tool === 'glab') {
    if (raw === 'MERGED') return 'MERGED';
    if (raw === 'OPENED') return 'OPEN';
    if (raw === 'CLOSED') return 'CLOSED';
    return 'UNKNOWN';
  }
  return 'UNKNOWN';
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/prtool.test.mjs`
Expected: PASS —— 7 tests pass

- [ ] **Step 5: 提交**

```bash
git add .claude/speccode/lib/prtool.mjs tests/prtool.test.mjs
git commit -m "feat(speccode): pr-tool detection + gh/glab arg builders + state parse"
```

---

### Task 7: wait_for_pr_merge 轮询循环

**Files:**
- Create: `.claude/speccode/lib/waitmerge.mjs`
- Test: `tests/waitmerge.test.mjs`

**Interfaces:**
- Consumes: 无(依赖注入 query/sleep,便于测试)
- Produces:
  - `waitForPrMerge({ query, sleep, intervalMs, timeoutMs }): Promise<{ outcome, polls }>` —
    - `query(): Promise<'MERGED'|'OPEN'|'CLOSED'|'CONFLICTING'|'UNKNOWN'>` 注入
    - `sleep(ms): Promise<void>` 注入(默认真实 setTimeout)
    - `intervalMs`(默认 30000),`timeoutMs`(默认 1800000)
    - 循环:query → MERGED 返回 `{outcome:'MERGED'}`;CLOSED/CONFLICTING 立即返回该 outcome;OPEN/UNKNOWN → sleep(interval),累计超 timeout 返回 `{outcome:'TIMEOUT'}`

- [ ] **Step 1: 写失败测试**

创建 `tests/waitmerge.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitForPrMerge } from '../.claude/speccode/lib/waitmerge.mjs';

const noSleep = () => Promise.resolve();

test('returns MERGED as soon as query reports merged', async () => {
  let calls = 0;
  const query = async () => { calls += 1; return calls >= 2 ? 'MERGED' : 'OPEN'; };
  const r = await waitForPrMerge({ query, sleep: noSleep, intervalMs: 1, timeoutMs: 1000 });
  assert.equal(r.outcome, 'MERGED');
  assert.equal(r.polls, 2);
});

test('returns CLOSED immediately', async () => {
  const r = await waitForPrMerge({ query: async () => 'CLOSED', sleep: noSleep, intervalMs: 1, timeoutMs: 1000 });
  assert.equal(r.outcome, 'CLOSED');
});

test('returns CONFLICTING immediately', async () => {
  const r = await waitForPrMerge({ query: async () => 'CONFLICTING', sleep: noSleep, intervalMs: 1, timeoutMs: 1000 });
  assert.equal(r.outcome, 'CONFLICTING');
});

test('times out when never merges', async () => {
  // timeoutMs smaller than intervalMs => times out after first sleep
  const r = await waitForPrMerge({ query: async () => 'OPEN', sleep: noSleep, intervalMs: 100, timeoutMs: 50 });
  assert.equal(r.outcome, 'TIMEOUT');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/waitmerge.test.mjs`
Expected: FAIL —— module not found

- [ ] **Step 3: 实现 waitmerge.mjs**

创建 `.claude/speccode/lib/waitmerge.mjs`:

```javascript
const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function waitForPrMerge(opts = {}) {
  const {
    query,
    sleep = realSleep,
    intervalMs = 30000,
    timeoutMs = 1800000,
  } = opts;

  let elapsed = 0;
  let polls = 0;
  for (;;) {
    polls += 1;
    const state = await query();
    if (state === 'MERGED') return { outcome: 'MERGED', polls };
    if (state === 'CLOSED') return { outcome: 'CLOSED', polls };
    if (state === 'CONFLICTING') return { outcome: 'CONFLICTING', polls };
    if (elapsed >= timeoutMs) return { outcome: 'TIMEOUT', polls };
    await sleep(intervalMs);
    elapsed += intervalMs;
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/waitmerge.test.mjs`
Expected: PASS —— 4 tests pass

- [ ] **Step 5: 提交**

```bash
git add .claude/speccode/lib/waitmerge.mjs tests/waitmerge.test.mjs
git commit -m "feat(speccode): wait_for_pr_merge polling loop with injected query/sleep"
```

---

### Task 8: 文档剥离/备份/重跟踪

**Files:**
- Create: `.claude/speccode/lib/docstrip.mjs`
- Test: `tests/docstrip.test.mjs`

**Interfaces:**
- Consumes: `git.git`(Task 4)
- Produces:
  - `enabledDocDirs(config): string[]` — 从 `config.spec_tools` 取 `enabled=true` 的 `doc_dir` 列表
  - `existingTrackedDirs(dirs, cwd): string[]` — 过滤出在 git 中被 tracked 的目录(`git ls-files <dir>` 非空)
  - `existingWorkingDirs(dirs, cwd): string[]` — 过滤出工作区实际存在的目录
  - `stripDocs(dirs, cwd): void` — 对每个存在的 dir 执行 `git rm -r --cached <dir>`(仅对 tracked 的)
  - `retrackDocs(dirs, cwd): void` — 对每个工作区存在的 dir 执行 `git add <dir>`
  - `backupDocs(dirs, cwd, backupDir): string[]` — 把工作区存在的 dir 复制到 backupDir,返回已备份的 dir 列表

- [ ] **Step 1: 写失败测试**

创建 `tests/docstrip.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeRepo, commitFile } from './helpers/tmprepo.mjs';
import {
  enabledDocDirs, existingTrackedDirs, existingWorkingDirs, stripDocs, retrackDocs, backupDocs,
} from '../.claude/speccode/lib/docstrip.mjs';

function tracked(repo, path) {
  const r = spawnSync('git', ['ls-files', path], { cwd: repo, encoding: 'utf8' });
  return r.stdout.trim().length > 0;
}

test('enabledDocDirs picks enabled tools only', () => {
  const cfg = { spec_tools: {
    openspec: { enabled: true, doc_dir: 'openspec' },
    superpowers: { enabled: false, doc_dir: 'docs/superpowers' },
  } };
  assert.deepEqual(enabledDocDirs(cfg), ['openspec']);
});

test('stripDocs untracks but keeps working file', () => {
  const repo = makeRepo();
  commitFile(repo, 'openspec/spec.md', '# spec', 'add spec');
  assert.ok(tracked(repo, 'openspec'));
  stripDocs(['openspec'], repo);
  assert.ok(!tracked(repo, 'openspec'));
  assert.ok(existsSync(join(repo, 'openspec', 'spec.md'))); // file preserved
  rmSync(repo, { recursive: true, force: true });
});

test('existingTrackedDirs / existingWorkingDirs filter correctly', () => {
  const repo = makeRepo();
  commitFile(repo, 'openspec/spec.md', '# spec', 'add spec');
  assert.deepEqual(existingTrackedDirs(['openspec', 'docs/superpowers'], repo), ['openspec']);
  assert.deepEqual(existingWorkingDirs(['openspec', 'docs/superpowers'], repo), ['openspec']);
  rmSync(repo, { recursive: true, force: true });
});

test('backupDocs copies working dirs into backup dir', () => {
  const repo = makeRepo();
  commitFile(repo, 'openspec/spec.md', '# spec', 'add spec');
  const backup = mkdtempSync(join(tmpdir(), 'sc-bak-'));
  const done = backupDocs(['openspec'], repo, backup);
  assert.deepEqual(done, ['openspec']);
  assert.ok(existsSync(join(backup, 'openspec', 'spec.md')));
  rmSync(repo, { recursive: true, force: true });
  rmSync(backup, { recursive: true, force: true });
});

test('retrackDocs re-adds after untrack', () => {
  const repo = makeRepo();
  commitFile(repo, 'openspec/spec.md', '# spec', 'add spec');
  stripDocs(['openspec'], repo);
  assert.ok(!tracked(repo, 'openspec'));
  retrackDocs(['openspec'], repo);
  // staged now — ls-files shows it
  assert.ok(tracked(repo, 'openspec'));
  rmSync(repo, { recursive: true, force: true });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/docstrip.test.mjs`
Expected: FAIL —— module not found

- [ ] **Step 3: 实现 docstrip.mjs**

创建 `.claude/speccode/lib/docstrip.mjs`:

```javascript
import { existsSync, cpSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { git } from './git.mjs';

export function enabledDocDirs(config) {
  const tools = config.spec_tools || {};
  return Object.values(tools)
    .filter((t) => t && t.enabled && t.doc_dir)
    .map((t) => t.doc_dir);
}

export function existingTrackedDirs(dirs, cwd) {
  return dirs.filter((d) => git(['ls-files', d], { cwd, allowFail: true }).stdout.trim().length > 0);
}

export function existingWorkingDirs(dirs, cwd) {
  return dirs.filter((d) => existsSync(join(cwd ?? '.', d)));
}

export function stripDocs(dirs, cwd) {
  for (const d of existingTrackedDirs(dirs, cwd)) {
    git(['rm', '-r', '--cached', d], { cwd });
  }
}

export function retrackDocs(dirs, cwd) {
  for (const d of existingWorkingDirs(dirs, cwd)) {
    git(['add', d], { cwd });
  }
}

export function backupDocs(dirs, cwd, backupDir) {
  const done = [];
  for (const d of existingWorkingDirs(dirs, cwd)) {
    const src = join(cwd ?? '.', d);
    const dest = join(backupDir, d);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest, { recursive: true });
    done.push(d);
  }
  return done;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/docstrip.test.mjs`
Expected: PASS —— 5 tests pass

- [ ] **Step 5: 提交**

```bash
git add .claude/speccode/lib/docstrip.mjs tests/docstrip.test.mjs
git commit -m "feat(speccode): doc strip/backup/retrack primitives"
```

---

### Task 9: config 模块(加载/保存/字段级幂等合并)

**Files:**
- Create: `.claude/speccode/lib/config.mjs`
- Test: `tests/config.test.mjs`

**Interfaces:**
- Consumes: `atomic.readJson/writeJsonAtomic`(Task 1),`timestamp.nowIso`(Task 1)
- Produces:
  - `DEFAULT_UNTRACKED: string[]` — `['.claude', '.agent', '.opencode', '.speccode', 'CLAUDE.md', 'AGENTS.md']`
  - `configPath(speccodeDir): string` — `<speccodeDir>/config.json`
  - `loadConfig(speccodeDir): object | null`
  - `saveConfig(speccodeDir, config): void`
  - `backupConfig(speccodeDir): string | null` — 复制 config.json 到 `config.json.bak.<isoStamp>`(冒号替换为 `-` 以适配文件名),返回备份路径;无 config 返回 null
  - `diffFields(oldCfg, newCfg): { key, old, new }[]` — 逐字段列出差异(用于二次 init 的 `[旧值]→[新值]` 展示)

- [ ] **Step 1: 写失败测试**

创建 `tests/config.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_UNTRACKED, configPath, loadConfig, saveConfig, backupConfig, diffFields,
} from '../.claude/speccode/lib/config.mjs';

function tmp() { return mkdtempSync(join(tmpdir(), 'sc-cfg-')); }

test('DEFAULT_UNTRACKED lists the permanent set', () => {
  assert.deepEqual(DEFAULT_UNTRACKED,
    ['.claude', '.agent', '.opencode', '.speccode', 'CLAUDE.md', 'AGENTS.md']);
});

test('save then load round-trips', () => {
  const dir = tmp();
  const cfg = { version: 1, trunk: 'master', remote: 'origin' };
  saveConfig(dir, cfg);
  assert.deepEqual(loadConfig(dir), cfg);
  rmSync(dir, { recursive: true, force: true });
});

test('loadConfig null when absent', () => {
  const dir = tmp();
  assert.equal(loadConfig(dir), null);
  rmSync(dir, { recursive: true, force: true });
});

test('backupConfig creates a .bak file and returns null when no config', () => {
  const dir = tmp();
  assert.equal(backupConfig(dir), null);
  saveConfig(dir, { version: 1 });
  const p = backupConfig(dir);
  assert.ok(p && existsSync(p));
  assert.ok(readdirSync(dir).some((f) => f.startsWith('config.json.bak.')));
  rmSync(dir, { recursive: true, force: true });
});

test('diffFields reports changed/added/removed top-level keys', () => {
  const d = diffFields(
    { trunk: 'master', pr_tool: 'gh', remote: 'origin' },
    { trunk: 'main', pr_tool: 'gh', display: { enabled: true } },
  );
  const byKey = Object.fromEntries(d.map((x) => [x.key, x]));
  assert.deepEqual(byKey.trunk, { key: 'trunk', old: 'master', new: 'main' });
  assert.ok('remote' in byKey && byKey.remote.new === undefined);
  assert.ok('display' in byKey && byKey.display.old === undefined);
  assert.ok(!('pr_tool' in byKey)); // unchanged omitted
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/config.test.mjs`
Expected: FAIL —— module not found

- [ ] **Step 3: 实现 config.mjs**

创建 `.claude/speccode/lib/config.mjs`:

```javascript
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeJsonAtomic } from './atomic.mjs';
import { nowIso } from './timestamp.mjs';

export const DEFAULT_UNTRACKED = [
  '.claude', '.agent', '.opencode', '.speccode', 'CLAUDE.md', 'AGENTS.md',
];

export function configPath(speccodeDir) {
  return join(speccodeDir, 'config.json');
}

export function loadConfig(speccodeDir) {
  return readJson(configPath(speccodeDir));
}

export function saveConfig(speccodeDir, config) {
  writeJsonAtomic(configPath(speccodeDir), config);
}

export function backupConfig(speccodeDir) {
  const p = configPath(speccodeDir);
  if (!existsSync(p)) return null;
  const stamp = nowIso().replace(/:/g, '-');
  const dest = `${p}.bak.${stamp}`;
  copyFileSync(p, dest);
  return dest;
}

export function diffFields(oldCfg, newCfg) {
  const keys = new Set([...Object.keys(oldCfg || {}), ...Object.keys(newCfg || {})]);
  const out = [];
  for (const key of keys) {
    const o = (oldCfg || {})[key];
    const n = (newCfg || {})[key];
    if (JSON.stringify(o) !== JSON.stringify(n)) {
      out.push({ key, old: o, new: n });
    }
  }
  return out;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/config.test.mjs`
Expected: PASS —— 5 tests pass

- [ ] **Step 5: 提交**

```bash
git add .claude/speccode/lib/config.mjs tests/config.test.mjs
git commit -m "feat(speccode): config load/save/backup + field diff for idempotent init"
```

---

## Phase 2 — CLI verb 分发

### Task 10: bin/speccode.mjs verb 分发器

CLI 是命令 markdown 与 lib 之间的桥:命令 md 调 `node .claude/speccode/bin/speccode.mjs <verb> [--flags]`,verb 输出**单行 JSON** 到 stdout,md 解析该 JSON 决定下一步。

**Files:**
- Create: `.claude/speccode/bin/speccode.mjs`
- Test: `tests/cli.test.mjs`

**Interfaces:**
- Consumes: 全部 lib 模块
- Produces (CLI verbs,均输出 JSON `{ ok: boolean, ... }`):
  - `resolve-speccode-dir --cwd <dir>` → `{ ok, speccodeDir }`(定位 `<gitroot>/.speccode`)
  - `detect-remote --cwd <dir>` → `{ ok, remote, url, prToolGuess, installed }`
  - `reconcile --cwd <dir>` → `{ ok, orphans, conflicts, advanced, features }`
  - `read-config --cwd <dir>` → `{ ok, config }`
  - `write-config --cwd <dir> --json-stdin` → `{ ok }`(从 stdin 读整个 config JSON,`saveConfig` 原子写)
  - `write-state --cwd <dir> --branch <b> --json-stdin` → `{ ok }`(从 stdin 读 state JSON,`writeState` 原子写)
  - `delete-state --cwd <dir> --branch <b>` → `{ ok }`(`deleteState`)
  - `backup-config --cwd <dir>` → `{ ok, path }`(`backupConfig`)
  - `feature-progress --cwd <dir> --branch <b>` → `{ ok, total, completed, worktrees }`
  - `parseArgs(argv): { verb, flags }` — 纯函数,`--k v` / `--k=v` / bool `--flag`
- CLI 约定:未知 verb / 抛错 → 输出 `{ ok: false, error }` 且 `process.exitCode = 1`
- 写类 verb 从 **stdin** 读 JSON(`--json-stdin`),避免超长 argv 与转义问题;命令 md 用 `echo '<json>' | node speccode.mjs write-state ...` 调用

- [ ] **Step 1: 写失败测试**

创建 `tests/cli.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeRepo } from './helpers/tmprepo.mjs';
import { parseArgs } from '../.claude/speccode/bin/speccode.mjs';

const BIN = join(process.cwd(), '.claude/speccode/bin/speccode.mjs');

function runCli(cwd, ...args) {
  const r = spawnSync('node', [BIN, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, json: JSON.parse(r.stdout.trim()) };
}

test('parseArgs handles --k v, --k=v, and bool flags', () => {
  const { verb, flags } = parseArgs(['reconcile', '--cwd', '/x', '--json=1', '--force']);
  assert.equal(verb, 'reconcile');
  assert.equal(flags.cwd, '/x');
  assert.equal(flags.json, '1');
  assert.equal(flags.force, true);
});

test('resolve-speccode-dir returns <gitroot>/.speccode', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'resolve-speccode-dir', '--cwd', repo);
  assert.equal(code, 0);
  assert.ok(json.ok);
  assert.ok(json.speccodeDir.endsWith('/.speccode'));
  rmSync(repo, { recursive: true, force: true });
});

test('reconcile verb on empty repo returns ok with empty arrays', () => {
  const repo = makeRepo();
  mkdirSync(join(repo, '.speccode', 'state', 'features'), { recursive: true });
  const { code, json } = runCli(repo, 'reconcile', '--cwd', repo);
  assert.equal(code, 0);
  assert.ok(json.ok);
  assert.deepEqual(json.orphans, []);
  assert.deepEqual(json.conflicts, []);
  rmSync(repo, { recursive: true, force: true });
});

test('unknown verb returns ok:false and exit 1', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'bogus-verb', '--cwd', repo);
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  rmSync(repo, { recursive: true, force: true });
});

test('write-config reads stdin and persists atomically', () => {
  const repo = makeRepo();
  const cfg = JSON.stringify({ version: 1, trunk: 'master' });
  const w = spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: cfg, encoding: 'utf8' });
  assert.equal(w.status, 0);
  assert.ok(JSON.parse(w.stdout.trim()).ok);
  const r = runCli(repo, 'read-config', '--cwd', repo);
  assert.equal(r.json.config.trunk, 'master');
  rmSync(repo, { recursive: true, force: true });
});

test('write-state then feature-progress reflects it', () => {
  const repo = makeRepo();
  const state = JSON.stringify({
    feature_branch: 'feature/demo', status: 'in_progress',
    worktrees: { 'worktree-demo': { status: 'completed', completed_at: '2026-07-10T00:00:00.000Z' } },
  });
  const w = spawnSync('node',
    [BIN, 'write-state', '--cwd', repo, '--branch', 'feature/demo', '--json-stdin'],
    { cwd: repo, input: state, encoding: 'utf8' });
  assert.equal(w.status, 0);
  const r = runCli(repo, 'feature-progress', '--cwd', repo, '--branch', 'feature/demo');
  assert.equal(r.json.total, 1);
  assert.equal(r.json.completed, 1);
  rmSync(repo, { recursive: true, force: true });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/cli.test.mjs`
Expected: FAIL —— module not found

- [ ] **Step 3: 实现 bin/speccode.mjs**

创建 `.claude/speccode/bin/speccode.mjs`:

```javascript
#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { git } from '../lib/git.mjs';
import { detectPrToolFromUrl, isInstalled } from '../lib/prtool.mjs';
import { reconcile } from '../lib/reconcile.mjs';
import { loadConfig, saveConfig, backupConfig } from '../lib/config.mjs';
import { readState, writeState, deleteState, WORKTREE_STATUS } from '../lib/state.mjs';

function readStdin() {
  return readFileSync(0, 'utf8');
}

export function parseArgs(argv) {
  const [verb, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const tok = rest[i];
    if (!tok.startsWith('--')) continue;
    const body = tok.slice(2);
    const eq = body.indexOf('=');
    if (eq !== -1) {
      flags[body.slice(0, eq)] = body.slice(eq + 1);
    } else if (i + 1 < rest.length && !rest[i + 1].startsWith('--')) {
      flags[body] = rest[i + 1];
      i += 1;
    } else {
      flags[body] = true;
    }
  }
  return { verb, flags };
}

function gitRoot(cwd) {
  return git(['rev-parse', '--show-toplevel'], { cwd }).stdout.trim();
}

function speccodeDirOf(cwd) {
  return join(gitRoot(cwd), '.speccode');
}

const VERBS = {
  'resolve-speccode-dir': ({ cwd }) => ({ ok: true, speccodeDir: speccodeDirOf(cwd) }),

  'detect-remote': ({ cwd }) => {
    const remote = 'origin';
    const r = git(['remote', 'get-url', remote], { cwd, allowFail: true });
    const url = r.code === 0 ? r.stdout.trim() : '';
    const guess = detectPrToolFromUrl(url);
    return { ok: true, remote, url, prToolGuess: guess, installed: isInstalled(guess) };
  },

  reconcile: ({ cwd }) => {
    const sc = speccodeDirOf(cwd);
    const res = reconcile(sc, { prefix: 'worktree-', cwd });
    return { ok: true, orphans: res.orphans, conflicts: res.conflicts, advanced: res.advanced,
      features: res.features };
  },

  'read-config': ({ cwd }) => ({ ok: true, config: loadConfig(speccodeDirOf(cwd)) }),

  'write-config': ({ cwd }) => {
    const cfg = JSON.parse(readStdin());
    saveConfig(speccodeDirOf(cwd), cfg);
    return { ok: true };
  },

  'backup-config': ({ cwd }) => ({ ok: true, path: backupConfig(speccodeDirOf(cwd)) }),

  'write-state': ({ cwd, branch }) => {
    const st = JSON.parse(readStdin());
    writeState(speccodeDirOf(cwd), branch, st);
    return { ok: true };
  },

  'delete-state': ({ cwd, branch }) => {
    deleteState(speccodeDirOf(cwd), branch);
    return { ok: true };
  },

  'feature-progress': ({ cwd, branch }) => {
    const st = readState(speccodeDirOf(cwd), branch);
    if (!st) return { ok: false, error: `no state for ${branch}` };
    const wts = st.worktrees || {};
    const total = Object.keys(wts).length;
    const completed = Object.values(wts)
      .filter((w) => w.status === WORKTREE_STATUS.COMPLETED).length;
    return { ok: true, total, completed, worktrees: wts };
  },
};

function main() {
  const { verb, flags } = parseArgs(process.argv.slice(2));
  const handler = VERBS[verb];
  if (!handler) {
    process.exitCode = 1;
    process.stdout.write(JSON.stringify({ ok: false, error: `unknown verb: ${verb}` }) + '\n');
    return;
  }
  try {
    const result = handler(flags);
    if (result.ok === false) process.exitCode = 1;
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (err) {
    process.exitCode = 1;
    process.stdout.write(JSON.stringify({ ok: false, error: String(err.message || err) }) + '\n');
  }
}

// only run main when invoked as a script, not when imported by tests
if (process.argv[1] && process.argv[1].endsWith('speccode.mjs')) main();
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/cli.test.mjs`
Expected: PASS —— 4 tests pass

- [ ] **Step 5: 全量测试回归**

Run: `node --test tests/`
Expected: PASS —— 所有测试文件通过

- [ ] **Step 6: 提交**

```bash
git add .claude/speccode/bin/speccode.mjs tests/cli.test.mjs
git commit -m "feat(speccode): CLI verb dispatcher (resolve/detect/reconcile/config/progress)"
```

---

## Phase 3 — 命令 markdown(交互层)

命令文件是 Claude Code slash command。每个文件是 frontmatter + prose 指令,告诉 AI:何时提问、调哪个 CLI verb、如何解析 JSON、如何报告。命令层**不重复实现**确定性逻辑,一律委托给 `node .claude/speccode/bin/speccode.mjs <verb>`。这些任务没有 `node:test` 单测(交互层),用"文件存在 + frontmatter 合法 + 引用的 verb 都在 CLI 中存在"作为验收。

通用 frontmatter 格式(对齐 opsx 风格):
```markdown
---
name: "SpecCode: <Cmd>"
description: "<one-line>"
category: Workflow
tags: [speccode, workflow]
---
```

### Task 11: init 与 start 命令

**Files:**
- Create: `.claude/commands/speccode/init.md`
- Create: `.claude/commands/speccode/start.md`

**Interfaces:**
- Consumes: CLI verbs `resolve-speccode-dir`、`detect-remote`、`read-config`(Task 10);lib 概念:`DEFAULT_UNTRACKED`、`backupConfig`、`diffFields`、slug 校验

- [ ] **Step 1: 写 init.md**

创建 `.claude/commands/speccode/init.md`:

````markdown
---
name: "SpecCode: Init"
description: "初始化 speccode 开发环境:探测远端、主干、标的分支、spec 工具,写 .speccode/config.json"
category: Workflow
tags: [speccode, workflow, init]
---

初始化或更新 speccode 配置。全程用中文与用户交互。

## 前置

运行 `node .claude/speccode/bin/speccode.mjs resolve-speccode-dir --cwd .` 获取 `speccodeDir`。
运行 `node .claude/speccode/bin/speccode.mjs read-config --cwd .` 判断是否已初始化:
- `config` 为 null → 全新 init(走"全新流程")
- `config` 非 null → 二次 init(走"幂等流程")

## 全新流程

1. **探测远端与 pr_tool**:运行 `speccode.mjs detect-remote --cwd .`,得到 `prToolGuess` 与 `installed`。
   - 若 `installed=false` 且 `prToolGuess≠none`:告知用户"探测到应使用 <tool>,但未检测到该 CLI",询问是否降级为 `none`。
   - 用 AskUserQuestion 确认最终 `pr_tool`(gh / glab / none)。
2. **探测主干分支**:运行 `git symbolic-ref refs/remotes/origin/HEAD`(失败则回退询问);默认填 `trunk`,请用户确认。
3. **询问标的分支**:是否需要 display?
   - 否 → `display = { enabled: false, branch: null }`。
   - 是 → 询问分支名(默认 `display`)。按 spec `display 分支的四态`处理:
     - 远端已存在且已关联 → `git fetch` + `git checkout <d>` + `git pull`。
     - 远端已存在未关联 → checkout + 合并主干。
     - 不存在 → 从主干 `git checkout -b <d>` + `git push -u origin <d>`。
4. **询问 spec 工具**:多选 openspec / superpowers;每个启用项询问 `doc_dir`(默认 openspec→`openspec`,superpowers→`docs/superpowers`)。
5. **询问 untracked_permanent**:展示默认集合 `.claude .agent .opencode .speccode CLAUDE.md AGENTS.md`,允许增删。
6. **组装 config** 并写入:字段含 `version:1`、`initialized_at`(用 `speccode.mjs` 无此 verb 时可让 AI 生成 ISO 时间,或直接由用户确认后写)、`trunk`、`remote`、`display`、`pr_tool`、`spec_tools`、`untracked_permanent`、`worktree_prefix:"worktree-"`。
   - 把组装好的 config JSON 通过 `echo '<json>' | node .claude/speccode/bin/speccode.mjs write-config --cwd . --json-stdin` 写入(该 verb 内部用 `saveConfig` 原子写到 `<root>/.speccode/config.json`,自动满足"临时文件 + mv")。
7. 打印 config 摘要 + 下一步指引(`/speccode:start`)。

## 幂等流程(二次 init)

1. 备份现有 config(`config.json.bak.<timestamp>`)。
2. 重新走全新流程的探测,得到"新值候选"。
3. 用 `diffFields` 逐字段比较旧/新:
   - 值未变 → 跳过。
   - 值变化 → 用 AskUserQuestion 展示 `[旧值] → [新值]`,询问"保持 / 改用新值 / 清除"。
4. `state/` 目录 MUST 不动(不读、不改、不删)。
5. 备份(`backup-config` verb),再用 `write-config --json-stdin` 写回,打印摘要。

## 约束
- 全程不修改 `.gitignore`,不删除任何本地文件。
- 写 config / state 一律通过 CLI 的 `write-config` / `write-state` verb(内部原子写),不由 AI 手写文件。
````

- [ ] **Step 2: 写 start.md**

创建 `.claude/commands/speccode/start.md`:

````markdown
---
name: "SpecCode: Start"
description: "从初始分支(display 优先,否则 trunk)切出功能分支并推送,登记 state"
category: Workflow
tags: [speccode, workflow, start]
---

创建一个新的功能分支。全程中文交互。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. 计算 initial 分支:`display.enabled` 为真 → `display.branch`,否则 `trunk`。
3. 校验当前 HEAD(`git rev-parse --abbrev-ref HEAD`)必须等于 initial 分支;不符 → 提示 `git checkout <initial>` 后退出。

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

1. `git checkout -b <branch>`(从 initial 分支)。
2. `git push -u origin <branch>`。
3. 写 state:通过 `echo '<json>' | node .claude/speccode/bin/speccode.mjs write-state --cwd . --branch <branch> --json-stdin`,内容含 `feature_branch`、`created_at`(ISO UTC)、`initial_branch`、`status:"in_progress"`、`worktrees:{}`。
4. 打印:已创建 <branch>,下一步 `/speccode:develop-start`。
````

- [ ] **Step 3: 验证 frontmatter 与文件存在**

Run: `head -6 .claude/commands/speccode/init.md .claude/commands/speccode/start.md`
Expected: 两个文件都以 `---` frontmatter 起头,含 name/description/category。

- [ ] **Step 4: 提交**

```bash
git add .claude/commands/speccode/init.md .claude/commands/speccode/start.md
git commit -m "feat(speccode): init and start commands"
```

---

### Task 12: develop-start 与 develop-complete 命令

**Files:**
- Create: `.claude/commands/speccode/develop-start.md`
- Create: `.claude/commands/speccode/develop-complete.md`

**Interfaces:**
- Consumes: CLI verbs `reconcile`、`read-config`、`feature-progress`(Task 10);lib 概念:worktree 前缀校验、`WORKTREE_STATUS`、`pr_open`、`createPrArgs`/`queryPrArgs`、`waitForPrMerge`

- [ ] **Step 1: 写 develop-start.md**

创建 `.claude/commands/speccode/develop-start.md`:

````markdown
---
name: "SpecCode: Develop Start"
description: "从功能分支切出 worktree 开发分支(git worktree),登记 state"
category: Workflow
tags: [speccode, workflow, worktree]
---

创建开发用的 worktree 分支。全程中文交互。

## 前置

1. `read-config` 加载 config。
2. HEAD 必须在功能分支(`feature/` `bugfix/` `refactor/` `chore/` 之一);否则提示退出。
3. 运行 `reconcile --cwd .`:
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
4. 打印:worktree 已创建于 `.claude/worktrees/<branch>`,请 `cd` 过去开发,完成后 `/speccode:develop-complete`。
````

- [ ] **Step 2: 写 develop-complete.md**

创建 `.claude/commands/speccode/develop-complete.md`:

````markdown
---
name: "SpecCode: Develop Complete"
description: "把 worktree 成果合并到功能分支(PR 等待 / PR 不等待 / 本地 squash),更新 state"
category: Workflow
tags: [speccode, workflow, worktree, merge]
---

完成一个 worktree 的开发并合并回功能分支。全程中文交互。支持 `--resume`。

## 前置

1. `read-config` 加载 config。
2. HEAD 必须在 worktree 分支(以 `worktree-` 开头);否则退出。
3. 运行 `reconcile --cwd .`:
   - 用返回的 features 找到当前 worktree 所属的功能分支 F;找不到 → 报错"当前 worktree 无法关联任何 active feature,请先 /speccode:start",退出。
   - `--resume`:若该 feature 的 state 有 `pending_operation.command="develop-complete"`,从其 phase 续跑。

## 询问合并方式(1 轮三选一)

用 AskUserQuestion:
1. **PR + 等待合并**(全自动化)
2. **PR + 不等待**(自己合并,后续对账推进)
3. **本地 squash merge**(快)

## 路径 1/2:PR

1. **同步 base**:`git push origin <F>`;若 non-fast-forward → 中止并提示用户处理分叉。
2. `git push -u origin <worktree>`。
3. 用 pr_tool 创建 PR:参数同 `createPrArgs`(base=F, head=worktree)。`pr_tool=none` → 打印等效命令并中止。
4. **路径 1(等待)**:轮询(`queryPrArgs` + `parsePrState`,每 30s,超时 30min):
   - MERGED → 清理:`git worktree remove .claude/worktrees/<worktree> --force` + `git branch -D <worktree>` + 询问是否删远端(`git push origin :<worktree>`);state 置 `completed` + `completed_at`。
   - CLOSED/CONFLICTING → 报错退出。
   - TIMEOUT → 写 `pending_operation`(command=develop-complete, phase=waiting_worktree_pr, pr_number),提示 `--resume`。
5. **路径 2(不等待)**:state 置 `pr_open` + 记 `pr_number`,**不清理** worktree,不阻塞。

## 路径 3:本地 squash

1. `git checkout <F>`。
2. `git merge --squash <worktree>`。
3. `git commit`(用户填 commit message,遵守 git 提交规范)。
4. `git worktree remove .claude/worktrees/<worktree> --force` + `git branch -D <worktree>`。
5. state 置 `completed` + `completed_at`。

## 收尾

1. 用 `feature-progress --branch <F>` 取进度。
2. 打印状态报告:`<F> 进度 X/Y done` + 每个 worktree 状态;若全部 completed,建议 `/speccode:finish`。

> **状态写入约定**:本命令中所有"state 置 X"(completed / pr_open / pending_operation)MUST 通过 `write-state --cwd . --branch <F> --json-stdin` verb 完成——先取当前 state(reconcile 返回或 read),改字段后整体写回。绝不由 AI 手写 JSON 文件。
````

- [ ] **Step 3: 验证 frontmatter**

Run: `head -6 .claude/commands/speccode/develop-start.md .claude/commands/speccode/develop-complete.md`
Expected: 合法 frontmatter。

- [ ] **Step 4: 提交**

```bash
git add .claude/commands/speccode/develop-start.md .claude/commands/speccode/develop-complete.md
git commit -m "feat(speccode): develop-start and develop-complete commands"
```

---

### Task 13: finish 与 status 命令

**Files:**
- Create: `.claude/commands/speccode/finish.md`
- Create: `.claude/commands/speccode/status.md`

**Interfaces:**
- Consumes: CLI verbs `reconcile`、`read-config`、`feature-progress`(Task 10);lib 概念:文档剥离(`enabledDocDirs`/`stripDocs`)、`waitForPrMerge`、`pending_operation`、`WORKTREE_STATUS`

- [ ] **Step 1: 写 finish.md**

创建 `.claude/commands/speccode/finish.md`:

````markdown
---
name: "SpecCode: Finish"
description: "收尾整个功能:PR→display(等合并)→ 剥离文档 → PR→trunk(等合并)→ 回收 -complete → 切回 display"
category: Workflow
tags: [speccode, workflow, finish]
---

完成整个功能的交付。全程中文交互。支持 `--resume`。

## 前置

1. `read-config` 加载 config。
2. HEAD 必须在功能分支;否则退出。
3. **跑对账** `reconcile --cwd .`(finish 也对账,建立在真实 git 状态上)。
4. **门禁检查**:用 `feature-progress --branch <F>`:
   - 存在任何 `pending` / `in_progress` / `pr_open` 的 worktree → 阻止,列出未完成项。
   - 对账 `orphans` 里若有本 feature 的残留 worktree → 提示先清理。
5. **未跟踪文档检查**:对 `enabledDocDirs(config)` 逐个查是否 tracked;若工作区存在但未 tracked → 警告"检测到未纳入 git 的 spec 文档,finish 后不会留存,是否先提交?"由用户决定(speccode 不主动 add/commit)。
6. `--resume`:若 state 有 `pending_operation.command="finish"`,按 `phase` 跳到对应阶段续跑。

## 判定路径

- `display.enabled=true` → 路径 A(双 PR)。
- 否则 → 路径 B(单 PR 到 trunk)。

## 路径 A(有 display)

**阶段 1 — PR→display(阻塞等合并)**
1. `git push origin <F>`。
2. pr_tool 创建 PR(base=display, head=F)。`pr_tool=none` → 打印等效命令并中止。
3. 轮询等合并(30s / 30min):
   - MERGED → 记录 display 上的 merge commit,进入阶段 2。
   - CLOSED/CONFLICTING → 报错退出。
   - TIMEOUT → 写 `pending_operation`(phase=waiting_display_pr),提示 `--resume`。

**阶段 2 — 建 -complete + 剥离文档**
4. `git checkout -b <F>-complete <display-merge-commit>`。
5. 剥离:对 `enabledDocDirs` 执行 `git rm -r --cached <doc_dir>`(仅 tracked 的)。
6. `git commit --amend --no-edit`(折叠进功能 commit)。
7. `git push -f origin <F>-complete`。

**阶段 3 — PR→trunk(阻塞等合并)**
8. pr_tool 创建 PR(base=trunk, head=<F>-complete)。
9. 轮询等合并:
   - MERGED → 进入收尾。
   - TIMEOUT → 写 `pending_operation`(phase=waiting_trunk_pr),提示 `--resume`。

## 路径 B(无 display)

从"阶段 2"开始(直接建 `<F>-complete`,base=trunk),阶段 3 的 PR 目标为 trunk。

## 收尾

1. 回收 `-complete`:`git branch -D <F>-complete` + `git push origin :<F>-complete`。
2. 删 state:`node .claude/speccode/bin/speccode.mjs delete-state --cwd . --branch <F>`。
3. `git checkout display`(存在)或 `git checkout trunk`(feature 分支保留,不删)。
4. 打印:功能已交付;若有 display,建议 `/speccode:display-merge-trunk` 同步。

> **状态写入约定**:本命令中写 `pending_operation`(超时挂起)MUST 通过 `write-state --cwd . --branch <F> --json-stdin`(取当前 state → 加 `pending_operation` 字段 → 整体写回)。`--resume` 时读回该字段决定续跑阶段。绝不由 AI 手写 JSON 文件。
````

- [ ] **Step 2: 写 status.md**

创建 `.claude/commands/speccode/status.md`:

````markdown
---
name: "SpecCode: Status"
description: "只读总览:所有 active feature 的 worktree 进度、pending_operation、config 摘要"
category: Workflow
tags: [speccode, workflow, status]
---

显示 speccode 当前全局状态。纯只读(除对账自愈外无副作用)。

## 流程

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. 跑 `reconcile --cwd .`(顺便自愈状态漂移、推进已合并的 pr_open)。
3. 用返回的 `features` 汇总:
   - 每个 feature:`<branch>(from <initial>) X/Y done`。
   - 每个 worktree 一行:状态图标 + 名称 + status。
   - 若该 feature 有 `pending_operation`,单独一行:`⏸ pending: <command>(<phase>, PR #<n>)`。
4. 报告 `orphans` / `conflicts`(若有),提示如何处理。
5. 末尾打印 config 摘要:`trunk / display / pr_tool`。
6. 若无 active feature:打印"当前无 active feature",仅显示 config 摘要。

## 输出示例(供格式参考)

```
speccode — 2 active features
● feature/payment (from display) 2/3 done
    ✓ worktree-payment           completed
    ✓ worktree-payment-api       completed
    ○ worktree-payment-dashboard in_progress
● feature/auth (from display) 0/1 done
    ⧗ worktree-auth              pr_open (PR #51)
config: trunk=master display=display pr_tool=gh
```
````

- [ ] **Step 3: 验证 frontmatter**

Run: `head -6 .claude/commands/speccode/finish.md .claude/commands/speccode/status.md`
Expected: 合法 frontmatter。

- [ ] **Step 4: 提交**

```bash
git add .claude/commands/speccode/finish.md .claude/commands/speccode/status.md
git commit -m "feat(speccode): finish and status commands"
```

---

### Task 14: display 三命令与 reset

**Files:**
- Create: `.claude/commands/speccode/display-merge-trunk.md`
- Create: `.claude/commands/speccode/display-rebase-trunk.md`
- Create: `.claude/commands/speccode/display-reset-to-trunk.md`
- Create: `.claude/commands/speccode/reset.md`

**Interfaces:**
- Consumes: CLI verbs `read-config`、`reconcile`、`resolve-speccode-dir`;lib 概念:`backupDocs`/`stripDocs`/`retrackDocs`(Task 8)、`backupConfig`(Task 9)

- [ ] **Step 1: 写 display-merge-trunk.md**

创建 `.claude/commands/speccode/display-merge-trunk.md`:

````markdown
---
name: "SpecCode: Display Merge Trunk"
description: "把主干代码 merge 到标的分支 display"
category: Workflow
tags: [speccode, workflow, display]
---

同步主干到 display。全程中文。

1. `read-config`;`display.enabled=false` → 提示"当前无标的分支"并退出。
2. HEAD 必须在 display;否则提示 `git checkout <display>`。
3. `git fetch origin`。
4. 若存在 active feature(`reconcile` 的 features 非空)→ 提示"有未完成 feature,merge 可能冲突",询问是否继续。
5. `git merge --no-ff origin/<trunk>`;冲突 → 报错,提示用户手动解决。
6. 成功 → `git push origin <display>`。
7. 打印:display 已同步主干。
````

- [ ] **Step 2: 写 display-rebase-trunk.md**

创建 `.claude/commands/speccode/display-rebase-trunk.md`:

````markdown
---
name: "SpecCode: Display Rebase Trunk"
description: "把标的分支 display 变基到主干"
category: Workflow
tags: [speccode, workflow, display]
---

把 display 变基到主干。全程中文。

1. `read-config`;`display.enabled=false` → 提示无标的分支并退出。
2. HEAD 必须在 display。
3. **警告**:rebase 会改写 display 历史,询问确认。
4. `git fetch origin` + `git rebase origin/<trunk>`。
5. 冲突 → 检测 `git status` unmerged,提示用户解决后 `git rebase --continue`(或 `git rebase --abort`)。
6. 完成 → `git push -f origin <display>`(需确认 force push)。
7. 打印:display 已变基到主干。
````

- [ ] **Step 3: 写 display-reset-to-trunk.md**

创建 `.claude/commands/speccode/display-reset-to-trunk.md`:

````markdown
---
name: "SpecCode: Display Reset To Trunk"
description: "把 display 硬重置到主干,四步走保护 spec 文档不丢"
category: Workflow
tags: [speccode, workflow, display, reset]
---

把 display 硬重置到主干,同时保护 spec 文档。全程中文。

1. `read-config`;`display.enabled=false` → 提示无标的分支并退出。
2. HEAD 必须在 display。
3. **警告**:会丢弃 display 上所有未合入主干的 commit,询问确认。

## 四步走(保护文档不丢)

设 `dirs = enabledDocDirs(config)` 中工作区实际存在的目录。

1. **备份**:把 `dirs` 复制到 `.speccode/backup/display-reset-<timestamp>/`(用 `backupDocs`)。
2. **第一阶段 commit(untrack)**:`git rm -r --cached <dir>`(逐个 tracked 的)+ `git commit -m "chore: untrack spec docs (pre-trunk-reset)"`。
3. **硬重置**:`git fetch origin` + `git reset --hard origin/<trunk>`(此时工作区文档因已 untrack 而保留)。
4. **第二阶段 commit(retrack)**:`git add <dir>` + `git commit -m "chore: re-track spec docs on display"`。

## 收尾

5. `git push -f origin <display>`(执行前二次确认)。
6. 询问是否清理 `.speccode/backup/display-reset-<timestamp>/`。
7. 打印:display 已重置到主干,文档跟踪已恢复。
````

- [ ] **Step 4: 写 reset.md**

创建 `.claude/commands/speccode/reset.md`:

````markdown
---
name: "SpecCode: Reset"
description: "重置 speccode 开发环境:清 state 与 worktree,按字段询问是否清理 config(拒绝有 active feature)"
category: Workflow
tags: [speccode, workflow, reset]
---

重置 speccode 环境。全程中文。不接受 `--force`。

## 前置

1. `resolve-speccode-dir` 得 speccodeDir。
2. 扫描 `state/features/*.json`:**任何文件存在** → 报错"检测到 active feature,请先 /speccode:finish 完成所有功能",退出。

## 逐字段询问清理

用 AskUserQuestion 逐个询问是否清理(是则清空该字段,否则保留):
- `trunk` / `remote` / `display` / `pr_tool` / `spec_tools.*`(逐工具)/ `untracked_permanent`。
- 提示:清空 `trunk` 后 `/speccode:start` 将无法执行,需重编辑 config 或重新 init。

## 执行

1. 备份:`backupConfig`(config.json.bak.<timestamp>)。
2. 清理 worktree:`git worktree list --porcelain` 过滤 `worktree-` 前缀 → 逐个 `git worktree remove <path> --force` + `git branch -D <branch>`。
3. `rm -rf .speccode/state/`。
4. 用 `write-config --json-stdin` 写回 config(仅保留用户确认保留的字段)。
5. 打印:reset 完成,保留字段列表;可 `/speccode:init` 重建或直接 `/speccode:start`。
````

- [ ] **Step 5: 验证全部 10 个命令存在且 frontmatter 合法**

Run: `for f in .claude/commands/speccode/*.md; do echo "== $f =="; head -2 "$f"; done; echo "count:"; ls .claude/commands/speccode/*.md | wc -l`
Expected: 10 个文件,每个以 `---` 起头。

- [ ] **Step 6: 提交**

```bash
git add .claude/commands/speccode/display-merge-trunk.md .claude/commands/speccode/display-rebase-trunk.md .claude/commands/speccode/display-reset-to-trunk.md .claude/commands/speccode/reset.md
git commit -m "feat(speccode): display sync trio + reset commands"
```

---

## Phase 4 — 文档与验收

### Task 15: README

**Files:**
- Create: `.claude/speccode/README.md`

**Interfaces:** 无代码接口(纯文档)。

- [ ] **Step 1: 写 README.md**

创建 `.claude/speccode/README.md`,MUST 包含以下小节(内容据 proposal/design 填写):

1. **speccode 是什么**:一句话定位 + 适用场景(多需求并行开发)。
2. **10 个命令快速参考表**:命令名 | 作用 | 前置(在哪个分支跑)。
   - init / start / develop-start / develop-complete / finish / status / display-merge-trunk / display-rebase-trunk / display-reset-to-trunk / reset。
3. **分支拓扑图**:trunk / display / feature / worktree / `-complete` 的关系(ASCII)。
4. **`.speccode/` 目录结构**:config.json、state/features/、backup/ 各自职责。
5. **风险与缓解 R1-R10**:逐条列出(从 design.md 的 Risks 段搬运)。
6. **未解决问题 OQ2 / OQ4**:doc_dir 非默认路径不主动扫描;Windows 未支持。
7. **跨平台说明**:仅 macOS / Linux;依赖 git + gh/glab CLI + Node ≥ 24。
8. **⚠ 重要警告**:`.speccode/` 在用户项目中不被 git 跟踪也不加 `.gitignore`;`git clean -fdx` 会丢配置(R4)。

- [ ] **Step 2: 验证 README 覆盖 10 命令与 R1-R10**

Run: `grep -c "R10\|R1\b" .claude/speccode/README.md; grep -c "speccode:" .claude/speccode/README.md`
Expected: R10 出现;命令引用 ≥ 10。

- [ ] **Step 3: 提交**

```bash
git add .claude/speccode/README.md
git commit -m "docs(speccode): README with command reference, topology, risks"
```

---

### Task 16: 端到端验收

对真实临时仓库跑通核心流程,验证 spec 的 13.1-13.10 验收项。这些用一次性 shell 会话手动执行(不建长期测试),确认后归档 OpenSpec change。

- [ ] **Step 1: 全量单测回归**

Run: `node --test tests/`
Expected: PASS —— atomic / slug / state / git / reconcile / prtool / waitmerge / docstrip / config / cli 全绿。

- [ ] **Step 2: 无 display 路径手动走查(建临时仓库)**

在一个临时 git 仓库里(可用 `tests/helpers/tmprepo.mjs` 的 makeRepo 思路手动建),依次:
- `resolve-speccode-dir` 定位 `.speccode`。
- 手动写一份 `display.enabled=false` 的 config。
- 造一个 `feature/demo` 分支 + state 文件。
- `git worktree add .claude/worktrees/worktree-demo -b worktree-demo feature/demo`。
- 跑 `reconcile --cwd .`,确认 `worktree-demo` 被登记(ancestry 命中)。
- 本地 squash 合并模拟,置 state completed。
- `feature-progress --branch feature/demo` 确认 `1/1 done`。

Expected: reconcile 正确归属,progress 报告 1/1。

- [ ] **Step 3: 文档剥离往返验证**

在临时仓库:`commitFile` 造 `openspec/spec.md`(tracked)→ `stripDocs(['openspec'])` → 确认 `git ls-files openspec` 为空但文件仍在 → `retrackDocs(['openspec'])` → 确认重新 tracked。

Run(示意): `node -e "import('./.claude/speccode/lib/docstrip.mjs').then(m=>{...})"` 或直接扩展 docstrip.test.mjs 的既有断言。
Expected: untrack 后文件保留,retrack 后重新入库。

- [ ] **Step 4: slug 防撞名验证**

确认 `feature/pay-ment` → `feature__pay-ment.json`,且与任何其他分支不撞名;非法 slug(大写/下划线/空格/多 `/`)被 `validateBranch` 拒绝。(已由 slug.test.mjs 覆盖,这里复核。)

Run: `node --test tests/slug.test.mjs`
Expected: PASS。

- [ ] **Step 5: 对账推进 pr_open 验证**

确认 reconcile 注入 `queryPr:()=>'MERGED'` 时把 `pr_open` 推进 `completed`。(已由 reconcile.test.mjs 覆盖,复核。)

Run: `node --test tests/reconcile.test.mjs`
Expected: PASS。

- [ ] **Step 6: OpenSpec 校验并归档**

Run: `openspec verify add-speccode-plugin` → 通过后由用户确认 `/opsx:archive`。
Expected: verify 报告实现已覆盖 spec requirements(命令文件存在、lib 与 verb 齐备、测试全绿)。

- [ ] **Step 7: 最终提交**

```bash
git add -A
git commit -m "test(speccode): end-to-end acceptance pass"
```

---

## 附:实现顺序与依赖

```
Task 1 (atomic/timestamp) ─┬─> Task 3 (state) ─┐
Task 2 (slug) ─────────────┘                   ├─> Task 5 (reconcile) ─┐
Task 4 (git + tmprepo) ────────────────────────┘                       │
Task 6 (prtool) ───────────────────────────────────────────────────────┤
Task 7 (waitmerge) ─────────────────────────────────────────────────────┤
Task 8 (docstrip) ──────────────────────────────────────────────────────┤
Task 9 (config) ────────────────────────────────────────────────────────┤
                                                                          v
                                                        Task 10 (CLI dispatch)
                                                                          │
                          ┌───────────────────────────────────────────────┤
                          v                v                v              v
                    Task 11 (init/start) Task 12 (develop) Task 13 (finish/status) Task 14 (display/reset)
                                                                          │
                                                              Task 15 (README)
                                                                          │
                                                              Task 16 (验收 + archive)
```

Task 1-9 之间除标注依赖外可乱序;Task 10 依赖全部 lib;Task 11-14 依赖 Task 10;Task 15-16 最后。
