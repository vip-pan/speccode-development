# 知识集(knowledge-set)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 tracked 知识集层 `speccode/knowledge/`(9 个初始 topic 文件 + `_index.md` 索引)+ 晋升命令 `/speccode:promote-knowledge` + 直写命令 `/speccode:memorize` + 9 个认知型命令入口接入(T0 完整闭环)。

**Architecture:** 蒸馏是 LLM 判断,只在命令层做;`lib/knowledge.mjs` 提供确定性纯函数(marker 解析、promoted 块全量替换、索引生成、原子写);新增 `read-knowledge` / `write-knowledge` 两个 verb 支撑命令层;知识根解析用当前 worktree 根(`--show-toplevel`),与主仓根(`--git-common-dir`)刻意区分。设计定稿:`speccode/changes/knowledge-set/brainstorm/2026-08-14-knowledge-set-design.md`(D1-D7)。

**Tech Stack:** Node ≥ 24,纯 ESM,零第三方依赖(仅 `node:` 内置模块)。

## Global Constraints

- 纯 ESM、零第三方依赖;新增代码只 import `node:` 内置模块与既有 lib 模块。
- 所有写操作必须原子写:knowledge/ 写入走 `atomic.writeTextAtomic`(临时文件 + `renameSync`);命令层绝不手写 knowledge/ 或 JSON 文件,一律经 verb。
- 写 verb 必须 `--json-stdin`:从 stdin 读 JSON,不从 argv 传长内容;缺省直接 `{ok:false,error}`。
- knowledge 根解析 = 当前 worktree 根(`git rev-parse --show-toplevel`,见 `lib/sdd.mjs worktreeRoot` 同款理由:tracked 文件随 worktree 各有检出);**刻意区别于**主仓根(`--git-common-dir`),不得「统一」。
- marker 格式固定:`<!-- promoted-from: <source> -->` 与 `<!-- /promoted -->`;promoted 块 body 不得包含这两串 marker 字符串。
- 消费入口静默兜底:knowledge/ 缺失或读取失败 → 跳过,绝不报错、不阻断主流程。
- 全量测试命令:`node --test ./plugins/speccode/tests/*.test.mjs`(裸目录在 Node v24 报 MODULE_NOT_FOUND,勿用)。
- git 相关单测用 `tests/helpers/tmprepo.mjs` 的 `makeRepo()` / `commitFile()` 建真实临时仓库,用完 `rmSync(repo, {recursive:true, force:true})` 清理。
- verb e2e 用 `spawnSync('node', [BIN, ...])`;写 verb 用 `input` 传 stdin;`BIN` 用 `import.meta.url` 定位(现有 cli.test.mjs 已如此)。
- 提交信息沿用 `docs(speccode): ...` / `feat: ...` 前缀;全程中文交互。
- 文档四版本(根 README EN/CN + 插件 README EN/CN)结构一一对应,任何内容改动同步全部语言版本;README 不得硬编码版本号与测试数量。
- 任务间只通过 Interfaces 段声明的签名耦合,实现者看不到相邻任务全文。

---

### Task 1: lib/knowledge.mjs 基础(knowledgeRoot + assertSafeRel + listTopics)

**Files:**
- Create: `plugins/speccode/lib/knowledge.mjs`
- Create: `plugins/speccode/tests/knowledge.test.mjs`

**Interfaces:**
- Consumes: `git(args, opts)` from `../lib/git.mjs`(返回 `{code, stdout, stderr}`);`makeRepo()` from `./helpers/tmprepo.mjs`(返回临时仓库绝对路径)。
- Produces:
  - `knowledgeRoot(cwd)` → String(当前 worktree 根的 `speccode/knowledge` 绝对路径)
  - `assertSafeRel(rel)` → `{ok:true, rel}` 或 `{ok:false, error}`
  - `listTopics(root)` → `{files: string[], index: string|null}`(files 为 .md 相对路径,升序,不含 `_index.md`;index 为 `_index.md` 内容或 null)

- [ ] **Step 1: 写失败测试**

```js
// plugins/speccode/tests/knowledge.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { knowledgeRoot, assertSafeRel, listTopics } from '../lib/knowledge.mjs';
import { makeRepo } from './helpers/tmprepo.mjs';

test('knowledgeRoot resolves to <worktree-root>/speccode/knowledge', () => {
  const repo = makeRepo();
  assert.equal(knowledgeRoot(repo), join(repo, 'speccode', 'knowledge'));
  rmSync(repo, { recursive: true, force: true });
});

test('assertSafeRel accepts simple relative paths', () => {
  assert.deepEqual(assertSafeRel('business/domain.md'), { ok: true, rel: 'business/domain.md' });
  assert.deepEqual(assertSafeRel('_index.md'), { ok: true, rel: '_index.md' });
});

test('assertSafeRel rejects traversal, absolute and backslash paths', () => {
  for (const bad of ['../x.md', 'a/../b.md', '/abs.md', 'a//b.md', './x.md', 'a\\b.md', '']) {
    assert.equal(assertSafeRel(bad).ok, false, JSON.stringify(bad));
  }
});

test('listTopics walks .md files recursively, excludes _index.md and non-md files', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(join(root, 'business'), { recursive: true });
  mkdirSync(join(root, 'development'), { recursive: true });
  writeFileSync(join(root, '_index.md'), '# 知识索引\n');
  writeFileSync(join(root, 'business', 'domain.md'), '# d\n');
  writeFileSync(join(root, 'development', 'pitfalls.md'), '# p\n');
  writeFileSync(join(root, 'notes.txt'), 'nope');
  const { files, index } = listTopics(root);
  assert.deepEqual(files, ['business/domain.md', 'development/pitfalls.md']);
  assert.equal(index, '# 知识索引\n');
  rmSync(repo, { recursive: true, force: true });
});

test('listTopics on missing root returns empty files and null index', () => {
  const repo = makeRepo();
  const { files, index } = listTopics(join(repo, 'speccode', 'knowledge'));
  assert.deepEqual(files, []);
  assert.equal(index, null);
  rmSync(repo, { recursive: true, force: true });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test plugins/speccode/tests/knowledge.test.mjs`
Expected: FAIL — `Cannot find module '../lib/knowledge.mjs'`

- [ ] **Step 3: 写最小实现**

```js
// plugins/speccode/lib/knowledge.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { writeTextAtomic } from './atomic.mjs';
import { git } from './git.mjs';

// Tracked, curated knowledge set: <repo>/speccode/knowledge/ (peer of
// speccode/spec/ + changes/ + archive/ — tracked, ships with PRs, team-shared).
// Root = CURRENT worktree root (`--show-toplevel`), deliberately NOT the
// main-repo root used for .speccode/ runtime state: each worktree has its own
// checkout of tracked files (same deliberate split as lib/sdd.mjs worktreeRoot).
export function knowledgeRoot(cwd) {
  const top = git(['rev-parse', '--show-toplevel'], { cwd }).stdout.trim();
  return join(top, 'speccode', 'knowledge');
}

// Guard for write-knowledge --rel: simple forward-slash relative paths only.
export function assertSafeRel(rel) {
  const s = String(rel);
  if (s.includes('\\') || s.startsWith('/') || s.includes('\0')) {
    return { ok: false, error: 'rel must be a simple forward-slash relative path' };
  }
  const parts = s.split('/');
  if (parts.some((seg) => seg === '' || seg === '.' || seg === '..')) {
    return { ok: false, error: 'rel must not contain empty, . or .. segments' };
  }
  return { ok: true, rel: s };
}

// Recursively list knowledge topic files (rel paths, .md only, `_index.md`
// excluded) plus the current index content (null when missing).
export function listTopics(root) {
  const files = [];
  const walk = (dir, rel) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      const r = rel ? `${rel}/${name}` : name;
      if (statSync(p).isDirectory()) walk(p, r);
      else if (name.endsWith('.md')) files.push(r);
    }
  };
  walk(root, '');
  const indexPath = join(root, '_index.md');
  return {
    files: files.filter((f) => f !== '_index.md'),
    index: existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : null,
  };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test plugins/speccode/tests/knowledge.test.mjs`
Expected: PASS(5 用例)

- [ ] **Step 5: 提交**

```bash
git add plugins/speccode/lib/knowledge.mjs plugins/speccode/tests/knowledge.test.mjs
git commit -m "feat: add knowledge lib foundation (knowledgeRoot, assertSafeRel, listTopics)"
```

---

### Task 2: parsePromotedBlocks + replacePromotedBlocks(来源标记核心)

**Files:**
- Modify: `plugins/speccode/lib/knowledge.mjs`(追加)
- Modify: `plugins/speccode/tests/knowledge.test.mjs`(追加用例)

**Interfaces:**
- Consumes: Task 1 的 `knowledge.mjs` 模块本体(在同一文件内追加,无新导入)。
- Produces:
  - `parsePromotedBlocks(text)` → `[{source, body}]`;marker 损坏时 throw(`knowledge: nested promoted marker` / `knowledge: closing promoted marker without opening` / `knowledge: unclosed promoted marker`)
  - `replacePromotedBlocks(text, blocks)` → String(blocks: `[{source, body}]`;全量重建语义:同 source 块替换、消失的 source 块整体删除、新 source 块追加到文件末尾(前补空行);块外内容逐字节保留)

- [ ] **Step 1: 写失败测试**

```js
// 追加到 plugins/speccode/tests/knowledge.test.mjs(import 行补 parsePromotedBlocks / replacePromotedBlocks)
test('parsePromotedBlocks extracts source and body', () => {
  const text = [
    '# topic',
    '<!-- promoted-from: archive/a/ -->',
    'body line 1',
    'body line 2',
    '<!-- /promoted -->',
    'hand written',
  ].join('\n');
  assert.deepEqual(parsePromotedBlocks(text), [
    { source: 'archive/a/', body: 'body line 1\nbody line 2' },
  ]);
});

test('parsePromotedBlocks throws on unclosed marker', () => {
  assert.throws(() => parsePromotedBlocks('<!-- promoted-from: x -->\nno end'));
});

test('parsePromotedBlocks throws on close without open', () => {
  assert.throws(() => parsePromotedBlocks('<!-- /promoted -->'));
});

test('replacePromotedBlocks keeps hand-written lines byte-identical', () => {
  const text = 'hand A\n<!-- promoted-from: old/ -->\nold body\n<!-- /promoted -->\nhand B';
  const out = replacePromotedBlocks(text, [{ source: 'old/', body: 'new body' }]);
  assert.equal(out, 'hand A\n<!-- promoted-from: old/ -->\nnew body\n<!-- /promoted -->\nhand B');
});

test('replacePromotedBlocks drops promoted blocks whose source is gone and appends new sources', () => {
  const text = 'keep\n<!-- promoted-from: gone/ -->\nold\n<!-- /promoted -->\ntail';
  const out = replacePromotedBlocks(text, [{ source: 'fresh/', body: 'new' }]);
  assert.equal(out, 'keep\ntail\n\n<!-- promoted-from: fresh/ -->\nnew\n<!-- /promoted -->');
});

test('replacePromotedBlocks appends blocks to empty text without leading newline', () => {
  const out = replacePromotedBlocks('', [{ source: 'x/', body: 'b' }]);
  assert.equal(out, '<!-- promoted-from: x/ -->\nb\n<!-- /promoted -->');
});

test('replacePromotedBlocks throws on malformed existing markers', () => {
  assert.throws(() => replacePromotedBlocks('a\n<!-- promoted-from: x -->\nno end', []));
  assert.throws(() => replacePromotedBlocks('a\n<!-- /promoted -->\n', []));
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test plugins/speccode/tests/knowledge.test.mjs`
Expected: FAIL — `parsePromotedBlocks is not a function`(ReferenceError)

- [ ] **Step 3: 写最小实现**

```js
// 追加到 plugins/speccode/lib/knowledge.mjs
const PROMOTED_START = /^<!-- promoted-from:\s*(.+?)\s*-->$/;
const PROMOTED_END = '<!-- /promoted -->';

// Extract promoted blocks as [{source, body}]. Malformed markers throw —
// corrupted knowledge files need a human, never silent repair (design D5).
export function parsePromotedBlocks(text) {
  const blocks = [];
  const lines = String(text).split('\n');
  let open = null;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = PROMOTED_START.exec(line);
    if (m) {
      if (open) throw new Error('knowledge: nested promoted marker');
      open = { source: m[1].trim(), start: i };
    } else if (line.trim() === PROMOTED_END) {
      if (!open) throw new Error('knowledge: closing promoted marker without opening');
      blocks.push({ source: open.source, body: lines.slice(open.start + 1, i).join('\n') });
      open = null;
    }
    i += 1;
  }
  if (open) throw new Error('knowledge: unclosed promoted marker');
  return blocks;
}

// Full rebuild of promoted blocks (design D2): every existing promoted block
// is replaced by the new block with the same source, or dropped when its
// source is gone; new sources are appended at the end (preceded by a blank
// line). Everything outside markers passes through untouched, so hand-written
// content is preserved byte-for-byte (split/join is lossless).
export function replacePromotedBlocks(text, blocks) {
  const lines = text === '' ? [] : String(text).split('\n');
  const out = [];
  const emitted = new Set();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = PROMOTED_START.exec(line);
    if (m) {
      const source = m[1].trim();
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== PROMOTED_END) j += 1;
      if (j >= lines.length) throw new Error('knowledge: unclosed promoted marker');
      const block = blocks.find((b) => b.source === source);
      if (block) {
        out.push(`<!-- promoted-from: ${source} -->`, block.body, PROMOTED_END);
        emitted.add(source);
      }
      i = j + 1;
      continue;
    }
    if (line.trim() === PROMOTED_END) {
      throw new Error('knowledge: closing promoted marker without opening');
    }
    out.push(line);
    i += 1;
  }
  for (const b of blocks) {
    if (emitted.has(b.source)) continue;
    if (out.length > 0 && out[out.length - 1] !== '') out.push('');
    out.push(`<!-- promoted-from: ${b.source} -->`, b.body, PROMOTED_END);
  }
  return out.join('\n');
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test plugins/speccode/tests/knowledge.test.mjs`
Expected: PASS(12 用例)

- [ ] **Step 5: 提交**

```bash
git add plugins/speccode/lib/knowledge.mjs plugins/speccode/tests/knowledge.test.mjs
git commit -m "feat: add promoted-block parsing and full rebuild (source markers)"
```

---

### Task 3: buildIndex + writeKnowledge

**Files:**
- Modify: `plugins/speccode/lib/knowledge.mjs`(追加)
- Modify: `plugins/speccode/tests/knowledge.test.mjs`(追加用例)

**Interfaces:**
- Consumes: `writeTextAtomic(path, text)` from `../lib/atomic.mjs`;Task 1 的 `knowledgeRoot`。
- Produces:
  - `buildIndex(entries)` → String(entries: `[{section, items: [{title, file, summary}]}]`;输出 `# 知识索引` + `## <section>` + `- <title> → <file>:<summary>`,末尾换行)
  - `writeKnowledge(root, rel, content)` → String(写入文件的绝对路径;原子写,mkdir 由 writeTextAtomic 内部完成)

- [ ] **Step 1: 写失败测试**

```js
// 追加到 plugins/speccode/tests/knowledge.test.mjs(import 行补 buildIndex / writeKnowledge)
test('buildIndex renders sections with topic lines', () => {
  const out = buildIndex([
    {
      section: '业务方向',
      items: [{ title: '领域知识', file: 'business/domain.md', summary: '术语与领域模型' }],
    },
  ]);
  assert.equal(out, '# 知识索引\n\n## 业务方向\n- 领域知识 → business/domain.md:术语与领域模型\n');
});

test('writeKnowledge writes atomically and creates parent dirs', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  const p = writeKnowledge(root, 'business/domain.md', '# 领域知识\n');
  assert.equal(p, join(root, 'business', 'domain.md'));
  assert.equal(readFileSync(p, 'utf8'), '# 领域知识\n');
  assert.ok(!existsSync(`${p}.${process.pid}.tmp`));
  rmSync(repo, { recursive: true, force: true });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test plugins/speccode/tests/knowledge.test.mjs`
Expected: FAIL — `buildIndex is not a function`(ReferenceError)

- [ ] **Step 3: 写最小实现**

```js
// 追加到 plugins/speccode/lib/knowledge.mjs
// Render the _index.md retrieval entry: grouped topic lines with one-line
// summaries. Deterministic — regenerate on demand (design: 索引失修时重建).
export function buildIndex(entries) {
  const lines = ['# 知识索引'];
  for (const { section, items } of entries) {
    lines.push('', `## ${section}`);
    for (const { title, file, summary } of items) {
      lines.push(`- ${title} → ${file}:${summary}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

// Atomic write of a knowledge file (rel must already be validated by
// assertSafeRel at the verb layer).
export function writeKnowledge(root, rel, content) {
  const p = join(root, rel);
  writeTextAtomic(p, content);
  return p;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test plugins/speccode/tests/knowledge.test.mjs`
Expected: PASS(14 用例)

- [ ] **Step 5: 提交**

```bash
git add plugins/speccode/lib/knowledge.mjs plugins/speccode/tests/knowledge.test.mjs
git commit -m "feat: add knowledge index builder and atomic write helper"
```

---

### Task 4: read-knowledge verb + e2e

**Files:**
- Modify: `plugins/speccode/bin/speccode.mjs`(第 1 行 import 加 `existsSync`;新增 knowledge import;VERBS 增 `read-knowledge`)
- Modify: `plugins/speccode/tests/cli.test.mjs`(追加用例)

**Interfaces:**
- Consumes: Task 1 的 `knowledgeRoot` / `listTopics`;cli.test.mjs 既有 `runCli(cwd, ...args)` → `{code, json}` 与 `BIN`。
- Produces: verb `read-knowledge --cwd . [--index | --topic <name> [--blocks] | (无 flag)]`:
  - `--index` → `{ok:true, exists, path:'_index.md', content}`(缺失时 exists:false, content:null,exit 0)
  - `--topic <name>` → 按 `name`/`name.md` 精确或 `/name.md` 后缀匹配 topic 文件;未命中 `{ok:true, exists:false, path:want, content:null}`
  - `--topic <name> --blocks` → `{ok:true, exists, path, blocks:[{source,body}]}`(经 parsePromotedBlocks 解析,与 `--index` 互斥)
  - 无 flag → `{ok:true, files, index}`

- [ ] **Step 1: 写失败测试**

```js
// 追加到 plugins/speccode/tests/cli.test.mjs 末尾
test('read-knowledge --index returns content and exists flag', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(join(root, 'business'), { recursive: true });
  writeFileSync(join(root, '_index.md'), '# 知识索引\n');
  writeFileSync(join(root, 'business', 'domain.md'), '# 领域知识\n');
  const { code, json } = runCli(repo, 'read-knowledge', '--cwd', repo, '--index');
  assert.equal(code, 0);
  assert.equal(json.exists, true);
  assert.equal(json.content, '# 知识索引\n');
  rmSync(repo, { recursive: true, force: true });
});

test('read-knowledge --topic resolves by basename', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(join(root, 'business'), { recursive: true });
  writeFileSync(join(root, 'business', 'domain.md'), '# 领域知识\n');
  const { code, json } = runCli(repo, 'read-knowledge', '--cwd', repo, '--topic', 'domain');
  assert.equal(code, 0);
  assert.equal(json.exists, true);
  assert.equal(json.path, 'business/domain.md');
  assert.equal(json.content, '# 领域知识\n');
  rmSync(repo, { recursive: true, force: true });
});

test('read-knowledge on project without knowledge dir returns exists false, exit 0', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'read-knowledge', '--cwd', repo, '--index');
  assert.equal(code, 0);
  assert.equal(json.ok, true);
  assert.equal(json.exists, false);
  assert.equal(json.content, null);
  rmSync(repo, { recursive: true, force: true });
});

test('read-knowledge without flags lists files and index', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(join(root, 'business'), { recursive: true });
  writeFileSync(join(root, 'business', 'domain.md'), '# 领域知识\n');
  const { code, json } = runCli(repo, 'read-knowledge', '--cwd', repo);
  assert.equal(code, 0);
  assert.deepEqual(json.files, ['business/domain.md']);
  assert.equal(json.index, null);
  rmSync(repo, { recursive: true, force: true });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test plugins/speccode/tests/cli.test.mjs --test-name-pattern="read-knowledge"`
Expected: FAIL — 4 个用例 `code` 为 1、`json.ok` 为 false(未知 verb)

- [ ] **Step 3: 写最小实现**

```js
// plugins/speccode/bin/speccode.mjs
// 第 1 行改为:
import { existsSync, readFileSync } from 'node:fs';
// 在 memory import 之后加:
import { assertSafeRel, buildIndex, knowledgeRoot, listTopics, parsePromotedBlocks, replacePromotedBlocks, writeKnowledge } from '../lib/knowledge.mjs';
// VERBS 内(write-memory 之后)加:
'read-knowledge': ({ cwd, index, topic, blocks }) => {
  const root = knowledgeRoot(cwd);
  if (index) {
    const p = join(root, '_index.md');
    return existsSync(p)
      ? { ok: true, exists: true, path: '_index.md', content: readFileSync(p, 'utf8') }
      : { ok: true, exists: false, path: '_index.md', content: null };
  }
  if (topic) {
    const want = topic.endsWith('.md') ? topic : `${topic}.md`;
    const { files } = listTopics(root);
    const match = files.find((f) => f === want || f.endsWith(`/${want}`));
    if (!match) return { ok: true, exists: false, path: want, content: null };
    const content = readFileSync(join(root, match), 'utf8');
    if (blocks) return { ok: true, exists: true, path: match, blocks: parsePromotedBlocks(content) };
    return { ok: true, exists: true, path: match, content };
  }
  const { files, index: idx } = listTopics(root);
  return { ok: true, files, index: idx };
},
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test plugins/speccode/tests/cli.test.mjs --test-name-pattern="read-knowledge"`
Expected: PASS(4 用例)

- [ ] **Step 5: 提交**

```bash
git add plugins/speccode/bin/speccode.mjs plugins/speccode/tests/cli.test.mjs
git commit -m "feat: add read-knowledge verb"
```

---

### Task 5: write-knowledge verb + e2e

**Files:**
- Modify: `plugins/speccode/bin/speccode.mjs`(VERBS 增 `write-knowledge`;import 已在 Task 4 就位,无需再改)
- Modify: `plugins/speccode/tests/cli.test.mjs`(追加用例)

**Interfaces:**
- Consumes: Task 1 `assertSafeRel` / `knowledgeRoot`;Task 2 `replacePromotedBlocks`;Task 3 `buildIndex` / `writeKnowledge`;Task 4 的 bin import。
- Produces: verb `write-knowledge --cwd . --rel <path> --json-stdin`,stdin payload `{mode, content?, blocks?, entries?}`:
  - `mode:"replace"` → 全文件原子写 `content`;`{ok:true, path:rel}`
  - `mode:"append-hand"` → 追加 `content` 到文件尾(既有内容无尾换行且新内容无头换行时补一个 `\n`)
  - `mode:"replace-promoted"` → `blocks:[{source,body}]` 经 `replacePromotedBlocks` 重建后原子写
  - `mode:"index"` → `entries:[{section, items:[{title, file, summary}]}]` 经 `buildIndex` 渲染后原子写;缺 entries → `{ok:false, error}` + exit 1
  - 缺 `--json-stdin` / 缺 `--rel` / rel 不合法 / JSON 解析失败 / 未知 mode / replace-promoted 缺 blocks → `{ok:false, error}` + exit 1

- [ ] **Step 1: 写失败测试**

```js
// 追加到 plugins/speccode/tests/cli.test.mjs 末尾
function runCliStdin(repo, ...args) {
  const input = args.pop();
  const r = spawnSync('node', [BIN, ...args], { cwd: repo, encoding: 'utf8', input });
  return { code: r.status, json: JSON.parse(r.stdout.trim()) };
}

test('write-knowledge replace writes atomically via stdin JSON', () => {
  const repo = makeRepo();
  const { code, json } = runCliStdin(repo, 'write-knowledge', '--cwd', repo, '--rel', 'business/domain.md', '--json-stdin',
    JSON.stringify({ mode: 'replace', content: '# 领域知识\n' }));
  assert.equal(code, 0);
  assert.equal(json.ok, true);
  assert.equal(json.path, 'business/domain.md');
  assert.equal(readFileSync(join(repo, 'speccode', 'knowledge', 'business', 'domain.md'), 'utf8'), '# 领域知识\n');
  rmSync(repo, { recursive: true, force: true });
});

test('write-knowledge append-hand appends hand-written section', () => {
  const repo = makeRepo();
  const p = join(repo, 'speccode', 'knowledge', 'development', 'pitfalls.md');
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, '# 坑\n');
  const { code, json } = runCliStdin(repo, 'write-knowledge', '--cwd', repo, '--rel', 'development/pitfalls.md', '--json-stdin',
    JSON.stringify({ mode: 'append-hand', content: '## 手写\n新坑一条\n' }));
  assert.equal(code, 0);
  assert.equal(json.ok, true);
  assert.equal(readFileSync(p, 'utf8'), '# 坑\n## 手写\n新坑一条\n');
  rmSync(repo, { recursive: true, force: true });
});

test('write-knowledge replace-promoted rebuilds only promoted blocks', () => {
  const repo = makeRepo();
  const p = join(repo, 'speccode', 'knowledge', 'development', 'pitfalls.md');
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, 'hand A\n<!-- promoted-from: old/ -->\nold body\n<!-- /promoted -->\nhand B\n');
  const { code, json } = runCliStdin(repo, 'write-knowledge', '--cwd', repo, '--rel', 'development/pitfalls.md', '--json-stdin',
    JSON.stringify({ mode: 'replace-promoted', blocks: [{ source: 'old/', body: 'new body' }] }));
  assert.equal(code, 0);
  assert.equal(json.ok, true);
  assert.equal(readFileSync(p, 'utf8'), 'hand A\n<!-- promoted-from: old/ -->\nnew body\n<!-- /promoted -->\nhand B\n');
  rmSync(repo, { recursive: true, force: true });
});

test('write-knowledge rejects unsafe rel with exit 1', () => {
  const repo = makeRepo();
  const { code, json } = runCliStdin(repo, 'write-knowledge', '--cwd', repo, '--rel', '../evil.md', '--json-stdin',
    JSON.stringify({ mode: 'replace', content: 'x' }));
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  rmSync(repo, { recursive: true, force: true });
});

test('write-knowledge requires --json-stdin', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'write-knowledge', '--cwd', repo, '--rel', 'a.md');
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  rmSync(repo, { recursive: true, force: true });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test plugins/speccode/tests/cli.test.mjs --test-name-pattern="write-knowledge"`
Expected: FAIL — 5 个用例 `code` 为 1、`json.ok` 为 false(未知 verb)

- [ ] **Step 3: 写最小实现**

```js
// plugins/speccode/bin/speccode.mjs VERBS 内(read-knowledge 之后)加:
'write-knowledge': ({ cwd, rel, 'json-stdin': jsonStdin }) => {
  if (jsonStdin === undefined) return { ok: false, error: 'write-knowledge requires --json-stdin' };
  if (!rel) return { ok: false, error: 'write-knowledge requires --rel' };
  const safe = assertSafeRel(rel);
  if (!safe.ok) return { ok: false, error: safe.error };
  let payload;
  try {
    payload = JSON.parse(jsonStdin);
  } catch {
    return { ok: false, error: 'invalid JSON on stdin' };
  }
  const root = knowledgeRoot(cwd);
  const target = join(root, safe.rel);
  const { mode, content, blocks, entries } = payload;
  if (mode === 'replace') {
    writeKnowledge(root, safe.rel, String(content ?? ''));
    return { ok: true, path: safe.rel };
  }
  if (mode === 'append-hand') {
    const existing = existsSync(target) ? readFileSync(target, 'utf8') : '';
    const sep = existing && !existing.endsWith('\n') && !String(content ?? '').startsWith('\n') ? '\n' : '';
    writeKnowledge(root, safe.rel, existing + sep + String(content ?? ''));
    return { ok: true, path: safe.rel };
  }
  if (mode === 'replace-promoted') {
    if (!Array.isArray(blocks)) return { ok: false, error: 'mode replace-promoted requires blocks: [{source, body}]' };
    const existing = existsSync(target) ? readFileSync(target, 'utf8') : '';
    writeKnowledge(root, safe.rel, replacePromotedBlocks(existing, blocks));
    return { ok: true, path: safe.rel };
  }
  if (mode === 'index') {
    if (!Array.isArray(entries)) return { ok: false, error: 'mode index requires entries: [{section, items: [{title, file, summary}]}]' };
    writeKnowledge(root, safe.rel, buildIndex(entries));
    return { ok: true, path: safe.rel };
  }
  return { ok: false, error: `unknown mode: ${mode}` };
},
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test plugins/speccode/tests/cli.test.mjs --test-name-pattern="write-knowledge"`
Expected: PASS(5 用例)

- [ ] **Step 5: 提交**

```bash
git add plugins/speccode/bin/speccode.mjs plugins/speccode/tests/cli.test.mjs
git commit -m "feat: add write-knowledge verb (replace / append-hand / replace-promoted)"
```

---

### Task 6: /speccode:promote-knowledge 命令

**Files:**
- Create: `plugins/speccode/commands/promote-knowledge.md`

**Interfaces:**
- Consumes: verb `read-knowledge`(Task 4,含 `--topic --blocks`)、`write-knowledge`(Task 5,含 mode:index)、`read-memory` / `write-memory`(既有);既有 `run-hook` 不需要(晋升不触发 hook,Non-Goals)。verb surface 以 Task 4 / Task 5 修正后为准(含 `--blocks` 与 mode:"index")。
- Produces: 命令 prose(无代码 API),供命令层 LLM 执行。

- [ ] **Step 1: 写命令文件(全文)**

```markdown
---
name: "SpecCode: Promote Knowledge"
description: "从 spec/ 与 archive/ 蒸馏知识集:全量重蒸 promoted 段,经人工闸门落盘 speccode/knowledge/"
category: Workflow
tags: [speccode, workflow, knowledge]
---

从 `speccode/spec/` 与 `speccode/archive/` 蒸馏知识集,全量重蒸 `speccode/knowledge/` 各 topic 文件的 promoted 段,经人工闸门落盘。全程中文交互。**应在 worktree-* 分支上运行**。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. **trunk 防护**:`git rev-parse --abbrev-ref HEAD` 必须以 `config.worktree_prefix`(默认 `worktree-`)开头;否则退出并提示"请在 worktree 分支上运行本命令"(防止直提 trunk)。
3. **绑定功能分支**:运行 `speccode.mjs reconcile --cwd .`,用返回的 features 找到当前 worktree 所属的功能分支 F;找不到 → 报错"当前 worktree 无法关联任何 active feature",退出。
4. 运行 `speccode.mjs read-memory --cwd . --branch <F>` 读取本 feature 记忆作为既有上下文参考。
5. 运行 `speccode.mjs read-knowledge --cwd .`(无 flag)获取现状:`files`(topic 清单)与 `index`(`_index.md` 内容,可能为 null)。
6. `speccode/knowledge/` 不存在 → 本命令创建骨架:9 个初始 topic 空文件(business/domain.md、business/workflows.md、business/lineage.md、development/architecture.md、development/standards.md、development/environment.md、development/integrations.md、development/pitfalls.md、development/security.md)+ `_index.md`。创建机制:对 9 个文件逐个执行 `write-knowledge --rel <file> --json-stdin`(mode=replace,content 为空串)创建空文件,再执行 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries 为业务方向/开发方向两个空清单 section)创建索引——绝不 mkdir/touch/手写文件(命令层绝不手写 knowledge/,一律经 verb)。
7. 读 `speccode/spec/`(各 capability 主规格)与 `speccode/archive/`(全部归档 change)。
8. 若 `knowledge_tools`(config)非空且其能力在会话中可用,读 spec/archive 时优先参考;不可用回退直接读文件,不报错。

## 蒸馏

1. 逐 topic 蒸馏,先取现状:`speccode.mjs read-knowledge --cwd . --topic <topic名> --blocks` 返回该 topic 现有 promoted 块(`blocks: [{source, body}]`),作为候选 diff 的现状侧。
2. 从 spec/ 与 archive/ 提炼「该主题下值得长期记住的事实/准则/坑」,生成该 topic 的 promoted 块集合:
   - 块粒度:每个来源一个块;source 格式固定——archive 来源用 `archive/<归档目录名>/`,spec 来源用 `spec/<capability 目录名>/`;
   - 现有 hand-written 段作为蒸馏参考上下文,可引用其事实,但不得把其中内容复制为 promoted 块(手写段原样保留在文件中);
   - 无内容可蒸且该 topic 此前也无 promoted 块 → 产出空 blocks 数组(文件保持现状);该 topic 已有 promoted 块时,blocks 为空意味着其现有 promoted 块将被删除(全量重建语义)。
   - promoted 块 body 不得包含 `<!--` 或 `-->` 字符串。
3. 汇总候选:对每个 topic 列出 `blocks: [{source, body}]`,与现状 diff 展示(新增/变化/删除的 promoted 块;现有 source 不在新列表中的块将被删除)。

## 闸门

用 AskUserQuestion 逐 topic 确认(提供「全部确认」选项):
- 确认 → 该 topic 经 `write-knowledge --rel <topic路径> --json-stdin`(mode=replace-promoted,blocks=候选)原子写;
- 拒绝/修改 → 按用户反馈调整后重展示。

source 指向的 archive 或 spec capability 已不存在 → 该块标 stale,闸门内展示给用户,选项:删除该块 / 改 source 后保留。

## 落盘

1. 各 topic 写入完成后更新 `_index.md`:为每个 topic 文件生成一行摘要(标题 + 文件 + 一句话摘要),组装 entries(业务方向 section + 开发方向 section),经 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries=...)写入。
2. 经 `speccode.mjs write-memory --cwd . --branch <F> --json-stdin`(mode=append)追加本次晋升摘要(哪些 topic 变化/无变化/新增)。
3. 全部写入完成后 MUST 立即提交:
   ```bash
   git add speccode/knowledge/
   git commit -m "docs(knowledge): promote knowledge set"
   ```
4. 报告:哪些 topic 变化/无变化/新增。

## 约束

- 只写 `speccode/knowledge/`,绝不写 `speccode/spec/`(那是 syncing 的职责)。
- 幂等:某 topic 蒸馏结果与现状无差异 → 跳过写,报告「无变化」。
- marker 解析失败(报错)→ 停下报告给用户,不猜测修复。
```

- [ ] **Step 2: 对照 spec 走查**

对照 `speccode/changes/knowledge-set/propose/specs/knowledge-set/spec.md` 逐条核对:
- 「知识集目录结构」Scenario 1(骨架创建)与 Scenario 2(索引重建)→ 前置 2 / 落盘 1 ✓
- 「晋升命令」全量重蒸 / 闸门 / 幂等 / stale source 处置 → 蒸馏 1 / 闸门 / 约束 ✓
Expected: 全部 requirement 有对应段落,无遗漏。

- [ ] **Step 3: 全量测试回归**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS(本任务无代码变更,测试数量不变,全绿)

- [ ] **Step 4: 提交**

```bash
git add plugins/speccode/commands/promote-knowledge.md
git commit -m "docs(speccode): add promote-knowledge command"
```

---

### Task 7: /speccode:memorize 命令

**Files:**
- Create: `plugins/speccode/commands/memorize.md`

**Interfaces:**
- Consumes: verb `read-knowledge`(Task 4)、`write-knowledge`(Task 5)。
- Produces: 命令 prose(无代码 API)。

- [ ] **Step 1: 写命令文件(全文)**

```markdown
---
name: "SpecCode: Memorize"
description: "把知识直接写进知识集:经人工闸门写入 speccode/knowledge/ 的 hand-written 段"
category: Workflow
tags: [speccode, workflow, knowledge]
---

把用户/agent 提供的知识直接写进 `speccode/knowledge/`(hand-written 段),经人工闸门落盘。全程中文交互。**应在 worktree-* 分支上运行**。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. **trunk 防护**:`git rev-parse --abbrev-ref HEAD` 必须以 `config.worktree_prefix`(默认 `worktree-`)开头;否则退出并提示"请在 worktree 分支上运行本命令"(防止直提 trunk)。
3. **绑定功能分支**:运行 `speccode.mjs reconcile --cwd .`,用返回的 features 找到当前 worktree 所属的功能分支 F;找不到 → 报错"当前 worktree 无法关联任何 active feature",退出。
4. 运行 `speccode.mjs read-memory --cwd . --branch <F>` 读取本 feature 记忆作为既有上下文参考。
5. 运行 `speccode.mjs read-knowledge --cwd .`(无 flag)获取现状(topic 清单 + 索引)。
6. `speccode/knowledge/` 不存在 → 创建骨架:9 个初始 topic 空文件(business/domain.md、business/workflows.md、business/lineage.md、development/architecture.md、development/standards.md、development/environment.md、development/integrations.md、development/pitfalls.md、development/security.md)+ `_index.md`。创建机制:对 9 个文件逐个执行 `write-knowledge --rel <file> --json-stdin`(mode=replace,content 为空串)创建空文件,再执行 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries 为业务方向/开发方向两个空清单 section)创建索引——绝不 mkdir/touch/手写文件(命令层绝不手写 knowledge/,一律经 verb)。

## 收集内容

向用户询问(选择题优先):
- 主题:映射到现有 topic(如「开发准则」→ development/standards.md);无合适 topic → 询问是否新建 topic 文件(文件名小写连字符,`.md` 结尾)。
- 内容:用户/agent 给出的知识文本。

## 闸门

展示草稿(写入位置 + 内容)→ AskUserQuestion 确认:
- 确认 → `write-knowledge --rel <topic路径> --json-stdin`(mode=append-hand,content=内容)原子写(追加为 hand-written 段,不带 marker);
- 修改 → 按反馈调整后重展示。

## 落盘

1. `_index.md` 需更新时(新 topic、摘要变化、或索引缺失——read-knowledge 返回 index 为 null 但 topic 文件存在)→ 组装 entries(业务方向 section + 开发方向 section),经 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries=...)写入新索引内容。
2. 经 `speccode.mjs write-memory --cwd . --branch <F> --json-stdin`(mode=append)追加本次 memorize 摘要(写入位置 + topic)。
3. MUST 立即提交:
   ```bash
   git add speccode/knowledge/
   git commit -m "docs(knowledge): memorize <topic>"
   ```
4. 报告写入位置。

## 约束

- 只写 hand-written 段(不写 marker);写 promoted 块是 promote-knowledge 的职责。
- 内容不得包含 `<!--` 或 `-->` 字符串。
```

- [ ] **Step 2: 对照 spec 走查**

对照 `speccode/changes/knowledge-set/propose/specs/knowledge-set/spec.md`:
- 「直写命令」Scenario 1(草稿 → 确认 → 原子写 → 索引更新)→ 闸门 / 落盘 1 ✓
Expected: requirement 有对应段落,无遗漏。

- [ ] **Step 3: 全量测试回归**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS(无代码变更,全绿)

- [ ] **Step 4: 提交**

```bash
git add plugins/speccode/commands/memorize.md
git commit -m "docs(speccode): add memorize command"
```

---

### Task 8: 9 个认知型命令入口接入「知识库入口」

**Files:**
- Modify: `plugins/speccode/commands/exploring.md`(在 `## 你不必做的事` 之前插入)
- Modify: `plugins/speccode/commands/proposing.md`(在 `## 需求澄清(提问环节)` 之前插入)
- Modify: `plugins/speccode/commands/brainstorming.md`(在 `## 检查清单` 之前插入)
- Modify: `plugins/speccode/commands/writing-plans.md`(在 `## 范围检查` 之前插入)
- Modify: `plugins/speccode/commands/executing-plans.md`(在 `## 流程` 之前插入)
- Modify: `plugins/speccode/commands/subagent-driven-development.md`(在 `## 流程` 之前插入)
- Modify: `plugins/speccode/commands/systematic-debugging.md`(在 `## 四个阶段(The Four Phases)` 之前插入)
- Modify: `plugins/speccode/commands/requesting-code-review.md`(在 `## 如何请求` 之前插入)
- Modify: `plugins/speccode/commands/receiving-code-review.md`(在 `## 响应模式(The Response Pattern)` 之前插入)

**Interfaces:**
- Consumes: verb `read-knowledge`(Task 4)。
- Produces: 各命令入口新增「知识库入口」小节(prose)。

- [ ] **Step 1: 逐文件插入统一小节**

对上述 9 个文件,在指定锚点(`## <锚点标题>` 行)之前插入以下小节(除锚点外内容逐字一致):

```markdown
## 知识库入口

1. 运行 `speccode.mjs read-knowledge --cwd . --index` 读 `_index.md`(恒读,便宜);`exists:false` → 静默跳过本节。
2. 判断本任务相关主题 → `speccode.mjs read-knowledge --cwd . --topic <名称>` 读对应 topic 文件;`exists:false` → 静默跳过该主题。
3. 读取失败或目录不存在 → 静默跳过,绝不阻断主流程(T0 兜底,永不报错)。
```

- [ ] **Step 2: 验证 9 处齐备**

Run:
```bash
grep -l "知识库入口" plugins/speccode/commands/{exploring,proposing,brainstorming,writing-plans,executing-plans,subagent-driven-development,systematic-debugging,requesting-code-review,receiving-code-review}.md | wc -l
```
Expected: `9`

- [ ] **Step 3: 全量测试回归**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS(无代码变更,全绿)

- [ ] **Step 4: 提交**

```bash
git add plugins/speccode/commands/
git commit -m "docs(speccode): wire knowledge entry point into 9 cognitive commands"
```

---

### Task 9: README 四版本 + CLAUDE.md 计数同步

**Files:**
- Modify: `README.md`、`README_CN.md`、`plugins/speccode/README.md`、`plugins/speccode/README_CN.md`、`CLAUDE.md`

**Interfaces:**
- Consumes: 无代码依赖(纯文档)。
- Produces: 文档命令计数 21→23、新增知识流条目(四版本结构一一对应)。

- [ ] **Step 1: 根 README(EN)**

- `21 /speccode:* commands` → `23 /speccode:* commands`(第 3 行 intro 段,与 README_CN.md 第 3 行镜像);
- `21 commands` → `23 commands`(第 13 行 features 列表处);
- `## 21 Commands at a Glance` → `## 23 Commands at a Glance`;
- 速览表在 Document flow 行之后新增一行:`| Knowledge | \`promote-knowledge\` \`memorize\` |`;
- `21-command reference` → `23-command reference`(第 82 行 Documentation Map 表格,与 README_CN.md 第 82 行「21 命令详表」镜像)。

- [ ] **Step 2: 根 README(CN)**

- `21 个 /speccode:* 命令` → `23 个 /speccode:* 命令`(第 3 行);
- `21 命令 + hooks` → `23 命令 + hooks`(第 13 行);
- `## 21 个命令速览` → `## 23 个命令速览`;
- 速览表在文档流行之后新增一行:`| 知识 | \`promote-knowledge\` \`memorize\` |`;
- `21 命令详表` → `23 命令详表`(第 82 行链接描述)。

- [ ] **Step 3: 插件 README(EN)**

- `## 2. 21-Command Quick Reference` → `## 2. 23-Command Quick Reference`;
- 第 9 行 `exposed as 21 /speccode:* slash commands` → `exposed as 23 /speccode:* slash commands`(与 plugins/speccode/README_CN.md 第 9 行镜像);
- 在 Documentation flow 表格之后新增小节:

```markdown
Knowledge:

| Command | Purpose | Prerequisite (branch to run on) |
|---|---|---|
| `/speccode:promote-knowledge` | Distill promoted sections of `speccode/knowledge/` from `spec/` + `archive/` (full rebuild with source markers); human gate before write; commits on save | worktree-* branch |
| `/speccode:memorize` | Write knowledge directly into hand-written sections (draft → human gate → atomic write); commits on save | worktree-* branch |
```

- [ ] **Step 4: 插件 README(CN)**

- `## 2. 21 个命令快速参考表` → `## 2. 23 个命令快速参考表`;
- 第 9 行 `21 个 /speccode:* slash 命令` → `23 个 /speccode:* slash 命令`;
- 在文档流表格之后新增小节:

```markdown
知识:

| 命令 | 作用 | 前置(运行分支) |
|---|---|---|
| `/speccode:promote-knowledge` | 从 spec/ + archive/ 蒸馏 knowledge/ 的 promoted 段(全量重建 + 来源标记),人工闸门后落盘,落盘即提交 | worktree-* 分支 |
| `/speccode:memorize` | 知识直接写入 hand-written 段(草稿 → 人工闸门 → 原子写),落盘即提交 | worktree-* 分支 |
```

- [ ] **Step 5: CLAUDE.md**

- 第 7 行:`21 个 /speccode:* slash 命令` → `23 个 /speccode:* slash 命令`;
- 第 9 行:`21 命令表` → `23 命令表`;
- 第 42 行:`12 个经单测的纯逻辑模块(atomic / config / detect / git / hooks / memory / prtool / reconcile / sdd / slug / state / timestamp)` → `13 个经单测的纯逻辑模块(atomic / config / detect / git / hooks / knowledge / memory / prtool / reconcile / sdd / slug / state / timestamp)`;
- 第 43 行:`18 个 verb` → `20 个 verb`;
- 第 44 行:`21 个 slash 命令的 prose 指令` → `23 个 slash 命令的 prose 指令`。

- [ ] **Step 6: 验证无残留**

Run:
```bash
grep -n "21" README.md README_CN.md plugins/speccode/README.md plugins/speccode/README_CN.md CLAUDE.md | grep -iE "command|命令" ; echo "---"
node --test ./plugins/speccode/tests/*.test.mjs 2>&1 | tail -6
```
Expected: 第一条 grep 无输出(命令计数无残留);测试全绿。

- [ ] **Step 7: 提交**

```bash
git add README.md README_CN.md plugins/speccode/README.md plugins/speccode/README_CN.md CLAUDE.md
git commit -m "docs: sync command counts (21→23) and knowledge flow across READMEs"
```
