# distill-incremental-archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** distilling-knowledge 改增量读 archive(只读未消费归档包),已消费包的蒸馏块原样 carry forward,新增 `_distilled.meta.json` sidecar 追踪消费,不改 `replaceDistilledBlocks` 重建语义。

**Architecture:** `lib/knowledge.mjs` 加 sidecar 读写 + 未消费集计算(纯函数,可单测);`bin/speccode.mjs` 暴露 `read-consumed-archives`/`write-consumed-archives` 两 verb;`commands/distilling-knowledge.md` 命令 prose 改增量读 + carry-forward + supersession 闸门 + 落盘登记。carry-forward 在命令层构造候选列表规避误删,lib 重建语义不变。

**Tech Stack:** Node ≥24,纯 ESM,零三方依赖,`node:test` + `node:assert/strict`,真实临时 git 仓库(`tests/helpers/tmprepo.mjs` 的 `makeRepo()`)。

## Global Constraints

- 写 verb 的 `--json-stdin` 是布尔 flag(parseArgs 置 `true`),payload MUST `JSON.parse(readStdin())`,绝不 `JSON.parse(jsonStdin)`(C2,来自 `knowledge/pitfalls.md`)。
- 凡做路径相等比较处先 `realpathSync` 归一(macOS `git rev-parse --show-toplevel` 把 `/var` 解析为 `/private/var`;C1)。`unconsumedArchives` 仅按目录名(字符串)比对,不触发。
- 知识集/归档路径用 `git rev-parse --show-toplevel`(worktree 根,与 `knowledgeRoot` 同),**非** `--git-common-dir`(主仓根,`.speccode/` 用)——有意差异,勿统一。
- 原子写经 `writeJsonAtomic`(临时文件 `${path}.${pid}.tmp` + `rename`),绝不手写 JSON。
- `consumed_archives` 存归档**目录名**(裸名,无 `archive/` 前缀无尾斜杠);source marker 用 `archive/<目录名>/`(带前缀带斜杠)——两套表示,勿混。
- 旧 `promoted-from` marker 读侧永久兼容,写侧只产新 `distilled-from` 格式。

---

### Task 1: lib `distilledMetaPath` + `readConsumedArchives`

**Files:**
- Modify: `plugins/speccode/lib/knowledge.mjs`(文件末尾追加两个 export;`node:fs` 已 import `existsSync`/`readFileSync`,`node:path` 已 import `join`,无需改 import)
- Test: `plugins/speccode/tests/knowledge.test.mjs`

**Interfaces:**
- Consumes: 无(纯函数)
- Produces: `distilledMetaPath(root: string) → string`;`readConsumedArchives(root: string) → string[]`(缺文件→`[]`;JSON 损坏→throw `/corrupt/`)

- [x] **Step 1: 写失败测试**(`tests/knowledge.test.mjs` 末尾追加,import 行加 `distilledMetaPath, readConsumedArchives`)

```js
test('distilledMetaPath points at <root>/_distilled.meta.json', () => {
  assert.equal(distilledMetaPath('/x/knowledge'), '/x/knowledge/_distilled.meta.json');
});

test('readConsumedArchives returns [] when sidecar missing', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(root, { recursive: true });
  assert.deepEqual(readConsumedArchives(root), []);
  rmSync(repo, { recursive: true, force: true });
});

test('readConsumedArchives returns the consumed_archives list', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(root, { recursive: true });
  writeFileSync(distilledMetaPath(root), JSON.stringify({ consumed_archives: ['2026-08-10-foo', '2026-08-11-bar'] }));
  assert.deepEqual(readConsumedArchives(root), ['2026-08-10-foo', '2026-08-11-bar']);
  rmSync(repo, { recursive: true, force: true });
});

test('readConsumedArchives throws on corrupt JSON', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(root, { recursive: true });
  writeFileSync(distilledMetaPath(root), '{ not json');
  assert.throws(() => readConsumedArchives(root), /corrupt/);
  rmSync(repo, { recursive: true, force: true });
});

test('readConsumedArchives throws when consumed_archives is not an array', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(root, { recursive: true });
  writeFileSync(distilledMetaPath(root), JSON.stringify({ consumed_archives: 'oops' }));
  assert.throws(() => readConsumedArchives(root), /corrupt/);
  rmSync(repo, { recursive: true, force: true });
});
```

- [x] **Step 2: 运行确认失败**

Run: `cd <worktree> && node --test --test-name-pattern="distilledMetaPath|readConsumedArchives" plugins/speccode/tests/knowledge.test.mjs`
Expected: FAIL —— `distilledMetaPath is not defined` / `readConsumedArchives is not defined`

- [x] **Step 3: 写最小实现**(`lib/knowledge.mjs` 末尾追加)

```js
// Path to the distill-consumption sidecar: <knowledge>/_distilled.meta.json.
// Tracks which archive bundles distilling-knowledge has already consumed, so
// subsequent runs read archive/ incrementally (only unconsumed bundles).
export function distilledMetaPath(root) {
  return join(root, '_distilled.meta.json');
}

// Read consumed_archives from the sidecar. Missing file → [] (triggers first-
// run bootstrap full read). Corrupt JSON / wrong shape → throw (no silent
// repair, same principle as malformed distilled markers — a corrupted meta
// needs a human).
export function readConsumedArchives(root) {
  const p = distilledMetaPath(root);
  if (!existsSync(p)) return [];
  let obj;
  try {
    obj = JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    throw new Error('knowledge: _distilled.meta.json is corrupt (invalid JSON)');
  }
  if (!Array.isArray(obj?.consumed_archives)) {
    throw new Error('knowledge: _distilled.meta.json is corrupt (no consumed_archives array)');
  }
  return obj.consumed_archives.filter((s) => typeof s === 'string');
}
```

- [x] **Step 4: 运行确认通过**

Run: `cd <worktree> && node --test --test-name-pattern="distilledMetaPath|readConsumedArchives" plugins/speccode/tests/knowledge.test.mjs`
Expected: PASS(5 个新用例)

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/lib/knowledge.mjs plugins/speccode/tests/knowledge.test.mjs
git commit -m "feat(knowledge): distilledMetaPath + readConsumedArchives sidecar reader"
```

---

### Task 2: lib `writeConsumedArchives` + `addConsumedArchives`

**Files:**
- Modify: `plugins/speccode/lib/knowledge.mjs`(import 行加 `writeJsonAtomic`;末尾追加两 export)
- Test: `plugins/speccode/tests/knowledge.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `distilledMetaPath`/`readConsumedArchives`;`atomic.mjs` 的 `writeJsonAtomic`
- Produces: `writeConsumedArchives(root, list: string[]) → string[]`(去重排序原子写);`addConsumedArchives(root, bundles: string[]) → string[]`(读旧∪新→原子写)

- [x] **Step 1: 改 import + 写失败测试**(import 行:`import { writeTextAtomic } from './atomic.mjs';` → `import { writeTextAtomic, writeJsonAtomic } from './atomic.mjs';`;测试 import 加 `writeConsumedArchives, addConsumedArchives`)

```js
test('writeConsumedArchives atomically writes deduped sorted list', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(root, { recursive: true });
  const out = writeConsumedArchives(root, ['2026-08-11-bar', '2026-08-10-foo', '2026-08-11-bar']);
  assert.deepEqual(out, ['2026-08-10-foo', '2026-08-11-bar']);
  const file = JSON.parse(readFileSync(distilledMetaPath(root), 'utf8'));
  assert.deepEqual(file, { consumed_archives: ['2026-08-10-foo', '2026-08-11-bar'] });
  assert.ok(!existsSync(`${distilledMetaPath(root)}.${process.pid}.tmp`));
  rmSync(repo, { recursive: true, force: true });
});

test('addConsumedArchives merges new bundles into existing sidecar', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(root, { recursive: true });
  writeConsumedArchives(root, ['2026-08-10-foo']);
  const out = addConsumedArchives(root, ['2026-08-11-bar', '2026-08-10-foo']);
  assert.deepEqual(out, ['2026-08-10-foo', '2026-08-11-bar']);
  rmSync(repo, { recursive: true, force: true });
});

test('addConsumedArchives creates sidecar when missing (bootstrap seed)', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(root, { recursive: true });
  const out = addConsumedArchives(root, ['2026-08-10-foo']);
  assert.deepEqual(out, ['2026-08-10-foo']);
  assert.ok(existsSync(distilledMetaPath(root)));
  rmSync(repo, { recursive: true, force: true });
});
```

- [x] **Step 2: 运行确认失败**

Run: `cd <worktree> && node --test --test-name-pattern="writeConsumedArchives|addConsumedArchives" plugins/speccode/tests/knowledge.test.mjs`
Expected: FAIL —— `writeConsumedArchives is not defined`

- [x] **Step 3: 写最小实现**(`lib/knowledge.mjs` 末尾追加)

```js
// Atomic write of the consumed_archives sidecar (dedup + sort; order is
// irrelevant but sorting keeps diffs stable). Mirrors config/state atomicity.
export function writeConsumedArchives(root, list) {
  const consumed = [...new Set(list.filter((s) => typeof s === 'string'))].sort();
  writeJsonAtomic(distilledMetaPath(root), { consumed_archives: consumed });
  return consumed;
}

// Merge bundles read this distilling run into the existing sidecar
// (read ∪ bundles), then atomically persist. Idempotent: re-adding
// already-consumed bundles is a no-op write (same set).
export function addConsumedArchives(root, bundles) {
  const merged = [...new Set([...readConsumedArchives(root), ...bundles.filter((s) => typeof s === 'string')])];
  return writeConsumedArchives(root, merged);
}
```

- [x] **Step 4: 运行确认通过**

Run: `cd <worktree> && node --test --test-name-pattern="writeConsumedArchives|addConsumedArchives" plugins/speccode/tests/knowledge.test.mjs`
Expected: PASS(3 个新用例)

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/lib/knowledge.mjs plugins/speccode/tests/knowledge.test.mjs
git commit -m "feat(knowledge): writeConsumedArchives + addConsumedArchives atomic sidecar write"
```

---

### Task 3: lib `archiveRoot` + `unconsumedArchives`

**Files:**
- Modify: `plugins/speccode/lib/knowledge.mjs`(末尾追加两 export;`node:fs` 已 import `readdirSync`/`statSync`/`existsSync`,`./git.mjs` 已 import `git`)
- Test: `plugins/speccode/tests/knowledge.test.mjs`

**Interfaces:**
- Consumes: `git`(`./git.mjs`)
- Produces: `archiveRoot(cwd: string) → string`(worktree 根 + `speccode/archive`);`unconsumedArchives(archiveRootPath: string, consumed: string[]) → string[]`(实扫一级目录 ∖ consumed,裸名排序)

- [x] **Step 1: 写失败测试**(测试 import 加 `archiveRoot, unconsumedArchives`)

```js
test('archiveRoot resolves to <worktree-root>/speccode/archive', () => {
  const repo = makeRepo();
  assert.equal(archiveRoot(repo), join(realpathSync(repo), 'speccode', 'archive'));
  rmSync(repo, { recursive: true, force: true });
});

test('unconsumedArchives returns [] when archive/ absent', () => {
  const repo = makeRepo();
  assert.deepEqual(unconsumedArchives(join(repo, 'speccode', 'archive'), []), []);
  rmSync(repo, { recursive: true, force: true });
});

test('unconsumedArchives subtracts consumed dir names and ignores non-dir entries', () => {
  const repo = makeRepo();
  const arch = join(repo, 'speccode', 'archive');
  mkdirSync(join(arch, '2026-08-10-foo'), { recursive: true });
  mkdirSync(join(arch, '2026-08-11-bar'), { recursive: true });
  mkdirSync(join(arch, '2026-08-12-baz'), { recursive: true });
  writeFileSync(join(arch, 'README.md'), 'x'); // 非目录条目须忽略
  assert.deepEqual(unconsumedArchives(arch, ['2026-08-10-foo']), ['2026-08-11-bar', '2026-08-12-baz']);
  rmSync(repo, { recursive: true, force: true });
});

test('unconsumedArchives ignores consumed entries pointing at non-existent bundles (R2 stale harmless)', () => {
  const repo = makeRepo();
  const arch = join(repo, 'speccode', 'archive');
  mkdirSync(join(arch, '2026-08-10-foo'), { recursive: true });
  assert.deepEqual(unconsumedArchives(arch, ['ghost']), ['2026-08-10-foo']);
  rmSync(repo, { recursive: true, force: true });
});
```

- [x] **Step 2: 运行确认失败**

Run: `cd <worktree> && node --test --test-name-pattern="archiveRoot|unconsumedArchives" plugins/speccode/tests/knowledge.test.mjs`
Expected: FAIL —— `archiveRoot is not defined`

- [x] **Step 3: 写最小实现**(`lib/knowledge.mjs` 末尾追加)

```js
// Path to the worktree's speccode/archive/ (tracked, per-worktree, peer of
// speccode/knowledge/). Uses --show-toplevel deliberately — same worktree-root
// resolution as knowledgeRoot (NOT the main-repo --git-common-dir used for
// .speccode/ runtime state). See CLAUDE.md "SDD 工作区 show-toplevel(有意差异)".
export function archiveRoot(cwd) {
  const top = git(['rev-parse', '--show-toplevel'], { cwd }).stdout.trim();
  return join(top, 'speccode', 'archive');
}

// Archive bundles not yet consumed = real archive dir names − consumed set.
// Compares by directory NAME (string), not absolute path, so the macOS
// /var→/private/var realpath issue (C1) does not bite here. Returns [] when
// archive/ is absent (fresh project / no archived changes yet).
export function unconsumedArchives(archiveRootPath, consumed) {
  if (!existsSync(archiveRootPath)) return [];
  const consumedSet = new Set(consumed);
  return readdirSync(archiveRootPath)
    .filter((name) => statSync(join(archiveRootPath, name)).isDirectory())
    .filter((name) => !consumedSet.has(name))
    .sort();
}
```

- [x] **Step 4: 运行确认通过**

Run: `cd <worktree> && node --test --test-name-pattern="archiveRoot|unconsumedArchives" plugins/speccode/tests/knowledge.test.mjs`
Expected: PASS(4 个新用例)

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/lib/knowledge.mjs plugins/speccode/tests/knowledge.test.mjs
git commit -m "feat(knowledge): archiveRoot + unconsumedArchives incremental-set compute"
```

---

### Task 4: bin verbs `read-consumed-archives` + `write-consumed-archives`

**Files:**
- Modify: `plugins/speccode/bin/speccode.mjs`(import 行加新 symbol;`VERBS` 对象加两 entry)
- Test: `plugins/speccode/tests/cli.test.mjs`

**Interfaces:**
- Consumes: Task 1-3 的 `knowledgeRoot`/`archiveRoot`/`readConsumedArchives`/`unconsumedArchives`/`addConsumedArchives`/`distilledMetaPath`;bin 的 `readStdin`/`parseArgs`
- Produces: verb `read-consumed-archives --cwd .` → `{ok, consumed, unconsumed, bootstrap}`;verb `write-consumed-archives --cwd . --json-stdin` → `{ok, consumed}`(stdin `{add:[bundle,...]}`)

- [x] **Step 1: 改 import + 写失败测试**(bin import 行:`import { assertSafeRel, buildIndex, knowledgeRoot, listTopics, parseDistilledBlocks, replaceDistilledBlocks, writeKnowledge } from '../lib/knowledge.mjs';` → 末尾加 `archiveRoot, distilledMetaPath, readConsumedArchives, addConsumedArchives, unconsumedArchives`;cli 测试 import 已有 `spawnSync`/`readFileSync`/`existsSync`/`makeRepo`)

```js
test('read-consumed-archives reports consumed/unconsumed and bootstrap flag', () => {
  const repo = makeRepo();
  const kroot = join(repo, 'speccode', 'knowledge');
  const aroot = join(repo, 'speccode', 'archive');
  mkdirSync(kroot, { recursive: true });
  mkdirSync(join(aroot, '2026-08-10-foo'), { recursive: true });
  mkdirSync(join(aroot, '2026-08-11-bar'), { recursive: true });
  writeFileSync(join(kroot, '_distilled.meta.json'), JSON.stringify({ consumed_archives: ['2026-08-10-foo'] }));
  const { code, json } = runCli(repo, 'read-consumed-archives', '--cwd', repo);
  assert.equal(code, 0);
  assert.deepEqual(json.consumed, ['2026-08-10-foo']);
  assert.deepEqual(json.unconsumed, ['2026-08-11-bar']);
  assert.equal(json.bootstrap, false);
  rmSync(repo, { recursive: true, force: true });
});

test('read-consumed-archives bootstrap when sidecar missing', () => {
  const repo = makeRepo();
  mkdirSync(join(repo, 'speccode', 'archive', '2026-08-10-foo'), { recursive: true });
  const { code, json } = runCli(repo, 'read-consumed-archives', '--cwd', repo);
  assert.equal(code, 0);
  assert.deepEqual(json.consumed, []);
  assert.deepEqual(json.unconsumed, ['2026-08-10-foo']);
  assert.equal(json.bootstrap, true);
  rmSync(repo, { recursive: true, force: true });
});

test('write-consumed-archives reads stdin and merges atomically', () => {
  const repo = makeRepo();
  const kroot = join(repo, 'speccode', 'knowledge');
  mkdirSync(kroot, { recursive: true });
  writeFileSync(join(kroot, '_distilled.meta.json'), JSON.stringify({ consumed_archives: ['a'] }));
  const input = JSON.stringify({ add: ['b', 'a'] });
  const w = spawnSync('node', [BIN, 'write-consumed-archives', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input, encoding: 'utf8' });
  assert.equal(w.status, 0);
  const out = JSON.parse(w.stdout.trim());
  assert.ok(out.ok);
  assert.deepEqual(out.consumed, ['a', 'b']);
  const file = JSON.parse(readFileSync(join(kroot, '_distilled.meta.json'), 'utf8'));
  assert.deepEqual(file.consumed_archives, ['a', 'b']);
  rmSync(repo, { recursive: true, force: true });
});

test('write-consumed-archives without --json-stdin fails', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'write-consumed-archives', '--cwd', repo);
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  rmSync(repo, { recursive: true, force: true });
});
```

- [x] **Step 2: 运行确认失败**

Run: `cd <worktree> && node --test --test-name-pattern="read-consumed-archives|write-consumed-archives" plugins/speccode/tests/cli.test.mjs`
Expected: FAIL —— `unknown verb: read-consumed-archives`(exit 1, ok:false)

- [x] **Step 3: 写最小实现**(`bin/speccode.mjs` 的 `VERBS` 对象内,与 `read-knowledge`/`write-knowledge` 并列加两 entry)

```js
  'read-consumed-archives': ({ cwd }) => {
    const kroot = knowledgeRoot(cwd);
    const aroot = archiveRoot(cwd);
    const consumed = readConsumedArchives(kroot);
    const unconsumed = unconsumedArchives(aroot, consumed);
    return { ok: true, consumed, unconsumed, bootstrap: !existsSync(distilledMetaPath(kroot)) };
  },

  'write-consumed-archives': ({ cwd, 'json-stdin': jsonStdin }) => {
    if (jsonStdin === undefined) return { ok: false, error: 'write-consumed-archives requires --json-stdin' };
    let payload;
    try {
      payload = JSON.parse(readStdin());
    } catch {
      return { ok: false, error: 'invalid JSON on stdin' };
    }
    const add = Array.isArray(payload?.add) ? payload.add : undefined;
    if (!add) return { ok: false, error: 'write-consumed-archives requires {add: [bundle,...]}' };
    const kroot = knowledgeRoot(cwd);
    const consumed = addConsumedArchives(kroot, add);
    return { ok: true, consumed };
  },
```

- [x] **Step 4: 运行确认通过**

Run: `cd <worktree> && node --test --test-name-pattern="read-consumed-archives|write-consumed-archives" plugins/speccode/tests/cli.test.mjs`
Expected: PASS(4 个新用例)

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/bin/speccode.mjs plugins/speccode/tests/cli.test.mjs
git commit -m "feat(speccode): read/write-consumed-archives verbs for incremental distill"
```

---

### Task 5: 命令 prose `commands/distilling-knowledge.md` 改增量读

**Files:**
- Modify: `plugins/speccode/commands/distilling-knowledge.md`(4 处精确替换)
- Test: 无单测(命令 prose);验证 = 改完重读 + 与 spec delta scenario 逐条对照

**Interfaces:**
- Consumes: Task 4 的两 verb(`read-consumed-archives`/`write-consumed-archives`);spec delta 的 8 个 scenario 作对照基准
- Produces: 命令 prose 反映增量读 + carry-forward + stale/superseded + 落盘登记 + 首次引导

- [x] **Step 1: 改「前置」第 7 条(全量读 archive → 增量读)**

old:
```
7. 读 `speccode/spec/`(各 capability 主规格)与 `speccode/archive/`(全部归档 change)。
```
new:
```
7. 读 `speccode/spec/`(各 capability 主规格,**全量**)。archive 改**增量读**:运行 `speccode.mjs read-consumed-archives --cwd .` 得 `{consumed, unconsumed, bootstrap}`——`bootstrap=true`(sidecar `_distilled.meta.json` 缺失)则首次引导,本次全量读 archive 全部归档包;否则只读 `unconsumed` 列出的归档包,`consumed` 包整包跳过(含其 propose/design/brainstorm 子文档)。
```

- [x] **Step 2: 改「蒸馏」第 2 条(加 carry-forward + supersession 两条 bullet)**

在第 2 条既有 bullet `- 块粒度:每个来源一个块;source 格式固定——archive 来源用 \`archive/<归档目录名>/\`,spec 来源用 \`spec/<capability 目录名>/\`;` 之后插入:

new bullets:
```
- **carry-forward**:已消费包(本次未读、source 包仍在)的既有蒸馏块,取自步骤 1 的 `read-knowledge --blocks` 现状侧,**原样**保留进候选列表(不重蒸)——归档包不可变,重蒸仅得相同内容,无信息损失;其 source 在候选列表 → `replaceDistilledBlocks` 保留,不误删。
- **supersession**:若新读的归档包知识取代某既有块(source 包仍在),在候选列表里**省略**该旧块(→ 删除)或**更新**其 body;闸门标「superseded by <新包名>」,与 stale(source 包已删)区分,用户确认。
```

- [x] **Step 3: 改「闸门」stale 段(加 superseded 区分)**

old:
```
source 指向的 archive 或 spec capability 已不存在 → 该块标 stale,闸门内展示给用户,选项:删除该块 / 改 source 后保留。
```
new:
```
source 指向的 archive 或 spec capability 已不存在 → 该块标 **stale**(自动检测),选项:删除该块 / 改 source 后保留。source 包仍在但其知识被新归档包取代 → 该块标 **superseded by <新包名>**(非 stale;distiller 提议、用户确认),选项:删除该块 / 更新 body / 改 source。两种"块被移除"语义 MUST 区分标注。
```

- [x] **Step 4: 改「落盘」段(加登记 consumed_archives 步,置于 _index.md 更新之后、commit 之前)**

在落盘第 1 条(`_index.md` 更新)之后插入新条:

new:
```
2. (新)登记消费:把本次读过的归档包目录名(含读了无产出的;首次引导时 = 本次全量读的全部归档包,即种子),经 `speccode.mjs write-consumed-archives --cwd . --json-stdin` 原子追记进 `_distilled.meta.json`(verb 内部读旧∪新去重):
   ```bash
   speccode.mjs write-consumed-archives --cwd . --json-stdin <<'EOF'
   {"add":["<归档目录名>",...]}
   EOF
   ```
   原有 `_index.md` 更新条顺延为第 3 条,write-memory 条顺延为第 4 条,commit 条为第 5 条(内容不变)。
```

- [x] **Step 5: 验证(重读 + 对照 spec)**

Run: `cd <worktree> && cat plugins/speccode/commands/distilling-knowledge.md` 逐条核对 spec delta(`propose/specs/knowledge-set/spec.md`)8 个 scenario(蒸馏无变化/增量只读未消费包/首次增量引导/删 sidecar 强制全量重蒸/旧块被新包取代/来源已消失/日落移除/首次重蒸迁移旧 marker)在命令 prose 均有对应处置。
Expected: 8 scenario 全部可指到命令 prose 对应段;无遗留"全量读 archive"字样(前置 7 已改)。

- [x] **Step 6: 提交**

```bash
git add plugins/speccode/commands/distilling-knowledge.md
git commit -m "docs(knowledge): distilling-knowledge incremental archive read + carry-forward + supersession gate"
```

---

### Task 6: 全量测试 + 手动冒烟

**Files:**
- 无新增(验证性任务)

**Interfaces:**
- Consumes: Task 1-5 全部产出
- Produces: 绿色全量测试 + 冒烟证据(本仓库 archive/ 实有 22 个归档包,首跑为 22-bundle 全量引导,非空操作)

- [x] **Step 1: 全量测试**

Run: `cd <worktree> && node --test ./plugins/speccode/tests/*.test.mjs`
Expected: 全绿(基线 189 + 新增 16 = 205 pass,0 fail)

- [x] **Step 2: 手动冒烟——增量只读新包**

在临时 repo:`mkdir -p speccode/knowledge speccode/archive/2026-08-10-foo speccode/archive/2026-08-11-bar`;首跑 `read-consumed-archives`(`bootstrap=true`,`unconsumed=[foo,bar]`);`write-consumed-archives {add:[foo,bar]}`;再跑 `read-consumed-archives`(`bootstrap=false`,`unconsumed=[]`)。验证第二次不重读。

- [x] **Step 3: 手动冒烟——stale + 删 sidecar 逃生口**

删 `speccode/archive/2026-08-10-foo` 后 `read-consumed-archives`(`consumed` 仍含 foo 但 `unconsumed` 不受影响,R2 无副作用);删 `_distilled.meta.json` 后 `read-consumed-archives`(`bootstrap=true`,全量重读逃生口)。

- [x] **Step 4: 提交(若有冒烟日志/补丁;无则跳过 commit,本任务为验证不产文件)**

无文件变更 → 不 commit(避免空 commit)。

---

## 计划自查

1. **规格覆盖**:spec delta 8 scenario → Task 5 Step 5 逐条对照;lib/verb 覆盖 D1-D4/D6/D7(Task 1-4);C1/C2 → Global Constraints + Task 3 注释 + Task 4 遵 readStdin 模式。无缺口。
2. **占位符扫描**:无 TBD/TODO;所有代码块为可执行实码;命令 prose 替换为完整 old/new 串。
3. **类型一致性**:`consumed_archives` 全程裸目录名(string[]);`add` 字段统一;`bootstrap` bool;verb 名 `read-consumed-archives`/`write-consumed-archives` 全文一致;`distilledMetaPath`/`readConsumedArchives`/`writeConsumedArchives`/`addConsumedArchives`/`archiveRoot`/`unconsumedArchives` 命名跨任务一致。
