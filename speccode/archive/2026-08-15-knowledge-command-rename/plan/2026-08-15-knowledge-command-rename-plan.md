# knowledge-command-rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 知识集两条写入命令统一改名为 `recording-knowledge` / `distilling-knowledge`,marker 术语随迁(写侧只产 `distilled-from` 新格式、读侧永久兼容旧 `promoted-from`),文档面(README×4 + CHANGELOG + spec Purpose)逐字同步。

**Architecture:** 引擎层(lib + CLI)硬切术语并加读侧双格式解析,存量旧 marker 文件随首次蒸馏全量重建自然迁移;命令层删 2 增 2(行为语义不变,只改名与术语);文档层逐字 old→new;规格 delta 已在 `propose/` 就位,由收尾 syncing 归并主规格(不在本计划)。

**Tech Stack:** Node ≥ 24 纯 ESM 零第三方依赖;`node:test`;BSD perl(机械改名);git。

## Global Constraints

- Node ≥ 24;纯 ESM、零第三方依赖(仅 `node:` 内置模块);无 lint/build 步骤。
- 全量测试 MUST 用 glob 形式:`node --test ./plugins/speccode/tests/*.test.mjs`(裸目录形式在 Node v24 报 MODULE_NOT_FOUND,禁用)。
- 所有工作 MUST 在 worktree 根(`worktree-knowledge-command-rename`)内执行;每个任务落盘即提交。
- 写侧 marker 唯一格式:`<!-- distilled-from: <source> -->` / `<!-- /distilled -->`;读侧 MUST 同时解析旧格式 `<!-- promoted-from: <source> -->` / `<!-- /promoted -->`(start 用正则 `^<!-- …-from:\s*(.+?)\s*-->$`,end 用 trim 后精确等值——与既有实现同一语义)。
- `append-hand` mode 与 hand-written 术语 MUST NOT 改;`read-knowledge`/`write-knowledge` verb 名 MUST NOT 改。
- 新命令名定帧:`/speccode:recording-knowledge`(记录/直写)、`/speccode:distilling-knowledge`(蒸馏);命令内提交信息模板:`docs(knowledge): record <topic>`、`docs(knowledge): distill knowledge set`。
- 23 命令总数 MUST NOT 变;hooks(`lib/hooks.mjs` 事件清单)MUST NOT 改动;`speccode/archive/` 冻结历史 MUST NOT 动。
- 双语纪律:根 `README.md`/`README_CN.md` 与插件 `README.md`/`README_CN.md` 任何内容改动 MUST 四版同步,结构一一对应。
- 涉及 git 的测试 MUST 用 `tests/helpers/tmprepo.mjs` 的 `makeRepo()`,结束 `rmSync(repo, { recursive: true, force: true })` 清理。
- 命令层绝不手写 `speccode/knowledge/` 文件(一律经 verb)——本计划不改此约束。

---

### Task 1: 引擎层 marker 双格式 + 术语硬切(lib + bin + 两组测试)

**Files:**
- Modify: `plugins/speccode/lib/knowledge.mjs:52-139`(marker 常量 + 两个函数整体替换)
- Modify: `plugins/speccode/bin/speccode.mjs:14`(import)、`:232`(read-knowledge --blocks 调用)、`:263-267`(write-knowledge mode 块)
- Test: `plugins/speccode/tests/knowledge.test.mjs`、`plugins/speccode/tests/cli.test.mjs`

**Interfaces:**
- Consumes: 无(首个任务)。
- Produces:
  - `parseDistilledBlocks(text) -> [{source, body}]`(解析新旧两种 marker,按出现顺序;失配/嵌套/未闭合抛错)
  - `replaceDistilledBlocks(text, blocks) -> string`(识别新旧块;写侧只产新格式;hand-written 段字节保留)
  - `write-knowledge` mode `"replace-distilled"`(payload `{mode, blocks: [{source, body}]}`;旧 mode `"replace-promoted"` 不再存在)
  - 旧导出 `parsePromotedBlocks`/`replacePromotedBlocks` 被删除(硬切,无别名)

- [ ] **Step 1: knowledge.test.mjs 机械迁移(标识符 + fixture + 错误文案)**

在 worktree 根执行两条 perl(顺序不可换:先做标识符,再做 fixture/文案):

```bash
perl -pi -e 's/parsePromotedBlocks/parseDistilledBlocks/g; s/replacePromotedBlocks/replaceDistilledBlocks/g' plugins/speccode/tests/knowledge.test.mjs
perl -pi -e 's/promoted-from/distilled-from/g; s/<!-- \/promoted -->/<!-- \/distilled -->/g; s/\bpromoted\b/distilled/g' plugins/speccode/tests/knowledge.test.mjs
```

验证:`grep -n "promoted\|Promoted" plugins/speccode/tests/knowledge.test.mjs` → **预期 0 命中**(此刻文件内尚无 legacy 用例,下一步才追加)。

- [ ] **Step 2: knowledge.test.mjs 追加 5 个 legacy/迁移用例(逐字追加到文件末尾)**

```js
test('parseDistilledBlocks parses legacy promoted markers', () => {
  const text = 'hand\n<!-- promoted-from: archive/a/ -->\nbody\n<!-- /promoted -->\n';
  assert.deepEqual(parseDistilledBlocks(text), [{ source: 'archive/a/', body: 'body' }]);
});

test('parseDistilledBlocks parses mixed current and legacy markers in order', () => {
  const text = [
    '<!-- distilled-from: spec/x/ -->',
    'new body',
    '<!-- /distilled -->',
    'middle hand',
    '<!-- promoted-from: archive/y/ -->',
    'old body',
    '<!-- /promoted -->',
  ].join('\n');
  assert.deepEqual(parseDistilledBlocks(text), [
    { source: 'spec/x/', body: 'new body' },
    { source: 'archive/y/', body: 'old body' },
  ]);
});

test('parseDistilledBlocks throws on mismatched opening/closing marker formats', () => {
  assert.throws(
    () => parseDistilledBlocks('<!-- distilled-from: x/ -->\nbody\n<!-- /promoted -->'),
    /knowledge: mismatched distilled marker/,
  );
  assert.throws(
    () => parseDistilledBlocks('<!-- promoted-from: x/ -->\nbody\n<!-- /distilled -->'),
    /knowledge: mismatched distilled marker/,
  );
});

test('replaceDistilledBlocks rewrites legacy markers to the current format, preserving hand-written bytes', () => {
  const text = 'hand A\n<!-- promoted-from: old/ -->\nold body\n<!-- /promoted -->\nhand B\n';
  const out = replaceDistilledBlocks(text, [{ source: 'old/', body: 'new body' }]);
  assert.equal(out, 'hand A\n<!-- distilled-from: old/ -->\nnew body\n<!-- /distilled -->\nhand B\n');
});

test('replaceDistilledBlocks drops legacy blocks whose source is gone', () => {
  const text = 'keep\n<!-- promoted-from: gone/ -->\nold\n<!-- /promoted -->\ntail';
  const out = replaceDistilledBlocks(text, []);
  assert.equal(out, 'keep\ntail\n');
});
```

验证:`grep -c "promoted-from" plugins/speccode/tests/knowledge.test.mjs` → **预期 5**;`grep -c "<!-- /promoted -->" plugins/speccode/tests/knowledge.test.mjs` → **预期 5**(全部来自本步新增用例)。

- [ ] **Step 3: cli.test.mjs 改 2 个用例 + 增 1 个用例**

编辑 1——旧(`plugins/speccode/tests/cli.test.mjs` 现行 736-747 行)逐字替换:

旧:
```js
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
```

新:
```js
test('write-knowledge replace-distilled migrates legacy markers and rebuilds only distilled blocks', () => {
  const repo = makeRepo();
  const p = join(repo, 'speccode', 'knowledge', 'development', 'pitfalls.md');
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, 'hand A\n<!-- promoted-from: old/ -->\nold body\n<!-- /promoted -->\nhand B\n');
  const { code, json } = runCliStdin(repo, 'write-knowledge', '--cwd', repo, '--rel', 'development/pitfalls.md', '--json-stdin',
    JSON.stringify({ mode: 'replace-distilled', blocks: [{ source: 'old/', body: 'new body' }] }));
  assert.equal(code, 0);
  assert.equal(json.ok, true);
  assert.equal(readFileSync(p, 'utf8'), 'hand A\n<!-- distilled-from: old/ -->\nnew body\n<!-- /distilled -->\nhand B\n');
  rmSync(repo, { recursive: true, force: true });
});
```

编辑 2——现行 766 行测试改名(函数体一字不动):

旧:`test('read-knowledge --topic --blocks returns parsed promoted blocks', () => {`
新:`test('read-knowledge --topic --blocks parses legacy promoted markers', () => {`

编辑 3——紧随编辑 2 的用例之后插入新用例:

```js
test('read-knowledge --topic --blocks parses current distilled markers', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(join(root, 'development'), { recursive: true });
  writeFileSync(join(root, 'development', 'pitfalls.md'), 'hand\n<!-- distilled-from: archive/a/ -->\nbody\n<!-- /distilled -->\n');
  const { code, json } = runCli(repo, 'read-knowledge', '--cwd', repo, '--topic', 'pitfalls', '--blocks');
  assert.equal(code, 0);
  assert.equal(json.exists, true);
  assert.deepEqual(json.blocks, [{ source: 'archive/a/', body: 'body' }]);
  rmSync(repo, { recursive: true, force: true });
});
```

- [ ] **Step 4: 运行确认失败(RED)**

```bash
node --test plugins/speccode/tests/knowledge.test.mjs
```

Expected: FAIL——`SyntaxError: The requested module '../lib/knowledge.mjs' does not provide an export named 'parseDistilledBlocks'`(整个文件不通过)。

```bash
node --test plugins/speccode/tests/cli.test.mjs
```

Expected: FAIL——`replace-distilled` 用例报 `unknown mode: replace-distilled`;`parses current distilled markers` 用例 `blocks` 为 `[]` 断言失败。(`parses legacy promoted markers` 用例此刻仍 PASS——旧 lib 本来就能解析旧格式,属预期。)

- [ ] **Step 5: lib/knowledge.mjs 替换 marker 常量与两个函数**

逐字删除现行 52-77 行(`PROMOTED_START`/`PROMOTED_END` 常量 + `parsePromotedBlocks`)与 79-139 行(`replacePromotedBlocks` 含注释),替换为:

```js
const DISTILLED_START = /^<!-- distilled-from:\s*(.+?)\s*-->$/;
const DISTILLED_END = '<!-- /distilled -->';
// Legacy pre-rename format ("promoted" era): parsed on read forever, never
// written. Existing knowledge files migrate to the current format on their
// next full rebuild (replaceDistilledBlocks rewrites every block it keeps).
const LEGACY_PROMOTED_START = /^<!-- promoted-from:\s*(.+?)\s*-->$/;
const LEGACY_PROMOTED_END = '<!-- /promoted -->';

// Extract distilled blocks as [{source, body}]. Both the current
// (distilled-from//distilled) and legacy (promoted-from//promoted) marker
// formats are recognized, in order of appearance; a block's closing marker
// must match its opening format. Malformed markers throw — corrupted
// knowledge files need a human, never silent repair (design D5).
export function parseDistilledBlocks(text) {
  const blocks = [];
  const lines = String(text).split('\n');
  let open = null;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const isNew = DISTILLED_START.exec(line);
    const m = isNew || LEGACY_PROMOTED_START.exec(line);
    if (m) {
      if (open) throw new Error('knowledge: nested distilled marker');
      open = { source: m[1].trim(), start: i, end: isNew ? DISTILLED_END : LEGACY_PROMOTED_END };
    } else if (line.trim() === DISTILLED_END || line.trim() === LEGACY_PROMOTED_END) {
      if (!open) throw new Error('knowledge: closing distilled marker without opening');
      if (line.trim() !== open.end) throw new Error('knowledge: mismatched distilled marker');
      blocks.push({ source: open.source, body: lines.slice(open.start + 1, i).join('\n') });
      open = null;
    }
    i += 1;
  }
  if (open) throw new Error('knowledge: unclosed distilled marker');
  return blocks;
}

// Full rebuild of distilled blocks (design D2): every existing block —
// current or legacy format — is replaced by the new block with the same
// source, or dropped when its source is gone; kept and new blocks are always
// written in the CURRENT format, so a legacy-marked file migrates on its
// first rebuild. New sources are appended at the end (preceded by a blank
// line). Everything outside markers passes through untouched, so hand-written
// content is preserved byte-for-byte (split/join is lossless).
//
// `blocks` is validated up front: a duplicate `source` would silently drop
// one gate-confirmed block (whichever the write path or the append loop
// happens to keep), and a `body` containing a marker string would produce a
// file that parseDistilledBlocks then rejects as corrupt — both convert a
// silent wrong write into an explicit pre-write error (design D5).
export function replaceDistilledBlocks(text, blocks) {
  const seen = new Set();
  for (const b of blocks) {
    if (seen.has(b.source)) throw new Error(`knowledge: duplicate distilled source: ${b.source}`);
    seen.add(b.source);
    const body = String(b.body ?? '');
    if (body.includes('<!--') || body.includes('-->')) {
      throw new Error('knowledge: body contains marker string');
    }
  }
  const lines = text === '' ? [] : String(text).split('\n');
  const out = [];
  const emitted = new Set();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const isNew = DISTILLED_START.exec(line);
    const m = isNew || LEGACY_PROMOTED_START.exec(line);
    if (m) {
      const source = m[1].trim();
      const end = isNew ? DISTILLED_END : LEGACY_PROMOTED_END;
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== end) {
        if (DISTILLED_START.exec(lines[j]) || LEGACY_PROMOTED_START.exec(lines[j])) {
          throw new Error('knowledge: nested distilled marker');
        }
        j += 1;
      }
      if (j >= lines.length) throw new Error('knowledge: unclosed distilled marker');
      const block = blocks.find((b) => b.source === source);
      if (block) {
        out.push(`<!-- distilled-from: ${source} -->`, String(block.body ?? ''), DISTILLED_END);
        emitted.add(source);
      }
      i = j + 1;
      continue;
    }
    if (line.trim() === DISTILLED_END || line.trim() === LEGACY_PROMOTED_END) {
      throw new Error('knowledge: closing distilled marker without opening');
    }
    out.push(line);
    i += 1;
  }
  for (const b of blocks) {
    if (emitted.has(b.source)) continue;
    if (out.length > 0 && out[out.length - 1] !== '') out.push('');
    out.push(`<!-- distilled-from: ${b.source} -->`, String(b.body ?? ''), DISTILLED_END);
  }
  // Mirror buildIndex's trailing newline, but only when the join doesn't
  // already end with one (source already ending in `\n` round-trips through
  // split/join as a trailing '' element — adding another would double it).
  const joined = out.join('\n');
  return joined === '' || joined.endsWith('\n') ? joined : `${joined}\n`;
}
```

- [ ] **Step 6: bin/speccode.mjs 三处同步**

编辑 1(现行 14 行):

旧:`import { assertSafeRel, buildIndex, knowledgeRoot, listTopics, parsePromotedBlocks, replacePromotedBlocks, writeKnowledge } from '../lib/knowledge.mjs';`
新:`import { assertSafeRel, buildIndex, knowledgeRoot, listTopics, parseDistilledBlocks, replaceDistilledBlocks, writeKnowledge } from '../lib/knowledge.mjs';`

编辑 2(现行 232 行,read-knowledge --blocks 分支):

旧:`      if (blocks) return { ok: true, exists: true, path: match, blocks: parsePromotedBlocks(content) };`
新:`      if (blocks) return { ok: true, exists: true, path: match, blocks: parseDistilledBlocks(content) };`

编辑 3(现行 263-267 行,write-knowledge mode 块):

旧:
```js
    if (mode === 'replace-promoted') {
      if (!Array.isArray(blocks)) return { ok: false, error: 'mode replace-promoted requires blocks: [{source, body}]' };
      const existing = existsSync(target) ? readFileSync(target, 'utf8') : '';
      writeKnowledge(root, safe.rel, replacePromotedBlocks(existing, blocks));
      return { ok: true, path: safe.rel };
    }
```
新:
```js
    if (mode === 'replace-distilled') {
      if (!Array.isArray(blocks)) return { ok: false, error: 'mode replace-distilled requires blocks: [{source, body}]' };
      const existing = existsSync(target) ? readFileSync(target, 'utf8') : '';
      writeKnowledge(root, safe.rel, replaceDistilledBlocks(existing, blocks));
      return { ok: true, path: safe.rel };
    }
```

- [ ] **Step 7: 运行确认通过(GREEN)**

```bash
node --test plugins/speccode/tests/knowledge.test.mjs plugins/speccode/tests/cli.test.mjs
```

Expected: 两文件全部 PASS(含 5 + 1 个新增用例)。

- [ ] **Step 8: 全量测试**

```bash
node --test ./plugins/speccode/tests/*.test.mjs
```

Expected: 全绿(fail 0;基线 183 + 本任务净增 6 = 189,以实际输出为准)。

- [ ] **Step 9: 提交**

```bash
git add plugins/speccode/lib/knowledge.mjs plugins/speccode/bin/speccode.mjs plugins/speccode/tests/knowledge.test.mjs plugins/speccode/tests/cli.test.mjs
git commit -m "refactor(knowledge): promoted→distilled 术语硬切,marker 读侧双格式兼容、写侧只产新格式"
```

---

### Task 2: 命令层——删 memorize/promote-knowledge,增 recording-knowledge/distilling-knowledge

**Files:**
- Delete: `plugins/speccode/commands/memorize.md`、`plugins/speccode/commands/promote-knowledge.md`
- Create: `plugins/speccode/commands/recording-knowledge.md`、`plugins/speccode/commands/distilling-knowledge.md`

**Interfaces:**
- Consumes: Task 1 的 `write-knowledge` mode `"replace-distilled"`;Global Constraints 的命令名/提交信息模板定帧。
- Produces: 23 命令面中知识两条的新名字;两命令行为语义(前置、闸门、落盘即提交、骨架创建、日落、幂等、stale 处置)与旧命令逐条对应,仅名称/术语/提交信息模板变化。

- [ ] **Step 1: 删除旧命令文件并创建 recording-knowledge.md(全文如下)**

```bash
git rm plugins/speccode/commands/memorize.md plugins/speccode/commands/promote-knowledge.md
```

创建 `plugins/speccode/commands/recording-knowledge.md`,逐字内容:

````markdown
---
name: "SpecCode: Recording Knowledge"
description: "把知识直接记录进知识集:经人工闸门写入 speccode/knowledge/ 的 hand-written 段"
category: Workflow
tags: [speccode, workflow, knowledge]
---

把用户/agent 提供的知识直接记录进 `speccode/knowledge/`(hand-written 段),经人工闸门落盘。全程中文交互。**应在 worktree-* 分支上运行**。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. **trunk 防护**:`git rev-parse --abbrev-ref HEAD` 必须以 `config.worktree_prefix`(默认 `worktree-`)开头;否则退出并提示"请在 worktree 分支上运行本命令"(防止直提 trunk)。
3. **绑定功能分支**:运行 `speccode.mjs reconcile --cwd .`,用返回的 features 找到当前 worktree 所属的功能分支 F;找不到 → 报错"当前 worktree 无法关联任何 active feature",退出。
4. 运行 `speccode.mjs read-memory --cwd . --branch <F>` 读取本 feature 记忆作为既有上下文参考。
5. 运行 `speccode.mjs read-knowledge --cwd .`(无 flag)获取现状(topic 清单 + 索引)。
6. `speccode/knowledge/` 不存在 → 创建骨架:6 个初始 topic 空文件(development/architecture.md、development/standards.md、development/environment.md、development/integrations.md、development/pitfalls.md、development/security.md)+ `_index.md`,不创建 business/ 目录(知识集只策展 SDD 过程知识,业务知识归外部 RAG)。创建机制:对 6 个文件逐个执行 `write-knowledge --rel <file> --json-stdin`(mode=replace,content 为空串)创建空文件,再执行 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries 为 development 一个空清单 section)创建索引——绝不 mkdir/touch/手写文件(命令层绝不手写 knowledge/,一律经 verb)。

## 收集内容

向用户询问(选择题优先):
- 主题:映射到现有 topic(如「开发准则」→ development/standards.md);无合适 topic → 询问是否新建 topic 文件(落在 `development/` 下,文件名小写连字符,`.md` 结尾,如 `development/ops.md`——distilling-knowledge 的蒸馏目标只含 development/ 下自建 topic,根级文件无法分组且会被日落)。
- 内容:用户/agent 给出的知识文本。

## 闸门

1. **适配判断**:先对内容做归类陈述——属于 SDD 过程知识(开发守则、架构、环境、对接、坑与评审共识、安全等)→ 建议落入的 topic;属于业务知识(领域术语、业务流程、业务历史等)→ 陈述「更像业务知识,建议进外部 RAG 而非知识集」。归类是建议不是硬拦:用户坚持写入时,允许其指定既有 topic 或新建 topic(新建落在 `development/` 下,文件名小写连字符,`.md` 结尾)。pitfalls 语义含评审中反复出现的问题模式与团队评审共识,不单列 review topic。
2. 展示草稿(写入位置 + 内容 + 归类陈述)→ AskUserQuestion 确认:
   - 确认 → `write-knowledge --rel <topic路径> --json-stdin`(mode=append-hand,content=内容)原子写(追加为 hand-written 段,不带 marker);
   - 坚持写入(被建议进 RAG 时)→ 按用户指定的 topic 写入;
   - 修改 → 按反馈调整后重展示。

## 落盘

1. `_index.md` 需更新时(新 topic、摘要变化、或索引缺失——read-knowledge 返回 index 为 null 但 topic 文件存在)→ 组装 entries(实扫现有 topic 文件(跳过内容为空的 topic 文件——日落后被清空的存量文件不再收录),按顶层目录名分组为 sections,如 development;不硬编码固定 section 清单),经 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries=...)写入新索引内容。
2. 经 `speccode.mjs write-memory --cwd . --branch <F> --json-stdin`(mode=append)追加本次记录摘要(写入位置 + topic)。
3. MUST 立即提交:
   ```bash
   git add speccode/knowledge/
   git commit -m "docs(knowledge): record <topic>"
   ```
4. 报告写入位置。

## 约束

- 只写 hand-written 段(不写 marker);写蒸馏块是 distilling-knowledge 的职责。
- 内容不得包含 `<!--` 或 `-->` 字符串。
````

- [ ] **Step 2: 创建 distilling-knowledge.md(全文如下)**

创建 `plugins/speccode/commands/distilling-knowledge.md`,逐字内容:

````markdown
---
name: "SpecCode: Distilling Knowledge"
description: "从 spec/ 与 archive/ 蒸馏知识集:全量重蒸 distilled 段,经人工闸门落盘 speccode/knowledge/"
category: Workflow
tags: [speccode, workflow, knowledge]
---

从 `speccode/spec/` 与 `speccode/archive/` 蒸馏知识集,全量重蒸 `speccode/knowledge/` 各 topic 文件的蒸馏段,经人工闸门落盘。全程中文交互。**应在 worktree-* 分支上运行**。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. **trunk 防护**:`git rev-parse --abbrev-ref HEAD` 必须以 `config.worktree_prefix`(默认 `worktree-`)开头;否则退出并提示"请在 worktree 分支上运行本命令"(防止直提 trunk)。
3. **绑定功能分支**:运行 `speccode.mjs reconcile --cwd .`,用返回的 features 找到当前 worktree 所属的功能分支 F;找不到 → 报错"当前 worktree 无法关联任何 active feature",退出。
4. 运行 `speccode.mjs read-memory --cwd . --branch <F>` 读取本 feature 记忆作为既有上下文参考。
5. 运行 `speccode.mjs read-knowledge --cwd .`(无 flag)获取现状:`files`(topic 清单)与 `index`(`_index.md` 内容,可能为 null)。
6. `speccode/knowledge/` 不存在 → 本命令创建骨架:6 个初始 topic 空文件(development/architecture.md、development/standards.md、development/environment.md、development/integrations.md、development/pitfalls.md、development/security.md)+ `_index.md`,不创建 business/ 目录(知识集只策展 SDD 过程知识,业务知识归外部 RAG)。创建机制:对 6 个文件逐个执行 `write-knowledge --rel <file> --json-stdin`(mode=replace,content 为空串)创建空文件,再执行 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries 为 development 一个空清单 section)创建索引——绝不 mkdir/touch/手写文件(命令层绝不手写 knowledge/,一律经 verb)。
7. 读 `speccode/spec/`(各 capability 主规格)与 `speccode/archive/`(全部归档 change)。
8. 若 `knowledge_tools`(config)非空且其能力在会话中可用,读 spec/archive 时优先参考;不可用回退直接读文件,不报错。

## 蒸馏

1. 逐 topic 蒸馏,先取现状:`speccode.mjs read-knowledge --cwd . --topic <topic名> --blocks` 返回该 topic 现有蒸馏块(`blocks: [{source, body}]`),作为候选 diff 的现状侧。
2. 蒸馏目标 = 6 个骨架 development topic ∪ `development/` 下用户自建 topic;蒸馏内容限于 SDD 过程知识(架构、准则、环境、对接、坑与评审共识、安全)——spec/archive 中的业务知识(领域术语、业务流程、业务历史)不蒸馏。从 spec/ 与 archive/ 提炼「该主题下值得长期记住的事实/准则/坑」,生成每个目标 topic 的蒸馏块集合:
   - 块粒度:每个来源一个块;source 格式固定——archive 来源用 `archive/<归档目录名>/`,spec 来源用 `spec/<capability 目录名>/`;
   - 现有 hand-written 段作为蒸馏参考上下文,可引用其事实,但不得把其中内容复制为蒸馏块(手写段原样保留在文件中);
   - 无内容可蒸且该 topic 此前也无蒸馏块 → 产出空 blocks 数组(文件保持现状);该 topic 已有蒸馏块时,blocks 为空意味着其现有蒸馏块将被删除(全量重建语义)。
   - 蒸馏块 body 不得包含 `<!--` 或 `-->` 字符串。
3. **通用日落**:蒸馏目标之外既存的 topic 文件(如存量 business/*),用 `read-knowledge --topic <topic名> --blocks` 取其现有蒸馏块,逐块标记为「建议移除(该 topic 不在蒸馏目标内;若属业务知识,建议归外部 RAG)」,并入候选进入闸门;其 hand-written 段不进入候选、绝不自动修改。
4. 汇总候选:对每个 topic 列出 `blocks: [{source, body}]`,与现状 diff 展示(新增/变化/删除的蒸馏块;现有 source 不在新列表中的块将被删除)。

## 闸门

用 AskUserQuestion 逐 topic 确认(提供「全部确认」选项):
- 确认 → 该 topic 经 `write-knowledge --rel <topic路径> --json-stdin`(mode=replace-distilled,blocks=候选)原子写;
- 日落块确认移除 → 该 topic 经 `write-knowledge --rel <topic路径> --json-stdin`(mode=replace-distilled,blocks=[])写入(删除全部蒸馏块,hand-written 段字节保留);用户拒绝 → 块保留原样;
- 拒绝/修改 → 按用户反馈调整后重展示。

source 指向的 archive 或 spec capability 已不存在 → 该块标 stale,闸门内展示给用户,选项:删除该块 / 改 source 后保留。

## 落盘

1. 各 topic 写入完成后更新 `_index.md`:为每个 topic 文件生成一行摘要(标题 + 文件 + 一句话摘要),组装 entries(实扫现有 topic 文件(跳过内容为空的 topic 文件——日落后被清空的存量文件不再收录),按顶层目录名分组为 sections,如 development;不硬编码固定 section 清单),经 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries=...)写入。
2. 经 `speccode.mjs write-memory --cwd . --branch <F> --json-stdin`(mode=append)追加本次蒸馏摘要(哪些 topic 变化/无变化/新增)。
3. 全部写入完成后 MUST 立即提交:
   ```bash
   git add speccode/knowledge/
   git commit -m "docs(knowledge): distill knowledge set"
   ```
4. 报告:哪些 topic 变化/无变化/新增。

## 约束

- 只写 `speccode/knowledge/`,绝不写 `speccode/spec/`(那是 syncing 的职责)。
- 幂等:某 topic 蒸馏结果与现状无差异 → 跳过写,报告「无变化」。
- marker 解析失败(报错)→ 停下报告给用户,不猜测修复。
````

- [ ] **Step 3: 结构校验(命令文件的测试循环)**

```bash
ls plugins/speccode/commands/*.md | wc -l
```
Expected: `23`

```bash
grep -rn "memorize\|promote" plugins/speccode/commands/
```
Expected: 无命中(exit 1,旧名/旧术语在新命令正文中零残留)

```bash
grep -c "replace-distilled" plugins/speccode/commands/distilling-knowledge.md
```
Expected: `2`(闸门段两处 mode 引用)

```bash
node --test ./plugins/speccode/tests/*.test.mjs
```
Expected: 全绿(命令文件无单测,但提交纪律要求每次提交前全量绿)

- [ ] **Step 4: 提交**

```bash
git add plugins/speccode/commands/
git commit -m "feat(commands): 知识集命令更名为 recording-knowledge/distilling-knowledge(删 memorize/promote-knowledge)"
```

---

### Task 3: 文档层——README×4 + CHANGELOG + spec Purpose editorial

**Files:**
- Modify: `plugins/speccode/README_CN.md`(4 处)、`plugins/speccode/README.md`(4 处)
- Modify: `README_CN.md`(1 处)、`README.md`(1 处)
- Modify: `CHANGELOG.md`(新增 Unreleased 小节)
- Modify: `speccode/spec/knowledge-set/spec.md:5`(Purpose editorial——syncing 不动既有 Purpose,必须手改)

**Interfaces:**
- Consumes: Task 2 的命令名定帧;Task 1 的 marker 新旧格式定帧。
- Produces: 用户-facing 文档终态;CHANGELOG breaking 记录(发版时归入对应版本小节)。

- [ ] **Step 1: 插件 README_CN.md 四处逐字替换**

编辑 1(命令表「知识」组两行):

旧:
```
| `/speccode:promote-knowledge` | 从 spec/ + archive/ 蒸馏 knowledge/ 的 promoted 段(全量重建 + 来源标记;只蒸 SDD 过程知识,范围外 topic 经闸门日落),人工闸门后落盘,落盘即提交 | worktree-* 分支 |
| `/speccode:memorize` | 知识直接写入 hand-written 段(适配判断:过程知识收录,业务知识建议进外部 RAG;草稿 → 人工闸门 → 原子写),落盘即提交 | worktree-* 分支 |
```
新:
```
| `/speccode:distilling-knowledge` | 从 spec/ + archive/ 蒸馏 knowledge/ 的 distilled 段(全量重建 + 来源标记;只蒸 SDD 过程知识,范围外 topic 经闸门日落),人工闸门后落盘,落盘即提交 | worktree-* 分支 |
| `/speccode:recording-knowledge` | 知识直接记录进 hand-written 段(适配判断:过程知识收录,业务知识建议进外部 RAG;草稿 → 人工闸门 → 原子写),落盘即提交 | worktree-* 分支 |
```

编辑 2(目录树注释):

旧:`└── knowledge/               # 知识集(promote-knowledge / memorize 产出)`
新:`└── knowledge/               # 知识集(distilling-knowledge / recording-knowledge 产出)`

编辑 3(commit-on-save 清单):

旧:`- **落盘即 commit**:proposing / brainstorming / writing-plans / syncing / archiving / promote-knowledge / memorize 每一步产出文档后立即提交,文档历史与代码历史同分支同行。`
新:`- **落盘即 commit**:proposing / brainstorming / writing-plans / syncing / archiving / distilling-knowledge / recording-knowledge 每一步产出文档后立即提交,文档历史与代码历史同分支同行。`

编辑 4(知识集分层 prose 段,整段替换):

旧:
```
- **知识集:promoted 与 hand-written 分层**:`knowledge/` 下每个 topic 文件可混合两类内容。`promote-knowledge` 把 `spec/` 与 `archive/` 蒸馏为**promoted 块**,用 `<!-- promoted-from: <source> --> ... <!-- /promoted -->` 标记包裹,每次运行全量重建(来源已消失的块随之删除);`memorize` 则在这些标记之外追加自由格式的**手写(hand-written)**内容。重建对标记之外的一切内容逐字节保留,故手写内容在每次 promoted 块重建后原样存活。知识集只策展 SDD 过程知识(`development/*`;pitfalls 兼收评审中反复出现的问题模式与团队评审共识)。业务知识交由外部 RAG 系统:`memorize` 写入前做适配判断(建议而非硬拦),`promote-knowledge` 对范围外 topic 的 promoted 块经同一人工闸门日落,hand-written 段逐字节保留。
```
新:
```
- **知识集:distilled 与 hand-written 分层**:`knowledge/` 下每个 topic 文件可混合两类内容。`distilling-knowledge` 把 `spec/` 与 `archive/` 蒸馏为**蒸馏块(distilled blocks)**,用 `<!-- distilled-from: <source> --> ... <!-- /distilled -->` 标记包裹,每次运行全量重建(来源已消失的块随之删除);`recording-knowledge` 则在这些标记之外追加自由格式的**手写(hand-written)**内容。重建对标记之外的一切内容逐字节保留,故手写内容在每次蒸馏块重建后原样存活。知识集只策展 SDD 过程知识(`development/*`;pitfalls 兼收评审中反复出现的问题模式与团队评审共识)。业务知识交由外部 RAG 系统:`recording-knowledge` 写入前做适配判断(建议而非硬拦),`distilling-knowledge` 对范围外 topic 的蒸馏块经同一人工闸门日落,hand-written 段逐字节保留。读侧兼容旧 `promoted-from`/`/promoted` marker,存量文件随首次蒸馏自动重写为新格式。
```

- [ ] **Step 2: 插件 README.md(EN)四处逐字替换**

编辑 1(命令表两行):

旧:
```
| `/speccode:promote-knowledge` | Distill promoted sections of `speccode/knowledge/` from `spec/` + `archive/` (full rebuild with source markers; SDD process knowledge only, out-of-scope topics sunset via the gate); human gate before write; commits on save | worktree-* branch |
| `/speccode:memorize` | Write knowledge directly into hand-written sections (fit check: process knowledge stays, business knowledge is pointed to external RAG; draft → human gate → atomic write); commits on save | worktree-* branch |
```
新:
```
| `/speccode:distilling-knowledge` | Rebuild the distilled sections of `speccode/knowledge/` from `spec/` + `archive/` (full rebuild with source markers; SDD process knowledge only, out-of-scope topics sunset via the gate); human gate before write; commits on save | worktree-* branch |
| `/speccode:recording-knowledge` | Record knowledge directly into hand-written sections (fit check: process knowledge stays, business knowledge is pointed to external RAG; draft → human gate → atomic write); commits on save | worktree-* branch |
```

编辑 2(目录树注释):

旧:`└── knowledge/               # curated knowledge set (produced by promote-knowledge / memorize)`
新:`└── knowledge/               # curated knowledge set (produced by distilling-knowledge / recording-knowledge)`

编辑 3(commit-on-save 清单):

旧:`- **Commit on save**: proposing / brainstorming / writing-plans / syncing / archiving / promote-knowledge / memorize each commit immediately after producing their documents, so document history and code history stay on the same branch, moving together.`
新:`- **Commit on save**: proposing / brainstorming / writing-plans / syncing / archiving / distilling-knowledge / recording-knowledge each commit immediately after producing their documents, so document history and code history stay on the same branch, moving together.`

编辑 4(知识集分层 prose 段,整段替换):

旧:
```
- **Knowledge set: promoted vs. hand-written split**: each topic file under `knowledge/` can mix two kinds of content. `promote-knowledge` distills `spec/` and `archive/` into **promoted blocks**, wrapped in `<!-- promoted-from: <source> --> ... <!-- /promoted -->` markers, and rebuilds them in full on every run (a block whose source has disappeared is dropped); `memorize` appends free-form **hand-written** prose outside those markers. The rebuild is byte-preserving for everything outside the markers, so hand-written content survives every promoted-block rebuild untouched. The set curates SDD process knowledge only (`development/*`; pitfalls also covers recurring review findings and team review consensus). Business knowledge is left to external RAG systems: `memorize` runs a fit check before writing (a recommendation, not a hard block), and `promote-knowledge` sunsets promoted blocks of out-of-scope topics through the same human gate while preserving hand-written content byte-for-byte.
```
新:
```
- **Knowledge set: distilled vs. hand-written split**: each topic file under `knowledge/` can mix two kinds of content. `distilling-knowledge` distills `spec/` and `archive/` into **distilled blocks**, wrapped in `<!-- distilled-from: <source> --> ... <!-- /distilled -->` markers, and rebuilds them in full on every run (a block whose source has disappeared is dropped); `recording-knowledge` appends free-form **hand-written** prose outside those markers. The rebuild is byte-preserving for everything outside the markers, so hand-written content survives every distilled-block rebuild untouched. The set curates SDD process knowledge only (`development/*`; pitfalls also covers recurring review findings and team review consensus). Business knowledge is left to external RAG systems: `recording-knowledge` runs a fit check before writing (a recommendation, not a hard block), and `distilling-knowledge` sunsets distilled blocks of out-of-scope topics through the same human gate while preserving hand-written content byte-for-byte. Legacy `promoted-from`/`/promoted` markers are still parsed on read; existing files are rewritten to the new format on their first distill.
```

- [ ] **Step 3: 根 README_CN.md 与 README.md 各一处**

`README_CN.md`(「23 个命令速览」表):

旧:`| 知识 | \`promote-knowledge\` \`memorize\` |`
新:`| 知识 | \`distilling-knowledge\` \`recording-knowledge\` |`

`README.md`("23 Commands at a Glance" 表):

旧:`| Knowledge | \`promote-knowledge\` \`memorize\` |`
新:`| Knowledge | \`distilling-knowledge\` \`recording-knowledge\` |`

- [ ] **Step 4: CHANGELOG.md 新增 Unreleased 小节**

在文件头纪律说明段之后、第一个版本小节 `## [0.2.3] - 2026-08-13` 之前,插入:

```markdown
## [Unreleased]

### Changed

- **BREAKING(命令改名)**:知识集两条写入命令更名并对齐动名词构词——`/speccode:memorize` → `/speccode:recording-knowledge`(记录/直写 hand-written 段),`/speccode:promote-knowledge` → `/speccode:distilling-knowledge`(从 spec/ + archive/ 全量蒸馏)。旧命令文件删除,不留跳转 stub。
- **BREAKING(marker 写侧格式)**:蒸馏块 marker 写侧改为 `<!-- distilled-from: <source> --> … <!-- /distilled -->`;读侧永久兼容旧 `<!-- promoted-from: -->`/`<!-- /promoted -->`。存量 knowledge 文件无需手动迁移——首次运行 distilling-knowledge 经全量重建自动重写为新格式,hand-written 段逐字节保留。
- **BREAKING(内部契约)**:`write-knowledge` verb 的 mode `replace-promoted` → `replace-distilled`;lib 导出 `parsePromotedBlocks`/`replacePromotedBlocks` → `parseDistilledBlocks`/`replaceDistilledBlocks`。

### 内部规格演进

- `knowledge-set`:晋升命令 → 蒸馏命令、直写命令 → 记录命令(RENAMED),来源标记改「写侧新格式 + 读侧双格式」;`plugin-packaging`:命令命名空间枚举 21 → 23(补录知识两条命令)。
```

- [ ] **Step 5: speccode/spec/knowledge-set/spec.md Purpose editorial**

旧(现行第 5 行整行):
```
知识集层:tracked、可检索、按主题组织的项目知识库,落 `speccode/knowledge/`(与 spec/changes/archive 平级)。由晋升命令(从 spec/archive 蒸馏 promoted 段)与直写命令(memorize 写 hand-written 段)写入,均经人工闸门;SDD 认知型命令入口读 `_index.md` 索引并按需读 topic 文件,失败静默兜底。
```
新:
```
知识集层:tracked、可检索、按主题组织的项目知识库,落 `speccode/knowledge/`(与 spec/changes/archive 平级)。由蒸馏命令(distilling-knowledge,从 spec/archive 蒸馏 distilled 段)与记录命令(recording-knowledge 写 hand-written 段)写入,均经人工闸门;SDD 认知型命令入口读 `_index.md` 索引并按需读 topic 文件,失败静默兜底。
```

注意:本行之外的主规格 requirement 正文 MUST NOT 手改——那些由收尾 `/speccode:syncing` 应用 `propose/specs/` delta 归并。

- [ ] **Step 6: 双语对照校验**

```bash
grep -c "distilling-knowledge" README.md README_CN.md plugins/speccode/README.md plugins/speccode/README_CN.md
grep -c "recording-knowledge" README.md README_CN.md plugins/speccode/README.md plugins/speccode/README_CN.md
```
Expected: 两条命令各在四版 README 中命中行数一致(根两版各 1 行;插件两版各 4 行——命令表行、目录树行、commit-on-save 行、分层 prose 行);EN/CN 同文件结构对应。

```bash
grep -n "memorize" README.md README_CN.md plugins/speccode/README.md plugins/speccode/README_CN.md
```
Expected: 无命中。

- [ ] **Step 7: 提交**

```bash
git add README.md README_CN.md plugins/speccode/README.md plugins/speccode/README_CN.md CHANGELOG.md speccode/spec/knowledge-set/spec.md
git commit -m "docs: 知识集命令改名同步四版 README/CHANGELOG/spec Purpose"
```

---

### Task 4: 收尾校验与 dogfood 实扫自验

**Files:**
- 无新增/修改(纯验证;若发现残留则回到对应任务修复)

**Interfaces:**
- Consumes: Task 1-3 的全部产出。
- Produces: 验证证据(测试全绿、grep 禁区清单、实扫解析报告)。

- [ ] **Step 1: 全量测试复跑**

```bash
node --test ./plugins/speccode/tests/*.test.mjs
```
Expected: 全绿(fail 0)。

- [ ] **Step 2: grep 禁区校验(改名漏触点最终防线)**

```bash
grep -rn "memorize" plugins/ skills/ scripts/ README.md README_CN.md CLAUDE.md CHANGELOG.md
```
Expected: 仅 `CHANGELOG.md` 命中(Unreleased 改名说明 + 历史版本小节)。

```bash
grep -rn "promote\|promoted" plugins/ skills/ scripts/ README.md README_CN.md CLAUDE.md CHANGELOG.md
```
Expected: 仅以下四类命中——
1. `plugins/speccode/lib/knowledge.mjs`(`LEGACY_PROMOTED_START`/`LEGACY_PROMOTED_END` 常量与注释);
2. `plugins/speccode/tests/knowledge.test.mjs` 与 `plugins/speccode/tests/cli.test.mjs`(legacy fixture 用例);
3. `CHANGELOG.md`(Unreleased 说明 + 历史版本小节);
4. 插件 `README.md`/`README_CN.md` 分层段末句的旧 marker 读侧兼容说明(用户裁定保留——与 CHANGELOG 同类,是兼容契约的用户可见文档,非现行术语残留)。

任何其他命中 = 漏触点 → 回到对应任务修复后重跑本步。

- [ ] **Step 3: dogfood 实扫——新 lib 解析本仓真实 knowledge 文件**

```bash
node --input-type=module -e "
import { parseDistilledBlocks } from './plugins/speccode/lib/knowledge.mjs';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : (n.endsWith('.md') ? [p] : []);
});
let bad = 0;
for (const f of walk('speccode/knowledge')) {
  try {
    const blocks = parseDistilledBlocks(readFileSync(f, 'utf8'));
    console.log('ok   ' + f + '  blocks=' + blocks.length);
  } catch (e) { bad++; console.error('FAIL ' + f + ': ' + e.message); }
}
process.exit(bad ? 1 : 0);
"
```
Expected: 每个 `.md` 一行 `ok`,exit 0。若本仓存量文件含旧 marker(blocks > 0 且文件内有 `promoted-from`),即顺带实证 legacy 解析在位;不含旧 marker 时本步证明零回归。

- [ ] **Step 4: 命令面 smoke**

```bash
ls plugins/speccode/commands/*.md | wc -l
```
Expected: `23`

```bash
ls plugins/speccode/commands/ | grep -E "memorize|promote"
```
Expected: 无命中(exit 1)。

- [ ] **Step 5: 汇报验证证据**

向用户汇报:全量测试 pass/fail 数、grep 禁区命中清单(按预期三类)、实扫解析每文件 blocks 数、命令面计数。若有失败项,先修复再汇报,不粉饰。

---

## 计划自查

**规格覆盖**(propose/specs delta → 任务):

| delta 条目 | 落点 |
|---|---|
| knowledge-set 来源标记(双格式解析/写侧新格式/失配损坏报错) | Task 1(lib 实现 + 5 个新用例钉死) |
| knowledge-set 蒸馏命令(命令名/术语/mode/提交信息/行为不变) | Task 2(distilling-knowledge.md) |
| knowledge-set 记录命令(同上) | Task 2(recording-knowledge.md) |
| knowledge-set 目录结构 scenario 中的命令名 | 收尾 syncing 应用 delta(不在本计划);Purpose editorial 在 Task 3 Step 5 |
| plugin-packaging 命令命名空间(23 枚举/旧名不再出现) | 收尾 syncing 应用 delta;命令面 smoke 在 Task 4 Step 4 |
| CHANGELOG breaking 记录 | Task 3 Step 4 |
| 设计 D3/D4(读侧双格式 + 全量重建自然迁移) | Task 1 实现 + 用例;Task 4 Step 3 dogfood 实证 |
| 设计 R2/R3/R4(解析回归/漏触点/双语漂移) | Task 4 Step 1/2 + Task 3 Step 6 |

**占位符扫描**:全文无 TBD/TODO/「适当处理」;每个代码步骤均含可执行代码或逐字 old→new。

**类型一致性**:`parseDistilledBlocks`/`replaceDistilledBlocks` 在 lib、bin、tests、knowledge-set delta 四处拼写一致;mode 字符串 `"replace-distilled"` 在 bin、cli.test、distilling-knowledge.md 三处逐字一致;`append-hand`/`hand-written` 全程未改。
