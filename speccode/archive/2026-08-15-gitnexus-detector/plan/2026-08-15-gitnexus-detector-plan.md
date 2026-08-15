# gitnexus-detector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将知识库工具探测器表的 LightRAG 替换为 GitNexus(移出异类、纳入代码知识图谱工具)。

**Architecture:** 改动集中在一张探测器表 `KNOWLEDGE_TOOL_DETECTORS`(lib/detect.mjs)与其单测(detect.test.mjs),外加插件 README §9 工具清单(中英)。不触碰探测 available/integrated 两维度模型、不改 config 字段。

**Tech Stack:** Node ≥ 24,纯 ESM、零第三方依赖(仅 node: 内置模块);测试用 node:test + node:assert/strict。

## Global Constraints

- Node ≥ 24,无 package.json;测试必须用 glob 形式 `node --test ./plugins/speccode/tests/*.test.mjs`(裸 `node --test plugins/speccode/tests/` 在 v24 会 MODULE_NOT_FOUND)。
- gitnexus 条目签名:`{id:'gitnexus', match:'gitnexus', bin:'gitnexus', dirs:['.gitnexus']}`(bin 名独特不误命中;dirs 用 `.gitnexus` 项目目录)。
- 探测器表 id 顺序 MUST 为:understand-anything, codegraph, graphify, codemap, gitnexus。
- 插件 README 中英两版结构一一对应,任何内容改动 MUST 同步 `plugins/speccode/README.md` 与 `plugins/speccode/README_CN.md`。
- 不得硬编码版本号与测试数量(以 CHANGELOG 链接为单一数据源)。

---

### Task 1: 探测器表 lightrag → gitnexus(实现 + 断言 + 用例迁移)

**Files:**
- Modify: `plugins/speccode/lib/detect.mjs:20`
- Modify: `plugins/speccode/tests/detect.test.mjs:10`
- Modify: `plugins/speccode/tests/detect.test.mjs:51-59`

**Interfaces:**
- Produces: gitnexus 探测器条目 `{id:'gitnexus', match:'gitnexus', bin:'gitnexus', dirs:['.gitnexus']}`;探测器表 id 序 `['understand-anything','codegraph','graphify','codemap','gitnexus']`。

- [x] **Step 1: 写失败测试(改断言 + 迁移 lightrag 用例)**

`plugins/speccode/tests/detect.test.mjs` 第 10 行,把 ids 断言里的 `'lightrag'` 改为 `'gitnexus'`:

```js
  assert.deepEqual(ids, ['understand-anything', 'codegraph', 'graphify', 'codemap', 'gitnexus']);
```

同文件第 51-59 行的 lightrag 用例迁移为 gitnexus(工具名与 MCP key 一并替换):

```js
test('user ~/.claude.json mcp → available-only (not integrated)', () => {
  const readJson = (p) => (p.endsWith('/home/u/.claude.json') ? { mcpServers: { gitnexus: {} } } : null);
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson, commandV: () => false, exists: () => false,
  });
  const gn = tools.find((t) => t.id === 'gitnexus');
  assert.equal(gn.available.value, true);
  assert.equal(gn.integrated.value, false);
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test plugins/speccode/tests/detect.test.mjs`
Expected: FAIL——ids 断言失败(actual 含 `lightrag`,expected 含 `gitnexus`);gitnexus 用例抛 `Cannot read properties of undefined`(gitnexus 尚不在探测表)。

- [x] **Step 3: 写最小实现(换探测表条目)**

`plugins/speccode/lib/detect.mjs` 删除第 20 行 lightrag 条目,替换为 gitnexus 条目(数组末尾):

```js
  { id: 'codemap', match: 'codemap', bin: 'codemap', dirs: ['.codemaker/codeindex', '.codemaker/codemap'] },
  { id: 'gitnexus', match: 'gitnexus', bin: 'gitnexus', dirs: ['.gitnexus'] },
```

(上一行 `{ id: 'lightrag', match: 'lightrag', bin: 'lightrag', dirs: ['.lightrag'] },` MUST 删除。)

- [x] **Step 4: 运行确认通过**

Run: `node --test plugins/speccode/tests/detect.test.mjs`
Expected: PASS

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/lib/detect.mjs plugins/speccode/tests/detect.test.mjs
git commit -m "feat(detect): swap lightrag for gitnexus in knowledge-tool detectors"
```

### Task 2: 补 gitnexus dir/cli 探测覆盖(detect.test.mjs)

**Files:**
- Modify: `plugins/speccode/tests/detect.test.mjs`(在 codemap 目录用例附近追加两例)

**Interfaces:**
- Consumes: Task 1 产出的 gitnexus 条目(dirs `['.gitnexus']`、bin `gitnexus`)。

- [x] **Step 1: 写测试(新增 gitnexus 项目目录用例 + CLI 用例)**

```js
test('.gitnexus dir present → gitnexus integrated', () => {
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson: () => null, commandV: () => false,
    exists: (p) => p === '/repo/.gitnexus',
  });
  const gn = tools.find((t) => t.id === 'gitnexus');
  assert.deepEqual(gn.available, { value: false, evidence: null });
  assert.deepEqual(gn.integrated, { value: true, evidence: '.gitnexus' });
});

test('gitnexus cli → available-only', () => {
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson: () => null,
    commandV: (bin) => bin === 'gitnexus', exists: () => false,
  });
  const gn = tools.find((t) => t.id === 'gitnexus');
  assert.equal(gn.available.value, true);
  assert.equal(gn.integrated.value, false);
});
```

- [x] **Step 2: 运行确认通过**

Run: `node --test plugins/speccode/tests/detect.test.mjs`
Expected: PASS(gitnexus 条目已在 Task 1 加入)

- [x] **Step 3: 提交**

```bash
git add plugins/speccode/tests/detect.test.mjs
git commit -m "test(detect): cover gitnexus dir and cli probes"
```

### Task 3: README §9 中英同步 + 全量测试

**Files:**
- Modify: `plugins/speccode/README.md:188`
- Modify: `plugins/speccode/README_CN.md:188`

**Interfaces:**
- Consumes: 无代码依赖(纯文档)。

- [x] **Step 1: 更新英文 §9 工具清单**

`plugins/speccode/README.md` 第 188 行,把 `LightRAG` 改为 `GitNexus`:

```markdown
`/speccode:init` probes five knowledge-base tools: **understand-anything / CodeGraph / Graphify / CodeMap / GitNexus**, covering four kinds of sources:
```

- [x] **Step 2: 更新中文 §9 工具清单**

`plugins/speccode/README_CN.md` 第 188 行,同步替换:

```markdown
`/speccode:init` 探测五类知识库工具:**understand-anything / CodeGraph / Graphify / CodeMap / GitNexus**,覆盖四类来源:
```

- [x] **Step 3: 全量测试验证无回归**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: 全绿,0 fail(含 Task 2 新增的 gitnexus dir/cli 两例)

- [x] **Step 4: 提交**

```bash
git add plugins/speccode/README.md plugins/speccode/README_CN.md
git commit -m "docs(speccode): swap lightrag for gitnexus in knowledge-base tools list"
```
