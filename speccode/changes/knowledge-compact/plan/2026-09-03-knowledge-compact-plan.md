# knowledge-compact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 知识集从「来源键制历史台账」改造为「能力键制当前态快照」——carry-forward / stale-by-source / superseded-by-package 三机制退役,手写段经闸门可改,并完成本仓知识集的 dogfood 首跑迁移。

**Architecture:** 全部确定性逻辑下沉 `lib/knowledge.mjs`(能力键校验、布局归位、replaceHandBlocks),`bin/speccode.mjs` 的 write-knowledge verb 增 `replace-hand` 模式,两个命令 markdown 只改 prose 语义;存量迁移零工具——用新命令对本仓 `speccode/knowledge/` 跑一次闸门。设计文档:`speccode/changes/knowledge-compact/propose/design.md`(D1-D7);spec delta:`propose/specs/knowledge-set/spec.md`。

**Tech Stack:** Node ≥ 24 纯 ESM、零第三方依赖(仅 `node:` 内置模块)、`node:test` + `node:assert/strict`。

## Global Constraints

- 确定性逻辑只写 lib;命令 markdown 只 prose;写 verb 参数走 `--json-stdin`。
- 原子写只经 `writeKnowledge`(内部 `writeTextAtomic`);绝不手写知识文件。
- marker 损坏/校验失败 = 抛错,不猜测修复;bin 层折叠为 `{ok:false,error}` + exit 1。
- 全量测试命令:`node --test ./plugins/speccode/tests/*.test.mjs`(勿用裸目录形式)。
- 测试用 `tests/helpers/tmprepo.mjs` 的 `makeRepo()` 建真实临时 git 仓库,用完 `rmSync` 清理。
- 插件 README 中英两版结构一一对应同步;不硬编码版本号/测试数量/命令总数。
- 能力键格式:`cap/<slug>`,`slug` 匹配 `^[a-z0-9-]+$`,文件内唯一。
- 规范布局:hand-written 段在前、蒸馏块在后,相邻节之间恰好一个空行;文件以单个换行结尾。
- dogfood 迁移中 hand-written 段只许位置重排,每行字节保留(尾部空行按布局规范折叠)。

---

### Task 1: lib 能力键写侧校验

**Files:**
- Modify: `plugins/speccode/lib/knowledge.mjs:102-111`(replaceDistilledBlocks 的入参校验循环)
- Test: `plugins/speccode/tests/knowledge.test.mjs`(replaceDistilledBlocks 测试区,~行 89-160)
- Test: `plugins/speccode/tests/cli.test.mjs:809-820`(replace-distilled 用例的 blocks 入参)

**Interfaces:**
- Consumes: 既有 `replaceDistilledBlocks(text, blocks)` 签名不变。
- Produces: 写侧契约——`blocks[].source` MUST 匹配 `^cap\/[a-z0-9-]+$`,否则 `throw Error('knowledge: distilled source must be a capability key (cap/<slug>): <source>')`。读侧(`parseDistilledBlocks`)继续接受任意 source 值(旧 `archive/<名>/`、`spec/<名>/` 与 legacy `promoted-from` 均照常解析)。

- [ ] **Step 1: 写失败测试**(追加到 knowledge.test.mjs 的 replaceDistilledBlocks 测试区末尾)

```js
test('replaceDistilledBlocks rejects non-cap-key sources on the write side', () => {
  for (const bad of ['old/', 'archive/2026-08-14-knowledge-set/', 'spec/knowledge-set/', 'x', 'cap/Knowledge-Set', 'cap/a_b', 'cap/a b', 'cap/', 'cap//a', '']) {
    assert.throws(
      () => replaceDistilledBlocks('hand\n', [{ source: bad, body: 'b' }]),
      /capability key/,
      JSON.stringify(bad),
    );
  }
});

test('replaceDistilledBlocks accepts cap/<kebab-slug> sources', () => {
  const out = replaceDistilledBlocks('', [{ source: 'cap/knowledge-set', body: 'b' }]);
  assert.equal(out, '<!-- distilled-from: cap/knowledge-set -->\nb\n<!-- /distilled -->\n');
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test plugins/speccode/tests/knowledge.test.mjs`
Expected: 新用例 FAIL(rejects 用例不抛错、accepts 用例正常返回——校验尚不存在),既有用例 PASS。

- [ ] **Step 3: 写最小实现**(knowledge.mjs,放在 `SLUG_RE` 附近)

```js
const CAP_SOURCE_RE = /^cap\/[a-z0-9-]+$/;
```

在 `replaceDistilledBlocks` 既有入参校验循环(`for (const b of blocks)`)开头、duplicate 检查之前插入:

```js
    if (typeof b.source !== 'string' || !CAP_SOURCE_RE.test(b.source)) {
      throw new Error(`knowledge: distilled source must be a capability key (cap/<slug>): ${b.source}`);
    }
```

- [ ] **Step 4: 更新既有测试的旧 source 入参**(只改 `blocks` 参数,不改文件文本里的旧 marker——读侧照常)

`knowledge.test.mjs`:
- 行 89 区 `'keeps hand-written lines byte-identical'`:`{ source: 'old/' ...}` → `'cap/old'`
- 行 95 区 `'drops distilled blocks whose source is gone...'`:`'fresh/'` → `'cap/fresh'`
- 行 101 区 `'appends blocks to empty text...'`:`'x/'` → `'cap/x'`
- 行 106 区 `'does not double up trailing newline...'`:`'old/'` → `'cap/old'`
- 行 131 / 139 区 duplicate source 两用例:入参 source 改 cap 键(如 `'cap/x'`)
- 行 146 区 `'throws when a body contains a distilled marker string'`:同上改 cap 键
- 行 157 区 `'missing body as an explicit empty string'`:`'x/'` → `'cap/x'`

`cli.test.mjs:809-820`(replace-distilled 用例):`blocks: [{ source: 'old/', body: 'new body' }]` → `source: 'cap/old'`(期望输出本任务暂不改,布局归位在 Task 2)。

- [ ] **Step 5: 运行确认通过**

Run: `node --test plugins/speccode/tests/knowledge.test.mjs plugins/speccode/tests/cli.test.mjs`
Expected: 全 PASS。

- [ ] **Step 6: 提交**

```bash
git add plugins/speccode/lib/knowledge.mjs plugins/speccode/tests/knowledge.test.mjs plugins/speccode/tests/cli.test.mjs
git commit -m "feat(knowledge): capability-key validation on the distilled write side"
```

### Task 2: lib 布局归位(replaceDistilledBlocks 输出规范布局)

**Files:**
- Modify: `plugins/speccode/lib/knowledge.mjs:102-155`(replaceDistilledBlocks 主体)、`:229-238`(listArchiveBundles 注释)、`:60-64`(parseDistilledBlocks 头注释)
- Test: `plugins/speccode/tests/knowledge.test.mjs`
- Test: `plugins/speccode/tests/cli.test.mjs:809-820`

**Interfaces:**
- Consumes: Task 1 的 cap 校验(不变)。
- Produces: `replaceDistilledBlocks(text, blocks)` 返回规范布局——全部非块内容(按出现顺序逐行保留,尾部空行折叠)在前,蒸馏块(既有块按文件序、新块按入参序)在后,相邻节之间恰好一个空行,结尾单个换行;同一输入重复运行幂等。

- [ ] **Step 1: 写失败测试**(追加;同时更新两处既有期望)

```js
test('replaceDistilledBlocks repositions hand-written content before blocks (first-run normalization)', () => {
  const text = 'hand A\n<!-- distilled-from: cap/one -->\nold\n<!-- /distilled -->\nmiddle\n<!-- distilled-from: cap/two -->\nold2\n<!-- /distilled -->\nhand B\n';
  const out = replaceDistilledBlocks(text, [
    { source: 'cap/one', body: 'new one' },
    { source: 'cap/two', body: 'new two' },
  ]);
  assert.equal(out, 'hand A\nmiddle\nhand B\n\n<!-- distilled-from: cap/one -->\nnew one\n<!-- /distilled -->\n\n<!-- distilled-from: cap/two -->\nnew two\n<!-- /distilled -->\n');
});

test('replaceDistilledBlocks layout normalization is idempotent', () => {
  const blocks = [{ source: 'cap/one', body: 'b1' }];
  const once = replaceDistilledBlocks('h\n<!-- distilled-from: cap/one -->\nold\n<!-- /distilled -->\n', blocks);
  const twice = replaceDistilledBlocks(once, blocks);
  assert.equal(once, twice);
  assert.deepEqual(parseDistilledBlocks(once), [{ source: 'cap/one', body: 'b1' }]);
});
```

既有期望更新:
- `'keeps hand-written lines byte-identical'`:期望改为 `'hand A\nhand B\n\n<!-- distilled-from: cap/old -->\nnew body\n<!-- /distilled -->\n'`
- `'does not double up trailing newline...'`:期望改为 `'hand A\nhand B\n\n<!-- distilled-from: cap/old -->\nnew body\n<!-- /distilled -->\n'`(与上一条同形)
- `cli.test.mjs:809-820` replace-distilled 用例:期望改为 `'hand A\nhand B\n\n<!-- distilled-from: cap/old -->\nnew body\n<!-- /distilled -->\n'`

- [ ] **Step 2: 运行确认失败**

Run: `node --test plugins/speccode/tests/knowledge.test.mjs plugins/speccode/tests/cli.test.mjs`
Expected: 新用例与上述更新的用例 FAIL(旧实现原位保留块)。

- [ ] **Step 3: 写最小实现**(整体替换 replaceDistilledBlocks 主体;校验循环保留 Task 1 版本)

```js
export function replaceDistilledBlocks(text, blocks) {
  const seen = new Set();
  for (const b of blocks) {
    if (typeof b.source !== 'string' || !CAP_SOURCE_RE.test(b.source)) {
      throw new Error(`knowledge: distilled source must be a capability key (cap/<slug>): ${b.source}`);
    }
    if (seen.has(b.source)) throw new Error(`knowledge: duplicate distilled source: ${b.source}`);
    seen.add(b.source);
    const body = String(b.body ?? '');
    if (body.includes('<!--') || body.includes('-->')) {
      throw new Error('knowledge: body contains marker string');
    }
  }
  const lines = text === '' ? [] : String(text).split('\n');
  const hand = [];
  const blockOut = [];
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
        blockOut.push(`<!-- distilled-from: ${source} -->\n${String(block.body ?? '')}\n${DISTILLED_END}`);
        emitted.add(source);
      }
      i = j + 1;
      continue;
    }
    if (line.trim() === DISTILLED_END || line.trim() === LEGACY_PROMOTED_END) {
      throw new Error('knowledge: closing distilled marker without opening');
    }
    hand.push(line);
    i += 1;
  }
  for (const b of blocks) {
    if (emitted.has(b.source)) continue;
    blockOut.push(`<!-- distilled-from: ${b.source} -->\n${String(b.body ?? '')}\n${DISTILLED_END}`);
  }
  // Canonical layout: hand-written section first, then distilled blocks, one
  // blank line between adjacent sections. Hand lines only MOVE (each line's
  // bytes survive); trailing blank lines collapse into the section
  // separators so a second run is byte-identical (idempotent).
  const handText = hand.join('\n').replace(/\n+$/, '');
  const sections = hand.length > 0 ? [handText, ...blockOut] : blockOut;
  const joined = sections.join('\n\n');
  return joined === '' || joined.endsWith('\n') ? joined : `${joined}\n`;
}
```

同时更新两处注释(语义退役,无行为变化):
- `parseDistilledBlocks` 头注释补一句:`// Source values may be legacy provenance strings (archive/<name>/, spec/<name>/) pending first-run capability-key migration — the write side rejects them until mapped.`
- `listArchiveBundles` 注释中「This is the stale-detection data source: ...」句替换为:`// Consumed-archive tracking is pure read-cost control: it decides which bundles distilling reads this run, nothing else (block freshness is audited against spec/, not bundle existence).`

- [ ] **Step 4: 运行确认通过**

Run: `node --test plugins/speccode/tests/knowledge.test.mjs plugins/speccode/tests/cli.test.mjs`
Expected: 全 PASS(`'drops distilled blocks...'`、`'appends blocks to empty text...'` 用例期望不变即通过——归位后输出恰与原期望一致)。

- [ ] **Step 5: 提交**

```bash
git add plugins/speccode/lib/knowledge.mjs plugins/speccode/tests/knowledge.test.mjs plugins/speccode/tests/cli.test.mjs
git commit -m "feat(knowledge): canonical hand-first layout in replaceDistilledBlocks"
```

### Task 3: lib replaceHandBlocks(手写段整段替换)

**Files:**
- Modify: `plugins/speccode/lib/knowledge.mjs`(新增导出函数,置于 replaceDistilledBlocks 之后)
- Test: `plugins/speccode/tests/knowledge.test.mjs`(replaceHandBlocks 测试区)+ 第 6 行 import 名单追加 `replaceHandBlocks`

**Interfaces:**
- Consumes: 既有 `DISTILLED_START` / `DISTILLED_END` / `LEGACY_PROMOTED_START` / `LEGACY_PROMOTED_END` 常量。
- Produces: `replaceHandBlocks(text, content) -> string`——`text` 的全部蒸馏块(含 legacy 格式)**逐字节保留且不迁移格式**,块外内容整体替换为 `content`;输出规范布局(手写段在前);`content` 含 `<!--` 或 `-->` 时抛 `Error('knowledge: content contains marker string')`;marker 损坏抛错与 replaceDistilledBlocks 同原则。Task 4 的 bin `replace-hand` 模式消费此函数。

- [ ] **Step 1: 写失败测试**

```js
test('replaceHandBlocks replaces hand region and preserves distilled blocks byte-identical', () => {
  const text = 'hand A\n<!-- distilled-from: cap/x -->\nbody\n<!-- /distilled -->\nhand B\n';
  const out = replaceHandBlocks(text, 'new hand\n');
  assert.equal(out, 'new hand\n\n<!-- distilled-from: cap/x -->\nbody\n<!-- /distilled -->\n');
});

test('replaceHandBlocks preserves legacy-format blocks unmigrated', () => {
  const out = replaceHandBlocks('<!-- promoted-from: old/ -->\nbody\n<!-- /promoted -->\n', 'hand\n');
  assert.equal(out, 'hand\n\n<!-- promoted-from: old/ -->\nbody\n<!-- /promoted -->\n');
});

test('replaceHandBlocks with no existing blocks writes content alone', () => {
  assert.equal(replaceHandBlocks('# old\n', '# new\n'), '# new\n');
});

test('replaceHandBlocks with empty content removes the hand region', () => {
  const out = replaceHandBlocks('hand\n<!-- distilled-from: cap/x -->\nb\n<!-- /distilled -->\n', '');
  assert.equal(out, '<!-- distilled-from: cap/x -->\nb\n<!-- /distilled -->\n');
});

test('replaceHandBlocks rejects content containing marker strings', () => {
  assert.throws(() => replaceHandBlocks('', 'a <!-- b'), /marker string/);
  assert.throws(() => replaceHandBlocks('', 'a --> b'), /marker string/);
});

test('replaceHandBlocks throws on malformed markers', () => {
  assert.throws(() => replaceHandBlocks('<!-- distilled-from: cap/x -->\nno end', 'h'));
  assert.throws(() => replaceHandBlocks('<!-- /distilled -->\n', 'h'));
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test plugins/speccode/tests/knowledge.test.mjs`
Expected: 新用例 FAIL(replaceHandBlocks 未导出,import 报错)。

- [ ] **Step 3: 写最小实现**(knowledge.mjs,replaceDistilledBlocks 之后)

```js
// Full rebuild of the hand-written region (design D4): replace everything
// outside distilled blocks with `content`, preserving every distilled block
// byte-for-byte (legacy format included — no migration here) and emitting
// the canonical layout. `content` must not contain marker strings, or the
// rebuilt file would be unparseable (same D5 guard as distilled bodies).
export function replaceHandBlocks(text, content) {
  const hand = String(content ?? '');
  if (hand.includes('<!--') || hand.includes('-->')) {
    throw new Error('knowledge: content contains marker string');
  }
  const lines = text === '' ? [] : String(text).split('\n');
  const blockOut = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const isNew = DISTILLED_START.exec(line);
    const m = isNew || LEGACY_PROMOTED_START.exec(line);
    if (m) {
      const end = isNew ? DISTILLED_END : LEGACY_PROMOTED_END;
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== end) {
        if (DISTILLED_START.exec(lines[j]) || LEGACY_PROMOTED_START.exec(lines[j])) {
          throw new Error('knowledge: nested distilled marker');
        }
        j += 1;
      }
      if (j >= lines.length) throw new Error('knowledge: unclosed distilled marker');
      blockOut.push(lines.slice(i, j + 1).join('\n'));
      i = j + 1;
      continue;
    }
    if (line.trim() === DISTILLED_END || line.trim() === LEGACY_PROMOTED_END) {
      throw new Error('knowledge: closing distilled marker without opening');
    }
    i += 1;
  }
  const handText = hand.replace(/\n+$/, '');
  const sections = handText !== '' ? [handText, ...blockOut] : blockOut;
  const joined = sections.join('\n\n');
  return joined === '' || joined.endsWith('\n') ? joined : `${joined}\n`;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test plugins/speccode/tests/knowledge.test.mjs`
Expected: 全 PASS。

- [ ] **Step 5: 提交**

```bash
git add plugins/speccode/lib/knowledge.mjs plugins/speccode/tests/knowledge.test.mjs
git commit -m "feat(knowledge): replaceHandBlocks — full hand-region rebuild preserving blocks"
```

### Task 4: bin write-knowledge 增 mode=replace-hand

**Files:**
- Modify: `plugins/speccode/bin/speccode.mjs:14`(import 名单)、`:337-342` 之后(VERBS['write-knowledge'] 内新增 mode 分支)
- Test: `plugins/speccode/tests/cli.test.mjs`(write-knowledge 测试区,~行 796-820)

**Interfaces:**
- Consumes: Task 3 的 `replaceHandBlocks(existing, content)`。
- Produces: CLI 契约——`write-knowledge --rel <rel> --json-stdin`,stdin `{"mode":"replace-hand","content":"..."}`;成功 `{ok:true,path}`;`content` 缺失/非字符串 → `{ok:false,error:'mode replace-hand requires content: string'}` exit 1;content 含 marker 字符串 → 透传 lib 抛错 `{ok:false,error:'knowledge: content contains marker string'}` exit 1。Task 6 的 recording-knowledge 命令消费此模式。

- [ ] **Step 1: 写失败测试**(追加到 cli.test.mjs write-knowledge 测试区)

```js
test('write-knowledge replace-hand replaces hand region, keeps distilled blocks', () => {
  const repo = makeRepo();
  const p = join(repo, 'speccode', 'knowledge', 'development', 'pitfalls.md');
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, 'hand A\n<!-- distilled-from: cap/x -->\nbody\n<!-- /distilled -->\nhand B\n');
  const { code, json } = runCliStdin(repo, 'write-knowledge', '--cwd', repo, '--rel', 'development/pitfalls.md', '--json-stdin',
    JSON.stringify({ mode: 'replace-hand', content: '## 手写\n整理后内容\n' }));
  assert.equal(code, 0);
  assert.equal(json.ok, true);
  assert.equal(readFileSync(p, 'utf8'), '## 手写\n整理后内容\n\n<!-- distilled-from: cap/x -->\nbody\n<!-- /distilled -->\n');
  rmSync(repo, { recursive: true, force: true });
});

test('write-knowledge replace-hand rejects missing content', () => {
  const repo = makeRepo();
  const { code, json } = runCliStdin(repo, 'write-knowledge', '--cwd', repo, '--rel', 'development/pitfalls.md', '--json-stdin',
    JSON.stringify({ mode: 'replace-hand' }));
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  assert.match(json.error, /replace-hand requires content/);
  rmSync(repo, { recursive: true, force: true });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test plugins/speccode/tests/cli.test.mjs`
Expected: 新用例 FAIL(`unknown mode: replace-hand`)。

- [ ] **Step 3: 写最小实现**

`bin/speccode.mjs:14` import 名单追加 `replaceHandBlocks`(按字母序插入 `replaceDistilledBlocks` 前)。VERBS['write-knowledge'] 内、`replace-distilled` 分支之后插入:

```js
    if (mode === 'replace-hand') {
      if (typeof content !== 'string') return { ok: false, error: 'mode replace-hand requires content: string' };
      const existing = existsSync(target) ? readFileSync(target, 'utf8') : '';
      writeKnowledge(root, safe.rel, replaceHandBlocks(existing, content));
      return { ok: true, path: safe.rel };
    }
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test plugins/speccode/tests/cli.test.mjs`
Expected: 全 PASS。

- [ ] **Step 5: 提交**

```bash
git add plugins/speccode/bin/speccode.mjs plugins/speccode/tests/cli.test.mjs
git commit -m "feat(cli): write-knowledge replace-hand mode"
```

### Task 5: 重写 distilling-knowledge.md 机制段

**Files:**
- Modify: `plugins/speccode/commands/distilling-knowledge.md`(前置 §6-7、蒸馏 §1-4、闸门段;其余段不动)

**Interfaces:**
- Consumes: Task 1-2 的 lib 行为(能力键校验、布局归位);既有 verb `read-knowledge --blocks` / `write-knowledge mode=replace-distilled` / `read-consumed-archives` / `write-consumed-archives` 形状均不变。
- Produces: 命令 prose 契约(下游 dogfood Task 9 按此执行)。本任务无代码,验证 = 术语一致性 grep。

- [ ] **Step 1: 改前置 §6**(增量读定位降级,改写为)

> 6. 读 `speccode/spec/`(各 capability 主规格,**全量**——这是新鲜度审查的真值锚)。archive 保持**增量读**(纯读成本控制):运行 `speccode.mjs read-consumed-archives --cwd .` 得 `{consumed, unconsumed, present, bootstrap}`——`bootstrap=true`(sidecar `_distilled.meta.json` 缺失)则首次引导,本次全量读 archive 全部归档包;否则只读 `unconsumed` 列出的归档包,`consumed` 包整包跳过(含其 propose/design/brainstorm 子文档)。sidecar 只决定本次读哪些包,不参与任何蒸馏块存废判定。

- [ ] **Step 2: 改前置 §7**(逃生口语义)

> 7. 删 `_distilled.meta.json` 再跑即强制全量重读归档包 + 重种子,为读成本控制失准后的官方逃生口,不另设 `--full` flag。(重蒸本就每次全量:既有块的新鲜度审查不依赖是否重读其来源包。)

- [ ] **Step 3: 重写蒸馏 §2**(carry-forward/supersession 段整段替换)

> 2. 蒸馏目标 = 6 个骨架 development topic ∪ `development/` 下用户自建 topic;蒸馏内容限于 SDD 过程知识(架构、准则、环境、对接、坑与评审共识、安全)——spec/archive 中的业务知识(领域术语、业务流程、业务历史)不蒸馏。从 spec/(真值锚)与本次读到的归档包提炼「该主题下值得长期记住的当前态事实/准则/坑」,生成每个目标 topic 的蒸馏块集合:
>    - **块身份 = 能力键**:每个块 marker 用 `cap/<slug>`(slug 匹配 `^[a-z0-9-]+$`,同文件唯一);块的出处(archive 归档包名 / spec capability 目录名)以纯文本(如括注「出自 archive/<包名>」)记在 body 内。能力键命名优先对齐既有 `speccode/spec/` capability 目录名(如 `cap/git-workflow-lifecycle`);无对应 capability 的主题用稳定 kebab 主题词(如 `cap/documentation-facade`)。
>    - **upsert**:同 topic 文件内同能力键只保留一个块——后续知识覆盖/合并先前内容,不累积历史;知识退役即删,不留墓碑块(历史叙事归 archive/ 与 CHANGELOG)。
>    - **新鲜度审查(每次运行)**:对全部蒸馏目标 topic 的**全部既有蒸馏块**(含来源包本次未读的)逐块审查:真值锚 = spec/ 主规格。内容仍真 → 保留(可并入同能力键新块);过时/被取代 → 提议改写或删除(附理由);已描述退役机制的知识块(如 stale/superseded 机制本身)→ 建议删除(附理由)。
>    - **存量块映射(首次运行)**:既有块的旧 source 值(`archive/<名>/`、`spec/<名>/`)解析照常;为每块提议能力键映射(优先按块内容所属能力对齐 capability 目录名;同文件多块映射到同一能力键时合并为一块,后到覆盖/并入先前),闸门逐块确认。未映射的旧 source 块无法经写侧校验直写(引擎强制迁移必经闸门)。
>    - 现有 hand-written 段作为蒸馏参考上下文,可引用其事实,但不得把其中内容复制为蒸馏块(手写段经 replace-hand 由 recording-knowledge 维护);
>    - 无内容可蒸且该 topic 此前也无蒸馏块 → 产出空 blocks 数组(文件保持现状);该 topic 已有蒸馏块时,blocks 为空意味着其现有蒸馏块将被删除(全量重建语义)。
>    - 蒸馏块 body 不得包含 `<!--` 或 `-->` 字符串。

- [ ] **Step 4: 改蒸馏 §4**(diff 纪律)

> 4. 汇总候选:对每个 topic 列出 `blocks: [{source, body}]`,与现状 diff 展示——**只展示变化块**(新增/改写/删除/映射),无变化块不进入展示;每个删除或合并项 MUST 附一句理由。

- [ ] **Step 5: 重写闸门 stale/superseded 段**(整段替换为)

> source 指向的 archive 或 spec capability 已不存在**不再构成独立处置语义**(stale/superseded/carry-forward 机制已退役):块的存废一律由新鲜度审查提议、闸门按「附理由的删除/合并/改写」确认。存量旧 source 块经映射确认后写入;映射拒绝 = 换一个能力键再提议(映射本身不可避免——写侧只接受能力键)。

- [ ] **Step 6: 落盘段补一句**(§1 之后)

> 写入后文件布局自动归位为「手写段在前、蒸馏块在后」(引擎保证,幂等)。

- [ ] **Step 7: 验证**

Run: `grep -n "carry" plugins/speccode/commands/distilling-knowledge.md; grep -n "stale" plugins/speccode/commands/distilling-knowledge.md; grep -n "superseded" plugins/speccode/commands/distilling-knowledge.md`
Expected: 无输出(三术语全部清除;§闸门新段中的「stale/superseded/carry-forward 机制已退役」表述位于替换后段落,如 grep 命中该句,确认它是对退役的否定性陈述即可)。再跑全量测试确认 prose 改动零破坏:`node --test ./plugins/speccode/tests/*.test.mjs` 全绿。

- [ ] **Step 8: 提交**

```bash
git add plugins/speccode/commands/distilling-knowledge.md
git commit -m "docs(commands): distilling-knowledge freshness-audit + capability-key semantics"
```

### Task 6: 改造 recording-knowledge.md(整理 + replace-hand)

**Files:**
- Modify: `plugins/speccode/commands/recording-knowledge.md`(闸门 §2 写入行、新增「手写段整理」小节、约束段)

**Interfaces:**
- Consumes: Task 4 的 `write-knowledge mode=replace-hand`。
- Produces: 命令 prose 契约——recording 维护手写段(写入 + 整理),蒸馏块绝不触碰。

- [ ] **Step 1: 改闸门 §2 的写入行**(原文「确认 → `write-knowledge --rel <topic路径> --json-stdin`(mode=append-hand,content=内容)原子写(追加为 hand-written 段,不带 marker);」替换为)

>    - 确认 → 收集「新内容 + 整理后的既有手写段」为完整手写区文本,经 `write-knowledge --rel <topic路径> --json-stdin`(mode=replace-hand,content=完整手写区文本)原子写(手写区整体替换,蒸馏块字节级保留,布局归位为手写段在前);

- [ ] **Step 2: 在「闸门」小节之后新增「手写段整理」小节**

> ## 手写段整理
>
> 每次运行对**本次写入 topic** 的既有 hand-written 段做整理:
> - 动作限于:合并重复条目、删除过时条目、收紧表述;权威是在场用户——MUST NOT 以 `speccode/spec/` 为真值改写用户知识,不读 spec 做判定;
> - 每个删除/合并项 MUST 附一句理由,与写入草稿一并展示,经闸门确认后随本次写入一并落盘(经 replace-hand 一次写入);
> - 整理不触碰蒸馏块(marker 内内容),不把整理结果写成蒸馏块。

- [ ] **Step 3: 改约束段**(末行「内容不得包含 `<!--` 或 `-->` 字符串。」保留,其上一行「只写 hand-written 段(不写 marker);写蒸馏块是 distilling-knowledge 的职责。」替换为)

> - 只维护 hand-written 段(写入与整理均经 replace-hand,不写 marker);写蒸馏块是 distilling-knowledge 的职责,蒸馏块字节级保留。

- [ ] **Step 4: 验证**

Run: `grep -n "append-hand" plugins/speccode/commands/recording-knowledge.md`
Expected: 无输出。全量测试:`node --test ./plugins/speccode/tests/*.test.mjs` 全绿。

- [ ] **Step 5: 提交**

```bash
git add plugins/speccode/commands/recording-knowledge.md
git commit -m "docs(commands): recording-knowledge hand-section tidy via replace-hand"
```

### Task 7: append-hand 模式退役

**Files:**
- Modify: `plugins/speccode/bin/speccode.mjs:331-335`(删除 append-hand 分支)
- Test: `plugins/speccode/tests/cli.test.mjs:796-807`(append-hand 用例改为退役断言)

**Interfaces:**
- Consumes: Task 6 已使 recording 不再引用 append-hand(命令 prose 无残留)。
- Produces: `write-knowledge` mode 集合 = `replace | replace-hand | replace-distilled | index`;`append-hand` → `{ok:false,error:'unknown mode: append-hand'}` exit 1。

- [ ] **Step 1: 改测试**(原 `'write-knowledge append-hand appends hand-written section'` 用例整替为)

```js
test('write-knowledge append-hand is retired (unknown mode)', () => {
  const repo = makeRepo();
  const { code, json } = runCliStdin(repo, 'write-knowledge', '--cwd', repo, '--rel', 'development/pitfalls.md', '--json-stdin',
    JSON.stringify({ mode: 'append-hand', content: 'x' }));
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  assert.match(json.error, /unknown mode: append-hand/);
  rmSync(repo, { recursive: true, force: true });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test plugins/speccode/tests/cli.test.mjs`
Expected: 该用例 FAIL(append-hand 仍可用,code 0)。

- [ ] **Step 3: 删实现**(bin VERBS['write-knowledge'] 内 append-hand 分支整体删除)

```js
    if (mode === 'append-hand') {
      const existing = existsSync(target) ? readFileSync(target, 'utf8') : '';
      const sep = existing && !existing.endsWith('\n') && !String(content ?? '').startsWith('\n') ? '\n' : '';
      writeKnowledge(root, safe.rel, existing + sep + String(content ?? ''));
      return { ok: true, path: safe.rel };
    }
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test plugins/speccode/tests/cli.test.mjs`
Expected: 全 PASS。

- [ ] **Step 5: 提交**

```bash
git add plugins/speccode/bin/speccode.mjs plugins/speccode/tests/cli.test.mjs
git commit -m "chore(cli): retire append-hand mode (subsumed by replace-hand)"
```

### Task 8: 插件 README×2 命令表与知识集段更新

**Files:**
- Modify: `plugins/speccode/README.md:68-69`(命令表两行)、`:166`(知识集分层大段)
- Modify: `plugins/speccode/README_CN.md:68-69`、`:166`

(根 README×2 经核实只有命令名清单行、无知识机制 prose——不改动。)

**Interfaces:**
- Consumes: Task 5-6 的最终命令语义。
- Produces: 门面文档与机制一致。

- [ ] **Step 1: 替换 README.md:68**(distilling-knowledge 行)

```markdown
| `/speccode:distilling-knowledge` | Distill the `speccode/knowledge/` topic files from `spec/` (full read — the freshness anchor) + `archive/` (**incremental**: only unconsumed archive bundles, tracked via `knowledge/_distilled.meta.json`, pure read-cost control); every existing block is freshness-audited against the current specs on each run; blocks are keyed by capability (`<!-- distilled-from: cap/<slug> -->`, one per capability per file, upsert — later knowledge overrides earlier; retired knowledge is deleted with a reason via the gate, no tombstones); legacy-source blocks are mapped to capability keys through the gate on first run; SDD process knowledge only, out-of-scope topics sunset via the gate; delete the sidecar to force a full archive re-read (no `--full` flag); human gate before write; commits on save | chore/knowledge-* worktree branch (unified creating-worktree entry, finishing-worktree finish) |
```

- [ ] **Step 2: 替换 README.md:69**(recording-knowledge 行)

```markdown
| `/speccode:recording-knowledge` | Record knowledge directly into hand-written sections (fit check: process knowledge stays, business knowledge is pointed to external RAG; draft → human gate → atomic write via `replace-hand`, distilled blocks preserved byte-for-byte; also tidies the topic's existing hand-written section each run — merge/delete with reasons, authority is the present user); commits on save | chore/knowledge-* worktree branch (unified entry/finish) |
```

- [ ] **Step 3: 重写 README.md:166**(知识集分层段,整段替换)

```markdown
- **Knowledge set: a current-state snapshot, keyed by capability**: each topic file under `knowledge/` mixes two kinds of content. `distilling-knowledge` distills `spec/` (full read — the freshness anchor) and `archive/` (**incrementally**, tracked in `knowledge/_distilled.meta.json` purely as read-cost control) into **distilled blocks** wrapped in `<!-- distilled-from: cap/<slug> --> ... <!-- /distilled -->` markers: the key is a capability slug, unique per file, upserted on every run — later knowledge overrides earlier, retired knowledge is deleted through the gate with a reason (no tombstones; history lives in `archive/` and the CHANGELOG), and every existing block is freshness-audited against the current specs on each run. `recording-knowledge` writes and tidies the free-form **hand-written** prose outside those markers (replace-hand mode: the whole hand region is rebuilt on each write while distilled blocks survive byte-for-byte; tidy actions — merge/delete — carry reasons and answer to the present user, not to the specs). Both writes emit the canonical layout: hand-written first, distilled blocks after. The set curates SDD process knowledge only (`development/*`; pitfalls also covers recurring review findings and team review consensus). Business knowledge is left to external RAG systems: `recording-knowledge` runs a fit check before writing (a recommendation, not a hard block), and `distilling-knowledge` sunsets distilled blocks of out-of-scope topics through the same human gate while preserving hand-written content byte-for-byte. Legacy `promoted-from`/`/promoted` markers and legacy provenance-valued sources are still parsed on read; existing files migrate to capability keys through the gate on their first distill.
```

- [ ] **Step 4: README_CN.md:68-69、:166 同步**(语义与上面三段一一对应:能力键制快照、每次新鲜度审查、upsert 覆盖不累积、退役即删附理由不留墓碑、replace-hand 整写手写区整理、布局手写在前、增量读纯成本控制、存量经闸门映射)

- [ ] **Step 5: 验证 + 提交**

Run: `grep -n -i "stale\|carried forward\|superseded" plugins/speccode/README.md plugins/speccode/README_CN.md; node --test ./plugins/speccode/tests/*.test.mjs`
Expected: grep 无输出;测试全绿。

```bash
git add plugins/speccode/README.md plugins/speccode/README_CN.md
git commit -m "docs(readme): knowledge set as capability-keyed current-state snapshot"
```

### Task 9: dogfood 首跑迁移(交互闸门,经用户确认)

**Files:**
- Modify: `speccode/knowledge/development/*.md`(6 个 topic:存量块映射能力键 + 同键合并 + 布局归位)
- Modify: `speccode/knowledge/_index.md`(命令实扫重建,摘要随内容刷新)
- 不改:`speccode/knowledge/_distilled.meta.json` 判定逻辑(运行时由命令追记)

**Interfaces:**
- Consumes: Task 1-5 的引擎与命令(新规则首跑);`read-knowledge --blocks` / `write-knowledge mode=replace-distilled` / `mode=index`。
- Produces: 本仓知识集全面能力键化——后续 distilling 运行恢复常规增量。

- [ ] **Step 1: 按 Task 5 重写后的命令语义执行 distilling 流程**——读 `speccode/spec/` 全量 + `read-consumed-archives`(现 sidecar 已消费至 #41,#42/#43 归档包为本次增量);对 6 个 development topic 的全部既有块做新鲜度审查。映射规则(每块提议,闸门逐项确认,可改判):
  - 分支拓扑/worktree/对账/状态/pending_operation/children → `cap/git-workflow-lifecycle`
  - 知识集机制/memory 数据模型 → `cap/session-memory` 或 `cap/knowledge-set`(按块主题)
  - SDD 文档链路/plan checkbox/brainstorm 回写/命令衔接 → `cap/sdd-document-lifecycle`
  - PR 工具/query-pr/squash 探测 → `cap/pr-tool-integration`;hooks → `cap/hook-event-integration`;清洗/CR 注入 → `cap/tool-input-sanitization`;config/init/探测 → `cap/speccode-config-management`;代码智能探测 → `cap/code-intel-tool-integration`;plugin.json/版本纪律 → `cap/plugin-packaging`
  - README/文档门面/CLAUDE.md/visual companion → 无对应 capability,用 `cap/documentation-facade`
  - **同文件同能力键 MUST 合并为一块**(upsert 语义,后者并入前者;例:architecture.md 中 2026-08-14-knowledge-set 与 2026-08-15-knowledge-command-rename、2026-08-15-knowledge-set-refocus、2026-08-16-distill-incremental-archive、2026-08-16-knowledge-trunk-bootstrap、2026-09-03-knowledge-unified-entry 六块同属 `cap/knowledge-set` → 合并为一块当前态快照,出处以括注记在 body)
  - 描述已退役机制的知识块(如「stale vs superseded」判定、display 层坑、docstrip)→ 保留历史教训价值的并入对应能力块,纯机制描述的提议删除(附理由);**「stale vs superseded」块本身按探索结论预告退役**
- [ ] **Step 2: 闸门确认后逐 topic 写入**(经 `write-knowledge mode=replace-distilled`,blocks 全部 cap 键;手写段自动归位前置)+ `_index.md` 重建(mode=index,实扫)
- [ ] **Step 3: 验证**

Run: `grep -rn "distilled-from: archive" speccode/knowledge/ ; grep -rc "distilled-from: cap/" speccode/knowledge/development/ ; node --test ./plugins/speccode/tests/*.test.mjs`
Expected: 第一条无输出(旧 source 清零);第二条各文件计数 ≥1;测试全绿。抽查任一文件头部为手写段、其后为蒸馏块。

- [ ] **Step 4: 提交**

```bash
git add speccode/knowledge/
git commit -m "docs(knowledge): migrate to capability-keyed snapshot (first gate-run)"
```

- [ ] **Step 5: replace-hand 实战验证**(tasks 清单要求的 recording 整理验证):对 `development/pitfalls.md` 手写段(「## 手写踩坑」两条)跑一次 recording-knowledge——整理陈述(如无整理诉求则仅重写为同内容),经 `write-knowledge mode=replace-hand` 落盘,确认蒸馏块区与提交前逐字节一致。验证后按原样提交:

```bash
git add speccode/knowledge/
git commit -m "docs(knowledge): recording tidy pass via replace-hand"
```

### Task 10: 终验与交接

**Files:**
- Modify: 无(只读验证 + 引导)

**Interfaces:**
- Consumes: 全部前序任务。
- Produces: 可交接 syncing → archiving → finishing-worktree 的绿色分支。

- [ ] **Step 1: 全量测试**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: 全 PASS(266 既有 + 本计划新增用例,零 fail)。

- [ ] **Step 2: 退役术语全局清零核查**(命令/README/命令 prose 层;archive/ 与 spec delta 中的历史表述不在此列)

Run: `grep -rn -i "carry.forward\|carry forward" plugins/speccode/commands/ plugins/speccode/README.md plugins/speccode/README_CN.md; grep -n "stale" plugins/speccode/commands/distilling-knowledge.md plugins/speccode/commands/recording-knowledge.md`
Expected: 无输出(grep 退出码 1)。

- [ ] **Step 3: 交接**——引导执行 `/speccode:requesting-code-review`(BASE = propose 提交 f7eb1fd),通过后 `/speccode:syncing`(把 delta 合入 `speccode/spec/knowledge-set/spec.md`)→ `/speccode:archiving` → `/speccode:finishing-worktree`(单 PR 上 trunk)。CHANGELOG 由发布纪律统一处理(speccode-workflow skill),不在本计划内。

---

## 计划自查记录

- **规格覆盖**:design D1(能力键)→ Task 1;D2(真值锚/sidecar 降级)→ Task 5 §6/§7 + Task 2 注释;D3(三机制退役)→ Task 5 §5 + Task 10 Step 2;D4(replace-hand/整理)→ Task 3/4/6;D5(布局归位)→ Task 2/3;D6(迁移零工具)→ Task 5 §3 + Task 9;D7(退役即删)→ Task 5 §3 + Task 9;spec delta 四条 MODIFIED 的行为全部落在 Task 1-9。proposal What Changes 7 项全覆盖;tasks.md 17 项归并为 Task 1-10(其 11 项「README×4」经核实修正为插件 README×2——根 README 无知识机制 prose)。
- **占位符扫描**:无 TBD/TODO/「类似任务 N」;prose 任务(Task 5/6/8)给出逐段替换文本。
- **类型一致性**:`CAP_SOURCE_RE`、`replaceHandBlocks(text, content)`、mode 名 `replace-hand`、错误文案 `capability key (cap/<slug>)` / `content contains marker string` 在 Task 1-7 间一致。
