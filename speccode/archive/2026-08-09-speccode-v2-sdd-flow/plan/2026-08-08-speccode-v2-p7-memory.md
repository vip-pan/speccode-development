# speccode v2 · P7 memory(feature 级跨会话记忆)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地 feature 级跨会话记忆:`atomic.writeTextAtomic` + `lib/memory.mjs`(主仓 `.speccode/memory/<type>__<slug>.md`,untracked)+ `read-memory`/`write-memory` verb + 10 个命令的读写时机接线 + 「超大会话主动发现与书写」判据段落。

**Architecture:** 对应 OpenSpec change `speccode-v2-sdd-flow` 的 P7 阶段;spec 锚点 `session-memory`(5 条 requirement:文件位置与命名/原子写/verb/读写时机/主动发现)。`_exploring.md` 是 trunk 级唯一非 feature 记忆文件(D18),无引擎特判——`branch="_exploring"` 经 `branchToStateName` 天然映射为 `_exploring.md`。

**Tech Stack:** Node ≥ 24,纯 ESM,零依赖,node:test。

## Global Constraints

- 测试命令 MUST 用 glob 形式:`node --test ./plugins/speccode/tests/*.test.mjs`。
- memory 写入(含 append 的读-改-写)MUST 走 `writeTextAtomic`(临时文件 `${path}.${pid}.tmp` + renameSync,与 writeJsonAtomic 同构)。
- memory 文件定位:主仓 `.speccode/memory/`(经 bin 既有 `speccodeDirOf(cwd)` 的 git-common-dir 解析——linked worktree 内也指向主仓,多 worktree 共享一份)。
- 命名复用 `branchToStateName`:`feature/payment-api` → `feature__payment-api.md`;`_exploring` → `_exploring.md`。
- verb 契约:`read-memory --branch <F>` → `{ok:true, memory: string|null}`;`write-memory --branch <F> --json-stdin` ← `{mode:"replace"|"append", content:string}`,缺 flag/缺 branch/非法 mode → `{ok:false}` exit 1。
- 命令接线形态全插件统一(见 Task 4 模板);出口写入内容 MUST 经用户确认或遵循命令内置判据(D16)。
- 命令 prose 全程中文;提交信息遵守仓库惯例。

## File Structure

- Modify `plugins/speccode/lib/atomic.mjs`(+writeTextAtomic)、`plugins/speccode/tests/atomic.test.mjs`
- Create `plugins/speccode/lib/memory.mjs`、`plugins/speccode/tests/memory.test.mjs`
- Modify `plugins/speccode/bin/speccode.mjs`、`plugins/speccode/tests/cli.test.mjs`
- Modify 10 个命令文件(读写时机接线 + 主动书写判据)
- Modify `openspec/changes/speccode-v2-sdd-flow/tasks.md`(P7 勾选,验收任务内)

---

### Task 1: atomic.mjs 新增 writeTextAtomic

**Files:**
- Modify: `plugins/speccode/lib/atomic.mjs`
- Test: `plugins/speccode/tests/atomic.test.mjs`

**Interfaces:**
- Produces: `writeTextAtomic(path, text) -> void`(与 writeJsonAtomic 同 tmp+rename 模式)。Task 2 的 memory.mjs 依赖。

- [ ] **Step 1: 写失败测试** — 追加到 `plugins/speccode/tests/atomic.test.mjs`(import 行加 writeTextAtomic):

```js
test('writeTextAtomic writes text atomically', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sc-atomic-'));
  const p = join(dir, 'm.md');
  writeTextAtomic(p, 'hello\n');
  assert.equal(readFileSync(p, 'utf8'), 'hello\n');
  writeTextAtomic(p, 'world\n');
  assert.equal(readFileSync(p, 'utf8'), 'world\n');
  // 无临时文件残留
  assert.deepEqual(readdirSync(dir), ['m.md']);
  rmSync(dir, { recursive: true, force: true });
});
```

(按该文件既有 import 补 `readFileSync`/`readdirSync`/`mkdtempSync`/`tmpdir`/`join`/`rmSync` 缺的项。)

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test --test-name-pattern="writeTextAtomic" plugins/speccode/tests/atomic.test.mjs`
Expected: FAIL(not a function / import error)

- [ ] **Step 3: 实现** — `plugins/speccode/lib/atomic.mjs` 在 writeJsonAtomic 后加(先读该文件保持同构:`writeFileSync` 临时文件 + `renameSync`):

```js
export function writeTextAtomic(path, text) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}
```

(若 writeJsonAtomic 的现有实现 imports 不含 writeFileSync/renameSync,按其既有 import 形态补齐。)

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test plugins/speccode/tests/atomic.test.mjs`
Expected: PASS(6 个测试)

- [ ] **Step 5: Commit**

```bash
git add plugins/speccode/lib/atomic.mjs plugins/speccode/tests/atomic.test.mjs
git commit -m "feat(atomic): add writeTextAtomic for markdown memory files"
```

### Task 2: lib/memory.mjs

**Files:**
- Create: `plugins/speccode/lib/memory.mjs`
- Test: `plugins/speccode/tests/memory.test.mjs`

**Interfaces:**
- Produces: `memoryDir(speccodeDir)`、`memoryPath(speccodeDir, branch)`、`readMemory(speccodeDir, branch) -> string|null`、`writeMemory(speccodeDir, branch, content, mode) -> path`(mode ∈ `'replace'|'append'`)。
- Consumes: Task 1 的 `writeTextAtomic`;`lib/slug.mjs` 的 `branchToStateName`。

- [ ] **Step 1: 写失败测试** — 新建 `plugins/speccode/tests/memory.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { memoryDir, memoryPath, readMemory, writeMemory } from '../lib/memory.mjs';

function tmp() { return mkdtempSync(join(tmpdir(), 'speccode-mem-')); }

test('memoryPath reuses the double-underscore state naming', () => {
  assert.equal(memoryPath('/x/.speccode', 'feature/payment-api'),
    '/x/.speccode/memory/feature__payment-api.md');
  assert.equal(memoryPath('/x/.speccode', '_exploring'), '/x/.speccode/memory/_exploring.md');
});

test('readMemory returns null when absent', () => {
  const dir = tmp();
  assert.equal(readMemory(dir, 'feature/none'), null);
  rmSync(dir, { recursive: true, force: true });
});

test('writeMemory replace then read round-trips, dir auto-created', () => {
  const dir = tmp();
  const p = writeMemory(dir, 'feature/x', '# memory\n', 'replace');
  assert.equal(p, memoryPath(dir, 'feature/x'));
  assert.equal(readMemory(dir, 'feature/x'), '# memory\n');
  rmSync(dir, { recursive: true, force: true });
});

test('writeMemory append preserves existing content', () => {
  const dir = tmp();
  writeMemory(dir, 'feature/x', 'first\n', 'replace');
  writeMemory(dir, 'feature/x', 'second\n', 'append');
  assert.equal(readMemory(dir, 'feature/x'), 'first\nsecond\n');
  rmSync(dir, { recursive: true, force: true });
});

test('writeMemory append on missing file behaves as replace', () => {
  const dir = tmp();
  writeMemory(dir, 'feature/y', 'only\n', 'append');
  assert.equal(readMemory(dir, 'feature/y'), 'only\n');
  rmSync(dir, { recursive: true, force: true });
});

test('writeMemory is atomic (no tmp residue, no partial state)', () => {
  const dir = tmp();
  writeMemory(dir, 'feature/x', 'v1', 'replace');
  writeMemory(dir, 'feature/x', 'v2', 'replace');
  const files = readdirSync(memoryDir(dir));
  assert.deepEqual(files, ['feature__x.md']);
  assert.equal(readMemory(dir, 'feature/x'), 'v2');
  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test plugins/speccode/tests/memory.test.mjs`
Expected: FAIL(Cannot find module)

- [ ] **Step 3: 实现** — 新建 `plugins/speccode/lib/memory.mjs`:

```js
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeTextAtomic } from './atomic.mjs';
import { branchToStateName } from './slug.mjs';

// Per-feature session memory: <main repo>/.speccode/memory/<type>__<slug>.md.
// Untracked by convention like the rest of .speccode/; resolved from the main
// repo root so multiple worktrees of one feature share a single memory file.
// `_exploring` is the one non-feature key (trunk-level exploring conclusions).
export function memoryDir(speccodeDir) {
  return join(speccodeDir, 'memory');
}

export function memoryPath(speccodeDir, branch) {
  return join(memoryDir(speccodeDir), `${branchToStateName(branch)}.md`);
}

export function readMemory(speccodeDir, branch) {
  const p = memoryPath(speccodeDir, branch);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

export function writeMemory(speccodeDir, branch, content, mode) {
  mkdirSync(memoryDir(speccodeDir), { recursive: true });
  const p = memoryPath(speccodeDir, branch);
  const next = mode === 'append' && existsSync(p)
    ? readFileSync(p, 'utf8') + content
    : content;
  writeTextAtomic(p, next);
  return p;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test plugins/speccode/tests/memory.test.mjs`
Expected: PASS(6 个测试)

- [ ] **Step 5: Commit**

```bash
git add plugins/speccode/lib/memory.mjs plugins/speccode/tests/memory.test.mjs
git commit -m "feat(memory): per-feature memory store with atomic append/replace"
```

### Task 3: bin 新增 read-memory / write-memory verb

**Files:**
- Modify: `plugins/speccode/bin/speccode.mjs`
- Test: `plugins/speccode/tests/cli.test.mjs`

**Interfaces:**
- Consumes: Task 2 的 readMemory/writeMemory。Produces: 两个 verb(契约见 Global Constraints);Task 4 的 10 个命令依赖。

- [ ] **Step 1: 写失败测试** — 追加到 `plugins/speccode/tests/cli.test.mjs`:

```js
test('read-memory returns null when absent', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'read-memory', '--cwd', repo, '--branch', 'feature/x');
  assert.equal(code, 0);
  assert.deepEqual(json, { ok: true, memory: null });
  rmSync(repo, { recursive: true, force: true });
});

test('write-memory then read-memory round-trips (append mode)', () => {
  const repo = makeRepo();
  const w1 = spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', 'feature/x', '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ mode: 'append', content: 'line1\n' }), encoding: 'utf8' });
  assert.equal(w1.status, 0);
  const w2 = spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', 'feature/x', '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ mode: 'append', content: 'line2\n' }), encoding: 'utf8' });
  assert.equal(w2.status, 0);
  const r = runCli(repo, 'read-memory', '--cwd', repo, '--branch', 'feature/x');
  assert.equal(r.json.memory, 'line1\nline2\n');
  rmSync(repo, { recursive: true, force: true });
});

test('write-memory without --json-stdin returns ok:false', () => {
  const repo = makeRepo();
  const r = spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', 'feature/x'],
    { cwd: repo, input: '{}', encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stdout.trim()).ok, false);
  rmSync(repo, { recursive: true, force: true });
});

test('write-memory rejects invalid mode', () => {
  const repo = makeRepo();
  const r = spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', 'feature/x', '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ mode: 'upsert', content: 'x' }), encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stdout.trim()).ok, false);
  rmSync(repo, { recursive: true, force: true });
});

test('read-memory inside a linked worktree resolves to the main repo memory', () => {
  const repo = realpathSync(makeRepo());
  spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', 'feature/x', '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ mode: 'replace', content: 'shared\n' }), encoding: 'utf8' });
  const wtPath = join(repo, '.claude', 'worktrees', 'wt-mem');
  mkdirSync(join(repo, '.claude', 'worktrees'), { recursive: true });
  const add = spawnSync('git', ['worktree', 'add', wtPath, '-b', 'worktree-mem', 'HEAD'],
    { cwd: repo, encoding: 'utf8' });
  assert.equal(add.status, 0, add.stderr);
  const r = runCli(wtPath, 'read-memory', '--cwd', wtPath, '--branch', 'feature/x');
  assert.equal(r.json.memory, 'shared\n');
  spawnSync('git', ['worktree', 'remove', wtPath, '--force'], { cwd: repo, encoding: 'utf8' });
  rmSync(repo, { recursive: true, force: true });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test --test-name-pattern="memory" plugins/speccode/tests/cli.test.mjs`
Expected: FAIL(unknown verb)

- [ ] **Step 3: 实现** — `plugins/speccode/bin/speccode.mjs`:

(a) import 行加:

```js
import { readMemory, writeMemory } from '../lib/memory.mjs';
```

(b) VERBS 中 `run-hook` 之后加:

```js
  'read-memory': ({ cwd, branch }) => {
    if (!branch || branch === true) return { ok: false, error: 'read-memory requires --branch <F>' };
    return { ok: true, memory: readMemory(speccodeDirOf(cwd), branch) };
  },

  'write-memory': ({ cwd, branch, 'json-stdin': jsonStdin }) => {
    if (!jsonStdin) return { ok: false, error: 'write-memory requires --json-stdin (pipe JSON via stdin)' };
    if (!branch || branch === true) return { ok: false, error: 'write-memory requires --branch <F>' };
    const { mode, content } = JSON.parse(readStdin());
    if (mode !== 'replace' && mode !== 'append') {
      return { ok: false, error: 'write-memory mode must be "replace" or "append"' };
    }
    if (typeof content !== 'string') return { ok: false, error: 'write-memory content must be a string' };
    const path = writeMemory(speccodeDirOf(cwd), branch, content, mode);
    return { ok: true, path };
  },
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: 全绿(112 + 1 atomic + 6 memory + 5 cli = 124,以实际为准)

- [ ] **Step 5: Commit**

```bash
git add plugins/speccode/bin/speccode.mjs plugins/speccode/tests/cli.test.mjs
git commit -m "feat(cli): add read-memory and write-memory verbs"
```

### Task 4: 10 个命令接入读写时机

**Files:**
- Modify: proposing.md、brainstorming.md、writing-plans.md、executing-plans.md、subagent-driven-development.md、finishing-worktree.md、finishing-feature.md、archiving.md(入口读+出口写)、creating-feature.md(出口建骨架+_exploring 迁入)、exploring.md(出口按归属写)、syncing.md(仅入口读)——共 11 文件。

**Interfaces:**
- Consumes: Task 3 的两个 verb。Produces: session-memory spec「命令读写时机」的全量接线。

- [ ] **Step 1: 统一形态** —

入口读(命令前置段末尾加一条):
> **读记忆**:运行 `speccode.mjs read-memory --cwd . --branch <F>`;返回非 null 时把 memory 内容作为既有上下文参考,再继续。

出口写(命令收尾段加一条,内容经用户确认或按命令内置判据):
> **写记忆**:把本命令产出的决策/进度摘要(经用户确认)经 `echo '{"mode":"append","content":"<摘要>"}' | speccode.mjs write-memory --cwd . --branch <F> --json-stdin` 追加到本 feature 的 memory。

特殊三处:
- **creating-feature.md**(「创建」段写 state 之后):建立 memory 骨架——`write-memory` mode=replace 写入 `# <F> 记忆\n- 创建于 <ISO 时间>\n- exploring 结论:<若 _exploring.md 存在则迁入其内容>`;随后若 `_exploring.md` 存在,读取主仓 `.speccode/memory/_exploring.md`(`read-memory --branch _exploring`)把结论迁入骨架,并清空该文件(`write-memory --branch _exploring` mode=replace 内容为空串)。
- **exploring.md**(「完成后的衔接」段):按归属写记忆——用户确认归属既有 feature → append 到该 feature memory;无归属 → append 到 `_exploring.md`。
- **syncing.md**:仅加入口读,不加出口写。

- [ ] **Step 2: 验证**

Run: `git grep -c "read-memory\|write-memory" plugins/speccode/commands/proposing.md plugins/speccode/commands/brainstorming.md plugins/speccode/commands/writing-plans.md plugins/speccode/commands/executing-plans.md plugins/speccode/commands/subagent-driven-development.md plugins/speccode/commands/finishing-worktree.md plugins/speccode/commands/finishing-feature.md plugins/speccode/commands/archiving.md`
Expected: 每文件 ≥2(入口读 + 出口写)
Run: `git grep -c "write-memory" plugins/speccode/commands/creating-feature.md plugins/speccode/commands/exploring.md`
Expected: creating-feature ≥2(骨架 + 清空),exploring ≥1
Run: `git grep -c "read-memory" plugins/speccode/commands/syncing.md`
Expected: ≥1 且无 write-memory

- [ ] **Step 3: Commit**

```bash
git add plugins/speccode/commands/
git commit -m "feat(commands): wire memory read/write timing across 11 commands"
```

### Task 5: 「超大会话主动发现与书写」判据段落

**Files:**
- Modify: 与 Task 4 相同的 11 个命令文件。

**Interfaces:**
- Produces: session-memory spec「超大会话主动发现与书写」的 prose 落点。

- [ ] **Step 1: 在每个命令文件的 memory 相关段落附近(无则加在收尾前)插入统一段落**:

> **长会话主动记忆**:在以下时机 MUST 主动执行 write-memory(append),不等命令出入口:①一个开发阶段/任务完成且距上次写入已隔多个阶段;②会话上下文显著增长(接近 compact 风险);③compact 恢复后继续工作的首个阶段完成时。写入内容 MUST 是关键决策/进度/待办的摘要,并经用户确认或遵循本命令内置判据。

(SDD/executing-plans 可细化①为「每个 task 完成时」;其余命令保持三判据。)

- [ ] **Step 2: 验证**

Run: `git grep -c "长会话主动记忆" plugins/speccode/commands/*.md | grep -v ":0" | wc -l`
Expected: 11

- [ ] **Step 3: Commit**

```bash
git add plugins/speccode/commands/
git commit -m "feat(commands): add proactive long-session memory triggers"
```

### Task 6: P7 验收

**Files:**
- Modify: `openspec/changes/speccode-v2-sdd-flow/tasks.md`(勾选 P7)

- [ ] **Step 1: 全量测试**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: 全绿(约 124,以实际为准)

- [ ] **Step 2: 结构断言**

```bash
# read/write-memory 接线覆盖
git grep -ln "read-memory\|write-memory" plugins/speccode/commands/ | wc -l   # 期望 11
git grep -c "长会话主动记忆" plugins/speccode/commands/ | grep -v ":0" | wc -l  # 期望 11
# 冒烟:tmp 仓 write-memory append ×2 → read-memory 拼接正确(与 cli 测试同形态)
```

- [ ] **Step 3: 勾选 tasks.md P7**(7.1–7.7)

- [ ] **Step 4: Commit**

```bash
git add openspec/changes/speccode-v2-sdd-flow/tasks.md
git commit -m "docs(openspec): check off P7 tasks of speccode-v2-sdd-flow"
```

---

## Self-Review 记录

- **Spec 覆盖**:session-memory 5 条 — 文件位置与命名(T2 memoryPath 测试含 `_exploring` 例外)、原子写(T1 writeTextAtomic + T2 无残留测试)、verb(T3 五用例含 linked worktree 主仓共享)、读写时机(T4 十一文件映射,含 creating-feature 骨架迁入、exploring 归属、syncing 只读、status/reset 不动)、主动发现(T5 统一判据段落)。
- **Placeholder 扫描**:引擎与测试代码完整;命令接线为统一模板 + 特殊三处显式说明。
- **一致性**:`branchToStateName` 复用与 spec「命名复用双下划线」一致;`_exploring` 无引擎特判(T2 测试证实天然映射);write-memory 的 --json-stdin 强制与 P1 写 verb 契约一致。
- **既有兼容**:112 个既有测试不动;新增 atomic 1 + memory 6 + cli 5。
