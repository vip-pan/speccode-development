# exploring-topic-split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 探索记忆按 topic 分文件(`_exploring__<topic>.md`),creating-feature 经原子 rename 承接,废除 merge+clear,消除多需求交错探索的互相污染。

**Architecture:** 三层分工不变——校验/列举/改名的确定性逻辑全部下沉 `lib/memory.mjs`(纯函数,可单测);`bin/speccode.mjs` 只做 flag 校验与透传(新增 `list-memory`/`rename-memory` 两个 verb);`commands/exploring.md` 与 `commands/creating-feature.md` 只改 prose 交互(slug=topic 约定承接)。`memoryPath` 对 `_exploring/<topic>` 的编码经既有 `branchToStateName` 天然成立,零改动,仅用测试锁定。

**Tech Stack:** Node ≥ 24 纯 ESM,`node:` 内置模块(`node:fs` 的 `readdirSync`/`renameSync`),`node:test` + `node:assert/strict`,tmp 目录单测 + `tmprepo` 端到端。

## Global Constraints

- Node ≥ 24;纯 ESM;零第三方依赖(仅 `node:` 内置模块)
- 全量测试必须用 glob 形式:`node --test ./plugins/speccode/tests/*.test.mjs`(裸目录形式在 Node v24 报 MODULE_NOT_FOUND)
- memory 文件名规则:`<type>__<slug>.md` 双下划线;topic 键 `_exploring/<topic>`,`topic` 匹配 `^[a-z0-9-]+$`(复用 `lib/slug.mjs` 的 `validateSlug`)
- 原子写纪律:replace 走 `atomic.writeTextAtomic`;append 走单次 O_APPEND(`appendFileSync`);rename 用同目录 `renameSync`(原子,同一文件系统)
- 写 verb 强制 `--json-stdin`(布尔 flag),payload MUST `JSON.parse(readStdin())`,绝不 `JSON.parse(jsonStdin)`
- 校验收口:branch 合法性判定统一走 `lib/memory.mjs` 的 `validateMemoryBranch`,bin 内不再内联白名单
- 错误返回契约:`{ok:false, error}` + exit 1;错误文案中 `invalid branch` / `not found` / `already exists` 是命令层分支判断的锚点,MUST 逐字保持
- 命令 markdown 全程中文交互;frontmatter 四字段不动;裸调形态 `speccode.mjs <verb> --cwd .` 不变
- 文档不硬编码版本号/测试用例数量/命令总数(CHANGELOG 为单一数据源)
- 提交信息 conventional commits(`feat:` / `test:` / `docs:`),每个任务至少一个提交

---

### Task 1: lib `validateMemoryBranch` + 锁定 topic 编码

**Files:**
- Modify: `plugins/speccode/lib/memory.mjs`(import 行 + `TRUNK_MEMORY_KEYS` 之后新增函数)
- Test: `plugins/speccode/tests/memory.test.mjs`

**Interfaces:**
- Consumes: `lib/slug.mjs` 的 `validateSlug(slug)`(已导出)与 `validateBranch(branch)`(已导出)
- Produces: `validateMemoryBranch(branch: string): boolean` — Task 4 的 bin 校验替换依赖此签名;`TRUNK_MEMORY_KEYS` 导出保持不变(仍被本函数与 Task 4 前的 bin 使用)

- [x] **Step 1: 写失败测试**

在 `plugins/speccode/tests/memory.test.mjs` 顶部 import 行加入 `validateMemoryBranch`(该行改为):

```js
import { memoryDir, memoryPath, readMemory, writeMemory, validateMemoryBranch } from '../lib/memory.mjs';
```

在文件末尾追加:

```js
test('memoryPath encodes an _exploring topic via branchToStateName', () => {
  assert.equal(memoryPath('/x/.speccode', '_exploring/payment-rework'),
    '/x/.speccode/memory/_exploring__payment-rework.md');
});

test('validateMemoryBranch accepts reserved keys, topics, and feature branches', () => {
  assert.equal(validateMemoryBranch('_exploring'), true);
  assert.equal(validateMemoryBranch('_knowledge'), true);
  assert.equal(validateMemoryBranch('_exploring/payment-rework'), true);
  assert.equal(validateMemoryBranch('feature/payment-api'), true);
  assert.equal(validateMemoryBranch('bugfix/fix-cr'), true);
});

test('validateMemoryBranch rejects bad topics and branches', () => {
  assert.equal(validateMemoryBranch('_exploring/Bad_Topic'), false);
  assert.equal(validateMemoryBranch('_exploring/'), false);
  assert.equal(validateMemoryBranch('_exploring/a/b'), false);
  assert.equal(validateMemoryBranch('_unknown'), false);
  assert.equal(validateMemoryBranch('worktree-typo'), false);
  assert.equal(validateMemoryBranch(42), false);
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test --test-name-pattern="validateMemoryBranch|_exploring topic" plugins/speccode/tests/memory.test.mjs`
Expected: FAIL — `validateMemoryBranch` 未从 lib 导出(import 报错或 undefined 断言失败)

- [x] **Step 3: 写最小实现**

`plugins/speccode/lib/memory.mjs` import 区(`branchToStateName` 行)改为:

```js
import { branchToStateName, validateBranch, validateSlug } from './slug.mjs';
```

在 `TRUNK_MEMORY_KEYS` 定义(第 14 行)之后新增:

```js
// Branch-key validation for read/write/rename-memory: reserved no-slash trunk
// keys, `_exploring/<topic>` topic keys (topic reuses the slug charset), and
// regular <type>/<slug> feature branches. Supersedes the bin-side inline
// `TRUNK_MEMORY_KEYS.includes(branch) || validateBranch(branch)` check.
export function validateMemoryBranch(branch) {
  if (typeof branch !== 'string') return false;
  if (TRUNK_MEMORY_KEYS.includes(branch)) return true;
  if (branch.startsWith('_exploring/')) {
    return validateSlug(branch.slice('_exploring/'.length));
  }
  return validateBranch(branch);
}
```

说明:`_exploring/`(空 topic)与 `_exploring/a/b`(topic 含 `/`)都被 `validateSlug` 的 `^[a-z0-9-]+$` 拒绝,无需特判。`TRUNK_MEMORY_KEYS` 导出保持不动(Task 4 才清理 bin 侧消费)。

- [x] **Step 4: 运行确认通过**

Run: `node --test plugins/speccode/tests/memory.test.mjs`
Expected: PASS(既有用例全绿 + 3 个新用例)

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/lib/memory.mjs plugins/speccode/tests/memory.test.mjs
git commit -m "feat: validateMemoryBranch accepts _exploring/<topic> memory keys"
```

---

### Task 2: lib `listMemory`

**Files:**
- Modify: `plugins/speccode/lib/memory.mjs`(import 行 + 文件末尾)
- Test: `plugins/speccode/tests/memory.test.mjs`

**Interfaces:**
- Consumes: `node:fs` 的 `readdirSync`、`existsSync`(后者已 import)
- Produces: `listMemory(speccodeDir: string): string[]` — 返回 `_exploring/<topic>` 键数组(升序);Task 4 的 `list-memory` verb 与 Task 5/6 的命令 prose 依赖此签名

- [x] **Step 1: 写失败测试**

`plugins/speccode/tests/memory.test.mjs` import 行加入 `listMemory`:

```js
import { listMemory, memoryDir, memoryPath, readMemory, writeMemory, validateMemoryBranch } from '../lib/memory.mjs';
```

文件末尾追加:

```js
test('listMemory returns only _exploring topic keys, sorted', () => {
  const dir = tmp();
  writeMemory(dir, '_exploring/b-p1', 'x\n', 'replace');
  writeMemory(dir, '_exploring/a', 'x\n', 'replace');
  writeMemory(dir, 'feature/c', 'x\n', 'replace');
  assert.deepEqual(listMemory(dir), ['_exploring/a', '_exploring/b-p1']);
  rmSync(dir, { recursive: true, force: true });
});

test('listMemory returns empty when no topics exist', () => {
  const dir = tmp();
  assert.deepEqual(listMemory(dir), []);
  rmSync(dir, { recursive: true, force: true });
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test --test-name-pattern="listMemory" plugins/speccode/tests/memory.test.mjs`
Expected: FAIL — `listMemory` 未导出

- [x] **Step 3: 写最小实现**

`plugins/speccode/lib/memory.mjs` 首行 import 改为(新增 `readdirSync`):

```js
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
```

文件末尾新增:

```js
// List existing exploring topic keys (`_exploring/<topic>`), sorted. The
// legacy bare `_exploring.md` does not match the `_exploring__` prefix and is
// never listed; feature memory files are excluded by the same filter.
export function listMemory(speccodeDir) {
  const dir = memoryDir(speccodeDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith('_exploring__') && f.endsWith('.md'))
    .map((f) => `_exploring/${f.slice('_exploring__'.length, -'.md'.length)}`)
    .sort();
}
```

- [x] **Step 4: 运行确认通过**

Run: `node --test plugins/speccode/tests/memory.test.mjs`
Expected: PASS

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/lib/memory.mjs plugins/speccode/tests/memory.test.mjs
git commit -m "feat: listMemory enumerates exploring topic keys"
```

---

### Task 3: lib `renameMemory`

**Files:**
- Modify: `plugins/speccode/lib/memory.mjs`(import 行 + 文件末尾)
- Test: `plugins/speccode/tests/memory.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `validateMemoryBranch(branch)`;`node:fs` 的 `renameSync`
- Produces: `renameMemory(speccodeDir: string, from: string, to: string): string` — 成功返回目标路径;非法键/源缺失/目标已存在时 throw(`invalid branch` / `not found` / `already exists` 锚点文案);Task 4 的 `rename-memory` verb 依赖此签名与错误文案

- [x] **Step 1: 写失败测试**

`plugins/speccode/tests/memory.test.mjs` import 行加入 `renameMemory`:

```js
import { listMemory, memoryDir, memoryPath, readMemory, renameMemory, writeMemory, validateMemoryBranch } from '../lib/memory.mjs';
```

文件末尾追加:

```js
test('renameMemory moves the topic file and keeps content', () => {
  const dir = tmp();
  writeMemory(dir, '_exploring/a', 'conclusions\n', 'replace');
  const dst = renameMemory(dir, '_exploring/a', 'feature/b');
  assert.equal(dst, memoryPath(dir, 'feature/b'));
  assert.equal(readMemory(dir, 'feature/b'), 'conclusions\n');
  assert.equal(readMemory(dir, '_exploring/a'), null);
  assert.equal(existsSync(memoryPath(dir, '_exploring/a')), false);
  rmSync(dir, { recursive: true, force: true });
});

test('renameMemory refuses a missing source', () => {
  const dir = tmp();
  assert.throws(() => renameMemory(dir, '_exploring/none', 'feature/b'), /not found/);
  rmSync(dir, { recursive: true, force: true });
});

test('renameMemory refuses an existing target and keeps both files', () => {
  const dir = tmp();
  writeMemory(dir, '_exploring/a', 'exploring\n', 'replace');
  writeMemory(dir, 'feature/b', 'existing\n', 'replace');
  assert.throws(() => renameMemory(dir, '_exploring/a', 'feature/b'), /already exists/);
  assert.equal(readMemory(dir, '_exploring/a'), 'exploring\n');
  assert.equal(readMemory(dir, 'feature/b'), 'existing\n');
  rmSync(dir, { recursive: true, force: true });
});

test('renameMemory validates both branch keys', () => {
  const dir = tmp();
  writeMemory(dir, '_exploring/a', 'x\n', 'replace');
  assert.throws(() => renameMemory(dir, '_exploring/a', 'feature/Bad_Slug'), /invalid branch/);
  rmSync(dir, { recursive: true, force: true });
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test --test-name-pattern="renameMemory" plugins/speccode/tests/memory.test.mjs`
Expected: FAIL — `renameMemory` 未导出

- [x] **Step 3: 写最小实现**

`plugins/speccode/lib/memory.mjs` 首行 import 改为(新增 `renameSync`):

```js
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
```

文件末尾新增:

```js
// Atomically adopt an exploring topic file into a feature memory file (same
// directory, renameSync). Refuses to overwrite an existing target — adoption
// must never merge or clobber (same safety stance as reconcile attribution).
export function renameMemory(speccodeDir, from, to) {
  if (!validateMemoryBranch(from)) throw new Error(`invalid branch name: ${from}`);
  if (!validateMemoryBranch(to)) throw new Error(`invalid branch name: ${to}`);
  const src = memoryPath(speccodeDir, from);
  const dst = memoryPath(speccodeDir, to);
  if (!existsSync(src)) throw new Error(`memory file not found: ${src}`);
  if (existsSync(dst)) throw new Error(`memory file already exists: ${dst}`);
  renameSync(src, dst);
  return dst;
}
```

- [x] **Step 4: 运行确认通过**

Run: `node --test plugins/speccode/tests/memory.test.mjs`
Expected: PASS

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/lib/memory.mjs plugins/speccode/tests/memory.test.mjs
git commit -m "feat: renameMemory adopts exploring topic into feature memory"
```

---

### Task 4: bin 校验替换 + `list-memory` / `rename-memory` verb

**Files:**
- Modify: `plugins/speccode/bin/speccode.mjs:13`(import 行)、`:15`(删除)、`:205-207`、`:214-216`(校验替换)、`write-memory` verb 之后(新 verb)
- Test: `plugins/speccode/tests/cli.test.mjs`

**Interfaces:**
- Consumes: Task 1-3 的 `validateMemoryBranch(branch)`、`listMemory(speccodeDir)`、`renameMemory(speccodeDir, from, to)`(错误文案锚点:`invalid branch` / `not found` / `already exists`)
- Produces: `list-memory --cwd .` → `{ok:true, topics: string[]}`;`rename-memory --cwd . --branch <from> --to <to> --json-stdin`(stdin `{}`)→ `{ok:true, from, to, path}` 或 `{ok:false, error}` + exit 1;命令 prose(Task 5/6)依赖这两个契约

- [x] **Step 1: 写失败测试**

在 `plugins/speccode/tests/cli.test.mjs` 的 `write-memory accepts the _knowledge sentinel branch` 用例之后追加:

```js
test('write-memory accepts an _exploring topic branch', () => {
  const repo = makeRepo();
  const w = spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', '_exploring/payment-rework', '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ mode: 'append', content: 'topic notes\n' }), encoding: 'utf8' });
  assert.equal(w.status, 0);
  const r = runCli(repo, 'read-memory', '--cwd', repo, '--branch', '_exploring/payment-rework');
  assert.equal(r.json.memory, 'topic notes\n');
  rmSync(repo, { recursive: true, force: true });
});

test('write-memory rejects an invalid _exploring topic', () => {
  const repo = makeRepo();
  const w = spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', '_exploring/Bad_Topic', '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ mode: 'replace', content: 'x' }), encoding: 'utf8' });
  assert.equal(w.status, 1);
  assert.ok(JSON.parse(w.stdout.trim()).error.includes('invalid branch'));
  rmSync(repo, { recursive: true, force: true });
});

test('list-memory lists only _exploring topics', () => {
  const repo = makeRepo();
  for (const branch of ['_exploring/b-p1', '_exploring/a', 'feature/c']) {
    spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', branch, '--json-stdin'],
      { cwd: repo, input: JSON.stringify({ mode: 'replace', content: 'x\n' }), encoding: 'utf8' });
  }
  const r = runCli(repo, 'list-memory', '--cwd', repo);
  assert.equal(r.json.ok, true);
  assert.deepEqual(r.json.topics, ['_exploring/a', '_exploring/b-p1']);
  rmSync(repo, { recursive: true, force: true });
});

test('rename-memory adopts an exploring topic into a feature memory', () => {
  const repo = makeRepo();
  spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', '_exploring/payment-rework', '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ mode: 'replace', content: 'conclusions\n' }), encoding: 'utf8' });
  const r = spawnSync('node', [BIN, 'rename-memory', '--cwd', repo, '--branch', '_exploring/payment-rework',
    '--to', 'feature/payment-rework', '--json-stdin'],
    { cwd: repo, input: '{}', encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.ok(JSON.parse(r.stdout.trim()).ok);
  assert.equal(runCli(repo, 'read-memory', '--cwd', repo, '--branch', 'feature/payment-rework').json.memory, 'conclusions\n');
  assert.equal(runCli(repo, 'read-memory', '--cwd', repo, '--branch', '_exploring/payment-rework').json.memory, null);
  rmSync(repo, { recursive: true, force: true });
});

test('rename-memory refuses when the target already exists', () => {
  const repo = makeRepo();
  const write = (branch, content) => spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', branch, '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ mode: 'replace', content }), encoding: 'utf8' });
  write('_exploring/a', 'exploring\n');
  write('feature/b', 'existing\n');
  const r = spawnSync('node', [BIN, 'rename-memory', '--cwd', repo, '--branch', '_exploring/a', '--to', 'feature/b', '--json-stdin'],
    { cwd: repo, input: '{}', encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.ok(JSON.parse(r.stdout.trim()).error.includes('already exists'));
  assert.equal(runCli(repo, 'read-memory', '--cwd', repo, '--branch', '_exploring/a').json.memory, 'exploring\n');
  assert.equal(runCli(repo, 'read-memory', '--cwd', repo, '--branch', 'feature/b').json.memory, 'existing\n');
  rmSync(repo, { recursive: true, force: true });
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test --test-name-pattern="topic branch|list-memory|rename-memory" plugins/speccode/tests/cli.test.mjs`
Expected: FAIL — `list-memory`/`rename-memory` 未知 verb(`{ok:false, unknown verb}`)或 topic 校验拒绝

- [x] **Step 3: 写最小实现**

`plugins/speccode/bin/speccode.mjs` 第 13 行 import 改为:

```js
import { listMemory, readMemory, renameMemory, writeMemory, validateMemoryBranch } from '../lib/memory.mjs';
```

第 15 行(`validateBranch` import)删除——校验替换后该 import 成为孤儿,先用 grep 确认无其他使用点:

Run: `grep -n "validateBranch" plugins/speccode/bin/speccode.mjs`
Expected: 仅命中第 13/15 行 import 与 205/214 两处校验(全部在本任务内被替换/删除)→ 可安全删除

`read-memory` 与 `write-memory` 的校验行(205、214 两处相同)统一替换为:

```js
    if (!validateMemoryBranch(branch)) {
      return { ok: false, error: `invalid branch name: ${branch}` };
    }
```

`write-memory` verb 之后新增两个 verb:

```js
  'list-memory': ({ cwd }) => ({ ok: true, topics: listMemory(speccodeDirOf(cwd)) }),

  'rename-memory': ({ cwd, branch, to, 'json-stdin': jsonStdin }) => {
    if (!jsonStdin) return { ok: false, error: 'rename-memory requires --json-stdin (pipe JSON via stdin)' };
    if (!branch || branch === true) return { ok: false, error: 'rename-memory requires --branch <from>' };
    if (!to || to === true) return { ok: false, error: 'rename-memory requires --to <to>' };
    try {
      const path = renameMemory(speccodeDirOf(cwd), branch, to);
      return { ok: true, from: branch, to, path };
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
  },
```

(stdin payload 按写 verb 纪律统一经 `readStdin` 通道;`rename-memory` 无业务字段,`{}` 即可,为将来扩展保留通道一致性。)

- [x] **Step 4: 运行确认通过**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS 全量(既有 `_exploring`/`_knowledge` sentinel 用例不变仍绿——裸键读兼容由 `validateMemoryBranch` 保持)

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/bin/speccode.mjs plugins/speccode/tests/cli.test.mjs
git commit -m "feat: add list-memory and rename-memory verbs, unify memory branch validation"
```

---

### Task 5: 命令 prose — `exploring.md` topic 选择出口

**Files:**
- Modify: `plugins/speccode/commands/exploring.md`(「完成后的衔接(必须)」段的写记忆部分)

**Interfaces:**
- Consumes: Task 4 的 `list-memory`(`{ok:true, topics}`)与 `write-memory --branch _exploring/<topic>` 契约
- Produces: 无代码接口;prose 语义是 Task 6 中 creating-feature 承接交互的对偶(先列 topic → 选既有/新建)

纯 prose 改动,无测试(全量基线保持绿即可)。

- [x] **Step 1: 修改「无归属」写入分支**

定位「**写记忆(按归属)**」小节中「无归属(尚无 feature)→ 追加到 trunk 级 `.speccode/memory/_exploring.md`,供后续 creating-feature 承接」的条目,整段替换为:

```markdown
- 无归属(尚无 feature)→ **先列 topic 再写入**:运行 `speccode.mjs list-memory --cwd .` 取既有探索 topic 清单(返回 `topics` 数组,形如 `["_exploring/payment-rework", ...]`);用 AskUserQuestion 让用户**选既有 topic 或新建**(topic 匹配 `^[a-z0-9-]+$`;清单为空则新建)。大需求的分期探索用共同前缀约定命名 topic(如 `<主题>-p1`、`<主题>-p2`)——各期承接互不携带他期内容,跨期进度与设计结论查 state、git history 与 spec 主规格,不进 memory。同名需求跨 session MUST 优先选既有 topic 追加,防碎片化。选定后追加到该 topic 文件,供后续 creating-feature 按 slug=topic 约定承接:
  ```bash
  speccode.mjs write-memory --cwd . --branch _exploring/<topic> --json-stdin <<'EOF'
  {"mode":"append","content":"<摘要>"}
  EOF
  ```
```

同文件「**长会话主动记忆**」段落不改(其键由所在归属决定,探索会话沿用上面刚选定的 topic 键)。

- [x] **Step 2: 全量回归**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS 全量(纯 prose,零行为面变化)

- [x] **Step 3: 提交**

```bash
git add plugins/speccode/commands/exploring.md
git commit -m "docs: exploring writes conclusions to per-topic _exploring/<topic> memory"
```

---

### Task 6: 命令 prose — `creating-feature.md` rename 承接

**Files:**
- Modify: `plugins/speccode/commands/creating-feature.md`(「决定分支名」第 2 步、「创建」第 4-5 步)

**Interfaces:**
- Consumes: Task 4 的 `list-memory` / `rename-memory`(错误文案锚点 `not found` / `already exists`)、`read-memory --branch _exploring/<topic>`、`write-memory`(append 与 replace)契约
- Produces: 无代码接口

纯 prose 改动,无测试(全量基线保持绿即可)。

- [x] **Step 1: 替换「决定分支名」第 2 步**

第 2 步(现读单文件 `_exploring.md` 推断 type)整体替换为:

```markdown
2. **topic 选择与 type 推断**:参数未直给时,运行 `speccode.mjs list-memory --cwd .` 取既有探索 topic 清单;非空 → 用 AskUserQuestion 让用户选既有 topic(或新建/跳过),slug 预填所选 topic 名,随后运行 `speccode.mjs read-memory --cwd . --branch _exploring/<topic>` 读所选 topic 文件,从其内容推断 type(新功能 → `feature`;修 bug → `bugfix`;重构 → `refactor`;杂项 → `chore`);清单为空 → 直接进入第 3 步询问。参数直给时,slug 即探索 topic 名(slug=topic 约定),第 4 步按该约定查找承接;type 无推断来源时按第 3 步询问。
```

- [x] **Step 2: 替换「创建」第 4 步并删除第 5 步**

第 4 步(现读 `_exploring.md` 全量迁入骨架)整体替换为:

```markdown
4. **建立 memory 骨架(承接 exploring 结论)**:按 slug=topic 约定承接——运行 `speccode.mjs rename-memory --cwd . --branch _exploring/<slug> --to <branch> --json-stdin`(stdin 传 `{}`),按返回值分支:
   - `ok:true` → 探索结论已整体承接为该 feature 的 memory 文件;再以 write-memory(mode=append)补一行骨架头 `"- 创建于 <ISO UTC 时间>"`(MUST NOT replace 重写已承接内容);
   - `ok:false` 且 `error` 含 `not found` → 无同名 topic(用户改了 slug、或本就无探索结论):骨架按原方式建立(write-memory mode=replace,内容 `# <branch> 记忆\n- 创建于 <ISO UTC 时间>\n- exploring 结论:无`);
   - `ok:false` 且 `error` 含 `already exists` → 该 feature 已有 memory(重复创建场景):报告用户并跳过承接,仅 append 骨架头,MUST NOT 覆盖、MUST NOT 合并。
   用 heredoc 经 stdin 传 JSON(不用 `echo '<json>'`:zsh 会把 `\n` 解释成字面换行,内容含单引号也会破壳):
   ```bash
   speccode.mjs rename-memory --cwd . --branch _exploring/<slug> --to <branch> --json-stdin <<'EOF'
   {}
   EOF
   ```
```

原第 5 步(清空 `_exploring.md`)**整段删除**——rename 天然无残留;原第 6、7 步(onFeatureCreated 钩子、打印)序号顺延为第 5、6 步。

- [x] **Step 3: 全量回归**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS 全量

- [x] **Step 4: 提交**

```bash
git add plugins/speccode/commands/creating-feature.md
git commit -m "docs: creating-feature adopts exploring topic via atomic rename"
```

---

### Task 7: 文档同步 + 规格核对 + 收尾验证

**Files:**
- Modify: `plugins/speccode/README.md:115`、`:161`、`:205`
- Modify: `plugins/speccode/README_CN.md:115`、`:161`、`:204`
- Verify: `speccode/changes/exploring-topic-split/propose/specs/session-memory/spec.md`、`speccode/changes/exploring-topic-split/propose/specs/git-workflow-lifecycle/spec.md`

**Interfaces:**
- Consumes: Task 1-6 的最终行为(topic 键、两个新 verb、rename 承接)
- Produces: 无

- [x] **Step 1: 同步插件 README(EN)**

`plugins/speccode/README.md:115` 改为:

```markdown
1. `/speccode:exploring` — explore the requirement on trunk; conclusions stay in the session context (writes per-topic `_exploring/<topic>` memories).
```

`README.md:161` 目录注释改为:

```
├── memory/                              # feature-level memory + per-topic _exploring__<topic>.md / _knowledge.md (self-ignored via .gitignore)
```

`README.md:205` 段落改为:

```markdown
- **Per-topic exploring memory and `_knowledge.md` are the trunk-level exceptions**: exploring happens on trunk and belongs to no feature, so its conclusions go into `memory/_exploring__<topic>.md` (one file per topic; phased requirements share a prefix like `<topic>-p1`); creating-feature adopts the matching topic file via an atomic rename (slug = topic). The knowledge commands also run from trunk, so their maintenance summaries go into `memory/_knowledge.md`.
```

- [x] **Step 2: 同步插件 README(zh,结构一一对应)**

`plugins/speccode/README_CN.md:115` 改为:

```markdown
1. `/speccode:exploring` —— 在 trunk 上探索需求,结论留在会话上下文(写按 topic 分文件的 `_exploring/<topic>` memory)。
```

`README_CN.md:161` 目录注释改为:

```
├── memory/                              # feature 级记忆 + 按 topic 分文件的 _exploring__<topic>.md / _knowledge.md(自忽略 .gitignore)
```

`README_CN.md:204` 段落改为:

```markdown
- **按 topic 分文件的探索记忆与 `_knowledge.md` 是 trunk 级例外**:exploring 在 trunk 上进行、不属于任何 feature,其结论写入 `memory/_exploring__<topic>.md`(每个 topic 一个文件;分期需求用 `<主题>-p1` 这类共同前缀);creating-feature 以原子 rename 按 slug=topic 约定承接同名 topic 文件。knowledge 系列命令同样从 trunk 跑,其维护摘要写入 `memory/_knowledge.md`。
```

核对:EN/zh 三处触点一一对应、无新增硬编码版本号/测试数量/命令数。

- [x] **Step 3: 规格 delta 标题逐字核对**

Run: `diff <(grep '^### Requirement:' speccode/changes/exploring-topic-split/propose/specs/session-memory/spec.md | sort) <(grep -E '^### Requirement: (memory 文件位置与命名|read-memory / write-memory verb|命令读写时机)$' speccode/spec/session-memory/spec.md | sort) && diff <(grep '^### Requirement:' speccode/changes/exploring-topic-split/propose/specs/git-workflow-lifecycle/spec.md) <(grep '^### Requirement: 功能分支命名规则$' speccode/spec/git-workflow-lifecycle/spec.md)`
Expected: 两个 diff 均无输出(delta 的 MODIFIED 标题与主规格逐字一致,syncing 可按名匹配)

- [x] **Step 4: 全量回归 + 手动冒烟**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS 全量

Run: `node plugins/speccode/bin/speccode.mjs list-memory --cwd . && node plugins/speccode/bin/speccode.mjs write-memory --cwd . --branch _exploring/plan-smoke --json-stdin <<< '{"mode":"append","content":"smoke\n"}' && node plugins/speccode/bin/speccode.mjs rename-memory --cwd . --branch _exploring/plan-smoke --to feature/plan-smoke --json-stdin <<< '{}' && node plugins/speccode/bin/speccode.mjs read-memory --cwd . --branch feature/plan-smoke`
Expected: topics 清单 → 写入 ok → rename ok → 读回 `smoke\n`;随后清理冒烟残留:`rm .speccode/memory/feature__plan-smoke.md`(仅删本次冒烟创建的文件)

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/README.md plugins/speccode/README_CN.md
git commit -m "docs: sync per-topic exploring memory in plugin READMEs (EN/zh)"
```
